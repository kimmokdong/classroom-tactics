import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from './js/data.js';
import { runSimulation } from './simulate_balance.js';
import { generateEnemyBoard } from './js/enemyAi.js';

const MATCHES = 50;

function buildSynergyBoard(synergyName) {
    const board = Array(24).fill(null);
    const slots = Array.from({ length: 24 }, (_, i) => i).sort(() => Math.random() - 0.5);

    const coreUnits = UNIT_POOL.filter(u => u.subject === synergyName);

    const fillers = UNIT_POOL.filter(u => u.tier >= 4).sort(() => Math.random() - 0.5);

    let boardUnits = [...coreUnits];
    let i = 0;
    // Fill up to 8 units exactly
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

const subjects = Object.keys(SYNERGIES.subjects);
const results = [];

console.log("주과목(Subject) 시너지 밸런스 벤치마크 진행 중...");
for (let syn of subjects) {
    let wins = 0;
    let totalEhp = 0;
    for (let i = 0; i < MATCHES; i++) {
        const playerBoard = buildSynergyBoard(syn);
        const enemyBoard = generateEnemyBoard(4, 5); // 밸런스 비교를 위해 8렙 구간인 World 4로 하향
        enemyBoard.forEach(u => { if (u) u.team = 'enemy'; });
        playerBoard.forEach(u => { if (u) u.team = 'player'; });

        const res = runSimulation(playerBoard, enemyBoard);
        if (res.winner === 'player') wins++;
        totalEhp += isNaN(res.playerHpPct) ? 0 : res.playerHpPct;
    }

    results.push({
        synergy: syn,
        winRate: (wins / MATCHES * 100).toFixed(1),
        ehp: (totalEhp / MATCHES * 100).toFixed(1)
    });
    console.log(`[${syn}] 승률: ${results[results.length - 1].winRate}%`);
}

results.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));
fs.writeFileSync('scratch/synergy_eval_results.json', JSON.stringify(results, null, 2));
console.log("완료!");
