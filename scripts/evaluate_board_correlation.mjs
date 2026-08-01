import { evaluateBoard, pearsonCorrelation } from '../js/ai/BoardEvaluator.js';
import { BattleEngine, createSeededRandom } from '../js/battleEngine.js';
import { UNIT_POOL } from '../js/data.js';
import { ITEMS } from '../js/items.js';
import { getSynergyData, SynergyManager } from '../js/systems/SynergyManager.js';

function unit(id, star = 1, items = []) {
    const value = structuredClone(UNIT_POOL.find(candidate => candidate.id === id));
    value.star = star;
    value.items = items;
    if (star >= 2) { value.stats.hp = Math.round(value.stats.hp * 1.8); value.stats.ad = Math.round(value.stats.ad * 1.5); }
    if (star === 3) { value.stats.hp = Math.round(value.stats.hp * 1.8); value.stats.ad = Math.round(value.stats.ad * 1.5); }
    value.stats.maxHp = value.stats.hp;
    return value;
}

function board(entries) {
    const result = Array(24).fill(null);
    entries.forEach(([index, id, star = 1, items = []]) => { result[index] = unit(id, star, items); });
    return result;
}

function mirror(source) {
    const result = Array(24).fill(null);
    source.forEach((value, index) => { if (value) result[23 - index] = value; });
    return result;
}

const decks = [
    { name: '초반 균형', board: board([[0, 'u1_1'], [1, 'u1_10'], [16, 'u1_2'], [17, 'u1_8']]) },
    { name: '2성 저코스트', board: board([[0, 'u2_2', 2], [1, 'u2_10', 2], [16, 'u2_4', 2, ['comb_as_as']], [17, 'u2_7', 2, ['comb_mana_mr']]]) },
    { name: '고코스트 딜러 과잉', board: board([[0, 'u4_4'], [16, 'u4_2'], [17, 'u4_3'], [18, 'u5_1']]) },
    { name: '후반 균형', board: board([[0, 'u4_1', 2, ['comb_armor_mr']], [1, 'u4_9'], [16, 'u4_2', 2, ['comb_as_as']], [17, 'u4_6'], [18, 'u5_2']]) },
    { name: '도덕·방송 조합', board: board([[0, 'u4_9', 2, ['comb_hp_hp']], [1, 'u5_4'], [16, 'u4_2'], [17, 'u4_6'], [18, 'u3_8']]) }
];

const app = {
    ITEMS,
    state: {
        hp: 100,
        globalBuffs: { teamHp: 0, teamAdAp: 0, teamDef: 0, critChance: 0, dmgAmp: 0, vamp: 0, startShield: 0, tickHealPct: 0, asMult: 0, startMana: 0, rangeBuff: 0, distAmp: 0 }
    }
};
const synergyManager = new SynergyManager(app);

function prepare(source, seed) {
    return synergyManager.applySynergyStats(source, getSynergyData(source), true, createSeededRandom(seed));
}

function fight(player, enemy, seed) {
    const engine = new BattleEngine(prepare(player, `${seed}:p`), prepare(mirror(enemy), `${seed}:e`), [], 0, seed);
    const logs = engine.run();
    const end = logs.find(log => log.type === 'end');
    return {
        outcome: end.winner === 'player' ? 1 : end.winner === 'enemy' ? 0 : 0.5,
        survivors: (end.survivingPlayers || 0) + (end.survivingEnemies || 0),
        seconds: end.tick / 10,
        damage: logs.filter(log => log.type === 'attack' || log.type === 'damage').reduce((sum, log) => sum + (log.dmg || 0), 0)
    };
}

const rows = [];
for (let left = 0; left < decks.length; left++) {
    for (let right = left + 1; right < decks.length; right++) {
        const a = decks[left];
        const b = decks[right];
        const matches = [];
        for (let iteration = 0; iteration < 6; iteration++) {
            matches.push(fight(a.board, b.board, `${left}-${right}-${iteration}-ab`));
            const reversed = fight(b.board, a.board, `${left}-${right}-${iteration}-ba`);
            matches.push({ ...reversed, outcome: 1 - reversed.outcome });
        }
        const average = key => matches.reduce((sum, match) => sum + match[key], 0) / matches.length;
        const scoreA = evaluateBoard(a.board).score;
        const scoreB = evaluateBoard(b.board).score;
        rows.push({
            matchup: `${a.name} vs ${b.name}`,
            scoreDiff: Math.round((scoreA - scoreB) * 10) / 10,
            winRate: Math.round(average('outcome') * 1000) / 10,
            avgSurvivors: Math.round(average('survivors') * 100) / 100,
            avgSeconds: Math.round(average('seconds') * 100) / 100,
            avgDamage: Math.round(average('damage'))
        });
    }
}

console.table(decks.map(deck => {
    const evaluation = evaluateBoard(deck.board);
    return { board: deck.name, score: evaluation.score, ...evaluation.breakdown };
}));
console.table(rows);
const correlation = pearsonCorrelation(rows.map(row => [row.scoreDiff, row.winRate - 50]));
console.log(`평가 점수 차이↔실제 승률 상관계수: ${correlation.toFixed(3)}`);
if (correlation < 0.5) process.exitCode = 1;
