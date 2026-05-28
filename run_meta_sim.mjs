import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from './js/data.js';
import { ITEMS } from './js/items.js';
import { BattleEngine } from './js/battleEngine.js';
import { SynergyManager } from './js/systems/SynergyManager.js';

// 설정
const ITERATIONS = 10000;
const COUNTER_THRESHOLD = 0.60;

console.log(`\n⚔️ 통합 메타 시뮬레이터 (8L & 9L / 6-Core) 시작...`);
console.log(`- 대전 횟수: 매치업 당 ${ITERATIONS}회\n`);

// 덱 불러오기
const decks8 = JSON.parse(fs.readFileSync('./js/meta_decks.json', 'utf-8'));
const decks9 = JSON.parse(fs.readFileSync('./js/meta_decks_lvl9.json', 'utf-8'));

// 공통 로직
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
    tankScore += u.stats.hp / 100;
    if (u.stats.range <= 1) tankScore += 5;
    if (u.skill.type.includes('shield') || u.skill.type.includes('taunt') || u.skill.type.includes('heal') || u.skill.type.includes('cc')) tankScore += 10;
    
    adScore += u.stats.ad / 10;
    if (u.skill.adRatio) adScore += 10;
    if (u.club === '육상부' || u.club === '장난꾸러기' || u.club === '방송부') adScore += 5;
    
    apScore += (u.stats.ap || 100) / 20; 
    if (u.skill.apRatio) apScore += 10;
    if (u.stats.range >= 2) apScore += 3;
    if (['국어', '과학', '미술', '음악', '영어'].includes(u.subject)) apScore += 5;
    
    return { tankScore, adScore, apScore };
}

function instantiateDeckWithItems(deckDef) {
    const board = Array(24).fill(null);
    let unitsData = [];

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

    unitsData.sort((a, b) => (b.scores.tankScore + b.tier * 10) - (a.scores.tankScore + a.tier * 10));
    const mainTank = unitsData[0];
    if (mainTank) {
        mainTank.unit.items = [...BIS_ITEMS.TANK];
        mainTank.isMainTank = true;
    }

    const carryCandidates = unitsData.filter(u => !u.isMainTank);
    carryCandidates.sort((a, b) => (Math.max(b.scores.adScore, b.scores.apScore) + b.tier * 10) - (Math.max(a.scores.adScore, a.scores.apScore) + a.tier * 10));
    
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

    unitsData.forEach(ud => { board[ud.unit.gridIndex] = ud.unit; });
    return board;
}

const SHOP_PROBS = { 8: [15, 20, 35, 25, 5], 9: [10, 15, 30, 30, 15] };
const BASE_RATE = 20;

function calcDeckGold(d, level) {
    let totalGold = 0;
    d.units.forEach(uDef => {
        const baseUnit = UNIT_POOL.find(u => u.id === uDef.id);
        if (baseUnit) {
            const tierIdx = baseUnit.tier - 1;
            const rate = SHOP_PROBS[level][tierIdx];
            const weight = Math.sqrt(BASE_RATE / rate);
            totalGold += Math.round(baseUnit.tier * 3 * weight);
        }
    });
    return totalGold;
}

function runSimForLevel(decks, level) {
    const N = decks.length;
    console.log(`[Level ${level}] 시뮬레이션 시작... (총 ${N}개 덱)`);
    decks.forEach(d => { d.goldValue = calcDeckGold(d, level); });
    
    const matrix = Array.from({ length: N }, () => Array(N).fill(0));
    const draws = Array.from({ length: N }, () => Array(N).fill(0));
    let matchCount = 0;
    const totalMatches = (N * (N - 1)) / 2;

    for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
            matchCount++;
            if (matchCount % 10 === 0 || matchCount === totalMatches) {
                process.stdout.write(`\r진행률: ${matchCount}/${totalMatches} `);
            }
            let winsA = 0, winsB = 0, drawCount = 0;
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

                let pCount = 0, eCount = 0;
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
    console.log(`\n[Level ${level}] 완료.\n`);
    
    const stats = decks.map((d, i) => {
        let totalWins = 0, totalMatchesForDeck = 0;
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
            name: d.name,
            gold: d.goldValue,
            winrate: winrate,
            balanceScore: balanceScore
        };
    });
    return stats;
}

const stats8 = runSimForLevel(decks8, 8);
const stats9 = runSimForLevel(decks9, 9);

console.log(`✅ 병합 및 결과 분석 중...`);
// 1. 순위 매기기
stats8.sort((a, b) => b.balanceScore - a.balanceScore);
stats9.sort((a, b) => b.balanceScore - a.balanceScore);

stats8.forEach((s, idx) => s.rank = idx + 1);
stats9.forEach((s, idx) => s.rank = idx + 1);

// 2. 통합 맵 생성
const combined = new Map();
stats8.forEach(s => {
    combined.set(s.name, {
        name: s.name,
        val8: s.gold, wr8: s.winrate, bal8: s.balanceScore, rank8: s.rank,
        val9: 0, wr9: 0, bal9: 0, rank9: 0
    });
});
stats9.forEach(s => {
    if (combined.has(s.name)) {
        const c = combined.get(s.name);
        c.val9 = s.gold; c.wr9 = s.winrate; c.bal9 = s.balanceScore; c.rank9 = s.rank;
    } else {
        combined.set(s.name, {
            name: s.name,
            val8: 0, wr8: 0, bal8: 0, rank8: 0,
            val9: s.gold, wr9: s.winrate, bal9: s.balanceScore, rank9: s.rank
        });
    }
});

const results = Array.from(combined.values());
results.forEach(r => {
    r.wrSum = r.wr8 + r.wr9;
    r.balSum = r.bal8 + r.bal9;
});

// 가성비합 기준 통합 순위
results.sort((a, b) => b.balSum - a.balSum);

let csv = '\\uFEFF8L순위,9L순위,순위변동,덱 아키타입,8L 밸류,8L 승률,8L 가성비,9L 밸류,9L 승률,9L 가성비,8L+9L 승률합,8L+9L 가성비합,가성비 통합순위\n';
results.forEach((r, idx) => {
    const totalRank = idx + 1;
    let rankDiffStr = ' 00';
    if (r.rank8 && r.rank9) {
        const diff = r.rank8 - r.rank9; // 양수면 상승(ex: 8위->3위 => +5)
        if (diff > 0) rankDiffStr = `+${diff.toString().padStart(2, '0')}`;
        else if (diff < 0) rankDiffStr = `-${Math.abs(diff).toString().padStart(2, '0')}`;
    }
    const bal8Str = r.bal8 > 0 ? `+${r.bal8.toFixed(1)}` : r.bal8.toFixed(1);
    const bal9Str = r.bal9 > 0 ? `+${r.bal9.toFixed(1)}` : r.bal9.toFixed(1);
    const balSumStr = r.balSum > 0 ? `+${r.balSum.toFixed(1)}` : r.balSum.toFixed(1);
    
    csv += `${r.rank8 || '-'},${r.rank9 || '-'},${rankDiffStr},${r.name},${r.val8}G,${(r.wr8*100).toFixed(1)}%,${bal8Str},${r.val9}G,${(r.wr9*100).toFixed(1)}%,${bal9Str},${(r.wrSum*100).toFixed(1)}%,${balSumStr},${totalRank}위\n`;
});

fs.mkdirSync('./scratch', { recursive: true });
fs.writeFileSync('./scratch/master_tier_list.csv', csv, 'utf-8');
console.log(`🎉 모든 작업 완료! 결과가 scratch/master_tier_list.csv 에 저장되었습니다!`);
