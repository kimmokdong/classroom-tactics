export class ItemManager {
    constructor(gameApp) {
        this.app = gameApp;
    }

    getIconForItem(itemId) {
        const ICONS = {
            base_ad: '📐', base_as: '👟', base_ap: '🔦', base_mana: '🥤',
            base_armor: '🧥', base_mr: '🎧', base_hp: '🍱', base_crit: '👓',
            comb_ad_ad: '🖊️', comb_ad_as: '📋', comb_ad_ap: '📜', comb_ad_mana: '🖋️', comb_ad_armor: '📣', comb_ad_mr: '🎫', comb_ad_hp: '📓', comb_ad_crit: '📏',
            comb_as_as: '🚀', comb_as_ap: '💡', comb_as_mana: '⚡', comb_as_armor: '🎖️', comb_as_mr: '🧽', comb_as_hp: '🎟️', comb_as_crit: '📗',
            comb_ap_ap: '🎤', comb_ap_mana: '📚', comb_ap_armor: '🩹', comb_ap_mr: '🧦', comb_ap_hp: '🔥', comb_ap_crit: '💎',
            comb_mana_mana: '📦', comb_mana_armor: '📄', comb_mana_mr: '☕', comb_mana_hp: '✉️', comb_mana_crit: '🎲',
            comb_armor_armor: '🎒', comb_armor_mr: '🧣', comb_armor_hp: '♨️', comb_armor_crit: '📱',
            comb_mr_mr: '🔇', comb_mr_hp: '💌', comb_mr_crit: '👑',
            comb_hp_hp: '🧋', comb_hp_crit: '👊',
            comb_crit_crit: '🗃️'
        };
        return ICONS[itemId] || '❓';
    }

    formatItemStats(stats) {
        if (!stats) return '';
        let arr = [];
        if (stats.ad) arr.push(`공격력 <span style="color:#e65100; font-weight:bold;">+${stats.ad}</span>`);
        if (stats.as) arr.push(`공속 <span style="color:#e53935; font-weight:bold;">+${Math.round(stats.as * 100)}%</span>`);
        if (stats.ap) arr.push(`주문력 <span style="color:#8e24aa; font-weight:bold;">+${stats.ap}</span>`);
        if (stats.mana) arr.push(`마나 <span style="color:#1e88e5; font-weight:bold;">+${stats.mana}</span>`);
        if (stats.armor) arr.push(`방어력 <span style="color:#795548; font-weight:bold;">+${stats.armor}</span>`);
        if (stats.mr) arr.push(`마저 <span style="color:#00897b; font-weight:bold;">+${stats.mr}</span>`);
        if (stats.maxHp || stats.hp) arr.push(`체력 <span style="color:#4caf50; font-weight:bold;">+${stats.maxHp || stats.hp}</span>`);
        if (stats.critChance) arr.push(`치명타 <span style="color:#ffb300; font-weight:bold;">+${Math.round(stats.critChance * 100)}%</span>`);
        if (stats.vamp) arr.push(`피해흡혈 <span style="color:#ec407a; font-weight:bold;">+${Math.round(stats.vamp * 100)}%</span>`);
        return arr.length ? `(${arr.join(', ')})` : '';
    }

    renderInventory() {
        const slotsEl = document.getElementById('inventory-slots');
        if (!slotsEl) return;
        slotsEl.innerHTML = '';

        for (let i = 0; i < 12; i++) {
            const slot = document.createElement('div');
            slot.className = 'item-slot';
            slot.dataset.index = i;
            slot.style.width = '55px';
            slot.style.height = '55px';
            slot.style.background = 'rgba(255,255,255,0.5)';
            slot.style.border = '1px dashed rgba(0,0,0,0.2)';
            slot.style.borderRadius = '8px';
            slot.style.display = 'flex';
            slot.style.justifyContent = 'center';
            slot.style.alignItems = 'center';
            slot.style.position = 'relative';

            if (this.app.state.inventory[i]) {
                const itemId = this.app.state.inventory[i];
                const itemDef = this.app.ITEMS.find(it => it.id === itemId);
                if (itemDef) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'item-icon';
                    itemDiv.draggable = true;

                    const iconStr = this.getIconForItem(itemId);
                    itemDiv.innerHTML = `<span style="font-size:1.2rem;">${iconStr}</span>`;

                    itemDiv.style.width = '100%';
                    itemDiv.style.height = '100%';
                    itemDiv.style.background = itemDef.type === 'base' ? '#e2e8f0' : '#fef08a';
                    itemDiv.style.border = '2px solid ' + (itemDef.type === 'base' ? '#94a3b8' : '#eab308');
                    itemDiv.style.borderRadius = '6px';
                    itemDiv.style.display = 'flex';
                    itemDiv.style.justifyContent = 'center';
                    itemDiv.style.alignItems = 'center';
                    itemDiv.style.cursor = 'pointer';
                    itemDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';

                    itemDiv.onmouseover = (e) => {
                        if (window.isContextMenuOpen) return;
                        this.app.showCustomTooltip(e, `
                            <div style="font-weight:bold; color:${itemDef.type === 'base' ? '#475569' : '#d97706'}; font-size:1rem; margin-bottom:4px;">
                                ${iconStr} ${itemDef.name}
                                <span style="font-size:0.75rem; color:#666; font-weight:normal; margin-left:4px;">${this.formatItemStats(itemDef.stats)}</span>
                            </div>
                            <div style="color:#475569;">${itemDef.desc}</div>
                            ${itemDef.type === 'base' ? '<div style="font-size:0.75rem; color:#64748b; margin-top:5px; text-align:right;">좌클릭하여 조합표 보기</div>' : ''}
                        `);
                    };

                    itemDiv.onmouseout = (e) => {
                        if (!window.isContextMenuOpen) {
                            this.app.hideCustomTooltip();
                        }
                    };

                    itemDiv.onclick = (e) => {
                        e.stopPropagation();
                        if (itemDef.type === 'base') {
                            let html = `<div style="font-weight:bold; color:#d97706; margin-bottom:8px; text-align:center; border-bottom:1px solid rgba(0,0,0,0.1); padding-bottom:4px;">${itemDef.name} 조합표</div>`;
                            html += `<div style="display:flex; flex-direction:column; gap:6px;">`;
                            this.app.ITEMS.filter(x => x.type === 'combined' && x.recipe && x.recipe.includes(itemId)).forEach(combo => {
                                const otherId = combo.recipe[0] === itemId ? combo.recipe[1] : combo.recipe[0];
                                const otherIcon = this.getIconForItem(otherId);
                                const comboIcon = this.getIconForItem(combo.id);
                                html += `
                                    <div style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:4px; position:relative;"
                                         onmouseover="this.querySelector('.combo-tooltip').style.display='block';"
                                         onmouseout="this.querySelector('.combo-tooltip').style.display='none';">
                                        <div style="width:24px; height:24px; background:#e2e8f0; border:1px solid #94a3b8; border-radius:4px; display:flex; justify-content:center; align-items:center; font-size:1rem;">${otherIcon}</div>
                                        <span style="color:#333; font-weight:bold;">=</span>
                                        <div style="width:24px; height:24px; background:#fef08a; border:1px solid #eab308; border-radius:4px; display:flex; justify-content:center; align-items:center; font-size:1rem; cursor:help;">${comboIcon}</div>
                                        <span style="color:#d97706; font-size:0.85rem; font-weight:bold; cursor:help;">${combo.name}</span>
                                        
                                        <div class="combo-tooltip" style="display:none; position:absolute; right:100%; top:50%; transform:translateY(-50%); margin-right:10px; background:rgba(253,250,243,0.98); border:1px solid rgba(0,0,0,0.1); padding:10px 14px; border-radius:8px; width:240px; z-index:1000; box-shadow:0 10px 15px -3px rgba(0,0,0,0.15);">
                                            <div style="font-weight:bold; color:#d97706; font-size:1rem; margin-bottom:6px;">
                                                ${comboIcon} ${combo.name}
                                                <div style="font-size:0.75rem; color:#666; font-weight:normal;">${this.formatItemStats(combo.stats)}</div>
                                            </div>
                                            <div style="color:#475569; font-size:0.85rem; white-space:normal; line-height:1.5;">${combo.desc}</div>
                                        </div>
                                    </div>
                                `;
                            });
                            html += `</div>`;
                            this.app.showCustomTooltip(e, html, true);
                        } else {
                            this.app.showCustomTooltip(e, `
                                <div style="font-weight:bold; color:#d97706; font-size:1rem; margin-bottom:4px;">
                                    ${iconStr} ${itemDef.name}
                                    <span style="font-size:0.75rem; color:#666; font-weight:normal; margin-left:4px;">${this.formatItemStats(itemDef.stats)}</span>
                                </div>
                                <div style="color:#475569;">${itemDef.desc}</div>
                            `);
                        }
                    };

                    itemDiv.ondragstart = (e) => {
                        this.app.hideCustomTooltip();
                        e.dataTransfer.setData('itemIdx', i);
                        e.dataTransfer.setData('itemId', itemId);
                    };
                    slot.appendChild(itemDiv);
                }
            }

            slot.ondragover = (e) => e.preventDefault();
            slot.ondrop = (e) => {
                e.preventDefault();
                const sourceIdxStr = e.dataTransfer.getData('itemIdx');
                if (!sourceIdxStr) return;
                const sourceIdx = parseInt(sourceIdxStr);
                const targetIdx = parseInt(slot.dataset.index);
                if (sourceIdx === targetIdx) return;

                this.combineOrMoveItem(sourceIdx, targetIdx);
            };

            slotsEl.appendChild(slot);
        }
    }

    giveRandomBaseItem() {
        const bases = this.app.ITEMS.filter(i => i.type === 'base');
        const item = bases[Math.floor(Math.random() * bases.length)];
        this.addItemToInventory(item.id);
    }

    giveRandomCombinedItem() {
        const combos = this.app.ITEMS.filter(i => i.type === 'combined' && i.id !== 'comb_crit_crit');
        const item = combos[Math.floor(Math.random() * combos.length)];
        this.addItemToInventory(item.id);
    }

    addItemToInventory(itemId) {
        for (let i = 0; i < 12; i++) {
            if (!this.app.state.inventory[i]) {
                this.app.state.inventory[i] = itemId;
                break;
            }
        }
        this.renderInventory();
    }

    combineOrMoveItem(sourceIdx, targetIdx) {
        const sourceId = this.app.state.inventory[sourceIdx];
        const targetId = this.app.state.inventory[targetIdx];

        if (!targetId) {
            this.app.state.inventory[targetIdx] = sourceId;
            this.app.state.inventory[sourceIdx] = null;
            this.renderInventory();
            return;
        }

        const sourceDef = this.app.ITEMS.find(i => i.id === sourceId);
        const targetDef = this.app.ITEMS.find(i => i.id === targetId);

        if (sourceDef.type === 'base' && targetDef.type === 'base') {
            const combo = this.app.ITEMS.find(i => i.type === 'combined' && i.recipe &&
                ((i.recipe[0] === sourceId && i.recipe[1] === targetId) ||
                    (i.recipe[0] === targetId && i.recipe[1] === sourceId))
            );

            if (combo) {
                this.app.state.inventory[targetIdx] = combo.id;
                this.app.state.inventory[sourceIdx] = null;
                console.log(`아이템 조합 성공: ${combo.name}`);
                this.renderInventory();
                return;
            }
        }

        this.app.state.inventory[targetIdx] = sourceId;
        this.app.state.inventory[sourceIdx] = targetId;
        this.renderInventory();
    }

    giveItemToUnit(itemIdx, unit) {
        const itemId = this.app.state.inventory[itemIdx];
        if (!itemId) return;

        const itemDef = this.app.ITEMS.find(i => i.id === itemId);

        if (itemDef.type === 'base') {
            const baseIndex = unit.items.findIndex(id => this.app.ITEMS.find(i => i.id === id).type === 'base');
            if (baseIndex !== -1) {
                const existingId = unit.items[baseIndex];
                const combo = this.app.ITEMS.find(i => i.type === 'combined' && i.recipe &&
                    ((i.recipe[0] === existingId && i.recipe[1] === itemId) ||
                        (i.recipe[0] === itemId && i.recipe[1] === existingId))
                );
                if (combo) {
                    unit.items[baseIndex] = combo.id;
                    if (combo.id === 'comb_crit_crit') {
                        const combinedItems = this.app.ITEMS.filter(i => i.type === 'combined' && i.id !== 'comb_crit_crit');
                        unit.thievesItems = [
                            combinedItems[Math.floor(Math.random() * combinedItems.length)].id,
                            combinedItems[Math.floor(Math.random() * combinedItems.length)].id
                        ];
                    }
                    this.app.state.inventory[itemIdx] = null;
                    console.log(`유닛 내부 아이템 조합 성공: ${combo.name}`);
                    this.renderInventory();
                    this.app.renderUnits();
                    this.app.calculateSynergy();

                    const activeDiv = document.querySelector(`.unit-character[data-index="${unit.gridIndex !== undefined ? unit.gridIndex : this.app.state.bench.indexOf(unit)}"][data-type="${unit.gridIndex !== undefined ? 'board' : 'bench'}"]`);
                    if (document.getElementById('unit-details').innerHTML.includes(unit.name)) {
                        this.app.showUnitInfo(unit, activeDiv);
                    }
                    return;
                }
            }
        }

        if (unit.items.length >= 3) {
            alert("아이템 슬롯이 꽉 찼습니다!");
            return;
        }

        unit.items.push(itemId);
        if (itemId === 'comb_crit_crit') {
            const combinedItems = this.app.ITEMS.filter(i => i.type === 'combined' && i.id !== 'comb_crit_crit');
            unit.thievesItems = [
                combinedItems[Math.floor(Math.random() * combinedItems.length)].id,
                combinedItems[Math.floor(Math.random() * combinedItems.length)].id
            ];
        }
        this.app.state.inventory[itemIdx] = null;
        this.renderInventory();
        this.app.renderUnits();
        this.app.calculateSynergy();

        const activeDiv = document.querySelector(`.unit-character[data-index="${unit.gridIndex !== undefined ? unit.gridIndex : this.app.state.bench.indexOf(unit)}"][data-type="${unit.gridIndex !== undefined ? 'board' : 'bench'}"]`);
        if (document.getElementById('unit-details').innerHTML.includes(unit.name)) {
            this.app.showUnitInfo(unit, activeDiv);
        }
    }
}
