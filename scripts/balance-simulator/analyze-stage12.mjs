import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ITEMS } from '../../js/items.js';
import { wilsonInterval } from './aggregate-battle-results.mjs';
import { runIsolatedRoleBattle } from './analyze-stage11.mjs';
import { loadSimulationInputs } from './run-standard-decks.mjs';

const combinedItems = ITEMS.filter(item => item.type === 'combined');
const itemsById = new Map(combinedItems.map(item => [item.id, item]));
const profileDefinitions = {
    ad: { label: 'AD 딜러', role: 'dealer', unitId: 'u3_4', baseItemIds: ['comb_ad_as', 'comb_ad_crit'] },
    ap: { label: 'AP 딜러', role: 'dealer', unitId: 'u3_5', baseItemIds: ['comb_ap_mana', 'comb_ap_crit'] },
    tank: { label: '탱커', role: 'tank', unitId: 'u2_10', baseItemIds: ['comb_armor_mr', 'comb_hp_hp'] },
    support: { label: '서포터', role: 'support', unitId: 'u3_10', baseItemIds: ['comb_ap_armor', 'comb_mana_mr'], candidatePosition: 19 }
};
const profileRepetitions = { smoke: 1, quick: 2, standard: 4, deep: 8 };
const round = value => Number.isFinite(value) ? Number(value.toFixed(4)) : value;

export function summarizeItemBenchmark(rows) {
    const profiles = Object.entries(profileDefinitions).map(([profile, definition]) => {
        const profileRows = rows.filter(row => row.profile === profile);
        const ranked = profileRows.filter(row => row.itemId).sort((left, right) => right.scoreRate - left.scoreRate || left.itemId.localeCompare(right.itemId));
        return {
            profile,
            label: definition.label,
            noItem: profileRows.find(row => !row.itemId) || null,
            top: ranked.slice(0, 5),
            bottom: ranked.slice(-5).reverse()
        };
    });
    const items = combinedItems.map(item => {
        const itemRows = rows.filter(row => row.itemId === item.id).sort((left, right) => right.scoreRate - left.scoreRate);
        const best = itemRows[0];
        const worst = itemRows.at(-1);
        const strongProfiles = itemRows.filter(row => row.scoreRate95.lower !== null && row.scoreRate95.lower > 0.55).length;
        const underperforming = itemRows.length === Object.keys(profileDefinitions).length
            && itemRows.every(row => row.scoreRate95.upper !== null && row.scoreRate95.upper < 0.5);
        return {
            itemId: item.id,
            name: item.name,
            effect: item.effect || null,
            bestProfile: best?.profile || null,
            bestScoreRate: best?.scoreRate ?? null,
            worstProfile: worst?.profile || null,
            worstScoreRate: worst?.scoreRate ?? null,
            meanScoreRate: round(itemRows.reduce((sum, row) => sum + row.scoreRate, 0) / Math.max(1, itemRows.length)),
            roleSpread: round((best?.scoreRate ?? 0) - (worst?.scoreRate ?? 0)),
            judgment: underperforming ? '전 역할 저성능 후보' : strongProfiles >= 2 ? '범용 과성능 후보' : '관찰'
        };
    });
    return {
        profiles,
        items,
        overperformanceCandidates: items.filter(item => item.judgment === '범용 과성능 후보'),
        underperformanceCandidates: items.filter(item => item.judgment === '전 역할 저성능 후보')
    };
}

export function runItemBenchmark({
    repetitions = 1,
    profileNames = Object.keys(profileDefinitions),
    itemIds = combinedItems.map(item => item.id),
    maxTicks = 600,
    onProfileComplete
} = {}) {
    const unknownProfile = profileNames.find(profile => !profileDefinitions[profile]);
    const unknownItem = itemIds.find(itemId => !itemsById.has(itemId));
    if (unknownProfile) throw new Error(`알 수 없는 아이템 역할 프로필: ${unknownProfile}`);
    if (unknownItem) throw new Error(`알 수 없는 완성 아이템: ${unknownItem}`);
    const entries = [{ itemId: null, name: '기준 아이템 2개' }, ...itemIds.map(itemId => ({ ...itemsById.get(itemId), itemId }))];
    const records = new Map();
    const endReasons = { decisive: 0, 'simultaneous-draw': 0, 'max-time': 0 };
    let battleCount = 0;

    for (const profile of profileNames) {
        const definition = profileDefinitions[profile];
        for (const entry of entries) records.set(`${profile}|${entry.itemId || 'none'}`, {
            profile,
            profileLabel: definition.label,
            unitId: definition.unitId,
            itemId: entry.itemId,
            name: entry.name,
            battles: 0,
            scorePoints: 0
        });
        for (let leftIndex = 0; leftIndex < entries.length; leftIndex++) {
            for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex++) {
                const left = entries[leftIndex];
                const right = entries[rightIndex];
                for (let repetition = 0; repetition < repetitions; repetition++) {
                    const configurationSeed = `stage12:${profile}:${left.itemId || 'none'}:${right.itemId || 'none'}:${repetition}`;
                    for (const swap of [false, true]) {
                        const player = swap ? right : left;
                        const enemy = swap ? left : right;
                        const loadout = entry => entry.itemId === 'comb_crit_crit'
                            ? [entry.itemId]
                            : entry.itemId ? [...definition.baseItemIds, entry.itemId] : [...definition.baseItemIds];
                        const result = runIsolatedRoleBattle({
                            role: definition.role,
                            playerUnitId: definition.unitId,
                            enemyUnitId: definition.unitId,
                            playerItemIds: loadout(player),
                            enemyItemIds: loadout(enemy),
                            configurationSeed,
                            candidatePosition: definition.candidatePosition ?? null,
                            seed: `${configurationSeed}:${swap ? 1 : 0}`,
                            maxTicks
                        });
                        const playerRecord = records.get(`${profile}|${player.itemId || 'none'}`);
                        const enemyRecord = records.get(`${profile}|${enemy.itemId || 'none'}`);
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
        onProfileComplete?.(profile, battleCount);
    }

    const rows = [...records.values()].map(row => ({
        ...row,
        scoreRate: round(row.scorePoints / row.battles),
        scoreRate95: wilsonInterval(row.scorePoints, row.battles)
    }));
    return { battleCount, repetitions, endReasons, rows, summary: summarizeItemBenchmark(rows) };
}

function standardDeckCoverage(data) {
    const used = new Set(data.decks.flatMap(deck => deck.units.flatMap(unit => unit.items)));
    return {
        combinedItemCount: combinedItems.length,
        usedCombinedItemCount: combinedItems.filter(item => used.has(item.id)).length,
        unusedCombinedItems: combinedItems.filter(item => !used.has(item.id)).map(item => ({ itemId: item.id, name: item.name }))
    };
}

function markdown(result) {
    const lines = [
        '# Stage12 아이템 밸런스 분석', '',
        `- 프로필: \`${result.profile}\``,
        `- 전투 수: ${result.itemBenchmark.battleCount}`,
        `- 완성 아이템: ${result.coverage.combinedItemCount}종`,
        `- 표준 덱 직접 사용: ${result.coverage.usedCombinedItemCount}종`, '',
        '## 측정 계약', '',
        '- 1성 대표 기물·역할별 기준 아이템 2개·시너지 없음·동일 3인 셸',
        '- AD 딜러·AP 딜러·탱커·서포터의 세 번째 완성 아이템 슬롯 풀리그',
        '- 동일 대진 시드·좌우 진영 교대·무작위 아이템 결과 보존',
        '- 표준 덱 승률 연관 통계가 아닌 아이템 간 상대 성능', ''
    ];
    for (const profile of result.itemBenchmark.summary.profiles) {
        lines.push(`## ${profile.label}`, '', '| 구분 | 아이템 | scoreRate | 95% 구간 |', '|---|---|---:|---:|');
        for (const row of profile.top) lines.push(`| 상위 | ${row.name} | ${row.scoreRate} | ${round(row.scoreRate95.lower)}~${round(row.scoreRate95.upper)} |`);
        for (const row of profile.bottom) lines.push(`| 하위 | ${row.name} | ${row.scoreRate} | ${round(row.scoreRate95.lower)}~${round(row.scoreRate95.upper)} |`);
        lines.push(`| 기준 | 기준 아이템 2개 | ${profile.noItem.scoreRate} | ${round(profile.noItem.scoreRate95.lower)}~${round(profile.noItem.scoreRate95.upper)} |`, '');
    }
    lines.push('## 전 역할 요약', '', '| 아이템 | 최적 역할 | 최고 | 최저 역할 | 최저 | 역할 격차 | 판정 |', '|---|---|---:|---|---:|---:|---|');
    for (const item of result.itemBenchmark.summary.items) {
        lines.push(`| ${item.name} | ${profileDefinitions[item.bestProfile]?.label || '-'} | ${item.bestScoreRate} | ${profileDefinitions[item.worstProfile]?.label || '-'} | ${item.worstScoreRate} | ${item.roleSpread} | ${item.judgment} |`);
    }
    lines.push('');
    return `${lines.join('\n')}\n`;
}

export function analyzeStage12({
    profileName = 'smoke',
    stage12Root = path.resolve('reports/balance/stage12'),
    maxTicks = 600
} = {}) {
    if (!(profileName in profileRepetitions)) throw new Error(`알 수 없는 프로필: ${profileName}`);
    const inputs = loadSimulationInputs();
    const itemBenchmark = runItemBenchmark({
        repetitions: profileRepetitions[profileName],
        maxTicks,
        onProfileComplete: (profile, count) => console.error(`[Stage12] ${profile} 완료 (${count}전)`)
    });
    const result = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        profile: profileName,
        coverage: standardDeckCoverage(inputs.data),
        itemBenchmark
    };
    const runId = `${result.generatedAt.replace(/[-:.TZ]/g, '')}-${profileName}`;
    const runDirectory = path.join(stage12Root, runId);
    fs.mkdirSync(runDirectory, { recursive: true });
    fs.writeFileSync(path.join(runDirectory, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(runDirectory, 'report.md'), markdown(result), 'utf8');
    fs.writeFileSync(path.join(stage12Root, 'latest.json'), `${JSON.stringify({ runId, profile: profileName }, null, 2)}\n`, 'utf8');
    return { result, runId, runDirectory };
}

function parseArguments(args) {
    const options = {};
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--profile') options.profileName = args[++index];
        else if (argument === '--help') options.help = true;
        else throw new Error(`알 수 없는 옵션: ${argument}`);
    }
    return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    try {
        const options = parseArguments(process.argv.slice(2));
        if (options.help) console.log('npm run analyze:stage12 -- --profile smoke|quick|standard|deep');
        else {
            const output = analyzeStage12(options);
            console.log(JSON.stringify({ runId: output.runId, runDirectory: output.runDirectory }, null, 2));
        }
    } catch (error) {
        console.error(error.stack || error.message);
        process.exitCode = 1;
    }
}
