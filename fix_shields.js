const fs = require('fs');

const beFile = 'c:/Users/HSYJ/Desktop/classroom-tactics/js/battleEngine.js';
let be = fs.readFileSync(beFile, 'utf8');

// 1. In BattleEngine constructor, initialize shields
be = be.replace(/currShield: u\.combat\.shield \|\| 0, buffs: \[\]/g, "currShield: u.combat.shield || 0, shields: u.combat.shield ? [{amount: u.combat.shield, expires: 40}] : [], buffs: []");

// 2. Add addShield, damageShield, decayShields methods right after constructor
const methods = 

    addShield(target, amount, duration = 40) {
        amount *= this.shieldEfficiency;
        if (!target.shields) target.shields = [];
        target.shields.push({ amount, expires: this.tick + duration });
        target.currShield = target.shields.reduce((sum, s) => sum + s.amount, 0);
    }

    damageShield(target, amount) {
        if (!target.shields || target.shields.length === 0) {
            target.currShield = 0;
            return amount;
        }
        let remainingDmg = amount;
        for (let i = 0; i < target.shields.length; i++) {
            let sh = target.shields[i];
            if (sh.amount >= remainingDmg) {
                sh.amount -= remainingDmg;
                remainingDmg = 0;
                break;
            } else {
                remainingDmg -= sh.amount;
                sh.amount = 0;
            }
        }
        target.shields = target.shields.filter(s => s.amount > 0);
        target.currShield = target.shields.reduce((sum, s) => sum + s.amount, 0);
        return remainingDmg;
    }

    decayShields() {
        this.board.forEach(u => {
            if (u && u.currHp > 0 && u.shields && u.shields.length > 0) {
                u.shields = u.shields.filter(s => s.expires > this.tick);
                u.currShield = u.shields.reduce((sum, s) => sum + s.amount, 0);
            }
        });
    }
;
be = be.replace('        this.logs = [];\r\n    }', '        this.logs = [];\r\n    }' + methods);

// 3. Call decayShields at the beginning of each tick
be = be.replace('        while (this.tick < 1500 && activeUnits.some(u => u.team === ''player'') && activeUnits.some(u => u.team === ''enemy'')) {', '        while (this.tick < 1500 && activeUnits.some(u => u.team === ''player'') && activeUnits.some(u => u.team === ''enemy'')) {\n            this.decayShields();');

// 4. Replace manual currShield reductions in BattleEngine
be = be.replace(/if \(target\.currShield > 0\) \{\s*if \(target\.currShield >= totalDmg\) \{\s*target\.currShield -= totalDmg;\s*totalDmg = 0;\s*\} else \{\s*totalDmg -= target\.currShield;\s*target\.currShield = 0;\s*\}\s*\}/g, "if (target.currShield > 0) {\n                        totalDmg = this.damageShield(target, totalDmg);\n                    }");

// 5. Replace addBuff shield logic
be = be.replace(/else if \(stat === 'shield'\) target\.currShield \+= val \* this\.shieldEfficiency; \/\/ 연장전 쉴드 효율/g, "else if (stat === 'shield') this.addShield(target, val, duration || 40);");

// 6. Replace BT shield logic
be = be.replace(/target\.currShield \+= maxHp \* 0\.25 \* count \* this\.shieldEfficiency;/g, "this.addShield(target, maxHp * 0.25 * count, 40);");

// 7. Replace Vow shield logic
be = be.replace(/u\.currShield \+= u\.stats\.maxHp \* 0\.25 \* count \* this\.shieldEfficiency;/g, "this.addShield(u, u.stats.maxHp * 0.25 * count, 40);");

// 8. Replace Revive shield logic
be = be.replace(/a\.currShield \+= target\.stats\.maxHp \* reviveShieldPct \* this\.shieldEfficiency;/g, "this.addShield(a, target.stats.maxHp * reviveShieldPct, 40);");

fs.writeFileSync(beFile, be, 'utf8');

const seFile = 'c:/Users/HSYJ/Desktop/classroom-tactics/js/battle/SkillEngine.js';
let se = fs.readFileSync(seFile, 'utf8');
se = se.replace(/if \(target\.currShield > 0\) \{\s*if \(target\.currShield >= finalDmg\) \{\s*target\.currShield -= finalDmg;\s*finalDmg = 0;\s*\} else \{\s*finalDmg -= target\.currShield;\s*target\.currShield = 0;\s*\}\s*\}/g, "if (target.currShield > 0) {\n                finalDmg = engine.damageShield(target, finalDmg);\n            }");
fs.writeFileSync(seFile, se, 'utf8');

console.log('Shield logic updated.');
