import { StageManager } from './systems/StageManager.js';
import { TooltipManager } from './ui/TooltipManager.js';
import { HudRenderer } from './ui/HudRenderer.js';
import { ModalManager } from './ui/ModalManager.js';
import { BoardRenderer } from './ui/BoardRenderer.js';
import { GuideRenderer } from './ui/GuideRenderer.js';
import { skillPreviewer } from './ui/SkillPreviewer.js';

import { UNIT_POOL, SYNERGIES, EXP_TABLE, AUGMENTS } from './data.js';
import { ITEMS } from './items.js';
import { generateEnemyBoard } from './enemyAi.js';
import { BattleEngine } from './battleEngine.js';
import { BattleRenderer } from './battleRenderer.js';
import { eventBus } from './core/EventBus.js';
import { STAT_NAMES_KO, SHOP_PROBABILITIES, formatStat } from './core/constants.js';
import { createInitialState } from './core/GameState.js';
import { ShopManager } from './systems/ShopManager.js';
import { SynergyManager } from './systems/SynergyManager.js';
import { ItemManager } from './systems/ItemManager.js';
import { AugmentManager } from './systems/AugmentManager.js';
import { UnitManager } from './systems/UnitManager.js';

class GameApp {
    constructor() {
        this.state = createInitialState();
        this.EXP_TABLE = EXP_TABLE; // ShopManager needs this
        this.ITEMS = ITEMS;         // SynergyManager needs this
        this.AUGMENTS = AUGMENTS;   // AugmentManager needs this
        this.UNIT_POOL = UNIT_POOL; // AugmentManager needs this
        this.SYNERGIES = SYNERGIES; // UnitManager needs this
        
        this.shopManager = new ShopManager(this);
        this.synergyManager = new SynergyManager(this);
        this.itemManager = new ItemManager(this);
        this.augmentManager = new AugmentManager(this);
        this.unitManager = new UnitManager(this);
        this.stageManager = new StageManager(this);
        this.tooltipManager = new TooltipManager();
        this.hudRenderer = new HudRenderer(this);
        this.modalManager = new ModalManager(this);
        this.boardRenderer = new BoardRenderer(this);
        this.guideRenderer = new GuideRenderer(this);
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

    spawnEnemyBoard() { return this.stageManager.spawnEnemyBoard(); }

    updateHeader() { return this.hudRenderer.updateHeader(); }

    renderBoard() { return this.boardRenderer.renderBoard(); }
    setupDropZone(cell, targetType) { return this.boardRenderer.setupDropZone(cell, targetType); }

    getIconForItem(itemId) { return this.itemManager.getIconForItem(itemId); }
    formatItemStats(stats) { return this.itemManager.formatItemStats(stats); }
    renderInventory() { return this.itemManager.renderInventory(); }
    giveRandomBaseItem() { return this.itemManager.giveRandomBaseItem(); }
    giveRandomCombinedItem() { return this.itemManager.giveRandomCombinedItem(); }
    addItemToInventory(itemId) { return this.itemManager.addItemToInventory(itemId); }

    showStoreTimeSelection() { return this.augmentManager.showStoreTimeSelection(); }

    combineOrMoveItem(sourceIdx, targetIdx) { return this.itemManager.combineOrMoveItem(sourceIdx, targetIdx); }
    giveItemToUnit(itemIdx, unit) { return this.itemManager.giveItemToUnit(itemIdx, unit); }

    showCustomTooltip(e, html, isInteractive = false) { return this.tooltipManager.showCustomTooltip(e, html, isInteractive); }
    hideCustomTooltip() { return this.tooltipManager.hideCustomTooltip(); }
    showResultModal(title, msg, type, onConfirm) { return this.modalManager.showResultModal(title, msg, type, onConfirm); }

    bindEvents() {
        document.addEventListener('click', () => {
            if (window.isContextMenuOpen) {
                window.isContextMenuOpen = false;
                this.hideCustomTooltip();
            }
        });
    }

    renderUnits() { return this.unitManager.renderUnits(); }
    createUnitElement(unit, type, idx) { return this.unitManager.createUnitElement(unit, type, idx); }
    sellUnit(sourceType, sourceIdx, unit) { return this.unitManager.sellUnit(sourceType, sourceIdx, unit); }
    moveUnit(sourceType, sourceIdx, targetType, targetIdx) { return this.unitManager.moveUnit(sourceType, sourceIdx, targetType, targetIdx); }
    checkForUpgrade(unitId) { return this.unitManager.checkForUpgrade(unitId); }

    getSynergyData(boardArray) { return this.synergyManager.getSynergyData(boardArray); }
    calculateSynergy() { return this.synergyManager.calculateSynergy(); }
    getActiveSynergyLevel(count, levelsArr, exactMatch = false) { return this.synergyManager.getActiveSynergyLevel(count, levelsArr, exactMatch); }

    showAugmentSelection(tierNeeded) { return this.augmentManager.showAugmentSelection(tierNeeded); }

    applyAugment(aug, tier) { return this.augmentManager.applyAugment(aug, tier); }

    addToBench(unit) { return this.unitManager.addToBench(unit); }

    renderActiveAugments() { return this.augmentManager.renderActiveAugments(); }

    applySynergyStats(originalBoard, activeSynergies, isEnemy = false) { return this.synergyManager.applySynergyStats(originalBoard, activeSynergies, isEnemy); }

    getSynergyTierAndSteps(count, synData) { return this.synergyManager.getSynergyTierAndSteps(count, synData); }
    getSynergyStyleByRank(rank) { return this.synergyManager.getSynergyStyleByRank(rank); }
    getSynergyIcon(name) { return this.synergyManager.getSynergyIcon(name); }
    renderSynergyUI(counts) { return this.synergyManager.renderSynergyUI(counts); }

    formatSkillDesc(skill, unit) { return this.unitManager.formatSkillDesc(skill, unit); }
    showUnitInfo(baseUnit, uDiv) { return this.unitManager.showUnitInfo(baseUnit, uDiv); }

    getMaxExp(level) { return this.shopManager.getMaxExp(level); }
    addExp(amount) { return this.shopManager.addExp(amount); }
    buyExp() { return this.shopManager.buyExp(); }
    refreshShop(isFree = false) { return this.shopManager.refreshShop(isFree); }
    renderShop() { return this.shopManager.renderShop(); }
}

window.addEventListener('DOMContentLoaded', () => {
    window.isBattlePhase = false; // 강제로 전투 모드 해제 (오류로 인해 멈춤 방지)
    console.log("게임 초기화: isBattlePhase = false");
    window.gameApp = new GameApp();

    // DPS Meter UI Events
    const dpsPanel = document.getElementById('dps-panel');
    const dpsContent = document.getElementById('dps-panel-content');
    const dpsToggleBtn = document.getElementById('btn-toggle-dps');
    const dpsTypeSelect = document.getElementById('dps-type-select');

    if (dpsToggleBtn && dpsPanel) {
        // Init state
        let isDpsOpen = false;
        
        dpsToggleBtn.addEventListener('click', () => {
            isDpsOpen = !isDpsOpen;
            if (isDpsOpen) {
                dpsPanel.style.transform = 'translateX(0)';
                dpsPanel.style.visibility = 'visible';
                dpsToggleBtn.style.transform = 'translateX(-330px)';
                dpsToggleBtn.style.background = '#2563eb'; // darker blue when active
            } else {
                dpsPanel.style.transform = 'translateX(100%)';
                dpsPanel.style.visibility = 'hidden';
                dpsToggleBtn.style.transform = 'translateX(0)';
                dpsToggleBtn.style.background = '#3b82f6';
            }
        });
    }

    if (dpsTypeSelect) {
        dpsTypeSelect.addEventListener('change', () => {
            if (window.gameApp && window.gameApp.renderer && typeof window.gameApp.renderer.renderDpsUI === 'function') {
                window.gameApp.renderer.renderDpsUI();
            }
        });
    }

    // 유닛 도감 모달 기능 연동
    const dictModal = document.getElementById('dict-modal');
    const detailModal = document.getElementById('unit-detail-modal');
    const btnCloseDetail = document.getElementById('btn-close-detail');
    const filterSelect = document.getElementById('filter-synergy');
    const infoDiv = document.getElementById('dict-synergy-info');

    if (btnCloseDetail && detailModal) {
        btnCloseDetail.onclick = () => {
            detailModal.classList.remove('active');
            detailModal.style.display = 'none';
            skillPreviewer.stop();
        };
        detailModal.onclick = (e) => {
            if (e.target === detailModal) {
                detailModal.classList.remove('active');
                detailModal.style.display = 'none';
                skillPreviewer.stop();
            }
        };
    }

    function showUnitDetailModal(unit) {
        if (!detailModal) return;

        document.getElementById('detail-unit-icon').innerText = unit.icon;
        document.getElementById('detail-unit-name').innerText = unit.name;
        document.getElementById('detail-unit-tier').innerText = `★${unit.tier} (${unit.tier}G)`;
        
        const tierBadge = document.getElementById('detail-unit-tier');
        const tierColors = {
            1: '#90a4ae',
            2: '#81c784',
            3: '#64b5f6',
            4: '#ba68c8',
            5: '#ffb74d'
        };
        tierBadge.style.background = tierColors[unit.tier] || '#3b82f6';
        
        document.getElementById('detail-unit-synergy').innerText = `${unit.subject} / ${unit.club}`;
        document.getElementById('detail-skill-name').innerText = unit.skill ? unit.skill.name : '없음';
        
        const desc = unit.skill ? window.gameApp.formatSkillDesc(unit.skill, unit) : '스킬 정보가 없습니다.';
        document.getElementById('detail-skill-desc').innerHTML = desc;

        document.getElementById('detail-stat-hp').innerText = `${unit.stats.hp}`;
        
        const manaTypeKo = unit.manaType === '근성' ? '근성' : unit.manaType === '전투' ? '전투' : '집중';
        document.getElementById('detail-stat-mana').innerText = `${unit.stats.mana}/${unit.stats.maxMana} (${manaTypeKo})`;
        document.getElementById('detail-stat-ad').innerText = `${unit.stats.ad} (주문력: ${unit.stats.ap}%)`;
        document.getElementById('detail-stat-range-as').innerText = `${unit.stats.range}칸 / ${unit.stats.as.toFixed(2)}`;

        detailModal.style.display = 'flex';
        setTimeout(() => {
            detailModal.classList.add('active');
        }, 10);

        const canvas = document.getElementById('preview-canvas');
        if (canvas) {
            skillPreviewer.start(canvas, unit);
        }
    }

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
        if (val !== 'all') {
            const syn = SYNERGIES.subjects[val] || SYNERGIES.clubs[val];
            infoDiv.style.display = 'block';
            let html = `<strong style="font-size:1.1rem; color:#d81b60;">${syn.name} (${syn.desc})</strong><div style="margin-top:8px;">`;
            for (const [lvl, effects] of Object.entries(syn.levels)) {
                html += `<span style="font-weight:bold;">[${lvl}]</span> `;
                if (effects.desc) {
                    html += `${effects.desc}&nbsp;&nbsp;|&nbsp;&nbsp;`;
                } else {
                    let effStrs = [];
                    for (const [k, v] of Object.entries(effects)) effStrs.push(formatStat(k, v));
                    html += effStrs.join(', ') + '&nbsp;&nbsp;|&nbsp;&nbsp;';
                }
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
        if (filter !== 'all') {
            pool = pool.filter(u => u.subject === filter || u.club === filter);
        }
        if (currentDictCostFilter > 0) {
            pool = pool.filter(u => u.tier === currentDictCostFilter);
        }

        const sortedPool = pool.sort((a, b) => a.tier - b.tier);
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
                    <div>🗡️ 치명 확률: <span style="color:#ffb300">${Math.round((u.combat?.critChance || 0.10) * 100)}%</span></div>
                    <div>💥 치명 배율: <span style="color:#ffb300">${Math.round((u.combat?.critDmg || 1.5) * 100)}%</span></div>
                    <div>📈 피해 증폭: <span style="color:#ef5350">+${Math.round((u.combat?.dmgAmp || 0) * 100)}%</span></div>
                    <div>📉 피해 감소: <span style="color:#29b6f6">${Math.round((u.combat?.dmgReduc || 0) * 100)}%</span></div>
                    <div>🩸 흡혈률: <span style="color:#ec407a">${Math.round((u.combat?.vamp || 0) * 100)}%</span></div>
                    <div>🌱 마나 재생: <span style="color:#42a5f5">+0</span></div>
                </div>
                ${skillHtml}
            `;
            card.style.cursor = 'pointer';
            card.onclick = () => showUnitDetailModal(u);
            body.appendChild(card);
            const manaTag = card.querySelector('.mana-type-tag');
            if (manaTag) {
                manaTag.onmouseover = (e) => {
                    const type = manaTag.dataset.type;
                    let text = '';
                    if (type === '근성') text = '🛡️ <b>근성 마나</b><br>평타 공격 시 마나를 회복하지 못합니다.<br>대신 적에게 공격(도트딜 포함)을 받을 때마다 <b>고정 10</b>의 마나를 회복합니다.';
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
    document.getElementById('btn-start-battle').onclick = () => window.gameApp.stageManager.handleBattleStart();


});
