import { BattleEngine } from '../battleEngine.js';
import { BattleRenderer } from '../battleRenderer.js';
import { UNIT_POOL } from '../data.js';
import { ITEMS } from '../items.js';
import { generateEnemyBoard } from '../enemyAi.js';
import { SYNERGIES } from '../data.js';

export class StageManager {
    constructor(gameApp) {
        this.app = gameApp;
    }

        spawnEnemyBoard() {
        this.app.state.enemyBoard = generateEnemyBoard(this.app.state.stage[0], this.app.state.stage[1]);
        const enemySynergies = this.app.getSynergyData(this.app.state.enemyBoard);
        const activeTraits = [];
        for (const [club, count] of Object.entries(enemySynergies.clubs)) {
            const lvl = this.app.getActiveSynergyLevel(count, Object.keys(SYNERGIES.clubs[club].levels), SYNERGIES.clubs[club].exactMatch);
            if (lvl > 0) activeTraits.push(`${club}(${lvl})`);
        }
        for (const [subj, count] of Object.entries(enemySynergies.subjects)) {
            const lvl = this.app.getActiveSynergyLevel(count, Object.keys(SYNERGIES.subjects[subj].levels), SYNERGIES.subjects[subj].exactMatch);
            if (lvl > 0) activeTraits.push(`${subj}(${lvl})`);
        }
        document.getElementById('enemy-info').innerText = activeTraits.length > 0 ? `🚨 적군 시너지: ${activeTraits.join(', ')}` : `🚨 적군 시너지: 없음`;
    }

    handleBattleStart() {
        const app = this.app;
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

        // 전투 시작 전, 전투 로그창 및 통계 초기화
        const battleLogEl = document.getElementById('battle-log');
        if (battleLogEl) battleLogEl.innerHTML = '';
        this.app.state.dpsStats = {}; // 다음 전투를 위해 리셋

        this.app.isBattlePhase = true; // 전투 상태 플래그 활성화
        window.isBattlePhase = true; // 글로벌 플래그 동기화 (렌더러 혼선 방지)

        // 보드의 유닛들은 드래그만 불가능하게 하고 클릭(정보 보기)은 가능하게 유지
        document.querySelectorAll('.board-cell .unit-character').forEach(u => u.draggable = false);

        // 적은 init() 및 다음 라운드에서 이미 state.enemyBoard에 스폰되어 있음
        const playerSynergies = this.app.getSynergyData(this.app.state.board);
        const enemySynergies = this.app.getSynergyData(this.app.state.enemyBoard);

        const buffedPlayerBoard = this.app.applySynergyStats(this.app.state.board, playerSynergies, false);
        const buffedEnemyBoard = this.app.applySynergyStats(this.app.state.enemyBoard, enemySynergies, true);

        // 극후반 아이템 격차 보정 (적 스탯 버프)
        if (app.state.stage[0] >= 5) {
            buffedEnemyBoard.forEach(u => {
                if (u) {
                    u.stats.maxHp = Math.round(u.stats.maxHp * 1.15);
                    u.stats.hp = Math.round(u.stats.hp * 1.15);
                    u.stats.armor += 15;
                    u.stats.mr += 15;
                }
            });
        }

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
                    setTimeout(() => { if (vfx.parentNode) vfx.remove(); }, 800);
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
                    setTimeout(() => { if (vfx.parentNode) vfx.remove(); }, 800);
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
                    setTimeout(() => { if (vfx.parentNode) vfx.remove(); }, 800);
                });
            }
        }

        // 2. 엔진 계산 (백그라운드 틱 시뮬레이션)
        const preBattlePlayerBoard = JSON.parse(JSON.stringify(buffedPlayerBoard));
        const playerAugments = this.app.state.augments.map(a => a.id);
        const engine = new BattleEngine(buffedPlayerBoard, buffedEnemyBoard, playerAugments);
        app.engine = engine; // 실시간 정보 조회용 참조 저장
        const logs = engine.run();

        // 3. 리플레이 시각화 재생
        const fxCanvas = document.getElementById('fx-canvas');
        const renderer = new BattleRenderer(logs, document.getElementById('battle-board'), fxCanvas);
        this.app.renderer = renderer; // 통계창에서 접근할 수 있도록 저장
        renderer.play((winner, endLog) => {
            const currentGold = this.app.state.gold;
            const st = this.app.state;

            let interest = Math.floor(currentGold / 10);
            if (!st.richFoundation) interest = Math.min(5, interest);

            // 연승/연패 보너스 계산 함수
            const getStreakBonus = (count) => {
                if (count >= 7) return 3;
                if (count >= 5) return 2;
                if (count >= 3) return 1;
                return 0;
            };

            let title = '';
            let msg = '';
            let type = 'win';
            let onConfirm = null;

            if (winner === 'player') {
                st.winStreak++;
                st.lossStreak = 0;
                const streakBonus = getStreakBonus(st.winStreak);

                let totalGold = 5 + interest + streakBonus;
                if (st.honorStudent) { totalGold += 1; this.app.addExp(1); }
                if (st.snackShop) { totalGold += 1; }
                if (st.lostAndFound && Math.random() < 0.3) {
                    const pool = UNIT_POOL.filter(u => u.tier === 1);
                    this.app.addToBench({ ...pool[Math.floor(Math.random() * pool.length)] });
                }

                st.gold += totalGold;
                title = '승리!';
                msg = `<span style="color:#2563eb; font-weight:800;">⚔️ 전투 승리!</span> (+${totalGold}G)`;
                if (st.winStreak >= 3) msg += `<br><span style="color:#e84393;">🔥 ${st.winStreak}연승 보너스 +${streakBonus}G</span>`;
            } else if (winner === 'draw') {
                // 무승부: 연승/연패 초기화, 체력 피해 없음
                st.winStreak = 0;
                st.lossStreak = 0;
                let totalGold = 3 + interest;
                if (st.snackShop) { totalGold += 1; }
                st.gold += totalGold;
                title = '무승부!';
                type = 'draw';
                msg = `<span style="color:#f39c12; font-weight:800;">⚡ 연장전 무승부!</span><br><span style="font-size:0.9rem; color:#636e72;">양쪽 모두 생존 — 체력 피해 없음 (+${totalGold}G)</span>`;
            } else if (winner === 'enemy') {
                st.lossStreak++;
                st.winStreak = 0;
                const streakBonus = getStreakBonus(st.lossStreak);

                let totalGold = 3 + interest + streakBonus;
                if (st.snackShop) { totalGold += 1; }
                st.gold += totalGold;

                // 가변 패배 데미지: 기본 2 + 살아남은 적 수 + 현재 월드 번호
                const survivingEnemies = endLog ? (endLog.survivingEnemies || 0) : 0;
                let dmg = 2 + survivingEnemies + st.stage[0];

                if (st.invincibleRounds > 0) {
                    dmg = 0;
                    st.invincibleRounds--;
                    title = '체력 보존!';
                    type = 'save';
                    msg = `<span style="color:#0984e3; font-weight:800;">😭 패배했지만 [지각 면제권]으로 체력 보존!</span><br><span style="font-size:0.9rem; color:#636e72;">(남은 무적: ${st.invincibleRounds}회)</span>`;
                    if (st.lossStreak >= 3) msg += `<br><span style="color:#00cec9;">💧 ${st.lossStreak}연패 보너스 +${streakBonus}G</span>`;
                } else {
                    if (st.lateLeave) dmg = Math.floor(dmg / 2);
                    st.hp -= dmg;
                    if (st.hp <= 0) {
                        title = '게임 오버';
                        type = 'gameover';
                        msg = `<span style="color:#d63031; font-weight:800; font-size:1.3rem;">💀 체력이 0이 되었습니다.</span>`;
                        onConfirm = () => location.reload();
                    } else {
                        title = '패배...';
                        type = 'loss';
                        msg = `<span style="color:#d63031; font-weight:800;">😭 전투 패배...</span><br><span style="font-size:0.9rem; color:#636e72;">(-${dmg} HP, 적 ${survivingEnemies}명 생존) (+${totalGold}G)</span>`;
                        if (st.lossStreak >= 3) msg += `<br><span style="color:#00cec9;">💧 ${st.lossStreak}연패 보너스 +${streakBonus}G</span>`;
                    }
                }
            }

            // PVE 라운드 (x-5) 종료 시 보상 (승패 상관없이 지급)
            if (st.stage[1] === 5 && type !== 'gameover') {
                this.app.giveRandomBaseItem();
                this.app.giveRandomBaseItem();
                msg += `<br><br><div style="background:rgba(241,196,15,0.15); padding:12px; border-radius:12px; border:1px solid rgba(241,196,15,0.4);"><span style="font-size:1.5rem;">🎉</span> <strong style="color:#d35400;">기말고사(PVE) 완료!</strong><br><span style="color:#34495e; font-size:0.95rem;">무작위 기본 아이템 2개를 획득했습니다!</span></div>`;
            }

            // --- 전투 MVP 계산 ---
            if (this.app.state.dpsStats && type !== 'gameover' && type !== 'save') {
                let mvp = null;
                let maxScore = 0;
                
                for (let idx in this.app.state.dpsStats) {
                    const stat = this.app.state.dpsStats[idx];
                    if (stat.team === 'player') {
                        const score = stat.damage + stat.tank + stat.heal;
                        if (score > maxScore) {
                            maxScore = score;
                            mvp = stat;
                        }
                    }
                }
                
                if (mvp && maxScore > 0) {
                    msg += `<div style="background:rgba(255,255,255,0.9); padding:10px; border-radius:8px; text-align:center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 2px solid #ffd700; margin-top: 15px;">
                        <div style="font-size:0.85rem; color:#64748b; font-weight:bold; margin-bottom:4px;">🏆 우수 학생 (MVP)</div>
                        <div style="font-size:1.2rem; color:#1e293b; font-weight:900;">${mvp.name}</div>
                        <div style="font-size:0.85rem; margin-top:4px;">
                            <span style="color:#ef4444">⚔️${Math.round(mvp.damage)}</span> &nbsp; <span style="color:#64748b">🛡️${Math.round(mvp.tank)}</span> &nbsp; <span style="color:#10b981">💉${Math.round(mvp.heal)}</span>
                        </div>
                        <div style="font-size:0.9rem; color:#d81b60; font-weight:bold; margin-top:4px;">종합 점수: ${Math.round(maxScore)}점</div>
                    </div>`;
                }
            }
            // ------------------

            this.app.showResultModal(title, msg, type, onConfirm);

            if (type === 'gameover') return;

            // 기본 경험치 +2 자동 지급
            this.app.addExp(2);

            // 라운드/스테이지 증가
            this.app.state.stage[1]++;
            if (this.app.state.stage[1] > 5) {
                this.app.state.stage[0]++;
                this.app.state.stage[1] = 1;
            }

            // 전투 종료 시 도적의 장갑 아이템 리롤
            this.app.state.board.forEach(u => {
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
                    const originalUnit = this.app.state.board[boardIdx];
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
            this.app.isBattlePhase = false; // 전투 상태 플래그 해제
            window.isBattlePhase = false; // 글로벌 플래그 동기화
            
            this.app.spawnEnemyBoard(); // 다음 라운드 적 사전 배치
            this.app.updateHeader();

            this.app.renderUnits(); // 적 보드 및 아군 보드 재렌더링

            // 보드의 유닛들 다시 드래그 가능하게
            document.querySelectorAll('.board-cell .unit-character').forEach(u => u.draggable = true);

            // 상점 무료 리롤 및 잠금 해제 처리
            if (st.shopLocked) {
                this.app.renderShop(); // 잠겼을 때는 내용 유지
                st.shopLocked = false;       // 라운드 지나면 잠금 해제
                const lockBtn = document.getElementById('btn-lock-shop');
                if (lockBtn) {
                    lockBtn.innerText = "🔓 상점 열림";
                    lockBtn.style.background = "#607d8b";
                }
            } else {
                this.app.refreshShop(true); // 잠기지 않았을 때는 항상 새 상점으로 무료 리롤!
            }

            // 새 스테이지 시작 시 증강체 자동 팝업 (2-1, 3-1, 4-1)
            if (st.stage[1] === 1 && [2, 3, 4].includes(st.stage[0])) {
                const tierNeeded = st.stage[0] === 2 ? 'silver' : (st.stage[0] === 3 ? 'gold' : 'prismatic');
                // 만약 아직 선택하지 않았다면 팝업
                if (!st.augments.some(a => a.tier === tierNeeded)) {
                    this.app.showAugmentSelection(tierNeeded);
                }
            }

            // 매점 타임 팝업 (x-3 라운드 시작 시)
            if (st.stage[1] === 3) {
                this.app.showStoreTimeSelection();
            }
        });
    }
}
