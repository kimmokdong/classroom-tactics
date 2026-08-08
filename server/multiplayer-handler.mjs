import { createHash, randomInt, randomUUID } from 'node:crypto';
import { AUGMENTS, SYNERGIES, UNIT_POOL } from '../js/data.js';
import { ITEMS } from '../js/items.js';
import { getActiveSynergyLevel, getSynergyData } from '../js/systems/SynergyManager.js';
import {
    MULTIPLAYER_MAX_PLAYERS,
    MULTIPLAYER_MIN_PLAYERS,
    MULTIPLAYER_BALANCE_VERSION,
    MULTIPLAYER_STATS_SCHEMA_VERSION,
    aggregateMatchStats,
    assignOpponentId,
    calculateBoardCost,
    getRoundKey,
    getRoundOrdinal,
    rankPlayers,
    sanitizeNickname,
    sanitizeRoomCode
} from '../js/multiplayer/core.js';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const unitById = new Map(UNIT_POOL.map(unit => [unit.id, unit]));
const unitCosts = Object.fromEntries(UNIT_POOL.map(unit => [unit.id, unit.tier]));
const itemIds = new Set(ITEMS.map(item => item.id));
const augmentIds = new Set(Object.values(AUGMENTS).flat().map(augment => augment.id));

const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const fail = (message, status = 400) => json({ ok: false, error: message }, status);
const hashToken = token => createHash('sha256').update(String(token)).digest('hex');
const roomPrefix = code => `rooms/${code}`;
const roomMetaKey = code => `${roomPrefix(code)}/meta`;
const playerKey = (code, playerId) => `${roomPrefix(code)}/players/${playerId}`;

function getRoomCodeFromRequest(url, body) {
    return sanitizeRoomCode(body?.code || url.searchParams.get('code'));
}

function createRoomCode() {
    return Array.from({ length: 6 }, () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join('');
}

function sanitizeGlobalBuffs(value) {
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
        if (typeof entry === 'boolean') return [[key, entry]];
        const numeric = Number(entry);
        return Number.isFinite(numeric) ? [[key, Math.max(-1000, Math.min(1000, numeric))]] : [];
    }));
}

function sanitizeBoard(value) {
    return Array.from({ length: 24 }, (_, index) => {
        const entry = Array.isArray(value) ? value[index] : null;
        const definition = unitById.get(String(entry?.unitId || entry?.id || ''));
        if (!definition) return null;
        const star = Math.min(3, Math.max(1, Math.floor(Number(entry.star) || 1)));
        const growth = entry.permGrowth && typeof entry.permGrowth === 'object'
            ? Object.fromEntries(['ad', 'as', 'ap', 'hp'].flatMap(key => {
                const number = Number(entry.permGrowth[key]);
                return Number.isFinite(number) ? [[key, Math.max(0, Math.min(100000, number))]] : [];
            }))
            : undefined;
        return {
            unitId: definition.id,
            name: definition.name,
            icon: definition.icon,
            tier: definition.tier,
            star,
            items: Array.isArray(entry.items) ? entry.items.filter(id => itemIds.has(id)).slice(0, 3) : [],
            ...(Array.isArray(entry.thievesItems) ? { thievesItems: entry.thievesItems.filter(id => itemIds.has(id)).slice(0, 2) } : {}),
            ...(growth && Object.keys(growth).length ? { permGrowth: growth } : {})
        };
    });
}

function activeSynergies(board) {
    const definitions = board.map(entry => entry ? unitById.get(entry.unitId) : null);
    const counts = getSynergyData(definitions);
    return ['subjects', 'clubs'].flatMap(type => Object.entries(counts[type]).flatMap(([name, count]) => {
        const definition = SYNERGIES[type]?.[name];
        if (!definition) return [];
        const level = getActiveSynergyLevel(count, Object.keys(definition.levels), Boolean(definition.exactMatch));
        return level > 0 ? [{ type, name, count, level }] : [];
    }));
}

function sanitizeSnapshot(body) {
    const board = sanitizeBoard(body?.board);
    return {
        board,
        boardCost: calculateBoardCost(board, unitCosts),
        synergies: activeSynergies(board),
        gold: Math.max(0, Math.min(999, Number(body?.gold) || 0)),
        globalBuffs: sanitizeGlobalBuffs(body?.globalBuffs),
        augments: Array.isArray(body?.augments) ? body.augments.filter(id => augmentIds.has(id)).slice(0, 3) : []
    };
}

function publicPlayer(player) {
    if (!player) return null;
    return {
        id: player.id,
        nickname: player.nickname,
        ready: Boolean(player.ready),
        hp: Number(player.hp),
        stage: player.stage,
        roundKey: player.roundKey || null,
        boardCost: Number(player.boardCost || 0),
        eliminatedRound: player.eliminatedRound || null,
        placement: player.placement || null,
        isHost: Boolean(player.isHost)
    };
}

function publicRoom(meta, players, selfId) {
    const visiblePlayers = meta.status === 'finished' ? rankPlayers(players) : players;
    return {
        id: meta.id,
        code: meta.code,
        status: meta.status,
        seed: meta.seed,
        hostId: meta.hostId,
        minPlayers: MULTIPLAYER_MIN_PLAYERS,
        maxPlayers: MULTIPLAYER_MAX_PLAYERS,
        startedAt: meta.startedAt || null,
        finishedAt: meta.finishedAt || null,
        selfId,
        players: visiblePlayers.map(publicPlayer)
    };
}

async function readPlayers(store, code) {
    const listing = await store.list({ prefix: `${roomPrefix(code)}/players/` });
    return Promise.all((listing.blobs || []).map(blob => store.get(blob.key, { type: 'json' })));
}

async function authenticate(store, code, playerId, token) {
    if (!code || !playerId || !token) return null;
    const player = await store.get(playerKey(code, playerId), { type: 'json' });
    return player?.tokenHash === hashToken(token) ? player : null;
}

async function writeMatchRecords(store, meta, players) {
    const ranked = rankPlayers(players);
    const completedAt = new Date().toISOString();
    await Promise.all(ranked.map(async player => {
        const units = (player.board || []).filter(Boolean).map(unit => ({
            unitId: unit.unitId,
            name: unit.name,
            icon: unit.icon,
            tier: unit.tier,
            star: unit.star,
            items: unit.items
        }));
        const uniqueUnits = [...new Map(units.map(unit => [unit.unitId, unit])).values()];
        const record = {
            roomId: meta.id,
            roomCode: meta.code,
            balanceVersion: meta.balanceVersion || MULTIPLAYER_BALANCE_VERSION,
            statsSchemaVersion: MULTIPLAYER_STATS_SCHEMA_VERSION,
            playerId: player.id,
            nickname: player.nickname,
            placement: player.placement,
            participantCount: ranked.length,
            boardCost: Number(player.boardCost || 0),
            stage: player.stage,
            units: uniqueUnits,
            synergies: player.synergies || [],
            boardSignature: uniqueUnits.map(unit => `${unit.unitId}:${unit.star}`).sort().join('|'),
            completedAt
        };
        await store.setJSON(`matches/${meta.id}/${player.id}`, record);
        await store.setJSON(playerKey(meta.code, player.id), { ...player, placement: player.placement });
    }));
    const finishedMeta = { ...meta, status: 'finished', finishedAt: Date.now(), statsWritten: true };
    await store.setJSON(roomMetaKey(meta.code), finishedMeta);
    return { meta: finishedMeta, players: ranked };
}

async function finishIfNeeded(store, meta, players) {
    if (meta.status === 'finished') return { meta, players: rankPlayers(players) };
    const alive = players.filter(player => Number(player.hp) > 0);
    if (meta.status === 'playing' && players.length >= MULTIPLAYER_MIN_PLAYERS && alive.length <= 1) {
        return writeMatchRecords(store, meta, players);
    }
    return { meta, players };
}

async function listAllMatches(store) {
    const records = [];
    for await (const page of store.list({ prefix: 'matches/', paginate: true })) {
        const values = await Promise.all((page.blobs || []).map(blob => store.get(blob.key, { type: 'json' })));
        records.push(...values.filter(Boolean));
        // ponytail: 전체 결과가 1만 건을 넘으면 집계 Blob으로 전환한다.
        if (records.length >= 10000) break;
    }
    return records;
}

async function parseBody(request) {
    if (request.method === 'GET') return {};
    try { return await request.json(); } catch { return {}; }
}

export function createMultiplayerHandler({ getStoreImpl } = {}) {
    if (typeof getStoreImpl !== 'function') throw new TypeError('멀티플레이 저장소가 필요합니다.');
    return async function handler(request, context = {}) {
    const url = new URL(request.url);
    const action = context.params?.action || url.pathname.split('/').filter(Boolean).at(-1);
    const body = await parseBody(request);
    const store = getStoreImpl({ name: 'classroom-tactics-multiplayer', consistency: 'strong' });

    try {
        if (action === 'stats' && request.method === 'GET') {
            const allRecords = await listAllMatches(store);
            const requestedVersion = url.searchParams.get('version') || MULTIPLAYER_BALANCE_VERSION;
            const records = requestedVersion === 'all'
                ? allRecords
                : allRecords.filter(record => record.balanceVersion === requestedVersion);
            const stats = aggregateMatchStats(records);
            stats.balanceVersion = requestedVersion;
            stats.availableVersions = [...new Set(allRecords.map(record => record.balanceVersion).filter(Boolean))].sort().reverse();
            return json({ ok: true, stats });
        }

        if (action === 'create' && request.method === 'POST') {
            const nickname = sanitizeNickname(body.nickname);
            if (nickname.length < 2) return fail('닉네임은 2자 이상 입력해 주세요.');
            let code;
            for (let attempt = 0; attempt < 10; attempt++) {
                const candidate = createRoomCode();
                if (!await store.get(roomMetaKey(candidate), { type: 'json' })) { code = candidate; break; }
            }
            if (!code) return fail('방 코드를 만들지 못했습니다. 다시 시도해 주세요.', 503);
            const playerId = randomUUID();
            const token = randomUUID();
            const meta = {
                id: randomUUID(), code, hostId: playerId, status: 'waiting',
                seed: randomInt(0x100000000), balanceVersion: MULTIPLAYER_BALANCE_VERSION, createdAt: Date.now()
            };
            const player = {
                id: playerId, tokenHash: hashToken(token), nickname, isHost: true, ready: true,
                hp: 100, stage: [1, 1], joinedAt: Date.now(), board: [], boardCost: 0, synergies: []
            };
            await Promise.all([store.setJSON(roomMetaKey(code), meta), store.setJSON(playerKey(code, playerId), player)]);
            return json({ ok: true, token, room: publicRoom(meta, [player], playerId) }, 201);
        }

        if (action === 'join' && request.method === 'POST') {
            const code = getRoomCodeFromRequest(url, body);
            const nickname = sanitizeNickname(body.nickname);
            const meta = await store.get(roomMetaKey(code), { type: 'json' });
            if (!meta) return fail('방 코드를 찾을 수 없습니다.', 404);
            if (meta.status !== 'waiting') return fail('이미 게임이 시작된 방입니다.', 409);
            const players = await readPlayers(store, code);
            if (players.length >= MULTIPLAYER_MAX_PLAYERS) return fail('방이 가득 찼습니다.', 409);
            if (nickname.length < 2) return fail('닉네임은 2자 이상 입력해 주세요.');
            if (players.some(player => player.nickname === nickname)) return fail('같은 닉네임이 이미 사용 중입니다.', 409);
            const playerId = randomUUID();
            const token = randomUUID();
            const player = {
                id: playerId, tokenHash: hashToken(token), nickname, isHost: false, ready: false,
                hp: 100, stage: [1, 1], joinedAt: Date.now(), board: [], boardCost: 0, synergies: []
            };
            await store.setJSON(playerKey(code, playerId), player);
            return json({ ok: true, token, room: publicRoom(meta, [...players, player], playerId) }, 201);
        }

        const code = getRoomCodeFromRequest(url, body);
        const playerId = String(body.playerId || url.searchParams.get('playerId') || '');
        const token = String(body.token || url.searchParams.get('token') || '');
        const meta = await store.get(roomMetaKey(code), { type: 'json' });
        if (!meta) return fail('방을 찾을 수 없습니다.', 404);
        const player = await authenticate(store, code, playerId, token);
        if (!player) return fail('참가자 인증 정보가 올바르지 않습니다.', 401);

        if (action === 'room' && request.method === 'GET') {
            const finished = await finishIfNeeded(store, meta, await readPlayers(store, code));
            return json({ ok: true, room: publicRoom(finished.meta, finished.players, playerId) });
        }

        if (action === 'ready' && request.method === 'POST') {
            if (meta.status !== 'waiting') return fail('대기실에서만 준비 상태를 바꿀 수 있습니다.', 409);
            const updated = { ...player, ready: Boolean(body.ready) };
            await store.setJSON(playerKey(code, playerId), updated);
            const players = (await readPlayers(store, code)).map(entry => entry.id === playerId ? updated : entry);
            return json({ ok: true, room: publicRoom(meta, players, playerId) });
        }

        if (action === 'leave' && request.method === 'POST') {
            if (meta.status === 'playing') {
                const eliminated = {
                    ...player,
                    hp: 0,
                    eliminatedRound: player.eliminatedRound || getRoundOrdinal(player.stage),
                    eliminatedAt: player.eliminatedAt || Date.now(),
                    lastSeenAt: Date.now()
                };
                await store.setJSON(playerKey(code, playerId), eliminated);
                const players = (await readPlayers(store, code)).map(entry => entry.id === playerId ? eliminated : entry);
                const finished = await finishIfNeeded(store, meta, players);
                return json({ ok: true, room: publicRoom(finished.meta, finished.players, playerId) });
            }
            if (meta.status !== 'waiting') return json({ ok: true });
            await store.delete(playerKey(code, playerId));
            const remaining = (await readPlayers(store, code)).filter(entry => entry.id !== playerId);
            if (remaining.length === 0) {
                await store.delete(roomMetaKey(code));
                return json({ ok: true });
            }
            if (meta.hostId === playerId) {
                const nextHost = [...remaining].sort((a, b) => a.joinedAt - b.joinedAt)[0];
                nextHost.isHost = true;
                const updatedMeta = { ...meta, hostId: nextHost.id };
                await Promise.all([
                    store.setJSON(playerKey(code, nextHost.id), nextHost),
                    store.setJSON(roomMetaKey(code), updatedMeta)
                ]);
            }
            return json({ ok: true });
        }

        if (action === 'start' && request.method === 'POST') {
            if (meta.hostId !== playerId) return fail('방장만 게임을 시작할 수 있습니다.', 403);
            if (meta.status !== 'waiting') return fail('이미 시작된 방입니다.', 409);
            const players = await readPlayers(store, code);
            if (players.length < MULTIPLAYER_MIN_PLAYERS) return fail(`최소 ${MULTIPLAYER_MIN_PLAYERS}명이 필요합니다.`, 409);
            if (players.some(entry => !entry.ready)) return fail('아직 준비하지 않은 참가자가 있습니다.', 409);
            const started = { ...meta, status: 'playing', startedAt: Date.now() };
            await store.setJSON(roomMetaKey(code), started);
            return json({ ok: true, room: publicRoom(started, players, playerId) });
        }

        if (action === 'round' && request.method === 'POST') {
            if (meta.status !== 'playing') return fail('진행 중인 게임이 아닙니다.', 409);
            if (Number(player.hp) <= 0) return fail('탈락한 참가자는 전투를 시작할 수 없습니다.', 409);
            const stage = [Math.max(1, Number(body.stage?.[0]) || 1), Math.min(5, Math.max(1, Number(body.stage?.[1]) || 1))];
            const roundKey = getRoundKey(stage);
            const snapshot = sanitizeSnapshot(body);
            const updated = {
                ...player, ...snapshot, stage, roundKey, hp: Math.max(1, Math.min(100, Number(body.hp) || player.hp)),
                lastSeenAt: Date.now()
            };
            await store.setJSON(playerKey(code, playerId), updated);
            const players = (await readPlayers(store, code)).map(entry => entry.id === playerId ? updated : entry);
            const finished = await finishIfNeeded(store, meta, players);
            if (finished.meta.status === 'finished') {
                return json({ ok: true, finished: true, room: publicRoom(finished.meta, finished.players, playerId) });
            }
            const opponentId = assignOpponentId(players, playerId, roundKey);
            const opponent = players.find(entry => entry.id === opponentId);
            if (!opponent || opponent.roundKey !== roundKey || !Array.isArray(opponent.board)) {
                return json({ ok: true, waiting: true, room: publicRoom(meta, players, playerId) });
            }
            return json({
                ok: true,
                opponent: {
                    id: opponent.id, nickname: opponent.nickname, hp: opponent.hp,
                    board: opponent.board, gold: opponent.gold || 0,
                    globalBuffs: opponent.globalBuffs || {}, augments: opponent.augments || []
                },
                room: publicRoom(meta, players, playerId)
            });
        }

        if (action === 'result' && request.method === 'POST') {
            if (!['playing', 'finished'].includes(meta.status)) return fail('진행 중인 게임이 아닙니다.', 409);
            const stage = [Math.max(1, Number(body.stage?.[0]) || 1), Math.min(5, Math.max(1, Number(body.stage?.[1]) || 1))];
            const snapshot = sanitizeSnapshot(body);
            const hp = Math.max(0, Math.min(100, Number(body.hp) || 0));
            const updated = {
                ...player, ...snapshot, hp, stage, lastSeenAt: Date.now(),
                ...(hp <= 0 && !player.eliminatedRound
                    ? { eliminatedRound: getRoundOrdinal(stage), eliminatedAt: Date.now() }
                    : {})
            };
            await store.setJSON(playerKey(code, playerId), updated);
            const players = (await readPlayers(store, code)).map(entry => entry.id === playerId ? updated : entry);
            const finished = await finishIfNeeded(store, meta, players);
            const ranked = rankPlayers(finished.players);
            return json({
                ok: true,
                placement: ranked.find(entry => entry.id === playerId)?.placement || null,
                room: publicRoom(finished.meta, ranked, playerId)
            });
        }

        return fail('지원하지 않는 멀티플레이 요청입니다.', 404);
    } catch (error) {
        console.error('multiplayer function failed', error);
        return fail('멀티플레이 서버 처리 중 오류가 발생했습니다.', 500);
    }
    };
}
