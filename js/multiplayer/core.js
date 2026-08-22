export const MULTIPLAYER_MIN_PLAYERS = 2;
export const MULTIPLAYER_MAX_PLAYERS = 6;
export const MULTIPLAYER_BALANCE_VERSION = '0.1-0807';
export const MULTIPLAYER_STATS_SCHEMA_VERSION = 1;
export const MULTIPLAYER_BATTLE_DURATION_MS = 30_000;
export const MULTIPLAYER_BATTLE_START_DELAY_MS = 1_500;
export const MULTIPLAYER_EARLY_END_GRACE_MS = 2_000;
export const MULTIPLAYER_PLANNING_DURATION_MS = 20_000;
export const MULTIPLAYER_SPECIAL_PLANNING_DURATION_MS = 30_000;
export const MULTIPLAYER_AUGMENT_SELECTION_SECONDS = 30;
export const MULTIPLAYER_STORE_SELECTION_SECONDS = 20;
export const MULTIPLAYER_RECONNECT_GRACE_MS = 90_000;
export const MULTIPLAYER_EMOTE_COOLDOWN_MS = 1_500;
export const MULTIPLAYER_EMOTES = Object.freeze(['hello', 'nice', 'wow', 'oops', 'cheer', 'gg']);

const STAR_COPIES = Object.freeze({ 1: 1, 2: 3, 3: 9 });

export function sanitizeNickname(value) {
    return String(value ?? '')
        .normalize('NFKC')
        .replace(/[<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 12);
}

export function sanitizeRoomCode(value) {
    return String(value ?? '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

export function normalizeStage(stage) {
    const world = Math.max(1, Math.floor(Number(stage?.[0]) || 1));
    const round = Math.min(5, Math.max(1, Math.floor(Number(stage?.[1]) || 1)));
    return [world, round];
}

export function getRoundKey(stage) {
    return normalizeStage(stage).join('-');
}

export function getRoundOrdinal(stage) {
    const [world, round] = normalizeStage(stage);
    return (world - 1) * 5 + round;
}

export function getStarCopies(star) {
    return STAR_COPIES[Math.min(3, Math.max(1, Math.floor(Number(star) || 1)))] || 1;
}

export function buildBoardSnapshot(board) {
    return Array.from({ length: 24 }, (_, index) => {
        const unit = Array.isArray(board) ? board[index] : null;
        if (!unit) return null;
        const growth = unit.permGrowth && typeof unit.permGrowth === 'object'
            ? Object.fromEntries(['ad', 'as', 'ap', 'hp']
                .map(key => [key, Number(unit.permGrowth[key])])
                .filter(([, value]) => Number.isFinite(value)))
            : undefined;
        return {
            unitId: String(unit.unitId || unit.id || ''),
            star: Math.min(3, Math.max(1, Math.floor(Number(unit.star) || 1))),
            items: Array.isArray(unit.items) ? unit.items.filter(id => typeof id === 'string').slice(0, 3) : [],
            ...(Array.isArray(unit.thievesItems) ? { thievesItems: unit.thievesItems.filter(id => typeof id === 'string').slice(0, 2) } : {}),
            ...(growth && Object.keys(growth).length > 0 ? { permGrowth: growth } : {})
        };
    });
}

export function autoDeployBench(board, bench, capacity) {
    const limit = Math.min(24, Math.max(0, Math.floor(Number(capacity) || 0)));
    let deployed = board.filter(Boolean).length;
    const placements = [];
    const boardOrder = [16, 17, 18, 19, 20, 21, 22, 23, 8, 9, 10, 11, 12, 13, 14, 15, 0, 1, 2, 3, 4, 5, 6, 7];
    for (let benchIndex = 0; benchIndex < bench.length && deployed < limit; benchIndex += 1) {
        if (!bench[benchIndex]) continue;
        const boardIndex = boardOrder.find(index => !board[index]);
        if (boardIndex === undefined) break;
        board[boardIndex] = bench[benchIndex];
        bench[benchIndex] = null;
        placements.push({ benchIndex, boardIndex });
        deployed += 1;
    }
    return placements;
}

export function getMultiplayerPlanningDurationMs(stage) {
    const [world, round] = Array.isArray(stage) ? stage.map(Number) : [0, 0];
    const hasAugmentSelection = round === 1 && [2, 3, 4].includes(world);
    const hasStoreSelection = world >= 2 && round === 3;
    return hasAugmentSelection || hasStoreSelection
        ? MULTIPLAYER_SPECIAL_PLANNING_DURATION_MS
        : MULTIPLAYER_PLANNING_DURATION_MS;
}

export function calculateBoardCost(board, unitCosts = {}) {
    return (Array.isArray(board) ? board : []).reduce((sum, unit) => {
        if (!unit) return sum;
        const id = unit.unitId || unit.id;
        const tier = Number(unitCosts[id] ?? unit.tier);
        return sum + (Number.isFinite(tier) ? tier * getStarCopies(unit.star) : 0);
    }, 0);
}

function stringHash(value) {
    let hash = 2166136261;
    for (const char of String(value)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function assignOpponentId(players, selfId, roundKey) {
    const alive = (Array.isArray(players) ? players : [])
        .filter(player => Number(player?.hp) > 0)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (alive.length < 2) return null;
    const selfIndex = alive.findIndex(player => player.id === selfId);
    if (selfIndex < 0) return null;
    const offset = 1 + (stringHash(roundKey) % (alive.length - 1));
    return alive[(selfIndex + offset) % alive.length].id;
}

export function getScoutCandidateIds(players, selfId, roundKey, limit = 2) {
    const alive = (Array.isArray(players) ? players : [])
        .filter(player => Number(player?.hp) > 0 && player.id !== selfId)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (!alive.length) return [];

    const actualOpponentId = assignOpponentId(players, selfId, roundKey);
    const start = stringHash(`${selfId}:${roundKey}`) % alive.length;
    const rotated = [...alive.slice(start), ...alive.slice(0, start)].map(player => player.id);
    return [...new Set([actualOpponentId, ...rotated].filter(Boolean))]
        .slice(0, Math.max(0, Math.min(2, Math.floor(Number(limit) || 0))));
}

export function rankPlayers(players) {
    return [...(Array.isArray(players) ? players : [])]
        .sort((a, b) => {
            const aAlive = Number(a.hp) > 0;
            const bAlive = Number(b.hp) > 0;
            if (aAlive !== bAlive) return aAlive ? -1 : 1;
            const roundDiff = Number(b.eliminatedRound || 0) - Number(a.eliminatedRound || 0);
            if (roundDiff) return roundDiff;
            const timeDiff = Number(b.eliminatedAt || 0) - Number(a.eliminatedAt || 0);
            if (timeDiff) return timeDiff;
            const hpDiff = Number(b.hp || 0) - Number(a.hp || 0);
            if (hpDiff) return hpDiff;
            return String(a.id).localeCompare(String(b.id));
        })
        .map((player, index) => ({ ...player, placement: index + 1 }));
}

const round = (value, digits = 1) => {
    const scale = 10 ** digits;
    return Math.round((Number(value) || 0) * scale) / scale;
};

function summarize(records) {
    const games = records.length;
    if (!games) return { games: 0, top3Rate: 0, winRate: 0, avgPlacement: 0, avgBoardCost: 0 };
    return {
        games,
        top3Rate: round(records.filter(record => Number(record.placement) <= Math.min(3, Number(record.participantCount) || 8)).length / games * 100),
        winRate: round(records.filter(record => Number(record.placement) === 1).length / games * 100),
        avgPlacement: round(records.reduce((sum, record) => sum + Number(record.placement || 0), 0) / games, 2),
        avgBoardCost: round(records.reduce((sum, record) => sum + Number(record.boardCost || 0), 0) / games, 1)
    };
}

function aggregateGroups(records, entriesForRecord, keyForEntry, decorate = entry => entry) {
    const groups = new Map();
    records.forEach(record => {
        const seen = new Set();
        (entriesForRecord(record) || []).forEach(entry => {
            const key = keyForEntry(entry);
            if (!key || seen.has(key)) return;
            seen.add(key);
            const group = groups.get(key) || { entry: decorate(entry), records: [] };
            group.records.push(record);
            groups.set(key, group);
        });
    });
    return [...groups.entries()]
        .map(([key, group]) => ({ key, ...group.entry, ...summarize(group.records) }))
        .sort((a, b) => b.games - a.games || b.top3Rate - a.top3Rate || String(a.key).localeCompare(String(b.key)));
}

export function aggregateMatchStats(matchRecords) {
    const records = (Array.isArray(matchRecords) ? matchRecords : []).filter(record => Number(record?.placement) > 0);
    const roomIds = new Set(records.map(record => record.roomId).filter(Boolean));
    const units = aggregateGroups(
        records,
        record => record.units,
        unit => unit.unitId,
        unit => ({ unitId: unit.unitId, name: unit.name, icon: unit.icon, tier: unit.tier })
    );
    const synergies = aggregateGroups(
        records,
        record => record.synergies,
        synergy => `${synergy.type}:${synergy.name}:${synergy.level}`,
        synergy => ({ type: synergy.type, name: synergy.name, level: synergy.level })
    );
    const boards = aggregateGroups(
        records,
        record => [{ signature: record.boardSignature, units: record.units }],
        board => board.signature,
        board => ({ signature: board.signature, units: board.units })
    ).filter(board => board.signature);

    return {
        generatedAt: new Date().toISOString(),
        summary: { matches: roomIds.size, playerResults: records.length, ...summarize(records) },
        units,
        synergies,
        boards,
        recent: [...records]
            .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))
            .slice(0, 30)
            .map(record => ({
                nickname: record.nickname,
                placement: record.placement,
                participantCount: record.participantCount,
                boardCost: record.boardCost,
                stage: record.stage,
                units: record.units,
                synergies: record.synergies,
                completedAt: record.completedAt
            }))
    };
}
