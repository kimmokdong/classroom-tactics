import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from '../js/data.js';
import { ITEMS } from '../js/items.js';
import { BattleEngine } from '../js/battleEngine.js';
import { generateEnemyBoard } from '../js/enemyAi.js';

const DECKS = [
  '미술4_장난4', '과학4_장난4', '사회4_방송부3', '음악4_급식부5',
  '국어4_육상부4', '장난꾸러기6_미술2', '사회4_보건부4', '체육4_선도부4',
  '육상부6_체육2', '체육4_보건부4', '영어4_급식부5', '수학4_선도부4',
  '선도부6_체육2', '도덕6_보건부2', '선도부6_수학2', '도덕6_급식부3',
  '음악4_도덕4', '급식부7', '국어2_방송부5', '미술4_선도부4',
  '영어4_방송부3', '육상부6_과학2', '과학4_육상부4'
];

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
    let pCount = 0, eCount = 0;
    engine.board.forEach(u => {
        if (u && u.currHp > 0) {
            if (u.team === 'player') pCount++;
            else if (u.team === 'enemy') eCount++;
        }
    });
    return { winner: pCount > 0 && eCount === 0 ? 'player' : (eCount > 0 && pCount === 0 ? 'enemy' : 'draw') };
}

function parseDeckName(deckName) {
    const reqs = {};
    const parts = deckName.replace('꾸러기', '').split('_'); // handle 장난꾸러기 -> 장난6 등.. Wait, it's '장난꾸러기6' in list, '장난4' in '미술4_장난4'
    // Actually, DECKS string exact parsing:
    // '미술4_장난4'
    const nameMap = { '장난': '장난꾸러기' };
    
    parts.forEach(part => {
        const match = part.match(/^([가-힣]+)(\d+)$/);
        if (match) {
            let name = match[1];
            if (nameMap[name]) name = nameMap[name];
            reqs[name] = parseInt(match[2]);
        }
    });
    return reqs;
}

function generateDeckBoard(reqs, maxUnits) {
    let selectedUnits = [];
    let attempts = 0;
    
    // Naive generation:
    // Gather all units that provide at least one required synergy
    const relevantPool = UNIT_POOL.filter(u => Object.keys(reqs).includes(u.subject) || Object.keys(reqs).includes(u.club));
    
    while(attempts < 1000) {
        attempts++;
        selectedUnits = [];
        const pool = [...relevantPool].sort(() => Math.random() - 0.5);
        const currentCounts = {};
        
        for (const u of pool) {
            if (selectedUnits.length >= maxUnits) break;
            
            // Check if adding this unit helps satisfy requirements
            let helps = false;
            for (const [syn, reqCount] of Object.entries(reqs)) {
                if ((u.subject === syn || u.club === syn) && (currentCounts[syn] || 0) < reqCount) {
                    helps = true;
                    break;
                }
            }
            
            if (helps) {
                selectedUnits.push(u);
                currentCounts[u.subject] = (currentCounts[u.subject] || 0) + 1;
                currentCounts[u.club] = (currentCounts[u.club] || 0) + 1;
            }
        }
        
        // Fill remaining with random high-tier units if needed
        let allMet = true;
        for (const [syn, reqCount] of Object.entries(reqs)) {
            if ((currentCounts[syn] || 0) < reqCount) {
                allMet = false;
                break;
            }
        }
        
        if (allMet) {
            while (selectedUnits.length < maxUnits) {
                const randomUnit = UNIT_POOL[Math.floor(Math.random() * UNIT_POOL.length)];
                if (!selectedUnits.find(su => su.id === randomUnit.id)) {
                    selectedUnits.push(randomUnit);
                }
            }
            break;
        }
    }
    
    if (selectedUnits.length !== maxUnits) {
        // Fallback or skip if impossible
        return null; 
    }
    
    const board = Array(24).fill(null);
    const slots = Array.from({ length: 24 }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (let i = 0; i < selectedUnits.length; i++) {
        let base = selectedUnits[i];
        let star = Math.random() < 0.15 ? 3 : (Math.random() < 0.6 ? 2 : 1);
        let u = JSON.parse(JSON.stringify(base));
        u.star = star;
        if (star >= 2) { u.stats.hp = Math.round(u.stats.hp * 1.8); u.stats.ad = Math.round(u.stats.ad * 1.5); u.stats.ap = Math.round(u.stats.ap * 1.5); }
        if (star === 3) {
            u.stats.hp = Math.round(u.stats.hp * 1.8); u.stats.ad = Math.round(u.stats.ad * 1.5); u.stats.ap = Math.round(u.stats.ap * 1.5);
            if (u.tier <= 3) { u.stats.armor += Math.round(50 - (u.tier * 10)); u.stats.mr += Math.round(50 - (u.tier * 10)); }
        }
        u.stats.maxHp = u.stats.hp;
        u.items = [];
        const numItems = Math.floor(Math.random() * 3);
        for (let j = 0; j < numItems; j++) {
            u.items.push(ITEMS.filter(it => it.type === 'combined')[Math.floor(Math.random() * 36)].id);
        }
        board[slots[i]] = u;
    }
    return board;
}

const RESULTS_8 = {};
const RESULTS_9 = {};

const ITERATIONS = 300;

console.log("Simulating Lvl 8...");
for (const deck of DECKS) {
    const reqs = parseDeckName(deck);
    let wins = 0;
    let valid = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        const pBoard = generateDeckBoard(reqs, 8);
        if (!pBoard) continue;
        const eBoard = generateEnemyBoard(4, 3); // Lvl 8 enemy
        if (runSimulation(pBoard, eBoard).winner === 'player') wins++;
        valid++;
    }
    RESULTS_8[deck] = valid > 0 ? (wins / valid) * 100 : 0;
    console.log(`Lvl 8 [${deck}]: ${RESULTS_8[deck].toFixed(1)}%`);
}

console.log("\nSimulating Lvl 9...");
for (const deck of DECKS) {
    const reqs = parseDeckName(deck);
    let wins = 0;
    let valid = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        const pBoard = generateDeckBoard(reqs, 9);
        if (!pBoard) continue;
        const eBoard = generateEnemyBoard(5, 3); // Lvl 9 enemy (World 5 if exists, else 4)
        if (runSimulation(pBoard, eBoard).winner === 'player') wins++;
        valid++;
    }
    RESULTS_9[deck] = valid > 0 ? (wins / valid) * 100 : 0;
    console.log(`Lvl 9 [${deck}]: ${RESULTS_9[deck].toFixed(1)}%`);
}

const avg8 = Object.values(RESULTS_8).reduce((a,b)=>a+b,0) / DECKS.length;
const avg9 = Object.values(RESULTS_9).reduce((a,b)=>a+b,0) / DECKS.length;

let finalData = DECKS.map(deck => {
    const win8 = RESULTS_8[deck];
    const win9 = RESULTS_9[deck];
    const ce8 = win8 - avg8;
    const ce9 = win9 - avg9;
    const ceSum = ce8 + ce9;
    return { deck, win8, win9, ce8, ce9, ceSum };
});

// Rank by win8, rank by win9
finalData.sort((a,b) => b.win8 - a.win8);
finalData.forEach((d, i) => d.rank8 = i + 1);

finalData.sort((a,b) => b.win9 - a.win9);
finalData.forEach((d, i) => d.rank9 = i + 1);

// Filter by rank sum <= 40
finalData = finalData.filter(d => (d.rank8 + d.rank9) <= 40);

// Sort by CE sum desc
finalData.sort((a,b) => b.ceSum - a.ceSum);

// Output to JSON
fs.writeFileSync('scratch/balance_report.json', JSON.stringify({
    avg8, avg9, data: finalData
}, null, 2));

console.log("\nTop decks saved to scratch/balance_report.json");
