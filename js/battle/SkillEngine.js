export class SkillEngine {
    constructor() {}
    
    execute(unit, activeUnits, engine) {
        const s = unit.skill;
        const starIdx = (unit.star || 1) - 1;
        let enemies = activeUnits.filter(u => u.team !== unit.team && u.currHp > 0 && !u.buffs.some(b=>b.type==='invincible' || b.type==='zephyr'));
        if (enemies.length === 0) enemies = activeUnits.filter(u => u.team !== unit.team && u.currHp > 0); // fallback
        const allies = activeUnits.filter(u => u.team === unit.team && u.currHp > 0);
        
        let targets = [];
        enemies.sort((a,b) => engine.getDist(unit.gridIndex, a.gridIndex) - engine.getDist(unit.gridIndex, b.gridIndex));
        allies.sort((a,b) => (a.currHp/a.stats.maxHp) - (b.currHp/b.stats.maxHp));
        
        // 이온 충격기(겨울용 수면양말) 반사 피해
        const ionicEnemies = activeUnits.filter(u => u.team !== unit.team && u.currHp > 0 && u.combat.itemEffects?.ionic && engine.getDist(unit.gridIndex, u.gridIndex) <= 1);
        ionicEnemies.forEach(e => {
            const ionicDmg = (unit.stats.maxMana || 0) * 2.5; 
            if (ionicDmg > 0) {
                let actualDmg = ionicDmg * (100 / (100 + unit.stats.mr));
                unit.currHp -= actualDmg;
                engine.logs.push({
                    tick: engine.tick, type: 'damage',
                    target: unit.gridIndex, source: e.gridIndex,
                    dmg: Math.round(actualDmg), dmgType: 'magic', isCrit: false,
                    currHp: unit.currHp, targetMana: unit.mana, targetStats: { ...unit.stats }, targetCombat: { ...unit.combat }
                });
                engine.checkHpThresholds(unit, activeUnits);
                if (unit.currHp <= 0) engine.handleDeath(unit, activeUnits);
            }
        });
        if (unit.currHp <= 0) return; // 스킬 쓰다 죽으면 중단
        
        const { ad, ap, armor, mr, maxHp, as } = unit.stats;
        const apMult = ap / 100;
        
        const getBaseDmg = (s, starIdx) => {
            let d = 0;
            if (s.adRatio) d += ad * s.adRatio[starIdx];
            if (s.apRatio) d += ap * s.apRatio[starIdx];
            if (s.hpRatio || s.hpRatioDmg) d += maxHp * (s.hpRatio || s.hpRatioDmg)[starIdx];
            if (s.armorRatio) d += armor * s.armorRatio[starIdx];
            if (s.mrRatio) d += mr * s.mrRatio[starIdx];
            if (s.defMrRatio) d += (armor + mr) * s.defMrRatio[starIdx];
            return d;
        };

        const applyDmg = (target, dmg, type = 'magic', isCrit = false) => {
            if (target.buffs.some(b => b.type === 'invincible' || b.type === 'zephyr')) return;
            let finalDmg = Math.max(1, dmg);
            
            let currentDmgAmp = unit.combat.dmgAmp || 0;
            if (unit.combat.isSniper && target) {
                const dist = engine.getDist(unit.gridIndex, target.gridIndex);
                currentDmgAmp += dist * (unit.combat.distAmp || 0);
            }
            if (currentDmgAmp !== 0 && type !== 'true') finalDmg *= Math.max(0.1, (1 + currentDmgAmp));
            if (unit.combat.itemEffects?.giantSlayer) {
                finalDmg *= 1.1; // 기본 10% 증가
                if (target && target.stats.maxHp > 1500) finalDmg *= 1.25; // 1500 초과 시 추가 증폭
            }
            if (unit.combat.itemEffects?.guardbreaker && target.currShield > 0) finalDmg *= 1.25;
            if ((unit.combat.itemEffects?.skillCrit || unit.combat.skillCrit) && type !== 'true') {
                if (Math.random() < (unit.combat.critChance || 0)) {
                    finalDmg *= (unit.combat.critDmg || 1.5);
                    isCrit = true;
                }
            }

            // [미술 시너지] 장판 효과 적용 (스킬)
            let dmgAmpFromCanvas = 0;
            let dmgReducFromCanvas = 0;
            for (let canvas of engine.canvases) {
                const inRange = engine.getDist(canvas.centerIdx, target.gridIndex) <= canvas.radius;
                if (inRange) {
                    if (canvas.team !== target.team) {
                        dmgAmpFromCanvas += canvas.enemyDmgAmp;
                    } else {
                        dmgReducFromCanvas += canvas.allyDmgReduc;
                    }
                }
            }
            if (dmgAmpFromCanvas > 0) finalDmg *= (1 + dmgAmpFromCanvas);

            if (type === 'physical') {
                // ① 방어력 감쇄 먼저 적용
                let armor = target.stats.armor;
                if (unit.buffs.some(b => b.type === 'precision')) armor = 0;
                else {
                    let shredBuffs = target.buffs.filter(b => b.type === 'armorShred');
                    let maxShred = shredBuffs.length > 0 ? Math.max(...shredBuffs.map(b => b.val)) : 0;
                    // 공격자의 방관 적용 (armorPen이 있으면 추가 관통)
                    let armorPenMult = unit.combat.armorPen ? (1 - unit.combat.armorPen) : 1;
                    if (target.combat?.itemEffects?.gargoyle) armorPenMult = 1; // 가고일 있으면 방관 면역 (선택 사항, 여기선 일단 생략) - 생략
                    armor *= (1 - maxShred) * armorPenMult;
                }
                finalDmg *= (100 / (100 + armor));
                // ② dmgReduc 적용 (하드캡 75%)
                let dr = target.combat?.dmgReduc || 0;
                dr += dmgReducFromCanvas;
                if (target.buffs.some(b => b.type === 'dmgReduc25')) dr += 0.25;
                dr = Math.min(dr, 0.75);
                finalDmg *= (1 - dr);
            } else if (type === 'magic') {
                // ① 마법 저항력 감쇄 먼저 적용
                let shredBuffs = target.buffs.filter(b => b.type === 'mrShred');
                let maxShred = shredBuffs.length > 0 ? Math.max(...shredBuffs.map(b => b.val)) : 0;
                let armorPenMult = unit.combat.armorPen ? (1 - unit.combat.armorPen) : 1;
                let actualMr = target.stats.mr * (1 - maxShred) * armorPenMult;
                finalDmg *= (100 / (100 + actualMr));
                // ② dmgReduc 적용 (하드캡 75%) - 마법 피해에도 적용
                let dr = target.combat?.dmgReduc || 0;
                dr += dmgReducFromCanvas;
                if (target.buffs.some(b => b.type === 'dmgReduc25')) dr += 0.25;
                dr = Math.min(dr, 0.75);
                finalDmg *= (1 - dr);
            } else if (type === 'true') {
                finalDmg = dmg;
            }

            if (target.combat.itemEffects?.bramble && isCrit) {
                finalDmg /= (unit.combat.critDmg || 1.5); // negate crit dmg
            }

            // [영어 시너지] 스킬 적중 시 보너스 마법 피해
            let engActualDmg = 0;
            if (unit.combat.bonusMagicDmgEng > 0 && type !== 'true') {
                let engMagicDmg = (unit.stats.ap * unit.combat.bonusMagicDmgEng) + (unit.stats.as * 10);
                let shredBuffs = target.buffs.filter(b => b.type === 'mrShred');
                let maxShred = shredBuffs.length > 0 ? Math.max(...shredBuffs.map(b => b.val)) : 0;
                let armorPenMult = unit.combat.armorPen ? (1 - unit.combat.armorPen) : 1;
                let actualMr = target.stats.mr * (1 - maxShred) * armorPenMult;
                engActualDmg = engMagicDmg * (100 / (100 + actualMr));
            }
            finalDmg += engActualDmg;

            let preShieldDmg = finalDmg;

            if (target.currShield > 0) {
                if (target.currShield >= finalDmg) {
                    target.currShield -= finalDmg;
                    finalDmg = 0;
                } else {
                    finalDmg -= target.currShield;
                    target.currShield = 0;
                }
            }
            target.currHp -= finalDmg;

            // 스킬 피해도 근성 마나 획득 적용 (고정 10)
            let baseTargetGainMana = target.manaType === '근성' ? 10 : 0;
            let targetManaGainMult = Math.max(0, 1 + (target.combat.manaGain || 0));
            target.currMana = Math.max(target.currMana, Math.min(target.stats.maxMana, (target.currMana || 0) + (baseTargetGainMana * targetManaGainMult)));

            // [p15] 바른 생활의 분노 (평타 피격 시 반사)
            if (engine.playerAugments.includes('p15') && target.team === 'player' && target.subject === '도덕' && unit.team === 'enemy' && finalDmg > 0) {
                const reflectDmg = (target.stats.armor + target.stats.mr) * 0.20;
                let actualReflect = reflectDmg * (100 / (100 + unit.stats.mr));
                unit.currHp -= actualReflect;
                engine.logs.push({
                    tick: engine.tick, type: 'damage', target: unit.gridIndex, source: target.gridIndex,
                    dmg: Math.round(actualReflect), dmgType: 'magic', isCrit: false, fxType: 'aug_thorn_reflect',
                    currHp: unit.currHp, maxHp: unit.stats.maxHp, currShield: unit.currShield
                });
                engine.checkHpThresholds(unit, activeUnits);
                if (unit.currHp <= 0) engine.handleDeath(unit, activeUnits);
            }

            if (finalDmg > 0) {
                engine.logs.push({
                    tick: engine.tick, type: 'damage', target: target.gridIndex, 
                    dmg: Math.round(finalDmg), dmgType: type, isCrit: isCrit,
                    currHp: target.currHp, maxHp: target.stats.maxHp, currShield: target.currShield
                });
                
                if (unit.combat.vamp > 0) {
                    unit.currHp = Math.min(unit.stats.maxHp, unit.currHp + finalDmg * unit.combat.vamp * engine.healEfficiency);
                }
            }

            if (finalDmg > 0 && unit.combat.itemEffects) {
                if (unit.combat.itemEffects.gunbladeHeal) {
                    const count = unit.combat.itemEffects.gunbladeHeal;
                    const lowestAlly = allies.sort((a,b)=>(a.currHp/a.stats.maxHp)-(b.currHp/b.stats.maxHp))[0];
                    if(lowestAlly) lowestAlly.currHp = Math.min(lowestAlly.stats.maxHp, lowestAlly.currHp + finalDmg * 0.22 * count);
                }
                if (unit.combat.itemEffects.lastWhisper && type === 'physical') {
                    addBuff(target, 'armorShred', null, 0.3, 30);
                }
                if (unit.combat.itemEffects.morello && type === 'magic') {
                    addBuff(target, 'morello', null, target.stats.maxHp*0.1, 100);
                    addBuff(target, 'antiHeal', null, 0, 100);
                }
            }

            engine.checkHpThresholds(target, activeUnits);
            if(target.currHp <= 0) engine.handleDeath(target, activeUnits);
        };

        const addBuff = (target, type, stat, val, duration, sourceIdx) => {
            engine.addBuff(target, type, stat, val, duration, sourceIdx);
        };

        // 스킬 타입별 처리 분기
        switch(s.type) {
            case 'single_dot':
                if (enemies[0]) {
                    targets.push(enemies[0]);
                    let totalDmg = unit.stats.ap * s.apRatio[starIdx];
                    let tickDmg = totalDmg / (s.dotDuration[starIdx] / 10); // 10틱(1초)당 데미지
                    addBuff(enemies[0], 'dot', null, tickDmg, s.dotDuration[starIdx], unit.gridIndex);
                }
                break;

            case 'single_damage':
            case 'single_damage_stack':
            case 'single_damage_cc':
            case 'single_damage_buff':
                if (enemies[0]) {
                    targets.push(enemies[0]);
                    let baseDmg = getBaseDmg(s, starIdx);
                    if (s.armorPen) {
                        let tempArmor = enemies[0].stats.armor;
                        enemies[0].stats.armor *= (1 - s.armorPen[starIdx]);
                        applyDmg(enemies[0], baseDmg, s.apRatio ? 'magic' : 'physical');
                        enemies[0].stats.armor = tempArmor;
                    } else {
                        applyDmg(enemies[0], baseDmg, s.apRatio ? 'magic' : 'physical');
                    }
                    
                    if (s.stunDuration) addBuff(enemies[0], 'stun', null, 0, s.stunDuration[starIdx]);
                    if (s.vampBuff) {
                        unit.combat.vamp = (unit.combat.vamp || 0) + s.vampBuff[starIdx];
                        unit.combat.vampBuffTimer = s.buffDuration[starIdx];
                    }
                    // 스플래시 로직 수정 (hpRatioSplash도 발동 조건에 포함)
                    if (s.splashAdRatio || s.hpRatioSplash) {
                        let splashDmg = 0;
                        if (s.splashAdRatio) splashDmg += ad * s.splashAdRatio[starIdx];
                        if (s.hpRatioSplash) splashDmg += maxHp * s.hpRatioSplash[starIdx];
                        const splashRange = s.splashRange || 1;
                        enemies.forEach(e => {
                            if (e !== enemies[0] && engine.getDist(enemies[0].gridIndex, e.gridIndex) <= splashRange) {
                                applyDmg(e, splashDmg, 'physical');
                            }
                        });
                    }
                    if (s.permAdBuff) unit.stats.ad *= (1 + s.permAdBuff[starIdx]);
                }
                break;
                
            case 'aoe_damage_buff':
            case 'aoe_damage_cc_shield':
                if (enemies[0]) {
                    const center = s.type === 'aoe_damage_buff' ? unit : enemies[0];
                    enemies.forEach(e => {
                        if (engine.getDist(center.gridIndex, e.gridIndex) <= s.aoeRange) {
                            targets.push(e);
                            applyDmg(e, getBaseDmg(s, starIdx), 'magic');
                            if (s.stunDuration) addBuff(e, 'stun', null, 0, s.stunDuration[starIdx]);
                        }
                    });
                    if (s.selfDefBuff) addBuff(unit, 'buff', 'armor', unit.stats.armor * s.selfDefBuff[starIdx], s.buffDuration[starIdx]);
                    if (s.shieldFlat) addBuff(unit, 'shield', 'shield', s.shieldFlat[starIdx], 9999);
                    if (s.hpRatioShield) addBuff(unit, 'shield', 'shield', maxHp * s.hpRatioShield[starIdx], 9999);
                    if (s.adRatio && s.type.includes('shield')) addBuff(unit, 'shield', 'shield', ad * s.adRatio[starIdx], 9999);
                }
                break;

            case 'dash_damage':
                const farthest = enemies[enemies.length - 1];
                if (farthest) {
                    targets.push(farthest);
                    applyDmg(farthest, getBaseDmg(s, starIdx), s.adRatio ? 'physical' : 'magic');
                    if (s.stunDuration) addBuff(farthest, 'stun', null, 0, s.stunDuration[starIdx]);
                    
                    const p1 = unit.gridIndex;
                    const p2 = farthest.gridIndex;
                    const dirs = [-1, 1, -8, 8, -9, -7, 7, 9];
                    for(let d of dirs) {
                        const ni = p2 + d;
                        if (ni >= 0 && ni < 48 && !activeUnits.some(u => u.gridIndex === ni && u.currHp > 0)) {
                            unit.gridIndex = ni;
                            engine.logs.push({ tick: engine.tick, type: 'move', unit: p1, to: ni });
                            break;
                        }
                    }
                }
                break;

            case 'random_aoe':
            case 'random_aoe_debuff':
                const shuffled = [...enemies].sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, s.targetCount);
                selected.forEach(e => {
                    targets.push(e);
                    applyDmg(e, getBaseDmg(s, starIdx), s.adRatio ? 'physical' : 'magic');
                    if (s.manaReducPct) addBuff(e, 'debuff', 'manaGain', -s.manaReducPct[starIdx], s.debuffDuration[starIdx]);
                    if (s.name === '색의 마법') addBuff(e, 'manaSeal', null, 0, s.debuffDuration[starIdx]);
                });
                break;

            case 'team_buff':
            case 'team_buff_shield':
            case 'team_buff_enemy_debuff':
                allies.forEach(a => {
                    if (s.buffStat) {
                        let val = s.buffPct[starIdx];
                        if (s.buffStat === 'ap') val = a.stats.ap * val * apMult;
                        else if (s.buffStat === 'ad') val = a.stats.ad * val * apMult;
                        else if (s.buffStat === 'as') val = a.stats.as * val * apMult;
                        addBuff(a, 'buff', s.buffStat, val, s.buffDuration[starIdx]);
                    }
                    if (s.statBuffPct) {
                        let val = s.statBuffPct[starIdx] * apMult;
                        addBuff(a, 'buff', 'ad', a.stats.ad * val, s.buffDuration[starIdx]);
                        addBuff(a, 'buff', 'ap', a.stats.ap * val, s.buffDuration[starIdx]);
                    }
                    if (s.shieldFlat) addBuff(a, 'shield', 'shield', s.shieldFlat[starIdx] * apMult, s.buffDuration[starIdx]);
                    if (s.dmgReducPct) addBuff(a, 'buff', 'dmgReduc', s.dmgReducPct[starIdx], s.buffDuration[starIdx]);
                });
                if (s.enemyMrReduc) {
                    enemies.forEach(e => addBuff(e, 'debuff', 'mr', -s.enemyMrReduc[starIdx], s.buffDuration[starIdx]));
                }
                break;
                
            case 'self_buff':
            case 'self_buff_hyper':
                if (s.buffType === 'guaranteedCrit') addBuff(unit, 'guaranteedCrit', null, s.charges[starIdx], 9999);
                if (s.buffType === 'attackSpeed') addBuff(unit, 'buff', 'as', s.asBuff[starIdx] * apMult, s.buffDuration[starIdx]);
                if (s.buffType === 'precision') {
                    addBuff(unit, 'precision', null, 0, s.buffDuration[starIdx]);
                    if (s.asBuff) addBuff(unit, 'buff', 'as', s.asBuff[starIdx] * apMult, s.buffDuration[starIdx]);
                }
                if (s.type === 'self_buff_hyper') {
                    let bTrue = s.bonusTrueDmg ? s.bonusTrueDmg[starIdx] : 0;
                    addBuff(unit, 'hyper', 'as', s.asBuff[starIdx] * apMult, s.buffDuration[starIdx]);
                    if (s.rangeBuff) addBuff(unit, 'hyper_range', 'range', s.rangeBuff[starIdx], s.buffDuration[starIdx]);
                    if (s.bonusTrueDmg) addBuff(unit, 'bonusTrueDmg', null, bTrue, s.buffDuration[starIdx]);
                }
                break;

            case 'heal':
            case 'heal_shield':
                if (allies[0]) {
                    targets.push(allies[0]);
                    let healAmt = 0;
                    if (s.healPct) healAmt += allies[0].stats.maxHp * s.healPct[starIdx];
                    if (s.mrRatio) healAmt += mr * s.mrRatio[starIdx];
                    healAmt *= (unit.stats.ap / 100);
                    if (healAmt > 0) addBuff(allies[0], 'heal', 'hp', healAmt, 1);
                    
                    let shieldAmt = 0;
                    if (s.shieldFlat) shieldAmt += s.shieldFlat[starIdx];
                    if (s.mrRatio) shieldAmt += mr * s.mrRatio[starIdx];
                    shieldAmt *= (unit.stats.ap / 100);
                    if (shieldAmt > 0) addBuff(allies[0], 'shield', 'shield', shieldAmt, 9999);
                }
                break;
                
            case 'team_heal':
            case 'team_heal_buff':
            case 'team_heal_plus':
                allies.forEach(a => {
                    let healAmt = 0;
                    if (s.healPct || s.teamHealPct) {
                        healAmt += a.stats.maxHp * (s.healPct ? s.healPct[starIdx] : s.teamHealPct[starIdx]);
                    }
                    if (s.defMrRatio) {
                        healAmt += (unit.stats.armor + unit.stats.mr) * s.defMrRatio[starIdx];
                    }
                    if (s.hpRatio) {
                        healAmt += unit.stats.maxHp * s.hpRatio[starIdx];
                    }
                    healAmt *= (unit.stats.ap / 100);
                    if (healAmt > 0) addBuff(a, 'heal', 'hp', healAmt, 1);
                    if (s.asBuff) addBuff(a, 'buff', 'as', s.asBuff[starIdx] * (unit.stats.ap / 100), s.buffDuration[starIdx]);
                });
                if (s.type === 'team_heal_plus' && allies[0] && s.extraHealPct) {
                    addBuff(allies[0], 'heal', 'hp', allies[0].stats.maxHp * s.extraHealPct[starIdx] * (unit.stats.ap / 100), 1);
                }
                break;

            case 'self_shield':
                let shieldAmt = 0;
                if (s.shieldFlat) shieldAmt += s.shieldFlat[starIdx];
                if (s.shieldPct) shieldAmt += maxHp * s.shieldPct[starIdx];
                if (s.adRatio) shieldAmt += ad * s.adRatio[starIdx];
                addBuff(unit, 'shield', 'shield', shieldAmt * apMult, 9999);
                break;

            case 'taunt':
                if (s.dmgReduc) addBuff(unit, 'buff', 'dmgReduc', s.dmgReduc[starIdx], s.tauntDuration[starIdx]);
                if (s.selfMrBuff) addBuff(unit, 'buff', 'mr', unit.stats.mr * s.selfMrBuff[starIdx], s.tauntDuration[starIdx]);
                enemies.forEach(e => {
                    if (engine.getDist(unit.gridIndex, e.gridIndex) <= 3) addBuff(e, 'taunt', null, 0, s.tauntDuration[starIdx], unit.gridIndex);
                });
                break;

            case 'aoe_magic':
            case 'aoe_magic_cluster':
                if (enemies[0]) {
                    let center = enemies[0];
                    if (s.type === 'aoe_magic_cluster') {
                        let bestCount = -1;
                        enemies.forEach(e => {
                            let count = enemies.filter(o => engine.getDist(e.gridIndex, o.gridIndex) <= s.aoeRange).length;
                            if (count > bestCount) { bestCount = count; center = e; }
                        });
                    }
                    enemies.forEach(e => {
                        if (engine.getDist(center.gridIndex, e.gridIndex) <= s.aoeRange) {
                            targets.push(e);
                            applyDmg(e, getBaseDmg(s, starIdx), 'magic');
                        }
                    });
                }
                break;

            case 'true_damage':
                if (enemies[0]) {
                    targets.push(enemies[0]);
                    let tdPct = s.trueDmgPct[starIdx];
                    if (s.apRatio) tdPct += s.apRatio[starIdx] * (unit.stats.ap / 100);
                    applyDmg(enemies[0], enemies[0].stats.maxHp * tdPct, 'true');
                }
                break;

            case 'ally_shield':
                const closeAllies = [...allies].sort((a,b) => engine.getDist(unit.gridIndex, a.gridIndex) - engine.getDist(unit.gridIndex, b.gridIndex));
                closeAllies.slice(0, s.targetCount).forEach(a => addBuff(a, 'shield', 'shield', unit.stats.ap * s.apRatio[starIdx], 9999));
                break;

            case 'aoe_debuff':
                enemies.forEach(e => {
                    if (engine.getDist(unit.gridIndex, e.gridIndex) <= s.aoeRange) {
                        if (s.adReducPct) addBuff(e, 'debuff', 'ad', -e.stats.ad * s.adReducPct[starIdx], s.debuffDuration[starIdx]);
                        if (s.armorRatio) addBuff(e, 'debuff', 'ad', -(armor * s.armorRatio[starIdx]), s.debuffDuration[starIdx]);
                    }
                });
                break;

            case 'farthest_magic':
                const fTarget = enemies[enemies.length - 1];
                if (fTarget) {
                    targets.push(fTarget);
                    applyDmg(fTarget, unit.stats.ap * s.apRatio[starIdx], 'magic');
                }
                break;

            case 'mana_burn':
                if (enemies[0]) {
                    targets.push(enemies[0]);
                    enemies[0].currMana *= (1 - s.manaBurnPct[starIdx]);
                    applyDmg(enemies[0], unit.stats.ap * s.apRatio[starIdx], 'magic');
                }
                break;

            case 'global_magic':
            case 'global_magic_mana':
            case 'global_magic_debuff':
            case 'global_magic_team_buff':
                enemies.forEach(e => {
                    targets.push(e);
                    if (s.defReducPct || s.statReducPct) {
                        let reduc = (s.defReducPct || s.statReducPct)[starIdx];
                        addBuff(e, 'armorShred', null, reduc, s.debuffDuration[starIdx]);
                        addBuff(e, 'mrShred', null, reduc, s.debuffDuration[starIdx]);
                    }
                    applyDmg(e, getBaseDmg(s, starIdx), 'magic');
                });
                if (s.teamMana) allies.forEach(a => {
                    let diff = Math.min(a.stats.maxMana - a.currMana, s.teamMana[starIdx]);
                    a.currMana += diff;
                    engine.logs.push({
                        tick: engine.tick, type: 'heal', target: a.gridIndex,
                        amount: Math.round(diff), healType: 'mana',
                        currHp: a.currHp, maxHp: a.stats.maxHp
                    });
                });
                if (s.teamShield || s.teamStatBuff) allies.forEach(a => {
                    if (s.teamShield) addBuff(a, 'shield', 'shield', s.teamShield[starIdx], 9999);
                    if (s.teamStatBuff) {
                        addBuff(a, 'buff', 'ad', a.stats.ad * s.teamStatBuff[starIdx], 99999);
                        addBuff(a, 'buff', 'ap', a.stats.ap * s.teamStatBuff[starIdx], 99999);
                    }
                });
                break;

            case 'cross_magic':
                if (enemies[0]) {
                    const cx = enemies[0].gridIndex % 8;
                    const cy = Math.floor(enemies[0].gridIndex / 8);
                    enemies.forEach(e => {
                        const ex = e.gridIndex % 8;
                        const ey = Math.floor(e.gridIndex / 8);
                        if (ex === cx || ey === cy) {
                            targets.push(e);
                            let dmg = 0;
                            if (s.apRatio) dmg = unit.stats.ap * s.apRatio[starIdx];
                            else if (s.adRatio) dmg = ad * s.adRatio[starIdx];
                            applyDmg(e, dmg, 'magic');
                        }
                    });
                }
                break;
                
            case 'global_cc_heal':
            case 'global_cc_dmg_debuff':
                enemies.forEach(e => {
                    targets.push(e);
                    addBuff(e, 'stun', null, 0, s.stunDuration[starIdx]);
                    addBuff(e, 'debuff', 'ad', -e.stats.ad * s.statReducPct[starIdx], s.debuffDuration[starIdx]);
                    addBuff(e, 'debuff', 'ap', -e.stats.ap * s.statReducPct[starIdx], s.debuffDuration[starIdx]);
                    if (s.type === 'global_cc_dmg_debuff' && s.defMrRatio) {
                        applyDmg(e, (unit.stats.armor + unit.stats.mr) * s.defMrRatio[starIdx], 'magic');
                    }
                });
                if (s.type === 'global_cc_heal') {
                    allies.forEach(a => {
                        let th = 0;
                        if (s.teamHealPct) th += a.stats.maxHp * s.teamHealPct[starIdx];
                        if (s.hpRatio) th += maxHp * s.hpRatio[starIdx];
                        if (s.defMrRatio) th += (armor + mr) * s.defMrRatio[starIdx];
                        addBuff(a, 'heal', 'hp', th, 1);
                        if (s.extraHealPct) addBuff(a, 'heal', 'hp', a.stats.maxHp * s.extraHealPct[starIdx], 1);
                    });
                }
                break;

            case 'bounce_damage':
            case 'bounce_magic': {
                if (enemies[0]) {
                    targets.push(enemies[0]);
                    let dmg = s.type === 'bounce_magic' ? unit.stats.ap * s.apRatio[starIdx] : ad * s.adRatio[starIdx];
                    let dtype = s.type === 'bounce_magic' ? 'magic' : 'physical';
                    applyDmg(enemies[0], dmg, dtype);
                    if (s.antiHealDuration) addBuff(enemies[0], 'antiHeal', null, 0, s.antiHealDuration[starIdx]);
                    
                    let bounceFrom = enemies[0];
                    const hit = new Set([enemies[0].gridIndex]);
                    for (let i = 0; i < (s.charges[starIdx] || 3); i++) {
                        const nextTarget = enemies
                            .filter(e => !hit.has(e.gridIndex))
                            .sort((a, b) => engine.getDist(bounceFrom.gridIndex, a.gridIndex) - engine.getDist(bounceFrom.gridIndex, b.gridIndex))[0];
                        if (!nextTarget) break;
                        hit.add(nextTarget.gridIndex);
                        targets.push(nextTarget);
                        applyDmg(nextTarget, dmg * (s.bounceRatio || 0.6), dtype);
                        if (s.antiHealDuration) addBuff(nextTarget, 'antiHeal', null, 0, s.antiHealDuration[starIdx]);
                        bounceFrom = nextTarget;
                    }
                }
                break;
            }

            case 'passive':
                // 패시브 스킬은 평타 루프에서 처리, 여기서는 아무 동작 없음
                break;
        }

        let fxType = 'single_hit';
        let screenFlash = false;
        let castTime = 0;

        if (unit.id === 'u4_1') { fxType = 'school_slam'; castTime = 1200; }
        else if (unit.id === 'u4_2') { fxType = 'school_math'; castTime = 800; }
        else if (unit.id === 'u4_3') { fxType = 'school_beaker'; castTime = 1500; }
        else if (unit.id === 'u4_4') { fxType = 'school_pen'; castTime = 1000; }
        else if (unit.id === 'u4_5') { fxType = 'school_shield'; castTime = 1000; }
        else if (unit.id === 'u4_6') { fxType = 'school_heal'; castTime = 1600; }
        else if (unit.id === 'u4_7') { fxType = 'school_piano'; castTime = 1600; }
        else if (unit.id === 'u5_1') { fxType = 'school_foreign'; castTime = 1200; }
        else if (unit.id === 'u5_2') { fxType = 'school_blackhole'; castTime = 2400; screenFlash = true; }
        else if (unit.id === 'u5_3') { fxType = 'school_picasso'; castTime = 2000; }
        else if (unit.id === 'u5_4') { fxType = 'school_principal'; castTime = 2200; screenFlash = true; }
        else if (unit.tier <= 3) {
            fxType = unit.id;
            castTime = 500;
        } else {
            if (s.type.includes('global')) { fxType = 'beam'; screenFlash = unit.tier >= 4; }
            else if (s.type.includes('aoe') || s.type.includes('cross')) fxType = 'aoe_ripple';
            else if (s.type.includes('bounce')) fxType = 'chain_bounce';
            else if (s.type.includes('dash')) fxType = 'dash_slash';
            else if (s.type.includes('heal') || s.type.includes('buff') || s.type.includes('shield')) fxType = 'heal_particle';
            else if (unit.stats.range > 1) fxType = 'projectile';
            castTime = unit.tier >= 4 ? 800 : 300;
        }

        engine.logs.push({
            tick: engine.tick, type: 'skill', caster: unit.gridIndex,
            unitName: unit.name, skillName: s.name, skillDesc: s.desc, team: unit.team, vfx: s.vfx, targets: targets.map(t => t.gridIndex),
            fxType: fxType, castTime: castTime, screenFlash: screenFlash
        });
    }
}
