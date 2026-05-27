export class AugmentManager {
    constructor(gameApp) {
        this.app = gameApp;
    }

    showStoreTimeSelection() {
        const modal = document.getElementById('augment-modal');
        const container = document.getElementById('augment-cards-container');
        document.getElementById('augment-title').innerText = "🏫 매점 타임";
        document.getElementById('augment-subtitle').innerText = "매점에 신상품이 들어왔습니다! 원하는 기본 아이템 단 하나만 선택하세요!";

        container.innerHTML = '';

        const bases = this.app.ITEMS.filter(i => i.type === 'base');
        const choices = [];
        for (let i = 0; i < 3; i++) {
            choices.push(bases[Math.floor(Math.random() * bases.length)]);
        }

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
                this.app.itemManager.addItemToInventory(item.id);
                modal.style.display = 'none';
            };

            container.appendChild(card);
        });

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

    applyAugment(aug, tier) {
        this.app.state.augments.push({ ...aug, tier });
        const id = aug.id;
        const g = this.app.state.globalBuffs;
        const st = this.app.state;

        // 실버
        if (id === 's1') st.invincibleRounds += 3;
        if (id === 's2') st.snackShop = true;
        if (id === 's3') st.freeRerolls += 5;
        if (id === 's4') g.teamHp += 150;
        if (id === 's5') this.app.addExp(10);
        if (id === 's6') {
            for (let i = 0; i < 3; i++) {
                const pool = this.app.UNIT_POOL.filter(u => u.tier <= 2);
                this.app.addToBench({ ...pool[Math.floor(Math.random() * pool.length)] });
            }
        }
        if (id === 's7') g.tickHealPct += 0.02;
        if (id === 's8') g.dutyResponsibility = true;
        if (id === 's9') g.teamDef += 15;
        if (id === 's10') st.lostAndFound = true;
        if (id === 's11') { this.app.itemManager.giveRandomBaseItem(); this.app.itemManager.giveRandomBaseItem(); }

        // 골드
        if (id === 'g1') st.highEndShopping = true;
        if (id === 'g2') g.cramming = true;
        if (id === 'g3') st.honorStudent = true;
        if (id === 'g4') g.enforcerAura = true;
        if (id === 'g5') {
            const board1Stars = [];
            st.board.forEach((u, i) => { if (u && (u.star || 1) === 1) board1Stars.push(u); });
            if (board1Stars.length > 0) {
                const target = board1Stars[Math.floor(Math.random() * board1Stars.length)];
                target.star = 2; target.stats.hp = Math.round(target.stats.hp * 1.8); target.stats.maxHp = target.stats.hp; target.stats.ad = Math.round(target.stats.ad * 1.5); target.stats.ap = Math.round(target.stats.ap * 1.5);
                this.app.renderUnits();
            }
        }
        if (id === 'g6') {
            st.gold += 10;
            const pool = this.app.UNIT_POOL.filter(u => u.tier === 4);
            if (pool.length) this.app.addToBench({ ...pool[Math.floor(Math.random() * pool.length)] });
        }
        if (id === 'g7') g.teamAdAp += 20;
        if (id === 'g8') g.vamp += 0.20;
        if (id === 'g9') g.startShield += 300;
        if (id === 'g10') g.rerollDiscountEndWorld = 3;
        if (id === 'g11') { this.app.itemManager.giveRandomCombinedItem(); }

        // 프리즘
        if (id === 'p1') {
            const pool = this.app.UNIT_POOL.filter(u => u.tier === 5);
            if (pool.length) this.app.addToBench({ ...pool[Math.floor(Math.random() * pool.length)] });
            const req = this.app.getMaxExp(st.level);
            if (req) this.app.addExp(req - st.exp);
        }
        if (id === 'p2') g.earlyGraduation = true;
        if (id === 'p3') g.dmgAmp += 0.40;
        if (id === 'p4') st.freeMeals = true;
        if (id === 'p5') g.spartanTraining = true;
        if (id === 'p6') st.richFoundation = true;
        if (id === 'p7') { g.asMult += 0.30; g.startMana += 50; }
        if (id === 'p8') st.lateLeave = true;
        if (id === 'p9') {
            const pool = this.app.UNIT_POOL.filter(u => u.tier === 5);
            for (let i = 0; i < 3; i++) {
                if (pool.length) this.app.addToBench({ ...pool[Math.floor(Math.random() * pool.length)] });
            }
        }
        if (id === 'p10') { g.rangeBuff += 1; g.distAmp += 0.10; }
        if (id === 'p11') { st.gold += 10; this.app.itemManager.giveRandomCombinedItem(); this.app.itemManager.giveRandomCombinedItem(); }

        this.renderActiveAugments();
        this.app.updateHeader();
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
