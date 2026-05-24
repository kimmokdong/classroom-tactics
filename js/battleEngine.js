export class BattleEngine {
    constructor(playerBoard, enemyBoard) {
        this.board = Array(48).fill(null);
        for(let i=0; i<24; i++) {
            if (playerBoard[i]) {
                const u = playerBoard[i];
                this.board[i + 24] = {...u, team: 'player', gridIndex: i + 24, originalBoardIdx: i, currHp: u.stats.hp, currMana: u.stats.mana || (u.combat.bonusMana || 0), currShield: u.combat.shield || 0, buffs: []};
            }
        }
        for(let i=0; i<24; i++) {
            if (enemyBoard[i]) {
                const u = enemyBoard[i];
                this.board[i] = {...u, team: 'enemy', gridIndex: i, currHp: u.stats.hp, currMana: u.stats.mana || (u.combat.bonusMana || 0), currShield: u.combat.shield || 0, buffs: []};
            }
        }
        this.logs = [];
        this.tick = 0;
        this.maxTicks = 600;
    }

    getDist(i1, i2) {
        const x1 = i1 % 8; const y1 = Math.floor(i1 / 8);
        const x2 = i2 % 8; const y2 = Math.floor(i2 / 8);
        return Math.max(Math.abs(x1-x2), Math.abs(y1-y2));
    }

    castSkill(unit, activeUnits) {
        const s = unit.skill;
        const starIdx = (unit.star || 1) - 1;
        const enemies = activeUnits.filter(u => u.team !== unit.team && u.currHp > 0);
        const allies = activeUnits.filter(u => u.team === unit.team && u.currHp > 0);
        
        let targets = [];
        enemies.sort((a,b) => this.getDist(unit.gridIndex, a.gridIndex) - this.getDist(unit.gridIndex, b.gridIndex));
        allies.sort((a,b) => (a.currHp/a.stats.maxHp) - (b.currHp/b.stats.maxHp));
        
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
            let finalDmg = Math.max(1, dmg);
            
            let currentDmgAmp = unit.combat.dmgAmp || 0;
            if (unit.combat.isSniper && target) {
                const dist = this.getDist(unit.gridIndex, target.gridIndex);
                currentDmgAmp += Math.max(0, dist - 1) * (unit.combat.distAmp || 0);
            }
            if (currentDmgAmp > 0 && type !== 'true') finalDmg *= (1 + currentDmgAmp);
            if (unit.combat.itemEffects?.giantSlayer && target.stats.maxHp > 1500) finalDmg *= 1.25;
            if (unit.combat.itemEffects?.guardbreaker && target.currShield > 0) finalDmg *= 1.25;
            if ((unit.combat.itemEffects?.skillCrit || unit.combat.skillCrit) && type !== 'true') {
                if (Math.random() < (unit.combat.critChance || 0)) {
                    finalDmg *= (unit.combat.critDmg || 1.5);
                    isCrit = true;
                }
            }

            if (type === 'physical') {
                let dr = target.combat?.dmgReduc || 0;
                let armor = target.stats.armor;
                if (unit.buffs.some(b => b.type === 'precision')) armor = 0;
                finalDmg *= (1 - dr) * (100 / (100 + armor));
            } else if (type === 'magic') {
                let shred = target.buffs.some(b => b.type === 'ionicShred') ? 0.5 : 1;
                let statikkShred = target.buffs.some(b => b.type === 'statikkShred') ? 0.5 : 1;
                let actualMr = target.stats.mr * shred * statikkShred;
                finalDmg *= (100 / (100 + actualMr));
            } else if (type === 'true') {
                finalDmg = dmg;
            }

            if (target.combat.itemEffects?.bramble && isCrit) {
                finalDmg /= (unit.combat.critDmg || 1.5); // negate crit dmg
            }
            if (target.combat.itemEffects?.dclaw && type === 'magic') {
                target.currHp = Math.min(target.stats.maxHp, target.currHp + target.stats.maxHp * 0.02);
            }

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

            if (finalDmg > 0) {
                this.logs.push({
                    tick: this.tick, type: 'damage', target: target.gridIndex, 
                    dmg: Math.round(finalDmg), dmgType: type, isCrit: isCrit,
                    currHp: target.currHp, maxHp: target.stats.maxHp, currShield: target.currShield
                });
            }

            if (finalDmg > 0 && unit.combat.itemEffects) {
                if (unit.combat.itemEffects.gunbladeHeal) {
                    const lowestAlly = allies.sort((a,b)=>(a.currHp/a.stats.maxHp)-(b.currHp/b.stats.maxHp))[0];
                    if(lowestAlly) lowestAlly.currHp = Math.min(lowestAlly.stats.maxHp, lowestAlly.currHp + finalDmg * 0.22);
                }
                if (unit.combat.itemEffects.lastWhisper && type === 'physical') {
                    addBuff(target, 'debuff', 'armorPct', -0.5, 30);
                }
                if (unit.combat.itemEffects.morello && type === 'magic') {
                    addBuff(target, 'morello', null, target.stats.maxHp*0.1, 100);
                }
            }

            this.checkHpThresholds(target, activeUnits);

            if(target.currHp <= 0) this.logs.push({ tick: this.tick, type: 'die', target: target.gridIndex, unitName: target.name, team: target.team });
        };

        const addBuff = (target, type, stat, val, duration, sourceIdx) => {
            this.addBuff(target, type, stat, val, duration, sourceIdx);
        };

        // 스킬 타입별 처리 분기
        switch(s.type) {
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
                        applyDmg(enemies[0], baseDmg, 'physical');
                        enemies[0].stats.armor = tempArmor;
                    } else {
                        applyDmg(enemies[0], baseDmg, 'physical');
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
                            if (e !== enemies[0] && this.getDist(enemies[0].gridIndex, e.gridIndex) <= splashRange) {
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
                        if (this.getDist(center.gridIndex, e.gridIndex) <= s.aoeRange) {
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
                            this.logs.push({ tick: this.tick, type: 'move', unit: p1, to: ni });
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
                    addBuff(unit, 'buff', 'as', s.asBuff[starIdx] * apMult, s.buffDuration[starIdx]);
                    addBuff(unit, 'buff', 'range', s.rangeBuff[starIdx], s.buffDuration[starIdx]);
                    let bDmg = s.bonusTrueDmg[starIdx];
                    if (s.asRatio) bDmg += as * s.asRatio[starIdx];
                    addBuff(unit, 'bonusTrueDmg', 'ad', bDmg, s.buffDuration[starIdx]);
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
                    if (this.getDist(unit.gridIndex, e.gridIndex) <= 3) addBuff(e, 'taunt', null, 0, s.tauntDuration[starIdx], unit.gridIndex);
                });
                break;

            case 'aoe_magic':
            case 'aoe_magic_cluster':
                if (enemies[0]) {
                    let center = enemies[0];
                    if (s.type === 'aoe_magic_cluster') {
                        let bestCount = -1;
                        enemies.forEach(e => {
                            let count = enemies.filter(o => this.getDist(e.gridIndex, o.gridIndex) <= s.aoeRange).length;
                            if (count > bestCount) { bestCount = count; center = e; }
                        });
                    }
                    enemies.forEach(e => {
                        if (this.getDist(center.gridIndex, e.gridIndex) <= s.aoeRange) {
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
                const closeAllies = [...allies].sort((a,b) => this.getDist(unit.gridIndex, a.gridIndex) - this.getDist(unit.gridIndex, b.gridIndex));
                closeAllies.slice(0, s.targetCount).forEach(a => addBuff(a, 'shield', 'shield', unit.stats.ap * s.apRatio[starIdx], 9999));
                break;

            case 'aoe_debuff':
                enemies.forEach(e => {
                    if (this.getDist(unit.gridIndex, e.gridIndex) <= s.aoeRange) {
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
                        addBuff(e, 'debuff', 'armor', -e.stats.armor * reduc, s.debuffDuration[starIdx]);
                        addBuff(e, 'debuff', 'mr', -e.stats.mr * reduc, s.debuffDuration[starIdx]);
                    }
                    applyDmg(e, getBaseDmg(s, starIdx), 'magic');
                });
                if (s.teamMana) allies.forEach(a => a.currMana = Math.min(a.stats.maxMana, a.currMana + s.teamMana[starIdx]));
                if (s.teamShield || s.teamStatBuff) allies.forEach(a => {
                    if (s.teamShield) addBuff(a, 'shield', 'shield', s.teamShield[starIdx], 9999);
                    if (s.teamStatBuff) {
                        addBuff(a, 'buff', 'ad', a.stats.ad * s.teamStatBuff[starIdx], 99999);
                        addBuff(a, 'buff', 'ap', a.stats.ap * s.teamStatBuff[starIdx], 99999);
                    }
                });
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

            case 'bounce_damage': {
                // 주 대상 타격 후 가까운 적으로 튕기며 추가 물리 피해 (수학천재 피타고라스의 일격)
                if (enemies[0]) {
                    targets.push(enemies[0]);
                    applyDmg(enemies[0], ad * s.adRatio[starIdx], 'physical');
                    let bounceFrom = enemies[0];
                    const hit = new Set([enemies[0].gridIndex]);
                    for (let i = 0; i < (s.charges[starIdx] || 3); i++) {
                        const nextTarget = enemies
                            .filter(e => !hit.has(e.gridIndex))
                            .sort((a, b) => this.getDist(bounceFrom.gridIndex, a.gridIndex) - this.getDist(bounceFrom.gridIndex, b.gridIndex))[0];
                        if (!nextTarget) break;
                        hit.add(nextTarget.gridIndex);
                        targets.push(nextTarget);
                        applyDmg(nextTarget, ad * s.adRatio[starIdx] * 0.6, 'physical');
                        bounceFrom = nextTarget;
                    }
                }
                break;
            }

            case 'passive':
                // 패시브 스킬은 평타 루프에서 처리, 여기서는 아무 동작 없음
                break;
        }

        this.logs.push({
            tick: this.tick, type: 'skill', caster: unit.gridIndex,
            unitName: unit.name, skillName: s.name, skillDesc: s.desc, team: unit.team, vfx: s.vfx, targets: targets.map(t => t.gridIndex)
        });
    }

    run() {
        let activeUnits = this.board.filter(u => u !== null);
        this.initItemEffects(activeUnits);
        while (this.tick < this.maxTicks) {
            const playerAlive = activeUnits.some(u => u.team === 'player' && u.currHp > 0);
            const enemyAlive = activeUnits.some(u => u.team === 'enemy' && u.currHp > 0);
            
            if (!playerAlive || !enemyAlive) {
                const survivingEnemies = activeUnits.filter(u => u.team === 'enemy' && u.currHp > 0).length;
                const survivingPlayers = activeUnits.filter(u => u.team === 'player' && u.currHp > 0).length;
                this.logs.push({ tick: this.tick, type: 'end', winner: playerAlive ? 'player' : 'enemy', survivingEnemies, survivingPlayers });
                break;
            }

            // 버프 타이머 처리
            activeUnits.forEach(u => {
                if (u.currHp <= 0) return;
                if (!u.buffs) u.buffs = [];
                let buffChanged = false;
                for(let i = u.buffs.length - 1; i >= 0; i--) {
                    u.buffs[i].duration--;
                    if(u.buffs[i].duration <= 0) {
                        const expired = u.buffs.splice(i, 1)[0];
                        // 스탯 버프 만료 시 원상복구
                        const statKeys = ['ad','ap','as','armor','mr','range','maxHp'];
                        if (expired.stat && statKeys.includes(expired.stat) && u.stats[expired.stat] !== undefined) {
                            u.stats[expired.stat] -= expired.val;
                        }
                        buffChanged = true;
                    }
                }
                if (buffChanged) {
                    this.logs.push({ tick: this.tick, type: 'buff_update', target: u.gridIndex, buffs: u.buffs.map(b=>b.type) });
                }
            });
            
            // 글로벌 아이템 틱 이벤트
            if (this.tick > 0) {
                if (this.tick % 50 === 0) {
                    activeUnits.forEach(u => {
                        if (u.currHp <= 0) return;
                        if (u.combat.itemEffects?.archangel) u.stats.ap += 25;
                        if (u.combat.itemEffects?.redemption) {
                            activeUnits.forEach(a => {
                                if (a.team === u.team && this.getDist(u.gridIndex, a.gridIndex) <= 1) {
                                    a.currHp = Math.min(a.stats.maxHp, a.currHp + (a.stats.maxHp - a.currHp) * 0.15);
                                    this.addBuff(a, 'dmgReduc25', null, 0, 50);
                                }
                            });
                        }
                    });
                }
                if (this.tick % 20 === 0) {
                    activeUnits.forEach(u => {
                        if (u.currHp <= 0) return;
                        if (u.combat.itemEffects?.sunfire) {
                            const enemy = activeUnits.find(e => e.team !== u.team && this.getDist(u.gridIndex, e.gridIndex) <= 2 && e.currHp > 0);
                            if (enemy) this.addBuff(enemy, 'morello', null, enemy.stats.maxHp * 0.1, 100);
                        }
                    });
                }
                if (this.tick % 10 === 0) {
                    activeUnits.forEach(u => {
                        if (u.currHp <= 0) return;
                        if (u.combat.itemEffects?.ionic) {
                            activeUnits.forEach(e => {
                                if (e.team !== u.team && this.getDist(u.gridIndex, e.gridIndex) <= 2) {
                                    this.addBuff(e, 'ionicShred', null, 0, 15);
                                }
                            });
                        }
                        if (u.combat.itemEffects?.gargoyle) {
                            // count enemies targeting me
                            let targetingMe = activeUnits.filter(e => e.team !== u.team && this.getDist(e.gridIndex, u.gridIndex) <= e.stats.range).length;
                            u.stats.armor += targetingMe * 15;
                            u.stats.mr += targetingMe * 15;
                        }
                    });
                }
            }

            // 1초마다 (10틱) 마나 재생
            if (this.tick > 0 && this.tick % 10 === 0) {
                activeUnits.forEach(u => {
                    if (u.currHp <= 0) return;
                    let regen = 0;
                    if (u.manaType === '집중') regen += 2;
                    if (u.combat && u.combat.teamManaRegen) regen += u.combat.teamManaRegen;
                    if (u.combat && u.combat.artManaRegen && u.subject === '미술') regen += u.combat.artManaRegen;
                    
                    if (regen > 0) {
                        let manaGainMult = Math.max(0, 1 + (u.combat.manaGain || 0));
                        u.currMana = Math.min(u.stats.maxMana, u.currMana + (regen * manaGainMult));
                    }
                });
            }

            // 글로벌 틱 이벤트 (예: 30틱 = 약 3초마다 화염단 체력 회복)
            if (this.tick > 0 && this.tick % 30 === 0) {
                activeUnits.forEach(u => {
                    if (u.currHp <= 0) return;
                    if (u.combat.isFirelight) {
                        u.currHp = Math.min(u.stats.maxHp, u.currHp + (u.stats.maxHp * u.combat.tickHeal));
                        u.combat.firelightCharge = true;
                    }
                });
            }

            // 유닛별 행동 순서를 매 틱마다 무작위로 섞어 공정한 전투 보장
            const actionOrder = [...activeUnits].sort(() => Math.random() - 0.5);
            
            actionOrder.forEach(unit => {
                if (unit.currHp <= 0) return;

                // CC 체크 (기절)
                const isStunned = unit.buffs.some(b => b.type === 'stun');
                if (isStunned) return; // 행동 불가
                
                // 마나 만충 시 스킬 발동 (마나 봉인 디버프 체크)
                const isManaSealed = unit.buffs.some(b => b.type === 'manaSeal');
                if (unit.stats.maxMana > 0 && unit.currMana >= unit.stats.maxMana && unit.skill && !isStunned && !isManaSealed) {
                    this.castSkill(unit, activeUnits);
                    unit.currMana = unit.combat.itemEffects?.blueBuff ? 10 : 0; // 마나 리셋 (블루 버프 시 10 회복)
                    unit.cooldown = Math.max(1, Math.round(10 / unit.stats.as)); // 스킬 사용 후 쿨다운
                    return;
                }

                if (!unit.cooldown) unit.cooldown = 0;
                if (unit.cooldown > 0) {
                    unit.cooldown--;
                    return;
                }

                const enemies = activeUnits.filter(u => u.team !== unit.team && u.currHp > 0);
                if (enemies.length === 0) return;
                
                // 도발 처리
                const tauntedBy = unit.buffs.find(b => b.type === 'taunt');
                let target = null;
                if (tauntedBy) {
                    const tauntTarget = activeUnits.find(u => u.gridIndex === tauntedBy.sourceIdx && u.currHp > 0);
                    if (tauntTarget) target = tauntTarget;
                }
                
                if (!target) {
                    enemies.sort((a,b) => this.getDist(unit.gridIndex, a.gridIndex) - this.getDist(unit.gridIndex, b.gridIndex));
                    target = enemies[0];
                }
                const dist = this.getDist(unit.gridIndex, target.gridIndex);
                
                if (dist <= unit.stats.range) {
                    let dmg = unit.stats.ad;
                    
                    if (unit.combat.isDominator && unit.combat.stackAdApPct) {
                        unit.stats.ad *= (1 + unit.combat.stackAdApPct);
                        unit.stats.ap *= (1 + unit.combat.stackAdApPct);
                    }
                    
                    if (unit.combat.isQuickstriker) {
                        const missingHpPct = 1 - (target.currHp / target.stats.maxHp);
                        unit.stats.as = (unit.stats.as || 0.6) * (1 + (missingHpPct * unit.combat.maxAsBuff));
                    }
                    
                    let currentDmgAmp = unit.combat.dmgAmp || 0;
                    if (unit.combat.isSniper) {
                        currentDmgAmp += Math.max(0, dist - 1) * (unit.combat.distAmp || 0);
                    }
                    if (currentDmgAmp > 0) dmg *= (1 + currentDmgAmp);
                    if (unit.combat.itemEffects?.giantSlayer && target.stats.maxHp > 1500) dmg *= 1.25;
                    if (unit.combat.itemEffects?.guardbreaker && target.currShield > 0) dmg *= 1.25;
                    
                    let isCrit = false;
                    if (Math.random() < unit.combat.critChance) {
                        dmg *= unit.combat.critDmg;
                        isCrit = true;
                    }
                    
                    if (unit.combat.itemEffects?.guinsoo) {
                        unit.stats.as *= 1.04;
                        unit.stats.ap += 2;
                    }
                    if (unit.combat.itemEffects?.titans && (unit.combat.titansStack||0) < 25) {
                        unit.combat.titansStack = (unit.combat.titansStack||0) + 1;
                        unit.stats.ad *= 1.02;
                        unit.stats.ap *= 1.02;
                    }
                    if (target.combat.itemEffects?.titans && (target.combat.titansStack||0) < 25) {
                        target.combat.titansStack = (target.combat.titansStack||0) + 1;
                        target.stats.ad *= 1.02;
                        target.stats.ap *= 1.02;
                    }
                    
                    let dr = target.combat.dmgReduc || 0;
                    if (target.combat.isWatcher && (target.currHp / target.stats.maxHp) >= 0.5) dr *= 2;
                    dmg *= (1 - dr);
                    
                    if (target.combat.itemEffects?.bramble && isCrit) dmg /= unit.combat.critDmg;
                    
                    let shred = target.buffs.some(b => b.type === 'armorPct') ? 0.5 : 1;
                    let actualArmor = target.stats.armor * shred;
                    let totalDmg = dmg * (100 / (100 + actualArmor));
                    
                    if (unit.combat.firelightCharge) {
                        totalDmg += unit.combat.bonusMagicDmg * (100 / (100 + target.stats.mr));
                        unit.combat.firelightCharge = false;
                    }
                    
                    // 보너스 고정 피해 버프 (외고 전학생) 적용
                    let trueDmg = 0;
                    if (unit.buffs.some(b => b.type === 'bonusTrueDmg')) {
                        const bTrue = unit.buffs.find(b => b.type === 'bonusTrueDmg');
                        trueDmg = bTrue.val;
                    }

                    if (target.currShield > 0) {
                        if (target.currShield >= totalDmg) {
                            target.currShield -= totalDmg;
                            totalDmg = 0;
                        } else {
                            totalDmg -= target.currShield;
                            target.currShield = 0;
                        }
                    }
                    
                    target.currHp -= (totalDmg + trueDmg);
                    
                    if (trueDmg > 0) {
                        this.logs.push({
                            tick: this.tick, type: 'damage', target: target.gridIndex, 
                            dmg: Math.round(trueDmg), dmgType: 'true', isCrit: false,
                            currHp: target.currHp, maxHp: target.stats.maxHp, currShield: target.currShield
                        });
                    }
                    
                    let baseGainMana = unit.manaType === '전투' ? 10 : unit.manaType === '집중' ? 5 : 0;
                    let manaGainMult = Math.max(0, 1 + (unit.combat.manaGain || 0)); // 디버프가 -1.1 이면 0으로 막음
                    let gainMana = baseGainMana * manaGainMult;
                    unit.currMana = Math.min(unit.stats.maxMana, unit.currMana + gainMana);
                    
                    let baseTargetGainMana = target.manaType === '근성' ? Math.min(50, totalDmg * 0.15) : 0;
                    let targetManaGainMult = Math.max(0, 1 + (target.combat.manaGain || 0));
                    let targetGainMana = baseTargetGainMana * targetManaGainMult;
                    target.currMana = Math.min(target.stats.maxMana, target.currMana + targetGainMana);
                    
                    // 흡혈 (과학탐구원 스킬 vampBuff, 아이템 vamp 등 combat.vamp > 0 이면 적용)
                    if (unit.combat.vamp > 0) {
                        unit.currHp = Math.min(unit.stats.maxHp, unit.currHp + totalDmg * unit.combat.vamp);
                    }
                    // vampBuff 타이머 처리
                    if (unit.combat.vampBuffTimer > 0) {
                        unit.combat.vampBuffTimer--;
                        if (unit.combat.vampBuffTimer <= 0) {
                            unit.combat.vamp = Math.max(0, unit.combat.vamp - (unit.skill?.vampBuff?.[( unit.star||1)-1] || 0));
                        }
                    }
                    

                    // 패시브 스킬 트리거 (공격 횟수 기반, 예: 수학 짝꿍 '지수 함수 성장')
                    if (unit.skill && unit.skill.type === 'passive') {
                        const starIdx = (unit.star || 1) - 1;
                        unit.combat.passiveAttackCount = (unit.combat.passiveAttackCount || 0) + 1;
                        if (unit.combat.passiveAttackCount >= unit.skill.charges[starIdx]) {
                            unit.combat.passiveAttackCount = 0;
                            const pct = unit.skill.buffPct[starIdx];
                            unit.stats.ad *= (1 + pct);
                            unit.stats.as *= (1 + pct);
                        }
                    }

                    this.logs.push({ 
                        tick: this.tick, type: 'attack', from: unit.gridIndex, to: target.gridIndex, 
                        dmg: Math.round(totalDmg), dmgType: 'physical', isCrit: isCrit,
                        currHp: target.currHp, maxHp: target.stats.maxHp, currShield: target.currShield,
                        attackerMana: unit.currMana, attackerMaxMana: unit.stats.maxMana,
                        targetMana: target.currMana, targetMaxMana: target.stats.maxMana,
                        targetStats: { ad: target.stats.ad, as: target.stats.as, ap: target.stats.ap, armor: target.stats.armor, mr: target.stats.mr },
                        attackerStats: { ad: unit.stats.ad, as: unit.stats.as, ap: unit.stats.ap, armor: unit.stats.armor, mr: unit.stats.mr }
                    });
                    
                    if (unit.combat.itemEffects?.gunbladeHeal) {
                        const allies = activeUnits.filter(u => u.team === unit.team && u.currHp > 0).sort((a,b)=>(a.currHp/a.stats.maxHp)-(b.currHp/b.stats.maxHp));
                        if(allies[0]) allies[0].currHp = Math.min(allies[0].stats.maxHp, allies[0].currHp + totalDmg * 0.22);
                    }
                    if (unit.combat.itemEffects?.lastWhisper) {
                        this.addBuff(target, 'debuff', 'armorPct', -0.5, 30);
                    }
                    if (unit.combat.itemEffects?.runaans) {
                        const otherE = enemies.filter(e => e.gridIndex !== target.gridIndex);
                        if(otherE.length > 0) {
                            const rTar = otherE.sort((a,b)=>this.getDist(unit.gridIndex,a.gridIndex)-this.getDist(unit.gridIndex,b.gridIndex))[0];
                            rTar.currHp -= (unit.stats.ad * 0.5) * (100/(100+rTar.stats.armor));
                            this.checkHpThresholds(rTar, activeUnits);
                        }
                    }
                    if (unit.combat.itemEffects?.statikk) {
                        unit.combat.statikkStack = (unit.combat.statikkStack||0) + 1;
                        if (unit.combat.statikkStack >= 3) {
                            unit.combat.statikkStack = 0;
                            const statikkTargets = enemies.slice(0, 4);
                            statikkTargets.forEach(st => {
                                st.currHp -= 100 * (100/(100+st.stats.mr));
                                this.addBuff(st, 'statikkShred', null, 0, 50);
                                this.checkHpThresholds(st, activeUnits);
                            });
                        }
                    }
                    if (target.combat.itemEffects?.bramble) {
                        const brambleDmg = 80;
                        unit.currHp -= brambleDmg * (100/(100+unit.stats.mr));
                        this.checkHpThresholds(unit, activeUnits);
                    }
                    if (unit.combat.itemEffects?.shojin) {
                        unit.currMana = Math.min(unit.stats.maxMana, unit.currMana + 5);
                    }

                    this.checkHpThresholds(target, activeUnits);

                    if (target.currHp <= 0) {
                        this.logs.push({ tick: this.tick, type: 'die', target: target.gridIndex, unitName: target.name, team: target.team });
                    }
                    
                    unit.cooldown = Math.max(1, Math.round(10 / unit.stats.as)); 
                } else {
                    const x1 = unit.gridIndex % 8; const y1 = Math.floor(unit.gridIndex / 8);
                    const x2 = target.gridIndex % 8; const y2 = Math.floor(target.gridIndex / 8);
                    const currentDist = Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
                    
                    const neighbors = [];
                    for(let dx = -1; dx <= 1; dx++) {
                        for(let dy = -1; dy <= 1; dy++) {
                            if(dx === 0 && dy === 0) continue;
                            const nx = x1 + dx, ny = y1 + dy;
                            if(nx >= 0 && nx < 8 && ny >= 0 && ny < 6) {
                                const distToTarget = Math.max(Math.abs(nx - x2), Math.abs(ny - y2));
                                // 체비쇼프 거리 특성상 대각선/측면 이동으로 같은 거리를 유지하며 장애물 우회 가능
                                if(distToTarget <= currentDist) {
                                    neighbors.push({ idx: ny * 8 + nx, dist: distToTarget });
                                }
                            }
                        }
                    }
                    
                    // 목표와 가장 가까운 셀부터 탐색 (거리가 같으면 랜덤성 부여하여 무한 와리가리 방지)
                    neighbors.sort((a, b) => {
                        if (a.dist === b.dist) return Math.random() - 0.5;
                        return a.dist - b.dist;
                    });
                    
                    let moved = false;
                    for(let n of neighbors) {
                        if (!activeUnits.some(u => u.currHp > 0 && u.gridIndex === n.idx)) {
                            const oldIdx = unit.gridIndex;
                            unit.gridIndex = n.idx;
                            this.logs.push({ tick: this.tick, type: 'move', unit: oldIdx, to: n.idx });
                            unit.cooldown = 6;
                            moved = true;
                            break;
                        }
                    }
                    
                    if (!moved) {
                        unit.cooldown = 2; // 완전히 갇힘
                    }
                }
            });
            this.tick++;
        }
        return this.logs;
    }

    addBuff(target, type, stat, val, duration, sourceIdx) {
        if (!target.buffs) target.buffs = [];
        const ccImmune = target.buffs.some(b => b.type === 'ccImmune');
        if (ccImmune && (type === 'stun' || type === 'taunt' || type === 'zephyr')) return;
        target.buffs.push({ type, stat, val, duration, sourceIdx });
        // 즉시 스탯 적용
        if (stat === 'hp') {
            const oldHp = target.currHp;
            target.currHp = Math.min(target.stats.maxHp, target.currHp + val);
            const healed = target.currHp - oldHp;
            if (healed > 0) {
                this.logs.push({
                    tick: this.tick, type: 'heal', target: target.gridIndex, 
                    amount: Math.round(healed), currHp: target.currHp, maxHp: target.stats.maxHp
                });
            }
        }
        else if (stat === 'shield') target.currShield += val;
        else if (stat && target.stats[stat] !== undefined) {
            target.stats[stat] += val; // ad, ap, as, armor, mr, range 등 즉시 반영
        }
        this.logs.push({ tick: this.tick, type: 'buff_update', target: target.gridIndex, buffs: target.buffs.map(b=>b.type) });
    }

    checkHpThresholds(target, activeUnits) {
        if (!target.combat.itemEffects) return;
        const maxHp = target.stats.maxHp;
        const ratio = target.currHp / maxHp;

        if (target.combat.itemEffects.edgeOfNight && ratio <= 0.6 && !target.combat.eonTriggered) {
            target.combat.eonTriggered = true;
            target.currHp = maxHp * 0.6;
            this.addBuff(target, 'invincible', null, 0, 10);
            target.stats.as *= 1.15;
        }
        if (target.combat.itemEffects.bloodthirsterShield && ratio <= 0.4 && !target.combat.btTriggered) {
            target.combat.btTriggered = true;
            target.currShield += maxHp * 0.25;
        }
        if (target.combat.itemEffects.steraks && ratio <= 0.6 && !target.combat.steraksTriggered) {
            target.combat.steraksTriggered = true;
            target.stats.maxHp += maxHp * 0.25;
            target.currHp += maxHp * 0.25;
            target.stats.ad *= 1.35;
        }
        if (target.combat.itemEffects.protectorsVow && ratio <= 0.5 && !target.combat.vowTriggered) {
            target.combat.vowTriggered = true;
            activeUnits.forEach(u => {
                if (u.team === target.team && this.getDist(target.gridIndex, u.gridIndex) <= 3) {
                    u.currShield += u.stats.maxHp * 0.25;
                    u.stats.armor += 20;
                    u.stats.mr += 20;
                }
            });
        }
    }

    initItemEffects(activeUnits) {
        activeUnits.forEach(u => {
            if (!u.combat.itemEffects) return;
            if (u.combat.itemEffects.locket) {
                this.addBuff(u, 'shield', 'shield', 250, 80);
                activeUnits.forEach(a => {
                    if (a.team === u.team && this.getDist(u.gridIndex, a.gridIndex) <= 2 && Math.abs((u.gridIndex%8) - (a.gridIndex%8)) <= 2 && Math.floor(u.gridIndex/8) === Math.floor(a.gridIndex/8)) {
                        if(a !== u) this.addBuff(a, 'shield', 'shield', 250, 80);
                    }
                });
            }
            if (u.combat.itemEffects.chalice) {
                u.stats.ap += 25;
                activeUnits.forEach(a => {
                    if (a.team === u.team && Math.abs((u.gridIndex%8) - (a.gridIndex%8)) <= 1 && Math.floor(u.gridIndex/8) === Math.floor(a.gridIndex/8)) {
                        if(a !== u) a.stats.ap += 25;
                    }
                });
            }
            if (u.combat.itemEffects.shroud) {
                const targetX = u.gridIndex % 8;
                activeUnits.forEach(e => {
                    if (e.team !== u.team && (e.gridIndex % 8) === targetX) {
                        e.combat.startMana = (e.combat.startMana || 0) - (e.stats.maxMana * 0.3); 
                    }
                });
            }
            if (u.combat.itemEffects.zephyr) {
                const myX = u.gridIndex % 8;
                const myY = Math.floor(u.gridIndex / 8);
                const symX = 7 - myX;
                const symY = 5 - myY;
                const target = activeUnits.find(e => e.team !== u.team && e.gridIndex === (symY * 8 + symX));
                if(target) this.addBuff(target, 'stun', null, 0, 50); 
            }
            if (u.combat.itemEffects.qss) {
                this.addBuff(u, 'ccImmune', null, 0, 150); 
            }
        });
    }
}
