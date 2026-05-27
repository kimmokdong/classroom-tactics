import { UNIT_POOL, SYNERGIES, AUGMENTS } from './data.js';
import { ITEMS } from './items.js';
import { BattleEngine } from './battleEngine.js';
import { BattleRenderer } from './battleRenderer.js';

let currentTool = null; // { type: 'unit'|'item'|'eraser', id: string|null }
let isBattling = false;
let battleRenderer = null;
let battleEngine = null;
let selectedAugments = new Set();

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

function getIconForItem(itemId) {
    return ICONS[itemId] || '🎁';
}

function formatItemStats(stats) {
    if (!stats) return '';
    const parts = [];
    if (stats.ad) parts.push(`공격력 <span style="color:#e65100; font-weight:bold;">+${stats.ad}</span>`);
    if (stats.as) parts.push(`공속 <span style="color:#e53935; font-weight:bold;">+${Math.round(stats.as*100)}%</span>`);
    if (stats.ap) parts.push(`주문력 <span style="color:#8e24aa; font-weight:bold;">+${stats.ap}</span>`);
    if (stats.mana) parts.push(`마나 <span style="color:#1e88e5; font-weight:bold;">+${stats.mana}</span>`);
    if (stats.armor) parts.push(`방어력 <span style="color:#795548; font-weight:bold;">+${stats.armor}</span>`);
    if (stats.mr) parts.push(`마저 <span style="color:#00897b; font-weight:bold;">+${stats.mr}</span>`);
    if (stats.maxHp || stats.hp) parts.push(`체력 <span style="color:#4caf50; font-weight:bold;">+${stats.maxHp || stats.hp}</span>`);
    if (stats.critChance) parts.push(`치명타 <span style="color:#ffb300; font-weight:bold;">+${Math.round(stats.critChance*100)}%</span>`);
    if (stats.vamp) parts.push(`피해흡혈 <span style="color:#ec407a; font-weight:bold;">+${Math.round(stats.vamp*100)}%</span>`);
    return parts.join(' | ');
}

function showCustomTooltip(e, html) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    
    let x = e.pageX + 15;
    let y = e.pageY + 15;
    
    // Bounds check
    if (x + tooltip.offsetWidth > window.innerWidth) x = e.pageX - tooltip.offsetWidth - 15;
    if (y + tooltip.offsetHeight > window.innerHeight) y = e.pageY - tooltip.offsetHeight - 15;
    
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

function hideCustomTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) tooltip.style.display = 'none';
}

document.addEventListener('mousemove', (e) => {
    const tooltip = document.getElementById('tooltip');
    if (tooltip && tooltip.style.display === 'block') {
        let x = e.pageX + 15;
        let y = e.pageY + 15;
        if (x + tooltip.offsetWidth > window.innerWidth) x = e.pageX - tooltip.offsetWidth - 15;
        if (y + tooltip.offsetHeight > window.innerHeight) y = e.pageY - tooltip.offsetHeight - 15;
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }
});

// 24 cells for each team
let playerBoard = Array(24).fill(null);
let enemyBoard = Array(24).fill(null);

const boardEl = document.createElement('div');
boardEl.id = 'battle-board';
const fxCanvas = document.createElement('canvas');
fxCanvas.id = 'fx-canvas';

function init() {
    setupBoard();
    populateLists();

    document.getElementById('btn-erase').addEventListener('click', () => setTool('eraser', null));
    document.getElementById('btn-reset').addEventListener('click', resetBoard);
    document.getElementById('btn-start').addEventListener('click', startBattle);
    document.getElementById('btn-dummy-mode').addEventListener('click', spawnDummies);

    // 모달 이벤트
    document.getElementById('btn-add-augment').addEventListener('click', () => {
        document.getElementById('sandbox-augment-modal').style.display = 'flex';
    });
    document.getElementById('btn-close-augment-modal').addEventListener('click', () => {
        document.getElementById('sandbox-augment-modal').style.display = 'none';
    });

    // ESC 키로 현재 툴 취소
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setTool(null, null);
    });
    
    // 바탕화면 우클릭 시 현재 툴 취소 (cell의 우클릭은 지우개로 개별 동작하도록 cell 리스너에서 stopPropagation 처리)
    document.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.cell')) {
            e.preventDefault();
            setTool(null, null);
        }
    });

    // 전역 드래그 드롭 (보드 밖으로 드래그 시 유닛 삭제)
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data && data.type === 'move') {
                const sIsEnemy = data.sourceIdx < 24;
                const sBoard = sIsEnemy ? enemyBoard : playerBoard;
                const sLocal = sIsEnemy ? data.sourceIdx : data.sourceIdx - 24;
                sBoard[sLocal] = null; // 보드 밖 드롭은 유닛 자체를 무조건 삭제
                renderBoard();
            }
        } catch(err) {}
    });
}

function setupBoard() {
    const container = document.getElementById('battle-container');
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.width = '700px';
    container.style.height = '525px';

    boardEl.className = 'grid';
    boardEl.style.display = 'grid';
    boardEl.style.gridTemplateColumns = 'repeat(8, 1fr)';
    boardEl.style.gridTemplateRows = 'repeat(6, 1fr)';
    boardEl.style.width = '100%';
    boardEl.style.height = '100%';
    boardEl.style.gap = '5px';
    
    fxCanvas.style.position = 'absolute';
    fxCanvas.style.top = '0';
    fxCanvas.style.left = '0';
    fxCanvas.style.width = '100%';
    fxCanvas.style.height = '100%';
    fxCanvas.style.pointerEvents = 'none';
    fxCanvas.style.zIndex = '50';

    for(let i=0; i<48; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = i;
        
        // Visual distinction for player vs enemy territory
        if (i < 24) {
            cell.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
            cell.style.border = '1px dashed rgba(231, 76, 60, 0.3)';
        } else {
            cell.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
            cell.style.border = '1px dashed rgba(52, 152, 219, 0.3)';
        }
        
        cell.addEventListener('mousedown', (e) => handleCellClick(i, e));
        cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            eraseCell(i);
        });
        
        // Drag and drop
        cell.addEventListener('dragover', (e) => e.preventDefault());
        cell.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation(); // 보드 밖 드롭과 구분하기 위해 전파 방지
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (data && data.type === 'move') {
                    moveUnit(data.sourceIdx, i);
                } else if (data && data.type && data.id) {
                    currentTool = { type: data.type, id: data.id };
                    handleCellClick(i, { button: 0, isDrop: true }); 
                    setTool(null, null); // 드롭 직후 툴 해제
                }
            } catch(err) {}
        });
        boardEl.appendChild(cell);
    }
    
    container.appendChild(boardEl);
    container.appendChild(fxCanvas);
    renderBoard();
}

function populateLists() {
    const unitList = document.getElementById('sandbox-unit-list');
    UNIT_POOL.forEach(u => {
        const btn = document.createElement('div');
        btn.className = 'selectable-btn';
        btn.dataset.type = 'unit';
        btn.dataset.id = u.id;
        btn.draggable = true;
        btn.innerHTML = `${u.icon}<span class="name">${u.name}</span>`;
        btn.onclick = () => setTool('unit', u.id);
        btn.ondragstart = (e) => {
            setTool('unit', u.id);
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'unit', id: u.id }));
        };
        unitList.appendChild(btn);
    });

    const itemList = document.getElementById('sandbox-item-list');
    ITEMS.forEach(i => {
        if(i.type !== 'combined') return; // Only show combined items for testing
        const btn = document.createElement('div');
        btn.className = 'selectable-btn';
        btn.dataset.type = 'item';
        btn.dataset.id = i.id;
        btn.draggable = true;
        
        const iconStr = getIconForItem(i.id);
        btn.innerHTML = `${iconStr}<span class="name">${i.name}</span>`;
        btn.onclick = () => setTool('item', i.id);
        btn.ondragstart = (e) => {
            setTool('item', i.id);
            hideCustomTooltip();
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'item', id: i.id }));
        };
        
        btn.onmouseover = (e) => {
            showCustomTooltip(e, `
                <div style="font-weight:bold; color:#d97706; font-size:1rem; margin-bottom:4px;">
                    ${iconStr} ${i.name}
                    <span style="font-size:0.75rem; color:#666; font-weight:normal; margin-left:4px;">${formatItemStats(i.stats)}</span>
                </div>
                <div style="color:#475569;">${i.desc}</div>
            `);
        };
        btn.onmouseout = () => hideCustomTooltip();
        
        itemList.appendChild(btn);
    });
    
    populateAugments();
    renderSelectedAugments();
}

function populateAugments() {
    const container = document.getElementById('sandbox-augment-pool');
    if (!container) return;
    container.innerHTML = '';
    
    const allAugments = [...AUGMENTS.silver, ...AUGMENTS.gold, ...AUGMENTS.prismatic];
    
    allAugments.forEach(aug => {
        const card = document.createElement('div');
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.padding = '12px';
        card.style.border = '1px solid #e0e0e0';
        card.style.borderRadius = '8px';
        card.style.cursor = 'pointer';
        card.style.transition = 'all 0.2s';
        
        let color = '#7f8c8d';
        let tierLabel = '실버';
        if (AUGMENTS.silver.find(a => a.id === aug.id)) { color = '#bdc3c7'; tierLabel = '실버'; }
        if (AUGMENTS.gold.find(a => a.id === aug.id)) { color = '#f1c40f'; tierLabel = '골드'; }
        if (AUGMENTS.prismatic.find(a => a.id === aug.id)) { color = '#9b59b6'; tierLabel = '프리즘'; }
        
        card.innerHTML = `
            <div style="font-weight: bold; color: ${color}; font-size: 1.1rem; display: flex; justify-content: space-between;">
                <span>${aug.name}</span>
                <span style="font-size: 0.8rem; background: #eee; padding: 2px 6px; border-radius: 4px; color: #555;">${tierLabel}</span>
            </div>
            <div style="font-size: 0.9rem; color: #555; margin-top: 4px;">${aug.desc}</div>
        `;
        
        card.onmouseover = () => card.style.borderColor = '#3498db';
        card.onmouseout = () => card.style.borderColor = '#e0e0e0';
        card.onclick = () => {
            selectedAugments.add(aug.id);
            document.getElementById('sandbox-augment-modal').style.display = 'none';
            renderSelectedAugments();
        };
        
        container.appendChild(card);
    });
}

function renderSelectedAugments() {
    const list = document.getElementById('selected-augments-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (selectedAugments.size === 0) {
        list.innerHTML = '<div style="color: #999; font-size: 0.9rem; text-align: center; padding: 10px;">선택된 증강체가 없습니다.</div>';
        return;
    }
    
    const allAugments = [...AUGMENTS.silver, ...AUGMENTS.gold, ...AUGMENTS.prismatic];
    
    selectedAugments.forEach(id => {
        const aug = allAugments.find(a => a.id === id);
        if (!aug) return;
        
        let color = '#7f8c8d';
        if (AUGMENTS.silver.find(a => a.id === aug.id)) color = '#bdc3c7';
        if (AUGMENTS.gold.find(a => a.id === aug.id)) color = '#f1c40f';
        if (AUGMENTS.prismatic.find(a => a.id === aug.id)) color = '#9b59b6';
        
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.background = 'white';
        item.style.padding = '8px 10px';
        item.style.borderRadius = '8px';
        item.style.borderLeft = `4px solid ${color}`;
        item.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
        
        item.innerHTML = `
            <div>
                <strong style="color: #2c3e50; font-size: 0.95rem;">${aug.name}</strong>
                <div style="font-size: 0.75rem; color: #7f8c8d;">${aug.desc}</div>
            </div>
            <button class="btn-remove-aug" style="background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 1.2rem; font-weight: bold;">&times;</button>
        `;
        
        item.querySelector('.btn-remove-aug').onclick = () => {
            selectedAugments.delete(id);
            renderSelectedAugments();
        };
        
        list.appendChild(item);
    });
}

function spawnDummies() {
    if (isBattling) return;
    
    // Find 3 empty spots in enemy board (index 0~23)
    let emptySpots = [];
    for (let i = 0; i < 24; i++) {
        if (!enemyBoard[i]) emptySpots.push(i);
    }
    
    // Shuffle and pick up to 3
    emptySpots.sort(() => Math.random() - 0.5);
    const spotsToFill = emptySpots.slice(0, 3);
    
    spotsToFill.forEach(idx => {
        enemyBoard[idx] = {
            id: 'dummy',
            name: '허수아비',
            icon: '🎯',
            tier: 1,
            star: 1,
            subject: '없음',
            club: '없음',
            stats: { hp: 999999, maxHp: 999999, maxMana: 0, mana: 0, ad: 0, ap: 0, armor: 0, mr: 0, as: 1.0, range: 1 },
            items: [],
            combat: { isDummy: true }
        };
    });
    
    renderBoard();
}

function setTool(type, id) {
    if (currentTool && currentTool.type === type && currentTool.id === id) {
        currentTool = null;
        document.getElementById('current-tool').innerText = `모드: [ 선택 안됨 ]`;
        document.querySelectorAll('.selectable-btn').forEach(b => b.classList.remove('selected'));
        return;
    }

    currentTool = { type, id };
    const label = type === 'eraser' ? '지우개' : (type === 'unit' ? '유닛 배치' : '아이템 부여');
    document.getElementById('current-tool').innerText = `모드: [ ${label} ]`;

    document.querySelectorAll('.selectable-btn').forEach(btn => {
        const matchesType = btn.dataset.type === type;
        const matchesId = (btn.dataset.id === id) || (id === null && !btn.dataset.id);
        if (matchesType && matchesId) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

function handleCellClick(index, e) {
    if (isBattling) return;
    if (e.button === 2) return; // Right click is handled by contextmenu
    
    const isEnemySide = index < 24;
    const board = isEnemySide ? enemyBoard : playerBoard;
    const localIdx = isEnemySide ? index : index - 24;

    if (!currentTool) {
        // 선택된 툴이 없을 때는 유닛 정보 표시
        const u = board[localIdx];
        if (u) {
            const cells = document.getElementById('battle-board').children;
            const el = cells[index].querySelector('.unit-character');
            showUnitInfo(u, isEnemySide, el);
        }
        return;
    }

    if (currentTool.type === 'eraser') {
        eraseCell(index);
        return;
    }

    if (currentTool.type === 'unit') {
        const base = UNIT_POOL.find(u => u.id === currentTool.id);
        if (base) {
            board[localIdx] = JSON.parse(JSON.stringify(base));
            board[localIdx].items = [];
            board[localIdx].star = 1;
        }
        // 연속 배치를 막으려면 여기서 setTool(null, null) 호출 (단 드래그 중이 아니면)
        if (!e.isDrop) setTool(null, null);
    } else if (currentTool.type === 'item') {
        const u = board[localIdx];
        if (u && u.items.length < 3) {
            u.items.push(currentTool.id);
        }
    }
    renderBoard();
}

function eraseCell(index) {
    if (isBattling) return;
    const isEnemySide = index < 24;
    const board = isEnemySide ? enemyBoard : playerBoard;
    const localIdx = isEnemySide ? index : index - 24;
    
    // If unit has items, remove last item. Otherwise remove unit.
    const u = board[localIdx];
    if (u) {
        if (u.items && u.items.length > 0) {
            u.items.pop();
        } else {
            board[localIdx] = null;
        }
    }
    renderBoard();
}

function moveUnit(sourceIdx, targetIdx) {
    if (isBattling || sourceIdx === targetIdx) return;
    const sIsEnemy = sourceIdx < 24;
    const tIsEnemy = targetIdx < 24;
    const sBoard = sIsEnemy ? enemyBoard : playerBoard;
    const tBoard = tIsEnemy ? enemyBoard : playerBoard;
    const sLocal = sIsEnemy ? sourceIdx : sourceIdx - 24;
    const tLocal = tIsEnemy ? targetIdx : targetIdx - 24;
    
    // Swap
    const temp = sBoard[sLocal];
    sBoard[sLocal] = tBoard[tLocal];
    tBoard[tLocal] = temp;
    
    renderBoard();
}

function renderBoard() {
    const cells = boardEl.children;
    const fxCanvas = document.getElementById('fx-canvas');
    if (fxCanvas) {
        const ctx = fxCanvas.getContext('2d');
        ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    }
    for(let i=0; i<48; i++) {
        const isEnemySide = i < 24;
        const board = isEnemySide ? enemyBoard : playerBoard;
        const localIdx = isEnemySide ? i : i - 24;
        const u = board[localIdx];
        const cell = cells[i];
        
        cell.innerHTML = '';
        if (u) {
            const el = document.createElement('div');
            el.className = `unit-character tier-${u.tier} star-${u.star || 1}`;
            if (isEnemySide) el.classList.add('is-enemy');
            
            el.dataset.type = 'board';
            el.dataset.index = i;
            const hpBase = u.stats.maxHp || u.stats.hp;
            const manaBase = u.stats.maxMana || u.stats.mana || 0;
            el.dataset.currHp = u.currHp !== undefined ? u.currHp : hpBase;
            el.dataset.currMana = u.currMana !== undefined ? u.currMana : manaBase;

            const hpPct = u.currHp !== undefined ? (u.currHp / hpBase * 100) : 100;
            const shieldPct = u.currShield !== undefined ? (u.currShield / hpBase * 100) : 0;
            const maxMana = u.stats.maxMana || u.stats.mana || 1;
            const manaPct = u.currMana !== undefined ? (u.currMana / maxMana * 100) : (u.stats.mana / maxMana * 100) || 0;
            const starText = '⭐'.repeat(u.star || 1);

            el.innerHTML = `
                <div class="status-icons"></div>
                <div style="font-size: 0.6rem; margin-bottom: 2px;">${starText}</div>
                <span class="unit-icon">${u.icon || '🧑‍🎓'}</span>
                <span class="unit-name">${u.name}</span>
                <div class="bars-wrapper">
                    <div class="hp-container">
                        <div class="hp-fill" style="width: ${Math.min(100, hpPct)}%;"></div>
                        <div class="shield-fill" style="width: ${Math.min(100, shieldPct)}%;"></div>
                    </div>
                    <div class="mana-container"><div class="mana-fill" style="width: ${(u.stats.maxMana || u.stats.mana) > 0 ? manaPct : 0}%;"></div></div>
                </div>
            `;
            
            // Items
            if (u.items && u.items.length > 0) {
                const itemContainer = document.createElement('div');
                itemContainer.className = 'unit-item-overlay';
                itemContainer.style.position = 'absolute';
                itemContainer.style.top = '-8px';
                itemContainer.style.right = '-8px';
                itemContainer.style.display = 'flex';
                itemContainer.style.gap = '2px';
                u.items.forEach(itemId => {
                    const itemEl = document.createElement('div');
                    const itemDef = ITEMS.find(it => it.id === itemId);
                    const iconStr = getIconForItem(itemId);
                    itemEl.innerHTML = iconStr;
                    itemEl.style.width = '16px';
                    itemEl.style.height = '16px';
                    itemEl.style.fontSize = '0.7rem';
                    itemEl.style.background = '#fef08a';
                    itemEl.style.border = '1px solid #eab308';
                    itemEl.style.borderRadius = '3px';
                    itemEl.style.display = 'flex';
                    itemEl.style.alignItems = 'center';
                    itemEl.style.justifyContent = 'center';
                    itemContainer.appendChild(itemEl);
                });
                el.appendChild(itemContainer);
            }

            // 보드 간 이동을 위한 drag
            el.draggable = true;
            el.ondragstart = (e) => {
                if (isBattling) { e.preventDefault(); return; }
                e.dataTransfer.setData('application/json', JSON.stringify({ 
                    type: 'move', 
                    sourceIdx: i, 
                    isEnemy: isEnemySide 
                }));
            };

            cell.appendChild(el);
        }
    }
    
    calculateSynergy();
}

function showUnitInfo(u, isEnemySide, uDiv) {
    const infoEl = document.getElementById('unit-details');
    const starText = '⭐'.repeat(u.star || 1);
    
    // Calculate stats including items
    let stats = JSON.parse(JSON.stringify(u.stats));
    let combat = JSON.parse(JSON.stringify(u.combat || {}));
    let displayItems = u.items || [];
    
    // If battling, sync displayItems with active engine
    if (isBattling && battleEngine && uDiv) {
        const idx = parseInt(uDiv.dataset.index);
        const activeU = battleEngine.board[idx];
        if (activeU && activeU.items) {
            displayItems = activeU.items;
        }
    }

    displayItems.forEach(itemId => {
        const itemDef = ITEMS.find(it => it.id === itemId);
        if (itemDef && itemDef.stats) {
            if (itemDef.stats.hp) stats.hp += itemDef.stats.hp;
            if (itemDef.stats.maxHp) stats.maxHp = (stats.maxHp||stats.hp) + itemDef.stats.maxHp;
            if (itemDef.stats.ad) stats.ad += itemDef.stats.ad;
            if (itemDef.stats.ap) stats.ap += itemDef.stats.ap;
            if (itemDef.stats.armor) stats.armor += itemDef.stats.armor;
            if (itemDef.stats.mr) stats.mr += itemDef.stats.mr;
            if (itemDef.stats.mana) stats.mana = (stats.mana||0) + itemDef.stats.mana;
        }
        if (itemDef) {
            if (itemDef.effect === 'rfc') stats.range += 1;
            if (itemDef.effect === 'rabadon') stats.ap += 50;
            if (itemDef.effect === 'blueBuff') stats.maxMana = Math.max(10, (stats.maxMana || stats.mana || 0) - 10);
            if (itemDef.effect === 'deathblade') stats.ad += 50;
            if (itemDef.effect === 'warmog') stats.maxHp += 500;
            if (itemDef.effect === 'guardbreaker') combat.dmgAmp += 0.15;
            if (itemDef.effect === 'skillCrit') combat.critDmg += 0.10;
            if (itemDef.effect === 'hoj') {
                combat.dmgAmp += 0.15;
                combat.vamp += 0.15;
            }
        }
    });

    if (isBattling && battleEngine && uDiv) {
        const idx = parseInt(uDiv.dataset.index);
        const activeU = battleEngine.board[idx];
        if (activeU && activeU.buffs) {
            let armShreds = activeU.buffs.filter(b => b.type === 'armorShred');
            let maxArmShred = armShreds.length > 0 ? Math.max(...armShreds.map(b => b.val)) : 0;
            stats.armor *= (1 - maxArmShred);

            let mrShreds = activeU.buffs.filter(b => b.type === 'mrShred');
            let maxMrShred = mrShreds.length > 0 ? Math.max(...mrShreds.map(b => b.val)) : 0;
            stats.mr *= (1 - maxMrShred);
        }
    }

    let currHp = u.currHp !== undefined ? u.currHp : (stats.maxHp || stats.hp);
    let currMana = u.currMana !== undefined ? u.currMana : (stats.mana || 0);

    if (uDiv) {
        if (uDiv.dataset.currHp !== undefined) currHp = parseFloat(uDiv.dataset.currHp);
        if (uDiv.dataset.currMana !== undefined) currMana = parseFloat(uDiv.dataset.currMana);
    }
    
    currHp = Math.round(currHp);
    currMana = Math.round(currMana);

    // Fallback if NaN
    if (isNaN(currHp)) currHp = 0;
    if (isNaN(currMana)) currMana = 0;
    if (isNaN(stats.ad)) stats.ad = 0;
    if (isNaN(stats.ap)) stats.ap = 0;
    if (isNaN(stats.armor)) stats.armor = 0;
    if (isNaN(stats.mr)) stats.mr = 0;
    if (isNaN(stats.as)) stats.as = 1.0;

    let itemsHtml = '';
    for (let i = 0; i < 3; i++) {
        if (i < displayItems.length) {
            const itemId = displayItems[i];
            const itemDef = ITEMS.find(it => it.id === itemId);
            const iconStr = getIconForItem(itemId);
            itemsHtml += `<div class="unit-item-slot" data-id="${itemId}" style="width: 28px; height: 28px; border-radius: 6px; background: #fef08a; border: 1px solid #eab308; display:flex; justify-content:center; align-items:center; font-size: 0.9rem; cursor:help;">${iconStr}</div>`;
        } else {
            itemsHtml += `<div class="unit-item-slot" style="width: 28px; height: 28px; border-radius: 6px; background: rgba(0,0,0,0.05); border: 1px dashed #cbd5e1;"></div>`;
        }
    }

    let skillHtml = '';
    if (u.skill) {
        skillHtml = `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc;">
            <div style="font-size: 0.95rem; font-weight: bold; color: #d81b60; margin-bottom: 5px;">
                ✨ [스킬] ${u.skill.name}
            </div>
            <div style="font-size: 0.8rem; color: #555; line-height: 1.4; word-break: keep-all;">
                ${u.skill.desc}
            </div>
        </div>`;
    }

    infoEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <div style="font-size: 1.1rem;"><strong>${starText} ${u.name}</strong> <span style="color:#d4af37;">(${u.tier}G)</span></div>
            <div style="display: flex; gap: 4px;">${itemsHtml}</div>
        </div>
        <div style="color: #666; font-size: 0.85rem; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed #ccc;">
            📚 <strong>${u.subject}</strong> &nbsp;|&nbsp; 🏷️ <strong>${u.club}</strong>
            <span style="float:right; border-radius: 4px; padding: 2px 6px; background: #eee; font-weight:bold; font-size: 0.75rem;">${u.manaType || '집중'} 마나</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; font-weight: 600; color: #374151;">
            <div>❤️ 체력: <span id="info-hp" style="color:#4caf50">${currHp}</span><span style="color:#4caf50; font-size:0.75rem;">/<span id="info-max-hp">${stats.maxHp || stats.hp}</span></span></div>
            <div>💧 마나: <span id="info-mana" style="color:#1e88e5">${currMana}</span><span style="color:#1e88e5; font-size:0.75rem;">/<span id="info-max-mana">${stats.maxMana || stats.mana || 0}</span></span></div>
            <div>⚔️ 공격력: <span id="info-ad" style="color:#e65100">${Math.round(stats.ad)}</span></div>
            <div>🔮 주문력: <span id="info-ap" style="color:#8e24aa">${Math.round(stats.ap)}%</span></div>
            <div>🛡️ 방어: <span id="info-armor" style="color:#795548">${Math.round(stats.armor)}</span></div>
            <div>🌀 마저: <span id="info-mr" style="color:#00897b">${Math.round(stats.mr)}</span></div>
            <div>⚡ 공속: <span id="info-as" style="color:#e53935">${(stats.as || 0).toFixed(2)}</span></div>
            <div>🎯 사거리: <span style="color:#546e7a">${stats.range || 1}</span></div>
            <div style="grid-column: span 2; border-top: 1px dotted #ccc; margin-top: 2px; padding-top: 4px;"></div>
            <div>🗡️ 치명 확률: <span id="info-critChance" style="color:#ffb300">${Math.round((combat.critChance || 0.10)*100)}%</span></div>
            <div>💥 치명 배율: <span id="info-critDmg" style="color:#ffb300">${Math.round((combat.critDmg || 1.5)*100)}%</span></div>
            <div>📈 피해 증폭: <span id="info-dmgAmp" style="color:#ef5350">+${Math.round((combat.dmgAmp || 0)*100)}%</span></div>
            <div>📉 피해 감소: <span id="info-dmgReduc" style="color:#29b6f6">${Math.round((combat.dmgReduc || 0)*100)}%</span></div>
            <div>🩸 흡혈률: <span id="info-vamp" style="color:#ec407a">${Math.round((combat.vamp || 0)*100)}%</span></div>
            <div>🌱 추가 재생: <span id="info-manaRegen" style="color:#42a5f5">+${((combat.teamManaRegen || 0) + (u.subject === '미술' ? (combat.artManaRegen || 0) : 0))}</span></div>
        </div>
        ${skillHtml}
    `;

    infoEl.querySelectorAll('.unit-item-slot[data-id]').forEach(slot => {
        slot.onmouseover = (e) => {
            const itemId = slot.dataset.id;
            const itemDef = ITEMS.find(it => it.id === itemId);
            if (!itemDef) return;
            const iconStr = getIconForItem(itemId);
            showCustomTooltip(e, `
                <div style="font-weight:bold; color:#d97706; font-size:1rem; margin-bottom:4px;">
                    ${iconStr} ${itemDef.name}
                    <span style="font-size:0.75rem; color:#666; font-weight:normal; margin-left:4px;">${formatItemStats(itemDef.stats)}</span>
                </div>
                <div style="color:#475569;">${itemDef.desc}</div>
            `);
        };
        slot.onmouseout = () => hideCustomTooltip();
    });

    document.querySelectorAll('.unit-character').forEach(u => u.dataset.viewing = "false");
    if (uDiv) uDiv.dataset.viewing = "true";
}

function resetBoard() {
    if (isBattling && battleRenderer) {
        battleRenderer.stop();
        isBattling = false;
        document.getElementById('btn-start').disabled = false;
    }
    playerBoard = Array(24).fill(null);
    enemyBoard = Array(24).fill(null);
    renderBoard();
}

function applyItemsToStats(board) {
    const cloned = JSON.parse(JSON.stringify(board));
    
    // Get all combined items for thievesGloves
    const combinedItems = ITEMS.filter(it => it.type === 'combined' && it.effect !== 'thievesGloves');

    for (let i = 0; i < 24; i++) {
        let u = cloned[i];
        if (u) {
            u.currHp = u.stats.hp;
            u.currMana = u.mana || 0;
            u.currShield = 0;
            u.stats.maxHp = u.stats.hp;
            u.stats.maxMana = u.stats.maxMana || u.mana || 0;
            u.combat = { shield: 0, vamp: 0, dmgAmp: 0, critChance: 0.10, critDmg: 1.5, dmgReduc: 0, itemEffects: {} };
            
            if (u.items) {
                // Check thievesGloves first
                if (u.items.includes('comb_crit_crit')) {
                    // It's thievesGloves! Randomly pick 2 combined items
                    const random1 = combinedItems[Math.floor(Math.random() * combinedItems.length)].id;
                    const random2 = combinedItems[Math.floor(Math.random() * combinedItems.length)].id;
                    u.items = ['comb_crit_crit', random1, random2];
                }

                u.items.forEach(itemId => {
                    const itemDef = ITEMS.find(it => it.id === itemId);
                    if (itemDef) {
                        if (itemDef.effect) {
                            u.combat.itemEffects[itemDef.effect] = (u.combat.itemEffects[itemDef.effect] || 0) + 1;
                            // Only apply these static bonuses once per item instance
                            if (itemDef.effect === 'rfc') u.stats.range += 1;
                            if (itemDef.effect === 'rabadon') u.stats.ap *= 1.20;
                            if (itemDef.effect === 'blueBuff') u.stats.maxMana = Math.max(10, u.stats.maxMana - 10);
                            if (itemDef.effect === 'deathblade') u.stats.ad += 20;
                            if (itemDef.effect === 'guardbreaker') u.combat.dmgAmp += 0.15;
                            if (itemDef.effect === 'skillCrit') u.combat.critDmg += 0.10;
                            if (itemDef.effect === 'hoj') {
                                u.combat.dmgAmp += 0.15;
                                u.combat.vamp += 0.15;
                            }
                        }
                        if (itemDef.stats) {
                            if (itemDef.stats.hp) { u.stats.maxHp += itemDef.stats.hp; u.currHp += itemDef.stats.hp; }
                            if (itemDef.stats.maxHp) { u.stats.maxHp += itemDef.stats.maxHp; u.currHp += itemDef.stats.maxHp; }
                            if (itemDef.stats.mana) u.currMana += itemDef.stats.mana;
                            if (itemDef.stats.ad) u.stats.ad += itemDef.stats.ad;
                            if (itemDef.stats.ap) u.stats.ap += itemDef.stats.ap;
                            if (itemDef.stats.armor) u.stats.armor += itemDef.stats.armor;
                            if (itemDef.stats.mr) u.stats.mr += itemDef.stats.mr;
                            if (itemDef.stats.critChance) u.combat.critChance = (u.combat.critChance || 0.10) + itemDef.stats.critChance;
                            if (itemDef.stats.vamp) u.combat.vamp = (u.combat.vamp || 0) + itemDef.stats.vamp;
                            if (itemDef.stats.dodge) u.combat.dodge = (u.combat.dodge || 0) + itemDef.stats.dodge;
                        }
                    }
                });
            }
        }
    }
    return cloned;
}

function getSynergyData(boardArray) {
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

function getActiveSynergyLevel(count, levelsArr, exactMatch = false) {
    if (exactMatch) {
        return levelsArr.includes(String(count)) ? count : 0;
    }
    let maxLvl = 0;
    levelsArr.forEach(lvl => {
        if (count >= Number(lvl)) maxLvl = Number(lvl);
    });
    return maxLvl;
}

function generateSandboxSynergyTooltip(synData, type, name, currentBoard, count, maxLevel) {
    let html = `<div style="font-weight:bold; color:#475569; font-size:1rem; margin-bottom:4px;">${type==='subject'?'📚':'🏷️'} ${name} <span style="font-size:0.75rem; color:#666;">(${count}/${maxLevel})</span></div>`;
    html += `<div style="color:#475569; margin-bottom: 4px;">${synData.desc}</div>`;

    const seenIds = new Set();
    currentBoard.forEach(u => {
        if (u) seenIds.add(u.id);
    });

    const allMatches = UNIT_POOL.filter(u => u[type] === name);
    
    if (allMatches.length > 0) {
        html += `<div style="margin-top:10px; padding-top:12px; border-top:1px dashed #ccc; display:flex; gap:8px; flex-wrap:wrap;">`;
        allMatches.forEach(u => {
            const tColor = `var(--tier${u.tier})`;
            const isPlaced = seenIds.has(u.id);
            const opacity = isPlaced ? '1' : '0.4';
            const border = isPlaced ? `2px solid ${tColor}` : `2px dashed #999`;
            const bg = isPlaced ? '#fff' : '#e2e8f0';
            const shadow = isPlaced ? `box-shadow: 0 0 10px ${tColor}; transform: scale(1.1); z-index:2;` : '';
            html += `<div style="width:34px; height:34px; border-radius:6px; border:${border}; display:flex; justify-content:center; align-items:center; font-size:22px; background:${bg}; opacity:${opacity}; ${shadow} transition:all 0.2s;" title="${u.name} (${u.tier}G)">${u.icon}</div>`;
        });
        html += `</div>`;
    }
    return html;
}

function getSynergyTierAndSteps(count, synData) {
    let rank = 0; 
    const levels = Object.keys(synData.levels).map(Number).sort((a,b)=>a-b);
    let activeLevel = 0;

    if (synData.exactMatch) {
        if (levels.includes(count)) {
            activeLevel = count;
            const idx = levels.indexOf(count);
            if (levels.length === 2 && idx === 1) rank = 3;
            else rank = idx + 1;
        }
    } else {
        for (let i = 0; i < levels.length; i++) {
            if (count >= levels[i]) {
                activeLevel = levels[i];
                if (levels.length === 2 && i === 1) rank = 3;
                else rank = i + 1;
            }
        }
    }
    
    const stepStrs = levels.map(lvl => {
        if (lvl === activeLevel) return `<span style="color:#e11d48; font-weight:900; font-size:1.1em;">${lvl}</span>`;
        if (lvl < activeLevel) return `<span style="color:#64748b; font-weight:bold;">${lvl}</span>`;
        return `<span style="color:#cbd5e1;">${lvl}</span>`;
    }).join(' <span style="color:#94a3b8; font-size:10px; margin: 0 2px;">></span> ');

    return { rank, activeLevel, stepStrs, levels };
}

function getSynergyStyleByRank(rank) {
    switch (rank) {
        case 0: return { bg: '#e2e8f0', border: '#cbd5e1' }; // Inactive (Light Slate)
        case 1: return { bg: '#bcaaa4', border: '#8d6e63' }; // Bronze/Wood (Muted earthy tone)
        case 2: return { bg: '#94a3b8', border: '#475569' }; // Silver (Premium blue-gray metallic)
        case 3: return { bg: '#facc15', border: '#ca8a04' }; // Gold (Bright yellow gold)
        default: return { bg: '#22d3ee', border: '#0891b2' }; // Prismatic (Vibrant cyan)
    }
}

function getSynergyIcon(name) {
    const icons = {
        '국어': 'images/icon_01_korean.png',
        '수학': 'images/icon_02_math.png',
        '사회': 'images/icon_03_social.png',
        '과학': 'images/icon_04_science.png',
        '영어': 'images/icon_05_english.png',
        '체육': 'images/icon_06_pe.png',
        '음악': 'images/icon_07_music.png',
        '미술': 'images/icon_08_art.png',
        '도덕': 'images/icon_09_ethics.png',
        '선도부': 'images/icon_10_discipline.png',
        '방송부': 'images/icon_11_broadcasting.png',
        '육상부': 'images/icon_12_track.png',
        '보건부': 'images/icon_13_health.png',
        '급식부': 'images/icon_14_cafeteria.png',
        '장난꾸러기': 'images/icon_15_trickster.png'
    };
        const src = icons[name];
        if (src) {
            return `<img src="${src}" style="width: 28px; height: 28px; object-fit: contain; transform: scale(1.15);" alt="${name}">`;
        }
    return '✨';
}

function calculateSynergy() {
    const counts = getSynergyData(playerBoard);
    const listEl = document.getElementById('synergy-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    listEl.style.padding = '8px';
    listEl.style.background = 'rgba(255, 255, 255, 0.4)';
    listEl.style.borderRadius = '8px';

    const activeSyns = [];

    for (const [subj, count] of Object.entries(counts.subjects)) {
        if (count > 0 && SYNERGIES.subjects[subj]) activeSyns.push({ name: subj, count, type: 'subject', data: SYNERGIES.subjects[subj] });
    }
    for (const [club, count] of Object.entries(counts.clubs)) {
        if (count > 0 && SYNERGIES.clubs[club]) activeSyns.push({ name: club, count, type: 'club', data: SYNERGIES.clubs[club] });
    }

    activeSyns.forEach(syn => {
        const info = getSynergyTierAndSteps(syn.count, syn.data);
        syn.rank = info.rank;
        syn.stepStrs = info.stepStrs;
        syn.maxLevel = Math.max(...Object.keys(syn.data.levels).map(Number));
    });

    activeSyns.sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank;
        return b.count - a.count;
    });

    activeSyns.forEach(syn => {
        const style = getSynergyStyleByRank(syn.rank);
        const icon = getSynergyIcon(syn.name);
        
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.marginBottom = '6px';
        li.style.padding = '4px';
        li.style.background = 'rgba(255, 255, 255, 0.7)';
        li.style.borderRadius = '6px';
        li.style.cursor = 'help';
        li.style.transition = 'background 0.2s, box-shadow 0.2s';
        li.style.listStyle = 'none';
        li.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
        li.onmouseenter = () => { li.style.background = 'rgba(255, 255, 255, 0.9)'; li.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)'; };
        li.onmouseleave = () => { li.style.background = 'rgba(255, 255, 255, 0.7)'; li.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; };

        li.innerHTML = `
            <div style="
                width: 40px; height: 44px; 
                background: ${style.border}; 
                clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
                display: flex; justify-content: center; align-items: center;
                margin-right: -4px; z-index: 2;
            ">
                <div style="
                    width: 34px; height: 38px;
                    background: ${syn.rank === 0 ? '#f8f9fa' : style.bg};
                    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
                    display: flex; justify-content: center; align-items: center;
                    font-size: 14px;
                ">${icon}</div>
            </div>
            <div style="
                width: 24px; height: 26px;
                background: #f1f5f9; color: #334155;
                display: flex; justify-content: center; align-items: center;
                font-weight: bold; font-size: 13px;
                border-top-right-radius: 4px; border-bottom-right-radius: 4px;
                border: 1px solid #cbd5e1; border-left: none;
                margin-right: 8px;
            ">${syn.count}</div>
            <div style="display: flex; flex-direction: column; justify-content: center;">
                <div style="color: ${syn.rank > 0 ? '#1e293b' : '#94a3b8'}; font-weight: bold; font-size: 0.9rem; line-height: 1.1;">${syn.name}</div>
                <div style="font-size: 0.7rem; line-height: 1.1; margin-top:2px;">${syn.stepStrs}</div>
            </div>
        `;

        li.onmouseover = (e) => {
            const html = generateSandboxSynergyTooltip(syn.data, syn.type, syn.name, playerBoard, syn.count, syn.maxLevel);
            showCustomTooltip(e, html);
        };
        li.onmouseout = () => hideCustomTooltip();

        listEl.appendChild(li);
    });
}

function applySynergiesToStats(board, isEnemy = false) {
    const counts = getSynergyData(board);
    
    // Helper function
    const getLevelData = (type, name, count) => {
        const synData = SYNERGIES[type][name];
        if (!synData) return null;
        if (synData.exactMatch) return synData.levels[count] ? synData.levels[count] : null;
        let activeLvl = 0;
        for (let lvl of Object.keys(synData.levels).map(Number).sort((a, b) => a - b)) {
            if (count >= lvl) activeLvl = lvl;
        }
        return activeLvl > 0 ? synData.levels[activeLvl] : null;
    };

    let teamAp = 0, teamHp = 0, teamDef = 0;
    for (let [subj, count] of Object.entries(counts.subjects)) {
        const eff = getLevelData('subjects', subj, count);
        if (!eff) continue;
        if (subj === '국어') teamAp += eff.teamAp || 0;
        if (subj === '체육') teamHp += eff.teamHp || 0;
        if (subj === '도덕') teamDef += eff.teamDef || 0;
    }

    board.forEach(u => {
        if (!u) return;
        
        u.stats.ap += teamAp;
        u.stats.maxHp += teamHp;
        u.currHp += teamHp;
        u.stats.armor += teamDef;
        u.stats.mr += teamDef;

        const subjEff = getLevelData('subjects', u.subject, counts.subjects[u.subject]);
        if (subjEff) {
            if (u.subject === '국어') u.stats.ap += subjEff.selfAp || 0;
            if (u.subject === '수학') { u.combat.critChance += subjEff.critChance; u.combat.critDmg += subjEff.critDmg; }
            if (u.subject === '과학') {
                u.combat.dmgAmp = (u.combat.dmgAmp || 0) + (subjEff.dmgAmp || 0);
                if (subjEff.skillCrit) u.combat.skillCrit = true;
                if (subjEff.critChance) u.combat.critChance = (u.combat.critChance || 0) + subjEff.critChance;
            }
            if (u.subject === '사회') {
                if (subjEff.shield) u.combat.shield += subjEff.shield;
                if (subjEff.allStats) {
                    const mult = 1 + subjEff.allStats;
                    u.stats.maxHp *= mult; u.currHp *= mult;
                    u.stats.ad *= mult; u.stats.ap *= mult;
                    u.stats.armor *= mult; u.stats.mr *= mult;
                }
            }
            if (u.subject === '영어') {
                if (subjEff.manaReduc) u.stats.maxMana = Math.max(10, Math.floor(u.stats.maxMana * (1 - subjEff.manaReduc)));
            }
            if (u.subject === '체육') { u.stats.maxHp += (subjEff.teamHp || 0) * ((subjEff.selfHpMult || 1) - 1); u.currHp = u.stats.maxHp; }
            if (u.subject === '음악') { u.combat.isFirelight = true; u.combat.tickHeal = subjEff.tickHeal; u.combat.bonusMagicDmg = subjEff.bonusMagicDmg; }
            if (subjEff.teamManaRegen) u.combat.teamManaRegen = (u.combat.teamManaRegen || 0) + subjEff.teamManaRegen;
            if (u.subject === '미술' && subjEff.artManaRegen) { u.combat.artManaRegen = (u.combat.artManaRegen || 0) + subjEff.artManaRegen; }
            if (u.subject === '도덕') { u.stats.armor += (subjEff.teamDef || 0) * ((subjEff.selfDefMult || 1) - 1); u.stats.mr += (subjEff.teamDef || 0) * ((subjEff.selfDefMult || 1) - 1); }
        }

        const clubEff = getLevelData('clubs', u.club, counts.clubs[u.club]);
        if (clubEff) {
            if (u.club === '선도부') { u.combat.shield += u.stats.maxHp * clubEff.startShieldPct; u.combat.dmgAmp += clubEff.dmgAmp; }
            if (u.club === '방송부') { u.combat.isSniper = true; u.combat.distAmp = clubEff.distAmp; u.stats.range += (clubEff.rangeBuff || 0); }
            if (u.club === '육상부') { u.combat.isQuickstriker = true; u.combat.maxAsBuff = clubEff.maxAsBuff; }
            if (u.club === '보건부') { u.combat.isWatcher = true; u.combat.dmgReduc += clubEff.dmgReduc; }
            if (u.club === '급식부') { u.combat.isDominator = true; u.combat.shield += clubEff.startShield; u.combat.stackAdApPct = clubEff.stackAdApPct; if (clubEff.vampBuff) u.combat.vamp = (u.combat.vamp || 0) + clubEff.vampBuff; }
            if (u.club === '장난꾸러기') { u.stats.ad *= (1 + clubEff.adBuff); }
        }
    });

    return board;
}

function startBattle() {
    if (isBattling) return;
    isBattling = true;
    document.getElementById('btn-start').disabled = true;

    // Apply items
    let pBoard = applyItemsToStats(playerBoard);
    let eBoard = applyItemsToStats(enemyBoard);
    
    // Apply synergies
    pBoard = applySynergiesToStats(pBoard, false);
    eBoard = applySynergiesToStats(eBoard, true);

    const augmentsArray = Array.from(selectedAugments);

    battleEngine = new BattleEngine(pBoard, eBoard, augmentsArray);
    const logs = battleEngine.run();
    
    // Copy rendered board elements for BattleRenderer
    battleRenderer = new BattleRenderer(logs, boardEl, fxCanvas);
    battleRenderer.play((winner, endLog) => {
        isBattling = false;
        document.getElementById('btn-start').disabled = false;
        alert(`종료! 승리: ${winner === 'player' ? '플레이어' : '적'}`);
        renderBoard(); // reset UI
    });
}

window.addEventListener('DOMContentLoaded', init);
