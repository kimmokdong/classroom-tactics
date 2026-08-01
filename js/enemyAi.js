import { EXP_TABLE, UNIT_POOL } from './data.js';
import { ITEMS } from './items.js';
import { SHOP_PROBABILITIES } from './core/constants.js';
import { createSeededRandom } from './battleEngine.js';
import { evaluateBoard } from './ai/BoardEvaluator.js';
import { createUnitInstance, equipUnitItems } from './battle/combatPreparation.js';

export const OPPONENT_AI_CONFIG = Object.freeze({
    lobbySize: 7,
    beamWidth: 8,
    searchDepth: 2,
    benchSize: 10,
    totalRounds: 31,
    difficultyMultiplier: 1,
    strengthMultipliers: Object.freeze({ weak: 0.92, normal: 1, strong: 1.1 })
});

const values = value => Array.isArray(value) ? value : [value];
const hasTrait = (unit, traits) => [...values(unit.subject), ...values(unit.club)].some(trait => traits.includes(trait));
const ownsRole = (unit, role) => values(unit.role).includes(role);

function buildCompositionPath({ id, name, traits, alternatives, pivotTargets }) {
    const preferred = UNIT_POOL.filter(unit => hasTrait(unit, traits));
    const idsThroughTier = tier => preferred.filter(unit => unit.tier <= tier).map(unit => unit.id);
    return Object.freeze({
        id,
        name,
        traits,
        opener: idsThroughTier(1),
        early: idsThroughTier(2),
        mid: idsThroughTier(3),
        transition: idsThroughTier(4),
        final: idsThroughTier(5),
        coreUnits: preferred.filter(unit => unit.tier >= 3).map(unit => unit.id),
        optionalUnits: UNIT_POOL.filter(unit => hasTrait(unit, alternatives)).map(unit => unit.id),
        carryCandidates: preferred.filter(unit => ownsRole(unit, 'dealer')).map(unit => unit.id),
        tankCandidates: preferred.filter(unit => ownsRole(unit, 'tank')).map(unit => unit.id),
        itemHolders: preferred.filter(unit => ownsRole(unit, 'dealer') || ownsRole(unit, 'tank')).map(unit => unit.id),
        alternatives,
        pivotTargets
    });
}

// 완성 덱이 아니라, 상점에서 찾을 기물의 단계별 범위를 정의한다.
export const COMPOSITION_PATHS = Object.freeze([
    buildCompositionPath({ id: 'discipline', name: '도덕 선도부', traits: ['도덕', '선도부'], alternatives: ['보건부'], pivotTargets: ['welfare', 'athletics'] }),
    buildCompositionPath({ id: 'athletics', name: '체육 육상부', traits: ['체육', '육상부'], alternatives: ['선도부'], pivotTargets: ['discipline', 'science'] }),
    buildCompositionPath({ id: 'broadcast', name: '국어 방송부', traits: ['국어', '방송부'], alternatives: ['음악', '급식부'], pivotTargets: ['welfare', 'economy'] }),
    buildCompositionPath({ id: 'science', name: '과학 장난꾸러기', traits: ['과학', '장난꾸러기'], alternatives: ['수학'], pivotTargets: ['economy', 'athletics'] }),
    buildCompositionPath({ id: 'welfare', name: '보건부 지원단', traits: ['보건부', '도덕'], alternatives: ['급식부'], pivotTargets: ['discipline', 'broadcast'] }),
    buildCompositionPath({ id: 'economy', name: '수학 경제부', traits: ['수학', '경제부'], alternatives: ['사회', '방송부'], pivotTargets: ['science', 'broadcast'] })
]);

export const VIRTUAL_OPPONENT_PROFILES = Object.freeze([
    { id: 'reroll_rookie', name: '느긋한 리롤러', preferredComps: ['athletics', 'science'], strategy: 'reroll', economySkill: 0.45, pivotSkill: 0.35, positioningSkill: 0.48, riskTolerance: 0.7, strengthTier: 'weak' },
    { id: 'club_loyalist', name: '동아리 고집쟁이', preferredComps: ['broadcast'], strategy: 'standard', economySkill: 0.5, pivotSkill: 0.2, positioningSkill: 0.52, riskTolerance: 0.35, strengthTier: 'weak' },
    { id: 'tempo_captain', name: '연승 반장', preferredComps: ['discipline', 'athletics'], strategy: 'tempo', economySkill: 0.66, pivotSkill: 0.55, positioningSkill: 0.68, riskTolerance: 0.72, strengthTier: 'normal' },
    { id: 'steady_student', name: '모범생 운영자', preferredComps: ['welfare', 'broadcast'], strategy: 'standard', economySkill: 0.72, pivotSkill: 0.62, positioningSkill: 0.72, riskTolerance: 0.45, strengthTier: 'normal' },
    { id: 'flexible_scout', name: '유연한 정찰자', preferredComps: ['science', 'economy'], strategy: 'standard', economySkill: 0.7, pivotSkill: 0.88, positioningSkill: 0.7, riskTolerance: 0.55, strengthTier: 'normal' },
    { id: 'fast_level_ace', name: '빠른 진급 에이스', preferredComps: ['economy', 'science'], strategy: 'fastLevel', economySkill: 0.9, pivotSkill: 0.78, positioningSkill: 0.88, riskTolerance: 0.62, strengthTier: 'strong' },
    { id: 'veteran_planner', name: '베테랑 설계자', preferredComps: ['discipline', 'welfare'], strategy: 'standard', economySkill: 0.94, pivotSkill: 0.9, positioningSkill: 0.92, riskTolerance: 0.5, strengthTier: 'strong' }
]);

const pathById = id => COMPOSITION_PATHS.find(path => path.id === id) || COMPOSITION_PATHS[0];
const stageName = progress => progress < 0.2 ? 'opener' : progress < 0.4 ? 'early' : progress < 0.6 ? 'mid' : progress < 0.8 ? 'transition' : 'final';

function nextRandom(opponent) {
    const random = createSeededRandom(`${opponent.shopSeed}:${opponent.shopCursor++}`);
    return random();
}

export function applyAiDifficultyModifier(unit) {
    const modified = structuredClone(unit);
    if (modified.star === 3 && modified.tier <= 3) {
        modified.stats.armor += Math.round(25 - modified.tier * 5);
        modified.stats.mr += Math.round(25 - modified.tier * 5);
        modified.stats.hp += Math.round(250 - modified.tier * 50);
    }
    modified.stats.maxHp = modified.stats.hp;
    return modified;
}

function cloneUnit(template, star, instanceId) {
    return applyAiDifficultyModifier(createUnitInstance(template, {
        star,
        instanceId,
        teamRole: 'opponent'
    }));
}

function createOwnedUnit(opponent, template, star = 1) {
    return cloneUnit(template, star, `${opponent.id}:${template.id}:${opponent.purchaseCounter++}`);
}

function ownedUnits(opponent) {
    return [...opponent.board.filter(Boolean), ...opponent.bench.filter(Boolean)];
}

function removeOwnedUnit(opponent, instanceId) {
    const boardIndex = opponent.board.findIndex(unit => unit?.instanceId === instanceId);
    if (boardIndex >= 0) opponent.board[boardIndex] = null;
    else opponent.bench = opponent.bench.filter(unit => unit?.instanceId !== instanceId);
}

function combineCopies(opponent, unitId) {
    for (let star = 1; star < 3; star++) {
        if (star === 2 && opponent.profile.strategy !== 'reroll') break;
        let matches = ownedUnits(opponent).filter(unit => unit.id === unitId && unit.star === star);
        while (matches.length >= 3) {
            const consumed = matches.slice(0, 3);
            const savedItems = consumed.flatMap(unit => unit.items || []);
            consumed.forEach(unit => removeOwnedUnit(opponent, unit.instanceId));
            const template = UNIT_POOL.find(unit => unit.id === unitId);
            const upgraded = createOwnedUnit(opponent, template, star + 1);
            equipUnitItems(upgraded, savedItems.slice(0, 3), { random: () => nextRandom(opponent) });
            opponent.items.push(...savedItems.slice(3));
            opponent.bench.push(upgraded);
            matches = ownedUnits(opponent).filter(unit => unit.id === unitId && unit.star === star);
        }
    }
}

function copyCount(opponent, unitId) {
    return ownedUnits(opponent).filter(unit => unit.id === unitId)
        .reduce((sum, unit) => sum + (unit.star === 3 ? 9 : unit.star === 2 ? 3 : 1), 0);
}

export function rollOpponentShop(opponent) {
    const probabilities = SHOP_PROBABILITIES[Math.min(10, opponent.level)] || SHOP_PROBABILITIES[9];
    return Array.from({ length: 5 }, () => {
        const roll = nextRandom(opponent) * 100;
        let total = 0;
        let tier = 1;
        for (let index = 0; index < probabilities.length; index++) {
            total += probabilities[index];
            if (roll <= total) { tier = index + 1; break; }
        }
        const candidates = UNIT_POOL.filter(unit => unit.tier === tier);
        return candidates[Math.floor(nextRandom(opponent) * candidates.length)];
    });
}

function unitDesirability(opponent, template, progress) {
    const path = pathById(opponent.currentComp);
    const phasePool = path[stageName(progress)];
    const copies = copyCount(opponent, template.id);
    const boardRoles = new Set(opponent.board.filter(Boolean).flatMap(unit => values(unit.role)));
    let score = 2 - template.tier * 0.15;
    if (phasePool.includes(template.id)) score += 6;
    else if (path.optionalUnits.includes(template.id)) score += 2.5 * opponent.profile.pivotSkill;
    if (path.coreUnits.includes(template.id) && progress >= 0.35) score += 3;
    if (copies > 0) score += copies === 2 || copies === 8 ? 8 : 3;
    if (ownsRole(template, 'tank') && !boardRoles.has('tank')) score += 3;
    if (ownsRole(template, 'dealer') && !boardRoles.has('dealer')) score += 3;
    if (opponent.profile.strategy === 'reroll' && template.tier <= 2) score += 2;
    if (opponent.profile.strategy === 'reroll' && template.id === opponent.rerollTargetId) score += 6;
    if (opponent.profile.strategy === 'fastLevel' && template.tier >= 4) score += 2;
    return score;
}

function buyFromShop(opponent, shop, progress) {
    const ranked = shop.map(template => ({ template, score: unitDesirability(opponent, template, progress) }))
        .sort((a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id));
    for (const { template, score } of ranked) {
        const needsBody = ownedUnits(opponent).length < opponent.level;
        const threshold = 4.5 + (1 - opponent.profile.economySkill) * 2;
        if (opponent.gold < template.tier || (!needsBody && score < threshold)) continue;
        if (ownedUnits(opponent).length >= opponent.level + OPPONENT_AI_CONFIG.benchSize) break;
        opponent.gold -= template.tier;
        opponent.bench.push(createOwnedUnit(opponent, template));
        combineCopies(opponent, template.id);
    }
}

function addExperience(opponent, amount) {
    if (opponent.level >= 10) return;
    opponent.xp += amount;
    while (opponent.level < 10 && opponent.xp >= EXP_TABLE[opponent.level]) {
        opponent.xp -= EXP_TABLE[opponent.level];
        opponent.level++;
    }
}

function desiredLevel(opponent, round) {
    if (round === 1) return 1;
    let target = Math.min(9, 2 + Math.floor((round - 1) / 4));
    if (opponent.profile.strategy === 'fastLevel' && round >= 9) target++;
    if (opponent.profile.strategy === 'reroll' && round >= 9 && !ownedUnits(opponent).some(unit => unit.star === 3 && unit.tier <= 2)) target = Math.min(target, 6);
    if (opponent.profile.strengthTier === 'weak' && round >= 13) target--;
    return Math.max(1, Math.min(10, target));
}

function reserveGold(opponent) {
    if (opponent.health < 35) return 0;
    if (opponent.profile.strategy === 'tempo') return 10;
    if (opponent.profile.strategy === 'reroll') return 20;
    return Math.round(15 + opponent.profile.economySkill * 25);
}

function spendOnLevels(opponent, round) {
    const target = desiredLevel(opponent, round);
    const reserve = reserveGold(opponent);
    while (opponent.level < target && opponent.gold - 4 >= reserve) {
        opponent.gold -= 4;
        addExperience(opponent, 4);
    }
}

function updateVirtualRecord(opponent) {
    const winChance = 0.5 + (opponent.profile.strengthTier === 'strong' ? 0.08 : opponent.profile.strengthTier === 'weak' ? -0.08 : 0);
    const won = nextRandom(opponent) < winChance;
    if (won) {
        opponent.winStreak++;
        opponent.lossStreak = 0;
    } else {
        opponent.lossStreak++;
        opponent.winStreak = 0;
        opponent.health = Math.max(1, opponent.health - 2 - Math.floor(nextRandom(opponent) * 5));
    }
}

function maybePivot(opponent, progress) {
    if (progress < 0.4 || nextRandom(opponent) > opponent.profile.pivotSkill * 0.3) return;
    const owned = ownedUnits(opponent);
    const current = pathById(opponent.currentComp);
    const candidates = current.pivotTargets.map(pathById);
    const fit = path => owned.filter(unit => hasTrait(unit, path.traits)).length;
    const best = candidates.sort((a, b) => fit(b) - fit(a))[0];
    if (best && fit(best) >= fit(current) + 2) opponent.currentComp = best.id;
}

const centerOrder = [3, 4, 2, 5, 1, 6, 0, 7];

function arrangeBoard(roster) {
    const board = Array(24).fill(null);
    const front = centerOrder.map(column => 16 + column);
    const middle = centerOrder.map(column => 8 + column);
    const back = centerOrder;
    const ordered = [...roster].sort((a, b) => {
        const rank = unit => ownsRole(unit, 'tank') ? 0 : unit.stats.range > 1 ? 2 : 1;
        return rank(a) - rank(b) || b.tier - a.tier || a.instanceId.localeCompare(b.instanceId);
    });
    ordered.forEach(unit => {
        const slots = ownsRole(unit, 'tank') ? front : unit.stats.range > 1 ? back : middle;
        const slot = slots.find(index => board[index] === null) ?? [...front, ...middle, ...back].find(index => board[index] === null);
        board[slot] = unit;
    });
    return board;
}

function rosterKey(roster) {
    return roster.map(unit => unit.instanceId).sort().join('|');
}

function scoreRoster(roster, allOwned, opponent, previousBoard) {
    const board = arrangeBoard(roster);
    const selected = new Set(roster.map(unit => unit.instanceId));
    const bench = allOwned.filter(unit => !selected.has(unit.instanceId));
    const path = pathById(opponent.currentComp);
    const compositionFit = roster.filter(unit => hasTrait(unit, path.traits)).length * 2;
    return evaluateBoard(board, { bench, previousBoard, frontRow: 2 }).score + compositionFit;
}

function findBestBoard(opponent) {
    const allOwned = ownedUnits(opponent);
    const capacity = Math.min(opponent.level, allOwned.length);
    if (capacity === 0) return Array(24).fill(null);
    const previousBoard = opponent.board;
    let beam = [{ roster: previousBoard.filter(Boolean).slice(0, capacity), score: -Infinity }];

    for (let depth = 0; depth < OPPONENT_AI_CONFIG.searchDepth; depth++) {
        const candidates = new Map();
        for (const entry of beam) {
            const selected = new Set(entry.roster.map(unit => unit.instanceId));
            const available = allOwned.filter(unit => !selected.has(unit.instanceId));
            if (entry.roster.length < capacity) {
                available.forEach(unit => candidates.set(rosterKey([...entry.roster, unit]), [...entry.roster, unit]));
            } else {
                entry.roster.forEach((_, index) => available.forEach(unit => {
                    const roster = [...entry.roster];
                    roster[index] = unit;
                    candidates.set(rosterKey(roster), roster);
                }));
            }
            if (entry.roster.length === capacity || available.length === 0) candidates.set(rosterKey(entry.roster), entry.roster);
        }
        beam = [...candidates.values()]
            .map(roster => ({ roster, score: scoreRoster(roster, allOwned, opponent, previousBoard) }))
            .sort((a, b) => b.score - a.score || rosterKey(a.roster).localeCompare(rosterKey(b.roster)))
            .slice(0, OPPONENT_AI_CONFIG.beamWidth);
    }

    const mistakeIndex = beam.length > 1 && nextRandom(opponent) > opponent.profile.positioningSkill ? 1 : 0;
    const chosen = beam[mistakeIndex]?.roster || beam[0].roster;
    const selected = new Set(chosen.map(unit => unit.instanceId));
    opponent.bench = allOwned.filter(unit => !selected.has(unit.instanceId));
    return arrangeBoard(chosen);
}

function trimBench(opponent, progress) {
    while (opponent.bench.length > OPPONENT_AI_CONFIG.benchSize) {
        const counts = new Map(opponent.bench.map(unit => [unit.id, (opponent.bench.filter(other => other.id === unit.id).length)]));
        const sold = [...opponent.bench].sort((a, b) => {
            const pairDifference = (counts.get(a.id) >= 2 ? 1 : 0) - (counts.get(b.id) >= 2 ? 1 : 0);
            return pairDifference || unitDesirability(opponent, a, progress) - unitDesirability(opponent, b, progress);
        })[0];
        opponent.bench = opponent.bench.filter(unit => unit.instanceId !== sold.instanceId);
        opponent.items.push(...(sold.items || []));
        opponent.gold += sold.tier * (sold.star === 3 ? 9 : sold.star === 2 ? 3 : 1);
    }
}

function maybeGainItem(opponent, round) {
    if (round < 4 || (round - 4) % 5 !== 0) return;
    if (opponent.profile.strengthTier === 'weak' && nextRandom(opponent) > 0.8) return;
    const combined = ITEMS.filter(item => item.type === 'combined' && item.id !== 'comb_crit_crit');
    opponent.items.push(combined[Math.floor(nextRandom(opponent) * combined.length)].id);
}

function assignItems(opponent) {
    const pool = [...opponent.items];
    ownedUnits(opponent).forEach(unit => {
        pool.push(...(unit.items || []));
        equipUnitItems(unit, []);
    });
    opponent.items = [];
    for (const itemId of pool) {
        const candidates = opponent.board.filter(unit => unit && unit.items.length < 3 && !unit.items.includes(itemId)).map(unit => {
            unit.items.push(itemId);
            const score = evaluateBoard(opponent.board, { frontRow: 2 }).score;
            unit.items.pop();
            return { unit, score };
        }).sort((a, b) => b.score - a.score || a.unit.instanceId.localeCompare(b.unit.instanceId));
        if (!candidates.length) { opponent.items.push(itemId); continue; }
        const imperfect = candidates.length > 1 && nextRandom(opponent) > opponent.profile.economySkill;
        const chosen = candidates[imperfect ? 1 : 0].unit;
        equipUnitItems(chosen, [...chosen.items, itemId], { random: () => nextRandom(opponent) });
    }
}

function playerStrengthAdjustment(history, round) {
    const delayed = (history || []).filter(entry => entry.round <= round - 2).slice(-3);
    if (delayed.length < 3) return 0;
    const result = delayed.reduce((sum, entry) => sum + (entry.result === 'player' ? 1 : entry.result === 'enemy' ? -1 : 0), 0);
    return Math.max(-0.05, Math.min(0.05, result / 3 * 0.05));
}

function advanceOpponent(opponent, round, playerAdjustment, difficultyMultiplier) {
    const progress = Math.min(1, round / OPPONENT_AI_CONFIG.totalRounds);
    if (round > 1) {
        updateVirtualRecord(opponent);
        const interest = Math.min(5, Math.floor(opponent.gold / 10));
        const streak = Math.min(3, Math.floor(Math.max(opponent.winStreak, opponent.lossStreak) / 2));
        const strengthIncome = opponent.profile.strengthTier === 'strong' && round % 2 === 0 ? 1 : 0;
        opponent.gold += 5 + interest + streak + strengthIncome;
        if (opponent.profile.strengthTier === 'weak' && nextRandom(opponent) > opponent.profile.economySkill) opponent.gold = Math.max(0, opponent.gold - 1);
        addExperience(opponent, 2);
    }

    maybePivot(opponent, progress);
    spendOnLevels(opponent, round);
    buyFromShop(opponent, rollOpponentShop(opponent), progress);

    const reserve = reserveGold(opponent);
    const currentScore = evaluateBoard(opponent.board, { frontRow: 2 }).score;
    const strengthMultiplier = OPPONENT_AI_CONFIG.strengthMultipliers[opponent.profile.strengthTier];
    opponent.targetStrength = Math.round((45 + round * 31) * difficultyMultiplier * strengthMultiplier * (1 + playerAdjustment));
    let extraRolls = opponent.profile.strategy === 'reroll' ? 1 + Math.floor(opponent.profile.riskTolerance * 3) : 0;
    if (opponent.profile.strategy === 'tempo' && progress < 0.45) extraRolls = 1;
    if (opponent.health < 35 || currentScore < opponent.targetStrength * 0.8) extraRolls++;
    if (opponent.profile.strategy === 'fastLevel' && opponent.level < desiredLevel(opponent, round)) extraRolls = 0;
    extraRolls = Math.min(5, extraRolls);
    while (extraRolls-- > 0 && opponent.gold - 2 >= reserve) {
        opponent.gold -= 2;
        buyFromShop(opponent, rollOpponentShop(opponent), progress);
    }

    trimBench(opponent, progress);
    opponent.board = findBestBoard(opponent);
    maybeGainItem(opponent, round);
    assignItems(opponent);
    opponent.transitionState = stageName(progress);
    opponent.lastRound = round;
    opponent.history.push({
        round,
        level: opponent.level,
        gold: opponent.gold,
        comp: opponent.currentComp,
        transition: opponent.transitionState,
        score: evaluateBoard(opponent.board, { frontRow: 2 }).score
    });
    opponent.history = opponent.history.slice(-12);
}

export function createVirtualLobby(runSeed) {
    const opponents = VIRTUAL_OPPONENT_PROFILES.map((profile, index) => {
        const random = createSeededRandom(`${runSeed}:profile:${profile.id}`);
        const currentComp = profile.preferredComps[Math.floor(random() * profile.preferredComps.length)];
        const path = pathById(currentComp);
        const rerollTargetId = path.early
            .map(id => UNIT_POOL.find(unit => unit.id === id))
            .find(unit => unit && unit.tier <= 2 && ownsRole(unit, 'dealer'))?.id || path.early[0];
        return {
            id: profile.id,
            profile: structuredClone(profile),
            level: 1,
            xp: 0,
            gold: 10,
            health: 100,
            board: Array(24).fill(null),
            bench: [],
            items: [],
            winStreak: 0,
            lossStreak: 0,
            shopSeed: `${runSeed}:opponent:${profile.id}`,
            shopCursor: index,
            purchaseCounter: 0,
            currentComp,
            rerollTargetId,
            transitionState: 'opener',
            targetStrength: 0,
            lastRound: 0,
            history: []
        };
    });
    return { version: 1, lastProcessedRound: 0, currentRound: 0, currentOpponentId: null, recentOpponentIds: [], playerAdjustment: 0, opponents };
}

function isValidLobby(lobby) {
    return lobby && Array.isArray(lobby.opponents) && lobby.opponents.length === OPPONENT_AI_CONFIG.lobbySize
        && lobby.opponents.every(opponent => opponent?.profile && Array.isArray(opponent.board) && Array.isArray(opponent.bench));
}

function chooseOpponent(lobby, runSeed, round) {
    if (lobby.currentRound === round && lobby.currentOpponentId) {
        return lobby.opponents.find(opponent => opponent.id === lobby.currentOpponentId);
    }
    let candidates = lobby.opponents.filter(opponent => !lobby.recentOpponentIds.includes(opponent.id));
    if (!candidates.length) candidates = lobby.opponents;
    const bossRound = round % 5 === 0;
    const weights = candidates.map(opponent => bossRound && opponent.profile.strengthTier === 'strong' ? 3 : 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = createSeededRandom(`${runSeed}:match:${round}`)() * totalWeight;
    let selected = candidates.at(-1);
    for (let index = 0; index < candidates.length; index++) {
        roll -= weights[index];
        if (roll <= 0) { selected = candidates[index]; break; }
    }
    lobby.currentRound = round;
    lobby.currentOpponentId = selected.id;
    lobby.recentOpponentIds = [...lobby.recentOpponentIds, selected.id].slice(-2);
    return selected;
}

export function generateEnemyBoard(gameState) {
    const round = (gameState.stage[0] - 1) * 5 + gameState.stage[1];
    if (!isValidLobby(gameState.opponentLobby)) gameState.opponentLobby = createVirtualLobby(gameState.runSeed);
    const lobby = gameState.opponentLobby;
    const difficultyMultiplier = Number.isFinite(gameState.difficultyMultiplier) ? gameState.difficultyMultiplier : OPPONENT_AI_CONFIG.difficultyMultiplier;

    for (let current = lobby.lastProcessedRound + 1; current <= round; current++) {
        lobby.playerAdjustment = playerStrengthAdjustment(gameState.recentBattleResults, current);
        lobby.opponents.forEach(opponent => advanceOpponent(opponent, current, lobby.playerAdjustment, difficultyMultiplier));
        lobby.lastProcessedRound = current;
    }

    const selected = chooseOpponent(lobby, gameState.runSeed, round);
    return structuredClone(selected.board).map(unit => unit ? { ...unit, isEnemy: true } : null);
}
