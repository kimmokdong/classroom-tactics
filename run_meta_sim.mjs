import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from './js/data.js';
import { ITEMS } from './js/items.js';
import { BattleEngine } from './js/battleEngine.js';
import { SynergyManager } from './js/systems/SynergyManager.js';

// 설정
const ITERATIONS = 100;
const COUNTER_THRESHOLD = 0.60;

console.log(`\n⚔️ 메타 시뮬레이터 (Round Robin) 시작...`);
console.log(`- 대전 횟수: 매치업 당 ${ITERATIONS}회`);

// 1. 덱 불러오기
const decks = JSON.parse(fs.readFileSync('./js/meta_decks.json', 'utf-8'));
const N = decks.length;
console.log(`- 참여 덱 수: ${N}개\n`);

// mockApp for SynergyManager
const mockApp = {
    state: {
        globalBuffs: { teamHp:0, teamAdAp:0, teamDef:0, critChance:0, dmgAmp:0, vamp:0, startShield:0, tickHealPct:0, asMult:0, startMana:0, rangeBuff:0, distAmp:0 },
        hp: 100
    },
    ITEMS: ITEMS
};
const synManager = new SynergyManager(mockApp);

// 2. 덱 인스턴스화 함수 (2성, 노템)
function instantiateDeck(deckDef) {
    const board = Array(24).fill(null);
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
            
            board[uDef.gridIndex] = cloned;
        }
    }
    return board;
}

// 3. 승률 매트릭스 초기화
const matrix = Array.from({ length: N }, () => Array(N).fill(0));
const draws = Array.from({ length: N }, () => Array(N).fill(0));

// 4. 라운드 로빈 대전 실행
let matchCount = 0;
const totalMatches = (N * (N - 1)) / 2;

for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
        matchCount++;
        process.stdout.write(`\r진행률: ${matchCount}/${totalMatches} 매치업 시뮬레이션 중...`);
        
        let winsA = 0;
        let winsB = 0;
        let drawCount = 0;
        
        const rawBoardA = instantiateDeck(decks[i]);
        const synDataA = synManager.getSynergyData(rawBoardA);
        const buffedBoardA = synManager.applySynergyStats(rawBoardA, synDataA, false);

        const rawBoardB = instantiateDeck(decks[j]);
        const synDataB = synManager.getSynergyData(rawBoardB);
        const buffedBoardB = synManager.applySynergyStats(rawBoardB, synDataB, false);

        for (let k = 0; k < ITERATIONS; k++) {
            // HP 초기화를 위해 깊은 복사
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
console.log(`\n\n✅ 시뮬레이션 완료! 결과 분석 중...`);

// 5. 엔트로피 및 승률 계산
const deckStats = decks.map((d, i) => {
    let totalWins = 0;
    let totalMatchesForDeck = 0;
    for (let j = 0; j < N; j++) {
        if (i !== j) {
            totalWins += matrix[i][j];
            totalMatchesForDeck += (matrix[i][j] + matrix[j][i] + draws[i][j]);
        }
    }
    return {
        id: i,
        name: d.name,
        wins: totalWins,
        matches: totalMatchesForDeck,
        winrate: totalWins / totalMatchesForDeck
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

// 6. RPS 트라이앵글(가위바위보 상성) 계산
const triangles = [];
for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
        for (let k = 0; k < N; k++) {
            if (i !== j && j !== k && i !== k) {
                const wrIJ = matrix[i][j] / ITERATIONS;
                const wrJK = matrix[j][k] / ITERATIONS;
                const wrKI = matrix[k][i] / ITERATIONS;
                
                if (wrIJ >= COUNTER_THRESHOLD && wrJK >= COUNTER_THRESHOLD && wrKI >= COUNTER_THRESHOLD) {
                    // 중복 방지를 위해 인덱스 정렬 후 식별자로 추가
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

// 7. CSV 생성
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
fs.writeFileSync('./scratch/meta_winrate_matrix.csv', csv);

// 8. 마크다운 리포트 작성
deckStats.sort((a, b) => b.winrate - a.winrate);

let report = `# 메타게임 밸런싱 분석 리포트 (노템 2성 기준)\\n\\n`;
report += `## 🎲 메타 건강도 지표\\n`;
report += `- **참여 덱 수**: ${N}개\\n`;
report += `- **섀넌 엔트로피 (Shannon Entropy)**: **${normalizedEntropy.toFixed(2)}%** (100%에 가까울수록 덱들의 승률이 평등함)\\n`;
report += `- **상성 순환 고리 (RPS Triangles)**: **${triangles.length}개** 발견 (기준: 승률 ${COUNTER_THRESHOLD * 100}% 이상 카운터)\\n\\n`;

report += `## 🏆 덱 티어표 (전체 평균 승률)\\n`;
report += `| 순위 | 덱 아키타입 | 승률 | 총 승리 |\\n`;
report += `|---|---|---|---|\\n`;
deckStats.forEach((d, idx) => {
    let emoji = d.winrate >= 0.7 ? '🚨' : (d.winrate >= 0.6 ? '⚠️' : (d.winrate <= 0.3 ? '💀' : '✅'));
    report += `| ${idx+1} | ${d.name} | **${(d.winrate*100).toFixed(1)}%** ${emoji} | ${d.wins} |\\n`;
});

report += `\\n## ♻️ 상성 순환 예시 (Top 10)\\n`;
triangles.slice(0, 10).forEach(t => {
    report += `- ${decks[t.i].name} (승률 ${(t.wrIJ*100).toFixed(0)}%) ➡️ ${decks[t.j].name} (승률 ${(t.wrJK*100).toFixed(0)}%) ➡️ ${decks[t.k].name} (승률 ${(t.wrKI*100).toFixed(0)}%) ➡️ ${decks[t.i].name}\\n`;
});

fs.writeFileSync('./scratch/meta_report.md', report);
console.log(`✅ 결과가 scratch/meta_report.md 에 저장되었습니다!`);
