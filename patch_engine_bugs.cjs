const fs = require('fs');

let code = fs.readFileSync('js/battleEngine.js', 'utf8');

// 1. dmgReduc25 fix in damage calculation
code = code.replace(
    /let dr = target\.combat\?\.dmgReduc \|\| 0;\s*let armor = target\.stats\.armor;/g,
    `let dr = target.combat?.dmgReduc || 0;\n                if (target.buffs.some(b => b.type === 'dmgReduc25')) dr += 0.25;\n                let armor = target.stats.armor;`
);

code = code.replace(
    /let dr = target\.combat\.dmgReduc \|\| 0;\s*if \(target\.combat\.isWatcher/g,
    `let dr = target.combat.dmgReduc || 0;\n                    if (target.buffs.some(b => b.type === 'dmgReduc25')) dr += 0.25;\n                    if (target.combat.isWatcher`
);

// 2. Protector's Vow range 3 -> 1
code = code.replace(
    /if \(u\.team === target\.team && this\.getDist\(target\.gridIndex, u\.gridIndex\) <= 3\) {/g,
    'if (u.team === target.team && this.getDist(target.gridIndex, u.gridIndex) <= 1) {'
);

// 3. Zzrot (dog taunt) range 3 -> 2
code = code.replace(
    /if \(this\.getDist\(dog\.gridIndex, e\.gridIndex\) <= 3\) {/g,
    'if (this.getDist(dog.gridIndex, e.gridIndex) <= 2) {'
);

fs.writeFileSync('js/battleEngine.js', code, 'utf8');
console.log('battleEngine.js patched with bug fixes.');
