import { SkillEngine } from './battle/SkillEngine.js';
export class BattleEngine {
    constructor(playerBoard, enemyBoard, playerAugments = []) {
        this.board = Array(48).fill(null);
        this.playerAugments = playerAugments;
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
        this.skillEngine = new SkillEngine();
    }

    getDist(i1, i2) {
        const x1 = i1 % 8; const y1 = Math.floor(i1 / 8);
        const x2 = i2 % 8; const y2 = Math.floor(i2 / 8);
        return Math.max(Math.abs(x1-x2), Math.abs(y1-y2));
    }

    

    run() {
        let activeUnits = this.board.filter(u => u !== null);

        this.tick = -20;
        // [p13] 긴급 속보 (방송부 7 시너지) - 전투 시작 직후 아이템(서풍, 침묵장막) 효과보다 먼저 적용 및 로그 기록
        if (this.playerAugments.includes('p13')) {
            const broadcastUnits = activeUnits.filter(u => u.team === 'player' && (u.subject === '방송부' || u.club === '방송부'));
            const uniqueBroadcast = new Set(broadcastUnits.map(u => u.name)).size;
            if (uniqueBroadcast >= 7) {
                const enemies = activeUnits.filter(u => u.team === 'enemy');
                enemies.forEach(e => {
                    this.addBuff(e, 'stun', null, 0, 50); // 50틱 스턴으로 침묵/이동불가 구현
                });
                broadcastUnits.forEach(u => {
                    this.addBuff(u, 'buff', 'range', 1, 9999);
                });
                // 가장 먼저 재생되도록 -20틱 시작 시점에 긴급 속보 로그 기록
                this.logs.push({
                    tick: this.tick,
                    type: 'broadcast_silence',
                    fxType: 'aug_mass_silence',
                    targets: enemies.map(e => e.gridIndex)
                });
            }
        }

        this.tick = -10;
        this.initItemEffects(activeUnits);

        this.tick = 0;

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
                
                if (this.tick % 20 === 0) {
                    activeUnits.forEach(u => {
                        if (u.currHp <= 0) return;
                        if (u.combat.itemEffects?.dclaw) {
                            u.currHp = Math.min(u.stats.maxHp, u.currHp + u.stats.maxHp * 0.05 * u.combat.itemEffects.dclaw);
                        }
                    });
                }
                if (this.tick % 50 === 0) {
                    activeUnits.forEach(u => {
                        if (u.currHp <= 0) return;
                        if (u.combat.itemEffects?.archangel) u.stats.ap += 25 * u.combat.itemEffects.archangel;
                        if (u.combat.itemEffects?.redemption) {
                            activeUnits.forEach(a => {
                                if (a.team === u.team && this.getDist(u.gridIndex, a.gridIndex) <= 1) {
                                    a.currHp = Math.min(a.stats.maxHp, a.currHp + (a.stats.maxHp - a.currHp) * 0.10 * u.combat.itemEffects.redemption);
                                    this.addBuff(a, 'dmgReduc25', null, 0, 30);
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
                            if (enemy) {
                                this.addBuff(enemy, 'morello', null, enemy.stats.maxHp * 0.1, 100);
                                this.addBuff(enemy, 'antiHeal', null, 0, 100);
                            }
                        }
                    });
                }
                if (this.tick % 10 === 0) {
                    activeUnits.forEach(u => {
                        if (u.currHp <= 0) return;
                        
                        const dotBuffs = u.buffs ? u.buffs.filter(b => b.type === 'dot') : [];
                        const morelloBuffs = u.buffs ? u.buffs.filter(b => b.type === 'morello') : [];
                        if (dotBuffs.length > 0 || morelloBuffs.length > 0) {
                            let actualDmg = 0;
                            let trueDmg = 0;
                            let lastSourceIdx = null;
                            dotBuffs.forEach(b => {
                                actualDmg += b.val * (100 / (100 + u.stats.mr));
                                if (b.sourceIdx !== undefined) lastSourceIdx = b.sourceIdx;
                            });
                            morelloBuffs.forEach(b => {
                                trueDmg += b.val / 10; // 100틱(10초) 동안 10번 틱 발생하므로 1회 틱당 1/10
                                if (b.sourceIdx !== undefined) lastSourceIdx = b.sourceIdx;
                            });
                            
                            if (actualDmg + trueDmg > 0) {
                                u.currHp -= (actualDmg + trueDmg);
                                this.logs.push({
                                    tick: this.tick, type: 'damage',
                                    target: u.gridIndex, source: lastSourceIdx !== null ? lastSourceIdx : u.gridIndex,
                                    dmg: Math.round(actualDmg + trueDmg), dmgType: actualDmg > trueDmg ? 'magic' : 'true', isCrit: false,
                                    currHp: u.currHp, targetMana: u.mana, targetStats: { ...u.stats }, targetCombat: { ...u.combat }
                                });
                                
                                if (u.manaType === '근성') {
                                    let targetManaGainMult = Math.max(0, 1 + (u.combat.manaGain || 0));
                                    u.currMana = Math.min(u.stats.maxMana, (u.currMana || 0) + (10 * targetManaGainMult));
                                }
                                
                                this.checkHpThresholds(u, activeUnits);
                                if (u.currHp <= 0) this.handleDeath(u, activeUnits);
                            }
                        }

                        if (u.combat.itemEffects?.ionic) {
                            activeUnits.forEach(e => {
                                if (e.team !== u.team && this.getDist(u.gridIndex, e.gridIndex) <= 1) { // 반경 1칸
                                    this.addBuff(e, 'mrShred', null, 0.3, 15);
                                }
                            });
                        }
                        if (u.combat.itemEffects?.gargoyle) {
                            // count enemies targeting me
                            let targetingMe = activeUnits.filter(e => e.team !== u.team && this.getDist(e.gridIndex, u.gridIndex) <= e.stats.range).length;
                            const count = u.combat.itemEffects.gargoyle;
                            u.stats.armor += targetingMe * 15 * count;
                            u.stats.mr += targetingMe * 15 * count;
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

            // 전투 시작 후 1초(10틱) 동안은 행동(이동/공격) 대기 (이펙트 연출 시간 확보)
            if (this.tick < 10) {
                this.tick++;
                continue;
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
                    this.skillEngine.execute(unit, activeUnits, this);
                    unit.currMana = unit.combat.itemEffects?.blueBuff ? 10 : 0; // 마나 리셋 (블루 버프 시 10 회복)
                    if (unit.combat.shroudPenalty) {
                        unit.stats.maxMana -= unit.combat.shroudPenalty;
                        unit.combat.shroudPenalty = 0;
                        this.logs.push({ tick: this.tick, type: 'mana_update', target: unit.gridIndex, currMana: unit.currMana, maxMana: unit.stats.maxMana });
                    }
                    unit.cooldown = Math.max(1, Math.round(10 / unit.stats.as)); // 스킬 사용 후 쿨다운
                    return;
                }

                if (!unit.cooldown) unit.cooldown = 0;
                if (unit.cooldown > 0) {
                    unit.cooldown--;
                    return;
                }

                let targetableEnemies = activeUnits.filter(u => u.team !== unit.team && u.currHp > 0 && !u.buffs.some(b=>b.type==='invincible' || b.type==='zephyr'));
                if (targetableEnemies.length === 0) targetableEnemies = activeUnits.filter(u => u.team !== unit.team && u.currHp > 0); // fallback
                if (targetableEnemies.length === 0) return;
                
                // 도발 처리
                const tauntedBy = unit.buffs.find(b => b.type === 'taunt');
                let target = null;
                if (tauntedBy) {
                    const tauntTarget = targetableEnemies.find(u => u.gridIndex === tauntedBy.sourceIdx);
                    if (tauntTarget) target = tauntTarget;
                }
                
                if (!target) {
                    targetableEnemies.sort((a,b) => this.getDist(unit.gridIndex, a.gridIndex) - this.getDist(unit.gridIndex, b.gridIndex));
                    target = targetableEnemies[0];
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
                        currentDmgAmp += dist * (unit.combat.distAmp || 0);
                    }
                    if (currentDmgAmp > 0) dmg *= (1 + currentDmgAmp);
                    if (unit.combat.itemEffects?.giantSlayer) {
                        dmg *= 1.1;
                        if (target.stats.maxHp > 1500) dmg *= 1.25;
                    }
                    if (unit.combat.itemEffects?.guardbreaker && target.currShield > 0) dmg *= 1.25;
                    
                    let isCrit = false;
                    if (Math.random() < unit.combat.critChance) {
                        dmg *= unit.combat.critDmg;
                        isCrit = true;
                    }
                    
                    if (unit.combat.itemEffects?.guinsoo) {
                        const count = unit.combat.itemEffects.guinsoo;
                        unit.stats.as *= Math.pow(1.04, count);
                        unit.stats.ap += 2 * count;
                    }
                    if (unit.combat.itemEffects?.titans) {
                        const count = unit.combat.itemEffects.titans;
                        if ((unit.combat.titansStack||0) < 25) {
                            unit.combat.titansStack = (unit.combat.titansStack||0) + 1;
                            unit.stats.ad += 2 * count;
                            unit.stats.ap += 2 * count;
                            if (unit.combat.titansStack === 25) {
                                unit.stats.armor += 20 * count;
                                unit.stats.mr += 20 * count;
                                this.logs.push({ tick: this.tick, type: 'titans_max', target: unit.gridIndex });
                            }
                        }
                    }
                    if (target.combat.itemEffects?.titans) {
                        const count = target.combat.itemEffects.titans;
                        if ((target.combat.titansStack||0) < 25) {
                            target.combat.titansStack = (target.combat.titansStack||0) + 1;
                            target.stats.ad += 2 * count;
                            target.stats.ap += 2 * count;
                            if (target.combat.titansStack === 25) {
                                target.stats.armor += 20 * count;
                                target.stats.mr += 20 * count;
                                this.logs.push({ tick: this.tick, type: 'titans_max', target: target.gridIndex });
                            }
                        }
                    }
                    
                    let dr = target.combat.dmgReduc || 0;
                    if (target.buffs.some(b => b.type === 'dmgReduc25')) dr += 0.25;
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

                    let preShieldDmg = totalDmg + trueDmg;

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

                    // [p15] 바른 생활의 분노 (평타 피격 시 반사)
                    if (this.playerAugments.includes('p15') && target.team === 'player' && target.subject === '도덕' && unit.team === 'enemy') {
                        const reflectDmg = (target.stats.armor + target.stats.mr) * 0.20;
                        let actualReflect = reflectDmg * (100 / (100 + unit.stats.mr));
                        unit.currHp -= actualReflect;
                        this.logs.push({
                            tick: this.tick, type: 'damage', target: unit.gridIndex, source: target.gridIndex,
                            dmg: Math.round(actualReflect), dmgType: 'magic', isCrit: false, fxType: 'aug_thorn_reflect',
                            currHp: unit.currHp, maxHp: unit.stats.maxHp, currShield: unit.currShield
                        });
                        this.checkHpThresholds(unit, activeUnits);
                        if (unit.currHp <= 0) this.handleDeath(unit, activeUnits);
                    }
                    
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
                    
                    let baseTargetGainMana = target.manaType === '근성' ? 10 : 0;
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

                    let atkFx = dist > 1 ? 'projectile' : 'dash_slash';
                    this.logs.push({ 
                        tick: this.tick, type: 'attack', from: unit.gridIndex, to: target.gridIndex, 
                        dmg: Math.round(totalDmg), dmgType: 'physical', isCrit: isCrit,
                        currHp: target.currHp, maxHp: target.stats.maxHp, currShield: target.currShield,
                        attackerMana: unit.currMana, attackerMaxMana: unit.stats.maxMana,
                        targetMana: target.currMana, targetMaxMana: target.stats.maxMana,
                        targetStats: { ad: target.stats.ad, as: target.stats.as, ap: target.stats.ap, armor: target.stats.armor, mr: target.stats.mr },
                        attackerStats: { ad: unit.stats.ad, as: unit.stats.as, ap: unit.stats.ap, armor: unit.stats.armor, mr: unit.stats.mr },
                        targetCombat: { ...target.combat }, attackerCombat: { ...unit.combat },
                        fxType: atkFx
                    });
                    
                    if (unit.combat.itemEffects?.gunbladeHeal) {
                        const count = unit.combat.itemEffects.gunbladeHeal;
                        const allies = activeUnits.filter(u => u.team === unit.team && u.currHp > 0).sort((a,b)=>(a.currHp/a.stats.maxHp)-(b.currHp/b.stats.maxHp));
                        if(allies[0]) {
                            const healAmount = totalDmg * 0.22 * count;
                            allies[0].currHp = Math.min(allies[0].stats.maxHp, allies[0].currHp + healAmount);
                            this.logs.push({
                                tick: this.tick, type: 'heal', target: allies[0].gridIndex,
                                amount: Math.round(healAmount), currHp: allies[0].currHp, maxHp: allies[0].stats.maxHp
                            });
                        }
                    }
                    if (unit.combat.itemEffects?.lastWhisper) {
                        this.addBuff(target, 'armorShred', null, 0.3, 30);
                    }
                    if (unit.combat.itemEffects?.runaans) {
                        const count = unit.combat.itemEffects.runaans;
                        const otherE = targetableEnemies.filter(e => e.gridIndex !== target.gridIndex);
                        const rTargets = otherE.sort((a,b)=>this.getDist(unit.gridIndex,a.gridIndex)-this.getDist(unit.gridIndex,b.gridIndex)).slice(0, count);
                        rTargets.forEach(rTar => {
                            let rDmg = (unit.stats.ad * 0.5) * (100/(100+rTar.stats.armor));
                            rTar.currHp -= rDmg;
                            this.logs.push({
                                tick: this.tick, type: 'damage', target: rTar.gridIndex, source: unit.gridIndex,
                                dmg: Math.round(rDmg), dmgType: 'physical', isCrit: false, fxType: 'projectile',
                                currHp: rTar.currHp, targetMana: rTar.mana, targetStats: { ...rTar.stats }, targetCombat: { ...rTar.combat }
                            });
                            this.checkHpThresholds(rTar, activeUnits);
                            if (rTar.currHp <= 0) this.handleDeath(rTar, activeUnits);
                        });
                    }
                    if (unit.combat.itemEffects?.statikk) {
                        const count = unit.combat.itemEffects.statikk;
                        unit.combat.statikkStack = (unit.combat.statikkStack||0) + 1;
                        if (unit.combat.statikkStack >= 3) {
                            unit.combat.statikkStack = 0;
                            const statikkTargets = targetableEnemies.slice(0, 4);
                            statikkTargets.forEach(st => {
                                let stDmg = (100 * count) * (100/(100+st.stats.mr));
                                st.currHp -= stDmg;
                                this.logs.push({
                                    tick: this.tick, type: 'damage', target: st.gridIndex, source: unit.gridIndex,
                                    dmg: Math.round(stDmg), dmgType: 'magic', isCrit: false, fxType: 'lightning',
                                    currHp: st.currHp, targetMana: st.mana, targetStats: { ...st.stats }, targetCombat: { ...st.combat }
                                });
                                this.addBuff(st, 'mrShred', null, 0.3, 50);
                                this.checkHpThresholds(st, activeUnits);
                                if (st.currHp <= 0) this.handleDeath(st, activeUnits);
                            });
                        }
                    }
                    if (target.combat.itemEffects?.bramble) {
                        const count = target.combat.itemEffects.bramble;
                        const brambleDmg = 80 * count;
                        let actualBramble = brambleDmg * (100/(100+unit.stats.mr));
                        unit.currHp -= actualBramble;
                        this.logs.push({
                            tick: this.tick, type: 'damage', target: unit.gridIndex, source: target.gridIndex,
                            dmg: Math.round(actualBramble), dmgType: 'magic', isCrit: false, fxType: 'bramble',
                            currHp: unit.currHp, targetMana: unit.mana, targetStats: { ...unit.stats }, targetCombat: { ...unit.combat }
                        });
                        this.checkHpThresholds(unit, activeUnits);
                        if (unit.currHp <= 0) this.handleDeath(unit, activeUnits);
                    }
                    if (unit.combat.itemEffects?.shojin) {
                        const count = unit.combat.itemEffects.shojin;
                        unit.currMana = Math.min(unit.stats.maxMana, unit.currMana + 5 * count);
                    }

                    this.checkHpThresholds(target, activeUnits);
                    if (target.currHp <= 0) this.handleDeath(target, activeUnits);
                    
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
        if (target.currHp <= 0 || target.isDead) return;
        if (!target.buffs) target.buffs = [];
        const ccImmune = target.buffs.some(b => b.type === 'ccImmune');
        if (ccImmune && (type === 'stun' || type === 'taunt' || type === 'zephyr')) return;
        target.buffs.push({ type, stat, val, duration, sourceIdx });
        // 즉시 스탯 적용
        if (stat === 'hp') {
            const hasAntiHeal = target.buffs.some(b => b.type === 'antiHeal');
            if (hasAntiHeal && val > 0) val *= 0.5;
            const oldHp = target.currHp;
            target.currHp = Math.min(target.stats.maxHp, target.currHp + val);
            const healed = target.currHp - oldHp;
            if (healed > 0) {
                this.logs.push({
                    tick: this.tick, type: 'heal', target: target.gridIndex, 
                    amount: Math.round(healed), currHp: target.currHp, maxHp: target.stats.maxHp
                });
            }

            // [p12] 과잉 진료 (보건부 유닛이 치유 시 초과된 회복량의 1.5배 광역 고정 피해)
            const overheal = val - healed;
            if (overheal > 0 && this.playerAugments.includes('p12') && sourceIdx !== undefined) {
                const sourceUnit = this.board[sourceIdx];
                if (sourceUnit && sourceUnit.team === 'player' && sourceUnit.club === '보건부') {
                    const dmg = overheal * 1.5;
                    const enemies = this.board.filter(u => u !== null && u.team === 'enemy' && u.currHp > 0);
                    enemies.forEach(e => {
                        if (this.getDist(target.gridIndex, e.gridIndex) <= 2) {
                            e.currHp -= dmg;
                            this.logs.push({
                                tick: this.tick, type: 'damage', target: e.gridIndex, source: sourceIdx,
                                dmg: Math.round(dmg), dmgType: 'true', isCrit: false, fxType: 'aug_heal_bomb',
                                currHp: e.currHp, maxHp: e.stats.maxHp, currShield: e.currShield
                            });
                            // 여기서 handleDeath를 바로 부르기엔 구조상 activeUnits 필요하므로 간략화
                            if (e.currHp <= 0) e.isDead = true; 
                        }
                    });
                }
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
            const count = target.combat.itemEffects.bloodthirsterShield;
            target.combat.btTriggered = true;
            target.currShield += maxHp * 0.25 * count;
        }
        if (target.combat.itemEffects.steraks && ratio <= 0.6 && !target.combat.steraksTriggered) {
            const count = target.combat.itemEffects.steraks;
            target.combat.steraksTriggered = true;
            target.stats.maxHp += maxHp * 0.25 * count;
            target.currHp += maxHp * 0.25 * count;
            target.stats.ad += 25 * count;
        }
        if (target.combat.itemEffects.protectorsVow && ratio <= 0.5 && !target.combat.vowTriggered) {
            const count = target.combat.itemEffects.protectorsVow;
            target.combat.vowTriggered = true;
            activeUnits.forEach(u => {
                if (u.team === target.team && this.getDist(target.gridIndex, u.gridIndex) <= 1) {
                    u.currShield += u.stats.maxHp * 0.25 * count;
                    u.stats.armor += 20 * count;
                    u.stats.mr += 20 * count;
                }
            });
        }
    }

    handleDeath(target, activeUnits) {
        if (target.currHp > 0 || target.isDead) return;
        target.isDead = true;
        this.logs.push({ tick: this.tick, type: 'die', target: target.gridIndex, unitName: target.name, team: target.team });
        
        // [p14] 바톤 터치 (육상부 사망 시 스탯 상속)
        if (this.playerAugments.includes('p14') && target.team === 'player' && target.club === '육상부') {
            const otherRunners = activeUnits.filter(u => u.team === 'player' && u.club === '육상부' && u.currHp > 0 && !u.isDead);
            if (otherRunners.length > 0) {
                otherRunners.sort((a,b) => this.getDist(target.gridIndex, a.gridIndex) - this.getDist(target.gridIndex, b.gridIndex));
                const heir = otherRunners[0];
                this.addBuff(heir, 'buff', 'ad', target.stats.ad, 99999);
                this.addBuff(heir, 'buff', 'as', target.stats.as, 99999);
                heir.currMana = Math.min(heir.stats.maxMana, heir.currMana + target.currMana);
                
                // 바톤 터치 VFX 로그 추가
                this.logs.push({
                    tick: this.tick,
                    type: 'spirit_transfer',
                    fxType: 'aug_spirit_transfer',
                    source: target.gridIndex,
                    target: heir.gridIndex
                });
                
                this.logs.push({ tick: this.tick, type: 'mana_update', target: heir.gridIndex, currMana: heir.currMana, maxMana: heir.stats.maxMana });
            }
        }

        // 즈롯 차원문 (급식실 프리패스권) 강아지 소환
        if (target.combat.itemEffects?.zzrot && !target.isZzrotDog) {
            const count = target.combat.itemEffects.zzrot;
            for(let c = 0; c < count; c++) {
                const dirs = [-1, 1, -8, 8, -9, -7, 7, 9];
                let spawnIdx = -1;
                for(let d of dirs) {
                    const ni = target.gridIndex + d;
                    if (ni >= 0 && ni < 48 && Math.abs((target.gridIndex%8)-(ni%8)) <= 1) {
                        if (!activeUnits.some(u => u.currHp > 0 && u.gridIndex === ni)) {
                            spawnIdx = ni;
                            break;
                        }
                    }
                }
                if (spawnIdx !== -1) {
                    const dog = {
                        name: '차원문 강아지', icon: '🐶', team: target.team, tier: 1, star: 3, gridIndex: spawnIdx, currHp: 1000, currMana: 0,
                        isZzrotDog: true,
                        stats: { maxHp: 1000, hp: 1000, ad: 50, ap: 0, armor: 30, mr: 30, as: 0.65, range: 1, maxMana: 0, mana: 0 },
                        combat: { critChance: 0.10, critDmg: 1.5, dmgAmp: 0, dmgReduc: 0, vamp: 0 },
                        buffs: [], cooldown: 0,
                        manaType: '전투',
                        skill: { type: 'passive', name: '멍멍!', desc: '주변 도발', charges: [99,99,99] }
                    };
                    activeUnits.push(dog);
                    this.logs.push({ tick: this.tick, type: 'spawn', target: spawnIdx, unit: dog });
                    
                    const enemies = activeUnits.filter(u => u.team !== dog.team && u.currHp > 0);
                    enemies.forEach(e => {
                        if (this.getDist(dog.gridIndex, e.gridIndex) <= 2) {
                            this.addBuff(e, 'taunt', null, 0, 30, dog.gridIndex);
                        }
                    });
                }
            }
        }
    }

    initItemEffects(activeUnits) {
        activeUnits.forEach(u => {
            if (!u.combat.itemEffects) return;
            if (u.combat.itemEffects.locket) {
                const count = u.combat.itemEffects.locket;
                this.addBuff(u, 'shield', 'shield', 250 * count, 80);
                activeUnits.forEach(a => {
                    if (a.team === u.team && this.getDist(u.gridIndex, a.gridIndex) <= 2 && Math.abs((u.gridIndex%8) - (a.gridIndex%8)) <= 2 && Math.floor(u.gridIndex/8) === Math.floor(a.gridIndex/8)) {
                        if(a !== u) this.addBuff(a, 'shield', 'shield', 250 * count, 80);
                    }
                });
            }
            if (u.combat.itemEffects.chalice) {
                const count = u.combat.itemEffects.chalice;
                u.stats.ap += 25 * count;
                activeUnits.forEach(a => {
                    if (a.team === u.team && Math.abs((u.gridIndex%8) - (a.gridIndex%8)) <= 1 && Math.floor(u.gridIndex/8) === Math.floor(a.gridIndex/8)) {
                        if(a !== u) a.stats.ap += 25 * count;
                    }
                });
            }
            if (u.combat.itemEffects.shroud) {
                const targetX = u.gridIndex % 8;
                this.logs.push({ tick: this.tick, type: 'shroud_beam', sourceX: u.gridIndex % 8, sourceY: Math.floor(u.gridIndex/8), team: u.team });
                activeUnits.forEach(e => {
                    if (e.team !== u.team && (e.gridIndex % 8) === targetX) {
                        e.combat.shroudPenalty = e.stats.maxMana * 0.3;
                        e.stats.maxMana += e.combat.shroudPenalty;
                        this.addBuff(e, 'manaSeal', null, 0, 30); 
                        this.logs.push({ tick: this.tick, type: 'mana_update', target: e.gridIndex, currMana: e.currMana, maxMana: e.stats.maxMana });
                    }
                });
            }
            if (u.combat.itemEffects.zephyr) {
                const myX = u.gridIndex % 8;
                const myY = Math.floor(u.gridIndex / 8);
                const symX = 7 - myX;
                const symY = 5 - myY;
                const target = activeUnits.find(e => e.team !== u.team && e.gridIndex === (symY * 8 + symX));
                if(target) this.addBuff(target, 'zephyr', null, 0, 50); 
            }
            if (u.combat.itemEffects.qss) {
                this.addBuff(u, 'ccImmune', null, 0, 150); 
            }
        });
    }
}
