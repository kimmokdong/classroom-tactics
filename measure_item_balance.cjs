const fs = require('fs');
const { ITEMS } = require('./js/items.js');

const BASE_AD = 50;
const BASE_AS = 0.7;
const BASE_AP = 100;
const BASE_HP = 800;
const BASE_ARMOR = 30;
const BASE_MR = 30;

let results = [];

ITEMS.filter(i => i.type === 'combined').forEach(item => {
    let type = 'Utility';
    
    // Evaluate Offensive Value (DPS)
    let ad = BASE_AD + (item.stats.ad || 0);
    let as = BASE_AS * (1 + (item.stats.as || 0));
    let ap = BASE_AP + (item.stats.ap || 0);
    let critChance = (item.stats.critChance || 0);
    let dmgAmp = 1;
    
    if (item.effect === 'deathblade') ad += 50; 
    if (item.effect === 'giantSlayer') dmgAmp = 1.15; // Avg 15% 
    if (item.effect === 'rabadon') { ap += 30; ap *= 1.2; }
    if (item.effect === 'guinsoo') as *= 1.25; 
    if (item.effect === 'skillCrit') { critChance = 1; dmgAmp = 1.1; }
    
    let dps = ad * as * (1 + critChance * 0.5) * dmgAmp;
    let spellPower = ap * dmgAmp;
    
    // Evaluate Defensive Value (EHP)
    let hp = BASE_HP + (item.stats.maxHp || 0);
    let armor = BASE_ARMOR + (item.stats.armor || 0);
    let mr = BASE_MR + (item.stats.mr || 0);
    
    if (item.effect === 'warmog') hp += 500;
    if (item.effect === 'bramble') armor += 40; 
    if (item.effect === 'gargoyle') { armor += 30; mr += 30; }
    if (item.effect === 'locket') hp += 250; 
    if (item.effect === 'steraks') { hp += 200; ad += 35; }
    
    let ehp_phys = hp * (1 + armor / 100);
    let ehp_mag = hp * (1 + mr / 100);
    let ehp = (ehp_phys + ehp_mag) / 2;
    
    if (dps > 40 || spellPower > 110) type = 'Offense';
    else if (ehp > 1200) type = 'Defense';
    
    results.push({ name: item.name, type, dps: dps.toFixed(1), spellPower: spellPower.toFixed(1), ehp: ehp.toFixed(0), effect: item.effect });
});

results.sort((a,b) => b.dps - a.dps);
console.log('--- OFFENSIVE ITEMS (Sort by Auto Attack DPS) ---');
results.filter(r => r.type === 'Offense').slice(0, 10).forEach(r => console.log(`${r.name}: DPS=${r.dps}, AP=${r.spellPower}, EHP=${r.ehp}`));

results.sort((a,b) => b.spellPower - a.spellPower);
console.log('\n--- OFFENSIVE ITEMS (Sort by Spell Power AP) ---');
results.filter(r => r.type === 'Offense').slice(0, 10).forEach(r => console.log(`${r.name}: AP=${r.spellPower}, DPS=${r.dps}, EHP=${r.ehp}`));

results.sort((a,b) => b.ehp - a.ehp);
console.log('\n--- DEFENSIVE ITEMS (Sort by EHP) ---');
results.filter(r => r.type === 'Defense').slice(0, 10).forEach(r => console.log(`${r.name}: EHP=${r.ehp}, DPS=${r.dps}`));
