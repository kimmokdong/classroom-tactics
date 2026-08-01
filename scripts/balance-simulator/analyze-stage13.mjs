import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { AUGMENTS, EXP_TABLE, UNIT_POOL } from '../../js/data.js';
import { SHOP_PROBABILITIES } from '../../js/core/constants.js';
import { runBattleCase } from './run-battle-case.mjs';
import { loadSimulationInputs } from './run-standard-decks.mjs';

const allAugments = Object.values(AUGMENTS).flat();
const augmentsById = new Map(allAugments.map(augment => [augment.id, augment]));
const unitsById = new Map(UNIT_POOL.map(unit => [unit.id, unit]));
export const defaultRepresentativeDeckIds = [
    'arts-reroll-final8',
    'prank-reroll-final8',
    'capitalism-standard-final9',
    'humanities-standard-final9',
    'morality-leadership-highvalue-final9',
    'stem-highvalue-final9'
];
const round = value => Number.isFinite(value) ? Number(value.toFixed(4)) : value;

function loadAugmentBalanceConfig(filePath = 'balance/augment-balance.json') {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

export function validateAugmentBalanceConfig(config, catalog = AUGMENTS) {
    const catalogIds = Object.values(catalog).flat().map(augment => augment.id).sort();
    const classified = [];
    const counts = {};
    for (const [category, tiers] of Object.entries(config?.categories || {})) {
        counts[category] = {};
        for (const [rarity, ids] of Object.entries(tiers)) {
            if (!Array.isArray(ids)) throw new Error(`${category}.${rarity}: ID 배열이 필요합니다.`);
            counts[category][rarity] = ids.length;
            classified.push(...ids);
        }
    }
    if (new Set(classified).size !== classified.length) throw new Error('증강체 분류에 중복 ID가 있습니다.');
    if (classified.slice().sort().join('|') !== catalogIds.join('|')) throw new Error('증강체 분류가 현재 카탈로그 48종과 일치하지 않습니다.');
    const comparison = config.targetBands?.crossDeckComparison;
    if (comparison?.center !== 'same-rarity-median') throw new Error('통합 덱 기준선은 같은 등급 중앙값이어야 합니다.');
    if (!(comparison.targetDeviationPp > 0 && comparison.pauseDeviationPp > comparison.targetDeviationPp)) {
        throw new Error('통합 덱 목표선과 중단선을 확인하세요.');
    }
    const combatIds = Object.values(config.categories.combat).flat().slice().sort();
    const evaluatedCombatIds = Object.values(config.evaluationModes || {}).flatMap(tiers => Object.values(tiers).flat());
    if (new Set(evaluatedCombatIds).size !== evaluatedCombatIds.length
        || evaluatedCombatIds.slice().sort().join('|') !== combatIds.join('|')) {
        throw new Error('범용·특수 평가군이 전투형 증강체 18종과 일치하지 않습니다.');
    }
    return { augmentCount: catalogIds.length, counts };
}

function traitCount(deck, trait) {
    return new Set(deck.units.flatMap(entry => {
        const unit = unitsById.get(entry.unitId);
        return [unit?.subject, unit?.club].flat().includes(trait) ? [entry.unitId] : [];
    })).size;
}

export function eligibleDeckIds(data, config, augmentId, representativeDeckIds = defaultRepresentativeDeckIds) {
    const condition = config.eligibility?.[augmentId];
    if (!condition || condition.type === 'player-hp-lte') return representativeDeckIds.filter(id => data.decks.some(deck => deck.id === id));
    if (condition.type === 'board-size-lte') return data.decks.filter(deck => deck.units.length <= condition.value).map(deck => deck.id);
    if (condition.type === 'ranged-share-gte') {
        return data.decks.filter(deck => {
            const ranged = deck.units.filter(entry => (unitsById.get(entry.unitId)?.stats?.range || 1) >= 2).length;
            return ranged / deck.units.length >= condition.value;
        }).map(deck => deck.id);
    }
    if (condition.type === 'synergy') return data.decks.filter(deck => traitCount(deck, condition.name) >= condition.value).map(deck => deck.id);
    throw new Error(`${augmentId}: 알 수 없는 적격 조건 ${condition.type}`);
}

function categoryByAugment(config) {
    const result = new Map();
    for (const [category, tiers] of Object.entries(config.categories)) {
        for (const [rarity, ids] of Object.entries(tiers)) ids.forEach(id => result.set(id, { category, rarity }));
    }
    return result;
}

function evaluationMode(config, augmentId, category) {
    if (category === 'economic' || category === 'synergy') return category;
    return Object.values(config.evaluationModes.conditional).flat().includes(augmentId) ? 'conditional' : 'universal';
}

function deriveSeed(type, ...parts) {
    return createHash('sha256').update(['stage13-v1', type, ...parts].join('\u001f')).digest('hex').slice(0, 24);
}

export function createStage13Case(playerDeck, enemyDeck, placement, repetition) {
    const key = [playerDeck.id, enemyDeck.id, placement, repetition];
    return {
        id: ['stage13', ...key].join('|'),
        league: 'stage13:augment',
        checkpointA: playerDeck.checkpointId,
        checkpointB: enemyDeck.checkpointId,
        placementA: placement,
        placementB: placement,
        sideDirection: 'a-left',
        repetition,
        deckAId: playerDeck.id,
        deckBId: enemyDeck.id,
        seeds: {
            battle: deriveSeed('battle', ...key),
            deckA: deriveSeed('deck', ...key, playerDeck.id),
            deckB: deriveSeed('deck', ...key, enemyDeck.id),
            itemA: deriveSeed('item', ...key, playerDeck.id),
            itemB: deriveSeed('item', ...key, enemyDeck.id)
        }
    };
}

const score = result => result.winner === 'player' ? 1 : result.winner === 'draw' ? 0.5 : 0;
const median = values => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function annotateCrossDeckComparison(rows, config) {
    const thresholds = config.targetBands.crossDeckComparison;
    for (const rarity of ['silver', 'gold', 'prismatic']) {
        const group = rows.filter(row => row.rarity === rarity
            && row.evaluationMode === 'universal'
            && Number.isFinite(row.augmentScoreRate));
        if (group.length < 2) continue;
        const scoreMedian = median(group.map(row => row.augmentScoreRate));
        const baselineMedian = median(group.map(row => row.baselineScoreRate));
        const upliftMedian = median(group.map(row => row.upliftPp));
        for (const row of group) {
            row.crossDeck = {
                centerScoreRate: round(scoreMedian),
                deviationPp: round((row.augmentScoreRate - scoreMedian) * 100),
                baselineDeviationPp: round((row.baselineScoreRate - baselineMedian) * 100),
                upliftDeviationPp: round(row.upliftPp - upliftMedian)
            };
            const gap = Math.abs(row.crossDeck.deviationPp);
            row.crossDeck.judgment = gap >= thresholds.pauseDeviationPp ? '일시정지'
                : gap > thresholds.targetDeviationPp ? '관찰' : '목표 범위';
        }
    }
    return rows;
}

export function runAugmentBenchmark({
    data,
    config,
    augmentIds,
    representativeDeckIds = defaultRepresentativeDeckIds,
    repetitions = 1,
    placements = ['standard'],
    maxTicks = 600,
    onAugmentComplete
}) {
    validateAugmentBalanceConfig(config);
    const classification = categoryByAugment(config);
    const decksById = new Map(data.decks.map(deck => [deck.id, deck]));
    const opponents = representativeDeckIds.map(id => decksById.get(id)).filter(Boolean);
    const selectedIds = augmentIds || [
        ...Object.values(config.categories.combat).flat(),
        ...Object.values(config.categories.synergy).flat()
    ];
    const rows = [];
    let battleCount = 0;

    for (const augmentId of selectedIds) {
        const augment = augmentsById.get(augmentId);
        const kind = classification.get(augmentId);
        if (!augment || !kind || kind.category === 'economic') throw new Error(`${augmentId}: 전투 측정 대상이 아닙니다.`);
        const playerDecks = eligibleDeckIds(data, config, augmentId, representativeDeckIds).map(id => decksById.get(id)).filter(Boolean);
        const targetBand = kind.category === 'synergy'
            ? config.targetBands.synergyUpliftPp[kind.rarity]
            : config.targetBands.combatUpliftPp[kind.rarity];
        const condition = config.eligibility?.[augmentId] || { type: 'always' };
        let pairs = 0;
        let baselinePoints = 0;
        let augmentPoints = 0;
        let improved = 0;
        let worsened = 0;
        let unchanged = 0;

        for (const playerDeck of playerDecks) {
            for (const enemyDeck of opponents) {
                if (playerDeck.id === enemyDeck.id) continue;
                for (const placement of placements) {
                    for (let repetition = 1; repetition <= repetitions; repetition++) {
                        const battleCase = createStage13Case(playerDeck, enemyDeck, placement, repetition);
                        const options = { decksById, maxTicks, playerHp: condition.type === 'player-hp-lte' ? condition.value : 100 };
                        const baseline = runBattleCase(battleCase, options);
                        const candidate = runBattleCase(battleCase, { ...options, playerAugmentIds: [augmentId] });
                        const before = score(baseline);
                        const after = score(candidate);
                        baselinePoints += before;
                        augmentPoints += after;
                        if (after > before) improved++;
                        else if (after < before) worsened++;
                        else unchanged++;
                        pairs++;
                        battleCount += 2;
                    }
                }
            }
        }

        const upliftPp = pairs ? round((augmentPoints - baselinePoints) / pairs * 100) : null;
        rows.push({
            augmentId,
            name: augment.name,
            rarity: kind.rarity,
            category: kind.category,
            evaluationMode: evaluationMode(config, augmentId, kind.category),
            condition,
            eligibleDeckIds: playerDecks.map(deck => deck.id),
            casePairs: pairs,
            battles: pairs * 2,
            baselineScoreRate: pairs ? round(baselinePoints / pairs) : null,
            augmentScoreRate: pairs ? round(augmentPoints / pairs) : null,
            upliftPp,
            targetBand,
            improved,
            worsened,
            unchanged,
            judgment: !pairs ? '적격 표준 덱 없음'
                : upliftPp < targetBand[0] ? '목표 미달'
                    : upliftPp > targetBand[1] ? '목표 초과' : '목표 범위'
        });
        onAugmentComplete?.(augmentId, battleCount);
    }
    return { battleCount, rows: annotateCrossDeckComparison(rows, config) };
}

const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function analyzeEconomicAugments(config, data) {
    const model = config.economicModel;
    const shopTierMean = level => SHOP_PROBABILITIES[level]
        .reduce((sum, chance, index) => sum + chance * (index + 1) / 100, 0);
    const levelDeltas = [];
    for (let level = model.levelRange[0]; level < model.levelRange[1]; level++) {
        levelDeltas.push((shopTierMean(level + 1) - shopTierMean(level)) * 5);
    }
    const upgradeValues = data.decks.map(deck => {
        const candidates = deck.units
            .filter(entry => (entry.star || 1) === 1)
            .map(entry => (unitsById.get(entry.unitId)?.tier || 0) * 2);
        return average(candidates);
    });
    const makeGold = (value, range) => ({ metric: 'goldEquivalent', value: round(value), ...(range ? { range: range.map(round) } : {}) });
    const rows = [];

    for (const [rarity, ids] of Object.entries(config.categories.economic)) {
        for (const augmentId of ids) {
            const augment = augmentsById.get(augmentId);
            const effect = augment.effect;
            let result;
            if (effect.type === 'grant') {
                result = makeGold((effect.gold || 0)
                    + (effect.exp || 0) * model.xpGold
                    + (effect.unitTier || 0) * (effect.unitCount || 0)
                    + (effect.baseItems || 0) * model.baseItemGold
                    + (effect.combinedItems || 0) * model.combinedItemGold);
            } else if (effect.type === 'upgrade-random') {
                result = {
                    metric: 'goldEquivalentRange',
                    value: round(average(upgradeValues)),
                    range: [round(Math.min(...upgradeValues)), round(Math.max(...upgradeValues))],
                    note: '표준 덱의 무작위 1성 기물 2장을 추가 확보한 가치'
                };
            } else if (effect.type === 'win-unit') {
                const expectedTier = effect.tierChances.reduce((sum, option) => sum + option.tier * option.chance, 0);
                const values = model.horizonScenarios.flatMap(rounds => model.winRateScenarios.map(winRate => rounds * winRate * expectedTier));
                result = makeGold(model.horizonRounds * model.winRate * expectedTier, [Math.min(...values), Math.max(...values)]);
                result.note = `${model.horizonRounds}라운드·승률 ${model.winRate * 100}% 기준`;
            } else if (effect.type === 'round-rerolls') {
                result = makeGold(effect.count * model.rerollGold * model.horizonRounds,
                    [Math.min(...model.horizonScenarios), Math.max(...model.horizonScenarios)].map(rounds => effect.count * model.rerollGold * rounds));
            } else if (augmentId === 's1') {
                result = { metric: 'hpSaved', value: model.averageLossDamage * effect.values.invincibleRounds, note: '평균 패배 피해 기준' };
            } else if (augmentId === 's2') {
                result = makeGold(model.horizonRounds, [Math.min(...model.horizonScenarios), Math.max(...model.horizonScenarios)]);
            } else if (augmentId === 's3' || augmentId === 'g10') {
                result = makeGold(effect.values.freeRerolls * model.rerollGold);
            } else if (augmentId === 'g1') {
                result = {
                    metric: 'shopTierPointsPerRefresh',
                    value: round(average(levelDeltas)),
                    range: [round(Math.min(...levelDeltas)), round(Math.max(...levelDeltas))],
                    note: `${model.levelRange[0]}~${model.levelRange[1]}레벨, 상점 5칸 기준`
                };
            } else if (augmentId === 'g2') {
                result = makeGold(40);
                result.note = '7레벨 도달 시 지급';
            } else if (augmentId === 'g3') {
                const values = model.horizonScenarios.flatMap(rounds => model.winRateScenarios.map(winRate => rounds * winRate * (1 + model.xpGold)));
                result = makeGold(model.horizonRounds * model.winRate * (1 + model.xpGold), [Math.min(...values), Math.max(...values)]);
                result.note = `${model.horizonRounds}라운드·승률 ${model.winRate * 100}% 기준`;
            } else if (augmentId === 'p2') {
                let savedXp = 0;
                const savings = [];
                for (let level = model.levelRange[0]; level < model.levelRange[1]; level++) {
                    const saved = EXP_TABLE[level] - Math.floor(EXP_TABLE[level] * 0.7);
                    savedXp += saved;
                    savings.push(saved);
                }
                const remainingSavings = savings.map((_, index) => savings.slice(index).reduce((sum, value) => sum + value, 0) * model.xpGold);
                result = makeGold(savedXp * model.xpGold, [Math.min(...remainingSavings), Math.max(...remainingSavings)]);
                result.note = `${model.levelRange[0]}→${model.levelRange[1]}레벨 필요 경험치 절감`;
            } else if (augmentId === 'p6') {
                const values = model.interestBankScenarios.flatMap(bank => model.horizonScenarios.map(rounds => Math.max(0, Math.floor(bank / 10) - 5) * rounds));
                result = { metric: 'goldEquivalentRange', value: round(average(values)), range: values, note: `${model.interestBankScenarios.join('~')}G 보유·${model.horizonRounds}라운드 기준` };
            } else if (augmentId === 'p8') {
                const values = model.horizonScenarios.flatMap(rounds => model.winRateScenarios.map(winRate => rounds * (1 - winRate) * model.averageLossDamage * 0.5));
                result = { metric: 'hpSaved', value: round(model.horizonRounds * (1 - model.winRate) * model.averageLossDamage * 0.5), range: [round(Math.min(...values)), round(Math.max(...values))], note: `${model.horizonRounds}라운드·승률 ${model.winRate * 100}% 기준` };
            } else {
                throw new Error(`${augmentId}: 경제 가치 계산식이 없습니다.`);
            }

            const targetBand = config.targetBands.economicGoldEquivalent[rarity];
            const observedRange = result.range || [result.value, result.value];
            const judgment = result.metric.startsWith('goldEquivalent')
                ? Math.max(...observedRange) < targetBand[0] ? '낮은 편'
                    : Math.min(...observedRange) > targetBand[1] ? '높은 편'
                        : result.value >= targetBand[0] && result.value <= targetBand[1] ? '범위' : '상황 의존'
                : '별도 지표';
            rows.push({ augmentId, name: augment.name, rarity, category: 'economic', evaluationMode: 'economic', targetBand, ...result, judgment });
        }
    }
    return rows;
}

function formatEconomicValue(row) {
    if (row.metric === 'hpSaved') return `${row.value} HP 절감`;
    if (row.metric === 'shopTierPointsPerRefresh') return `상점 +${row.range[0]}~${row.range[1]} 등급점`;
    if (row.range) return `${row.range[0]}~${row.range[1]}G (평균 ${row.value}G)`;
    return `${row.value}G`;
}

function markdown(result) {
    const lines = [
        '# Stage13 증강체 밸런스 기준 측정', '',
        `- 프로필: \`${result.profile}\``,
        `- 증강체: ${result.classification.augmentCount}종`,
        `- 전투 측정: ${result.benchmark.battleCount}전`,
        `- 수치 변경: ${result.changeNote || '없음'}`, '',
        '## 목표 밴드', '',
        '| 등급 | 전투형 uplift | 경제형 골드 등가 |', '|---|---:|---:|'
    ];
    for (const rarity of ['silver', 'gold', 'prismatic']) {
        const combat = result.config.targetBands.combatUpliftPp[rarity];
        const economy = result.config.targetBands.economicGoldEquivalent[rarity];
        lines.push(`| ${rarity} | +${combat[0]}~+${combat[1]}%p | ${economy[0]}~${economy[1]}G |`);
    }
    lines.push('', `- 시너지 전용 프리즘: 조건 충족 덱에서 +${result.config.targetBands.synergyUpliftPp.prismatic.join('~+')}%p`);
    const comparison = result.config.targetBands.crossDeckComparison;
    lines.push(`- 통합 덱 기준: 같은 등급 중앙값 대비 ±${comparison.targetDeviationPp}%p 이내`);
    lines.push(`- 일시정지선: 같은 등급 중앙값 대비 절대 ${comparison.pauseDeviationPp}%p 이상`, '');
    for (const category of ['combat', 'economic', 'synergy']) {
        lines.push(`## ${category}`, '', '| 등급 | ID | 이름 |', '|---|---|---|');
        for (const rarity of ['silver', 'gold', 'prismatic']) {
            for (const id of result.config.categories[category][rarity]) lines.push(`| ${rarity} | ${id} | ${augmentsById.get(id).name} |`);
        }
        lines.push('');
    }
    lines.push('## 전투 기준 결과', '', '| 증강체 | 평가 방식 | 적격 덱 | uplift | 통합 편차 | 판정 |', '|---|---|---:|---:|---:|---|');
    for (const row of result.benchmark.rows) {
        lines.push(`| ${row.name} | ${row.evaluationMode}/${row.rarity} | ${row.eligibleDeckIds.length} | ${row.upliftPp ?? '-'}%p | ${row.crossDeck?.deviationPp ?? '-'}%p | ${row.crossDeck?.judgment || row.judgment} |`);
    }
    const model = result.config.economicModel;
    lines.push('', '## 경제형 가치 측정', '',
        `표준 시나리오: ${model.horizonRounds}라운드, 승률 ${model.winRate * 100}%, 리롤 ${model.rerollGold}G, 경험치 1당 ${model.xpGold}G, 기본/완성 아이템 ${model.baseItemGold}/${model.combinedItemGold}G.`, '',
        '| 증강체 | 등급 | 표준 가치 | 목표 | 판정 | 비고 |', '|---|---|---:|---:|---|---|');
    for (const row of result.economic) {
        lines.push(`| ${row.name} | ${row.rarity} | ${formatEconomicValue(row)} | ${row.targetBand[0]}~${row.targetBand[1]}G | ${row.judgment} | ${row.note || ''} |`);
    }
    lines.push('');
    return `${lines.join('\n')}\n`;
}

export function analyzeStage13({
    profileName = 'smoke',
    configPath = 'balance/augment-balance.json',
    stage13Root = path.resolve('reports/balance/stage13'),
    maxTicks = 600,
    augmentIds,
    changeNote
} = {}) {
    const inputs = loadSimulationInputs();
    const profile = inputs.profiles[profileName];
    if (!profile) throw new Error(`알 수 없는 프로필: ${profileName}`);
    const config = loadAugmentBalanceConfig(configPath);
    const classification = validateAugmentBalanceConfig(config);
    const benchmark = runAugmentBenchmark({
        data: inputs.data,
        config,
        augmentIds,
        repetitions: profile.repetitions,
        placements: profile.placements,
        maxTicks,
        onAugmentComplete: (augmentId, count) => console.error(`[Stage13] ${augmentId} 완료 (${count}전)`)
    });
    const result = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        profile: profileName,
        changeNote,
        classification,
        config,
        benchmark,
        economic: analyzeEconomicAugments(config, inputs.data)
    };
    const runId = `${result.generatedAt.replace(/[-:.TZ]/g, '')}-${profileName}`;
    const runDirectory = path.join(stage13Root, runId);
    fs.mkdirSync(runDirectory, { recursive: true });
    fs.writeFileSync(path.join(runDirectory, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(runDirectory, 'report.md'), markdown(result), 'utf8');
    fs.writeFileSync(path.join(stage13Root, 'latest.json'), `${JSON.stringify({ runId, profile: profileName }, null, 2)}\n`, 'utf8');
    return { result, runId, runDirectory };
}

function parseArguments(args) {
    const options = {};
    for (let index = 0; index < args.length; index++) {
        if (args[index] === '--profile') options.profileName = args[++index];
        else if (args[index] === '--augment') options.augmentIds = [args[++index]];
        else if (args[index] === '--change-note') options.changeNote = args[++index];
        else if (args[index] === '--help') options.help = true;
        else throw new Error(`알 수 없는 옵션: ${args[index]}`);
    }
    return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    try {
        const options = parseArguments(process.argv.slice(2));
        if (options.help) console.log('npm run analyze:stage13 -- --profile smoke|quick|standard|deep [--augment ID] [--change-note TEXT]');
        else {
            const output = analyzeStage13(options);
            console.log(JSON.stringify({ runId: output.runId, runDirectory: output.runDirectory }, null, 2));
        }
    } catch (error) {
        console.error(error.stack || error.message);
        process.exitCode = 1;
    }
}
