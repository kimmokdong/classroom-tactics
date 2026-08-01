import { evaluateBoard } from '../js/ai/BoardEvaluator.js';
import { createInitialState } from '../js/core/GameState.js';
import { createVirtualLobby, generateEnemyBoard, rollOpponentShop, VIRTUAL_OPPONENT_PROFILES } from '../js/enemyAi.js';
import { UNIT_POOL } from '../js/data.js';
import { SHOP_PROBABILITIES } from '../js/core/constants.js';

const seedCount = Math.max(1, Number.parseInt(process.env.AI_SEEDS || '200', 10) || 200);
const singleSeed = process.env.AI_SEED;
const seeds = singleSeed ? [singleSeed] : Array.from({ length: seedCount }, (_, index) => `ai-audit-${index}`);
const rounds = 31;
const checkpoints = [1, 7, 13, 19, 25, 31];
const averageScoreBands = { 1: [10, 100], 7: [100, 400], 13: [200, 560], 19: [300, 720], 25: [400, 920], 31: [500, 1100] };
const maxRoundScoreJump = 260;
const unitIds = new Set(UNIT_POOL.map(unit => unit.id));
const failures = [];
const aggregate = Object.fromEntries(checkpoints.map(round => [round, { score: 0, level: 0, count: 0 }]));
const finalLevels = { reroll: [], fastLevel: [] };
const pivotedProfiles = new Set();

function setRound(state, round) {
    state.stage = [Math.floor((round - 1) / 5) + 1, (round - 1) % 5 + 1];
}

function opponentSnapshot(opponent) {
    return {
        id: opponent.id,
        strategy: opponent.profile.strategy,
        strengthTier: opponent.profile.strengthTier,
        level: opponent.level,
        xp: opponent.xp,
        gold: opponent.gold,
        health: opponent.health,
        comp: opponent.currentComp,
        transition: opponent.transitionState,
        board: opponent.board.filter(Boolean).map(unit => ({ id: unit.id, star: unit.star, items: unit.items })),
        bench: opponent.bench.map(unit => ({ id: unit.id, star: unit.star, items: unit.items }))
    };
}

function fail(seed, round, rule, opponent, extra = {}) {
    failures.push({ seed, round, rule, opponent: opponentSnapshot(opponent), ...extra });
}

function validateOpponent(seed, round, opponent, previousScore) {
    const board = opponent.board.filter(Boolean);
    const allUnits = [...board, ...opponent.bench];
    const instanceIds = allUnits.map(unit => unit.instanceId);
    if (!Number.isFinite(opponent.gold) || opponent.gold < 0) fail(seed, round, 'gold-negative', opponent);
    if (board.length > opponent.level || board.length > 24) fail(seed, round, 'board-capacity', opponent, { boardSize: board.length });
    if (opponent.bench.length > 10) fail(seed, round, 'bench-capacity', opponent);
    if (new Set(instanceIds).size !== instanceIds.length) fail(seed, round, 'duplicate-unit-instance', opponent);
    for (const unit of allUnits) {
        if (!unitIds.has(unit.id) || ![1, 2, 3].includes(unit.star)) fail(seed, round, 'invalid-unit', opponent, { unit });
        if (unit.star === 3 && opponent.profile.strategy !== 'reroll') fail(seed, round, 'illegal-three-star', opponent, { unit });
        if ((unit.items || []).length > 3 || new Set(unit.items || []).size !== (unit.items || []).length) fail(seed, round, 'duplicate-or-overflow-item', opponent, { unit });
    }
    const score = evaluateBoard(opponent.board, { frontRow: 2 }).score;
    if (previousScore !== undefined && score - previousScore > maxRoundScoreJump) {
        fail(seed, round, 'score-jump', opponent, { previousScore, score, delta: score - previousScore });
    }
    return score;
}

function auditShopProbabilities() {
    const samplesPerLevel = 4000;
    for (const level of Object.keys(SHOP_PROBABILITIES).map(Number)) {
        const opponent = createVirtualLobby(`shop-audit-${level}`).opponents[0];
        opponent.level = level;
        const counts = Array(5).fill(0);
        for (let sample = 0; sample < samplesPerLevel / 5; sample++) {
            rollOpponentShop(opponent).forEach(unit => counts[unit.tier - 1]++);
        }
        SHOP_PROBABILITIES[level].forEach((expected, index) => {
            const observed = counts[index] / samplesPerLevel * 100;
            if (Math.abs(observed - expected) > 4) {
                failures.push({ seed: `shop-audit-${level}`, round: 0, rule: 'shop-probability', level, tier: index + 1, expected, observed, counts });
            }
        });
    }
}

function auditSeed(seed) {
    const state = createInitialState();
    state.runSeed = seed;
    const previousScores = new Map();
    const initialComps = new Map();
    const encounters = [];
    for (let round = 1; round <= rounds; round++) {
        setRound(state, round);
        generateEnemyBoard(state);
        const lobby = state.opponentLobby;
        encounters.push(lobby.currentOpponentId);
        lobby.opponents.forEach(opponent => {
            if (!initialComps.has(opponent.id)) initialComps.set(opponent.id, opponent.currentComp);
            if (opponent.currentComp !== initialComps.get(opponent.id)) pivotedProfiles.add(opponent.profile.id);
            const score = validateOpponent(seed, round, opponent, previousScores.get(opponent.id));
            previousScores.set(opponent.id, score);
            if (checkpoints.includes(round)) {
                aggregate[round].score += score;
                aggregate[round].level += opponent.level;
                aggregate[round].count++;
            }
        });
    }
    encounters.forEach((id, index) => {
        if (encounters.slice(Math.max(0, index - 2), index).includes(id)) {
            const opponent = state.opponentLobby.opponents.find(candidate => candidate.id === id);
            fail(seed, index + 1, 'recent-opponent-repeat', opponent, { encounters });
        }
    });
    const tiers = ['weak', 'normal', 'strong'].map(tier => state.opponentLobby.opponents.filter(opponent => opponent.profile.strengthTier === tier).length);
    if (tiers.join(',') !== '2,3,2') failures.push({ seed, round: rounds, rule: 'strength-tier-distribution', tiers });
    state.opponentLobby.opponents.forEach(opponent => {
        if (opponent.profile.strategy === 'reroll') finalLevels.reroll.push(opponent.level);
        if (opponent.profile.strategy === 'fastLevel') finalLevels.fastLevel.push(opponent.level);
    });
}

auditShopProbabilities();
seeds.forEach(auditSeed);

const summary = Object.fromEntries(checkpoints.map(round => {
    const value = aggregate[round];
    return [round, { averageScore: Number((value.score / value.count).toFixed(1)), averageLevel: Number((value.level / value.count).toFixed(2)) }];
}));
for (const round of checkpoints) {
    const score = summary[round].averageScore;
    const [min, max] = averageScoreBands[round];
    if (score < min || score > max) failures.push({ seed: 'aggregate', round, rule: 'average-score-band', score, min, max });
}
for (let index = 1; index < checkpoints.length; index++) {
    const previous = summary[checkpoints[index - 1]].averageScore;
    const current = summary[checkpoints[index]].averageScore;
    if (current <= previous) failures.push({ seed: 'aggregate', round: checkpoints[index], rule: 'non-growing-average-score', previous, current });
}
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
if (average(finalLevels.fastLevel) <= average(finalLevels.reroll)) {
    failures.push({ seed: 'aggregate', round: rounds, rule: 'strategy-growth-difference', reroll: average(finalLevels.reroll), fastLevel: average(finalLevels.fastLevel) });
}
if (!pivotedProfiles.size) failures.push({ seed: 'aggregate', round: rounds, rule: 'missing-alternative-strategy' });

console.log(JSON.stringify({ seeds: seeds.length, summary, pivotedProfiles: [...pivotedProfiles], failures: failures.length }, null, 2));
if (failures.length) {
    console.error(JSON.stringify({ failures: failures.slice(0, 20), rerun: 'PowerShell: $env:AI_SEED=<seed>; npm.cmd run audit:ai' }, null, 2));
    process.exitCode = 1;
}
