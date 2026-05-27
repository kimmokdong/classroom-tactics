/**
 * 시너지별 승률 시뮬레이션 스크립트
 * - 보스 단계를 world=3, round=3 (적 레벨 7) 대신 더 적절한 난이도로 조정
 * - 시너지별 평균 승률 통계 수집
 */
import { UNIT_POOL, SYNERGIES } from './js/data.js';
import { ITEMS } from './js/items.js';
import { BattleEngine } from './js/battleEngine.js';
import { generateEnemyBoard } from './js/enemyAi.js';

// ── 설정값 ──────────────────────────────────────────────────
const WORLD = 3;        // 적 월드 (3 = 레벨 5~6, 적절한 상대)
const ROUND = 3;        // 라운드
const ITERATIONS = 300; // 덱 당 전투 횟수
const TEAMS_PER_TARGET = 10; // 타겟 시너지 당 덱 생성 수

console.log(`\n🎮 맞춤 타겟 시너지별 승률 시뮬레이션 시작`);
console.log(`   적 설정: World ${WORLD}, Round ${ROUND} (적 레벨 ${WORLD === 1 ? '3~4' : WORLD === 2 ? '5~6' : '7'})`);
console.log(`   반복 횟수: 타겟 당 ${TEAMS_PER_TARGET}개 덱 × 덱 당 ${ITERATIONS}회 전투\n`);

// ── 아이템 적용 ──────────────────────────────────────────────
function applyItemsToStats(board) {
    const cloned = JSON.parse(JSON.stringify(board));
    const combinedItems = ITEMS.filter(it => it.type === 'combined' && it.effect !== 'thievesGloves');

    for (let i = 0; i < 24; i++) {
        let u = cloned[i];
        if (u) {
            u.currHp = u.stats.hp;
            u.currMana = u.stats.mana || 0;
            u.currShield = 0;
            u.stats.maxHp = u.stats.hp;
            u.stats.maxMana = u.stats.maxMana || u.stats.mana || 0;
            u.combat = { shield: 0, vamp: 0, dmgAmp: 0, critChance: 0.10, critDmg: 1.5, dmgReduc: 0, itemEffects: {} };

            if (u.items) {
                if (u.items.includes('comb_crit_crit')) {
                    const r1 = combinedItems[Math.floor(Math.random() * combinedItems.length)].id;
                    const r2 = combinedItems[Math.floor(Math.random() * combinedItems.length)].id;
                    u.items = ['comb_crit_crit', r1, r2];
                }
                u.items.forEach(itemId => {
                    const itemDef = ITEMS.find(it => it.id === itemId);
                    if (itemDef) {
                        if (itemDef.effect) {
                            u.combat.itemEffects[itemDef.effect] = (u.combat.itemEffects[itemDef.effect] || 0) + 1;
                            if (itemDef.effect === 'rfc') u.stats.range += 1;
                            if (itemDef.effect === 'rabadon') u.stats.ap *= 1.20;
                            if (itemDef.effect === 'blueBuff') u.stats.maxMana = Math.max(10, u.stats.maxMana - 10);
                            if (itemDef.effect === 'deathblade') u.stats.ad += 20;
                            if (itemDef.effect === 'guardbreaker') u.combat.dmgAmp += 0.15;
                            if (itemDef.effect === 'skillCrit') u.combat.critDmg += 0.10;
                            if (itemDef.effect === 'hoj') { u.combat.dmgAmp += 0.15; u.combat.vamp += 0.15; }
                        }
                        if (itemDef.stats) {
                            if (itemDef.stats.hp) { u.stats.maxHp += itemDef.stats.hp; u.currHp += itemDef.stats.hp; }
                            if (itemDef.stats.maxHp) { u.stats.maxHp += itemDef.stats.maxHp; u.currHp += itemDef.stats.maxHp; }
                            if (itemDef.stats.mana) u.currMana += itemDef.stats.mana;
                            if (itemDef.stats.ad) u.stats.ad += itemDef.stats.ad;
                            if (itemDef.stats.ap) u.stats.ap += itemDef.stats.ap;
                            if (itemDef.stats.armor) u.stats.armor += itemDef.stats.armor;
                            if (itemDef.stats.mr) u.stats.mr += itemDef.stats.mr;
                            if (itemDef.stats.critChance) u.combat.critChance = (u.combat.critChance || 0.10) + itemDef.stats.critChance;
                            if (itemDef.stats.vamp) u.combat.vamp = (u.combat.vamp || 0) + itemDef.stats.vamp;
                            if (itemDef.stats.dodge) u.combat.dodge = (u.combat.dodge || 0) + itemDef.stats.dodge;
                        }
                    }
                });
            }
        }
    }
    return cloned;
}

function runSimulation(playerBoardDef, enemyBoardDef) {
    const pBoard = applyItemsToStats(playerBoardDef);
    const eBoard = applyItemsToStats(enemyBoardDef);
    const engine = new BattleEngine(pBoard, eBoard);
    engine.run();

    let playerHpSum = 0, enemyHpSum = 0, pCount = 0, eCount = 0, pTotalMaxHp = 0, eTotalMaxHp = 0;
    engine.board.forEach(u => {
        if (u) {
            if (u.currHp > 0) {
                if (u.team === 'player') { playerHpSum += u.currHp; pCount++; }
                else if (u.team === 'enemy') { enemyHpSum += u.currHp; eCount++; }
            }
            if (u.team === 'player') pTotalMaxHp += u.stats.maxHp;
            else if (u.team === 'enemy') eTotalMaxHp += u.stats.maxHp;
        }
    });

    let winner = 'draw';
    if (pCount > 0 && eCount === 0) winner = 'player';
    else if (eCount > 0 && pCount === 0) winner = 'enemy';

    return {
        winner, pCount, eCount,
        playerHpPct: playerHpSum / Math.max(1, pTotalMaxHp),
        enemyHpPct: enemyHpSum / Math.max(1, eTotalMaxHp)
    };
}

// ── 타겟 덱 생성기 ──────────────────────────────────────────────
function getTargetSynergies() {
    const targets = [];
    if (SYNERGIES.subjects) {
        Object.entries(SYNERGIES.subjects).forEach(([syn, def]) => {
            Object.keys(def.levels).map(Number).sort((a,b)=>a-b).forEach(lv => targets.push({ name: syn, level: lv }));
        });
    }
    if (SYNERGIES.clubs) {
        Object.entries(SYNERGIES.clubs).forEach(([syn, def]) => {
            Object.keys(def.levels).map(Number).sort((a,b)=>a-b).forEach(lv => targets.push({ name: syn, level: lv }));
        });
    }
    return targets;
}

function generateTargetPlayerBoard(targetSyn) {
    const board = Array(24).fill(null);
    const slots = Array.from({ length: 24 }, (_, i) => i).sort(() => Math.random() - 0.5);
    
    // 타겟 시너지 유닛 필터링 및 섞기
    let matchingUnits = UNIT_POOL.filter(u => u.subject === targetSyn.name || u.club === targetSyn.name);
    matchingUnits.sort(() => Math.random() - 0.5);
    
    // 타겟 레벨만큼 고유 유닛 뽑기
    const requiredCount = targetSyn.level;
    const selectedUnits = matchingUnits.slice(0, requiredCount);
    
    // 남은 자리 스마트 유닛 채우기
    let remainingPool = UNIT_POOL.filter(u => !selectedUnits.find(su => su.id === u.id));
    
    const defensiveSynergies = ['보건부', '선도부', '체육', '도덕', '급식부'];
    const offensiveSynergies = ['국어', '수학', '영어', '과학', '방송부'];
    
    let prioritizedPool = [];
    let fallbackPool = [];
    
    if (defensiveSynergies.includes(targetSyn.name)) {
        prioritizedPool = remainingPool.filter(u => u.stats.range >= 2);
        fallbackPool = remainingPool.filter(u => u.stats.range < 2);
    } else if (offensiveSynergies.includes(targetSyn.name)) {
        prioritizedPool = remainingPool.filter(u => u.stats.range === 1);
        fallbackPool = remainingPool.filter(u => u.stats.range !== 1);
    } else {
        prioritizedPool = remainingPool;
    }
    
    prioritizedPool.sort(() => Math.random() - 0.5);
    fallbackPool.sort(() => Math.random() - 0.5);
    const smartPool = [...prioritizedPool, ...fallbackPool];
    
    const totalUnits = Math.max(requiredCount, 6 + Math.floor(Math.random() * 3)); // 6~8 마리
    const extraNeeded = totalUnits - selectedUnits.length;
    if (extraNeeded > 0) {
        selectedUnits.push(...smartPool.slice(0, extraNeeded));
    }
    
    for (let i = 0; i < selectedUnits.length; i++) {
        let base = selectedUnits[i];
        let star = Math.random() < 0.15 ? 3 : (Math.random() < 0.6 ? 2 : 1);
        if (base.tier === 5 && star === 3) star = 2; // [임시 밸런스 측정용] 5코 3성 금지
        let u = JSON.parse(JSON.stringify(base));
        u.star = star;
        if (star >= 2) { u.stats.hp = Math.round(u.stats.hp * 1.8); u.stats.ad = Math.round(u.stats.ad * 1.5); }
        if (star === 3) {
            u.stats.hp = Math.round(u.stats.hp * 1.8); u.stats.ad = Math.round(u.stats.ad * 1.5);
            if (u.tier <= 3) { u.stats.armor += Math.round(25 - (u.tier * 5)); u.stats.mr += Math.round(25 - (u.tier * 5)); u.stats.hp += Math.round(250 - (u.tier * 50)); }
        }
        u.stats.maxHp = u.stats.hp;
        u.items = []; // [노템전 설정] 모든 아이템 제거
        board[slots[i]] = u;
    }
    return board;
}

function getBoardCost(board) {
    let cost = 0;
    board.forEach(u => {
        if (u) {
            let copies = u.star === 3 ? 9 : (u.star === 2 ? 3 : 1);
            cost += u.tier * copies;
        }
    });
    return cost;
}

// ── 시너지 추출 ──────────────────────────────────────────────
function getSynergyCounts(board) {
    const counts = {};
    board.forEach(u => {
        if (!u) return;
        [u.subject, u.club].forEach(syn => {
            if (syn) counts[syn] = (counts[syn] || 0) + 1;
        });
    });
    return counts;
}

function getActiveSynergies(board) {
    const counts = getSynergyCounts(board);
    const active = [];

    // 과목 시너지 레벨 확인
    const subjectDefs = SYNERGIES?.subjects || {};
    const clubDefs = SYNERGIES?.clubs || {};

    Object.entries(counts).forEach(([syn, cnt]) => {
        let def = subjectDefs[syn] || clubDefs[syn];
        if (!def) return;

        const levels = Object.keys(def.levels || {}).map(Number).sort((a, b) => a - b);
        let activeLevel = 0;
        for (const lv of levels) {
            if (def.exactMatch) {
                if (cnt === lv) activeLevel = lv;
            } else {
                if (cnt >= lv) activeLevel = lv;
            }
        }
        if (activeLevel > 0) {
            active.push(`${syn}(${activeLevel})`);
        }
    });
    return active;
}

// ── 메인 시뮬레이션 ──────────────────────────────────────────
// 시너지 → { wins, total, ehpSum }
const synergyData = {};

// 시너지 레벨 조합 → 동일
const synLevelData = {};

const targets = getTargetSynergies();
console.log(`\n⏳ 시뮬레이션 진행 중... (총 ${targets.length}개 시너지 타겟, 덱 ${TEAMS_PER_TARGET}개씩)`);

targets.forEach((target, index) => {
    process.stdout.write(`[${index + 1}/${targets.length}] ${target.name}(${target.level}) `);
    
    for (let t = 0; t < TEAMS_PER_TARGET; t++) {
        const board = generateTargetPlayerBoard(target);
        const activeSyns = getActiveSynergies(board);
        const rawCounts = getSynergyCounts(board);

        let wins = 0;
        let ehpSum = 0;
        const boardCost = getBoardCost(board);

        for (let i = 0; i < ITERATIONS; i++) {
            const enemy = generateEnemyBoard(WORLD, ROUND);
            const res = runSimulation(board, enemy);
            if (res.winner === 'player') wins++;
            ehpSum += isNaN(res.playerHpPct) ? 0 : res.playerHpPct;
        }

        Object.entries(rawCounts).forEach(([syn, cnt]) => {
            if (!synergyData[syn]) synergyData[syn] = { wins: 0, total: 0, ehpSum: 0, appearances: 0, costSum: 0 };
            synergyData[syn].wins += wins;
            synergyData[syn].total += ITERATIONS;
            synergyData[syn].ehpSum += ehpSum;
            synergyData[syn].costSum += boardCost;
            synergyData[syn].appearances++;
        });

        activeSyns.forEach(syn => {
            if (!synLevelData[syn]) synLevelData[syn] = { wins: 0, total: 0, ehpSum: 0, appearances: 0, costSum: 0 };
            synLevelData[syn].wins += wins;
            synLevelData[syn].total += ITERATIONS;
            synLevelData[syn].ehpSum += ehpSum;
            synLevelData[syn].costSum += boardCost;
            synLevelData[syn].appearances++;
        });
    }
});

console.log('\n✅ 완료!\n');

// ── 리포트 출력 ──────────────────────────────────────────────
function printReport(title, data, label) {
    const sorted = Object.entries(data)
        .map(([name, s]) => {
            const winRate = s.total > 0 ? s.wins / s.total : 0;
            const avgCost = s.appearances > 0 ? s.costSum / s.appearances : 0;
            const efficiency = avgCost > 0 ? (winRate * 100) / avgCost : 0;
            return {
                name,
                winRate,
                avgEhp: s.total > 0 ? s.ehpSum / s.total : 0,
                appearances: s.appearances,
                avgCost,
                efficiency
            };
        })
        .sort((a, b) => b.winRate - a.winRate);

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📊 ${title}`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`  ${'순위'.padEnd(4)} | ${'시너지'.padEnd(12)} | ${'승률'.padEnd(7)} | ${'평균비용'.padEnd(6)} | ${'가성비'.padEnd(6)} | ${label}`);
    console.log(`  ${'-'.repeat(75)}`);

    const result = [];
    sorted.forEach((s, i) => {
        const bar = '█'.repeat(Math.round(s.winRate * 20)).padEnd(20, '░');
        const danger = s.winRate >= 0.70 ? ' 🚨OP!' : s.winRate >= 0.55 ? ' ⚠️강함' : s.winRate <= 0.35 ? ' 💀약함' : '';
        console.log(
            `  ${String(i + 1).padStart(2)}위 | ${s.name.padEnd(12)} | ` +
            `${(s.winRate * 100).toFixed(1).padStart(5)}% | ` +
            `${s.avgCost.toFixed(1).padStart(5)}G | ` +
            `${s.efficiency.toFixed(2).padStart(5)} | ` +
            `${String(s.appearances).padStart(3)}회${danger}`
        );
        result.push(s);
    });

    return result;
}

const rawSynergyResults = printReport(
    `[시너지 유닛 보유 기준 승률] (World ${WORLD}, Round ${ROUND} 적 기준)`,
    synergyData,
    '채용횟수'
);

const activeSynergyResults = printReport(
    `[시너지 발동 기준 승률] - 실제 발동 레벨 포함`,
    synLevelData,
    '발동횟수'
);

// ── CSV 저장 ──────────────────────────────────────────────────
import fs from 'fs';

if (!fs.existsSync('scratch')) fs.mkdirSync('scratch');

let csv1 = '순위,시너지,승률,EHP,평균비용,가성비,채용횟수\n';
rawSynergyResults.forEach((s, i) => {
    csv1 += `${i+1},${s.name},${(s.winRate*100).toFixed(1)}%,${(s.avgEhp*100).toFixed(1)}%,${s.avgCost.toFixed(1)},${s.efficiency.toFixed(2)},${s.appearances}\n`;
});
fs.writeFileSync('scratch/synergy_raw_winrate.csv', csv1, 'utf8');

let csv2 = '순위,시너지(레벨),승률,EHP,평균비용,가성비,발동횟수\n';
activeSynergyResults.forEach((s, i) => {
    csv2 += `${i+1},${s.name},${(s.winRate*100).toFixed(1)}%,${(s.avgEhp*100).toFixed(1)}%,${s.avgCost.toFixed(1)},${s.efficiency.toFixed(2)},${s.appearances}\n`;
});
fs.writeFileSync('scratch/synergy_active_winrate.csv', csv2, 'utf8');

// 마크다운 리포트 생성
let md = `# 📊 시너지 맞춤 타겟 시뮬레이션 보고서 (비용 및 가성비 추가)\n\n`;
md += `> [!NOTE]\n> - **적 설정:** World ${WORLD}, Round ${ROUND}\n> - **시뮬레이션 양:** 총 37개 시너지 타겟 × 타겟 당 ${TEAMS_PER_TARGET}덱 × ${ITERATIONS}회 전투 = **총 ${targets.length * TEAMS_PER_TARGET * ITERATIONS}회 전투**\n\n---\n\n`;
md += `## 📈 1. 시너지 유닛 보유 기준 승률\n\n| 순위 | 시너지 | 승률 | EHP | 채용횟수 |\n| :---: | :--- | :---: | :---: | :---: |\n`;
rawSynergyResults.forEach((s, i) => {
    md += `| ${i+1} | **${s.name}** | ${(s.winRate*100).toFixed(1)}% | ${(s.avgEhp*100).toFixed(1)}% | ${s.appearances}회 |\n`;
});
md += `\n---\n\n## 🔥 2. 시너지 발동 레벨 기준 승률 (핵심 지표)\n\n`;
md += `> [!IMPORTANT]\n> **판독 기준**\n> - 🚨 \`OP\` (70% 이상) : 즉각 너프 필요\n> - ⚠️ \`강함\` (55~70%) : 관찰 필요\n> - ✅ \`균형\` (40~55%) : 정상 범위\n> - 💀 \`약함\` (40% 미만) : 버프 검토\n\n`;
md += `| 순위 | 시너지(레벨) | 승률 | EHP | 발동횟수 | 판독 |\n| :---: | :--- | :---: | :---: | :---: | :---: |\n`;
activeSynergyResults.forEach((s, i) => {
    const danger = s.winRate >= 0.70 ? '🚨 OP!' : s.winRate >= 0.55 ? '⚠️ 강함' : s.winRate <= 0.40 ? '💀 약함' : '✅ 균형';
    md += `| ${i+1} | **${s.name}** | ${(s.winRate*100).toFixed(1)}% | ${(s.avgEhp*100).toFixed(1)}% | ${s.appearances}회 | ${danger} |\n`;
});
fs.writeFileSync('scratch/synergy_simulation_report.md', md, 'utf8');

console.log(`\n${'═'.repeat(58)}`);
console.log(`💾 결과 저장 완료:`);
console.log(`   📄 scratch/synergy_raw_winrate.csv    (시너지 유닛 보유 기준)`);
console.log(`   📄 scratch/synergy_active_winrate.csv (시너지 발동 레벨 기준)`);
console.log(`   📄 scratch/synergy_simulation_report.md (마크다운 보고서)`);
console.log(`\n📌 판독 기준 (World ${WORLD}, Round ${ROUND} 적 레벨 기준):`);
console.log(`   🚨 OP (70% 이상): 즉각 너프 필요`);
console.log(`   ⚠️  강함 (55~70%): 관찰 필요`);
console.log(`   ✅ 균형 (40~55%): 정상 범위`);
console.log(`   💀 약함 (40% 미만): 버프 검토\n`);
