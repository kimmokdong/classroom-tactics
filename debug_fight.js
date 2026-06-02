import { BattleEngine } from './js/battleEngine.js';
import { UNIT_POOL as units, SYNERGIES as synergies } from './js/data.js';
import { SynergyManager } from './js/systems/SynergyManager.js';

const synergyManager = new SynergyManager(synergies, units);

// 1위 덱 (6L): 골목대장(2코3성), 진로진학 멘토(2코3성), 수학천재(2코2성), 바른생활 사나이(2코2성), 과학실험부장(2코2성), 칠판 낙서꾼(2코2성)
let deckA = [
    {id: 'u2_8', star: 3}, // 골목대장
    {id: 'u2_11', star: 3}, // 진로진학 멘토
    {id: 'u2_2', star: 2}, // 수학천재
    {id: 'u2_10', star: 2}, // 바른생활 사나이
    {id: 'u2_6', star: 2}, // 과학실험부장
    {id: 'u2_12', star: 2} // 칠판 낙서꾼
];

// 3위 덱 (9L): 외고 전학생(5코2성), 교장 선생님(5코2성), 수석 연구원(5코1성), 수석 연구원(5코1성), 기부 천사(5코1성), 피카소의 재림(5코2성), 나이팅게일(4코1성), 천재 피아니스트(4코1성), 육상부 에이스(3코2성)
let deckB = [
    {id: 'u5_1', star: 2}, // 외고 전학생
    {id: 'u5_2', star: 2}, // 교장 선생님
    {id: 'u5_3', star: 1}, // 수석 연구원
    {id: 'u5_3', star: 1}, // 수석 연구원
    {id: 'u5_4', star: 1}, // 기부 천사
    {id: 'u5_5', star: 2}, // 피카소
    {id: 'u4_1', star: 1}, // 나이팅게일
    {id: 'u4_4', star: 1}, // 천재 피아니스트
    {id: 'u3_5', star: 2} // 육상부 에이스
];

function populate(deck) {
    let populated = [];
    deck.forEach((u, idx) => {
        let baseUnit = units.find(x => x.id === u.id);
        if(!baseUnit) return;
        let clone = JSON.parse(JSON.stringify(baseUnit));
        clone.star = u.star;
        clone.idx = idx;
        for(let s=2; s<=clone.star; s++) {
            clone.stats.maxHp = Math.round(clone.stats.maxHp * 1.8);
            clone.stats.hp = clone.stats.maxHp;
            clone.stats.ad = Math.round(clone.stats.ad * 1.5);
            clone.stats.ap = Math.round(clone.stats.ap * 1.5);
        }
        clone.items = [];
        clone.currHp = clone.stats.maxHp;
        clone.combat = { damageDealt: 0, damageTaken: 0, healDone: 0 };
        populated.push(clone);
    });
    return populated;
}

const TANK_ITEMS = [{id:'i2', tier:1}, {id:'i5', tier:1}, {id:'i6', tier:1}]; // 방어, 체력, 마저
const AD_ITEMS = [{id:'i1', tier:1}, {id:'i4', tier:1}, {id:'i8', tier:1}]; // 공격, 치명, 공속
const AP_ITEMS = [{id:'i3', tier:1}, {id:'i7', tier:1}, {id:'i3', tier:1}]; // 주문, 마나

function distributeItems(deck) {
    let tank = deck.slice().filter(u => u.role.includes('tank')).sort((a,b)=>(b.tier+b.star*10)-(a.tier+a.star*10))[0];
    let dps = deck.slice().filter(u => u.role.includes('dealer')).sort((a,b)=>(b.tier+b.star*10)-(a.tier+a.star*10));
    let mainDps = dps[0];
    let subDps = dps[1];

    if (tank) deck.find(u=>u.idx===tank.idx).items = [...TANK_ITEMS];
    if (mainDps) deck.find(u=>u.idx===mainDps.idx).items = mainDps.position.includes('물리') ? [...AD_ITEMS] : [...AP_ITEMS];
    if (subDps) deck.find(u=>u.idx===subDps.idx).items = subDps.position.includes('물리') ? [...AD_ITEMS] : [...AP_ITEMS];
}

let boardA = populate(deckA); distributeItems(boardA);
let boardB = populate(deckB); distributeItems(boardB);

let dummyApp = { state: { globalBuffs: { teamHp: 0, teamAdAp: 0, teamDef: 0, critChance: 0, dmgAmp: 0, vamp: 0, startShield: 0, tickHealPct: 0, asMult: 0, startMana: 0, rangeBuff: 0, distAmp: 0 } }, ITEMS: [] };
synergyManager.app = dummyApp;
global.dummyApp = dummyApp;

let countsA = synergyManager.getSynergyData(boardA);
boardA = synergyManager.applySynergyStats(boardA, countsA, false);

let countsB = synergyManager.getSynergyData(boardB);
boardB = synergyManager.applySynergyStats(boardB, countsB, true);

let pBoard = Array(24).fill(null);
let eBoard = Array(24).fill(null);
function placeUnits(uArr, targetBoard, isEnemy) {
    const centerFirst = [3, 4, 2, 5, 1, 6, 0, 7];
    let frontIdx = 0; let midIdx = 0; let backIdx = 0;
    for (let u of uArr) {
        let range = u.stats.range || 1;
        let placed = false;
        if (range === 1) {
            if (frontIdx < 8) { targetBoard[(isEnemy?2:0)*8 + centerFirst[frontIdx++]] = u; placed=true; }
            else if (midIdx < 8) { targetBoard[8 + centerFirst[midIdx++]] = u; placed=true; }
        } else {
            if (backIdx < 8) { targetBoard[(isEnemy?0:2)*8 + centerFirst[backIdx++]] = u; placed=true; }
            else if (midIdx < 8) { targetBoard[8 + centerFirst[midIdx++]] = u; placed=true; }
        }
        if(!placed) {
            if(frontIdx<8) { targetBoard[(isEnemy?2:0)*8 + centerFirst[frontIdx++]] = u; }
            else if(midIdx<8) { targetBoard[8 + centerFirst[midIdx++]] = u; }
            else if(backIdx<8) { targetBoard[(isEnemy?0:2)*8 + centerFirst[backIdx++]] = u; }
        }
    }
}
placeUnits(boardA, pBoard, false);
placeUnits(boardB, eBoard, true);

global.dummyApp = { state: { board: boardA } };

let engine = new BattleEngine(pBoard, eBoard, []);
engine.run();

console.log("=== BATTLE RESULT ===");
let aAlive = engine.board.filter(u => u && u.team === 'player' && u.currHp > 0).length;
let bAlive = engine.board.filter(u => u && u.team === 'enemy' && u.currHp > 0).length;
console.log(`6L Deck Alive: ${aAlive}, 9L Deck Alive: ${bAlive}`);

console.log("\n=== 6L Deck Damage / Stats ===");
engine.board.filter(u => u && u.team === 'player').forEach(u => {
    console.log(`${u.name}(${u.star}성): HP ${Math.round(u.currHp)}/${Math.round(u.stats.maxHp)}, AD: ${Math.round(u.stats.ad)}, AP: ${Math.round(u.stats.ap)}, Armor: ${Math.round(u.stats.armor)}, MR: ${Math.round(u.stats.mr)}, Dmg: ${Math.round(u.combat.damageDealt)}, Taken: ${Math.round(u.combat.damageTaken)}`);
});

console.log("\n=== 9L Deck Damage / Stats ===");
engine.board.filter(u => u && u.team === 'enemy').forEach(u => {
    console.log(`${u.name}(${u.star}성): HP ${Math.round(u.currHp)}/${Math.round(u.stats.maxHp)}, AD: ${Math.round(u.stats.ad)}, AP: ${Math.round(u.stats.ap)}, Armor: ${Math.round(u.stats.armor)}, MR: ${Math.round(u.stats.mr)}, Dmg: ${Math.round(u.combat.damageDealt)}, Taken: ${Math.round(u.combat.damageTaken)}`);
});
