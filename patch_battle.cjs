const fs = require('fs');

let code = fs.readFileSync('js/battleEngine.js', 'utf8');

// 1. Dclaw remove old
code = code.replace(
    /            if \(target\.combat\.itemEffects\?\.dclaw && type === 'magic'\) \{\s*target\.currHp = Math\.min\(target\.stats\.maxHp, target\.currHp \+ target\.stats\.maxHp \* 0\.02\);\s*\}\s*/,
    ''
);

// 2. Dclaw add 20-tick loop
const tickLoopMatch = code.match(/if \(this\.tick % 50 === 0\) \{/);
if (tickLoopMatch) {
    const insertDclaw = `
                if (this.tick % 20 === 0) {
                    activeUnits.forEach(u => {
                        if (u.currHp <= 0) return;
                        if (u.combat.itemEffects?.dclaw) {
                            u.currHp = Math.min(u.stats.maxHp, u.currHp + u.stats.maxHp * 0.05);
                        }
                    });
                }
                if (this.tick % 50 === 0) {`;
    code = code.replace(/if \(this\.tick % 50 === 0\) \{/, insertDclaw);
}

// 3. Steraks
code = code.replace(
    /target\.stats\.ad \*= 1\.35;/g,
    'target.stats.ad += 25;'
);

// 4. Titans (unit and target)
code = code.replace(
    /if \(unit\.combat\.itemEffects\?\.titans && \(unit\.combat\.titansStack\|\|0\) < 25\) \{\s*unit\.combat\.titansStack = \(unit\.combat\.titansStack\|\|0\) \+ 1;\s*unit\.stats\.ad \*= 1\.02;\s*unit\.stats\.ap \*= 1\.02;\s*\}/,
    `if (unit.combat.itemEffects?.titans && (unit.combat.titansStack||0) < 25) {
                        unit.combat.titansStack = (unit.combat.titansStack||0) + 1;
                        unit.stats.ad += 2;
                        unit.stats.ap += 2;
                        if (unit.combat.titansStack === 25) {
                            unit.stats.armor += 20;
                            unit.stats.mr += 20;
                        }
                    }`
);
code = code.replace(
    /if \(target\.combat\.itemEffects\?\.titans && \(target\.combat\.titansStack\|\|0\) < 25\) \{\s*target\.combat\.titansStack = \(target\.combat\.titansStack\|\|0\) \+ 1;\s*target\.stats\.ad \*= 1\.02;\s*target\.stats\.ap \*= 1\.02;\s*\}/,
    `if (target.combat.itemEffects?.titans && (target.combat.titansStack||0) < 25) {
                        target.combat.titansStack = (target.combat.titansStack||0) + 1;
                        target.stats.ad += 2;
                        target.stats.ap += 2;
                        if (target.combat.titansStack === 25) {
                            target.stats.armor += 20;
                            target.stats.mr += 20;
                        }
                    }`
);

fs.writeFileSync('js/battleEngine.js', code, 'utf8');
console.log('battleEngine.js updated.');
