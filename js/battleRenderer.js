export class BattleRenderer {
    constructor(logs, boardEl) {
        this.logs = logs;
        this.boardEl = boardEl;
        this.currentTick = 0;
        this.timer = null;
        this.cells = Array.from(boardEl.children);
    }
    
    play(onEnd) {
        if(this.logs.length === 0) {
            onEnd('player');
            return;
        }
        
        let logIndex = 0;
        
        this.timer = setInterval(() => {
            while (logIndex < this.logs.length && this.logs[logIndex].tick <= this.currentTick) {
                const action = this.logs[logIndex];
                this.executeAction(action);
                logIndex++;
            }
            
            if (logIndex >= this.logs.length) {
                clearInterval(this.timer);
                const lastLog = this.logs[this.logs.length - 1];
                setTimeout(() => onEnd(lastLog.winner, lastLog), 1500);
            }
            
            this.currentTick++;
        }, 100);
    }

    executeAction(action) {
        if (action.type === 'move') {
            const oldCell = this.cells[action.unit];
            const newCell = this.cells[action.to];
            const uDiv = oldCell.querySelector('.unit-character');
            if (uDiv) newCell.appendChild(uDiv);
        } else if (action.type === 'attack' || action.type === 'damage') {
            const fromCell = action.from !== undefined ? this.cells[action.from] : null;
            const toCell = this.cells[action.to !== undefined ? action.to : action.target];
            if (!toCell) return;
            
            const dmgText = document.createElement('div');
            let classes = ['dmg-text', action.dmgType || 'physical'];
            if (action.isCrit) classes.push('crit');
            dmgText.className = classes.join(' ');
            dmgText.innerText = action.isCrit ? `💥-${action.dmg}` : `-${action.dmg}`;
            // 데미지 텍스트 겹침 방지를 위한 랜덤 오프셋
            const scatterX = Math.floor(Math.random() * 50 - 25);
            const scatterY = Math.floor(Math.random() * 40 - 20);
            dmgText.style.marginLeft = `${scatterX}px`;
            dmgText.style.marginTop = `${scatterY}px`;
            toCell.appendChild(dmgText);
            
            const hpFill = toCell.querySelector('.hp-fill');
            if(hpFill) {
                const pct = Math.max(0, (action.currHp / action.maxHp) * 100);
                hpFill.style.width = `${pct}%`;
            }

            const shieldFill = toCell.querySelector('.shield-fill');
            if(shieldFill && action.currShield !== undefined) {
                const shieldPct = Math.max(0, (action.currShield / action.maxHp) * 100);
                shieldFill.style.width = `${Math.min(100, shieldPct)}%`;
            }

            const targetManaFill = toCell.querySelector('.mana-fill');
            if(targetManaFill && action.targetMaxMana > 0) {
                const pct = Math.max(0, Math.min(100, (action.targetMana / action.targetMaxMana) * 100));
                targetManaFill.style.width = `${pct}%`;
            }

            let uDiv = null;
            if (fromCell) {
                const attackerManaFill = fromCell.querySelector('.mana-fill');
                if(attackerManaFill && action.attackerMaxMana > 0) {
                    const pct = Math.max(0, Math.min(100, (action.attackerMana / action.attackerMaxMana) * 100));
                    attackerManaFill.style.width = `${pct}%`;
                }
                
                uDiv = fromCell.querySelector('.unit-character');
                if(uDiv) {
                    uDiv.style.transform = 'scale(1.2)';
                    setTimeout(() => { if(uDiv) uDiv.style.transform = 'scale(1)'; }, 100);
                }
            }
            
            // 실시간 유닛 정보 업데이트 (현재 보고 있는 유닛이면 갱신)
            const targetDiv = toCell.querySelector('.unit-character');
            if (targetDiv) {
                targetDiv.dataset.currHp = action.currHp;
                targetDiv.dataset.currMana = action.targetMana;
                if (action.targetStats) {
                    targetDiv.dataset.currAd = action.targetStats.ad;
                    targetDiv.dataset.currAp = action.targetStats.ap;
                    targetDiv.dataset.currArmor = action.targetStats.armor;
                    targetDiv.dataset.currMr = action.targetStats.mr;
                    targetDiv.dataset.currAs = action.targetStats.as;
                }
                if (targetDiv.dataset.viewing === 'true') {
                    const hpEl = document.getElementById('info-hp');
                    if (hpEl) hpEl.innerText = Math.max(0, Math.round(action.currHp));
                    const manaEl = document.getElementById('info-mana');
                    if (manaEl) manaEl.innerText = Math.max(0, Math.round(action.targetMana));
                    
                    if (action.targetStats) {
                        const adEl = document.getElementById('info-ad'); if(adEl) adEl.innerText = Math.round(action.targetStats.ad);
                        const apEl = document.getElementById('info-ap'); if(apEl) apEl.innerText = Math.round(action.targetStats.ap) + '%';
                        const armorEl = document.getElementById('info-armor'); if(armorEl) armorEl.innerText = Math.round(action.targetStats.armor);
                        const mrEl = document.getElementById('info-mr'); if(mrEl) mrEl.innerText = Math.round(action.targetStats.mr);
                        const asEl = document.getElementById('info-as'); if(asEl) asEl.innerText = action.targetStats.as.toFixed(2);
                    }
                }
            }
            if (uDiv) {
                uDiv.dataset.currMana = action.attackerMana;
                if (action.attackerStats) {
                    uDiv.dataset.currAd = action.attackerStats.ad;
                    uDiv.dataset.currAp = action.attackerStats.ap;
                    uDiv.dataset.currArmor = action.attackerStats.armor;
                    uDiv.dataset.currMr = action.attackerStats.mr;
                    uDiv.dataset.currAs = action.attackerStats.as;
                }
                if (uDiv.dataset.viewing === 'true') {
                    const manaEl = document.getElementById('info-mana');
                    if (manaEl) manaEl.innerText = Math.max(0, Math.round(action.attackerMana));
                    
                    if (action.attackerStats) {
                        const adEl = document.getElementById('info-ad'); if(adEl) adEl.innerText = Math.round(action.attackerStats.ad);
                        const apEl = document.getElementById('info-ap'); if(apEl) apEl.innerText = Math.round(action.attackerStats.ap) + '%';
                        const armorEl = document.getElementById('info-armor'); if(armorEl) armorEl.innerText = Math.round(action.attackerStats.armor);
                        const mrEl = document.getElementById('info-mr'); if(mrEl) mrEl.innerText = Math.round(action.attackerStats.mr);
                        const asEl = document.getElementById('info-as'); if(asEl) asEl.innerText = action.attackerStats.as.toFixed(2);
                    }
                }
            }
            
            setTimeout(() => {
                if (dmgText.parentNode) dmgText.parentNode.removeChild(dmgText);
            }, 500);
            
        } else if (action.type === 'die') {
            const cell = this.cells[action.target];
            const uDiv = cell.querySelector('.unit-character');
            if(uDiv) {
                uDiv.style.transition = 'opacity 0.2s';
                uDiv.style.opacity = '0';
                setTimeout(() => { if(uDiv.parentNode) uDiv.parentNode.removeChild(uDiv); }, 200);
            }
            
            const logEl = document.getElementById('battle-log');
            if (logEl && action.unitName) {
                const nameColor = action.team === 'enemy' ? '#e74c3c' : '#2980b9'; // 빨간색(적) 파란색(아군)
                const li = document.createElement('li');
                li.style.color = '#7f8c8d';
                li.style.fontSize = '0.85rem';
                li.style.borderBottom = '1px dashed #eee';
                li.style.paddingBottom = '3px';
                li.innerHTML = `💀 <strong style="color:${nameColor};">${action.unitName}</strong> 처치됨`;
                logEl.appendChild(li);
                logEl.scrollTop = logEl.scrollHeight;
            }
        } else if (action.type === 'heal') {
            const toCell = this.cells[action.target];
            if (!toCell) return;
            
            const healText = document.createElement('div');
            healText.className = 'dmg-text heal';
            healText.innerText = `+${action.amount}`;
            // 힐 텍스트 겹침 방지를 위한 랜덤 오프셋
            const scatterX = Math.floor(Math.random() * 40 - 20);
            const scatterY = Math.floor(Math.random() * 30 - 15);
            healText.style.marginLeft = `${scatterX}px`;
            healText.style.marginTop = `${scatterY}px`;
            toCell.appendChild(healText);
            
            const hpFill = toCell.querySelector('.hp-fill');
            if(hpFill) {
                const pct = Math.max(0, (action.currHp / action.maxHp) * 100);
                hpFill.style.width = `${pct}%`;
            }
            
            const targetDiv = toCell.querySelector('.unit-character');
            if (targetDiv) {
                targetDiv.dataset.currHp = action.currHp;
                if (targetDiv.dataset.viewing === 'true') {
                    const hpEl = document.getElementById('info-hp');
                    if (hpEl) hpEl.innerText = Math.max(0, Math.round(action.currHp));
                }
            }
        } else if (action.type === 'skill') {
            const casterCell = this.cells[action.caster];
            if (!casterCell) return;
            const uDiv = casterCell.querySelector('.unit-character');
            
            if(uDiv) {
                uDiv.style.transform = 'translateY(-10px) scale(1.3)';
                setTimeout(() => { if(uDiv) uDiv.style.transform = ''; }, 200);
            }
            
            const logEl = document.getElementById('battle-log');
            if (logEl && action.unitName) {
                const nameColor = action.team === 'enemy' ? '#e74c3c' : '#2980b9';
                const li = document.createElement('li');
                li.style.color = '#2c3e50';
                li.style.fontSize = '0.85rem';
                li.style.borderBottom = '1px dashed #eee';
                li.style.paddingBottom = '3px';
                
                li.innerHTML = `✨ <strong style="color:${nameColor};">${action.unitName}</strong> - <span class="log-skill-name" style="color:#d81b60; font-weight:bold; cursor:help; text-decoration:underline dashed;">[${action.skillName}]</span> 사용!`;
                
                const skillSpan = li.querySelector('.log-skill-name');
                if (skillSpan) {
                    skillSpan.onmouseover = (e) => {
                        const tooltip = document.getElementById('tooltip');
                        tooltip.style.display = 'block';
                        tooltip.style.left = (e.pageX + 10) + 'px';
                        tooltip.style.top = (e.pageY + 10) + 'px';
                        tooltip.innerHTML = `<strong style="color:#d81b60">${action.skillName}</strong><br><span style="font-size:0.85rem; color:#555;">${action.skillDesc || '설명 없음'}</span>`;
                    };
                    skillSpan.onmouseout = () => {
                        document.getElementById('tooltip').style.display = 'none';
                    };
                }
                
                logEl.appendChild(li);
                logEl.scrollTop = logEl.scrollHeight;
            }
            
            const nameText = document.createElement('div');
            nameText.className = 'skill-text';
            nameText.innerText = action.skillName;
            casterCell.appendChild(nameText);
            setTimeout(() => { if(nameText.parentNode) nameText.parentNode.removeChild(nameText); }, 800);

            if (action.targets && action.vfx) {
                action.targets.forEach(tIdx => {
                    const tCell = this.cells[tIdx];
                    if(tCell) {
                        const vfxDiv = document.createElement('div');
                        vfxDiv.className = `vfx ${action.vfx}`;
                        tCell.appendChild(vfxDiv);
                        setTimeout(() => { if(vfxDiv.parentNode) vfxDiv.parentNode.removeChild(vfxDiv); }, 600);
                    }
                });
            }
        } else if (action.type === 'buff_update') {
            const cell = this.cells[action.target];
            if(cell) {
                const iconContainer = cell.querySelector('.status-icons');
                if(iconContainer) {
                    iconContainer.innerHTML = '';
                    const uniqueBuffs = [...new Set(action.buffs)];
                    uniqueBuffs.forEach(bType => {
                        let icon = '', bg = '';
                        if(bType === 'stun') { icon = '💫'; bg = '#f1c40f'; }
                        else if(bType === 'taunt') { icon = '💢'; bg = '#e74c3c'; }
                        else if(bType === 'debuff') { icon = '⬇️'; bg = '#95a5a6'; }
                        else if(bType === 'manaSeal') { icon = '🔇'; bg = '#9b59b6'; }
                        else if(bType === 'buff') { icon = '⬆️'; bg = '#4caf50'; }
                        else if(bType === 'shield') { icon = '🛡️'; bg = '#b0bec5'; }
                        else if(bType === 'heal') { icon = '💚'; bg = '#2ecc71'; }
                        
                        if (icon) {
                            const iconDiv = document.createElement('div');
                            iconDiv.className = 'status-icon';
                            iconDiv.style.background = bg;
                            iconDiv.innerText = icon;
                            iconContainer.appendChild(iconDiv);
                        }
                    });
                }
            }
        }
    }
}
