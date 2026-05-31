export class HudRenderer {
    constructor(gameApp) {
        this.app = gameApp;
    }

    updateHeader() {
        document.getElementById('player-hp').innerText = this.app.state.hp;
        document.getElementById('player-gold').innerText = this.app.state.gold;
        let interest = Math.floor(this.app.state.gold / 10);
        let maxInterest = 5;

        // 경제부 시너지 반영
        const playerSynergies = this.app.getSynergyData(this.app.state.board);
        const ecoCount = playerSynergies.clubs['경제부'] || 0;
        if (ecoCount > 0) {
            // SYNERGIES를 임포트하지 않았으므로 앱의 함수로 직접 처리 불가능하다면?
            // 아니면 그냥 단순하게 조건문으로 처리: 1->7, 2->999
            if (ecoCount >= 2) maxInterest = 999;
            else if (ecoCount >= 1) maxInterest = 7;
        }

        if (this.app.state.richFoundation) maxInterest = 999;
        interest = Math.min(maxInterest, interest);

        const streakCount = this.app.state.winStreak || this.app.state.lossStreak;
        let streakBonus = 0;
        if (streakCount >= 7) streakBonus = 3;
        else if (streakCount >= 5) streakBonus = 2;
        else if (streakCount >= 3) streakBonus = 1;

        let streakText = '연승/연패: 없음';
        if (this.app.state.winStreak >= 2) streakText = `🔥 ${this.app.state.winStreak}연승 (+${streakBonus}G)`;
        else if (this.app.state.lossStreak >= 2) streakText = `💧 ${this.app.state.lossStreak}연패 (+${streakBonus}G)`;

        document.getElementById('interest-info').innerText = `예상 이자: +${interest}G`;
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
            for (let r = 1; r <= 5; r++) {
                let icon = '⚔️';
                if (r === 3) icon = '🏪'; // 매점 타임
                if (r === 5) icon = '👹'; // 기말고사(PVE)

                let opacity = r < this.app.state.stage[1] ? '0.3' : (r === this.app.state.stage[1] ? '1' : '0.5');
                let scale = r === this.app.state.stage[1] ? 'scale(1.3)' : 'scale(1)';
                let border = r === this.app.state.stage[1] ? 'border-bottom: 3px solid #fef08a;' : '';

                html += `<div style="font-size:1.4rem; opacity:${opacity}; transform:${scale}; transition:all 0.3s; ${border}">${icon}</div>`;
            }
            timelineEl.innerHTML = html;
        }
    }
}
