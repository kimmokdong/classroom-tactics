export class BattleRenderer {
    constructor(logs, boardEl, fxCanvas = null) {
        this.logs = logs;
        this.boardEl = boardEl;
        this.currentTick = 0;
        this.timer = null;
        this.cells = Array.from(boardEl.children);
        
        this.fxCanvas = fxCanvas;
        this.ctx = fxCanvas ? fxCanvas.getContext('2d') : null;
        this.particles = [];
        this.unitTransforms = {};
        for(let i=0; i<this.cells.length; i++) this.unitTransforms[i] = {x:0, y:0, vx:0, vy:0};
        this.screenFlash = 0;
        this.hitStopUntil = 0;
        
        this.resizeCanvas = this.resizeCanvas.bind(this);
        this.animate = this.animate.bind(this);
        
        if (this.fxCanvas) {
            window.addEventListener('resize', this.resizeCanvas);
            this.resizeCanvas();
        }
    }

    resizeCanvas() {
        if (!this.fxCanvas || !this.boardEl) return;
        const rect = this.boardEl.getBoundingClientRect();
        this.fxCanvas.width = rect.width;
        this.fxCanvas.height = rect.height;
        this.fxCanvas.style.width = rect.width + 'px';
        this.fxCanvas.style.height = rect.height + 'px';
    }

    getCellCenter(index) {
        const cell = this.cells[index];
        if (!cell || !this.boardEl) return {x: 0, y: 0};
        const cRect = cell.getBoundingClientRect();
        const bRect = this.boardEl.getBoundingClientRect();
        return {
            x: cRect.left - bRect.left + cRect.width / 2,
            y: cRect.top - bRect.top + cRect.height / 2
        };
    }

    spawnFx(type, x, y, options = {}) {
        this.particles.push({
            type: type,
            x: x, y: y,
            vx: options.vx || 0, vy: options.vy || 0,
            life: options.life || 0.5,
            maxLife: options.life || 0.5,
            size: options.size || 20,
            color: options.color || '#fff',
            angle: options.angle || 0,
            history: [{x:x, y:y}]
        });
    }
    
    play(onEnd) {
        if(this.logs.length === 0) {
            onEnd('player');
            return;
        }
        
        let logIndex = 0;
        
        if (this.fxCanvas) {
            this.animId = requestAnimationFrame(this.animate);
        }

        this.timer = setInterval(() => {
            if (performance.now() < this.hitStopUntil) return; // Hit-stop

            while (logIndex < this.logs.length && this.logs[logIndex].tick <= this.currentTick) {
                const action = this.logs[logIndex];
                this.executeAction(action);
                logIndex++;
            }
            
            if (logIndex >= this.logs.length) {
                clearInterval(this.timer);
                if (this.fxCanvas) {
                    setTimeout(() => {
                        cancelAnimationFrame(this.animId);
                        window.removeEventListener('resize', this.resizeCanvas);
                        this.ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
                    }, 2000);
                }
                const lastLog = this.logs[this.logs.length - 1];
                setTimeout(() => onEnd(lastLog.winner, lastLog), 1500);
            }
            
            this.currentTick++;
        }, 100);
    }

    animate(time) {
        this.animId = requestAnimationFrame(this.animate);
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
        
        const SPRING_K = 0.3;
        const DAMPING = 0.7;
        for (let i = 0; i < this.cells.length; i++) {
            let t = this.unitTransforms[i];
            let ax = -t.x * SPRING_K;
            let ay = -t.y * SPRING_K;
            t.vx = (t.vx + ax) * DAMPING;
            t.vy = (t.vy + ay) * DAMPING;
            t.x += t.vx;
            t.y += t.vy;
            
            const cell = this.cells[i];
            if (cell) {
                const uDiv = cell.querySelector('.unit-character');
                if (uDiv) {
                    let scale = uDiv.dataset.fxScale || 1;
                    uDiv.style.transform = `translate(${t.x}px, ${t.y}px) scale(${scale})`;
                }
            }
            
            // 상태이상 오라(버프/실드) 캔버스 드로잉
            if (t.buffs && t.buffs.length > 0) {
                const center = this.getCellCenter(i);
                this.ctx.save();
                this.ctx.translate(center.x + t.x, center.y + t.y);
                
                if (t.buffs.includes('shield')) {
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 35, 0, Math.PI * 2);
                    this.ctx.strokeStyle = 'rgba(176, 190, 197, 0.6)';
                    this.ctx.lineWidth = 4;
                    this.ctx.stroke();
                }
                if (t.buffs.includes('buff') || t.buffs.includes('heal')) {
                    const angle = performance.now() / 300;
                    this.ctx.fillStyle = '#4caf50';
                    this.ctx.beginPath();
                    this.ctx.arc(Math.cos(angle) * 30, Math.sin(angle) * 30, 4, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                if (t.buffs.includes('stun') || t.buffs.includes('debuff') || t.buffs.includes('manaSeal')) {
                    this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(-25, -25, 50, 50);
                }
                this.ctx.restore();
            }
        }
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= 0.016; 
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            
            if (p.type === 'single_hit') {
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(p.angle || 0);
                this.ctx.strokeStyle = p.color;
                this.ctx.lineWidth = 4 * (p.life / p.maxLife);
                this.ctx.beginPath();
                this.ctx.moveTo(-p.size, -p.size);
                this.ctx.lineTo(p.size, p.size);
                this.ctx.moveTo(p.size, -p.size);
                this.ctx.lineTo(-p.size, p.size);
                this.ctx.stroke();
            } else if (p.type === 'projectile') {
                p.x += p.vx;
                p.y += p.vy;
                p.history.push({x: p.x, y: p.y});
                if(p.history.length > 5) p.history.shift();
                
                this.ctx.beginPath();
                for(let j=0; j<p.history.length; j++) {
                    const pt = p.history[j];
                    if(j===0) this.ctx.moveTo(pt.x, pt.y);
                    else this.ctx.lineTo(pt.x, pt.y);
                }
                this.ctx.strokeStyle = p.color;
                this.ctx.lineWidth = p.size;
                this.ctx.lineCap = 'round';
                this.ctx.stroke();
            } else if (p.type === 'aoe_ripple') {
                const radius = p.size * (1 - p.life / p.maxLife);
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                this.ctx.strokeStyle = p.color;
                this.ctx.lineWidth = 4;
                this.ctx.stroke();
            } else if (p.type === 'heal_particle') {
                p.y -= 1;
                this.ctx.fillStyle = p.color;
                this.ctx.font = '20px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('+', p.x, p.y);
            }
            
            this.ctx.restore();
        }
        
        if (this.screenFlash > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash})`;
            this.ctx.fillRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
            this.screenFlash -= 0.05;
        }
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
            
            // --- Canvas VFX: 타격 반동(Recoil & Dash) 및 이펙트 ---
            const targetIdx = action.to !== undefined ? action.to : action.target;
            const fromIdx = action.from !== undefined ? action.from : action.source;
            if (this.fxCanvas && targetIdx !== undefined && fromIdx !== undefined && targetIdx !== fromIdx) {
                const c1 = this.getCellCenter(fromIdx);
                const c2 = this.getCellCenter(targetIdx);
                const dx = c2.x - c1.x;
                const dy = c2.y - c1.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 0) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    if (this.unitTransforms[targetIdx]) {
                        this.unitTransforms[targetIdx].vx += nx * 6; // 뒤로 넉백
                        this.unitTransforms[targetIdx].vy += ny * 6;
                    }
                    if (this.unitTransforms[fromIdx] && action.type === 'attack') {
                        this.unitTransforms[fromIdx].vx += nx * 8; // 앞으로 대시
                        this.unitTransforms[fromIdx].vy += ny * 8;
                    }
                    let color = action.dmgType === 'magic' ? '#9c27b0' : action.dmgType === 'true' ? '#ffffff' : '#d32f2f';
                    if (action.fxType === 'projectile') {
                        this.spawnFx('projectile', c1.x, c1.y, {vx: nx*15, vy: ny*15, life: 1, color: color, size: 4});
                    } else if (action.fxType === 'dash_slash' || action.fxType === 'single_hit') {
                        this.spawnFx('single_hit', c2.x, c2.y, {life: 0.3, color: color, size: 20, angle: Math.atan2(ny, nx)});
                    }
                }
            }
            // -----------------------------------------------------
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

            if (action.targets && action.fxType && this.fxCanvas) {
                const casterCenter = this.getCellCenter(action.caster);
                let color = '#9c27b0';
                if (action.fxType === 'heal_particle') color = '#4caf50';

                action.targets.forEach(tIdx => {
                    const tCenter = this.getCellCenter(tIdx);
                    if (action.fxType === 'single_hit' || action.fxType === 'dash_slash') {
                        this.spawnFx('single_hit', tCenter.x, tCenter.y, {life: 0.4, color: color, size: 30});
                    } else if (action.fxType === 'projectile') {
                        const dx = tCenter.x - casterCenter.x;
                        const dy = tCenter.y - casterCenter.y;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist > 0) this.spawnFx('projectile', casterCenter.x, casterCenter.y, {vx: (dx/dist)*15, vy: (dy/dist)*15, life: 1, color: color, size: 6});
                    } else if (action.fxType === 'aoe_ripple') {
                        this.spawnFx('aoe_ripple', tCenter.x, tCenter.y, {life: 0.6, color: color, size: 80});
                    } else if (action.fxType === 'heal_particle') {
                        for(let i=0; i<3; i++) {
                            this.spawnFx('heal_particle', tCenter.x + (Math.random()*20-10), tCenter.y + (Math.random()*20-10), {life: 0.8, color: color});
                        }
                    } else if (action.fxType === 'chain_bounce') {
                        this.spawnFx('single_hit', tCenter.x, tCenter.y, {life: 0.3, color: color, size: 40});
                    }
                });
            }
            
            if (action.hitStop && this.fxCanvas) this.hitStopUntil = performance.now() + 150;
            if (action.screenFlash && this.fxCanvas) this.screenFlash = 0.5;

        } else if (action.type === 'buff_update') {
            const cell = this.cells[action.target];
            if(cell) {
                const iconContainer = cell.querySelector('.status-icons');
                if(iconContainer) {
                    iconContainer.innerHTML = '';
                    const uniqueBuffs = [...new Set(action.buffs)];
                    
                    if (this.unitTransforms[action.target]) {
                        this.unitTransforms[action.target].buffs = uniqueBuffs;
                    }
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
