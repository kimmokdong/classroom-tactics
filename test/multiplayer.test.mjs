import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    MULTIPLAYER_AUGMENT_SELECTION_SECONDS,
    MULTIPLAYER_BATTLE_DURATION_MS,
    MULTIPLAYER_BATTLE_START_DELAY_MS,
    MULTIPLAYER_EARLY_END_GRACE_MS,
    MULTIPLAYER_EMOTES,
    MULTIPLAYER_MAX_PLAYERS,
    MULTIPLAYER_MIN_PLAYERS,
    MULTIPLAYER_PLANNING_DURATION_MS,
    MULTIPLAYER_SPECIAL_PLANNING_DURATION_MS,
    MULTIPLAYER_RECONNECT_GRACE_MS,
    MULTIPLAYER_STORE_SELECTION_SECONDS,
    aggregateMatchStats,
    assignOpponentId,
    autoDeployBench,
    buildBoardSnapshot,
    calculateBoardCost,
    getMultiplayerPlanningDurationMs,
    getScoutCandidateIds,
    rankPlayers,
    sanitizeNickname,
    sanitizeRoomCode
} from '../js/multiplayer/core.js';
import { createMultiplayerHandler } from '../server/multiplayer-handler.mjs';
import { BattleEngine } from '../js/battleEngine.js';

class MemoryBlobStore {
    constructor() { this.values = new Map(); }
    async get(key) {
        const value = this.values.get(key);
        return value === undefined ? null : structuredClone(value);
    }
    async setJSON(key, value) { this.values.set(key, structuredClone(value)); }
    async delete(key) { this.values.delete(key); }
    list(options = {}) {
        const blobs = [...this.values.keys()]
            .filter(key => key.startsWith(options.prefix || ''))
            .map(key => ({ key, etag: key }));
        const result = { blobs, directories: [] };
        if (!options.paginate) return Promise.resolve(result);
        return { async *[Symbol.asyncIterator]() { yield result; } };
    }
}

async function callMultiplayer(handler, action, body = {}, method = 'POST') {
    const query = method === 'GET' ? `?${new URLSearchParams(body)}` : '';
    const request = new Request(`http://localhost/api/multiplayer/${action}${query}`, {
        method,
        headers: { 'content-type': 'application/json' },
        ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
    });
    const response = await handler(request, { params: { action } });
    return { status: response.status, data: await response.json() };
}

test('멀티플레이는 2명부터 시작하고 최대 6명까지 입장한다', async () => {
    assert.equal(MULTIPLAYER_MIN_PLAYERS, 2);
    assert.equal(MULTIPLAYER_MAX_PLAYERS, 6);

    const store = new MemoryBlobStore();
    const handler = createMultiplayerHandler({ getStoreImpl: () => store });
    const host = await callMultiplayer(handler, 'create', { nickname: 'host' });
    assert.equal(host.data.room.maxPlayers, 6);

    for (let index = 1; index <= 5; index += 1) {
        const joined = await callMultiplayer(handler, 'join', {
            code: host.data.room.code,
            nickname: `guest${index}`
        });
        assert.equal(joined.status, 201);
    }

    const overflow = await callMultiplayer(handler, 'join', {
        code: host.data.room.code,
        nickname: 'guest6'
    });
    assert.equal(overflow.status, 409);
});

test('멀티플레이 전투와 선택 제한시간을 고정한다', () => {
    assert.equal(MULTIPLAYER_BATTLE_DURATION_MS, 30_000);
    assert.equal(MULTIPLAYER_EARLY_END_GRACE_MS, 2_000);
    assert.equal(MULTIPLAYER_PLANNING_DURATION_MS, 20_000);
    assert.equal(MULTIPLAYER_SPECIAL_PLANNING_DURATION_MS, 30_000);
    assert.equal(getMultiplayerPlanningDurationMs([1, 1]), 20_000);
    assert.equal(getMultiplayerPlanningDurationMs([2, 1]), 30_000);
    assert.equal(getMultiplayerPlanningDurationMs([6, 3]), 30_000);
    assert.equal(MULTIPLAYER_AUGMENT_SELECTION_SECONDS, 30);
    assert.equal(MULTIPLAYER_STORE_SELECTION_SECONDS, 20);
    assert.equal(MULTIPLAYER_RECONNECT_GRACE_MS, 90_000);
    assert.deepEqual(MULTIPLAYER_EMOTES, ['hello', 'nice', 'wow', 'oops', 'cheer', 'gg']);
});

test('자동 배치는 대기석 왼쪽부터 플레이어 보드 좌하단을 채운다', () => {
    const existing = { id: 'existing' };
    const first = { id: 'first' };
    const second = { id: 'second' };
    const board = Array(24).fill(null);
    const bench = [first, null, second, { id: 'unused' }];
    board[4] = existing;

    const placements = autoDeployBench(board, bench, 3);

    assert.deepEqual(placements, [
        { benchIndex: 0, boardIndex: 16 },
        { benchIndex: 2, boardIndex: 17 }
    ]);
    assert.equal(board[16], first);
    assert.equal(board[17], second);
    assert.equal(bench[0], null);
    assert.equal(bench[2], null);
    assert.equal(bench[3].id, 'unused');
});

test('대기실은 자동 시작하지 않고 방장만 수동으로 시작한다', async () => {
    const store = new MemoryBlobStore();
    const handler = createMultiplayerHandler({ getStoreImpl: () => store });
    const created = await callMultiplayer(handler, 'create', { nickname: '방장' });
    const host = { code: created.data.room.code, playerId: created.data.room.selfId, token: created.data.token };
    const joined = await callMultiplayer(handler, 'join', { code: host.code, nickname: '친구' });
    assert.equal(joined.data.room.lobbyDeadline, undefined);

    const metaKey = `rooms/${host.code}/meta`;
    const waitingMeta = await store.get(metaKey);
    await store.setJSON(metaKey, { ...waitingMeta, createdAt: Date.now() - 120_000 });
    const stillWaiting = await callMultiplayer(handler, 'room', host, 'GET');
    assert.equal(stillWaiting.data.room.status, 'waiting');

    const startedByHost = await callMultiplayer(handler, 'start', host);
    assert.equal(startedByHost.data.room.status, 'playing');
    assert.equal(startedByHost.data.room.planningClock.roundKey, '1-1');
    assert.equal(startedByHost.data.room.planningClock.deadline - startedByHost.data.room.planningClock.startedAt, 20_000);
});

test('20초 배치 시간이 끝나면 미제출 참가자는 직전 보드로 자동 제출된다', async () => {
    const store = new MemoryBlobStore();
    const handler = createMultiplayerHandler({ getStoreImpl: () => store });
    const created = await callMultiplayer(handler, 'create', { nickname: '방장' });
    const host = { code: created.data.room.code, playerId: created.data.room.selfId, token: created.data.token };
    const joined = await callMultiplayer(handler, 'join', { code: host.code, nickname: '친구' });
    const guest = { code: host.code, playerId: joined.data.room.selfId, token: joined.data.token };
    await callMultiplayer(handler, 'start', host);

    const metaKey = `rooms/${host.code}/meta`;
    const meta = await store.get(metaKey);
    await store.setJSON(metaKey, {
        ...meta,
        planningClock: {
            ...meta.planningClock,
            deadline: Date.now() - MULTIPLAYER_BATTLE_START_DELAY_MS - 1
        }
    });
    const board = Array(24).fill(null);
    board[16] = { unitId: 'u1_1', star: 1, items: [] };
    const submitted = await callMultiplayer(handler, 'round', {
        ...host, stage: [1, 1], hp: 100, gold: 0, board, globalBuffs: {}, augments: []
    });

    assert.equal(submitted.data.ready, true);
    assert.equal(submitted.data.room.battleClock.roundKey, '1-1');
    assert.equal(submitted.data.room.planningClock, null);
    const storedGuest = await store.get(`rooms/${host.code}/players/${guest.playerId}`);
    assert.equal(storedGuest.roundKey, '1-1');
    assert.deepEqual(storedGuest.board, []);

    const battleMeta = await store.get(metaKey);
    await store.setJSON(metaKey, {
        ...battleMeta,
        battleClock: { ...battleMeta.battleClock, deadline: Date.now() - 1, allFinished: false }
    });
    const nextRound = await callMultiplayer(handler, 'room', host, 'GET');
    assert.equal(nextRound.data.room.battleClock.allFinished, true);
    assert.equal(nextRound.data.room.planningClock.roundKey, '1-2');
});

test('멀티플레이 입력과 보드 스냅샷을 제한한다', () => {
    assert.equal(sanitizeRoomCode('ab-c 12!'), 'ABC2');
    assert.equal(sanitizeNickname('  김   목동<script>  '), '김 목동script');
    const snapshot = buildBoardSnapshot([{ id: 'u1', star: 3, items: ['a', 'b', 'c', 'd'], permGrowth: { ad: 4, nope: 9 } }]);
    assert.equal(snapshot.length, 24);
    assert.deepEqual(snapshot[0], { unitId: 'u1', star: 3, items: ['a', 'b', 'c'], permGrowth: { ad: 4 } });
});

test('별 등급의 실제 기물 수를 반영해 보드 비용을 계산한다', () => {
    const board = [
        { unitId: 'one', star: 1 },
        { unitId: 'four', star: 2 },
        { unitId: 'five', star: 3 }
    ];
    assert.equal(calculateBoardCost(board, { one: 1, four: 4, five: 5 }), 58);
});

test('생존 참가자끼리 자기 자신을 제외한 상대를 배정한다', () => {
    const players = ['a', 'b', 'c', 'd'].map(id => ({ id, hp: 100 }));
    for (const player of players) {
        const opponent = assignOpponentId(players, player.id, '3-2');
        assert.ok(players.some(candidate => candidate.id === opponent));
        assert.notEqual(opponent, player.id);
    }
    assert.equal(assignOpponentId([{ id: 'a', hp: 100 }, { id: 'b', hp: 0 }], 'a', '3-2'), null);
});

test('정찰 후보는 실제 상대를 포함해 최대 두 명만 고른다', () => {
    const players = ['a', 'b', 'c', 'd'].map(id => ({ id, hp: 100 }));
    const actualOpponent = assignOpponentId(players, 'a', '3-2');
    const candidates = getScoutCandidateIds(players, 'a', '3-2');
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0], actualOpponent);
    assert.ok(candidates.every(id => id !== 'a'));

    const eliminatedViewer = players.map(player => player.id === 'a' ? { ...player, hp: 0 } : player);
    assert.equal(getScoutCandidateIds(eliminatedViewer, 'a', '3-2').length, 2);
});

test('탈락 라운드와 시각으로 최종 순위를 정한다', () => {
    const ranked = rankPlayers([
        { id: 'late', hp: 0, eliminatedRound: 8, eliminatedAt: 30 },
        { id: 'winner', hp: 20 },
        { id: 'early', hp: 0, eliminatedRound: 6, eliminatedAt: 20 }
    ]);
    assert.deepEqual(ranked.map(player => [player.id, player.placement]), [
        ['winner', 1], ['late', 2], ['early', 3]
    ]);
});

test('탑3·우승·평균 보드 비용을 전체와 유닛별로 집계한다', () => {
    const records = [1, 2, 3, 4].map(placement => ({
        roomId: 'room-1',
        participantCount: 4,
        placement,
        boardCost: placement * 10,
        completedAt: `2026-08-0${placement}T00:00:00.000Z`,
        boardSignature: placement <= 2 ? 'a:1|b:1' : `c:${placement}`,
        units: placement === 4
            ? [{ unitId: 'a', name: 'A', icon: '🅰️', tier: 1, star: 1 }]
            : [{ unitId: placement === 1 ? 'a' : 'b', name: placement === 1 ? 'A' : 'B', icon: '🎓', tier: 2, star: 1 }],
        synergies: [{ type: 'subjects', name: '수학', level: 2 }]
    }));
    const stats = aggregateMatchStats(records);
    assert.equal(stats.summary.matches, 1);
    assert.equal(stats.summary.playerResults, 4);
    assert.equal(stats.summary.top3Rate, 75);
    assert.equal(stats.summary.winRate, 25);
    assert.equal(stats.summary.avgBoardCost, 25);
    const unitA = stats.units.find(unit => unit.unitId === 'a');
    assert.deepEqual({ games: unitA.games, top3: unitA.top3Rate, win: unitA.winRate }, { games: 2, top3: 50, win: 50 });
    assert.equal(stats.synergies[0].games, 4);
});

test('시작 화면에 방 참가와 누적 통계 UI가 연결되어 있다', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const main = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
    const stage = await readFile(new URL('../js/systems/StageManager.js', import.meta.url), 'utf8');
    const renderer = await readFile(new URL('../js/battleRenderer.js', import.meta.url), 'utf8');
    const augmentManager = await readFile(new URL('../js/systems/AugmentManager.js', import.meta.url), 'utf8');
    assert.match(html, /2~6명이 코드로 모여 대전합니다/);
    assert.match(html, /id="multiplayer-panel"/);
    assert.match(html, /data-stats-view="units"/);
    assert.match(html, /id="multi-stats-summary"/);
    assert.match(main, /new MultiplayerManager\(this\)/);
    assert.match(stage, /shouldPrepareBattle\(\)/);
    assert.match(stage, /reportBattle\(winner, endLog\)/);
    assert.match(renderer, /this\.isMultiplayer \? 'none' : 'flex'/);
    assert.match(augmentManager, /startSelectionTimer\(MULTIPLAYER_AUGMENT_SELECTION_SECONDS/);
    assert.match(augmentManager, /startSelectionTimer\(MULTIPLAYER_STORE_SELECTION_SECONDS/);
});

test('방 생성부터 상대 보드 동기화·최종 순위·누적 통계까지 이어진다', async () => {
    const store = new MemoryBlobStore();
    const handler = createMultiplayerHandler({ getStoreImpl: () => store });
    const hostCreate = await callMultiplayer(handler, 'create', { nickname: '방장' });
    assert.equal(hostCreate.status, 201);
    const code = hostCreate.data.room.code;
    const host = { code, playerId: hostCreate.data.room.selfId, token: hostCreate.data.token };

    const guestJoin = await callMultiplayer(handler, 'join', { code, nickname: '친구' });
    const guest = { code, playerId: guestJoin.data.room.selfId, token: guestJoin.data.token };
    await callMultiplayer(handler, 'ready', { ...guest, ready: true });
    const started = await callMultiplayer(handler, 'start', host);
    assert.equal(started.data.room.status, 'playing');

    const hostBoard = Array(24).fill(null);
    hostBoard[0] = { unitId: 'u1_1', star: 2, items: [] };
    const guestBoard = Array(24).fill(null);
    guestBoard[0] = { unitId: 'u2_1', star: 1, items: [] };
    const common = { stage: [2, 1], hp: 100, globalBuffs: {}, augments: [] };
    const hostWaiting = await callMultiplayer(handler, 'round', { ...host, ...common, board: hostBoard });
    assert.equal(hostWaiting.data.waiting, true);
    const guestRound = await callMultiplayer(handler, 'round', { ...guest, ...common, board: guestBoard });
    assert.equal(guestRound.data.opponent.nickname, '방장');
    assert.equal(guestRound.data.room.battleClock.deadline - guestRound.data.room.battleClock.startedAt, 30_000);
    const hostRound = await callMultiplayer(handler, 'round', { ...host, ...common, board: hostBoard });
    assert.equal(hostRound.data.opponent.nickname, '친구');
    assert.deepEqual(hostRound.data.room.battleClock, guestRound.data.room.battleClock);

    const hostResult = await callMultiplayer(handler, 'result', { ...host, ...common, hp: 100, board: hostBoard });
    assert.equal(hostResult.data.room.battleClock.allFinished, false);
    const eliminated = await callMultiplayer(handler, 'result', { ...guest, ...common, hp: 0, board: guestBoard });
    assert.equal(eliminated.data.room.status, 'finished');
    assert.equal(eliminated.data.placement, 2);
    assert.equal(eliminated.data.room.battleClock.allFinished, true);
    assert.ok(eliminated.data.room.battleClock.deadline <= Date.now() + 2_100);
    const stats = await callMultiplayer(handler, 'stats', {}, 'GET');
    assert.equal(stats.data.stats.summary.matches, 1);
    assert.equal(stats.data.stats.summary.playerResults, 2);
    assert.equal(stats.data.stats.summary.top3Rate, 100);
    assert.equal(stats.data.stats.summary.winRate, 50);
    assert.ok(stats.data.stats.units.some(unit => unit.unitId === 'u1_1' && unit.avgBoardCost === 3));
});

test('인증된 정찰은 실제 상대를 포함한 두 보드만 공개한다', async () => {
    const store = new MemoryBlobStore();
    const handler = createMultiplayerHandler({ getStoreImpl: () => store });
    const created = await callMultiplayer(handler, 'create', { nickname: 'host' });
    const code = created.data.room.code;
    const credentials = [{ code, playerId: created.data.room.selfId, token: created.data.token }];
    for (const nickname of ['guest1', 'guest2', 'guest3']) {
        const joined = await callMultiplayer(handler, 'join', { code, nickname });
        const entry = { code, playerId: joined.data.room.selfId, token: joined.data.token };
        credentials.push(entry);
        await callMultiplayer(handler, 'ready', { ...entry, ready: true });
    }
    await callMultiplayer(handler, 'start', credentials[0]);

    const board = Array(24).fill(null);
    board[0] = { unitId: 'u1_1', star: 1, items: [] };
    for (const entry of credentials) {
        await callMultiplayer(handler, 'round', {
            ...entry, stage: [2, 1], hp: 100, gold: 99,
            board, globalBuffs: { hidden: 777 }, augments: []
        });
    }

    const viewer = credentials[0];
    const scouted = await callMultiplayer(handler, 'scout', { ...viewer, roundKey: '2-1' }, 'GET');
    const actualId = assignOpponentId(scouted.data.room.players, viewer.playerId, '2-1');
    assert.equal(scouted.status, 200);
    assert.equal(scouted.data.candidates.length, 2);
    assert.equal(scouted.data.candidates[0].id, actualId);
    assert.equal(scouted.data.candidates[0].actualOpponent, true);
    assert.equal(scouted.data.candidates[0].board.length, 24);
    assert.equal(scouted.data.candidates[0].boardCost, 1);
    assert.equal(Object.hasOwn(scouted.data.candidates[0], 'gold'), false);
    assert.equal(Object.hasOwn(scouted.data.candidates[0], 'globalBuffs'), false);
    assert.equal(Object.hasOwn(scouted.data.candidates[0], 'tokenHash'), false);

    const viewerKey = [...store.values.keys()].find(key => key.endsWith(`/players/${viewer.playerId}`));
    const eliminatedViewer = await store.get(viewerKey);
    eliminatedViewer.hp = 0;
    await store.setJSON(viewerKey, eliminatedViewer);
    const spectated = await callMultiplayer(handler, 'scout', { ...viewer, roundKey: '2-1' }, 'GET');
    assert.equal(spectated.data.candidates.length, 3);
    assert.ok(spectated.data.candidates.every(candidate => candidate.hp > 0));
    assert.ok(spectated.data.candidates.every(candidate => candidate.actualOpponent === false));
});

test('방장은 참가자 인증을 유지한 채 끝난 방을 재대결로 초기화한다', async () => {
    const store = new MemoryBlobStore();
    const handler = createMultiplayerHandler({ getStoreImpl: () => store });
    const created = await callMultiplayer(handler, 'create', { nickname: 'host' });
    const code = created.data.room.code;
    const host = { code, playerId: created.data.room.selfId, token: created.data.token };
    const joined = await callMultiplayer(handler, 'join', { code, nickname: 'guest' });
    const guest = { code, playerId: joined.data.room.selfId, token: joined.data.token };
    await callMultiplayer(handler, 'ready', { ...guest, ready: true });
    await callMultiplayer(handler, 'start', host);
    const board = Array(24).fill(null);
    board[0] = { unitId: 'u1_1', star: 2, items: [] };
    await callMultiplayer(handler, 'round', { ...host, stage: [2, 1], hp: 55, board, augments: [] });
    const finished = await callMultiplayer(handler, 'leave', guest);
    const oldMatchId = finished.data.room.id;
    const oldSeed = finished.data.room.seed;

    assert.equal((await callMultiplayer(handler, 'rematch', guest)).status, 403);
    const rematch = await callMultiplayer(handler, 'rematch', host);
    assert.equal(rematch.data.room.code, code);
    assert.notEqual(rematch.data.room.id, oldMatchId);
    assert.notEqual(rematch.data.room.seed, oldSeed);
    assert.equal(rematch.data.room.status, 'waiting');
    assert.equal(rematch.data.room.selfId, host.playerId);
    assert.deepEqual(rematch.data.room.players.map(player => [player.hp, player.placement, player.ready]), [
        [100, null, true], [100, null, false]
    ]);
    assert.equal((await callMultiplayer(handler, 'room', host, 'GET')).status, 200);
    assert.equal((await callMultiplayer(handler, 'stats', {}, 'GET')).data.stats.summary.matches, 1);
});

test('연결 종료는 즉시 탈락시키지 않고 90초 안의 재접속을 허용한다', async () => {
    const store = new MemoryBlobStore();
    const handler = createMultiplayerHandler({ getStoreImpl: () => store });
    const created = await callMultiplayer(handler, 'create', { nickname: 'host' });
    const code = created.data.room.code;
    const host = { code, playerId: created.data.room.selfId, token: created.data.token };
    const joined = await callMultiplayer(handler, 'join', { code, nickname: 'guest' });
    const guest = { code, playerId: joined.data.room.selfId, token: joined.data.token };
    await callMultiplayer(handler, 'ready', { ...guest, ready: true });
    await callMultiplayer(handler, 'start', host);

    const disconnected = await callMultiplayer(handler, 'disconnect', guest);
    const offlineGuest = disconnected.data.room.players.find(player => player.id === guest.playerId);
    assert.equal(disconnected.data.room.status, 'playing');
    assert.equal(offlineGuest.hp, 100);
    assert.equal(offlineGuest.connected, false);
    assert.ok(offlineGuest.reconnectUntil > Date.now());

    const reconnected = await callMultiplayer(handler, 'room', guest, 'GET');
    assert.equal(reconnected.data.room.players.find(player => player.id === guest.playerId).connected, true);

    const key = `rooms/${code}/players/${guest.playerId}`;
    const stale = await store.get(key);
    await store.setJSON(key, {
        ...stale,
        disconnectedAt: Date.now() - MULTIPLAYER_RECONNECT_GRACE_MS - 1,
        lastSeenAt: Date.now() - MULTIPLAYER_RECONNECT_GRACE_MS - 1
    });
    const expired = await callMultiplayer(handler, 'room', guest, 'GET');
    assert.equal(expired.data.room.status, 'finished');
    assert.equal(expired.data.room.players.find(player => player.id === guest.playerId).hp, 0);
});

test('멀티플레이 PVE도 전원이 준비되면 같은 30초 시계로 시작한다', async () => {
    const store = new MemoryBlobStore();
    const handler = createMultiplayerHandler({ getStoreImpl: () => store });
    const hostCreate = await callMultiplayer(handler, 'create', { nickname: '방장' });
    const code = hostCreate.data.room.code;
    const host = { code, playerId: hostCreate.data.room.selfId, token: hostCreate.data.token };
    const guestJoin = await callMultiplayer(handler, 'join', { code, nickname: '친구' });
    const guest = { code, playerId: guestJoin.data.room.selfId, token: guestJoin.data.token };
    await callMultiplayer(handler, 'ready', { ...guest, ready: true });
    await callMultiplayer(handler, 'start', host);

    const common = { stage: [1, 1], hp: 100, board: [], globalBuffs: {}, augments: [] };
    const hostWaiting = await callMultiplayer(handler, 'round', { ...host, ...common });
    assert.equal(hostWaiting.data.waiting, true);
    const guestReady = await callMultiplayer(handler, 'round', { ...guest, ...common });
    const hostReady = await callMultiplayer(handler, 'round', { ...host, ...common });
    assert.equal(guestReady.data.ready, true);
    assert.equal(hostReady.data.ready, true);
    assert.equal(guestReady.data.opponent, undefined);
    assert.deepEqual(hostReady.data.room.battleClock, guestReady.data.room.battleClock);
});

test('진행 중 나간 참가자는 탈락 처리되어 방이 멈추지 않는다', async () => {
    const store = new MemoryBlobStore();
    const handler = createMultiplayerHandler({ getStoreImpl: () => store });
    const hostCreate = await callMultiplayer(handler, 'create', { nickname: '방장' });
    const code = hostCreate.data.room.code;
    const host = { code, playerId: hostCreate.data.room.selfId, token: hostCreate.data.token };
    const guestJoin = await callMultiplayer(handler, 'join', { code, nickname: '중도퇴실' });
    const guest = { code, playerId: guestJoin.data.room.selfId, token: guestJoin.data.token };
    await callMultiplayer(handler, 'ready', { ...guest, ready: true });
    await callMultiplayer(handler, 'start', host);
    const left = await callMultiplayer(handler, 'leave', guest);
    assert.equal(left.data.room.status, 'finished');
    assert.equal(left.data.room.players.find(player => player.id === guest.playerId).placement, 2);
});

test('상대 플레이어의 전용 증강체도 적 진영 규칙으로 활성화된다', () => {
    const makeUnit = (name, subject = '도덕') => ({
        id: name,
        name,
        subject,
        club: '보건부',
        manaType: '전투',
        star: 1,
        items: [],
        stats: { hp: 100, maxHp: 100, mana: 0, maxMana: 0, ad: 10, ap: 100, armor: 10, mr: 10, as: 0.6, range: 1 },
        combat: { shield: 0, vamp: 0, dmgAmp: 0, critChance: 0.1, critDmg: 1.5, dmgReduc: 0 }
    });
    const playerBoard = Array(24).fill(null);
    const enemyBoard = Array(24).fill(null);
    playerBoard[0] = makeUnit('player', '국어');
    for (let index = 0; index < 6; index++) enemyBoard[index] = makeUnit(`enemy-${index}`);
    const engine = new BattleEngine(playerBoard, enemyBoard, [], 50, 'multi-augment', 50, ['p15']);
    engine.maxTicks = 1;
    engine.run();
    assert.equal(engine.teamTraitAugments.player.p15, false);
    assert.equal(engine.teamTraitAugments.enemy.p15, true);
});
