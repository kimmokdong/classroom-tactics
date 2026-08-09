import { getIncomePreview, getStreakBonus } from '../gameplayInsights.js';

export class HudRenderer {
    constructor(gameApp) {
        this.app = gameApp;
    }

    updateHeader() {
        document.getElementById('player-hp').innerText = this.app.state.hp;
        document.getElementById('player-gold').innerText = this.app.state.gold;
        let maxInterest = 5;

        // 경제부 시너지 반영
        const playerSynergies = this.app.getSynergyData(this.app.state.board);
        const ecoCount = playerSynergies.clubs['경제부'] || 0;
        const ecoDefinition = this.app.SYNERGIES?.clubs?.['경제부'];
        if (ecoCount > 0 && ecoDefinition) {
            const ecoLevel = this.app.getActiveSynergyLevel(
                ecoCount,
                Object.keys(ecoDefinition.levels),
                ecoDefinition.exactMatch
            );
            maxInterest = ecoDefinition.levels[ecoLevel]?.extraInterestCap || maxInterest;
        }

        if (this.app.state.richFoundation) maxInterest = 999;
        const [world, round] = this.app.state.stage;
        const isPve = round === 5 || (Boolean(this.app.multiplayerManager?.isActive) && world === 1 && round <= 3);
        const income = getIncomePreview(this.app.state, { maxInterest, isPve });

        const streakCount = this.app.state.winStreak || this.app.state.lossStreak;
        const streakBonus = getStreakBonus(streakCount);

        let streakText = '연승/연패: 없음';
        if (this.app.state.winStreak >= 2) streakText = `🔥 ${this.app.state.winStreak}연승 (+${streakBonus}G)`;
        else if (this.app.state.lossStreak >= 2) streakText = `💧 ${this.app.state.lossStreak}연패 (+${streakBonus}G)`;

        const interestEl = document.getElementById('interest-info');
        interestEl.innerText = income.isPve
            ? `PVE 수입: 클리어 +${income.winTotal}G · 실패 +${income.lossTotal}G`
            : `다음 수입: 승리 +${income.winTotal}G · 패배 +${income.lossTotal}G`;
        interestEl.title = `기본 5G · 현재 이자 +${income.currentInterest}G · 승리 보너스 +1G · 연속 보너스 최대 +3G`;
        const streakEl = document.getElementById('streak-info');
        if (streakEl) streakEl.innerText = streakText;

        const nextExp = this.app.getMaxExp(this.app.state.level) || 'MAX';
        const currentBoardCount = this.app.state.board.filter(u => u !== null).length;
        document.getElementById('player-level').innerHTML = `${this.app.state.level} <span style="font-size:0.75rem; color:#7f8c8d; font-weight:bold;">(${this.app.state.exp}/${nextExp})</span>`;
        document.getElementById('board-capacity').innerText = `배치: ${currentBoardCount}/${this.app.state.level}`;

        // 시너지나 기타 정보가 있으면 계속 업데이트
        document.getElementById('current-stage').innerText = `${this.app.state.stage[0]}-${this.app.state.stage[1]}`;

        // 스테이지 라운드 타임라인 UI 업데이트
        const timelineEl = document.getElementById('stage-timeline');
        if (timelineEl) {
            let html = '';
            const isMultiplayerOpening = Boolean(this.app.multiplayerManager?.isActive)
                && this.app.state.stage[0] === 1;
            const maxRound = isMultiplayerOpening ? 3 : 5;
            const openingIcons = ['☁️', '🧽', '📄'];
            for (let r = 1; r <= maxRound; r++) {
                let icon = '⚔️';
                if (isMultiplayerOpening) icon = openingIcons[r - 1];
                else if (r === 3) icon = '🏪'; // 매점 타임
                else if (r === 5) icon = '👹'; // PVE

                let opacity = r < this.app.state.stage[1] ? '0.3' : (r === this.app.state.stage[1] ? '1' : '0.5');
                let scale = r === this.app.state.stage[1] ? 'scale(1.3)' : 'scale(1)';
                let border = r === this.app.state.stage[1] ? 'border-bottom: 3px solid #fef08a;' : '';

                html += `<div style="font-size:1.4rem; opacity:${opacity}; transform:${scale}; transition:all 0.3s; ${border}">${icon}</div>`;
            }
            timelineEl.innerHTML = html;
        }

        // 리롤 버튼 상태 업데이트
        const btnReroll = document.getElementById('btn-reroll');
        if (btnReroll) {
            if (this.app.state.freeRerolls && this.app.state.freeRerolls > 0) {
                btnReroll.innerText = `🔄 무료 리롤 (${this.app.state.freeRerolls})`;
            } else {
                btnReroll.innerText = `🔄 리롤 (2G)`;
            }
        }
    }
}
