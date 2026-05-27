const fs = require('fs');

// Patch main.js
let mainCode = fs.readFileSync('js/main.js', 'utf8');
mainCode = mainCode.replace(
    /if \(u\.combat\.itemEffects\.rabadon\) u\.stats\.ap \*= 1\.20;/g,
    'if (u.combat.itemEffects.rabadon) u.stats.ap += 50;'
);
mainCode = mainCode.replace(
    /if \(u\.combat\.itemEffects\.deathblade\) u\.stats\.ad \+= 20;/g,
    'if (u.combat.itemEffects.deathblade) u.stats.ad += 50;\n                if (u.combat.itemEffects.warmog) u.stats.maxHp += 500;'
);
fs.writeFileSync('js/main.js', mainCode, 'utf8');

// Patch sandbox.js
let sandboxCode = fs.readFileSync('js/sandbox.js', 'utf8');
sandboxCode = sandboxCode.replace(
    /if \(itemDef\.effect === 'rabadon'\) stats\.ap \*= 1\.20;/g,
    'if (itemDef.effect === \'rabadon\') stats.ap += 50;'
);
sandboxCode = sandboxCode.replace(
    /if \(itemDef\.effect === 'deathblade'\) stats\.ad \+= 20;/g,
    'if (itemDef.effect === \'deathblade\') stats.ad += 50;\n            if (itemDef.effect === \'warmog\') stats.maxHp += 500;'
);
fs.writeFileSync('js/sandbox.js', sandboxCode, 'utf8');

console.log('main.js and sandbox.js updated.');
