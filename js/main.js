import { UNIT_POOL, SYNERGIES, EXP_TABLE, AUGMENTS } from './data.js';
import { ITEMS } from './items.js';
import { generateEnemyBoard } from './enemyAi.js';
import { BattleEngine } from './battleEngine.js';
import { BattleRenderer } from './battleRenderer.js';

const STAT_NAMES_KO = {
    teamAp: "팀 전체 주문력",
    selfAp: "추가 주문력",
    critChance: "치명타 확률",
    critDmg: "치명타 피해량",
    dmgAmp: "피해량 증폭",
    shield: "보호막",
    allStats: "체력·공격력·주문력·방어력·마법저항력 전체 강화",
    skillDmgAmp: "스킬 피해량 증폭",
    skillCrit: "스킬 치명타",
    manaReduc: "최대 마나 감소",
    teamHp: "팀 전체 최대 체력",
    selfHpMult: "본인 체력 배율",
    tickHeal: "주기적 체력 회복",
    bonusMagicDmg: "추가 마법피해 장전",
    bonusMana: "피격/타격 시 추가 마나",
    teamDef: "팀 방어력/마법저항력",
    selfDefMult: "본인 방어력 배율",
    startShieldPct: "체력 비례 보호막",
    distAmp: "거리 비례 피해 증폭",
    rangeBuff: "사거리 증가",
    maxAsBuff: "잃은 체력 비례 공속",
    dmgReduc: "피해 감소",
    startShield: "시작 보호막",
    stackAdAp: "타격당 공격력/주문력 스택",
    adBuff: "기본 공격력",
    splashAdRatio: "광역 피해량 비율"
};

function formatStat(k, v) {
    const name = STAT_NAMES_KO[k] || k;
    let valStr = v;
    if (typeof v === 'number') {
        if (v > 0 && v < 5) valStr = `+${Math.round(v * 100)}%`;
        else valStr = `+${v}`;
    }
    if (v === true) valStr = "적용됨";
    return `${name} ${valStr}`;
}

const SHOP_PROBABILITIES = {
    1: [100, 0, 0, 0, 0],
    2: [100, 0, 0, 0, 0],
    3: [75, 25, 0, 0, 0],
    4: [55, 30, 15, 0, 0],
    5: [45, 33, 20, 2, 0],
    6: [25, 40, 30, 5, 0],
    7: [19, 30, 35, 15, 1],
    8: [15, 20, 35, 25, 5],
    9: [10, 15, 30, 30, 15]
};

class GameApp {
    constructor() {
        this.state = {
            gold: 10,
            hp: 100,
            level: 1,
            exp: 0,
            stage: [1, 1], // [World, Round]
            board: Array(24).fill(null), // 3x8 Player
            enemyBoard: Array(24).fill(null), // 3x8 Enemy
            bench: Array(8).fill(null),
            shop: Array(5).fill(null),
            inventory: Array(12).fill(null), // 아이템 인벤토리
            augments: [],
            globalBuffs: { teamHp: 0, teamAdAp: 0, teamDef: 0, critChance: 0, dmgAmp: 0, dmgReduc: 0, vamp: 0, startShield: 0, tickHealPct: 0, asMult: 0, startMana: 0, rangeBuff: 0, distAmp: 0 },
            freeRerolls: 0,
            shopLocked: false, // 상점 잠금 상태
            highEndShopping: false,
            freeMeals: false,
            richFoundation: false,
            invincibleRounds: 0,
            lateLeave: false,
            honorStudent: false,
            snackShop: false,
            winStreak: 0,
            lossStreak: 0
        };
        this.init();
    }

    init() {
        // 게임 시작 시 무작위 기본 아이템 3개 지급
        this.giveRandomBaseItem();
        this.giveRandomBaseItem();
        this.giveRandomBaseItem();
        
        this.spawnEnemyBoard();
        this.renderBoard();
        this.renderUnits();
        this.renderShop();
        this.renderInventory();
        this.updateHeader();
        this.bindEvents();
        console.log("게임 초기화 완료. 준비상태 돌입.");
    }

    spawnEnemyBoard() {
        this.state.enemyBoard = generateEnemyBoard(this.state.stage[0], this.state.stage[1]);
        const enemySynergies = this.getSynergyData(this.state.enemyBoard);
        const activeTraits = [];
        for (const [club, count] of Object.entries(enemySynergies.clubs)) {
            const lvl = this.getActiveSynergyLevel(count, Object.keys(SYNERGIES.clubs[club].levels), SYNERGIES.clubs[club].exactMatch);
            if(lvl > 0) activeTraits.push(`${club}(${lvl})`);
        }
        for (const [subj, count] of Object.entries(enemySynergies.subjects)) {
            const lvl = this.getActiveSynergyLevel(count, Object.keys(SYNERGIES.subjects[subj].levels), SYNERGIES.subjects[subj].exactMatch);
            if(lvl > 0) activeTraits.push(`${subj}(${lvl})`);
        }
        document.getElementById('enemy-info').innerText = activeTraits.length > 0 ? `🚨 적군 시너지: ${activeTraits.join(', ')}` : `🚨 적군 시너지: 없음`;
    }

    updateHeader() {
        document.getElementById('player-hp').innerText = this.state.hp;
        document.getElementById('player-gold').innerText = this.state.gold;
        
        let interest = Math.floor(this.state.gold / 10);
        if(!this.state.richFoundation) interest = Math.min(5, interest);
        
        const streakCount = this.state.winStreak || this.state.lossStreak;
        let streakBonus = 0;
        if(streakCount >= 7) streakBonus = 3;
        else if(streakCount >= 5) streakBonus = 2;
        else if(streakCount >= 3) streakBonus = 1;
        
        let streakText = '연승/연패: 없음';
        if(this.state.winStreak >= 2) streakText = `🔥 ${this.state.winStreak}연승 (+${streakBonus}G)`;
        else if(this.state.lossStreak >= 2) streakText = `💧 ${this.state.lossStreak}연패 (+${streakBonus}G)`;
        
        document.getElementById('interest-info').innerText = `예상 이자: +${interest}G`;
        const streakEl = document.getElementById('streak-info');
        if (streakEl) streakEl.innerText = streakText;
        
        const nextExp = this.getMaxExp(this.state.level) || 'MAX';
        const currentBoardCount = this.state.board.filter(u => u !== null).length;
        document.getElementById('player-level').innerHTML = `${this.state.level} <span style="font-size:0.75rem; color:#7f8c8d; font-weight:bold;">(${this.state.exp}/${nextExp})</span>`;
        document.getElementById('board-capacity').innerText = `배치: ${currentBoardCount}/${this.state.level}`;
        
        // 시너지나 기타 정보가 있으면 계속 업데이트
        document.getElementById('current-stage').innerText = `${this.state.stage[0]}-${this.state.stage[1]}`;
        
        // 스테이지 라운드 타임라인 UI 업데이트
        const timelineEl = document.getElementById('stage-timeline');
        if (timelineEl) {
            let html = '';
            for (let r = 1; r <= 5; r++) {
                let icon = '⚔️';
                if (r === 3) icon = '🏪'; // 매점 타임
                if (r === 5) icon = '👹'; // 기말고사(PVE)
                
                let opacity = r < this.state.stage[1] ? '0.3' : (r === this.state.stage[1] ? '1' : '0.5');
                let scale = r === this.state.stage[1] ? 'scale(1.3)' : 'scale(1)';
                let border = r === this.state.stage[1] ? 'border-bottom: 3px solid #fef08a;' : '';
                
                html += `<div style="font-size:1.4rem; opacity:${opacity}; transform:${scale}; transition:all 0.3s; ${border}">${icon}</div>`;
            }
            timelineEl.innerHTML = html;
        }
    }

    renderBoard() {
        const boardEl = document.getElementById('battle-board');
        const benchEl = document.getElementById('bench-board');
        
        boardEl.innerHTML = '';
        benchEl.innerHTML = '';

        for(let i=0; i<48; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell board-cell';
            cell.dataset.index = i;
            if(i >= 24) {
                this.setupDropZone(cell, 'board');
            } else {
                cell.style.background = 'rgba(255, 100, 100, 0.05)';
                cell.style.border = '2px dashed rgba(255, 0, 0, 0.2)';
            }
            boardEl.appendChild(cell);
        }

        for(let i=0; i<8; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell bench-cell';
            cell.dataset.index = i;
            this.setupDropZone(cell, 'bench');
            benchEl.appendChild(cell);
        }
    }

    setupDropZone(cell, targetType) {
        cell.ondragover = (e) => e.preventDefault();
        cell.ondrop = (e) => {
            e.preventDefault();
            const itemIdxStr = e.dataTransfer.getData('itemIdx');
            if (itemIdxStr) {
                e.stopPropagation();
                const targetIdx = parseInt(cell.dataset.index);
                const isBoard = targetType === 'board';
                const arr = isBoard ? this.state.board : this.state.bench;
                const idx = isBoard ? targetIdx - 24 : targetIdx;
                const unit = arr[idx];
                if (unit) {
                    this.giveItemToUnit(parseInt(itemIdxStr), unit);
                }
                return;
            }

            const sourceType = e.dataTransfer.getData('sourceType');
            const sourceIdx = parseInt(e.dataTransfer.getData('sourceIdx'));
            const targetIdx = parseInt(cell.dataset.index);
            if (sourceType) this.moveUnit(sourceType, sourceIdx, targetType, targetIdx);
        };
    }

    getIconForItem(itemId) {
        const ICONS = {
            base_ad: '📐', base_as: '👟', base_ap: '🔦', base_mana: '🥤',
            base_armor: '🧥', base_mr: '🎧', base_hp: '🍱', base_crit: '👓',
            comb_ad_ad: '🗡️', comb_ad_as: '⚔️', comb_ad_ap: '🔫', comb_ad_mana: '🗡️', comb_ad_armor: '🛡️', comb_ad_mr: '🩸', comb_ad_hp: '❤️', comb_ad_crit: '🗡️',
            comb_as_as: '🏹', comb_as_ap: '⚡', comb_as_mana: '⚡', comb_as_armor: '🛡️', comb_as_mr: '🌀', comb_as_hp: '🏃', comb_as_crit: '🔪',
            comb_ap_ap: '🎩', comb_ap_mana: '📘', comb_ap_armor: '🛡️', comb_ap_mr: '⚡', comb_ap_hp: '🔥', comb_ap_crit: '💎',
            comb_mana_mana: '🔵', comb_mana_armor: '📜', comb_mana_mr: '☕', comb_mana_hp: '✉️', comb_mana_crit: '🎲',
            comb_armor_armor: '🎒', comb_armor_mr: '🧥', comb_armor_hp: '🔥', comb_armor_crit: '📱',
            comb_mr_mr: '🎧', comb_mr_hp: '📝', comb_mr_crit: '📛',
            comb_hp_hp: '🥤', comb_hp_crit: '👊',
            comb_crit_crit: '🧤'
        };
        return ICONS[itemId] || '❓';
    }

    formatItemStats(stats) {
        if(!stats) return '';
        let arr = [];
        if(stats.adPct) arr.push(`공격력 +${Math.round(stats.adPct*100)}%`);
        if(stats.as) arr.push(`공속 +${Math.round(stats.as*100)}%`);
        if(stats.ap) arr.push(`주문력 +${stats.ap}`);
        if(stats.mana) arr.push(`마나 +${stats.mana}`);
        if(stats.armor) arr.push(`방어력 +${stats.armor}`);
        if(stats.mr) arr.push(`마법저항력 +${stats.mr}`);
        if(stats.maxHp) arr.push(`체력 +${stats.maxHp}`);
        if(stats.critChance) arr.push(`치명타 +${Math.round(stats.critChance*100)}%`);
        if(stats.vamp) arr.push(`피해흡혈 +${Math.round(stats.vamp*100)}%`);
        if(stats.dodge) arr.push(`회피율 +${Math.round(stats.dodge*100)}%`);
        return arr.length ? `(${arr.join(', ')})` : '';
    }

    renderInventory() {
        const slotsEl = document.getElementById('inventory-slots');
        if(!slotsEl) return;
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

            if (this.state.inventory[i]) {
                const itemId = this.state.inventory[i];
                const itemDef = ITEMS.find(it => it.id === itemId);
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
                        this.showCustomTooltip(e, `
                            <div style="font-weight:bold; color:${itemDef.type === 'base' ? '#94a3b8' : '#eab308'}; font-size:1rem; margin-bottom:4px;">
                                ${iconStr} ${itemDef.name}
                                <span style="font-size:0.75rem; color:#888; font-weight:normal; margin-left:4px;">${this.formatItemStats(itemDef.stats)}</span>
                            </div>
                            <div style="color:#cbd5e1;">${itemDef.desc}</div>
                            ${itemDef.type === 'base' ? '<div style="font-size:0.75rem; color:#64748b; margin-top:5px; text-align:right;">좌클릭하여 조합표 보기</div>' : ''}
                        `);
                    };

                    itemDiv.onmouseout = (e) => {
                        if (!window.isContextMenuOpen) {
                            this.hideCustomTooltip();
                        }
                    };

                    itemDiv.onclick = (e) => {
                        e.stopPropagation();
                        if (itemDef.type === 'base') {
                            let html = `<div style="font-weight:bold; color:#eab308; margin-bottom:8px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">${itemDef.name} 조합표</div>`;
                            html += `<div style="display:flex; flex-direction:column; gap:6px;">`;
                            ITEMS.filter(x => x.type === 'combined' && x.recipe && x.recipe.includes(itemId)).forEach(combo => {
                                const otherId = combo.recipe[0] === itemId ? combo.recipe[1] : combo.recipe[0];
                                const otherDef = ITEMS.find(x => x.id === otherId);
                                const otherIcon = this.getIconForItem(otherId);
                                const comboIcon = this.getIconForItem(combo.id);
                                html += `
                                    <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:4px; position:relative;"
                                         onmouseover="this.querySelector('.combo-tooltip').style.display='block';"
                                         onmouseout="this.querySelector('.combo-tooltip').style.display='none';">
                                        <div style="width:24px; height:24px; background:#e2e8f0; border:1px solid #94a3b8; border-radius:4px; display:flex; justify-content:center; align-items:center; font-size:1rem;">${otherIcon}</div>
                                        <span style="color:#94a3b8; font-weight:bold;">=</span>
                                        <div style="width:24px; height:24px; background:#fef08a; border:1px solid #eab308; border-radius:4px; display:flex; justify-content:center; align-items:center; font-size:1rem; cursor:help;">${comboIcon}</div>
                                        <span style="color:#fef08a; font-size:0.85rem; font-weight:bold; cursor:help;">${combo.name}</span>
                                        
                                        <div class="combo-tooltip" style="display:none; position:absolute; right:100%; top:50%; transform:translateY(-50%); margin-right:10px; background:rgba(15,23,42,0.98); border:1px solid #475569; padding:10px 14px; border-radius:8px; width:240px; z-index:1000; box-shadow:0 10px 15px -3px rgba(0,0,0,0.5);">
                                            <div style="font-weight:bold; color:#eab308; font-size:1rem; margin-bottom:6px;">
                                                ${comboIcon} ${combo.name}
                                                <div style="font-size:0.75rem; color:#888; font-weight:normal;">${this.formatItemStats(combo.stats)}</div>
                                            </div>
                                            <div style="color:#e2e8f0; font-size:0.85rem; white-space:normal; line-height:1.5;">${combo.desc}</div>
                                        </div>
                                    </div>
                                `;
                            });
                            html += `</div>`;
                            this.showCustomTooltip(e, html, true);
                        } else {
                            // 완성템은 기본 효과만 보여줌
                            this.showCustomTooltip(e, `
                                <div style="font-weight:bold; color:#eab308; font-size:1rem; margin-bottom:4px;">
                                    ${iconStr} ${itemDef.name}
                                    <span style="font-size:0.75rem; color:#888; font-weight:normal; margin-left:4px;">${this.formatItemStats(itemDef.stats)}</span>
                                </div>
                                <div style="color:#cbd5e1;">${itemDef.desc}</div>
                            `);
                        }
                    };

                    itemDiv.ondragstart = (e) => {
                        console.log("아이템 드래그 시작!", itemId, "isBattlePhase:", window.isBattlePhase);
                        if (window.isBattlePhase) { e.preventDefault(); return; }
                        this.hideCustomTooltip();
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
                if(!sourceIdxStr) return; 
                const sourceIdx = parseInt(sourceIdxStr);
                const targetIdx = parseInt(slot.dataset.index);
                if(sourceIdx === targetIdx) return;
                
                this.combineOrMoveItem(sourceIdx, targetIdx);
            };

            slotsEl.appendChild(slot);
        }
    }

    giveRandomBaseItem() {
        const bases = ITEMS.filter(i => i.type === 'base');
        const item = bases[Math.floor(Math.random() * bases.length)];
        this.addItemToInventory(item.id);
    }
    
    giveRandomCombinedItem() {
        const combos = ITEMS.filter(i => i.type === 'combined' && i.id !== 'comb_crit_crit');
        const item = combos[Math.floor(Math.random() * combos.length)];
        this.addItemToInventory(item.id);
    }

    addItemToInventory(itemId) {
        for(let i=0; i<12; i++) {
            if(!this.state.inventory[i]) {
                this.state.inventory[i] = itemId;
                break;
            }
        }
        this.renderInventory();
    }

    showStoreTimeSelection() {
        const modal = document.getElementById('augment-modal');
        const container = document.getElementById('augment-cards-container');
        document.getElementById('augment-title').innerText = "🏫 매점 타임";
        document.getElementById('augment-subtitle').innerText = "매점에 신상품이 들어왔습니다! 원하는 기본 아이템 단 하나만 선택하세요!";
        
        container.innerHTML = '';
        
        const bases = ITEMS.filter(i => i.type === 'base');
        const choices = [];
        for(let i=0; i<3; i++) {
            choices.push(bases[Math.floor(Math.random() * bases.length)]);
        }
        
        choices.forEach((item) => {
            const card = document.createElement('div');
            card.className = `augment-card silver`;
            card.style.cursor = 'pointer';
            
            const iconStr = this.getIconForItem(item.id);
            card.innerHTML = `
                <div class="augment-icon">${iconStr}</div>
                <div class="augment-name">${item.name}</div>
                <div class="augment-desc">${item.desc}</div>
            `;
            
            card.onclick = () => {
                this.addItemToInventory(item.id);
                modal.style.display = 'none';
            };
            
            container.appendChild(card);
        });
        
        modal.style.display = 'flex';
    }

    combineOrMoveItem(sourceIdx, targetIdx) {
        const sourceId = this.state.inventory[sourceIdx];
        const targetId = this.state.inventory[targetIdx];
        
        if(!targetId) {
            this.state.inventory[targetIdx] = sourceId;
            this.state.inventory[sourceIdx] = null;
            this.renderInventory();
            return;
        }

        const sourceDef = ITEMS.find(i => i.id === sourceId);
        const targetDef = ITEMS.find(i => i.id === targetId);

        if (sourceDef.type === 'base' && targetDef.type === 'base') {
            const combo = ITEMS.find(i => i.type === 'combined' && i.recipe && 
                ((i.recipe[0] === sourceId && i.recipe[1] === targetId) || 
                 (i.recipe[0] === targetId && i.recipe[1] === sourceId))
            );
            
            if (combo) {
                this.state.inventory[targetIdx] = combo.id;
                this.state.inventory[sourceIdx] = null;
                console.log(`아이템 조합 성공: ${combo.name}`);
                this.renderInventory();
                return;
            }
        }

        this.state.inventory[targetIdx] = sourceId;
        this.state.inventory[sourceIdx] = targetId;
        this.renderInventory();
    }

    giveItemToUnit(itemIdx, unit) {
        const itemId = this.state.inventory[itemIdx];
        if(!itemId) return;

        const itemDef = ITEMS.find(i => i.id === itemId);
        
        if (itemDef.type === 'base') {
            const baseIndex = unit.items.findIndex(id => ITEMS.find(i => i.id === id).type === 'base');
            if (baseIndex !== -1) {
                const existingId = unit.items[baseIndex];
                const combo = ITEMS.find(i => i.type === 'combined' && i.recipe && 
                    ((i.recipe[0] === existingId && i.recipe[1] === itemId) || 
                     (i.recipe[0] === itemId && i.recipe[1] === existingId))
                );
                if (combo) {
                    unit.items[baseIndex] = combo.id;
                    if (combo.id === 'comb_crit_crit') {
                        const combinedItems = ITEMS.filter(i => i.type === 'combined' && i.id !== 'comb_crit_crit');
                        unit.thievesItems = [
                            combinedItems[Math.floor(Math.random() * combinedItems.length)].id,
                            combinedItems[Math.floor(Math.random() * combinedItems.length)].id
                        ];
                    }
                    this.state.inventory[itemIdx] = null;
                    console.log(`유닛 내부 아이템 조합 성공: ${combo.name}`);
                    this.renderInventory();
                    this.renderUnits();
                    this.calculateSynergy(); 
                    
                    const activeDiv = document.querySelector(`.unit-character[data-index="${unit.gridIndex !== undefined ? unit.gridIndex : this.state.bench.indexOf(unit)}"][data-type="${unit.gridIndex !== undefined ? 'board' : 'bench'}"]`);
                    if(document.getElementById('unit-details').innerHTML.includes(unit.name)) {
                        this.showUnitInfo(unit, activeDiv);
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
            const combinedItems = ITEMS.filter(i => i.type === 'combined' && i.id !== 'comb_crit_crit');
            unit.thievesItems = [
                combinedItems[Math.floor(Math.random() * combinedItems.length)].id,
                combinedItems[Math.floor(Math.random() * combinedItems.length)].id
            ];
        }
        this.state.inventory[itemIdx] = null;
        this.renderInventory();
        this.renderUnits();
        this.calculateSynergy();
        
        const activeDiv = document.querySelector(`.unit-character[data-index="${unit.gridIndex !== undefined ? unit.gridIndex : this.state.bench.indexOf(unit)}"][data-type="${unit.gridIndex !== undefined ? 'board' : 'bench'}"]`);
        if(document.getElementById('unit-details').innerHTML.includes(unit.name)) {
            this.showUnitInfo(unit, activeDiv);
        }
    }

    showCustomTooltip(e, html, isInteractive = false) {
        const tooltip = document.getElementById('custom-tooltip');
        if (!tooltip) return;
        
        if (isInteractive) {
            window.isContextMenuOpen = true;
            tooltip.style.pointerEvents = 'auto';
        } else {
            tooltip.style.pointerEvents = 'none';
        }

        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
        
        // Wait a frame for offsetWidth to update
        requestAnimationFrame(() => {
            let left = e.clientX + 15;
            let top = e.clientY + 15;
            if (left + tooltip.offsetWidth > window.innerWidth) left = window.innerWidth - tooltip.offsetWidth - 10;
            if (top + tooltip.offsetHeight > window.innerHeight) top = window.innerHeight - tooltip.offsetHeight - 10;
            
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        });
    }

    hideCustomTooltip() {
        if (window.isContextMenuOpen) return;
        const tooltip = document.getElementById('custom-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }

    showResultModal(title, msg, type, onConfirm) {
        const modal = document.getElementById('result-modal');
        const titleEl = document.getElementById('result-title');
        const msgEl = document.getElementById('result-msg');
        const iconEl = document.getElementById('result-icon');
        const btn = document.getElementById('btn-result-ok');
        
        titleEl.innerText = title;
        msgEl.innerHTML = msg;
        
        if (type === 'win') {
            iconEl.innerText = '🏆';
            titleEl.style.color = '#2563eb';
            btn.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
            btn.style.boxShadow = '0 4px 15px rgba(37,99,235,0.4)';
        } else if (type === 'loss' || type === 'gameover') {
            iconEl.innerText = '💀';
            titleEl.style.color = '#d63031';
            btn.style.background = 'linear-gradient(135deg, #ff7675, #d63031)';
            btn.style.boxShadow = '0 4px 15px rgba(214,48,49,0.4)';
        } else {
            iconEl.innerText = '🛡️';
            titleEl.style.color = '#0984e3';
            btn.style.background = 'linear-gradient(135deg, #74b9ff, #0984e3)';
            btn.style.boxShadow = '0 4px 15px rgba(9,132,227,0.4)';
        }
        
        btn.onclick = () => {
            modal.style.display = 'none';
            if (onConfirm) onConfirm();
        };
        
        modal.style.display = 'flex';
    }

    bindEvents() {
        document.addEventListener('click', () => {
            if (window.isContextMenuOpen) {
                window.isContextMenuOpen = false;
                this.hideCustomTooltip();
            }
        });
    }

    renderUnits() {
        const boardCells = document.querySelectorAll('.board-cell');
        
        // 전투 중이 아닐 때만 보드 영역을 렌더링 (전투 중 보드 리렌더링 방지)
        if (!window.isBattlePhase) {
            // 적 보드 렌더링 (0~23)
            this.state.enemyBoard.forEach((unit, idx) => {
                const cell = boardCells[idx];
                cell.innerHTML = '';
                if (unit) {
                    const uDiv = this.createUnitElement(unit, 'board', idx);
                    uDiv.draggable = false;
                    uDiv.style.border = '3px solid #ff5252';
                    cell.appendChild(uDiv);
                }
            });

            // 아군 보드 렌더링 (24~47)
            this.state.board.forEach((unit, idx) => {
                const cell = boardCells[idx + 24];
                cell.innerHTML = '';
                if (unit) {
                    const uDiv = this.createUnitElement(unit, 'board', idx);
                    cell.appendChild(uDiv);
                }
            });
        }

        // 대기석은 언제든 렌더링
        const benchCells = document.querySelectorAll('.bench-cell');
        this.state.bench.forEach((unit, idx) => {
            const cell = benchCells[idx];
            cell.innerHTML = '';
            if (unit) {
                const uDiv = this.createUnitElement(unit, 'bench', idx);
                cell.appendChild(uDiv);
            }
        });
    }

    createUnitElement(unit, type, idx) {
        const uDiv = document.createElement('div');
        uDiv.className = `unit-character tier-${unit.tier} star-${unit.star || 1}`;
        uDiv.draggable = true;
        
        const starText = '⭐'.repeat(unit.star || 1);
        
        // 전투 중 실시간 반영 혹은 기본 스탯 반영
        const hpPct = unit.currHp !== undefined ? (unit.currHp / unit.stats.hp * 100) : 100;
        const shieldPct = unit.currShield !== undefined ? (unit.currShield / unit.stats.hp * 100) : 0;
        const maxMana = unit.stats.maxMana || 1; // 0 나누기 방지
        const manaPct = unit.currMana !== undefined ? (unit.currMana / maxMana * 100) : ((unit.stats.mana / maxMana * 100) || 0);
        
        uDiv.innerHTML = `
            <div class="status-icons"></div>
            <div style="font-size: 0.6rem; margin-bottom: 2px;">${starText}</div>
            <span class="unit-icon">${unit.icon || '🧑‍🎓'}</span>
            <span class="unit-name">${unit.name}</span>
            <div class="bars-wrapper">
                <div class="hp-container">
                    <div class="hp-fill" style="width: ${hpPct}%;"></div>
                    <div class="shield-fill" style="width: ${Math.min(100, shieldPct)}%;"></div>
                </div>
                <div class="mana-container"><div class="mana-fill" style="width: ${unit.stats.maxMana > 0 ? manaPct : 0}%;"></div></div>
            </div>
        `;
        uDiv.dataset.type = type;
        uDiv.dataset.index = idx;
        if (unit.isEnemy) uDiv.classList.add('is-enemy');
        
        uDiv.ondragstart = (e) => {
            console.log("유닛 드래그 시작!", type, idx, "isBattlePhase:", window.isBattlePhase);
            if (window.isBattlePhase) { e.preventDefault(); return; }
            e.dataTransfer.setData('sourceType', type);
            e.dataTransfer.setData('sourceIdx', idx);
        };
        
        uDiv.onclick = (e) => {
            e.stopPropagation();
            this.showUnitInfo(unit, uDiv);
        };

        // 우클릭 판매 기능
        uDiv.oncontextmenu = (e) => {
            e.preventDefault();
            this.sellUnit(type, idx, unit);
        };
        
        return uDiv;
    }

    sellUnit(sourceType, sourceIdx, unit) {
        if(window.isBattlePhase && sourceType === 'board') return;

        if(sourceType === 'board') {
            // 보드에 있는 유닛은 판매되지 않고 대기석으로 이동
            const emptyBenchIdx = this.state.bench.findIndex(u => u === null);
            if(emptyBenchIdx !== -1) {
                this.state.bench[emptyBenchIdx] = unit;
                this.state.board[sourceIdx] = null;
                this.renderUnits();
                this.calculateSynergy();
            } else {
                alert("대기석이 가득 찼습니다! (먼저 대기석 유닛을 판매하세요)");
            }
            return;
        }

        // 대기석 유닛만 판매
        this.state.bench[sourceIdx] = null;
        
        // 환불 로직: 유닛 티어만큼 골드 환불 + 장착 아이템 모두 반환
        this.state.gold += unit.tier;
        if(unit.items && unit.items.length > 0) {
            unit.items.forEach(itemId => {
                this.addItemToInventory(itemId);
            });
        }
        
        this.updateHeader();
        this.renderUnits();
        this.calculateSynergy();
        console.log(`${unit.name} 판매 완료 (+${unit.tier}G), 아이템 환불됨`);
    }

    moveUnit(sourceType, sourceIdx, targetType, targetIdx) {
        if(isNaN(sourceIdx) || isNaN(targetIdx)) return;
        if(sourceType === targetType && sourceIdx === targetIdx) return;
        
        if(targetType === 'board' && targetIdx < 24) {
            console.log("적 영역에는 유닛을 배치할 수 없습니다.");
            return;
        }

        const sourceArr = sourceType === 'board' ? this.state.board : this.state.bench;
        const targetArr = targetType === 'board' ? this.state.board : this.state.bench;
        
        const adjustedTargetIdx = targetType === 'board' ? targetIdx - 24 : targetIdx;

        // 레벨에 따른 배치 수 제한 확인 (대기석 -> 비어있는 보드로 이동 시)
        if (sourceType === 'bench' && targetType === 'board') {
            if (!targetArr[adjustedTargetIdx]) {
                const currentBoardCount = this.state.board.filter(u => u !== null).length;
                if (currentBoardCount >= this.state.level) {
                    alert(`현재 레벨(${this.state.level})이 낮아 더 이상 배치할 수 없습니다. 경험치를 구매하세요!`);
                    return;
                }
            }
        }

        // 유닛 스왑(Swap)
        const temp = targetArr[adjustedTargetIdx];
        targetArr[adjustedTargetIdx] = sourceArr[sourceIdx];
        sourceArr[sourceIdx] = temp;

        this.renderUnits();
        this.calculateSynergy();
        this.updateHeader(); // 배치수 UI 업데이트
        
        // 이동 시 혹시 모를 진화(대기석과 보드 분리 상태에서의 스왑 등) 체크
        if (sourceArr[sourceIdx]) this.checkForUpgrade(sourceArr[sourceIdx].id);
        if (targetArr[adjustedTargetIdx]) this.checkForUpgrade(targetArr[adjustedTargetIdx].id);
    }

    checkForUpgrade(unitId) {
        // 1성과 2성에 대해 3마리 모였는지 순차적 체크 (연쇄 진화 대비)
        [1, 2].forEach(starLevel => {
            let foundSlots = [];
            
            this.state.board.forEach((u, i) => {
                if(u && u.id === unitId && (u.star || 1) === starLevel) foundSlots.push({type: 'board', index: i, unit: u});
            });
            this.state.bench.forEach((u, i) => {
                if(u && u.id === unitId && (u.star || 1) === starLevel) foundSlots.push({type: 'bench', index: i, unit: u});
            });
            
            if(foundSlots.length >= 3) {
                const toMerge = foundSlots.slice(0, 3);
                
                // 기존 유닛 3개 삭제
                toMerge.forEach(slot => {
                    if(slot.type === 'board') this.state.board[slot.index] = null;
                    else this.state.bench[slot.index] = null;
                });
                
                // 새 업그레이드 유닛 생성 (첫 번째 유닛 스탯 기준)
                const newUnit = JSON.parse(JSON.stringify(toMerge[0].unit));
                newUnit.star = starLevel + 1;
                // 영구 성장치 합산 (3마리의 permGrowth 모두 합침)
                const summedPermGrowth = { ad: 0, as: 0, ap: 0, hp: 0 };
                toMerge.forEach(slot => {
                    if (slot.unit.permGrowth) {
                        summedPermGrowth.ad += slot.unit.permGrowth.ad || 0;
                        summedPermGrowth.as += slot.unit.permGrowth.as || 0;
                        summedPermGrowth.ap += slot.unit.permGrowth.ap || 0;
                        summedPermGrowth.hp += slot.unit.permGrowth.hp || 0;
                    }
                });
                // 순수 기본 스탯에만 별 배율 적용 (permGrowth 제외)
                newUnit.stats.hp = Math.round(newUnit.stats.hp * 1.8);
                newUnit.stats.ad = Math.round(newUnit.stats.ad * 1.5);
                newUnit.stats.ap = Math.round(newUnit.stats.ap * 1.5);
                newUnit.permGrowth = summedPermGrowth;
                
                // 3번째 유닛 위치에 새 유닛 배치
                const targetSlot = toMerge[2];
                if(targetSlot.type === 'board') this.state.board[targetSlot.index] = newUnit;
                else this.state.bench[targetSlot.index] = newUnit;
                
                console.log(`🌟 [진화] ${newUnit.name}이(가) ${newUnit.star}성으로 진화했습니다!`);
                
                // 재귀 호출로 3성 진화 연쇄 체크
                this.checkForUpgrade(unitId);
            }
        });
        
        this.renderUnits();
        this.calculateSynergy();
    }

    getSynergyData(boardArray) {
        const uniqueUnits = [];
        const seenIds = new Set();
        
        boardArray.forEach(unit => {
            if (unit && !seenIds.has(unit.id)) {
                uniqueUnits.push(unit);
                seenIds.add(unit.id);
            }
        });

        const counts = { subjects: {}, clubs: {} };
        uniqueUnits.forEach(u => {
            counts.subjects[u.subject] = (counts.subjects[u.subject] || 0) + 1;
            counts.clubs[u.club] = (counts.clubs[u.club] || 0) + 1;
        });

        return counts;
    }

    calculateSynergy() {
        const counts = this.getSynergyData(this.state.board);
        this.renderSynergyUI(counts);
    }

    getActiveSynergyLevel(count, levelsArr, exactMatch = false) {
        if (exactMatch) {
            return levelsArr.includes(String(count)) ? count : 0;
        }
        let maxLvl = 0;
        levelsArr.forEach(lvl => {
            if(count >= Number(lvl)) maxLvl = Number(lvl);
        });
        return maxLvl;
    }

    showAugmentSelection(tierNeeded) {
        const modal = document.getElementById('augment-modal');
        const container = document.getElementById('augment-cards-container');
        document.getElementById('augment-title').innerText = "학사 일정 선택";
        document.getElementById('augment-subtitle').innerText = "하나의 일정을 선택하여 강력한 혜택을 얻으세요!";
        container.innerHTML = '';
        
        // 해당 티어의 증강체 중 이미 보유하지 않은 것들만 필터링
        const pool = AUGMENTS[tierNeeded].filter(a => !this.state.augments.find(has => has.id === a.id));
        
        // 3개 랜덤 추출 (Fisher-Yates shuffle)
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const choices = shuffled.slice(0, 3);
        
        choices.forEach(aug => {
            const card = document.createElement('div');
            card.className = `augment-card ${tierNeeded}`;
            
            // 아이콘 매칭 (이름 기반 간단한 아이콘)
            let icon = '🎓';
            if(aug.name.includes('매점') || aug.name.includes('급식')) icon = '🍔';
            if(aug.name.includes('지각') || aug.name.includes('땡땡이') || aug.name.includes('귀가')) icon = '⏰';
            if(aug.name.includes('골드') || aug.name.includes('재단') || aug.name.includes('벼락치기')) icon = '💰';
            if(aug.name.includes('전교') || aug.name.includes('만점') || aug.name.includes('특혜')) icon = '💯';
            if(aug.name.includes('체육') || aug.name.includes('스파르타') || aug.name.includes('당번')) icon = '💪';
            if(aug.name.includes('과학') || aug.name.includes('방송') || aug.name.includes('선행')) icon = '🔬';
            
            card.innerHTML = `
                <div class="augment-icon">${icon}</div>
                <div class="augment-name">${aug.name}</div>
                <div class="augment-desc">${aug.desc}</div>
            `;
            
            card.onclick = () => {
                modal.style.display = 'none';
                this.applyAugment(aug, tierNeeded);
            };
            container.appendChild(card);
        });
        
        modal.style.display = 'flex';
    }

    applyAugment(aug, tier) {
        this.state.augments.push({ ...aug, tier });
        const id = aug.id;
        const g = this.state.globalBuffs;
        const st = this.state;
        
        // 실버
        if(id === 's1') st.invincibleRounds += 3;
        if(id === 's2') st.snackShop = true;
        if(id === 's3') st.freeRerolls += 5;
        if(id === 's4') g.teamHp += 150;
        if(id === 's5') this.addExp(10);
        if(id === 's6') {
            for(let i=0; i<3; i++) {
                const pool = UNIT_POOL.filter(u => u.tier <= 2);
                this.addToBench({...pool[Math.floor(Math.random() * pool.length)]});
            }
        }
        if(id === 's7') g.tickHealPct += 0.02;
        if(id === 's8') g.dutyResponsibility = true;
        if(id === 's9') g.teamDef += 15;
        if(id === 's10') st.lostAndFound = true;
        if(id === 's11') { this.giveRandomBaseItem(); this.giveRandomBaseItem(); }

        // 골드
        if(id === 'g1') st.highEndShopping = true;
        if(id === 'g2') g.cramming = true;
        if(id === 'g3') st.honorStudent = true;
        if(id === 'g4') g.enforcerAura = true;
        if(id === 'g5') {
            const board1Stars = [];
            st.board.forEach((u, i) => { if(u && (u.star || 1) === 1) board1Stars.push(u); });
            if(board1Stars.length > 0) {
                const target = board1Stars[Math.floor(Math.random() * board1Stars.length)];
                target.star = 2; target.stats.hp = Math.round(target.stats.hp * 1.8); target.stats.maxHp = target.stats.hp; target.stats.ad = Math.round(target.stats.ad * 1.5); target.stats.ap = Math.round(target.stats.ap * 1.5);
                this.renderUnits();
            }
        }
        if(id === 'g6') {
            st.gold += 10;
            const pool = UNIT_POOL.filter(u => u.tier === 4);
            if(pool.length) this.addToBench({...pool[Math.floor(Math.random() * pool.length)]});
        }
        if(id === 'g7') { g.teamAdAp += 20; g.critChance += 0.15; }
        if(id === 'g8') g.vamp += 0.20;
        if(id === 'g9') g.startShield += 300;
        if(id === 'g10') g.rerollDiscountEndWorld = 3;
        if(id === 'g11') { this.giveRandomCombinedItem(); }

        // 프리즘
        if(id === 'p1') {
            const pool = UNIT_POOL.filter(u => u.tier === 5);
            if(pool.length) this.addToBench({...pool[Math.floor(Math.random() * pool.length)]});
            const req = this.getMaxExp(st.level);
            if(req) this.addExp(req - st.exp);
        }
        if(id === 'p2') g.earlyGraduation = true;
        if(id === 'p3') g.dmgAmp += 0.40;
        if(id === 'p4') st.freeMeals = true;
        if(id === 'p5') g.spartanTraining = true;
        if(id === 'p6') st.richFoundation = true;
        if(id === 'p7') { g.asMult += 0.30; g.startMana += 50; }
        if(id === 'p8') st.lateLeave = true;
        if(id === 'p9') {
            const pool = UNIT_POOL.filter(u => u.tier === 5);
            for(let i=0; i<3; i++) {
                if(pool.length) this.addToBench({...pool[Math.floor(Math.random() * pool.length)]});
            }
        }
        if(id === 'p10') { g.rangeBuff += 1; g.distAmp += 0.10; }
        if(id === 'p11') { st.gold += 10; this.giveRandomCombinedItem(); this.giveRandomCombinedItem(); }

        this.renderActiveAugments();
        this.updateHeader();
    }

    addToBench(unit) {
        const emptyIdx = this.state.bench.findIndex(u => u === null);
        if(emptyIdx !== -1) {
            unit.star = 1;
            unit.stats.maxHp = unit.stats.hp;
            unit.items = unit.items || [];
            this.state.bench[emptyIdx] = unit;
            this.renderUnits();
        }
    }

    renderActiveAugments() {
        const list = document.getElementById('augments-list');
        list.innerHTML = '';
        this.state.augments.forEach(aug => {
            const item = document.createElement('div');
            item.className = `active-augment-item ${aug.tier}`;
            
            let icon = '🎓';
            if(aug.name.includes('매점') || aug.name.includes('급식')) icon = '🍔';
            if(aug.name.includes('지각') || aug.name.includes('땡땡이') || aug.name.includes('귀가')) icon = '⏰';
            if(aug.name.includes('골드') || aug.name.includes('재단') || aug.name.includes('벼락치기')) icon = '💰';
            if(aug.name.includes('전교') || aug.name.includes('만점') || aug.name.includes('특혜')) icon = '💯';
            if(aug.name.includes('체육') || aug.name.includes('스파르타') || aug.name.includes('당번')) icon = '💪';
            if(aug.name.includes('과학') || aug.name.includes('방송') || aug.name.includes('선행')) icon = '🔬';

            item.innerHTML = `<span>${icon}</span> <span>${aug.name}</span>`;
            
            item.onmouseover = (e) => {
                const tooltip = document.getElementById('tooltip');
                tooltip.style.display = 'block';
                tooltip.style.left = (e.pageX + 15) + 'px';
                tooltip.style.top = (e.pageY - 15) + 'px';
                tooltip.innerHTML = `<strong style="color:var(--primary-color)">${aug.name}</strong><br><span style="font-size:0.9rem; color:#555;">${aug.desc}</span>`;
            };
            item.onmouseout = () => {
                document.getElementById('tooltip').style.display = 'none';
            };
            list.appendChild(item);
        });
    }

    applySynergyStats(originalBoard, activeSynergies, isEnemy = false) {
        const buffedBoard = originalBoard.map(u => {
            if(!u) return null;
            const newU = JSON.parse(JSON.stringify(u));
            newU.combat = { shield: 0, vamp: 0, dmgAmp: 0, critChance: 0, critDmg: 1.5, dmgReduc: 0 };
            // 영구 성장 스탯 적용 (기본 스탯에 플랫 증가)
            if (newU.permGrowth) {
                newU.stats.ad += newU.permGrowth.ad || 0;
                newU.stats.as += newU.permGrowth.as || 0;
                newU.stats.ap += newU.permGrowth.ap || 0;
                newU.stats.hp += newU.permGrowth.hp || 0;
            }
            return newU;
        });
        
        const getLevelData = (type, name, count) => {
            const synData = SYNERGIES[type][name];
            if(!synData) return null;
            if (synData.exactMatch) {
                return synData.levels[count] ? synData.levels[count] : null;
            }
            let activeLvl = 0;
            for(let lvl of Object.keys(synData.levels).map(Number).sort((a,b)=>a-b)) {
                if(count >= lvl) activeLvl = lvl;
            }
            return activeLvl > 0 ? synData.levels[activeLvl] : null;
        };

        let teamAp = 0, teamHp = 0, teamDef = 0;

        for(let [subj, count] of Object.entries(activeSynergies.subjects)) {
            const eff = getLevelData('subjects', subj, count);
            if(!eff) continue;
            
            if(subj === '국어') teamAp += eff.teamAp || 0;
            if(subj === '체육') teamHp += eff.teamHp || 0;
            if(subj === '도덕') teamDef += eff.teamDef || 0;
        }
        
        const g = this.state.globalBuffs;
        const playerHp = this.state.hp;
        const isSpartan = g.spartanTraining && playerHp <= 30 && !isEnemy;
        const isDuty = g.dutyResponsibility && originalBoard.filter(u=>u).length <= 3 && !isEnemy;

        buffedBoard.forEach(u => {
            if(!u) return;
            
            u.stats.ap += teamAp;
            u.stats.hp += teamHp;
            u.stats.armor += teamDef;
            u.stats.mr += teamDef;
            if (u.stats.maxMana > 0) u.stats.maxMana = Math.max(10, u.stats.maxMana);

            // 전역 버프 (증강체) 적용 (아군만)
            if(!isEnemy) {
                u.stats.hp += g.teamHp;
                u.stats.ad += g.teamAdAp;
                u.stats.ap += g.teamAdAp;
                u.stats.armor += g.teamDef;
                u.stats.mr += g.teamDef;
                u.combat.critChance += g.critChance;
                u.combat.dmgAmp += g.dmgAmp;
                u.combat.vamp += g.vamp;
                u.combat.shield += g.startShield;
                u.combat.tickHealPct = g.tickHealPct;
                u.stats.as *= (1 + g.asMult);
                u.combat.startMana = g.startMana;
                u.stats.range += g.rangeBuff;
                u.combat.distAmp = (u.combat.distAmp || 0) + g.distAmp;
                
                if(isSpartan) { u.combat.dmgReduc += 0.3; u.combat.vamp += 0.3; }
                if(isDuty) { u.combat.dmgReduc += 0.15; }
            } else {
                // 적군 페널티
                if(g.enforcerAura) { 
                    u.stats.maxHp = Math.round(u.stats.maxHp * 0.85); 
                    u.stats.hp = u.stats.maxHp; 
                }
            }

            const subjEff = getLevelData('subjects', u.subject, activeSynergies.subjects[u.subject]);
            if(subjEff) {
                if(u.subject === '국어') u.stats.ap += subjEff.selfAp || 0;
                if(u.subject === '수학') { u.combat.critChance += subjEff.critChance; u.combat.critDmg += subjEff.critDmg; }
                if(u.subject === '과학') {
                    u.combat.dmgAmp = (u.combat.dmgAmp || 0) + (subjEff.dmgAmp || 0);
                    if(subjEff.skillCrit) u.combat.skillCrit = true;
                    if(subjEff.critChance) u.combat.critChance = (u.combat.critChance || 0) + subjEff.critChance;
                }
                if(u.subject === '사회') {
                    if(subjEff.shield) u.combat.shield += subjEff.shield;
                    if(subjEff.allStats) {
                        const mult = 1 + subjEff.allStats;
                        u.stats.hp *= mult;
                        u.stats.ad *= mult;
                        u.stats.ap *= mult;
                        u.stats.armor *= mult;
                        u.stats.mr *= mult;
                    }
                }
                if(u.subject === '영어') {
                    if(subjEff.manaReduc) u.stats.maxMana = Math.max(10, Math.floor(u.stats.maxMana * (1 - subjEff.manaReduc)));
                }
                if(u.subject === '체육') { u.stats.hp += (subjEff.teamHp || 0) * ((subjEff.selfHpMult || 1) - 1); }
                if(u.subject === '음악') { u.combat.isFirelight = true; u.combat.tickHeal = subjEff.tickHeal; u.combat.bonusMagicDmg = subjEff.bonusMagicDmg; }
                if(subjEff.teamManaRegen) u.combat.teamManaRegen = (u.combat.teamManaRegen || 0) + subjEff.teamManaRegen;
                if(u.subject === '미술' && subjEff.artManaRegen) { u.combat.artManaRegen = (u.combat.artManaRegen || 0) + subjEff.artManaRegen; }
                if(u.subject === '도덕') { u.stats.armor += (subjEff.teamDef || 0) * ((subjEff.selfDefMult || 1) - 1); u.stats.mr += (subjEff.teamDef || 0) * ((subjEff.selfDefMult || 1) - 1); }
            }

            const clubEff = getLevelData('clubs', u.club, activeSynergies.clubs[u.club]);
            if(clubEff) {
                if(u.club === '선도부') { u.combat.shield += u.stats.hp * clubEff.startShieldPct; u.combat.dmgAmp += clubEff.dmgAmp; }
                if(u.club === '방송부') { u.combat.isSniper = true; u.combat.distAmp = clubEff.distAmp; u.stats.range += (clubEff.rangeBuff || 0); }
                if(u.club === '육상부') { u.combat.isQuickstriker = true; u.combat.maxAsBuff = clubEff.maxAsBuff; }
                if(u.club === '보건부') { u.combat.isWatcher = true; u.combat.dmgReduc += clubEff.dmgReduc; }
                if(u.club === '급식부') { u.combat.isDominator = true; u.combat.shield += clubEff.startShield; u.combat.stackAdAp = clubEff.stackAdAp; }
                if(u.club === '장난꾸러기') { u.stats.ad *= (1 + clubEff.adBuff); }
            }
            
            // 아이템 스탯 및 효과 적용
            if (u.items && u.items.length > 0) {
                let itemAdPct = 0;
                let itemApPct = 0; 
                u.combat.itemEffects = u.combat.itemEffects || {};
                
                // 도적의 장갑 처리
                let actualItems = [...u.items];
                if (actualItems.includes("comb_crit_crit") && u.thievesItems) {
                    actualItems = [...u.thievesItems];
                }

                actualItems.forEach(itemId => {
                    const itemDef = ITEMS.find(i => i.id === itemId);
                    if(!itemDef) return;
                    
                    const st = itemDef.stats;
                    if(st.ad) u.stats.ad += st.ad;
                    if(st.adPct) itemAdPct += st.adPct;
                    if(st.ap) u.stats.ap += st.ap;
                    if(st.apPct) itemApPct += st.apPct;
                    if(st.as) u.stats.as *= (1 + st.as);
                    if(st.mana) u.combat.startMana = (u.combat.startMana || 0) + st.mana;
                    if(st.armor) u.stats.armor += st.armor;
                    if(st.mr) u.stats.mr += st.mr;
                    if(st.maxHp) u.stats.hp += st.maxHp;
                    if(st.critChance) u.combat.critChance += st.critChance;
                    if(st.dodge) u.combat.dodge = (u.combat.dodge || 0) + st.dodge;
                    if(st.vamp) u.combat.vamp += st.vamp;
                    
                    if(itemDef.effect) {
                        u.combat.itemEffects[itemDef.effect] = true;
                    }
                });

                if(itemAdPct > 0) u.stats.ad *= (1 + itemAdPct);
                if(itemApPct > 0) u.stats.ap *= (1 + itemApPct);

                // 특수 효과 전투 전 스탯 반영
                if (u.combat.itemEffects.rfc) u.stats.range += 1;
                if (u.combat.itemEffects.rabadon) u.stats.ap *= 1.20;
                if (u.combat.itemEffects.blueBuff) u.stats.maxMana = Math.max(10, u.stats.maxMana - 10);
                if (u.combat.itemEffects.guardbreaker) u.combat.dmgAmp += 0.15;
                if (u.combat.itemEffects.skillCrit) u.combat.critDmg += 0.10;
                if (u.combat.itemEffects.hoj) {
                    if (Math.random() < 0.5) {
                        u.combat.dmgAmp += 0.30;
                        u.combat.vamp += 0.15;
                    } else {
                        u.combat.dmgAmp += 0.15;
                        u.combat.vamp += 0.30;
                    }
                }
            }

            u.stats.maxHp = u.stats.hp;
            if(u.combat.startMana) u.stats.mana = Math.min(u.stats.maxMana, u.stats.mana + u.combat.startMana);
        });
        
        return buffedBoard;
    }

    renderSynergyUI(counts) {
        const listEl = document.getElementById('synergy-list');
        listEl.innerHTML = '';
        
        const generateTooltip = (synData, type, name) => {
            let html = `<strong style="color:var(--primary-color);">${synData.name} 시너지 효과</strong><br><br>`;
            for (const [lvl, effects] of Object.entries(synData.levels)) {
                html += `<div style="margin-bottom: 5px;"><strong>[${lvl} 유닛]</strong> `;
                let effStrs = [];
                for (const [k, v] of Object.entries(effects)) {
                    effStrs.push(formatStat(k, v));
                }
                html += effStrs.join(', ') + `</div>`;
            }
            
            // 현재 시너지를 활성화중인 유닛들 아이콘 수집
            const uniqueUnits = [];
            const seenIds = new Set();
            this.state.board.forEach(u => {
                if (u && !seenIds.has(u.id)) {
                    uniqueUnits.push(u);
                    seenIds.add(u.id);
                }
            });
            const matches = uniqueUnits.filter(u => u[type] === name || (type === 'subject' && u.subject === '영어' && name !== '영어'));
            if (matches.length > 0) {
                html += `<div style="margin-top:10px; padding-top:8px; border-top:1px dashed #ccc; display:flex; gap:6px; flex-wrap:wrap;">`;
                matches.forEach(u => {
                    const tColor = `var(--tier${u.tier})`;
                    html += `<div style="width:28px; height:28px; border-radius:4px; border:2px solid ${tColor}; display:flex; justify-content:center; align-items:center; font-size:16px; background:#fff;" title="${u.name}">${u.icon}</div>`;
                });
                html += `</div>`;
            }
            
            return html;
        };

        // 과목 시너지 렌더링
        for (const [subj, count] of Object.entries(counts.subjects)) {
            const synData = SYNERGIES.subjects[subj];
            if (!synData) continue;
            
            const activeLevel = this.getActiveSynergyLevel(count, Object.keys(synData.levels), synData.exactMatch);
            const maxLevel = Math.max(...Object.keys(synData.levels).map(Number));
            
            const li = document.createElement('li');
            li.style.color = activeLevel ? '#d81b60' : '#555';
            li.style.borderLeftColor = activeLevel ? '#d81b60' : '#b0bec5';
            li.innerHTML = `📚 ${subj} (${count}/${maxLevel}) <br><span style="font-size:0.75rem; color:#888; font-weight:normal;">${synData.desc}</span>`;
            
            li.onmouseover = (e) => {
                const tooltip = document.getElementById('tooltip');
                tooltip.style.display = 'block';
                tooltip.style.left = (e.pageX + 20) + 'px';
                tooltip.style.top = (e.pageY - 20) + 'px';
                tooltip.innerHTML = generateTooltip(synData, 'subject', subj);
            };
            li.onmouseout = () => {
                document.getElementById('tooltip').style.display = 'none';
            };
            
            listEl.appendChild(li);
        }
        
        // 동아리 시너지 렌더링
        for (const [club, count] of Object.entries(counts.clubs)) {
            const synData = SYNERGIES.clubs[club];
            if (!synData) continue;
            
            const activeLevel = this.getActiveSynergyLevel(count, Object.keys(synData.levels), synData.exactMatch);
            const maxLevel = Math.max(...Object.keys(synData.levels).map(Number));
            
            const li = document.createElement('li');
            li.style.color = activeLevel ? '#1976d2' : '#555';
            li.style.borderLeftColor = activeLevel ? '#1976d2' : '#b0bec5';
            li.innerHTML = `🏷️ ${club} (${count}/${maxLevel}) <br><span style="font-size:0.75rem; color:#888; font-weight:normal;">${synData.desc}</span>`;
            
            li.onmouseover = (e) => {
                const tooltip = document.getElementById('tooltip');
                tooltip.style.display = 'block';
                tooltip.style.left = (e.pageX + 20) + 'px';
                tooltip.style.top = (e.pageY - 20) + 'px';
                tooltip.innerHTML = generateTooltip(synData, 'club', club);
            };
            li.onmouseout = () => {
                document.getElementById('tooltip').style.display = 'none';
            };
            
            listEl.appendChild(li);
        }
    }

    formatSkillDesc(skill, unit) {
        const starIdx = (unit.star || 1) - 1;
        let details = [];
        
        const currAp = Math.round(unit.stats.ap);
        const currAd = Math.round(unit.stats.ad);
        const currMaxHp = Math.round(unit.stats.maxHp || unit.stats.hp);
        
        const COLORS = {
            hp: '#4caf50', mana: '#1e88e5', ad: '#e65100', ap: '#8e24aa',
            armor: '#795548', mr: '#00897b', as: '#e53935', trueDmg: '#424242', def: '#333333',
            range: '#546e7a'
        };

        const formatArr = (arr, isPct = false, unitStr = '', color = COLORS.def, icon = '') => {
            if(!arr) return '';
            const val = arr[starIdx];
            const strVal = isPct ? Math.round(val * 100) + '%' : (val + unitStr);
            const strArr = arr.map(v => isPct ? Math.round(v * 100) + '%' : (v + unitStr)).join('/');
            const prefix = icon ? `${icon} ` : '';
            return `<span style="color:${color}; font-weight:bold;">${prefix}${strVal}</span> <span style="color:#888; font-size:0.7rem;">(${strArr})</span>`;
        };

        if (skill.adRatio) {
            if (skill.type.includes('shield') && !skill.type.includes('damage') && !skill.type.includes('magic')) {
                details.push(`보호막: ${formatArr(skill.adRatio, true, '', COLORS.ad, '⚔️')}`);
            } else if (skill.type.includes('magic')) {
                details.push(`마법 피해량: ${formatArr(skill.adRatio, true, '', COLORS.ad, '⚔️')}`);
            } else {
                details.push(`물리 피해량: ${formatArr(skill.adRatio, true, '', COLORS.ad, '⚔️')}`);
            }
        }
        if (skill.hpRatio || skill.hpRatioDmg) {
            const label = skill.type.includes('heal') ? '회복량' : '물리 피해량';
            details.push(`${label}: ${formatArr(skill.hpRatio || skill.hpRatioDmg, true, '', COLORS.hp, '❤️')}`);
        }
        if (skill.hpRatioShield) details.push(`보호막: ${formatArr(skill.hpRatioShield, true, '', COLORS.hp, '❤️')}`);
        if (skill.hpRatioSplash) details.push(`스플래시 피해: ${formatArr(skill.hpRatioSplash, true, '', COLORS.hp, '❤️')}`);
        if (skill.armorRatio) details.push(`감소량/피해량: ${formatArr(skill.armorRatio, true, '', COLORS.armor, '🛡️')}`);
        if (skill.mrRatio) details.push(`회복/보호막: ${formatArr(skill.mrRatio, true, '', COLORS.mr, '🌀')}`);
        if (skill.defMrRatio) {
            const label = skill.type.includes('heal') ? '회복량' : '방/마저 비례 피해량';
            details.push(`${label}: ${formatArr(skill.defMrRatio, true, '', COLORS.def, '🛡️🌀')}`);
        }
        if (skill.asRatio) details.push(`추가 수치: ${formatArr(skill.asRatio, true, '', COLORS.as, '⚡')}`);
        
        if (skill.apRatio) {
            if (skill.type.includes('shield') && !skill.type.includes('damage') && !skill.type.includes('magic')) {
                details.push(`주문력 비례 보호막: ${formatArr(skill.apRatio, true, '', COLORS.ap, '🔮')}`);
            } else {
                details.push(`마법 피해량: ${formatArr(skill.apRatio, true, '', COLORS.ap, '🔮')}`);
            }
        }
        
        const healBase = skill.healPct || skill.teamHealPct;
        if (healBase) details.push(`체력 회복: ${formatArr(healBase, true, '', COLORS.ap, '🔮')}`);
        if (skill.extraHealPct) details.push(`추가 체력 회복: ${formatArr(skill.extraHealPct, true, '', COLORS.ap, '🔮')}`);
        
        if (skill.shieldPct) details.push(`보호막: ${formatArr(skill.shieldPct, true, '', COLORS.ap, '🔮')}`);
        if (skill.shieldFlat || skill.teamShield) details.push(`보호막: ${formatArr(skill.shieldFlat || skill.teamShield, false, '', COLORS.ap, '🔮')}`);
        
        if (skill.stunDuration) details.push(`기절 지속시간: ${formatArr(skill.stunDuration.map(t => (t * 0.1).toFixed(1)), false, '초', COLORS.def, '')}`);
        if (skill.tauntDuration) details.push(`도발 지속시간: ${formatArr(skill.tauntDuration.map(t => (t * 0.1).toFixed(1)), false, '초', COLORS.def, '')}`);
        if (skill.buffDuration) details.push(`버프 지속시간: ${formatArr(skill.buffDuration.map(t => (t * 0.1).toFixed(1)), false, '초', COLORS.def, '')}`);
        if (skill.debuffDuration) details.push(`디버프 지속: ${formatArr(skill.debuffDuration.map(t => (t * 0.1).toFixed(1)), false, '초', COLORS.def, '')}`);
        if (skill.charges) details.push(`적용 횟수: ${formatArr(skill.charges, false, '회', COLORS.def, '')}`);
        
        if (skill.selfDefBuff) details.push(`방어력 증가: ${formatArr(skill.selfDefBuff, true, '', COLORS.armor, '🛡️')}`);
        if (skill.selfMrBuff) details.push(`마법저항력 증가: ${formatArr(skill.selfMrBuff, true, '', COLORS.mr, '🌀')}`);
        if (skill.permAdBuff) details.push(`영구 공격력 증가: ${formatArr(skill.permAdBuff, true, '', COLORS.ad, '⚔️')}`);
        if (skill.vampBuff) details.push(`피해 흡혈: ${formatArr(skill.vampBuff, true, '', COLORS.def, '')}`);
        if (skill.dmgReduc || skill.dmgReducPct) details.push(`피해 감소: ${formatArr(skill.dmgReduc || skill.dmgReducPct, true, '', COLORS.def, '')}`);
        
        if (skill.asBuff) details.push(`공격 속도 증가(🔮비례): ${formatArr(skill.asBuff, true, '', COLORS.as, '⚡')}`);
        if (skill.allyApFlat) details.push(`아군 주문력 증가: ${formatArr(skill.allyApFlat, false, '', COLORS.ap, '🔮')}`);
        if (skill.enemyMrReduc) details.push(`적 마저 감소: ${formatArr(skill.enemyMrReduc, false, '', COLORS.mr, '🌀')}`);
        if (skill.adReducPct) details.push(`적 공격력 감소: ${formatArr(skill.adReducPct, true, '', COLORS.ad, '⚔️')}`);
        
        if (skill.trueDmgPct) details.push(`고정 피해량: ${formatArr(skill.trueDmgPct, true, '', COLORS.def, '')}`);
        if (skill.armorPen) details.push(`방어력 관통: ${formatArr(skill.armorPen, true, '', COLORS.def, '')}`);
        
        if (skill.manaReducPct) details.push(`마나 획득 감소/봉인: ${formatArr(skill.manaReducPct, true, '', COLORS.def, '')}`);
        if (skill.manaBurnPct) details.push(`마나 소멸: ${formatArr(skill.manaBurnPct, true, '', COLORS.def, '')}`);
        if (skill.teamMana) details.push(`아군 마나 회복: ${formatArr(skill.teamMana, false, '', COLORS.mana, '💧')}`);
        
        if (skill.statBuffPct || skill.teamStatBuff) details.push(`공격력 및 주문력 증가: ${formatArr(skill.statBuffPct || skill.teamStatBuff, true, '', COLORS.ap, '🔮')}`);
        if (skill.defReducPct || skill.statReducPct) details.push(`방/마저 감소: ${formatArr(skill.defReducPct || skill.statReducPct, true, '', COLORS.def, '')}`);
        
        if (skill.buffPct) {
            let label = '스탯 버프량';
            let color = COLORS.def;
            let icon = '';
            if (skill.buffStat === 'ap') {
                label = '주문력 버프량';
                color = COLORS.ap;
                icon = '🔮';
            } else if (skill.buffStat === 'as') {
                label = '공속 버프량';
                color = COLORS.as;
                icon = '⚡';
            }
            details.push(`${label}: ${formatArr(skill.buffPct, true, '', color, icon)}`);
        }
        if (skill.rangeBuff) details.push(`사거리 증가: ${formatArr(skill.rangeBuff, false, '칸', COLORS.def, '')}`);
        if (skill.bonusTrueDmg) details.push(`추가 고정피해: ${formatArr(skill.bonusTrueDmg, false, '', COLORS.def, '')}`);

        let html = skill.desc;
        const wrap = (val, color, icon = '') => `<span style="color:${color}; font-weight:bold;">${icon ? icon + ' ' : ''}(${val})</span>`;
        
        if (skill.charges) html = html.replace(/수회/, `${wrap(skill.charges[starIdx], COLORS.def)}회`);
        if (skill.buffPct) {
            if (skill.buffStat === 'ap') {
                const apScaled = Math.round(skill.buffPct[starIdx] * (currAp / 100) * 100);
                html = html.replace(/(주문력|공격 속도|공격력) 증가/, `$1 ${wrap('+' + apScaled + '%', COLORS.ap, '🔮')} 증가`);
            } else if (skill.buffStat === 'as') {
                const asScaled = Math.round(skill.buffPct[starIdx] * (currAp / 100) * 100);
                html = html.replace(/(주문력|공격 속도|공격력) 증가/, `$1 ${wrap('+' + asScaled + '% 🔮', COLORS.as, '⚡')} 증가`);
            } else {
                html = html.replace(/(주문력|공격 속도|공격력) 증가/, `$1 ${wrap('+' + Math.round(skill.buffPct[starIdx] * 100) + '%', COLORS.def)} 증가`);
            }
        }

        if (skill.trueDmgPct) {
            let basePct = Math.round(skill.trueDmgPct[starIdx] * 100);
            if (skill.apRatio) {
                let apBonus = Math.round(skill.apRatio[starIdx] * (currAp / 100) * 100);
                let coloredBonus = `<span style="color:${COLORS.ap}; font-weight:bold;">🔮${apBonus}</span>`;
                html = html.replace(/고정 피해/, `고정 <span style="color:${COLORS.def}; font-weight:bold;">(${basePct} + ${coloredBonus})%</span> 피해`);
            } else {
                html = html.replace(/고정 피해/, `고정 ${wrap(basePct + '%', COLORS.def)} 피해`);
            }
        }
        
        if (skill.adRatio) {
            if (skill.type.includes('shield') && !skill.type.includes('damage') && !skill.type.includes('magic')) {
                html = html.replace(/보호막/, `${wrap(Math.round(currAd * skill.adRatio[starIdx]), COLORS.ad, '⚔️')} 보호막`);
            } else {
                html = html.replace(/피해(?!\s*(흡혈|감소))/g, `${wrap(Math.round(currAd * skill.adRatio[starIdx]), COLORS.ad, '⚔️')}피해`);
            }
        }
        else if (skill.apRatio && !skill.type.includes('shield') && !skill.trueDmgPct) html = html.replace(/피해(?!\s*(흡혈|감소))/g, `${wrap(Math.round(currAp * skill.apRatio[starIdx]), COLORS.ap, '🔮')}피해`);
        
        if (skill.hpRatio || skill.hpRatioDmg) {
            html = html.replace(/피해(?!\s*(흡혈|감소))/g, `${wrap(Math.round(currMaxHp * (skill.hpRatio || skill.hpRatioDmg)[starIdx]), COLORS.hp, '❤️')}피해`);
            html = html.replace(/회복/, `${wrap(Math.round(currMaxHp * (skill.hpRatio || skill.hpRatioDmg)[starIdx]), COLORS.hp, '❤️')} 회복`);
        }
        if (skill.hpRatioShield) html = html.replace(/보호막/, `${wrap(Math.round(currMaxHp * skill.hpRatioShield[starIdx]), COLORS.hp, '❤️')} 보호막`);
        if (skill.hpRatioSplash) html = html.replace(/스플래시 피해/, `${wrap(Math.round(currMaxHp * skill.hpRatioSplash[starIdx]), COLORS.hp, '❤️')} 스플래시 피해`);
        if (skill.armorRatio) {
            html = html.replace(/공격력 감소/, `공격력 ${wrap(Math.round(unit.stats.armor * skill.armorRatio[starIdx]), COLORS.armor, '🛡️')} 감소`);
            html = html.replace(/피해(?!\s*(흡혈|감소))/g, `${wrap(Math.round(unit.stats.armor * skill.armorRatio[starIdx]), COLORS.armor, '🛡️')}피해`);
        }
        if (skill.mrRatio) {
            html = html.replace(/보호막/, `${wrap(Math.round(unit.stats.mr * skill.mrRatio[starIdx]), COLORS.mr, '🌀')} 보호막`);
            html = html.replace(/회복/, `${wrap(Math.round(unit.stats.mr * skill.mrRatio[starIdx]), COLORS.mr, '🌀')} 회복`);
        }
        if (skill.defMrRatio) html = html.replace(/회복/, `${wrap(Math.round((unit.stats.armor + unit.stats.mr) * skill.defMrRatio[starIdx]), COLORS.def, '🛡️🌀')} 회복`);
        
        
        if (skill.stunDuration) html = html.replace(/기절/, `기절 ${wrap((skill.stunDuration[starIdx] * 0.1).toFixed(1) + '초', COLORS.def)}`);
        if (skill.tauntDuration) html = html.replace(/도발/, `도발 ${wrap((skill.tauntDuration[starIdx] * 0.1).toFixed(1) + '초', COLORS.def)}`);
        if (skill.buffDuration) html = html.replace(/일정 시간/, wrap((skill.buffDuration[starIdx] * 0.1).toFixed(1) + '초간', COLORS.def));
        
        if (healBase) html = html.replace(/회복|전체 힐|힐(?! \+)/, `$& ${wrap(Math.round(healBase[starIdx] * (currAp / 100) * 100) + '%', COLORS.ap, '🔮')}`);
        if (skill.extraHealPct) html = html.replace(/추가 힐|추가 회복/, `대상 최대 체력의 ${wrap(Math.round(skill.extraHealPct[starIdx] * (currAp / 100) * 100) + '%', COLORS.ap, '🔮')} 추가 회복`);
        
        if (skill.shieldPct) html = html.replace(/보호막/, `${wrap(Math.round(currMaxHp * skill.shieldPct[starIdx] * (currAp / 100)), COLORS.ap, '🔮')} 보호막`);
        else if (skill.shieldFlat || skill.teamShield) html = html.replace(/보호막/, `${wrap(Math.round((skill.shieldFlat || skill.teamShield)[starIdx] * (currAp / 100)), COLORS.ap, '🔮')} 보호막`);
        else if (skill.apRatio && skill.type.includes('shield')) html = html.replace(/보호막/, `${wrap(Math.round(skill.apRatio[starIdx] * currAp), COLORS.ap, '🔮')} 보호막`);
        
        if (skill.adReducPct) html = html.replace(/공격력 감소/, `공격력 ${wrap(Math.round(skill.adReducPct[starIdx] * 100) + '%', COLORS.def)} 감소`);
        if (skill.permAdBuff) html = html.replace(/공격력 영구 증가/, `공격력 ${wrap('+' + Math.round(currAd * skill.permAdBuff[starIdx]), COLORS.ad, '⚔️')} 영구 증가`);
        
        if (skill.selfDefBuff) html = html.replace(/방어력 증가/, `방어력 ${wrap('+' + Math.round(unit.stats.armor * skill.selfDefBuff[starIdx] * (currAp / 100)), COLORS.armor, '🛡️')} 증가`);
        if (skill.selfMrBuff) html = html.replace(/마법저항력 증가/, `마법저항력 ${wrap('+' + Math.round(unit.stats.mr * skill.selfMrBuff[starIdx] * (currAp / 100)), COLORS.mr, '🌀')} 증가`);
        if (skill.defMrRatio) html = html.replace(/마법 피해/, `${wrap(Math.round((unit.stats.armor + unit.stats.mr) * skill.defMrRatio[starIdx]), COLORS.def, '🛡️🌀')} 마법 피해`);
        if (skill.vampBuff) html = html.replace(/피해 흡혈/, `피해 흡혈 ${wrap(Math.round(skill.vampBuff[starIdx] * 100) + '%', COLORS.def)} `);
        if (skill.armorPen) html = html.replace(/방어력 관통/, `방어력 관통 ${wrap(Math.round(skill.armorPen[starIdx] * 100) + '%', COLORS.def)} `);
        
        if (skill.asBuff) {
            let asVal = Math.round(skill.asBuff[starIdx] * (currAp / 100) * 100);
            html = html.replace(/공격 속도 대폭 증가|공격 속도 증가|공속 증가/, `공격 속도 ${wrap('+' + asVal + '% 🔮', COLORS.as, '⚡')} 증가`);
        }
        
        if (skill.allyApFlat) html = html.replace(/주문력 증가/, `주문력 ${wrap('+' + skill.allyApFlat[starIdx], COLORS.def)} 증가`);
        if (skill.enemyMrReduc) html = html.replace(/마저 감소/, `마저 ${wrap('-' + skill.enemyMrReduc[starIdx], COLORS.def)} 감소`);
        if (skill.teamMana) html = html.replace(/마나 회복/, `마나 ${wrap('+' + skill.teamMana[starIdx], COLORS.def)} 회복`);
        if (skill.manaBurnPct) html = html.replace(/마나 소멸/, `마나 ${wrap(Math.round(skill.manaBurnPct[starIdx] * 100) + '%', COLORS.def)} 소멸`);
        if (skill.rangeBuff) html = html.replace(/사거리 증가/, `사거리 ${wrap('+' + skill.rangeBuff[starIdx], COLORS.def)} 증가`);
        if (skill.charges) html = html.replace(/수회/, wrap(skill.charges[starIdx] + '회', COLORS.def));
        if (skill.bonusTrueDmg) {
            let bDmgStr = skill.bonusTrueDmg[starIdx].toString();
            if (skill.asRatio) {
                bDmgStr += ' + ' + wrap(Math.round(unit.stats.as * skill.asRatio[starIdx]), COLORS.as, '⚡');
            }
            html = html.replace(/추가 고정 피해/, `추가 고정 ${wrap(bDmgStr, COLORS.def)} 피해`);
        }
        
        if (skill.statBuffPct || skill.teamStatBuff) {
            const statPct = (skill.statBuffPct || skill.teamStatBuff)[starIdx];
            const statScaled = Math.round(statPct * (currAp / 100) * 100);
            html = html.replace(/공격력 및 주문력 증가|스탯 증가|전투 중 스탯 증가 버프/, `공격력 및 주문력 🔮 ${wrap('+' + statScaled + '%', COLORS.ap)} 증가`);
        }
        
        if (skill.manaReducPct) html = html.replace(/마나 봉인|마나 획득 감소/, `$& ${wrap(Math.round(skill.manaReducPct[starIdx] * 100) + '%', COLORS.def)} `);
        if (skill.defReducPct || skill.statReducPct) html = html.replace(/스탯 감소|방\/마저 감소|방어력 감소/, `방/마저 ${wrap(Math.round((skill.defReducPct || skill.statReducPct)[starIdx] * 100) + '%', COLORS.def)} 감소`);
        if (skill.dmgReduc || skill.dmgReducPct) html = html.replace(/피해감소|피해 감소/, `피해 ${wrap(Math.round((skill.dmgReduc || skill.dmgReducPct)[starIdx] * 100) + '%', COLORS.def)} 감소`);
        
        if (details.length > 0) {
            html += `<div style="margin-top: 6px; font-size: 0.75rem; color: #444; background: #f1f5f9; padding: 6px; border-radius: 4px; line-height: 1.4;">${details.join('<br>')}</div>`;
        }
        return html;
    }

    showUnitInfo(baseUnit, uDiv) {
        let synergies = { subjects: {}, clubs: {} };
        let isEnemy = baseUnit.isEnemy || false;
        
        if (this.state.board.includes(baseUnit)) {
            synergies = this.getSynergyData(this.state.board);
        } else if (this.state.enemyBoard.includes(baseUnit)) {
            synergies = this.getSynergyData(this.state.enemyBoard);
            isEnemy = true;
        }
        
        const unit = this.applySynergyStats([baseUnit], synergies, isEnemy)[0];

        if (uDiv) {
            if (uDiv.dataset.currHp !== undefined) unit.currHp = parseFloat(uDiv.dataset.currHp);
            if (uDiv.dataset.currMana !== undefined) unit.currMana = parseFloat(uDiv.dataset.currMana);
            if (window.isBattlePhase && uDiv.dataset.type !== 'bench') {
                if (uDiv.dataset.currAd !== undefined) unit.stats.ad = parseFloat(uDiv.dataset.currAd);
                if (uDiv.dataset.currAp !== undefined) unit.stats.ap = parseFloat(uDiv.dataset.currAp);
                if (uDiv.dataset.currArmor !== undefined) unit.stats.armor = parseFloat(uDiv.dataset.currArmor);
                if (uDiv.dataset.currMr !== undefined) unit.stats.mr = parseFloat(uDiv.dataset.currMr);
                if (uDiv.dataset.currAs !== undefined) unit.stats.as = parseFloat(uDiv.dataset.currAs);
            }
        }

        const starText = '⭐'.repeat(unit.star || 1);
        const infoEl = document.getElementById('unit-details');
        
        let skillHtml = '';
        if (unit.skill) {
            const s = unit.skill;
            skillHtml = `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc;">
                <div style="font-size: 0.95rem; font-weight: bold; color: #d81b60; margin-bottom: 5px;">
                    ✨ [스킬] ${s.name}
                </div>
                <div style="font-size: 0.8rem; color: #555; line-height: 1.4; word-break: keep-all;">
                    ${this.formatSkillDesc(s, unit)}
                </div>
            </div>`;
        }

        const currHp = uDiv && uDiv.dataset.currHp !== undefined ? Math.round(parseFloat(uDiv.dataset.currHp)) : Math.round(unit.currHp !== undefined ? unit.currHp : unit.stats.hp);
        const currMana = uDiv && uDiv.dataset.currMana !== undefined ? Math.round(parseFloat(uDiv.dataset.currMana)) : Math.round(unit.currMana !== undefined ? unit.currMana : (unit.combat && unit.combat.startMana ? unit.combat.startMana : 0));

        let itemsHtml = '';
        const items = unit.items || [];
        for (let i = 0; i < 3; i++) {
            if (i < items.length) {
                const itemId = items[i];
                const itemDef = ITEMS.find(it => it.id === itemId);
                const iconStr = this.getIconForItem(itemId);
                itemsHtml += `<div class="unit-item-slot filled" data-item-id="${itemId}" style="width: 28px; height: 28px; border-radius: 6px; background: ${itemDef.type === 'base' ? '#e2e8f0' : '#fef08a'}; border: 1px solid ${itemDef.type === 'base' ? '#94a3b8' : '#eab308'}; display:flex; justify-content:center; align-items:center; font-size: 0.9rem; cursor:help; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">${iconStr}</div>`;
            } else {
                itemsHtml += `<div class="unit-item-slot empty" data-slot="${i}" style="width: 28px; height: 28px; border-radius: 6px; background: rgba(0,0,0,0.05); border: 1px dashed #cbd5e1;"></div>`;
            }
        }

        infoEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <div style="font-size: 1.1rem;"><strong>${starText} ${unit.name}</strong> <span style="color:var(--gold-color);">(${unit.tier}G)</span></div>
                <div class="unit-items-container" data-type="${uDiv ? uDiv.dataset.type : ''}" data-index="${uDiv ? uDiv.dataset.index : ''}" style="display: flex; gap: 4px;">
                    ${itemsHtml}
                </div>
            </div>
            <div style="color: #666; font-size: 0.85rem; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed #ccc;">
                📚 <span class="unit-info-synergy" data-type="subjects" data-name="${unit.subject}" style="cursor:help; font-weight:bold; border-bottom: 1px dotted #888;">${unit.subject}</span> &nbsp;|&nbsp; 
                🏷️ <span class="unit-info-synergy" data-type="clubs" data-name="${unit.club}" style="cursor:help; font-weight:bold; border-bottom: 1px dotted #888;">${unit.club}</span>
                <span class="mana-type-tag" data-type="${unit.manaType}" style="cursor:help; float:right; border-radius: 4px; padding: 2px 6px; background: #eee; font-weight:bold; font-size: 0.75rem;">
                    ${unit.manaType === '근성' ? '🛡️ 근성 마나' : unit.manaType === '전투' ? '⚔️ 전투 마나' : '🔮 집중 마나'}
                </span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; font-weight: 600; color: #444;">
                <div>❤️ 체력: <span id="info-hp" style="color:#4caf50">${Math.max(0, currHp)}</span><span style="color:#888; font-size:0.75rem;">/${unit.stats.maxHp || unit.stats.hp}</span></div>
                <div>💧 마나: <span id="info-mana" style="color:#1e88e5">${Math.max(0, currMana)}</span><span style="color:#888; font-size:0.75rem;">/${unit.stats.maxMana || unit.stats.mana}</span></div>
                <div>⚔️ 공격력: <span id="info-ad" style="color:#e65100">${Math.round(unit.stats.ad)}</span></div>
                <div>🔮 주문력: <span id="info-ap" style="color:#8e24aa">${Math.round(unit.stats.ap)}%</span></div>
                <div>🛡️ 방어: <span id="info-armor" style="color:#795548">${Math.round(unit.stats.armor)}</span></div>
                <div>🌀 마저: <span id="info-mr" style="color:#00897b">${Math.round(unit.stats.mr)}</span></div>
                <div>⚡ 공속: <span id="info-as" style="color:#e53935">${unit.stats.as.toFixed(2)}</span></div>
                <div>🎯 사거리: <span style="color:#546e7a">${unit.stats.range}</span></div>
                <div style="grid-column: span 2; border-top: 1px dotted #ccc; margin-top: 2px; padding-top: 4px;"></div>
                <div>🗡️ 치명 확률: <span style="color:#ffb300">${Math.round((unit.combat?.critChance || 0)*100)}%</span></div>
                <div>💥 치명 배율: <span style="color:#ffb300">${Math.round((unit.combat?.critDmg || 1.5)*100)}%</span></div>
                <div>📈 피해 증폭: <span style="color:#ef5350">+${Math.round((unit.combat?.dmgAmp || 0)*100)}%</span></div>
                <div>📉 피해 감소: <span style="color:#29b6f6">${Math.round((unit.combat?.dmgReduc || 0)*100)}%</span></div>
                <div>🩸 흡혈률: <span style="color:#ec407a">${Math.round((unit.combat?.vamp || 0)*100)}%</span></div>
                <div>🌱 추가 재생: <span style="color:#42a5f5">+${((unit.combat?.teamManaRegen || 0) + (unit.subject === '미술' ? (unit.combat?.artManaRegen || 0) : 0))}</span></div>
            </div>
            ${skillHtml}
        `;

        const manaTag = infoEl.querySelector('.mana-type-tag');
        if (manaTag) {
            manaTag.onmouseover = (e) => {
                const type = manaTag.dataset.type;
                let text = '';
                if (type === '근성') text = '🛡️ <b>근성 마나</b><br>평타 공격 시 마나를 회복하지 못합니다.<br>대신 적에게 피해를 입을 때마다 <b>받은 피해의 10%</b>만큼 마나를 회복합니다. (최대 50)';
                else if (type === '전투') text = '⚔️ <b>전투 마나</b><br>적에게 피해를 입을 때 마나를 회복하지 못합니다.<br>대신 평타 공격 시 마나를 <b>10</b> 회복합니다.';
                else text = '🔮 <b>집중 마나</b><br>적에게 피해를 입을 때 마나를 회복하지 못합니다.<br>평타 공격 시 마나를 5 회복하며, <b>초당 2의 마나</b>가 지속적으로 차오릅니다.';
                
                this.showCustomTooltip(e, text, false);
            };
            manaTag.onmouseout = () => this.hideCustomTooltip();
        }

        const itemsContainer = infoEl.querySelector('.unit-items-container');
        if (itemsContainer) {
            itemsContainer.ondragover = (e) => e.preventDefault();
            itemsContainer.ondrop = (e) => {
                const itemIdxStr = e.dataTransfer.getData('itemIdx');
                if (itemIdxStr) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.giveItemToUnit(parseInt(itemIdxStr), baseUnit);
                }
            };
        }
        
        const itemSlots = infoEl.querySelectorAll('.unit-item-slot.filled');
        itemSlots.forEach(slot => {
            slot.onmouseover = (e) => {
                if (window.isContextMenuOpen) return;
                const itemId = slot.dataset.itemId;
                const itemDef = ITEMS.find(it => it.id === itemId);
                const iconStr = this.getIconForItem(itemId);
                this.showCustomTooltip(e, `
                    <div style="font-weight:bold; color:${itemDef.type === 'base' ? '#94a3b8' : '#eab308'}; font-size:1rem; margin-bottom:4px;">
                        ${iconStr} ${itemDef.name}
                        <span style="font-size:0.75rem; color:#888; font-weight:normal; margin-left:4px;">${this.formatItemStats(itemDef.stats)}</span>
                    </div>
                    <div style="color:#cbd5e1;">${itemDef.desc}</div>
                    ${itemDef.type === 'base' ? '<div style="font-size:0.75rem; color:#64748b; margin-top:5px; text-align:right;">좌클릭하여 조합표 보기</div>' : ''}
                `);
            };
            
            slot.onmouseout = (e) => {
                if (!window.isContextMenuOpen) {
                    this.hideCustomTooltip();
                }
            };
            
            slot.onclick = (e) => {
                e.stopPropagation();
                const itemId = slot.dataset.itemId;
                const itemDef = ITEMS.find(it => it.id === itemId);
                if (itemDef.type === 'base') {
                    let html = `<div style="font-weight:bold; color:#eab308; margin-bottom:8px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">${itemDef.name} 조합표</div>`;
                    html += `<div style="display:flex; flex-direction:column; gap:6px;">`;
                    ITEMS.filter(x => x.type === 'combined' && x.recipe && x.recipe.includes(itemId)).forEach(combo => {
                        const otherId = combo.recipe[0] === itemId ? combo.recipe[1] : combo.recipe[0];
                        const otherDef = ITEMS.find(x => x.id === otherId);
                        const otherIcon = this.getIconForItem(otherId);
                        const comboIcon = this.getIconForItem(combo.id);
                        html += `
                            <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:4px; position:relative;"
                                 onmouseover="this.querySelector('.combo-tooltip').style.display='block';"
                                 onmouseout="this.querySelector('.combo-tooltip').style.display='none';">
                                <span>+</span>
                                <span>${otherIcon}</span>
                                <span style="color:#cbd5e1; font-size:0.85rem; flex:1;">${otherDef.name}</span>
                                <span>=</span>
                                <span style="font-size:1.1rem; cursor:help;">${comboIcon}</span>
                                <div class="combo-tooltip" style="display:none; position:absolute; right:100%; top:50%; transform:translateY(-50%); margin-right:10px; width:220px; background:rgba(15,23,42,0.95); padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); box-shadow:0 5px 15px rgba(0,0,0,0.5); z-index:1000000; font-size:0.8rem; line-height:1.3;">
                                    <div style="color:#eab308; font-weight:bold; margin-bottom:4px;">
                                        ${combo.name}
                                        <div style="font-size:0.7rem; color:#888; font-weight:normal;">${this.formatItemStats(combo.stats)}</div>
                                    </div>
                                    <div style="color:#cbd5e1; white-space:pre-wrap;">${combo.desc}</div>
                                </div>
                            </div>
                        `;
                    });
                    html += `</div>`;
                    this.showCustomTooltip(e, html, true);
                }
            };
        });
        // 전투 중 실시간 반영을 위해 플래그 세팅
        document.querySelectorAll('.unit-character').forEach(u => u.dataset.viewing = "false");
        if (uDiv) uDiv.dataset.viewing = "true";
        
        const synSpans = infoEl.querySelectorAll('.unit-info-synergy');
        synSpans.forEach(span => {
            span.onmouseover = (e) => {
                const type = span.dataset.type;
                const name = span.dataset.name;
                const syn = SYNERGIES[type][name];
                if (!syn) return;
                
                const tooltip = document.getElementById('tooltip');
                tooltip.style.display = 'block';
                tooltip.style.left = (e.pageX + 15) + 'px';
                tooltip.style.top = (e.pageY + 15) + 'px';
                
                let html = `<strong style="color:#d81b60">${syn.name}</strong><br><span style="font-size:0.85rem; color:#555;">${syn.desc}</span><div style="margin-top:5px; font-size:0.75rem;">`;
                for (const [lvl, effects] of Object.entries(syn.levels)) {
                    html += `<div style="margin-top:3px;"><span style="font-weight:bold; color:#1976d2;">[${lvl}]</span> `;
                    let effStrs = [];
                    for(const [k,v] of Object.entries(effects)) effStrs.push(formatStat(k, v));
                    html += effStrs.join(', ') + `</div>`;
                }
                html += `</div>`;
                tooltip.innerHTML = html;
            };
            span.onmouseout = () => {
                document.getElementById('tooltip').style.display = 'none';
            };
        });
    }

    getMaxExp(level) {
        let max = EXP_TABLE[level];
        if(!max) return null;
        if(this.state.globalBuffs && this.state.globalBuffs.earlyGraduation) return Math.floor(max * 0.7);
        return max;
    }

    addExp(amount) {
        if(this.state.level >= 10) return;
        this.state.exp += amount;
        
        while(this.state.level < 10) {
            const req = this.getMaxExp(this.state.level);
            if(this.state.exp >= req) {
                this.state.exp -= req;
                this.state.level++;
                if (this.state.level === 7 && this.state.globalBuffs && this.state.globalBuffs.cramming) {
                    this.state.gold += 40;
                    this.state.globalBuffs.cramming = false;
                }
            } else {
                break;
            }
        }
        this.updateHeader();
    }

    buyExp() {
        if(this.state.gold >= 4 && this.state.level < 10) {
            this.state.gold -= 4;
            this.addExp(4);
        } else if (this.state.level >= 10) {
            alert("최대 레벨입니다.");
        } else {
            alert("골드가 부족합니다.");
        }
    }

    refreshShop(isFree = false) {
        const cost = (this.state.globalBuffs && this.state.globalBuffs.rerollDiscountEndWorld >= this.state.stage[0]) ? 1 : 2;
        if (!isFree) {
            if (this.state.freeRerolls > 0) {
                this.state.freeRerolls--;
                isFree = true;
            } else if (this.state.gold >= cost) {
                this.state.gold -= cost;
            } else {
                alert("골드가 부족합니다.");
                return;
            }
        }
        
        const effectiveLevel = Math.min(10, this.state.level + (this.state.highEndShopping ? 1 : 0));
        const probs = SHOP_PROBABILITIES[effectiveLevel] || SHOP_PROBABILITIES[9];
        
        this.state.shop = Array(5).fill(null).map(() => {
            let roll = Math.random() * 100;
            let sum = 0, selectedTier = 1;
            for(let i=0; i<5; i++) {
                sum += probs[i];
                if(roll <= sum) { selectedTier = i+1; break; }
            }
            if(selectedTier === 1 && this.state.globalBuffs && this.state.globalBuffs.noTier1) selectedTier = 2;

            const pool = UNIT_POOL.filter(u => u.tier === selectedTier);
            return pool.length > 0 ? {...pool[Math.floor(Math.random() * pool.length)]} : null;
        });
        
        this.updateHeader();
        this.renderShop();
    }

    renderShop() {
        const shopEl = document.getElementById('shop-slots');
        shopEl.innerHTML = '';
        
        // 상점이 비어있다면 한 번 채워준다.
        if(!this.state.shop || this.state.shop.length === 0 || this.state.shop[0] === null) {
            // refreshShop 내부에서 renderShop을 호출하므로 무한루프 방지를 위해 배열만 채움
            this.refreshShop(true);
            return;
        }

        for(let i=0; i<5; i++) {
            const randomUnit = this.state.shop[i];
            
            const card = document.createElement('div');
            
            if(!randomUnit) {
                card.className = 'shop-card';
                card.style.visibility = 'hidden';
                shopEl.appendChild(card);
                continue;
            }

            card.className = 'shop-card tier-' + randomUnit.tier;
            card.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: 5px;">${randomUnit.icon || '🧑‍🎓'}</div>
                <h4 style="margin-bottom: 3px;">${randomUnit.name}</h4>
                <p style="font-size: 0.8rem; color: #666;">${randomUnit.subject} / ${randomUnit.club}</p>
                <b style="color: #d81b60; margin-top: auto;">${randomUnit.tier}G</b>
            `;
            
            card.onmouseover = (e) => {
                const tooltip = document.getElementById('tooltip');
                tooltip.style.display = 'block';
                tooltip.style.left = (e.pageX + 10) + 'px';
                tooltip.style.top = (e.pageY - 160) + 'px';
                
                let skillHtml = '';
                if(randomUnit.skill) {
                    skillHtml = `
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;">
                        <strong style="color: #2c3e50; font-size: 0.9rem;">✨ ${randomUnit.skill.name}</strong>
                        <p style="font-size: 0.8rem; color: #555; margin-top: 4px; line-height: 1.3; white-space: pre-wrap;">${randomUnit.skill.desc}</p>
                    </div>`;
                }

                tooltip.innerHTML = `
                    <div style="font-size: 1.1rem; margin-bottom: 5px;"><strong>⭐ ${randomUnit.name}</strong> <span style="color:var(--gold-color);">(${randomUnit.tier}G)</span></div>
                    <div style="color: #666; font-size: 0.85rem; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #ccc;">
                        📚 ${randomUnit.subject} &nbsp;|&nbsp; 🏷️ ${randomUnit.club}
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
                // 더블클릭 방지: 이미 구매된 슬롯이면 무시
                if (!this.state.shop[i]) return;
                
                const emptyIdx = this.state.bench.findIndex(u => u === null);
                if (emptyIdx === -1) {
                    console.log("대기석이 꽉 찼습니다.");
                    return;
                }
                
                if(this.state.gold >= randomUnit.tier) {
                    this.state.gold -= randomUnit.tier;
                    // 먼저 상점 슬롯 비우기 (더블클릭 방지)
                    this.state.shop[i] = null;
                    card.style.visibility = 'hidden';
                    
                    // 객체 깊은 복사 및 1성 초기화
                    const newUnit = JSON.parse(JSON.stringify(randomUnit));
                    newUnit.star = 1;
                    newUnit.items = [];
                    
                    this.state.bench[emptyIdx] = newUnit;
                    this.updateHeader();
                    this.renderUnits();
                    console.log(`${randomUnit.name} 구매함 (대기석 ${emptyIdx}번)`);
                    
                    // 진화 체크
                    this.checkForUpgrade(newUnit.id);
                } else {
                    console.log("골드가 부족합니다.");
                }
            };
            shopEl.appendChild(card);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.isBattlePhase = false; // 강제로 전투 모드 해제 (오류로 인해 멈춤 방지)
    console.log("게임 초기화: isBattlePhase = false");
    window.gameApp = new GameApp();
    
    // 글로벌 툴팁 화면 밖 이탈 방지 로직
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        const observer = new MutationObserver(() => {
            if (tooltip.style.display === 'block') {
                const rect = tooltip.getBoundingClientRect();
                let left = parseInt(tooltip.style.left || 0);
                let top = parseInt(tooltip.style.top || 0);
                let adjusted = false;

                if (left + rect.width > window.innerWidth) {
                    left = window.innerWidth - rect.width - 20;
                    adjusted = true;
                }
                if (top + rect.height > window.innerHeight) {
                    top = window.innerHeight - rect.height - 20;
                    adjusted = true;
                }
                
                if (adjusted) {
                    observer.disconnect();
                    tooltip.style.left = left + 'px';
                    tooltip.style.top = top + 'px';
                    observer.observe(tooltip, { attributes: true, attributeFilter: ['style'] });
                }
            }
        });
        observer.observe(tooltip, { attributes: true, attributeFilter: ['style'] });
    }
    
    // 유닛 도감 모달 기능 연동
    const dictModal = document.getElementById('dict-modal');
    const filterSelect = document.getElementById('filter-synergy');
    const infoDiv = document.getElementById('dict-synergy-info');
    
    // 상점 확률 툴팁 연동
    const levelBox = document.querySelector('.shop-level-box');
    if (levelBox) {
        levelBox.onmouseover = (e) => {
            const st = window.gameApp.state;
            const effectiveLevel = Math.min(10, st.level + (st.highEndShopping ? 1 : 0));
            const probs = SHOP_PROBABILITIES[effectiveLevel] || SHOP_PROBABILITIES[9];
            
            const tooltip = document.getElementById('tooltip');
            tooltip.style.display = 'block';
            tooltip.style.left = (e.pageX + 15) + 'px';
            tooltip.style.top = (e.pageY - 120) + 'px';
            tooltip.innerHTML = `
                <div style="font-size: 0.95rem; font-weight: bold; margin-bottom: 5px; color: #1976d2; border-bottom: 1px solid #eee; padding-bottom: 5px;">Lv.${st.level} 상점 확률</div>
                <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #444;">
                    <div><span style="color:var(--tier1); font-weight:bold;">1코스트:</span> ${probs[0]}%</div>
                    <div><span style="color:var(--tier2); font-weight:bold;">2코스트:</span> ${probs[1]}%</div>
                    <div><span style="color:var(--tier3); font-weight:bold;">3코스트:</span> ${probs[2]}%</div>
                    <div><span style="color:var(--tier4); font-weight:bold;">4코스트:</span> ${probs[3]}%</div>
                    <div><span style="color:var(--tier5); font-weight:bold;">5코스트:</span> ${probs[4]}%</div>
                </div>
            `;
        };
        levelBox.onmouseout = () => {
            document.getElementById('tooltip').style.display = 'none';
        };
    }
    
    // 시너지 옵션 생성
    const allTraits = [...Object.keys(SYNERGIES.subjects), ...Object.keys(SYNERGIES.clubs)];
    allTraits.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.innerText = t;
        filterSelect.appendChild(opt);
    });

    let currentDictCostFilter = 0;
    const dictCostBtns = document.querySelectorAll('.dict-cost-btn');
    dictCostBtns.forEach(btn => {
        btn.onclick = (e) => {
            currentDictCostFilter = parseInt(e.target.dataset.cost);
            dictCostBtns.forEach(b => {
                b.style.background = 'white';
                b.style.color = '#444';
            });
            e.target.style.background = '#334155';
            e.target.style.color = 'white';
            renderDictionary(filterSelect.value);
        };
    });

    filterSelect.onchange = (e) => {
        const val = e.target.value;
        renderDictionary(val);
        if(val !== 'all') {
            const syn = SYNERGIES.subjects[val] || SYNERGIES.clubs[val];
            infoDiv.style.display = 'block';
            let html = `<strong style="font-size:1.1rem; color:#d81b60;">${syn.name} (${syn.desc})</strong><div style="margin-top:8px;">`;
            for (const [lvl, effects] of Object.entries(syn.levels)) {
                html += `<span style="font-weight:bold;">[${lvl}]</span> `;
                let effStrs = [];
                for(const [k,v] of Object.entries(effects)) effStrs.push(formatStat(k, v));
                html += effStrs.join(', ') + '&nbsp;&nbsp;|&nbsp;&nbsp;';
            }
            html += `</div>`;
            infoDiv.innerHTML = html;
        } else {
            infoDiv.style.display = 'none';
        }
    };

    document.getElementById('btn-dictionary').onclick = () => {
        dictModal.style.display = 'flex';
        renderDictionary(filterSelect.value);
    };
    document.getElementById('btn-close-dict').onclick = () => {
        dictModal.style.display = 'none';
    };

    function renderDictionary(filter = 'all') {
        const body = document.getElementById('dict-body');
        body.innerHTML = '';
        
        let pool = [...UNIT_POOL];
        if(filter !== 'all') {
            pool = pool.filter(u => u.subject === filter || u.club === filter);
        }
        if(currentDictCostFilter > 0) {
            pool = pool.filter(u => u.tier === currentDictCostFilter);
        }
        
        const sortedPool = pool.sort((a,b) => a.tier - b.tier);
        sortedPool.forEach(u => {
            const card = document.createElement('div');
            card.className = `dict-card tier-${u.tier}`;
            
            let skillHtml = '';
            if (u.skill) {
                skillHtml = `
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #ccc; text-align: left; width: 100%;">
                    <div style="font-size: 0.85rem; font-weight: bold; color: #d81b60; margin-bottom: 3px;">
                        ✨ ${u.skill.name}
                    <div style="font-size: 0.75rem; color: #555; line-height: 1.3; word-break: keep-all;">
                        ${window.gameApp.formatSkillDesc(u.skill, u)}
                    </div>
                </div>`;
            }

            card.innerHTML = `
                <div style="font-size: 2.2rem; margin-bottom: 5px;">${u.icon}</div>
                <strong style="font-size: 1rem; color:#334155;">${u.name}</strong>
                <span style="color:var(--gold-color); font-weight:900; font-size:0.9rem;">${u.tier}G</span>
                <div style="font-size: 0.75rem; color:#64748b; margin-top: 8px;">
                    📚 ${u.subject} | 🏷️ ${u.club}
                    <span class="mana-type-tag" data-type="${u.manaType}" style="cursor:help; float:right; border-radius: 4px; padding: 2px 6px; background: #e2e8f0; font-weight:bold; font-size: 0.75rem;">
                        ${u.manaType === '근성' ? '🛡️ 근성 마나' : u.manaType === '전투' ? '⚔️ 전투 마나' : '🔮 집중 마나'}
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 0.75rem; color:#475569; margin-top: 10px; text-align:left; width: 100%; background:#f1f5f9; padding:8px; border-radius:5px; font-weight:600;">
                    <div>❤️ 체력: <span style="color:#4caf50">${u.stats.hp}</span></div>
                    <div>💧 마나: <span style="color:#1e88e5">${u.stats.mana}/${u.stats.maxMana}</span></div>
                    <div>⚔️ 공격력: <span style="color:#e65100">${u.stats.ad}</span></div>
                    <div>🔮 주문력: <span style="color:#8e24aa">${u.stats.ap}%</span></div>
                    <div>🛡️ 방어: <span style="color:#795548">${u.stats.armor}</span></div>
                    <div>🌀 마저: <span style="color:#00897b">${u.stats.mr}</span></div>
                    <div>⚡ 공속: <span style="color:#e53935">${u.stats.as}</span></div>
                    <div>🎯 사거리: <span style="color:#546e7a">${u.stats.range}</span></div>
                    <div style="grid-column: span 2; border-top: 1px dotted #ccc; margin-top: 2px; padding-top: 4px;"></div>
                    <div>🗡️ 치명 확률: <span style="color:#ffb300">0%</span></div>
                    <div>💥 치명 배율: <span style="color:#ffb300">150%</span></div>
                    <div>📈 피해 증폭: <span style="color:#ef5350">+0%</span></div>
                    <div>📉 피해 감소: <span style="color:#29b6f6">0%</span></div>
                    <div>🩸 흡혈률: <span style="color:#ec407a">0%</span></div>
                    <div>🌱 마나 재생: <span style="color:#42a5f5">+0</span></div>
                </div>
                ${skillHtml}
            `;
            body.appendChild(card);
            const manaTag = card.querySelector('.mana-type-tag');
            if (manaTag) {
                manaTag.onmouseover = (e) => {
                    const type = manaTag.dataset.type;
                    let text = '';
                    if (type === '근성') text = '🛡️ <b>근성 마나</b><br>평타 공격 시 마나를 회복하지 못합니다.<br>대신 적에게 피해를 입을 때마다 <b>받은 피해의 15%</b>만큼 마나를 회복합니다. (최대 50)';
                    else if (type === '전투') text = '⚔️ <b>전투 마나</b><br>적에게 피해를 입을 때 마나를 회복하지 못합니다.<br>대신 평타 공격 시 마나를 <b>10</b> 회복합니다.';
                    else text = '🔮 <b>집중 마나</b><br>적에게 피해를 입을 때 마나를 회복하지 못합니다.<br>평타 공격 시 마나를 5 회복하며, <b>초당 2의 마나</b>가 지속적으로 차오릅니다.';
                    
                    const tooltip = document.getElementById('tooltip');
                    tooltip.style.display = 'block';
                    tooltip.style.left = (e.pageX + 15) + 'px';
                    tooltip.style.top = (e.pageY - 15) + 'px';
                    tooltip.innerHTML = text;
                };
                manaTag.onmouseout = () => {
                    document.getElementById('tooltip').style.display = 'none';
                };
            }
        });
    }

    // 리롤 버튼 연동
    document.getElementById('btn-reroll').onclick = () => {
        window.gameApp.refreshShop();
    };

    // 경험치 구매 버튼 연동
    document.getElementById('btn-buy-exp').onclick = () => {
        window.gameApp.buyExp();
    };

    // 상점 잠금 버튼 연동
    document.getElementById('btn-lock-shop').onclick = () => {
        const st = window.gameApp.state;
        st.shopLocked = !st.shopLocked;
        const btn = document.getElementById('btn-lock-shop');
        if (st.shopLocked) {
            btn.innerText = "🔒 상점 잠김";
            btn.style.background = "#d32f2f"; // 빨간색으로 변경
        } else {
            btn.innerText = "🔓 상점 열림";
            btn.style.background = "#607d8b"; // 기본색으로 복구
        }
    };

    // 전투 시작 버튼 연동 (Phase 4 & 5)
    document.getElementById('btn-start-battle').onclick = () => {
        const app = window.gameApp;
        let playerUnitsCount = app.state.board.filter(u => u !== null).length;
        const maxCapacity = app.state.level;
        
        // 자동 배치 로직 (대기석의 유닛을 보드의 빈 자리로)
        if (playerUnitsCount < maxCapacity) {
            for (let i = 0; i < app.state.bench.length; i++) {
                if (app.state.bench[i] !== null && playerUnitsCount < maxCapacity) {
                    // 보드 뒤쪽부터 배치하는 것이 보통 유리하므로 뒤쪽 빈 공간(16~23)부터 찾거나, 그냥 앞에서부터 찾음
                    // 심플하게 앞에서부터 빈 공간을 찾음
                    const emptyBoardIdx = app.state.board.findIndex(u => u === null);
                    if (emptyBoardIdx !== -1) {
                        app.state.board[emptyBoardIdx] = app.state.bench[i];
                        app.state.bench[i] = null;
                        playerUnitsCount++;
                    }
                }
            }
            app.renderUnits();
            app.updateHeader();
            app.calculateSynergy();
        }

        // (증강체 타이밍 검사 로직은 라운드 전환 시점(전투 종료 후)으로 이동됨)
        
        // 전투 시작 전, 전투 로그창 초기화
        const battleLogEl = document.getElementById('battle-log');
        if (battleLogEl) battleLogEl.innerHTML = '';
        
        window.isBattlePhase = true; // 전투 상태 플래그 활성화
        
        // 보드의 유닛들은 드래그만 불가능하게 하고 클릭(정보 보기)은 가능하게 유지
        document.querySelectorAll('.board-cell .unit-character').forEach(u => u.draggable = false);
        
        // 적은 init() 및 다음 라운드에서 이미 state.enemyBoard에 스폰되어 있음
        const playerSynergies = window.gameApp.getSynergyData(window.gameApp.state.board);
        const enemySynergies = window.gameApp.getSynergyData(window.gameApp.state.enemyBoard);
        
        const buffedPlayerBoard = window.gameApp.applySynergyStats(window.gameApp.state.board, playerSynergies, false);
        const buffedEnemyBoard = window.gameApp.applySynergyStats(window.gameApp.state.enemyBoard, enemySynergies, true);

        // --- 학사일정(증강체) 전투 시작 연출 ---
        const g = app.state.globalBuffs;
        if (g) {
            if (g.enforcerAura) {
                const li = document.createElement('li');
                li.style.color = '#e056fd';
                li.style.fontWeight = 'bold';
                li.style.fontSize = '0.9rem';
                li.style.borderBottom = '1px dashed #eee';
                li.style.paddingBottom = '4px';
                li.innerHTML = `🌟 <strong style="color:#d32f2f;">[선도부의 위압감]</strong> 적 전체 최대 체력 15% 감소!`;
                if (battleLogEl) battleLogEl.appendChild(li);
                
                // 적 전체 흑백/보라색 번개 이펙트
                document.querySelectorAll('#battle-board .enemy-unit').forEach(el => {
                    const vfx = document.createElement('div');
                    vfx.className = 'vfx debuff_dark';
                    el.appendChild(vfx);
                    setTimeout(() => { if(vfx.parentNode) vfx.remove(); }, 800);
                });
            }
            if (g.startShield > 0) {
                const li = document.createElement('li');
                li.style.color = '#f1c40f';
                li.style.fontWeight = 'bold';
                li.style.fontSize = '0.9rem';
                li.style.borderBottom = '1px dashed #eee';
                li.style.paddingBottom = '4px';
                li.innerHTML = `🍔 <strong style="color:#f57f17;">[든든한 급식]</strong> 아군 전체 보호막 +${g.startShield}!`;
                if (battleLogEl) battleLogEl.appendChild(li);
                
                // 아군 전체 초록색 보호막 이펙트
                document.querySelectorAll('#battle-board .player-unit').forEach(el => {
                    const vfx = document.createElement('div');
                    vfx.className = 'vfx buff_green';
                    el.appendChild(vfx);
                    setTimeout(() => { if(vfx.parentNode) vfx.remove(); }, 800);
                });
            }
            if (g.startMana > 0) {
                const li = document.createElement('li');
                li.style.color = '#e056fd';
                li.style.fontWeight = 'bold';
                li.style.fontSize = '0.9rem';
                li.style.borderBottom = '1px dashed #eee';
                li.style.paddingBottom = '4px';
                li.innerHTML = `👑 <strong style="color:#3498db;">[반장 선거 압승]</strong> 아군 전체 시작 마나 +${g.startMana}!`;
                if (battleLogEl) battleLogEl.appendChild(li);
                
                // 아군 전체 파란색 마나 이펙트 (보호막과 시차를 두거나 동시에 겹침)
                document.querySelectorAll('#battle-board .player-unit').forEach(el => {
                    const vfx = document.createElement('div');
                    vfx.className = 'vfx magic_purple';
                    el.appendChild(vfx);
                    setTimeout(() => { if(vfx.parentNode) vfx.remove(); }, 800);
                });
            }
        }

        // 2. 엔진 계산 (백그라운드 틱 시뮬레이션)
        const preBattlePlayerBoard = JSON.parse(JSON.stringify(buffedPlayerBoard));
        const engine = new BattleEngine(buffedPlayerBoard, buffedEnemyBoard);
        app.engine = engine; // 실시간 정보 조회용 참조 저장
        const logs = engine.run();
        
        // 3. 리플레이 시각화 재생
        const renderer = new BattleRenderer(logs, document.getElementById('battle-board'));
        renderer.play((winner, endLog) => {
            const currentGold = window.gameApp.state.gold;
            const st = window.gameApp.state;
            
            let interest = Math.floor(currentGold / 10);
            if(!st.richFoundation) interest = Math.min(5, interest);

            // 연승/연패 보너스 계산 함수
            const getStreakBonus = (count) => {
                if(count >= 7) return 3;
                if(count >= 5) return 2;
                if(count >= 3) return 1;
                return 0;
            };

            let title = '';
            let msg = '';
            let type = 'win';
            let onConfirm = null;

            if(winner === 'player') {
                st.winStreak++;
                st.lossStreak = 0;
                const streakBonus = getStreakBonus(st.winStreak);

                let totalGold = 5 + interest + streakBonus;
                if(st.honorStudent) { totalGold += 1; window.gameApp.addExp(1); }
                if(st.snackShop) { totalGold += 1; }
                if(st.lostAndFound && Math.random() < 0.3) {
                    const pool = UNIT_POOL.filter(u => u.tier === 1);
                    window.gameApp.addToBench({...pool[Math.floor(Math.random() * pool.length)]});
                }
                
                st.gold += totalGold;
                title = '승리!';
                msg = `<span style="color:#2563eb; font-weight:800;">⚔️ 전투 승리!</span> (+${totalGold}G)`;
                if(st.winStreak >= 3) msg += `<br><span style="color:#e84393;">🔥 ${st.winStreak}연승 보너스 +${streakBonus}G</span>`;
            } else {
                st.lossStreak++;
                st.winStreak = 0;
                const streakBonus = getStreakBonus(st.lossStreak);

                let totalGold = 3 + interest + streakBonus;
                if(st.snackShop) { totalGold += 1; }
                st.gold += totalGold;
                
                // 가변 패배 데미지: 기본 2 + 살아남은 적 수 + 현재 월드 번호
                const survivingEnemies = endLog ? (endLog.survivingEnemies || 0) : 0;
                let dmg = 2 + survivingEnemies + st.stage[0];
                
                if(st.invincibleRounds > 0) {
                    dmg = 0;
                    st.invincibleRounds--;
                    title = '체력 보존!';
                    type = 'save';
                    msg = `<span style="color:#0984e3; font-weight:800;">😭 패배했지만 [지각 면제권]으로 체력 보존!</span><br><span style="font-size:0.9rem; color:#636e72;">(남은 무적: ${st.invincibleRounds}회)</span>`;
                    if(st.lossStreak >= 3) msg += `<br><span style="color:#00cec9;">💧 ${st.lossStreak}연패 보너스 +${streakBonus}G</span>`;
                } else {
                    if(st.lateLeave) dmg = Math.floor(dmg / 2);
                    st.hp -= dmg;
                    if(st.hp <= 0) {
                        title = '게임 오버';
                        type = 'gameover';
                        msg = `<span style="color:#d63031; font-weight:800; font-size:1.3rem;">💀 체력이 0이 되었습니다.</span>`;
                        onConfirm = () => location.reload();
                    } else {
                        title = '패배...';
                        type = 'loss';
                        msg = `<span style="color:#d63031; font-weight:800;">😭 전투 패배...</span><br><span style="font-size:0.9rem; color:#636e72;">(-${dmg} HP, 적 ${survivingEnemies}명 생존) (+${totalGold}G)</span>`;
                        if(st.lossStreak >= 3) msg += `<br><span style="color:#00cec9;">💧 ${st.lossStreak}연패 보너스 +${streakBonus}G</span>`;
                    }
                }
            }
            
            // PVE 라운드 (x-5) 종료 시 보상 (승패 상관없이 지급)
            if (st.stage[1] === 5 && type !== 'gameover') {
                window.gameApp.giveRandomBaseItem();
                window.gameApp.giveRandomBaseItem();
                msg += `<br><br><div style="background:rgba(241,196,15,0.15); padding:12px; border-radius:12px; border:1px solid rgba(241,196,15,0.4);"><span style="font-size:1.5rem;">🎉</span> <strong style="color:#d35400;">기말고사(PVE) 완료!</strong><br><span style="color:#34495e; font-size:0.95rem;">무작위 기본 아이템 2개를 획득했습니다!</span></div>`;
            }

            window.gameApp.showResultModal(title, msg, type, onConfirm);
            
            if(type === 'gameover') return;
            
            // 기본 경험치 +2 자동 지급
            window.gameApp.addExp(2);
            
            // 라운드/스테이지 증가
            window.gameApp.state.stage[1]++;
            if(window.gameApp.state.stage[1] > 5) {
                window.gameApp.state.stage[0]++;
                window.gameApp.state.stage[1] = 1;
            }
            
            // 전투 종료 시 도적의 장갑 아이템 리롤
            window.gameApp.state.board.forEach(u => {
                if (u && u.items && u.items.includes('comb_crit_crit')) {
                    const combinedItems = ITEMS.filter(i => i.type === 'combined' && i.id !== 'comb_crit_crit');
                    u.thievesItems = [
                        combinedItems[Math.floor(Math.random() * combinedItems.length)].id,
                        combinedItems[Math.floor(Math.random() * combinedItems.length)].id
                    ];
                }
            });
            
            // 패시브 영구 스탯 증가분을 원본 유닛에 반영 (전투 애니메이션 종료 후 적용)
            const allEngineUnits = engine.board.filter(u => u !== null && u.team === 'player');
            allEngineUnits.forEach(combatUnit => {
                if (combatUnit.skill && combatUnit.skill.type === 'passive') {
                    const boardIdx = combatUnit.originalBoardIdx;
                    const originalUnit = window.gameApp.state.board[boardIdx];
                    const preBattleUnit = preBattlePlayerBoard[boardIdx];
                    if (originalUnit && preBattleUnit) {
                        // permGrowth 초기화 (없으면 생성)
                        if (!originalUnit.permGrowth) originalUnit.permGrowth = { ad: 0, as: 0, ap: 0, hp: 0 };
                        // 절대값 증가분 계산 (전투 중 패시브로 올라간 양)
                        const adIncrease = combatUnit.stats.ad - preBattleUnit.stats.ad;
                        const asIncrease = combatUnit.stats.as - preBattleUnit.stats.as;
                        const apIncrease = combatUnit.stats.ap - preBattleUnit.stats.ap;
                        const hpIncrease = (combatUnit.stats.maxHp || combatUnit.stats.hp) - (preBattleUnit.stats.maxHp || preBattleUnit.stats.hp);
                        
                        if (adIncrease > 0) {
                            originalUnit.permGrowth.ad = Math.round((originalUnit.permGrowth.ad + adIncrease) * 100) / 100;
                        }
                        if (asIncrease > 0) {
                            originalUnit.permGrowth.as = Math.round((originalUnit.permGrowth.as + asIncrease) * 1000) / 1000;
                        }
                        if (apIncrease > 0) {
                            originalUnit.permGrowth.ap = Math.round((originalUnit.permGrowth.ap + apIncrease) * 100) / 100;
                        }
                        if (hpIncrease > 0) {
                            originalUnit.permGrowth.hp = Math.round((originalUnit.permGrowth.hp + hpIncrease) * 100) / 100;
                        }
                        
                        console.log(`📊 [영구성장] ${originalUnit.name}: permGrowth AD +${originalUnit.permGrowth.ad.toFixed(1)}, AS +${originalUnit.permGrowth.as.toFixed(3)}, AP +${originalUnit.permGrowth.ap.toFixed(1)}, HP +${originalUnit.permGrowth.hp.toFixed(1)}`);
                    }
                }
            });
            
            // UI/보드 복구
            window.isBattlePhase = false; // 전투 상태 플래그 해제
            window.gameApp.spawnEnemyBoard(); // 다음 라운드 적 사전 배치
            window.gameApp.updateHeader();
            
            window.gameApp.renderUnits(); // 적 보드 및 아군 보드 재렌더링
            
            // 보드의 유닛들 다시 드래그 가능하게
            document.querySelectorAll('.board-cell .unit-character').forEach(u => u.draggable = true);

            // 상점 무료 리롤 및 잠금 해제 처리
            if (st.shopLocked) {
                window.gameApp.renderShop(); // 잠겼을 때는 내용 유지
                st.shopLocked = false;       // 라운드 지나면 잠금 해제
                const lockBtn = document.getElementById('btn-lock-shop');
                if (lockBtn) {
                    lockBtn.innerText = "🔓 상점 열림";
                    lockBtn.style.background = "#607d8b";
                }
            } else {
                window.gameApp.refreshShop(true); // 잠기지 않았을 때는 항상 새 상점으로 무료 리롤!
            }
            
            // 새 스테이지 시작 시 증강체 자동 팝업 (2-1, 3-1, 4-1)
            if (st.stage[1] === 1 && [2, 3, 4].includes(st.stage[0])) {
                const tierNeeded = st.stage[0] === 2 ? 'silver' : (st.stage[0] === 3 ? 'gold' : 'prismatic');
                // 만약 아직 선택하지 않았다면 팝업
                if (!st.augments.some(a => a.tier === tierNeeded)) {
                    window.gameApp.showAugmentSelection(tierNeeded);
                }
            }
            
            // 매점 타임 팝업 (x-3 라운드 시작 시)
            if (st.stage[1] === 3) {
                window.gameApp.showStoreTimeSelection();
            }
        });
    };
});
