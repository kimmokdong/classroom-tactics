import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { AUGMENTS } from '../../js/data.js';
import { createStage13Case, defaultRepresentativeDeckIds, eligibleDeckIds, validateAugmentBalanceConfig } from './analyze-stage13.mjs';
import { runBattleCase } from './run-battle-case.mjs';
import { loadSimulationInputs } from './run-standard-decks.mjs';

const augmentsById = new Map(Object.values(AUGMENTS).flat().map(augment => [augment.id, augment]));
const round = value => Number.isFinite(value) ? Number(value.toFixed(4)) : value;
const score = result => result.winner === 'player' ? 1 : result.winner === 'draw' ? 0.5 : 0;

export function withCoreItems(deck) {
    return { ...deck, units: deck.units.map(unit => ({ ...unit, items: unit.items.slice(0, 2) })) };
}

function classify(config, augmentId) {
    for (const [category, tiers] of Object.entries(config.categories)) {
        for (const [rarity, ids] of Object.entries(tiers)) {
            if (ids.includes(augmentId)) return { category, rarity };
        }
    }
    return null;
}

export function runItemAugmentBenchmark({
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
        const kind = classify(config, augmentId);
        if (!augment || !kind || kind.category === 'economic') throw new Error(`${augmentId}: 전투 상호작용 측정 대상이 아닙니다.`);
        const condition = config.eligibility?.[augmentId] || { type: 'always' };
        const playerDecks = eligibleDeckIds(data, config, augmentId, representativeDeckIds).map(id => decksById.get(id)).filter(Boolean);
        let pairs = 0;
        let withItemsBaseline = 0;
        let withItemsAugment = 0;
        let coreItemsBaseline = 0;
        let coreItemsAugment = 0;

        for (const playerDeck of playerDecks) {
            const coreItemDecksById = new Map(decksById);
            coreItemDecksById.set(playerDeck.id, withCoreItems(playerDeck));
            for (const enemyDeck of opponents) {
                if (playerDeck.id === enemyDeck.id) continue;
                for (const placement of placements) {
                    for (let repetition = 1; repetition <= repetitions; repetition++) {
                        const battleCase = createStage13Case(playerDeck, enemyDeck, placement, repetition);
                        const common = { maxTicks, playerHp: condition.type === 'player-hp-lte' ? condition.value : 100 };
                        withItemsBaseline += score(runBattleCase(battleCase, { ...common, decksById }));
                        withItemsAugment += score(runBattleCase(battleCase, { ...common, decksById, playerAugmentIds: [augmentId] }));
                        coreItemsBaseline += score(runBattleCase(battleCase, { ...common, decksById: coreItemDecksById }));
                        coreItemsAugment += score(runBattleCase(battleCase, { ...common, decksById: coreItemDecksById, playerAugmentIds: [augmentId] }));
                        pairs++;
                        battleCount += 4;
                    }
                }
            }
        }

        const withItemsUpliftPp = pairs ? round((withItemsAugment - withItemsBaseline) / pairs * 100) : null;
        const coreItemsUpliftPp = pairs ? round((coreItemsAugment - coreItemsBaseline) / pairs * 100) : null;
        const interactionPp = pairs ? round(withItemsUpliftPp - coreItemsUpliftPp) : null;
        const gap = Math.abs(interactionPp ?? 0);
        rows.push({
            augmentId,
            name: augment.name,
            rarity: kind.rarity,
            category: kind.category,
            condition,
            eligibleDeckIds: playerDecks.map(deck => deck.id),
            casePairs: pairs,
            battles: pairs * 4,
            withItemsBaselineRate: pairs ? round(withItemsBaseline / pairs) : null,
            withItemsAugmentRate: pairs ? round(withItemsAugment / pairs) : null,
            withItemsUpliftPp,
            coreItemsBaselineRate: pairs ? round(coreItemsBaseline / pairs) : null,
            coreItemsAugmentRate: pairs ? round(coreItemsAugment / pairs) : null,
            coreItemsUpliftPp,
            interactionPp,
            judgment: !pairs ? '적격 표준 덱 없음' : gap >= 12 ? '일시 정지·원인 확인' : gap > 8 ? '관찰' : '안정'
        });
        onAugmentComplete?.(augmentId, battleCount);
    }

    return {
        battleCount,
        thresholds: { watchPp: 8, pausePp: 12 },
        rows,
        suspects: rows.filter(row => row.judgment === '관찰' || row.judgment === '일시 정지·원인 확인'),
        coverageGaps: rows.filter(row => !row.casePairs)
    };
}

function markdown(result) {
    const lines = [
        '# Stage14 아이템·증강체 통합 상호작용 분석', '',
        `- 프로필: \`${result.profile}\``,
        `- 전투 수: ${result.benchmark.battleCount}회`,
        '- 같은 덱·상대·배치·시드에서 완성 3템/핵심 2템 × 증강체 있음/없음 4상태를 비교',
        `- 관찰선: 상호작용 잔차 절댓값 > ${result.benchmark.thresholds.watchPp}%p`,
        `- 원인 확인선: 상호작용 잔차 절댓값 ≥ ${result.benchmark.thresholds.pausePp}%p`, '',
        '| 등급 | 증강체 | 완성 3템 uplift | 핵심 2템 uplift | 상호작용 잔차 | 판정 |',
        '|---|---|---:|---:|---:|---|'
    ];
    for (const row of result.benchmark.rows) {
        lines.push(`| ${row.rarity} | ${row.name} (${row.augmentId}) | ${row.withItemsUpliftPp ?? '-'}%p | ${row.coreItemsUpliftPp ?? '-'}%p | ${row.interactionPp ?? '-'}%p | ${row.judgment} |`);
    }
    lines.push('');
    return `${lines.join('\n')}\n`;
}

export function analyzeStage14({
    profileName = 'smoke',
    configPath = 'balance/augment-balance.json',
    stage14Root = path.resolve('reports/balance/stage14'),
    maxTicks = 600,
    augmentIds
} = {}) {
    const inputs = loadSimulationInputs();
    const profile = inputs.profiles[profileName];
    if (!profile) throw new Error(`알 수 없는 프로필: ${profileName}`);
    const config = JSON.parse(fs.readFileSync(path.resolve(configPath), 'utf8'));
    const benchmark = runItemAugmentBenchmark({
        data: inputs.data,
        config,
        augmentIds,
        repetitions: profile.repetitions,
        placements: profile.placements,
        maxTicks,
        onAugmentComplete: (augmentId, count) => console.error(`[Stage14] ${augmentId} 완료 (${count}전)`)
    });
    const result = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        profile: profileName,
        benchmark
    };
    const runId = `${result.generatedAt.replace(/[-:.TZ]/g, '')}-${profileName}`;
    const runDirectory = path.join(stage14Root, runId);
    fs.mkdirSync(runDirectory, { recursive: true });
    fs.writeFileSync(path.join(runDirectory, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(runDirectory, 'report.md'), markdown(result), 'utf8');
    fs.writeFileSync(path.join(stage14Root, 'latest.json'), `${JSON.stringify({ runId, profile: profileName }, null, 2)}\n`, 'utf8');
    return { result, runId, runDirectory };
}

function parseArguments(args) {
    const options = {};
    for (let index = 0; index < args.length; index++) {
        if (args[index] === '--profile') options.profileName = args[++index];
        else if (args[index] === '--augment') (options.augmentIds ||= []).push(args[++index]);
        else if (args[index] === '--help') options.help = true;
        else throw new Error(`알 수 없는 옵션: ${args[index]}`);
    }
    return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    try {
        const options = parseArguments(process.argv.slice(2));
        if (options.help) console.log('npm run analyze:stage14 -- --profile smoke|quick|standard|deep [--augment ID]');
        else {
            const output = analyzeStage14(options);
            console.log(JSON.stringify({ runId: output.runId, runDirectory: output.runDirectory }, null, 2));
        }
    } catch (error) {
        console.error(error.stack || error.message);
        process.exitCode = 1;
    }
}
