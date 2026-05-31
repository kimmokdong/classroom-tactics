import { FxSystem } from './battle/FxSystem.js';
import { FxRenderer } from './battle/FxRenderer.js';
import { DpsTracker } from './battle/DpsTracker.js';


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
        
        // 모듈 초기화
        this.dpsTracker = new DpsTracker();
        this.fxSystem = new FxSystem(this);
        this.fxRenderer = new FxRenderer(this.fxSystem);

        // 전투 통계 유지 (게임 앱 상태에서 참조, 없으면 생성)
        this.dpsTracker.syncWithGameState();
        this.dpsStats = this.dpsTracker.stats;

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

    spawnFx(type, x, y, options = {}) { this.fxSystem.spawnFx(type, x, y, options); }
    
    play(onEnd) {
        if(this.logs.length === 0) {
            onEnd('player');
            return;
        }
        
        // Initialize DPS Stats
        this.dpsTracker.reset(); this.dpsStats = this.dpsTracker.stats;

        // Initialize Timer
        const timerContainer = document.getElementById('battle-timer-container');
        const timerText = document.getElementById('battle-timer');
        if (timerContainer) {
            timerContainer.style.display = 'flex';
            timerContainer.style.borderColor = '#3498db';
            if (timerText) timerText.style.color = '#fff';
        }

        this.currentTick = this.logs[0].tick;
        this.resizeCanvas();
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
            
            // Update DPS UI occasionally (every 5 ticks to save performance)
            if (this.currentTick % 5 === 0) {
                this.renderDpsUI();
            }

            // Update Timer UI
            if (this.currentTick >= 0 && timerText && timerContainer) {
                if (this.currentTick >= 300) {
                    if (timerText.innerText !== '연장전') {
                        timerText.innerText = '연장전';
                        timerContainer.style.borderColor = '#e74c3c';
                        timerText.style.color = '#e74c3c';
                    }
                } else {
                    const remainSec = Math.max(0, 30 - Math.floor(this.currentTick / 10));
                    if (timerText.innerText !== remainSec.toString()) {
                        timerText.innerText = remainSec;
                    }
                }
            }
            
            if (logIndex >= this.logs.length) {
                clearInterval(this.timer);
                this.renderDpsUI(); // 전투 종료 시 최종 통계 한번 더 렌더링
                if (this.fxCanvas) {
                    setTimeout(() => {
                        cancelAnimationFrame(this.animId);
                        window.removeEventListener('resize', this.resizeCanvas);
                        this.ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
                    }, 2000);
                }
                if (timerContainer) timerContainer.style.display = 'none';
                const lastLog = this.logs[this.logs.length - 1];
                setTimeout(() => onEnd(lastLog.winner, lastLog), 1500);
            }
            
            this.currentTick++;
        }, 150); // 100ms -> 150ms로 늦춰 전체 전투 템포 조절
    }

    animate(time) {
        this.animId = requestAnimationFrame(this.animate);
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
        
        const SPRING_K = 0.3;
        const DAMPING = 0.7;
        for (let i = 0; i < this.cells.length; i++) {
            let t = this.unitTransforms[i];
            let targetY = 0;
            if (t.buffs && t.buffs.includes('zephyr')) targetY = -40; // 공중으로 띄우기
            let ax = -t.x * SPRING_K;
            let ay = (targetY - t.y) * SPRING_K;
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
                if (t.buffs.includes('ccImmune') || t.buffs.includes('invincible')) {
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 40, 0, Math.PI * 2);
                    this.ctx.strokeStyle = t.buffs.includes('invincible') ? 'rgba(255, 215, 0, 0.9)' : 'rgba(255, 255, 255, 0.8)';
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.lineWidth = 3;
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                }
                if (t.buffs.includes('zephyr')) {
                    // 회오리 이펙트 (Tornado)
                    const time = performance.now() / 150;
                    this.ctx.strokeStyle = `rgba(200, 210, 220, 0.9)`;
                    this.ctx.lineWidth = 4;
                    for (let j = 0; j < 6; j++) {
                        this.ctx.beginPath();
                        const phase = time + j;
                        const w = 15 + j * 6; // gets wider at the top
                        const h = 5 + j * 2;
                        const yOffset = 40 - j * 12; // start from bottom, go up
                        const xOffset = Math.sin(phase) * (8 + j); // sway left and right
                        this.ctx.ellipse(xOffset, yOffset, w, h, 0, 0, Math.PI * 2);
                        this.ctx.stroke();
                    }
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
            
            this.fxRenderer.renderParticle(p, this.ctx, this.fxCanvas);
            
            this.ctx.restore();
        }
        
        if (this.screenFlash > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash})`;
            this.ctx.fillRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
            this.screenFlash -= 0.05;
        }
    }

    executeAction(action) {
        if (action.type === 'spawn') {
            const cell = this.cells[action.target];
            if (!cell) return;
            const uDiv = document.createElement('div');
            uDiv.className = `unit-character tier-${action.unit.tier} star-${action.unit.star || 1}`;
            if (action.unit.team === 'enemy') uDiv.classList.add('is-enemy');
            uDiv.innerHTML = `
                <div class="status-icons"></div>
                <div style="font-size: 0.6rem; margin-bottom: 2px;">⭐⭐⭐</div>
                <span class="unit-icon">${action.unit.icon || '🐶'}</span>
                <span class="unit-name">${action.unit.name}</span>
                <div class="bars-wrapper">
                    <div class="hp-container">
                        <div class="hp-fill" style="width: 100%;"></div>
                        <div class="shield-fill" style="width: 0%;"></div>
                    </div>
                    <div class="mana-container"><div class="mana-fill" style="width: 0%;"></div></div>
                </div>
            `;
            uDiv.dataset.currHp = action.unit.stats.maxHp;
            uDiv.dataset.currMana = 0;
            uDiv.dataset.index = action.target;
            cell.appendChild(uDiv);
            if (!this.unitTransforms[action.target]) this.unitTransforms[action.target] = {x:0, y:0, vx:0, vy:0, buffs: []};
            
            if (!this.dpsStats) this.dpsTracker.reset(); this.dpsStats = this.dpsTracker.stats;
            this.dpsStats[action.target] = {
                name: action.unit.name,
                team: action.unit.team,
                damage: 0, tank: 0, heal: 0
            };
            
            const center = this.getCellCenter(action.target);
            this.spawnFx('aoe_ripple', center.x, center.y, {life: 0.6, color: '#9b59b6', size: 60});
        } else if (action.type === 'move') {
            const oldCell = this.cells[action.unit];
            const newCell = this.cells[action.to];
            const uDiv = oldCell.querySelector('.unit-character');
            if (uDiv) newCell.appendChild(uDiv);
            
            if (this.unitTransforms[action.unit]) {
                this.unitTransforms[action.to] = this.unitTransforms[action.unit];
                this.unitTransforms[action.unit] = {x:0, y:0, vx:0, vy:0, buffs: []};
            }
            if (this.dpsStats && this.dpsStats[action.unit]) {
                this.dpsStats[action.to] = this.dpsStats[action.unit];
                delete this.dpsStats[action.unit];
            }
        } else if (action.type === 'attack' || action.type === 'damage') {
            const sourceIdx = action.source !== undefined ? action.source : action.from;
            const targetIdx = action.target !== undefined ? action.target : action.to;
            const fromCell = sourceIdx !== undefined ? this.cells[sourceIdx] : null;
            const toCell = this.cells[targetIdx];
            
            // DPS Stats 자동 초기화 - DOM에서 유닛 정보를 읽어 없는 경우 생성
            if (!this.dpsStats) this.dpsTracker.reset(); this.dpsStats = this.dpsTracker.stats;
            const ensureStatEntry = (idx, cell) => {
                if (idx === undefined || this.dpsStats[idx]) return;
                if (!cell) return;
                const uDiv = cell.querySelector('.unit-character');
                if (!uDiv) return;
                this.dpsStats[idx] = {
                    name: uDiv.querySelector('.unit-name')?.innerText || `Unit_${idx}`,
                    team: uDiv.classList.contains('is-enemy') ? 'enemy' : 'player',
                    damage: 0, tank: 0, heal: 0
                };
            };
            ensureStatEntry(sourceIdx, fromCell);
            ensureStatEntry(targetIdx, toCell);

            // Update DPS Stats
            if (sourceIdx !== undefined && this.dpsStats[sourceIdx]) {
                this.dpsStats[sourceIdx].damage += action.dmg || 0;
            }
            if (targetIdx !== undefined && this.dpsStats[targetIdx]) {
                this.dpsStats[targetIdx].tank += action.dmg || 0;
            }
            
            if (!toCell) return;
            
            const dmgText = document.createElement('div');
            let classes = ['dmg-text', action.dmgType || 'physical'];
            if (action.isCrit) classes.push('crit');
            if (action.type === 'attack') classes.push('basic-attack');
            else if (action.type === 'damage') classes.push('skill-attack');
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
            const fromIdx = sourceIdx;
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
                        this.spawnFx('projectile', c1.x, c1.y, {vx: nx*15, vy: ny*15, targetX: c2.x, targetY: c2.y, life: 1, color: color, size: 6});
                    } else if (action.fxType === 'banana') {
                        this.spawnFx('banana_proj', c1.x, c1.y, {vx: nx*12, vy: ny*12, targetX: c2.x, targetY: c2.y, life: 1, color: '#f1c40f', size: 10});
                    } else if (action.fxType === 'fire_red') {
                        this.spawnFx('fire_red_proj', c1.x, c1.y, {vx: nx*18, vy: ny*18, targetX: c2.x, targetY: c2.y, life: 1, color: '#e74c3c', size: 8});
                    } else if (action.fxType === 'dash_slash' || action.fxType === 'single_hit') {
                        this.spawnFx('single_hit', c2.x, c2.y, {life: 0.3, color: color, size: 20, angle: Math.atan2(ny, nx)});
                    } else if (action.fxType === 'lightning') {
                        this.spawnFx('lightning', c1.x, c1.y, {targetX: c2.x, targetY: c2.y, life: 0.2, color: '#00d2ff'});
                    } else if (action.fxType === 'bramble') {
                        this.spawnFx('bramble', c1.x, c1.y, {life: 0.3, color: '#e74c3c', size: 30});
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
                    if (action.targetCombat) {
                        const critChanceEl = document.getElementById('info-critChance'); if(critChanceEl) critChanceEl.innerText = Math.round((action.targetCombat.critChance || 0)*100) + '%';
                        const critDmgEl = document.getElementById('info-critDmg'); if(critDmgEl) critDmgEl.innerText = Math.round((action.targetCombat.critDmg || 1.5)*100) + '%';
                        const dmgAmpEl = document.getElementById('info-dmgAmp'); if(dmgAmpEl) dmgAmpEl.innerText = '+' + Math.round((action.targetCombat.dmgAmp || 0)*100) + '%';
                        const dmgReducEl = document.getElementById('info-dmgReduc'); if(dmgReducEl) dmgReducEl.innerText = Math.round((action.targetCombat.dmgReduc || 0)*100) + '%';
                        const vampEl = document.getElementById('info-vamp'); if(vampEl) vampEl.innerText = Math.round((action.targetCombat.vamp || 0)*100) + '%';
                        const manaRegenEl = document.getElementById('info-manaRegen'); if(manaRegenEl) manaRegenEl.innerText = '+' + ((action.targetCombat.teamManaRegen || 0) + (action.targetCombat.artManaRegen || 0));
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
                    if (action.attackerCombat) {
                        const critChanceEl = document.getElementById('info-critChance'); if(critChanceEl) critChanceEl.innerText = Math.round((action.attackerCombat.critChance || 0)*100) + '%';
                        const critDmgEl = document.getElementById('info-critDmg'); if(critDmgEl) critDmgEl.innerText = Math.round((action.attackerCombat.critDmg || 1.5)*100) + '%';
                        const dmgAmpEl = document.getElementById('info-dmgAmp'); if(dmgAmpEl) dmgAmpEl.innerText = '+' + Math.round((action.attackerCombat.dmgAmp || 0)*100) + '%';
                        const dmgReducEl = document.getElementById('info-dmgReduc'); if(dmgReducEl) dmgReducEl.innerText = Math.round((action.attackerCombat.dmgReduc || 0)*100) + '%';
                        const vampEl = document.getElementById('info-vamp'); if(vampEl) vampEl.innerText = Math.round((action.attackerCombat.vamp || 0)*100) + '%';
                        const manaRegenEl = document.getElementById('info-manaRegen'); if(manaRegenEl) manaRegenEl.innerText = '+' + ((action.attackerCombat.teamManaRegen || 0) + (action.attackerCombat.artManaRegen || 0));
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
            if (this.unitTransforms[action.target]) {
                this.unitTransforms[action.target].buffs = [];
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
        } else if (action.type === 'gold_drop') {
            const cell = this.cells[action.target];
            if (cell) {
                const goldText = document.createElement('div');
                goldText.className = 'dmg-text heal';
                goldText.style.color = '#f1c40f'; // Gold color
                goldText.style.textShadow = '0 0 4px #000';
                goldText.innerText = `+${action.amount}G`;
                cell.appendChild(goldText);
                setTimeout(() => { if(goldText.parentNode) goldText.parentNode.removeChild(goldText); }, 1000);
            }
            if (window.gameApp && window.gameApp.state) {
                window.gameApp.state.gold += action.amount;
                window.gameApp.updateHeader();
            }
            const logEl = document.getElementById('battle-log');
            if (logEl) {
                const li = document.createElement('li');
                li.style.color = '#f39c12';
                li.style.fontSize = '0.85rem';
                li.style.borderBottom = '1px dashed #eee';
                li.style.paddingBottom = '3px';
                li.innerHTML = `💰 <strong>${action.unitName}</strong>(이)가 적을 처치하여 ${action.amount}골드 획득!`;
                logEl.appendChild(li);
                logEl.scrollTop = logEl.scrollHeight;
            }
        } else if (action.type === 'heal') {
            const toCell = this.cells[action.target];
            if (!toCell) return;
            
            // Update heal DPS Stats
            if (!this.dpsStats) this.dpsTracker.reset(); this.dpsStats = this.dpsTracker.stats;
            if (this.dpsStats[action.target]) {
                this.dpsStats[action.target].heal += action.amount || 0;
            } else {
                const uDiv = toCell.querySelector('.unit-character');
                if (uDiv) {
                    this.dpsStats[action.target] = {
                        name: uDiv.querySelector('.unit-name')?.innerText || `Unit_${action.target}`,
                        team: uDiv.classList.contains('is-enemy') ? 'enemy' : 'player',
                        damage: 0, tank: 0, heal: action.amount || 0
                    };
                }
            }
            
            const healText = document.createElement('div');
            healText.className = action.healType === 'mana' ? 'dmg-text heal mana-heal' : 'dmg-text heal';
            healText.innerText = `+${action.amount}`;
            if (action.healType === 'mana') {
                healText.innerText += ' 마나';
                healText.style.color = '#3b82f6';
                healText.style.textShadow = '0 0 4px #000';
            }
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
        } else if (action.type === 'mana_update') {
            const cell = this.cells[action.target];
            if (!cell) return;
            const targetDiv = cell.querySelector('.unit-character');
            const manaFill = cell.querySelector('.mana-fill');
            if (manaFill && action.maxMana > 0) {
                const pct = Math.max(0, Math.min(100, (action.currMana / action.maxMana) * 100));
                manaFill.style.width = `${pct}%`;
            }
            if (targetDiv) {
                targetDiv.dataset.currMana = action.currMana;
                if (action.maxMana !== undefined) targetDiv.dataset.maxMana = action.maxMana;
                
                if (targetDiv.dataset.viewing === 'true') {
                    const manaEl = document.getElementById('info-mana');
                    if (manaEl) manaEl.innerText = Math.max(0, Math.round(action.currMana));
                    if (action.maxMana !== undefined) {
                        const maxManaEl = document.getElementById('info-max-mana');
                        if (maxManaEl) maxManaEl.innerText = Math.max(0, Math.round(action.maxMana));
                    }
                }
            }
        } else if (action.type === 'titans_max') {
            const cell = this.cells[action.target];
            if(cell) {
                const uDiv = cell.querySelector('.unit-character');
                if (uDiv) uDiv.classList.add('titans-max');
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
                if (action.vfx && action.vfx.includes('fire')) color = '#f44336';
                if (action.vfx && action.vfx.includes('heal')) color = '#4caf50';
                if (action.vfx && action.vfx.includes('slam')) color = '#ffd700';

                let prevCenter = casterCenter;
                const schoolGlobalFx = ['school_slam', 'school_shield', 'school_heal', 'school_piano', 'school_math', 'school_principal', 'school_picasso', 'school_foreign', 'school_blackhole', 'school_donation', 'school_quant'];
                const lowTierIds = [
                    'u1_1','u1_2','u1_3','u1_4','u1_5','u1_6','u1_7','u1_8','u1_9','u1_10',
                    'u2_1','u2_2','u2_3','u2_4','u2_5','u2_6','u2_7','u2_8','u2_9','u2_10','u2_11','u2_12',
                    'u3_1','u3_2','u3_3','u3_4','u3_5','u3_6','u3_7','u3_8','u3_9','u3_10','u3_11','u3_12'
                ];
                
                if (lowTierIds.includes(action.fxType)) {
                    this.spawnFx(action.fxType, casterCenter.x, casterCenter.y, { targets: action.targets, color: color });
                } else {
                    if (schoolGlobalFx.includes(action.fxType)) {
                        if (action.fxType === 'school_blackhole') {
                            this.spawnFx(action.fxType, this.fxCanvas.width/2, this.fxCanvas.height/3, { targets: action.targets, life: 2.5 });
                        } else if (action.fxType === 'school_foreign') {
                            this.spawnFx(action.fxType, casterCenter.x, casterCenter.y, { targets: action.targets, life: 2.0 });
                        } else {
                            this.spawnFx(action.fxType, casterCenter.x, casterCenter.y, { targets: action.targets });
                        }
                    } else if (action.fxType === 'school_beaker' && action.targets.length > 0) {
                        const tCenter = this.getCellCenter(action.targets[0]);
                        this.spawnFx('school_beaker', casterCenter.x, casterCenter.y, { targetX: tCenter.x, targetY: tCenter.y });
                    } else if (action.fxType === 'school_pen' && action.targets.length > 0) {
                        const tCenter = this.getCellCenter(action.targets[0]);
                        this.spawnFx('school_pen', tCenter.x, tCenter.y);
                    }
                    
                    const customGlobalFx = ['mega_shield', 'holy_heal', 'piano_wave', 'silence_drop', 'paint_swipe', 'black_hole', 'super_aura', 'data_aura', 'ground_slam'];
                    if (customGlobalFx.includes(action.fxType)) {
                        this.spawnFx(action.fxType, casterCenter.x, casterCenter.y, {life: 1.5});
                    }

                    action.targets.forEach(tIdx => {
                        const tCenter = this.getCellCenter(tIdx);
                        if (action.fxType === 'single_hit' || action.fxType === 'dash_slash') {
                            this.spawnFx('single_hit', tCenter.x, tCenter.y, {life: 0.4, color: color, size: 30});
                        } else if (action.fxType === 'projectile') {
                            const dx = tCenter.x - casterCenter.x;
                            const dy = tCenter.y - casterCenter.y;
                            const dist = Math.sqrt(dx*dx + dy*dy);
                            if (dist > 0) this.spawnFx('projectile', casterCenter.x, casterCenter.y, {vx: (dx/dist)*15, vy: (dy/dist)*15, targetX: tCenter.x, targetY: tCenter.y, life: 1, color: color, size: 8});
                        } else if (action.fxType === 'aoe_ripple') {
                            const dx = tCenter.x - casterCenter.x;
                            const dy = tCenter.y - casterCenter.y;
                            const dist = Math.sqrt(dx*dx + dy*dy);
                            if (dist > 0) this.spawnFx('projectile', casterCenter.x, casterCenter.y, {vx: (dx/dist)*20, vy: (dy/dist)*20, targetX: tCenter.x, targetY: tCenter.y, life: 1, color: color, size: 6});
                            this.spawnFx('aoe_ripple', tCenter.x, tCenter.y, {life: 0.6, color: color, size: 80});
                        } else if (action.fxType === 'heal_particle') {
                            for(let i=0; i<3; i++) {
                                this.spawnFx('heal_particle', tCenter.x + (Math.random()*20-10), tCenter.y + (Math.random()*20-10), {life: 0.8, color: color});
                            }
                        } else if (action.fxType === 'aug_heal_bomb') {
                            this.spawnFx('aug_heal_bomb', tCenter.x, tCenter.y);
                        } else if (action.fxType === 'aug_thorn_reflect') {
                            const attackerCenter = this.getCellCenter(action.source);
                            if (attackerCenter) {
                                this.spawnFx('aug_thorn_reflect', tCenter.x, tCenter.y, { targetX: attackerCenter.x, targetY: attackerCenter.y });
                            }
                        } else if (action.fxType === 'chain_bounce') {
                            this.spawnFx('single_hit', tCenter.x, tCenter.y, {life: 0.3, color: color, size: 40});
                            if (action.vfx === 'triangle_ruler') {
                                const dx = tCenter.x - prevCenter.x;
                                const dy = tCenter.y - prevCenter.y;
                                const dist = Math.sqrt(dx*dx + dy*dy);
                                if (dist > 0) this.spawnFx('triangle_ruler_proj', prevCenter.x, prevCenter.y, {vx: (dx/dist)*15, vy: (dy/dist)*15, targetX: tCenter.x, targetY: tCenter.y, life: 1});
                            } else {
                                this.spawnFx('lightning', prevCenter.x, prevCenter.y, {targetX: tCenter.x, targetY: tCenter.y, life: 0.4, color: color});
                            }
                            prevCenter = tCenter;
                        } else if (action.fxType === 'beam') {
                            const dx = tCenter.x - casterCenter.x;
                            const dy = tCenter.y - casterCenter.y;
                            const dist = Math.sqrt(dx*dx + dy*dy);
                            if (dist > 0) {
                                this.spawnFx('projectile', casterCenter.x, casterCenter.y, {vx: (dx/dist)*25, vy: (dy/dist)*25, targetX: tCenter.x, targetY: tCenter.y, life: 1.5, color: color, size: 12, isGlobalNuke: true});
                            }
                        } else if (action.fxType === 'judge_pen') {
                            this.spawnFx('judge_pen', tCenter.x, tCenter.y, {life: 0.8});
                        } else if (action.fxType === 'mega_shield') {
                            this.spawnFx('shield_buff', tCenter.x, tCenter.y, {life: 1.0});
                        } else if (action.fxType === 'holy_heal') {
                            this.spawnFx('heal_sparkle', tCenter.x, tCenter.y, {life: 1.5});
                        } else if (action.fxType === 'paint_swipe') {
                            this.spawnFx('paint_splatter', tCenter.x, tCenter.y, {life: 1.0});
                        }
                    });
                }
            }
            
            if (action.castTime && this.fxCanvas) {
                this.hitStopUntil = performance.now() + action.castTime;
            } else if (action.type === 'broadcast_silence' && this.fxCanvas) {
                this.hitStopUntil = performance.now() + 1500;
            } else if (action.type === 'spirit_transfer' && this.fxCanvas) {
                this.hitStopUntil = performance.now() + 800;
            } else if (action.hitStop && this.fxCanvas) {
                this.hitStopUntil = performance.now() + 150;
            }
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
                        else if(bType === 'ccImmune') { icon = '🌟'; bg = '#f1c40f'; }
                        else if(bType === 'zephyr') { icon = '🌪️'; bg = '#bdc3c7'; }
                        else if(bType === 'antiHeal') { icon = '💔'; bg = '#c0392b'; }
                        else if(bType === 'morello') { icon = '🔥'; bg = '#e67e22'; }
                        else if(bType === 'invincible') { icon = '✨'; bg = '#f39c12'; }
                        else if(bType === 'armorShred') { icon = '📉'; bg = '#7f8c8d'; }
                        else if(bType === 'mrShred') { icon = '🌀'; bg = '#8e44ad'; }
                        
                        if (icon) {
                            const iconDiv = document.createElement('div');
                            iconDiv.className = 'status-icon';
                            iconDiv.style.background = 'rgba(255, 255, 255, 0.95)';
                            iconDiv.style.border = `2px solid ${bg}`;
                            iconDiv.style.color = bg;
                            iconDiv.innerText = icon;
                            iconContainer.appendChild(iconDiv);
                        }
                    });
                }
            }
        } else if (action.type === 'spirit_transfer' && this.fxCanvas) {
            const sourceCenter = this.getCellCenter(action.source);
            const targetCenter = this.getCellCenter(action.target);
            if(sourceCenter && targetCenter) {
                const dx = targetCenter.x - sourceCenter.x;
                const dy = targetCenter.y - sourceCenter.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if(dist > 0) {
                    this.spawnFx(action.fxType || 'aug_spirit_transfer', sourceCenter.x, sourceCenter.y, { 
                        vx: (dx/dist)*15, vy: (dy/dist)*15, 
                        targetX: targetCenter.x, targetY: targetCenter.y, 
                        life: 1.0, color: '#f1c40f', size: 10 
                    });
                }
            }
        } else if (action.type === 'vfx' && this.fxCanvas) {
            const center = this.getCellCenter(action.target);
            if (!center) return;
            if (action.fxType === 'art_canvas') {
                // 실제 셀 크기를 계산하여 정확한 radius 전달
                const c0 = this.getCellCenter(0);
                const c1 = this.getCellCenter(1);
                const measuredCellSize = (c0 && c1) ? Math.abs(c1.x - c0.x) : 70;
                const radius = action.radius || 1;
                this.spawnFx('art_canvas', center.x, center.y, {
                    life: 5.0,
                    maxLife: 5.0,
                    radius: 0,
                    maxRadius: radius * measuredCellSize * 1.6
                });
            } else if (action.fxType === 'satiety_tick') {
                const count = action.count || 1;
                for (let i=0; i<3 + count; i++) {
                    const r = 20 + count * 5;
                    this.spawnFx('heal_sparkle', center.x + (Math.random()*r-r/2), center.y + (Math.random()*r-r/2), { life: 0.8 + count*0.1, color: '#f39c12' });
                }
                this.spawnFx('satiety_aura', center.x, center.y, { life: 0.8, count: count });
            } else if (action.fxType === 'mana_burn_fx') {
                this.spawnFx('mana_burn_fx', center.x, center.y, { life: 0.8 });
            } else if (action.fxType === 'mana_steal_proj') {
                const sourceCenter = this.getCellCenter(action.source);
                if(sourceCenter) {
                    const dx = center.x - sourceCenter.x;
                    const dy = center.y - sourceCenter.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if(dist > 0) {
                        this.spawnFx('mana_steal_proj', sourceCenter.x, sourceCenter.y, { 
                            vx: (dx/dist)*12, vy: (dy/dist)*12, 
                            targetX: center.x, targetY: center.y, 
                            life: 1.0, color: '#9b59b6', size: 6 
                        });
                    }
                }
            }
        } else if (action.type === 'shroud_beam' && this.fxCanvas) {
            const startXPos = (action.sourceX % 8);
            const startCell = startXPos + action.sourceY * 8;
            const endY = action.team === 'player' ? 0 : 5;
            const endCell = startXPos + endY * 8;
            
            const startPos = this.getCellCenter(startCell);
            const endPos = this.getCellCenter(endCell);
            
            this.spawnFx('beam', startPos.x, startPos.y, {
                targetX: endPos.x, targetY: endPos.y,
                color: 'rgba(155, 89, 182, 0.8)',
                size: 60,
                life: 1.5
            });
        } else if (action.type === 'sudden_death') {
            // 연장전 발동 배너 표시
            const logEl = document.getElementById('battle-log');
            if (logEl) {
                const li = document.createElement('li');
                li.style.color = '#f39c12';
                li.style.fontWeight = 'bold';
                li.style.fontSize = '1.1rem';
                li.style.borderBottom = '2px solid #f39c12';
                li.style.paddingBottom = '6px';
                li.style.textAlign = 'center';
                li.style.background = 'rgba(243, 156, 18, 0.1)';
                li.style.borderRadius = '8px';
                li.style.padding = '8px';
                li.innerHTML = `⚡ <strong style="color:#e74c3c;">연장전(Sudden Death) 발동!</strong><br><span style="font-size:0.8rem; color:#7f8c8d;">공속 ×4 | 주문력 ×2 | 회복/보호막/CC -66%</span>`;
                logEl.appendChild(li);
                logEl.scrollTop = logEl.scrollHeight;
            }
            // 화면 플래시 효과
            if (this.fxCanvas) {
                this.screenFlash = 0.6;
                this.hitStopUntil = performance.now() + 800;
            }
        } else if (action.type === 'changche_lv1' && this.fxCanvas) {
            if (action.targets) {
                action.targets.forEach(tIdx => {
                    const center = this.getCellCenter(tIdx);
                    if (center) this.spawnFx('changche_1_hit', center.x, center.y);
                });
            }
        } else if (action.type === 'changche_lv3' && this.fxCanvas) {
            for (let i = 0; i < this.cells.length; i++) {
                const uDiv = this.cells[i].querySelector('.unit-character');
                if (uDiv && !uDiv.classList.contains('is-enemy')) {
                    const center = this.getCellCenter(i);
                    if (center) this.spawnFx('changche_3_buff', center.x, center.y);
                }
            }
        } else if (action.type === 'donation_items' && this.fxCanvas) {
            const center = this.getCellCenter(action.target);
            if (center) {
                // 기부천사 주변 상하좌우 아군 위치 탐색하여 투사체 대상으로 전달
                const allyPositions = [];
                const cols = 7; // 7x4 그리드
                const row = Math.floor(action.target / cols);
                const col = action.target % cols;
                const adjacentOffsets = [
                    { dr: -1, dc: 0 }, // 상
                    { dr: 1, dc: 0 },  // 하
                    { dr: 0, dc: -1 }, // 좌
                    { dr: 0, dc: 1 }   // 우
                ];
                adjacentOffsets.forEach(({ dr, dc }) => {
                    const nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < 4 && nc >= 0 && nc < cols) {
                        const nIdx = nr * cols + nc;
                        const cell = this.cells[nIdx];
                        if (cell) {
                            const uDiv = cell.querySelector('.unit-character');
                            if (uDiv && !uDiv.classList.contains('is-enemy')) {
                                const allyCenter = this.getCellCenter(nIdx);
                                if (allyCenter) allyPositions.push(allyCenter);
                            }
                        }
                    }
                });
                this.spawnFx('donation_items_buff', center.x, center.y, { allyPositions: allyPositions });
            }
        } else if (action.type === 'cpr_revive' && this.fxCanvas) {
            const center = this.getCellCenter(action.target);
            if (center) {
                this.spawnFx('holy_heal', center.x, center.y, { life: 1.5 });
                this.spawnFx('heal_sparkle', center.x, center.y, { life: 1.5 });
            }
            
            const cell = this.cells[action.target];
            if (cell) {
                const uDiv = cell.querySelector('.unit-character');
                if (uDiv) {
                    uDiv.style.opacity = '1';
                    uDiv.style.transition = 'none';
                    uDiv.dataset.currHp = action.hp;
                    const hpFill = cell.querySelector('.hp-fill');
                    if (hpFill) hpFill.style.width = '30%'; // CPR heal % (approx)
                }
            }
        }
    }

    renderDpsUI() { this.dpsTracker.renderUI(); }
}
