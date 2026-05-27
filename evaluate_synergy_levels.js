import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from './js/data.js';
import { runSimulation } from './simulate_balance.js';
import { generateEnemyBoard } from './js/enemyAi.js';

const MATCHES = 50;

function buildSynergyTierBoard(synergyName, requiredCount) {
    const board = Array(24).fill(null);
    const slots = Array.from({ length: 24 }, (_, i) => i).sort(() => Math.random() - 0.5);

    // 이 시너지를 가진 유닛 전체 풀 추출
    let pool = UNIT_POOL.filter(u => u.subject === synergyName || u.club === synergyName);
    pool = pool.sort(() => Math.random() - 0.5); // 랜덤 섞기

    // 중복 없는 유닛 요구치만큼 배치
    let coreUnits = pool.slice(0, requiredCount);

    // 만약 유닉 유닛 수가 부족하면 사실 불가능한 조합이므로 부족한 대로 리턴(실제론 다 채워져 있음)
    // 나머지 자리를 시너지를 방해하지 않는 고코스트 랜덤 유닛으로 채움 (우연히 시너지 티어가 오르지 않게!)
    let fillers = UNIT_POOL.filter(u => u.tier >= 4 && u.subject !== synergyName && u.club !== synergyName).sort(() => Math.random() - 0.5);

    let boardUnits = [...coreUnits];
    let i = 0;
    while (boardUnits.length < 8 && i < fillers.length) {
        if (!boardUnits.find(u => u.id === fillers[i].id)) {
            boardUnits.push(fillers[i]);
        }
        i++;
    }

    boardUnits.forEach((base, idx) => {
        let u = JSON.parse(JSON.stringify(base));
        u.star = 2; // 고정 2성 벤치마크
        u.stats.hp = Math.round(u.stats.hp * 1.8);
        u.stats.ad = Math.round(u.stats.ad * 1.5);
        u.stats.ap = Math.round(u.stats.ap * 1.5);
        u.stats.maxHp = u.stats.hp;
        u.items = [];
        board[slots[idx]] = u;
    });

    return board;
}

const results = [];
console.log("🔥 모든 시너지 티어별 격차 분석 시뮬레이션 시작...");

// 1. 주과목(Subjects) 시뮬레이션
for (const synKey of Object.keys(SYNERGIES.subjects)) {
    const synData = SYNERGIES.subjects[synKey];
    const levels = Object.keys(synData.levels).map(k => parseInt(k));

    for (const level of levels) {
        let wins = 0;
        let totalEhp = 0;
        for (let i = 0; i < MATCHES; i++) {
            const playerBoard = buildSynergyTierBoard(synKey, level);
            const enemyBoard = generateEnemyBoard(4, 5); // World 4 수준의 보스 (레벨 8 예산)
            enemyBoard.forEach(u => { if (u) u.team = 'enemy'; });
            playerBoard.forEach(u => { if (u) u.team = 'player'; });

            const res = runSimulation(playerBoard, enemyBoard);
            if (res.winner === 'player') wins++;
            totalEhp += isNaN(res.playerHpPct) ? 0 : res.playerHpPct;
        }
        let winRate = (wins / MATCHES * 100).toFixed(1);
        let ehp = (totalEhp / MATCHES * 100).toFixed(1);
        results.push({ name: `${synKey} (${level})`, type: '과목', winRate, ehp });
        console.log(`[${synKey} (${level})] 완료`);
    }
}

// 2. 동아리(Clubs) 시뮬레이션
for (const synKey of Object.keys(SYNERGIES.clubs)) {
    const synData = SYNERGIES.clubs[synKey];
    const levels = Object.keys(synData.levels).map(k => parseInt(k));

    for (const level of levels) {
        let wins = 0;
        let totalEhp = 0;
        for (let i = 0; i < MATCHES; i++) {
            const playerBoard = buildSynergyTierBoard(synKey, level);
            const enemyBoard = generateEnemyBoard(4, 5);
            enemyBoard.forEach(u => { if (u) u.team = 'enemy'; });
            playerBoard.forEach(u => { if (u) u.team = 'player'; });

            const res = runSimulation(playerBoard, enemyBoard);
            if (res.winner === 'player') wins++;
            totalEhp += isNaN(res.playerHpPct) ? 0 : res.playerHpPct;
        }
        let winRate = (wins / MATCHES * 100).toFixed(1);
        let ehp = (totalEhp / MATCHES * 100).toFixed(1);
        results.push({ name: `${synKey} (${level})`, type: '동아리', winRate, ehp });
        console.log(`[${synKey} (${level})] 완료`);
    }
}

// 결과 정렬 및 파일 저장
results.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));
fs.writeFileSync('scratch/synergy_tier_results.json', JSON.stringify(results, null, 2));

console.log("✅ 시뮬레이션 완료! (scratch/synergy_tier_results.json에 저장됨)");
