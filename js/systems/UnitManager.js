export class UnitManager {
    constructor(gameApp) {
        this.app = gameApp;
    }

    renderUnits() {
        const boardCells = document.querySelectorAll('.board-cell');

        // 전투 중이 아닐 때만 보드 영역을 렌더링 (전투 중 보드 리렌더링 방지)
        if (!window.isBattlePhase) {
            // 적 보드 렌더링 (0~23)
            this.app.state.enemyBoard.forEach((unit, idx) => {
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
            this.app.state.board.forEach((unit, idx) => {
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
        this.app.state.bench.forEach((unit, idx) => {
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
        if (window.isBattlePhase && sourceType === 'board') return;

        if (sourceType === 'board') {
            // 보드에 있는 유닛은 판매되지 않고 대기석으로 이동
            const emptyBenchIdx = this.app.state.bench.findIndex(u => u === null);
            if (emptyBenchIdx !== -1) {
                this.app.state.bench[emptyBenchIdx] = unit;
                this.app.state.board[sourceIdx] = null;
                this.renderUnits();
                this.app.calculateSynergy();
            } else {
                alert("대기석이 가득 찼습니다! (먼저 대기석 유닛을 판매하세요)");
            }
            return;
        }

        // 대기석 유닛만 판매
        this.app.state.bench[sourceIdx] = null;

        // 환불 로직: 유닛 티어만큼 골드 환불 + 장착 아이템 모두 반환
        this.app.state.gold += unit.tier;
        if (unit.items && unit.items.length > 0) {
            unit.items.forEach(itemId => {
                this.app.itemManager.addItemToInventory(itemId);
            });
        }

        this.app.updateHeader();
        this.renderUnits();
        this.app.calculateSynergy();
        console.log(`${unit.name} 판매 완료 (+${unit.tier}G), 아이템 환불됨`);
    }

    moveUnit(sourceType, sourceIdx, targetType, targetIdx) {
        if (isNaN(sourceIdx) || isNaN(targetIdx)) return;
        if (sourceType === targetType && sourceIdx === targetIdx) return;

        if (targetType === 'board' && targetIdx < 24) {
            console.log("적 영역에는 유닛을 배치할 수 없습니다.");
            return;
        }

        const sourceArr = sourceType === 'board' ? this.app.state.board : this.app.state.bench;
        const targetArr = targetType === 'board' ? this.app.state.board : this.app.state.bench;

        const adjustedTargetIdx = targetType === 'board' ? targetIdx - 24 : targetIdx;

        // 레벨에 따른 배치 수 제한 확인 (대기석 -> 비어있는 보드로 이동 시)
        if (sourceType === 'bench' && targetType === 'board') {
            if (!targetArr[adjustedTargetIdx]) {
                const currentBoardCount = this.app.state.board.filter(u => u !== null).length;
                if (currentBoardCount >= this.app.state.level) {
                    alert(`현재 레벨(${this.app.state.level})이 낮아 더 이상 배치할 수 없습니다. 경험치를 구매하세요!`);
                    return;
                }
            }
        }

        // 유닛 스왑(Swap)
        const temp = targetArr[adjustedTargetIdx];
        targetArr[adjustedTargetIdx] = sourceArr[sourceIdx];
        sourceArr[sourceIdx] = temp;

        this.renderUnits();
        this.app.calculateSynergy();
        this.app.updateHeader(); // 배치수 UI 업데이트

        // 이동 시 혹시 모를 진화(대기석과 보드 분리 상태에서의 스왑 등) 체크
        if (sourceArr[sourceIdx]) this.checkForUpgrade(sourceArr[sourceIdx].id);
        if (targetArr[adjustedTargetIdx]) this.checkForUpgrade(targetArr[adjustedTargetIdx].id);
    }

    checkForUpgrade(unitId) {
        // 1성과 2성에 대해 3마리 모였는지 순차적 체크 (연쇄 진화 대비)
        [1, 2].forEach(starLevel => {
            let foundSlots = [];

            this.app.state.board.forEach((u, i) => {
                if (u && u.id === unitId && (u.star || 1) === starLevel) foundSlots.push({ type: 'board', index: i, unit: u });
            });
            this.app.state.bench.forEach((u, i) => {
                if (u && u.id === unitId && (u.star || 1) === starLevel) foundSlots.push({ type: 'bench', index: i, unit: u });
            });

            if (foundSlots.length >= 3) {
                const toMerge = foundSlots.slice(0, 3);

                // 기존 유닛 3개 삭제
                toMerge.forEach(slot => {
                    if (slot.type === 'board') this.app.state.board[slot.index] = null;
                    else this.app.state.bench[slot.index] = null;
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

                // [신규 기획] 1~3코스트 3성 달성 시 강력한 보너스 깡스탯 부여
                if (newUnit.star === 3 && newUnit.tier <= 3) {
                    newUnit.stats.armor += Math.round(50 - (newUnit.tier * 10)); // 1코:+40, 2코:+30, 3코:+20
                    newUnit.stats.mr += Math.round(50 - (newUnit.tier * 10));
                    newUnit.stats.hp += Math.round(500 - (newUnit.tier * 100)); // 1코:+400, 2코:+300, 3코:+200
                }
                newUnit.permGrowth = summedPermGrowth;

                // 3번째 유닛 위치에 새 유닛 배치
                const targetSlot = toMerge[2];
                if (targetSlot.type === 'board') this.app.state.board[targetSlot.index] = newUnit;
                else this.app.state.bench[targetSlot.index] = newUnit;

                console.log(`🌟 [진화] ${newUnit.name}이(가) ${newUnit.star}성으로 진화했습니다!`);

                // 재귀 호출로 3성 진화 연쇄 체크
                this.checkForUpgrade(unitId);
            }
        });

        this.renderUnits();
        this.app.calculateSynergy();
    }

    addToBench(unit) {
        const emptyIdx = this.app.state.bench.findIndex(u => u === null);
        if (emptyIdx !== -1) {
            unit.star = 1;
            unit.stats.maxHp = unit.stats.hp;
            unit.items = unit.items || [];
            this.app.state.bench[emptyIdx] = unit;
            this.renderUnits();
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
            if (!arr) return '';
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
        if (skill.dotDuration) details.push(`지속시간: ${formatArr(skill.dotDuration.map(t => (t * 0.1).toFixed(1)), false, '초', COLORS.def, '')}`);
        if (skill.debuffDuration) details.push(`디버프 지속: ${formatArr(skill.debuffDuration.map(t => (t * 0.1).toFixed(1)), false, '초', COLORS.def, '')}`);
        if (skill.charges) details.push(`적용 횟수: ${formatArr(skill.charges, false, '회', COLORS.def, '')}`);

        if (skill.selfDefBuff) details.push(`방어력 증가: ${formatArr(skill.selfDefBuff, true, '', COLORS.armor, '🛡️')}`);
        if (skill.selfMrBuff) details.push(`마법저항력 증가: ${formatArr(skill.selfMrBuff, true, '', COLORS.mr, '🌀')}`);
        if (skill.permAdBuff) details.push(`영구 공격력 증가: ${formatArr(skill.permAdBuff, true, '', COLORS.ad, '⚔️')}`);
        if (skill.vampBuff) details.push(`피해 흡혈: ${formatArr(skill.vampBuff, true, '', COLORS.def, '')}`);
        if (skill.dmgReduc || skill.dmgReducPct) details.push(`피해 감소: ${formatArr(skill.dmgReduc || skill.dmgReducPct, true, '', COLORS.def, '')}`);

        if (skill.asBuff) details.push(`공격 속도 증가(🔮비례): ${formatArr(skill.asBuff, true, '', COLORS.ap, '🔮')}`);
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
                color = COLORS.ap; // 주문력 스케일링이므로 보라색 적용
                icon = '🔮'; // 번개 대신 주문력 계수 아이콘 표기
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
                html = html.replace(/(주문력|공격 속도|공격력|스탯) (증가|버프)/, `$1 ${wrap('+' + apScaled + '%', COLORS.ap, '🔮')} $2`);
            } else if (skill.buffStat === 'as') {
                const asScaled = Math.round(skill.buffPct[starIdx] * (currAp / 100) * 100);
                // 문학소녀의 경우: 공속 증가지만 '주문력'에 의해 스케일링되므로 🔮 아이콘 사용
                html = html.replace(/(주문력|공격 속도|공격력|스탯) (증가|버프)/, `$1 ${wrap('+' + asScaled + '%', COLORS.ap, '🔮')} $2`);
            } else {
                html = html.replace(/(주문력|공격 속도|공격력|스탯) (증가|버프)/, `$1 ${wrap('+' + Math.round(skill.buffPct[starIdx] * 100) + '%', COLORS.def)} $2`);
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
        if (skill.dotDuration) html = html.replace(/일정 시간/, wrap((skill.dotDuration[starIdx] * 0.1).toFixed(1) + '초간', COLORS.def));

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
            html = html.replace(/공격 속도 대폭 증가|공격 속도 증가|공속 증가/, `공격 속도 ${wrap('+' + asVal + '%', COLORS.ap, '🔮')} 증가`);
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

        if (this.app.state.board.includes(baseUnit)) {
            synergies = this.app.getSynergyData(this.app.state.board);
        } else if (this.app.state.enemyBoard.includes(baseUnit)) {
            synergies = this.app.getSynergyData(this.app.state.enemyBoard);
            isEnemy = true;
        }

        const unit = this.app.applySynergyStats([baseUnit], synergies, isEnemy)[0];

        if (uDiv) {
            if (uDiv.dataset.currHp !== undefined) unit.currHp = parseFloat(uDiv.dataset.currHp);
            if (uDiv.dataset.currMana !== undefined) unit.currMana = parseFloat(uDiv.dataset.currMana);
            if (window.isBattlePhase && uDiv.dataset.type !== 'bench') {
                if (uDiv.dataset.currAd !== undefined) unit.stats.ad = parseFloat(uDiv.dataset.currAd);
                if (uDiv.dataset.currAp !== undefined) unit.stats.ap = parseFloat(uDiv.dataset.currAp);
                if (uDiv.dataset.currArmor !== undefined) unit.stats.armor = parseFloat(uDiv.dataset.currArmor);
                if (uDiv.dataset.currMr !== undefined) unit.stats.mr = parseFloat(uDiv.dataset.currMr);
                if (uDiv.dataset.currAs !== undefined) unit.stats.as = parseFloat(uDiv.dataset.currAs);

                if (window.gameApp && window.gameApp.engine) {
                    const idx = parseInt(uDiv.dataset.index);
                    let activeU = null;
                    if (baseUnit.isEnemy) activeU = window.gameApp.engine.enemyBoard[idx];
                    else activeU = window.gameApp.engine.board[idx];

                    if (activeU && activeU.buffs) {
                        let armShreds = activeU.buffs.filter(b => b.type === 'armorShred');
                        let maxArmShred = armShreds.length > 0 ? Math.max(...armShreds.map(b => b.val)) : 0;
                        unit.stats.armor *= (1 - maxArmShred);

                        let mrShreds = activeU.buffs.filter(b => b.type === 'mrShred');
                        let maxMrShred = mrShreds.length > 0 ? Math.max(...mrShreds.map(b => b.val)) : 0;
                        unit.stats.mr *= (1 - maxMrShred);
                    }
                }
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
                const itemDef = this.app.ITEMS.find(it => it.id === itemId);
                const iconStr = this.app.itemManager.getIconForItem(itemId);
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
                <span class="mana-type-tag" data-type="${unit.manaType}" style="cursor:help; float:right; border-radius: 4px; padding: 2px 6px; background: #e5e7eb; font-weight:bold; font-size: 0.75rem;">
                    ${unit.manaType === '근성' ? '🛡️ 근성 마나' : unit.manaType === '전투' ? '⚔️ 전투 마나' : '🔮 집중 마나'}
                </span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; font-weight: 600; color: #374151;">
                <div>❤️ 체력: <span id="info-hp" style="color:#4caf50">${Math.max(0, currHp)}</span><span style="color:#4caf50; font-size:0.75rem;">/${unit.stats.maxHp || unit.stats.hp}</span></div>
                <div>💧 마나: <span id="info-mana" style="color:#1e88e5">${Math.max(0, currMana)}</span><span style="color:#1e88e5; font-size:0.75rem;">/${unit.stats.maxMana || unit.stats.mana}</span></div>
                <div>⚔️ 공격력: <span id="info-ad" style="color:#e65100">${Math.round(unit.stats.ad)}</span></div>
                <div>🔮 주문력: <span id="info-ap" style="color:#8e24aa">${Math.round(unit.stats.ap)}%</span></div>
                <div>🛡️ 방어: <span id="info-armor" style="color:#795548">${Math.round(unit.stats.armor)}</span></div>
                <div>🌀 마저: <span id="info-0f7672">${Math.round(unit.stats.mr)}</span></div>
                <div>⚡ 공속: <span id="info-as" style="color:#e53935">${unit.stats.as.toFixed(2)}</span></div>
                <div>🎯 사거리: <span style="color:#546e7a">${unit.stats.range}</span></div>
                <div style="grid-column: span 2; border-top: 1px dotted #ccc; margin-top: 2px; padding-top: 4px;"></div>
                <div>🗡️ 치명 확률: <span id="info-critChance" style="color:#ffb300">${Math.round((unit.combat?.critChance || 0.10) * 100)}%</span></div>
                <div>💥 치명 배율: <span id="info-critDmg" style="color:#ffb300">${Math.round((unit.combat?.critDmg || 1.5) * 100)}%</span></div>
                <div>📈 피해 증폭: <span id="info-dmgAmp" style="color:#ef5350">+${Math.round((unit.combat?.dmgAmp || 0) * 100)}%</span></div>
                <div>📉 피해 감소: <span id="info-dmgReduc" style="color:#29b6f6">${Math.round((unit.combat?.dmgReduc || 0) * 100)}%</span></div>
                <div>🩸 흡혈률: <span id="info-vamp" style="color:#ec407a">${Math.round((unit.combat?.vamp || 0) * 100)}%</span></div>
                <div>🌱 추가 재생: <span id="info-manaRegen" style="color:#42a5f5">+${((unit.combat?.teamManaRegen || 0) + (unit.subject === '미술' ? (unit.combat?.artManaRegen || 0) : 0))}</span></div>
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

                this.app.showCustomTooltip(e, text, false);
            };
            manaTag.onmouseout = () => this.app.hideCustomTooltip();
        }

        const itemsContainer = infoEl.querySelector('.unit-items-container');
        if (itemsContainer) {
            itemsContainer.ondragover = (e) => e.preventDefault();
            itemsContainer.ondrop = (e) => {
                const itemIdxStr = e.dataTransfer.getData('itemIdx');
                if (itemIdxStr) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.app.giveItemToUnit(parseInt(itemIdxStr), baseUnit);
                }
            };
        }

        const itemSlots = infoEl.querySelectorAll('.unit-item-slot.filled');
        itemSlots.forEach(slot => {
            slot.onmouseover = (e) => {
                if (window.isContextMenuOpen) return;
                const itemId = slot.dataset.itemId;
                const itemDef = this.app.ITEMS.find(it => it.id === itemId);
                const iconStr = this.app.itemManager.getIconForItem(itemId);
                this.app.showCustomTooltip(e, `
                    <div style="font-weight:bold; color:${itemDef.type === 'base' ? '#475569' : '#d97706'}; font-size:1rem; margin-bottom:4px;">
                        ${iconStr} ${itemDef.name}
                        <span style="font-size:0.75rem; color:#666; font-weight:normal; margin-left:4px;">${this.app.itemManager.formatItemStats(itemDef.stats)}</span>
                    </div>
                    <div style="color:#475569;">${itemDef.desc}</div>
                    ${itemDef.type === 'base' ? '<div style="font-size:0.75rem; color:#64748b; margin-top:5px; text-align:right;">좌클릭하여 조합표 보기</div>' : ''}
                `);
            };

            slot.onmouseout = (e) => {
                if (!window.isContextMenuOpen) {
                    this.app.hideCustomTooltip();
                }
            };

            slot.onclick = (e) => {
                e.stopPropagation();
                const itemId = slot.dataset.itemId;
                const itemDef = this.app.ITEMS.find(it => it.id === itemId);
                if (itemDef.type === 'base') {
                    let html = `<div style="font-weight:bold; color:#d97706; margin-bottom:8px; text-align:center; border-bottom:1px solid rgba(0,0,0,0.1); padding-bottom:4px;">${itemDef.name} 조합표</div>`;
                    html += `<div style="display:flex; flex-direction:column; gap:6px;">`;
                    this.app.ITEMS.filter(x => x.type === 'combined' && x.recipe && x.recipe.includes(itemId)).forEach(combo => {
                        const otherId = combo.recipe[0] === itemId ? combo.recipe[1] : combo.recipe[0];
                        const otherDef = this.app.ITEMS.find(x => x.id === otherId);
                        const otherIcon = this.app.itemManager.getIconForItem(otherId);
                        const comboIcon = this.app.itemManager.getIconForItem(combo.id);
                        html += `
                            <div style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:4px; position:relative;"
                                 onmouseover="this.querySelector('.combo-tooltip').style.display='block';"
                                 onmouseout="this.querySelector('.combo-tooltip').style.display='none';">
                                <span style="color:#333;">+</span>
                                <span>${otherIcon}</span>
                                <span style="color:#475569; font-size:0.85rem; flex:1;">${otherDef.name}</span>
                                <span style="color:#333;">=</span>
                                <span style="font-size:1.1rem; cursor:help;">${comboIcon}</span>
                                <div class="combo-tooltip" style="display:none; position:absolute; right:100%; top:50%; transform:translateY(-50%); margin-right:10px; width:220px; background:rgba(253,250,243,0.98); padding:8px; border-radius:6px; border:1px solid rgba(0,0,0,0.1); box-shadow:0 5px 15px rgba(0,0,0,0.15); z-index:1000000; font-size:0.8rem; line-height:1.3;">
                                    <div style="color:#d97706; font-weight:bold; margin-bottom:4px;">
                                        ${combo.name}
                                        <div style="font-size:0.7rem; color:#666; font-weight:normal;">${this.app.itemManager.formatItemStats(combo.stats)}</div>
                                    </div>
                                    <div style="color:#475569; white-space:pre-wrap;">${combo.desc}</div>
                                </div>
                            </div>
                        `;
                    });
                    html += `</div>`;
                    this.app.showCustomTooltip(e, html, true);
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
                const syn = this.app.SYNERGIES[type][name];
                if (!syn) return;

                const tooltip = document.getElementById('tooltip');
                tooltip.style.display = 'block';
                tooltip.style.left = (e.pageX + 15) + 'px';
                tooltip.style.top = (e.pageY + 15) + 'px';

                let html = `<strong style="color:#d81b60">${syn.name}</strong><br><span style="font-size:0.85rem; color:#555;">${syn.desc}</span><div style="margin-top:5px; font-size:0.75rem;">`;
                for (const [lvl, effects] of Object.entries(syn.levels)) {
                    html += `<div style="margin-top:3px;"><span style="font-weight:bold; color:#1976d2;">[${lvl}]</span> `;
                    let effStrs = [];
                    for (const [k, v] of Object.entries(effects)) effStrs.push(formatStat(k, v));
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
}
