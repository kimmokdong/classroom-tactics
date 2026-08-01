import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { evaluateBoard } from '../../js/ai/BoardEvaluator.js';
import { createUnitInstance } from '../../js/battle/combatPreparation.js';
import { createSeededRandom } from '../../js/battleEngine.js';
import { createInitialState } from '../../js/core/GameState.js';
import { AUGMENTS, EXP_TABLE, UNIT_POOL } from '../../js/data.js';
import { generateEnemyBoard } from '../../js/enemyAi.js';

const profileSeedCounts = { smoke: 1, quick: 4, standard: 12, deep: 32 };
const checkpoints = [11, 16, 19, 25, 31];
const scenarios = ['g2', 'p1'];
const fixed = value => Number.isFinite(value) ? Number(value.toFixed(3)) : value;
const augmentsById = new Map(Object.values(AUGMENTS).flat().map(augment => [augment.id, augment]));
const crammingGold = augmentsById.get('g2').effect.values.crammingGold;
const perfectScoreEffect = augmentsById.get('p1').effect;

function setRound(state, round) {
    state.stage = [Math.floor((round - 1) / 5) + 1, (round - 1) % 5 + 1];
}

export function applyExperience(opponent, amount) {
    opponent.xp += amount;
    while (opponent.level < 10 && opponent.xp >= EXP_TABLE[opponent.level]) {
        opponent.xp -= EXP_TABLE[opponent.level];
        opponent.level++;
    }
}

export function applyCrammingReward(opponent, pendingIds) {
    if (!pendingIds.has(opponent.id) || opponent.level < 7) return false;
    opponent.gold += crammingGold;
    pendingIds.delete(opponent.id);
    return true;
}

function applyPerfectScore(opponent, seed) {
    applyExperience(opponent, perfectScoreEffect.exp);
    const candidates = UNIT_POOL.filter(unit => unit.tier === perfectScoreEffect.unitTier);
    const random = createSeededRandom(`stage15:p1:${seed}:${opponent.id}`);
    const template = candidates[Math.floor(random() * candidates.length)];
    opponent.bench.push(createUnitInstance(template, {
        star: 1,
        instanceId: `${opponent.id}:p1:${seed}`,
        teamRole: 'opponent',
        random
    }));
}

function snapshot(opponent, round) {
    const board = opponent.board.filter(Boolean);
    return {
        round,
        level: opponent.level,
        gold: opponent.gold,
        health: opponent.health,
        score: evaluateBoard(opponent.board, { frontRow: 2 }).score,
        boardSize: board.length,
        threeStars: board.filter(unit => unit.star === 3).length,
        highCostTwoStars: board.filter(unit => unit.star >= 2 && unit.tier >= 4).length,
        fiveCostUnits: board.filter(unit => unit.tier === 5).length
    };
}

function runScenario(seed, scenario, lastRound = 31) {
    const state = createInitialState();
    state.runSeed = `stage15:${seed}`;
    const histories = new Map();
    const pendingCramming = new Set();
    const crammingRounds = {};

    for (let round = 1; round <= lastRound; round++) {
        if (scenario === 'g2' && round === 11) {
            state.opponentLobby.opponents.forEach(opponent => pendingCramming.add(opponent.id));
        }
        if (scenario === 'p1' && round === 16) {
            state.opponentLobby.opponents.forEach(opponent => applyPerfectScore(opponent, seed));
        }
        setRound(state, round);
        generateEnemyBoard(state);
        if (scenario === 'g2') {
            state.opponentLobby.opponents.forEach(opponent => {
                if (applyCrammingReward(opponent, pendingCramming)) crammingRounds[opponent.id] = round;
            });
        }
        state.opponentLobby.opponents.forEach(opponent => {
            if (!histories.has(opponent.id)) histories.set(opponent.id, {
                profileId: opponent.id,
                profileName: opponent.profile.name,
                strategy: opponent.profile.strategy,
                strengthTier: opponent.profile.strengthTier,
                snapshots: []
            });
            histories.get(opponent.id).snapshots.push(snapshot(opponent, round));
        });
    }
    return { histories, crammingRounds, pendingCramming: [...pendingCramming] };
}

const atRound = (history, round) => history.snapshots.find(value => value.round === round);
const arrivalRound = (history, level) => history.snapshots.find(value => value.level >= level)?.round ?? null;

function addToGroup(groups, key, sample) {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sample);
}

function summarizeBaseline(samples) {
    const groups = new Map();
    for (const sample of samples) {
        addToGroup(groups, `${sample.strategy}|${sample.round}`, sample);
        addToGroup(groups, `all|${sample.round}`, sample);
    }
    return [...groups.entries()].map(([key, rows]) => {
        const [strategy, round] = key.split('|');
        return {
            strategy,
            round: Number(round),
            samples: rows.length,
            meanLevel: fixed(rows.reduce((sum, row) => sum + row.level, 0) / rows.length),
            meanGold: fixed(rows.reduce((sum, row) => sum + row.gold, 0) / rows.length),
            meanScore: fixed(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
        };
    }).sort((a, b) => a.round - b.round || a.strategy.localeCompare(b.strategy));
}

function summarizeEffects(samples) {
    const groups = new Map();
    for (const sample of samples) {
        addToGroup(groups, `${sample.scenario}|${sample.strategy}|${sample.round}`, sample);
        addToGroup(groups, `${sample.scenario}|all|${sample.round}`, sample);
    }
    return [...groups.entries()].map(([key, rows]) => {
        const [scenario, strategy, round] = key.split('|');
        const mean = field => fixed(rows.reduce((sum, row) => sum + row[field], 0) / rows.length);
        return {
            scenario,
            strategy,
            round: Number(round),
            samples: rows.length,
            levelDelta: mean('levelDelta'),
            goldDelta: mean('goldDelta'),
            scoreDelta: mean('scoreDelta'),
            boardSizeDelta: mean('boardSizeDelta'),
            threeStarsDelta: mean('threeStarsDelta'),
            highCostTwoStarsDelta: mean('highCostTwoStarsDelta'),
            fiveCostUnitsDelta: mean('fiveCostUnitsDelta')
        };
    }).sort((a, b) => a.scenario.localeCompare(b.scenario) || a.round - b.round || a.strategy.localeCompare(b.strategy));
}

function summarizeArrivals(samples) {
    const groups = new Map();
    for (const sample of samples) {
        addToGroup(groups, `${sample.scenario}|${sample.strategy}|${sample.level}`, sample);
        addToGroup(groups, `${sample.scenario}|all|${sample.level}`, sample);
    }
    return [...groups.entries()].map(([key, rows]) => {
        const [scenario, strategy, level] = key.split('|');
        const valid = rows.filter(row => row.roundsEarlier !== null);
        return {
            scenario,
            strategy,
            level: Number(level),
            samples: rows.length,
            reachedSamples: valid.length,
            meanRoundsEarlier: valid.length ? fixed(valid.reduce((sum, row) => sum + row.roundsEarlier, 0) / valid.length) : null
        };
    }).sort((a, b) => a.scenario.localeCompare(b.scenario) || a.level - b.level || a.strategy.localeCompare(b.strategy));
}

export function runProgressionBenchmark({ seedCount = 1, lastRound = 31 } = {}) {
    const baselineSamples = [];
    const effectSamples = [];
    const arrivalSamples = [];
    const crammingRounds = [];

    for (let index = 0; index < seedCount; index++) {
        const seed = `seed-${index}`;
        const baseline = runScenario(seed, 'baseline', lastRound);
        for (const history of baseline.histories.values()) {
            for (const checkpoint of checkpoints.filter(round => round <= lastRound)) {
                baselineSamples.push({ strategy: history.strategy, ...atRound(history, checkpoint) });
            }
        }
        for (const scenario of scenarios) {
            const candidate = runScenario(seed, scenario, lastRound);
            for (const [profileId, history] of candidate.histories) {
                const baseHistory = baseline.histories.get(profileId);
                for (const checkpoint of checkpoints.filter(round => round <= lastRound)) {
                    const base = atRound(baseHistory, checkpoint);
                    const current = atRound(history, checkpoint);
                    effectSamples.push({
                        scenario,
                        profileId,
                        strategy: history.strategy,
                        strengthTier: history.strengthTier,
                        round: checkpoint,
                        levelDelta: current.level - base.level,
                        goldDelta: current.gold - base.gold,
                        scoreDelta: current.score - base.score,
                        boardSizeDelta: current.boardSize - base.boardSize,
                        threeStarsDelta: current.threeStars - base.threeStars,
                        highCostTwoStarsDelta: current.highCostTwoStars - base.highCostTwoStars,
                        fiveCostUnitsDelta: current.fiveCostUnits - base.fiveCostUnits
                    });
                }
                for (const level of [7, 8, 9]) {
                    const baseRound = arrivalRound(baseHistory, level);
                    const currentRound = arrivalRound(history, level);
                    arrivalSamples.push({
                        scenario,
                        strategy: history.strategy,
                        level,
                        roundsEarlier: baseRound === null || currentRound === null ? null : baseRound - currentRound
                    });
                }
                if (scenario === 'g2') crammingRounds.push({
                    profileId,
                    strategy: history.strategy,
                    strengthTier: history.strengthTier,
                    round: candidate.crammingRounds[profileId] ?? null
                });
            }
        }
    }

    return {
        seedCount,
        lastRound,
        selectionRounds: { g2: 11, p1: 16 },
        baseline: summarizeBaseline(baselineSamples),
        effects: summarizeEffects(effectSamples),
        arrivals: summarizeArrivals(arrivalSamples),
        crammingRounds,
        samples: effectSamples
    };
}

function markdown(result) {
    const lines = [
        '# Stage15 경제 진행·시점 의존 증강체 분석', '',
        `- 프로필: \`${result.profile}\``,
        `- 결정론적 시드: ${result.benchmark.seedCount}개`,
        `- 진행 라운드: 1~${result.benchmark.lastRound}`,
        '- 기존 가상 로비의 상점·리롤·레벨업·이자·연승/연패 경로를 그대로 사용',
        '- 골드 증강 선택: 3-1(11라운드), 프리즘 증강 선택: 4-1(16라운드)', '',
        '## 전체 평균 효과', '',
        '| 증강체 | 라운드 | 레벨 차이 | 잔여 골드 차이 | 보드 점수 차이 | 5코스트 차이 |',
        '|---|---:|---:|---:|---:|---:|'
    ];
    for (const row of result.benchmark.effects.filter(row => row.strategy === 'all')) {
        lines.push(`| ${row.scenario} | ${row.round} | ${row.levelDelta} | ${row.goldDelta} | ${row.scoreDelta} | ${row.fiveCostUnitsDelta} |`);
    }
    lines.push('', '## 레벨 도달 시점', '', '| 증강체 | 전략 | 목표 레벨 | 평균 단축 라운드 | 도달 표본 |', '|---|---|---:|---:|---:|');
    for (const row of result.benchmark.arrivals) {
        lines.push(`| ${row.scenario} | ${row.strategy} | ${row.level} | ${row.meanRoundsEarlier ?? '-'} | ${row.reachedSamples}/${row.samples} |`);
    }
    lines.push('');
    return `${lines.join('\n')}\n`;
}

export function analyzeStage15({
    profileName = 'smoke',
    stage15Root = path.resolve('reports/balance/stage15')
} = {}) {
    const seedCount = profileSeedCounts[profileName];
    if (!seedCount) throw new Error(`알 수 없는 프로필: ${profileName}`);
    const benchmark = runProgressionBenchmark({ seedCount });
    const result = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        profile: profileName,
        benchmark
    };
    const runId = `${result.generatedAt.replace(/[-:.TZ]/g, '')}-${profileName}`;
    const runDirectory = path.join(stage15Root, runId);
    fs.mkdirSync(runDirectory, { recursive: true });
    fs.writeFileSync(path.join(runDirectory, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(runDirectory, 'report.md'), markdown(result), 'utf8');
    fs.writeFileSync(path.join(stage15Root, 'latest.json'), `${JSON.stringify({ runId, profile: profileName }, null, 2)}\n`, 'utf8');
    return { result, runId, runDirectory };
}

function parseArguments(args) {
    const options = {};
    for (let index = 0; index < args.length; index++) {
        if (args[index] === '--profile') options.profileName = args[++index];
        else if (args[index] === '--help') options.help = true;
        else throw new Error(`알 수 없는 옵션: ${args[index]}`);
    }
    return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    try {
        const options = parseArguments(process.argv.slice(2));
        if (options.help) console.log('npm run analyze:stage15 -- --profile smoke|quick|standard|deep');
        else {
            const output = analyzeStage15(options);
            console.log(JSON.stringify({ runId: output.runId, runDirectory: output.runDirectory }, null, 2));
        }
    } catch (error) {
        console.error(error.stack || error.message);
        process.exitCode = 1;
    }
}
