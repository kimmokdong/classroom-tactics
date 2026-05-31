import { UNIT_POOL, EXP_TABLE } from '../data.js';
import { SHOP_PROBABILITIES } from '../core/constants.js';

export class ShopManager {
    constructor(gameApp) {
        this.app = gameApp;
    }

    getMaxExp(level) {
        let max = EXP_TABLE[level];
        if (!max) return null;
        if (this.app.state.globalBuffs && this.app.state.globalBuffs.earlyGraduation) return Math.floor(max * 0.7);
        return max;
    }

    addExp(amount) {
        if (this.app.state.level >= 10) return;
        this.app.state.exp += amount;

        while (this.app.state.level < 10) {
            const req = this.getMaxExp(this.app.state.level);
            if (this.app.state.exp >= req) {
                this.app.state.exp -= req;
                this.app.state.level++;
                if (this.app.state.level === 7 && this.app.state.globalBuffs && this.app.state.globalBuffs.cramming) {
                    this.app.state.gold += 40;
                    this.app.state.globalBuffs.cramming = false;
                }
            } else {
                break;
            }
        }
        this.app.updateHeader();
    }

    buyExp() {
        if (this.app.state.gold >= 4 && this.app.state.level < 10) {
            this.app.state.gold -= 4;
            this.addExp(4);
        } else if (this.app.state.level >= 10) {
            alert("최대 레벨입니다.");
        } else {
            alert("골드가 부족합니다.");
        }
    }

    refreshShop(isFree = false) {
        const cost = (this.app.state.globalBuffs && this.app.state.globalBuffs.rerollDiscountEndWorld >= this.app.state.stage[0]) ? 1 : 2;
        if (!isFree) {
            if (this.app.state.freeRerolls > 0) {
                this.app.state.freeRerolls--;
                isFree = true;
            } else if (this.app.state.gold >= cost) {
                this.app.state.gold -= cost;
            } else {
                alert("골드가 부족합니다.");
                return;
            }
        }

        // Return unsold units to the shared pool
        if (this.app.state.shop) {
            for (let u of this.app.state.shop) {
                if (u !== null) {
                    this.app.state.sharedPool[u.id] = (this.app.state.sharedPool[u.id] || 0) + 1;
                }
            }
        }

        const effectiveLevel = Math.min(10, this.app.state.level + (this.app.state.highEndShopping ? 1 : 0));
        const probs = SHOP_PROBABILITIES[effectiveLevel] || SHOP_PROBABILITIES[9];

        // 3-star ban logic: Check player board and bench for 3-star units
        const owned3Stars = new Set();
        const allPlayerUnits = [...this.app.state.board, ...this.app.state.bench];
        for (let u of allPlayerUnits) {
            if (u && u.star === 3) {
                owned3Stars.add(u.id);
            }
        }

        this.app.state.shop = Array(5).fill(null).map(() => {
            let roll = Math.random() * 100;
            let sum = 0, selectedTier = 1;
            for (let i = 0; i < 5; i++) {
                sum += probs[i];
                if (roll <= sum) { selectedTier = i + 1; break; }
            }
            if (selectedTier === 1 && this.app.state.globalBuffs && this.app.state.globalBuffs.noTier1) selectedTier = 2;

            // Build weighted pool from sharedPool
            const availableUnits = UNIT_POOL.filter(u => u.tier === selectedTier && !owned3Stars.has(u.id) && this.app.state.sharedPool[u.id] > 0);
            
            if (availableUnits.length > 0) {
                // Flatten the pool according to remaining copies
                let weightedPool = [];
                for (let u of availableUnits) {
                    let copies = this.app.state.sharedPool[u.id];
                    for (let c = 0; c < copies; c++) weightedPool.push(u);
                }
                
                if (weightedPool.length > 0) {
                    const picked = weightedPool[Math.floor(Math.random() * weightedPool.length)];
                    this.app.state.sharedPool[picked.id] -= 1;
                    return { ...picked };
                }
            }
            return null;
        });

        this.app.updateHeader();
        this.renderShop();
    }

    renderShop() {
        const shopEl = document.getElementById('shop-slots');
        shopEl.innerHTML = '';

        if (!this.app.state.shop || this.app.state.shop.length === 0 || this.app.state.shop[0] === null) {
            this.refreshShop(true);
            return;
        }

        for (let i = 0; i < 5; i++) {
            const randomUnit = this.app.state.shop[i];
            const card = document.createElement('div');

            if (!randomUnit) {
                card.className = 'shop-card';
                card.style.visibility = 'hidden';
                shopEl.appendChild(card);
                continue;
            }

            card.className = 'shop-card tier-' + randomUnit.tier;
            card.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: 5px;">${randomUnit.icon || '🧑‍🎓'}</div>
                <h4 style="margin-bottom: 3px;">${randomUnit.name}</h4>
                <p style="font-size: 0.8rem; color: #666;">${Array.isArray(randomUnit.subject) ? randomUnit.subject.join('/') : randomUnit.subject} / ${Array.isArray(randomUnit.club) ? randomUnit.club.join('/') : randomUnit.club}</p>
                <b style="color: #d81b60; margin-top: auto;">${randomUnit.tier}G</b>
            `;

            card.onmouseover = (e) => {
                const tooltip = document.getElementById('tooltip');
                tooltip.style.display = 'block';
                tooltip.style.left = (e.pageX + 10) + 'px';
                tooltip.style.top = (e.pageY - 160) + 'px';

                let skillHtml = '';
                if (randomUnit.skill) {
                    skillHtml = `
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;">
                        <strong style="color: #2c3e50; font-size: 0.9rem;">✨ ${randomUnit.skill.name}</strong>
                        <p style="font-size: 0.8rem; color: #555; margin-top: 4px; line-height: 1.3; white-space: pre-wrap;">${randomUnit.skill.desc}</p>
                    </div>`;
                }

                tooltip.innerHTML = `
                    <div style="font-size: 1.1rem; margin-bottom: 5px;"><strong>⭐ ${randomUnit.name}</strong> <span style="color:var(--gold-color);">(${randomUnit.tier}G)</span></div>
                    <div style="color: #666; font-size: 0.85rem; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #ccc;">
                        📚 ${Array.isArray(randomUnit.subject) ? randomUnit.subject.join('/') : randomUnit.subject} &nbsp;|&nbsp; 🏷️ ${Array.isArray(randomUnit.club) ? randomUnit.club.join('/') : randomUnit.club}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.85rem; font-weight: 600; color: #444;">
                        <div>❤️ 체력: <span style="color:#4caf50">${randomUnit.stats.hp}</span></div>
                        <div>💧 마나: <span style="color:#1e88e5">${randomUnit.stats.mana}/${randomUnit.stats.maxMana}</span></div>
                        <div>⚔️ 공격력: <span style="color:#e65100">${randomUnit.stats.ad}</span></div>
                        <div>🔮 주문력: <span style="color:#8e24aa">${randomUnit.stats.ap}%</span></div>
                        <div>🛡️ 방어: <span style="color:#795548">${randomUnit.stats.armor}</span></div>
                        <div>🌀 마저: <span style="color:#00897b">${randomUnit.stats.mr}</span></div>
                        <div>⚡ 공속: <span style="color:#e53935">${randomUnit.stats.as}</span></div>
                        <div>🎯 사거리: <span style="color:#546e7a">${randomUnit.stats.range}</span></div>
                    </div>
                    ${skillHtml}
                `;
            };
            card.onmouseout = () => {
                document.getElementById('tooltip').style.display = 'none';
            };

            card.onclick = () => {
                if (!this.app.state.shop[i]) return;

                const emptyIdx = this.app.state.bench.findIndex(u => u === null);
                if (emptyIdx === -1) {
                    console.log("대기석이 꽉 찼습니다.");
                    return;
                }

                if (this.app.state.gold >= randomUnit.tier) {
                    this.app.state.gold -= randomUnit.tier;
                    this.app.state.shop[i] = null;
                    card.style.visibility = 'hidden';

                    const newUnit = JSON.parse(JSON.stringify(randomUnit));
                    newUnit.star = 1;
                    newUnit.items = [];

                    this.app.state.bench[emptyIdx] = newUnit;
                    this.app.updateHeader();
                    this.app.renderUnits();
                    console.log(`${randomUnit.name} 구매함 (대기석 ${emptyIdx}번)`);

                    this.app.checkForUpgrade(newUnit.id);
                } else {
                    console.log("골드가 부족합니다.");
                }
            };
            shopEl.appendChild(card);
        }
    }
}
