import { promoteUnitToStar } from '../battle/combatPreparation.js';

export const AUGMENT_EVENTS = Object.freeze({
    SELECTED: 'AUGMENT_SELECTED',
    BATTLE_STARTED: 'BATTLE_STARTED',
    BATTLE_ENDED: 'BATTLE_ENDED',
    ROUND_STARTED: 'ROUND_STARTED'
});

export function validateAugmentDefinition(augment) {
    const required = ['id', 'name', 'description', 'rarity', 'triggers', 'target', 'condition', 'duration', 'stackPolicy', 'remove', 'serialization', 'effect'];
    return Boolean(augment && required.every(key => augment[key] !== undefined) && Array.isArray(augment.triggers));
}

export function serializeAugments(augments = []) {
    return augments.map(augment => augment.id);
}

export function deserializeAugments(ids = [], catalog = {}) {
    const byId = new Map(Object.values(catalog).flat().map(augment => [augment.id, augment]));
    return ids.map(id => byId.get(id)).filter(Boolean).map(augment => ({ ...augment, tier: augment.rarity }));
}

export class AugmentManager {
    constructor(gameApp) {
        this.app = gameApp;
        this.random = gameApp.random || Math.random;
        this.unsubscribers = [AUGMENT_EVENTS.BATTLE_ENDED, AUGMENT_EVENTS.ROUND_STARTED]
            .map(event => this.app.eventBus?.on(event, payload => this.handleEvent(event, payload)))
            .filter(Boolean);
    }

    showStoreTimeSelection() {
        const modal = document.getElementById('augment-modal');
        const container = document.getElementById('augment-cards-container');
        document.getElementById('augment-title').innerText = "🏫 매점 타임";
        
        // 부제목에 창 접기 안내 추가
        document.getElementById('augment-subtitle').innerHTML = `매점에 신상품이 들어왔습니다! 원하는 기본 아이템 단 하나만 선택하세요!<br>
            <span style="font-size:0.9rem; color:#f39c12; cursor:pointer; font-weight:bold; margin-top:10px; display:inline-block;" id="btn-minimize-store">
                👀 [잠시 창 접고 보드/아이템 구경하기]
            </span>`;

        container.innerHTML = '';

        const bases = this.app.ITEMS.filter(i => i.type === 'base');
        
        // 아이템 중복 방지를 위한 Fisher-Yates Shuffle
        const shuffledBases = [...bases].sort(() => 0.5 - Math.random());
        const choices = shuffledBases.slice(0, 3);

        choices.forEach((item) => {
            const card = document.createElement('div');
            card.className = `augment-card silver`;
            card.style.cursor = 'pointer';

            const iconStr = this.app.itemManager.getIconForItem(item.id);
            card.innerHTML = `
                <div class="augment-icon">${iconStr}</div>
                <div class="augment-name">${item.name}</div>
                <div class="augment-desc">${item.desc}</div>
            `;

            card.onclick = () => {
                const transactionId = `store:${this.app.state.runId}:${this.app.state.stage.join('-')}`;
                const applied = this.app.saveManager
                    ? this.app.saveManager.runTransaction(transactionId, () => this.app.itemManager.addItemToInventory(item.id), 'REWARD_APPLIED')
                    : (this.app.itemManager.addItemToInventory(item.id), true);
                if (!applied) {
                    this.app.itemManager.renderInventory();
                    return;
                }
                modal.style.display = 'none';
                // 혹시 플로팅 버튼이 떠 있다면 숨김
                const floatingBtn = document.getElementById('floating-store-btn');
                if (floatingBtn) floatingBtn.style.display = 'none';
            };

            container.appendChild(card);
        });

        // 접기 버튼 이벤트
        const minBtn = document.getElementById('btn-minimize-store');
        const floatingBtn = document.getElementById('floating-store-btn');
        if (minBtn && floatingBtn) {
            minBtn.onclick = () => {
                modal.style.display = 'none';
                floatingBtn.style.display = 'flex';
            };
            
            // 플로팅 버튼 클릭 시 다시 모달 열기
            floatingBtn.onclick = () => {
                floatingBtn.style.display = 'none';
                modal.style.display = 'flex';
            };
        }

        modal.style.display = 'flex';
    }

    showAugmentSelection(tierNeeded) {
        const modal = document.getElementById('augment-modal');
        const container = document.getElementById('augment-cards-container');
        document.getElementById('augment-title').innerText = "생기부 특기사항 기록";
        document.getElementById('augment-subtitle').innerText = "특기사항 하나를 선택하여 학생들에게 강력한 혜택을 부여하세요!";
        container.innerHTML = '';

        // 해당 티어의 증강체 중 이미 보유하지 않은 것들만 필터링
        const pool = this.app.AUGMENTS[tierNeeded].filter(a => !this.app.state.augments.find(has => has.id === a.id));

        // 3개 랜덤 추출 (Fisher-Yates shuffle)
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const choices = shuffled.slice(0, 3);

        choices.forEach(aug => {
            const card = document.createElement('div');
            card.className = `augment-card ${tierNeeded}`;

            // 아이콘 매칭 (이름 기반 간단한 아이콘)
            let icon = '🎓';
            if (aug.name.includes('매점') || aug.name.includes('급식')) icon = '🍔';
            if (aug.name.includes('지각') || aug.name.includes('땡땡이') || aug.name.includes('귀가')) icon = '⏰';
            if (aug.name.includes('골드') || aug.name.includes('재단') || aug.name.includes('벼락치기')) icon = '💰';
            if (aug.name.includes('전교') || aug.name.includes('만점') || aug.name.includes('특혜')) icon = '💯';
            if (aug.name.includes('체육') || aug.name.includes('스파르타') || aug.name.includes('당번')) icon = '💪';
            if (aug.name.includes('과학') || aug.name.includes('방송') || aug.name.includes('선행')) icon = '🔬';

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

    applyAugment(augment, tier = augment.rarity) {
        if (!validateAugmentDefinition(augment)) throw new Error(`잘못된 증강체 정의: ${augment?.id || 'unknown'}`);
        if (augment.stackPolicy === 'unique' && this.app.state.augments.some(active => active.id === augment.id)) return false;

        const apply = () => {
            const active = { ...augment, tier };
            this.app.state.augments.push(active);
            if (active.triggers.includes(AUGMENT_EVENTS.SELECTED)) this.executeEffect(active);
            this.app.eventBus?.emit(AUGMENT_EVENTS.SELECTED, { augment: active });
        };
        const transactionId = `augment:${this.app.state.runId}:${this.app.state.stage.join('-')}:${tier}`;
        const applied = this.app.saveManager
            ? this.app.saveManager.runTransaction(transactionId, apply, 'REWARD_APPLIED')
            : (apply(), true);
        if (applied && typeof document !== 'undefined') this.renderActiveAugments();
        if (applied) this.app.updateHeader?.();
        return applied;
    }

    handleEvent(event, payload = {}) {
        this.app.state.augments
            .filter(augment => augment.triggers.includes(event))
            .forEach(augment => this.executeEffect(augment, payload));
    }

    executeEffect(augment, payload = {}) {
        const effect = augment.effect;
        const state = this.app.state;
        const globalBuffs = state.globalBuffs;

        if (effect.type === 'state' || effect.type === 'global') {
            const target = effect.type === 'state' ? state : globalBuffs;
            Object.entries(effect.values).forEach(([key, value]) => {
                target[key] = effect.mode === 'add' ? (target[key] || 0) + value : value;
            });
            return;
        }

        if (effect.type === 'grant') {
            if (effect.gold) state.gold += effect.gold;
            if (effect.exp) this.app.addExp(effect.exp);
            this.grantUnits(effect.unitTier, effect.unitCount || 0);
            for (let i = 0; i < (effect.baseItems || 0); i++) this.app.itemManager.giveRandomBaseItem();
            for (let i = 0; i < (effect.combinedItems || 0); i++) this.app.itemManager.giveRandomCombinedItem();
            return;
        }

        if (effect.type === 'upgrade-random') {
            const candidates = state.board.filter(unit => unit && (unit.star || 1) === 1);
            const target = candidates[Math.floor(this.random() * candidates.length)];
            if (!target) return;
            state.board[state.board.indexOf(target)] = promoteUnitToStar(target, effect.star);
            this.app.renderUnits?.();
            return;
        }

        if (effect.type === 'round-rerolls') {
            state.roundFreeRerolls = effect.count;
            return;
        }

        if (effect.type === 'win-unit' && payload.winner === 'player') {
            let roll = this.random();
            let tier = effect.tierChances.at(-1).tier;
            for (const option of effect.tierChances) {
                roll -= option.chance;
                if (roll <= 0) { tier = option.tier; break; }
            }
            this.grantUnits(tier, 1);
        }
    }

    grantUnits(tier, count) {
        if (!tier || !count) return;
        const pool = this.app.UNIT_POOL.filter(unit => unit.tier === tier);
        for (let i = 0; i < count && pool.length; i++) {
            const unit = pool[Math.floor(this.random() * pool.length)];
            this.app.addToBench(structuredClone(unit));
        }
    }

    removeAugment(id) {
        const index = this.app.state.augments.findIndex(augment => augment.id === id);
        if (index < 0) return false;
        const [augment] = this.app.state.augments.splice(index, 1);
        if (augment.remove === 'revert') this.revertEffect(augment.effect);
        if (typeof document !== 'undefined') this.renderActiveAugments();
        return true;
    }

    revertEffect(effect) {
        const state = this.app.state;
        if (effect.type === 'state' || effect.type === 'global') {
            const target = effect.type === 'state' ? state : state.globalBuffs;
            Object.entries(effect.values).forEach(([key, value]) => {
                target[key] = effect.mode === 'add' ? (target[key] || 0) - value : (typeof value === 'boolean' ? false : 0);
            });
        }
        if (effect.type === 'round-rerolls') state.roundFreeRerolls = 0;
    }

    dispose() {
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
    }

    renderActiveAugments() {
        const list = document.getElementById('augments-list');
        list.innerHTML = '';
        this.app.state.augments.forEach(aug => {
            const item = document.createElement('div');
            item.className = `active-augment-item ${aug.tier}`;

            let icon = '🎓';
            if (aug.name.includes('매점') || aug.name.includes('급식')) icon = '🍔';
            if (aug.name.includes('지각') || aug.name.includes('땡땡이') || aug.name.includes('귀가')) icon = '⏰';
            if (aug.name.includes('골드') || aug.name.includes('재단') || aug.name.includes('벼락치기')) icon = '💰';
            if (aug.name.includes('전교') || aug.name.includes('만점') || aug.name.includes('특혜')) icon = '💯';
            if (aug.name.includes('체육') || aug.name.includes('스파르타') || aug.name.includes('당번')) icon = '💪';
            if (aug.name.includes('과학') || aug.name.includes('방송') || aug.name.includes('선행')) icon = '🔬';

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
}
