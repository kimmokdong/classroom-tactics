import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { BattleEngine, createSeededRandom } from '../../js/battleEngine.js';
import { createUnitInstance, prepareBattle } from '../../js/battle/combatPreparation.js';
import { createInitialState } from '../../js/core/GameState.js';
import { UNIT_POOL } from '../../js/data.js';
import { ITEMS } from '../../js/items.js';
import { SynergyManager } from '../../js/systems/SynergyManager.js';
import {
    analyzePairedExperiment,
    createUnitReplacement
} from './aggregate-battle-results.mjs';
import { createLeagueMatchups } from './create-case-suite.mjs';
import { runBattleCase } from './run-battle-case.mjs';
import { loadSimulationInputs, runStandardDecks } from './run-standard-decks.mjs';

const unitsById = new Map(UNIT_POOL.map(unit => [unit.id, unit]));
const roles = ['dealer', 'tank', 'support'];
const positions = { tank: 3, support: 18, dealer: 20 };
const anchors = { tank: 'u2_10', support: 'u3_10', dealer: 'u3_4' };
const unitRepetitions = { smoke: 1, quick: 2, standard: 4, deep: 8 };
const maxIntrinsicGap = 0.10;

const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const round = value => Number.isFinite(value) ? Number(value.toFixed(4)) : value;

function percentile(sorted, ratio) {
    if (!sorted.length) return null;
    const index = (sorted.length - 1) * ratio;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function meanInterval(values) {
    const mean = average(values);
    if (values.length < 2) return { lower: null, upper: null, sampleSize: values.length };
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
    const t95 = [null, null, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262];
    const critical = t95[values.length] || (values.length < 30 ? 2.1 : 1.96);
    const margin = critical * Math.sqrt(variance / values.length);
    return { lower: mean - margin, upper: mean + margin, sampleSize: values.length };
}

function createPreparedUnit(unitId, teamRole, instanceId, seed, itemIds = []) {
    return createUnitInstance(unitsById.get(unitId), {
        star: 1,
        itemIds,
        instanceId,
        teamRole,
        random: createSeededRandom(seed)
    });
}

function createRoleBoard(candidateId, candidateRole, teamRole, seed, candidateItemIds = [], candidatePosition = null) {
    const board = Array(24).fill(null);
    for (const role of roles) {
        const unitId = role === candidateRole ? candidateId : anchors[role];
        const itemIds = role === candidateRole ? candidateItemIds : [];
        const position = role === candidateRole && candidatePosition !== null ? candidatePosition : positions[role];
        board[position] = createPreparedUnit(
            unitId,
            teamRole,
            `${teamRole}:${role}:${unitId}:${seed}`,
            `${seed}:${role}:${unitId}:${itemIds.join(',')}`,
            itemIds
        );
    }
    return board;
}

function prepareWithoutSynergies(playerBoard, enemyBoard) {
    const manager = new SynergyManager({ state: createInitialState(), ITEMS });
    return prepareBattle({
        player: { board: playerBoard, teamRole: 'player', applyPlayerOnlyBonuses: false },
        opponent: { board: enemyBoard, teamRole: 'opponent', applyPlayerOnlyBonuses: false },
        applySynergyStats: (board, synergies, isEnemy, random, options) => manager.applySynergyStats(
            board,
            synergies,
            isEnemy,
            random,
            options
        ),
        getSynergies: () => ({ subjects: {}, clubs: {} }),
        random: () => 0.5
    });
}

function playerScore(end) {
    if (end.endReason === 'decisive') return end.winner === 'player' ? 1 : 0;
    if (end.endReason === 'simultaneous-draw') return 0.5;
    if (end.survivingPlayerHp === end.survivingEnemyHp) return 0.5;
    return end.survivingPlayerHp > end.survivingEnemyHp ? 1 : 0;
}

export function runIsolatedRoleBattle({
    role,
    playerUnitId,
    enemyUnitId,
    playerItemIds = [],
    enemyItemIds = [],
    seed,
    configurationSeed = seed,
    candidatePosition = null,
    maxTicks = 600
}) {
    const prepared = prepareWithoutSynergies(
        createRoleBoard(playerUnitId, role, 'player', configurationSeed, playerItemIds, candidatePosition),
        createRoleBoard(enemyUnitId, role, 'opponent', configurationSeed, enemyItemIds, candidatePosition)
    );
    const engine = new BattleEngine(prepared.playerBoard, prepared.enemyBoard, [], 50, seed);
    engine.maxTicks = maxTicks;
    const logs = engine.run();
    const end = logs.findLast(log => log.type === 'end');
    if (!end) throw new Error(`기물 격리 전투가 종료되지 않았습니다: ${seed}`);
    return { playerScore: playerScore(end), endReason: end.endReason };
}

export function summarizeUnitCostBands(unitRows) {
    const roleSummaries = roles.map(role => {
        const rows = unitRows.filter(row => row.role === role);
        const tiers = [1, 2, 3, 4, 5].map(tier => {
            const tierRows = rows.filter(row => row.tier === tier);
            const values = tierRows.map(row => row.scoreRate).filter(Number.isFinite).sort((a, b) => a - b);
            return {
                tier,
                unitCount: values.length,
                min: round(values[0] ?? null),
                p25: round(percentile(values, 0.25)),
                median: round(percentile(values, 0.5)),
                p75: round(percentile(values, 0.75)),
                max: round(values.at(-1) ?? null),
                mean: round(average(values))
            };
        });
        const populated = tiers.filter(row => Number.isFinite(row.median));
        const adjacentMedianDeltas = populated.slice(1).map((row, index) => ({
            fromTier: populated[index].tier,
            toTier: row.tier,
            delta: round(row.median - populated[index].median)
        }));
        return {
            role,
            tiers,
            monotonicMedian: adjacentMedianDeltas.every(row => row.delta >= 0),
            adjacentMedianDeltas
        };
    });
    return {
        roles: roleSummaries,
        allRolesMonotonic: roleSummaries.every(summary => summary.monotonicMedian)
    };
}

export function runUnitCostBenchmark({ repetitions = 1, maxTicks = 600, onRoleComplete } = {}) {
    const records = new Map();
    const endReasons = { decisive: 0, 'simultaneous-draw': 0, 'max-time': 0 };
    let battleCount = 0;
    for (const role of roles) {
        const candidates = UNIT_POOL.filter(unit => unit.role.includes(role));
        candidates.forEach(unit => records.set(`${unit.id}|${role}`, {
            unitId: unit.id,
            name: unit.name,
            role,
            tier: unit.tier,
            battles: 0,
            scorePoints: 0
        }));
        for (let leftIndex = 0; leftIndex < candidates.length; leftIndex++) {
            for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex++) {
                const left = candidates[leftIndex];
                const right = candidates[rightIndex];
                for (let repetition = 0; repetition < repetitions; repetition++) {
                    for (const swap of [false, true]) {
                        const player = swap ? right : left;
                        const enemy = swap ? left : right;
                        const seed = `stage11:${role}:${left.id}:${right.id}:${repetition}:${swap ? 1 : 0}`;
                        const result = runIsolatedRoleBattle({
                            role,
                            playerUnitId: player.id,
                            enemyUnitId: enemy.id,
                            seed,
                            maxTicks
                        });
                        const playerRecord = records.get(`${player.id}|${role}`);
                        const enemyRecord = records.get(`${enemy.id}|${role}`);
                        playerRecord.battles++;
                        enemyRecord.battles++;
                        playerRecord.scorePoints += result.playerScore;
                        enemyRecord.scorePoints += 1 - result.playerScore;
                        endReasons[result.endReason]++;
                        battleCount++;
                    }
                }
            }
        }
        onRoleComplete?.(role, battleCount);
    }
    const units = [...records.values()].map(row => ({
        ...row,
        scoreRate: row.battles ? round(row.scorePoints / row.battles) : null
    }));
    return { battleCount, repetitions, endReasons, units, costBands: summarizeUnitCostBands(units) };
}

function synergyKey(synergy) {
    return `${synergy.type}:${synergy.name}:${synergy.level}`;
}

function rootDeckId(deck, decksById) {
    let current = deck;
    while (current.parentDeckId && decksById.has(current.parentDeckId)) current = decksById.get(current.parentDeckId);
    return current.id;
}

export function selectSynergyInterventions(data, unitRows) {
    const scores = new Map(unitRows.map(row => [`${row.unitId}|${row.role}`, row.scoreRate]));
    return data.decks.flatMap(deck => {
        const candidates = [];
        for (const entry of deck.units) {
            const from = unitsById.get(entry.unitId);
            for (const to of UNIT_POOL) {
                if (to.tier !== from?.tier || deck.units.some(unit => unit.unitId === to.id)) continue;
                try {
                    const replacement = createUnitReplacement(deck, entry.unitId, to.id);
                    const before = new Set(replacement.intervention.beforeSynergies.map(synergyKey));
                    const after = new Set(replacement.intervention.afterSynergies.map(synergyKey));
                    const removed = [...before].filter(key => !after.has(key));
                    const added = [...after].filter(key => !before.has(key));
                    if (removed.length !== 1 || added.length !== 0) continue;
                    const gaps = replacement.intervention.sharedRoles.map(role => {
                        const fromScore = scores.get(`${from.id}|${role}`);
                        const toScore = scores.get(`${to.id}|${role}`);
                        return Number.isFinite(fromScore) && Number.isFinite(toScore) ? Math.abs(fromScore - toScore) : Infinity;
                    });
                    candidates.push({
                        ...replacement,
                        removedSynergy: removed[0],
                        intrinsicGap: Math.min(...gaps)
                    });
                } catch {
                    // 동일 코스트·공유 역할 제약에 맞지 않는 후보는 제외합니다.
                }
            }
        }
        candidates.sort((left, right) => left.intrinsicGap - right.intrinsicGap
            || `${left.intervention.fromUnitId}|${left.intervention.toUnitId}`.localeCompare(`${right.intervention.fromUnitId}|${right.intervention.toUnitId}`));
        return candidates.length ? [{ deckId: deck.id, ...candidates[0] }] : [];
    });
}

export function summarizeSynergyPremiums(experiments) {
    const groups = new Map();
    for (const experiment of experiments) {
        const group = groups.get(experiment.removedSynergy) || [];
        group.push(experiment);
        groups.set(experiment.removedSynergy, group);
    }
    const synergies = [...groups].map(([key, rows]) => {
        const matchedRows = rows.filter(row => (row.intrinsicGap ?? 0) <= maxIntrinsicGap);
        const differences = matchedRows.flatMap(row => row.premiumDifferences);
        const bySkeleton = new Map();
        for (const row of matchedRows) {
            const values = bySkeleton.get(row.skeletonId) || [];
            values.push(...row.premiumDifferences);
            bySkeleton.set(row.skeletonId, values);
        }
        const skeletonPremiums = [...bySkeleton.values()].map(average);
        const interval = meanInterval(skeletonPremiums);
        const skeletonCount = skeletonPremiums.length;
        const meanPremium = average(skeletonPremiums);
        let judgment = '불확실';
        if (!matchedRows.length) judgment = '기물 매칭 불량';
        else if (skeletonCount < 3) judgment = '근거 부족';
        else if (interval.upper < 0) judgment = '활성화 역효과';
        else if (meanPremium >= 0.12 && interval.lower > 0.02) judgment = '과도 후보';
        else if (interval.lower > 0.02) judgment = '유의미';
        else if (interval.upper < 0.02) judgment = '효과 미약';
        return {
            synergy: key,
            experimentCount: rows.length,
            matchedExperimentCount: matchedRows.length,
            skeletonCount,
            pairedCaseCount: differences.length,
            meanPremium: round(meanPremium),
            premium95: { lower: round(interval.lower), upper: round(interval.upper), sampleSize: interval.sampleSize },
            judgment
        };
    }).sort((left, right) => (right.meanPremium ?? -Infinity) - (left.meanPremium ?? -Infinity));
    const supported = synergies.filter(row => row.skeletonCount >= 3 && Number.isFinite(row.meanPremium));
    return {
        synergies,
        supportedSynergyCount: supported.length,
        supportedPremiumGap: supported.length > 1 ? round(supported[0].meanPremium - supported.at(-1).meanPremium) : null,
        strongest: supported[0] || null,
        weakest: supported.at(-1) || null
    };
}

export function selectSynergyEffectCases(data, maxSkeletons = 4) {
    const decksById = new Map(data.decks.map(deck => [deck.id, deck]));
    const groups = new Map();
    for (const deck of data.decks) {
        for (const synergy of deck.expectedSynergies) {
            if (synergy.type === 'clubs' && synergy.name === '경제부') continue;
            const key = synergyKey(synergy);
            const bySkeleton = groups.get(key) || new Map();
            const skeletonId = rootDeckId(deck, decksById);
            const current = bySkeleton.get(skeletonId);
            if (!current || current.units.length < deck.units.length) bySkeleton.set(skeletonId, deck);
            groups.set(key, bySkeleton);
        }
    }
    return [...groups].flatMap(([key, bySkeleton]) => [...bySkeleton.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, maxSkeletons)
        .map(([skeletonId, deck]) => ({
            deckId: deck.id,
            skeletonId,
            synergy: deck.expectedSynergies.find(entry => synergyKey(entry) === key)
        })));
}

export function runSynergyEffectBenchmark({ data, profiles, targetBands, profileName, baseline, cases, onCaseComplete }) {
    const baselineByCase = new Map(baseline.results.map(result => [result.caseId, result]));
    const matchups = createLeagueMatchups(data);
    const experiments = [];
    cases.forEach((selected, index) => {
        const deck = data.decks.find(entry => entry.id === selected.deckId);
        const league = `internal:${deck.strategyGroup}`;
        const matchupKeys = matchups
            .filter(row => row.league === league && (row.deckAId === selected.deckId || row.deckBId === selected.deckId))
            .map(row => `${row.league}|${row.deckAId}|${row.deckBId}`);
        const run = runStandardDecks({
            data,
            profiles,
            targetBands,
            profileName,
            matchupKeys,
            runCase: (battleCase, options) => runBattleCase(battleCase, {
                ...options,
                suppressedSynergyByDeckId: {
                    [selected.deckId]: { type: selected.synergy.type, name: selected.synergy.name }
                }
            })
        });
        if (run.failures.length) throw new Error(`${selected.deckId}: 시너지 효과 제거 실험 ${run.failures.length}건 실패`);
        const controlResults = run.results.map(result => baselineByCase.get(result.caseId)).filter(Boolean);
        const paired = analyzePairedExperiment({
            controlResults,
            variantResults: run.results,
            deckId: selected.deckId,
            kind: 'synergy-effect-suppression',
            synergyChanged: true
        });
        experiments.push({
            deckId: selected.deckId,
            skeletonId: selected.skeletonId,
            removedSynergy: synergyKey(selected.synergy),
            intrinsicGap: 0,
            pairedCaseCount: paired.pairedCaseCount,
            controlScoreRate: round(paired.controlScoreRate),
            variantScoreRate: round(paired.variantScoreRate),
            synergyPremium: round(-paired.scoreRateDelta),
            premiumDifferences: paired.pairedDifferences.map(value => -value)
        });
        onCaseComplete?.(index + 1, cases.length, selected.deckId, selected.synergy);
    });
    return { experiments, summary: summarizeSynergyPremiums(experiments) };
}

function readBaseline(runId, outputRoot) {
    const pointerPath = path.join(outputRoot, 'baselines', 'current.json');
    const selectedRunId = runId || JSON.parse(fs.readFileSync(pointerPath, 'utf8')).runId;
    const canonicalPath = path.join(outputRoot, 'runs', selectedRunId, 'results.canonical.json');
    const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
    return { runId: selectedRunId, results: canonical.results || [] };
}

export function runSynergyBenchmark({ data, profiles, targetBands, profileName, baseline, interventions, onDeckComplete }) {
    const baselineByCase = new Map(baseline.results.map(result => [result.caseId, result]));
    const matchups = createLeagueMatchups(data);
    const decksById = new Map(data.decks.map(deck => [deck.id, deck]));
    const experiments = [];
    interventions.forEach((selected, index) => {
        const original = decksById.get(selected.deckId);
        const league = `internal:${original.strategyGroup}`;
        const matchupKeys = matchups
            .filter(row => row.league === league && (row.deckAId === selected.deckId || row.deckBId === selected.deckId))
            .map(row => `${row.league}|${row.deckAId}|${row.deckBId}`);
        const variantData = structuredClone(data);
        variantData.decks[variantData.decks.findIndex(deck => deck.id === selected.deckId)] = selected.deck;
        const run = runStandardDecks({ data: variantData, profiles, targetBands, profileName, matchupKeys });
        if (run.failures.length) throw new Error(`${selected.deckId}: 시너지 통제 실험 ${run.failures.length}건 실패`);
        const controlResults = run.results.map(result => baselineByCase.get(result.caseId)).filter(Boolean);
        const paired = analyzePairedExperiment({
            controlResults,
            variantResults: run.results,
            deckId: selected.deckId,
            synergyChanged: true
        });
        experiments.push({
            deckId: selected.deckId,
            skeletonId: rootDeckId(original, decksById),
            removedSynergy: selected.removedSynergy,
            fromUnitId: selected.intervention.fromUnitId,
            toUnitId: selected.intervention.toUnitId,
            sharedRoles: selected.intervention.sharedRoles,
            intrinsicGap: round(selected.intrinsicGap),
            pairedCaseCount: paired.pairedCaseCount,
            controlScoreRate: round(paired.controlScoreRate),
            variantScoreRate: round(paired.variantScoreRate),
            synergyPremium: round(-paired.scoreRateDelta),
            premium95: {
                lower: round(paired.delta95.upper === null ? null : -paired.delta95.upper),
                upper: round(paired.delta95.lower === null ? null : -paired.delta95.lower),
                sampleSize: paired.delta95.sampleSize
            },
            premiumDifferences: paired.pairedDifferences.map(value => -value)
        });
        onDeckComplete?.(index + 1, interventions.length, selected.deckId);
    });
    return { experiments, summary: summarizeSynergyPremiums(experiments) };
}

function markdown(result) {
    const lines = [
        '# Stage11 기물·시너지 밸런스 측정',
        '',
        `- 프로필: ${result.profile}`,
        `- 기준 run: ${result.baselineRunId}`,
        `- 기물 격리 전투: ${result.unitBenchmark.battleCount.toLocaleString()}회`,
        `- 시너지 통제 실험: ${result.synergyBenchmark.experiments.length}개 덱`,
        '',
        '## 코스트별 기물 성능 범위',
        ''
    ];
    for (const role of result.unitBenchmark.costBands.roles) {
        lines.push(`### ${role.role}`, '', '| 코스트 | 기물 수 | 최소 | 중앙값 | 최대 |', '|---:|---:|---:|---:|---:|');
        for (const tier of role.tiers) lines.push(`| ${tier.tier} | ${tier.unitCount} | ${tier.min ?? '-'} | ${tier.median ?? '-'} | ${tier.max ?? '-'} |`);
        lines.push('', `중앙값 단조 증가: ${role.monotonicMedian ? '예' : '아니오'}`, '');
    }
    lines.push('## 시너지 순수 효과 프리미엄', '', '| 시너지 | 덱 계열 수 | 대응 전투 | 평균 프리미엄 | 95% 구간 | 판정 |', '|---|---:|---:|---:|---:|---|');
    for (const row of result.synergyEffectBenchmark.summary.synergies) {
        lines.push(`| ${row.synergy} | ${row.skeletonCount} | ${row.pairedCaseCount} | ${row.meanPremium ?? '-'} | ${row.premium95.lower ?? '-'} ~ ${row.premium95.upper ?? '-'} | ${row.judgment} |`);
    }
    lines.push('', `근거 확보 시너지 간 평균 프리미엄 격차: ${result.synergyEffectBenchmark.summary.supportedPremiumGap ?? '산출 불가'}`, '');
    lines.push('## 시너지 구성 프리미엄(기물 교체)', '', '| 시너지 | 매칭 실험 | 덱 계열 수 | 평균 프리미엄 | 판정 |', '|---|---:|---:|---:|---|');
    for (const row of result.synergyBenchmark.summary.synergies) {
        lines.push(`| ${row.synergy} | ${row.matchedExperimentCount}/${row.experimentCount} | ${row.skeletonCount} | ${row.meanPremium ?? '-'} | ${row.judgment} |`);
    }
    lines.push('');
    return `${lines.join('\n')}\n`;
}

export function analyzeStage11({
    profileName = 'smoke',
    baselineRunId,
    outputRoot = path.resolve('reports/balance'),
    stage11Root = path.resolve('reports/balance/stage11'),
    maxTicks = 600
} = {}) {
    if (!(profileName in unitRepetitions)) throw new Error(`알 수 없는 프로필: ${profileName}`);
    const inputs = loadSimulationInputs();
    const baseline = readBaseline(baselineRunId, outputRoot);
    const unitBenchmark = runUnitCostBenchmark({
        repetitions: unitRepetitions[profileName],
        maxTicks,
        onRoleComplete: (role, count) => console.error(`[Stage11] 기물 ${role} 완료 (${count}전)`)
    });
    const interventions = selectSynergyInterventions(inputs.data, unitBenchmark.units);
    const synergyBenchmark = runSynergyBenchmark({
        ...inputs,
        profileName,
        baseline,
        interventions,
        onDeckComplete: (done, total, deckId) => console.error(`[Stage11] 시너지 ${done}/${total}: ${deckId}`)
    });
    const effectCases = selectSynergyEffectCases(inputs.data);
    const synergyEffectBenchmark = runSynergyEffectBenchmark({
        ...inputs,
        profileName,
        baseline,
        cases: effectCases,
        onCaseComplete: (done, total, deckId, synergy) => console.error(`[Stage11] 순수 효과 ${done}/${total}: ${deckId} / ${synergy.name} ${synergy.level}`)
    });
    const result = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        profile: profileName,
        baselineRunId: baseline.runId,
        measurementContract: {
            units: '1성·아이템 없음·시너지 없음·동일 역할 3인 셸·양 진영 교차',
            synergyEffects: '기물·아이템·성급·배치·상대·시드를 모두 보존하고 지정 시너지 효과만 제거',
            synergyComposition: `동일 코스트·공유 역할 교체·활성 시너지 1개만 제거·새 활성 시너지 없음·기물 자체 점수 차이 ${maxIntrinsicGap} 이하만 판정`
        },
        unitBenchmark,
        synergyEffectBenchmark,
        synergyBenchmark
    };
    const runId = `${result.generatedAt.replace(/[-:.TZ]/g, '')}-${profileName}`;
    const runDirectory = path.join(stage11Root, runId);
    fs.mkdirSync(runDirectory, { recursive: true });
    fs.writeFileSync(path.join(runDirectory, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(runDirectory, 'report.md'), markdown(result), 'utf8');
    fs.writeFileSync(path.join(stage11Root, 'latest.json'), `${JSON.stringify({ runId, profile: profileName, baselineRunId: baseline.runId }, null, 2)}\n`, 'utf8');
    return { result, runId, runDirectory };
}

function parseArguments(args) {
    const options = {};
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--profile') options.profileName = args[++index];
        else if (argument === '--baseline') options.baselineRunId = args[++index];
        else if (argument === '--help') options.help = true;
        else throw new Error(`알 수 없는 옵션: ${argument}`);
    }
    return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    try {
        const options = parseArguments(process.argv.slice(2));
        if (options.help) console.log('npm run analyze:stage11 -- --profile smoke|quick|standard|deep [--baseline RUN_ID]');
        else {
            const output = analyzeStage11(options);
            console.log(JSON.stringify({ runId: output.runId, runDirectory: output.runDirectory }, null, 2));
        }
    } catch (error) {
        console.error(error.stack || error.message);
        process.exitCode = 1;
    }
}
