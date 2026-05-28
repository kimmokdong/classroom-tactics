import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from './js/data.js';
import { ITEMS } from './js/items.js';
import { BattleEngine } from './js/battleEngine.js';
import { SynergyManager } from './js/systems/SynergyManager.js';

// 설정
const ITERATIONS = 100;
const COUNTER_THRESHOLD = 0.60;

console.log(`\n⚔️ 아이템 메타 시뮬레이터 (6-Core) 시작...`);
console.log(`- 대전 횟수: 매치업 당 ${ITERATIONS}회`);

// 1. 덱 불러오기
const decks = JSON.parse(fs.readFileSync('./js/meta_decks_lvl9.json', 'utf-8'));
const N = decks.length;

// 각 덱별 총 골드 밸류 미리 계산 (확률 가중 가성비 덱 비용 적용)
const SHOP_PROBS = { 8: [15, 20, 35, 25, 5], 9: [10, 15, 30, 30, 15] };
const BASE_RATE = 20; // 기준 확률 (2코 레벨8)

decks.forEach(d => {
    let totalGold = 0;
    d.units.forEach(uDef => {
        const baseUnit = UNIT_POOL.find(u => u.id === uDef.id);
        if (baseUnit) {
            const tierIdx = baseUnit.tier - 1;
            const rate = SHOP_PROBS[9][tierIdx];
            const weight = Math.sqrt(BASE_RATE / rate);
            totalGold += Math.round(baseUnit.tier * 3 * weight);
        }
    });
    d.goldValue = totalGold;
});

console.log(`- 참여 덱 수: ${N}개\n`);

const mockApp = {
    state: {
        globalBuffs: { teamHp:0, teamAdAp:0, teamDef:0, critChance:0, dmgAmp:0, vamp:0, startShield:0, tickHealPct:0, asMult:0, startMana:0, rangeBuff:0, distAmp:0 },
        hp: 100,
        inventory: Array(12).fill(null)
    },
    ITEMS: ITEMS
};
const synManager = new SynergyManager(mockApp);

// 역할군 및 BIS 아이템 정의
const BIS_ITEMS = {
    AP_CARRY: ['comb_ap_ap', 'comb_ap_crit', 'comb_mana_mana'],
    AD_CARRY: ['comb_ad_ad', 'comb_as_crit', 'comb_ad_mr'],
    AS_CARRY: ['comb_as_as', 'comb_ad_as', 'comb_ad_mr'],
    AD_CRIT: ['comb_ad_ad', 'comb_ad_crit', 'comb_as_crit'],
    TANK: ['comb_hp_hp', 'comb_armor_armor', 'comb_mr_mr']
};

function getHeuristicScores(u) {
    let tankScore = 0;
    let adScore = 0;
    let apScore = 0;
    
    // 탱커 점수
    tankScore += u.stats.hp / 100;
    if (u.stats.range <= 1) tankScore += 5;
    if (u.skill.type.includes('shield') || u.skill.type.includes('taunt') || u.skill.type.includes('heal') || u.skill.type.includes('cc')) {
        tankScore += 10;
    }
    
    // 물리 딜러 점수
    adScore += u.stats.ad / 10;
    if (u.skill.adRatio) adScore += 10;
    if (u.club === '육상부' || u.club === '장난꾸러기' || u.club === '방송부') adScore += 5;
    
    // 마법 딜러 점수
    apScore += (u.stats.ap || 100) / 20; // 기본 100이므로 5점
    if (u.skill.apRatio) apScore += 10;
    if (u.stats.range >= 2) apScore += 3;
    if (['국어', '과학', '미술', '음악', '영어'].includes(u.subject)) apScore += 5;
    
    return { tankScore, adScore, apScore };
}

// 2. 덱 인스턴스화 함수 (2성 + 스마트 6코어 아이템)
function instantiateDeckWithItems(deckDef) {
    const board = Array(24).fill(null);
    let unitsData = [];

    // 유닛 기본 생성 및 점수 계산
    for (let uDef of deckDef.units) {
        const baseUnit = UNIT_POOL.find(u => u.id === uDef.id);
        if (baseUnit && uDef.gridIndex >= 0 && uDef.gridIndex < 24) {
            const cloned = JSON.parse(JSON.stringify(baseUnit));
            cloned.stats.hp *= 1.8;
            cloned.stats.maxHp = cloned.stats.hp;
            cloned.currHp = cloned.stats.hp;
            cloned.stats.ad *= 1.5;
            
            cloned.currMana = cloned.stats.mana || 0;
            cloned.stats.maxMana = cloned.stats.maxMana || cloned.stats.mana || 0;
            cloned.currShield = 0;
            cloned.combat = { shield: 0, vamp: 0, dmgAmp: 0, critChance: 0.10, critDmg: 1.5, dmgReduc: 0, itemEffects: {} };
            cloned.items = [];
            cloned.gridIndex = uDef.gridIndex;
            
            const scores = getHeuristicScores(baseUnit);
            unitsData.push({ unit: cloned, tier: baseUnit.tier, scores, club: baseUnit.club, subject: baseUnit.subject });
        }
    }

    // 메인 탱커 선정
    unitsData.sort((a, b) => {
        const aScore = a.scores.tankScore + (a.tier * 10);
        const bScore = b.scores.tankScore + (b.tier * 10);
        return bScore - aScore;
    });
    const mainTank = unitsData[0];
    if (mainTank) {
        mainTank.unit.items = [...BIS_ITEMS.TANK];
        mainTank.isMainTank = true;
    }

    // 메인 캐리 선정
    const carryCandidates = unitsData.filter(u => !u.isMainTank);
    carryCandidates.sort((a, b) => {
        const aScore = Math.max(a.scores.adScore, a.scores.apScore) + (a.tier * 10);
        const bScore = Math.max(b.scores.adScore, b.scores.apScore) + (b.tier * 10);
        return bScore - aScore;
    });
    
    const mainCarry = carryCandidates[0];
    if (mainCarry) {
        if (mainCarry.scores.adScore > mainCarry.scores.apScore) {
            if (mainCarry.club === '육상부') mainCarry.unit.items = [...BIS_ITEMS.AS_CARRY];
            else if (mainCarry.subject === '수학') mainCarry.unit.items = [...BIS_ITEMS.AD_CRIT];
            else mainCarry.unit.items = [...BIS_ITEMS.AD_CARRY];
        } else {
            mainCarry.unit.items = [...BIS_ITEMS.AP_CARRY];
        }
    }

    unitsData.forEach(ud => {
        board[ud.unit.gridIndex] = ud.unit;
    });

    return board;
}

const matrix = Array.from({ length: N }, () => Array(N).fill(0));
const draws = Array.from({ length: N }, () => Array(N).fill(0));
let matchCount = 0;
const totalMatches = (N * (N - 1)) / 2;

for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
        matchCount++;
        process.stdout.write(`\r진행률: ${matchCount}/${totalMatches} 매치업 시뮬레이션 중...`);
        
        let winsA = 0;
        let winsB = 0;
        let drawCount = 0;
        
        const rawBoardA = instantiateDeckWithItems(decks[i]);
        const synDataA = synManager.getSynergyData(rawBoardA);
        const buffedBoardA = synManager.applySynergyStats(rawBoardA, synDataA, false);

        const rawBoardB = instantiateDeckWithItems(decks[j]);
        const synDataB = synManager.getSynergyData(rawBoardB);
        const buffedBoardB = synManager.applySynergyStats(rawBoardB, synDataB, false);

        for (let k = 0; k < ITERATIONS; k++) {
            const bA = JSON.parse(JSON.stringify(buffedBoardA));
            const bB = JSON.parse(JSON.stringify(buffedBoardB));
            
            const engine = new BattleEngine(bA, bB);
            engine.run();

            let pCount = 0;
            let eCount = 0;
            engine.board.forEach(u => {
                if (u && u.currHp > 0) {
                    if (u.team === 'player') pCount++;
                    else if (u.team === 'enemy') eCount++;
                }
            });

            if (pCount > 0 && eCount === 0) winsA++;
            else if (eCount > 0 && pCount === 0) winsB++;
            else drawCount++;
        }

        matrix[i][j] = winsA;
        matrix[j][i] = winsB;
        draws[i][j] = drawCount;
        draws[j][i] = drawCount;
    }
}
console.log(`\n\n✅ 아이템 시뮬레이션 완료! 결과 분석 중...`);

const deckStats = decks.map((d, i) => {
    let totalWins = 0;
    let totalMatchesForDeck = 0;
    for (let j = 0; j < N; j++) {
        if (i !== j) {
            totalWins += matrix[i][j];
            totalMatchesForDeck += (matrix[i][j] + matrix[j][i] + draws[i][j]);
        }
    }
    const winrate = totalWins / totalMatchesForDeck;
    const ewr = (d.goldValue - 70) * 1.14 + 30;
    const balanceScore = (winrate * 100) - ewr;

    return {
        id: i,
        name: d.name,
        gold: d.goldValue,
        wins: totalWins,
        matches: totalMatchesForDeck,
        winrate: winrate,
        ewr: ewr,
        balanceScore: balanceScore
    };
});

const totalSystemWins = deckStats.reduce((sum, d) => sum + d.wins, 0);
let entropy = 0;
deckStats.forEach(d => {
    if (d.wins > 0) {
        const p = d.wins / totalSystemWins;
        entropy -= p * Math.log2(p);
    }
});
const maxEntropy = Math.log2(N);
const normalizedEntropy = (entropy / maxEntropy) * 100;

const triangles = [];
for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
        for (let k = 0; k < N; k++) {
            if (i !== j && j !== k && i !== k) {
                const wrIJ = matrix[i][j] / ITERATIONS;
                const wrJK = matrix[j][k] / ITERATIONS;
                const wrKI = matrix[k][i] / ITERATIONS;
                
                if (wrIJ >= COUNTER_THRESHOLD && wrJK >= COUNTER_THRESHOLD && wrKI >= COUNTER_THRESHOLD) {
                    const sorted = [i, j, k].sort();
                    const key = sorted.join('-');
                    if (!triangles.find(t => t.key === key)) {
                        triangles.push({ key, i, j, k, wrIJ, wrJK, wrKI });
                    }
                }
            }
        }
    }
}

let csv = 'Deck,' + decks.map(d => d.name).join(',') + '\\n';
for (let i = 0; i < N; i++) {
    let row = [decks[i].name];
    for (let j = 0; j < N; j++) {
        if (i === j) row.push('-');
        else row.push((matrix[i][j] / ITERATIONS).toFixed(2));
    }
    csv += row.join(',') + '\\n';
}
fs.mkdirSync('./scratch', { recursive: true });
fs.writeFileSync('./scratch/meta_winrate_matrix_items_lvl9.csv', csv);

deckStats.sort((a, b) => b.winrate - a.winrate);

let maxBalance = -999;
let minBalance = 999;
const top25 = deckStats.slice(0, 25);
top25.forEach(d => {
    if (d.balanceScore > maxBalance) maxBalance = d.balanceScore;
    if (d.balanceScore < minBalance) minBalance = d.balanceScore;
});
const balanceGap = maxBalance - minBalance;

let report = `# 메타게임 밸런싱 분석 리포트 (9레벨 풀템 6코어 기준)\\n\\n`;
report += `## 🎲 메타 건강도 지표\\n`;
report += `- **참여 덱 수**: ${N}개\\n`;
report += `- **섀넌 엔트로피 (Shannon Entropy)**: **${normalizedEntropy.toFixed(2)}%**\\n`;
report += `- **상성 순환 고리 (RPS Triangles)**: **${triangles.length}개** 발견 (기준: 승률 ${COUNTER_THRESHOLD * 100}% 이상 카운터)\\n`;
report += `- **상위 25덱 최고-최저 가성비 편차 격차**: **${balanceGap.toFixed(1)}점** (목표: 50점 이하)\\n\\n`;

report += `## 🏆 풀템전 덱 티어표 (전체 평균 승률)\n`;
report += `| 순위 | 덱 아키타입 | 덱 밸류(G) | 기대 승률 | 실제 승률 | 가성비 점수 | 총 승리 |\n`;
report += `|---|---|---|---|---|---|---|\n`;
deckStats.forEach((d, idx) => {
    let emoji = d.winrate >= 0.7 ? '🚨' : (d.winrate >= 0.6 ? '⚠️' : (d.winrate <= 0.3 ? '💀' : '✅'));
    let balanceStr = d.balanceScore > 0 ? '+' + d.balanceScore.toFixed(1) : d.balanceScore.toFixed(1);
    report += `| ${idx+1} | ${d.name} | **${d.gold}G** | ${d.ewr.toFixed(1)}% | **${(d.winrate*100).toFixed(1)}%** ${emoji} | **${balanceStr}** | ${d.wins} |\n`;
});

report += `\\n## ♻️ 상성 순환 예시 (Top 10)\\n`;
triangles.slice(0, 10).forEach(t => {
    report += `- ${decks[t.i].name} (승률 ${(t.wrIJ*100).toFixed(0)}%) ➡️ ${decks[t.j].name} (승률 ${(t.wrJK*100).toFixed(0)}%) ➡️ ${decks[t.k].name} (승률 ${(t.wrKI*100).toFixed(0)}%) ➡️ ${decks[t.i].name}\\n`;
});

fs.writeFileSync('./scratch/meta_report_items_lvl9.md', report);
console.log(`✅ 결과가 scratch/meta_report_items_lvl9.md 에 저장되었습니다!`);
