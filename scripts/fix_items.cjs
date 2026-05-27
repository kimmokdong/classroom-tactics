const fs = require('fs');
let code = fs.readFileSync('js/items.js', 'utf8');

const baseStats = {
    base_ad: {ad: 10},
    base_as: {as: 0.10},
    base_ap: {ap: 10},
    base_mana: {mana: 15},
    base_armor: {armor: 20},
    base_mr: {mr: 20},
    base_hp: {maxHp: 150},
    base_crit: {critChance: 0.10}
};

const regex = /type:\s*"combined",\s*recipe:\s*\["([^"]+)"\s*,\s*"([^"]+)"\]\s*,?\s*\n\s*stats:\s*\{[^}]*\}/g;

code = code.replace(regex, (match, r1, r2) => {
    let s1 = baseStats[r1];
    let s2 = baseStats[r2];
    
    let sum = {...s1};
    for(let k in s2) {
        sum[k] = (sum[k] || 0) + s2[k];
    }
    
    let statStr = Object.keys(sum).map(k => k + ': ' + (typeof sum[k] === 'number' && sum[k] % 1 !== 0 ? sum[k].toFixed(2) : sum[k])).join(', ');
    return `type: "combined", recipe: ["${r1}", "${r2}"],\n        stats: { ${statStr} }`;
});

fs.writeFileSync('js/items.js', code);
console.log('Successfully updated combined item stats based on ingredients.');
