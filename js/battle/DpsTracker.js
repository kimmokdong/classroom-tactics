/**
 * DpsTracker - 전투 통계(딜량/탱킹/힐량) 수집 및 UI 렌더링
 */
export class DpsTracker {
    constructor() {
        this.stats = {};
    }

    /**
     * 게임 상태의 dpsStats와 동기화
     */
    syncWithGameState() {
        if (window.gameApp && window.gameApp.state) {
            if (!window.gameApp.state.dpsStats) window.gameApp.state.dpsStats = {};
            this.stats = window.gameApp.state.dpsStats;
        }
    }

    reset() {
        this.stats = {};
    }

    /**
     * 유닛 등록 (spawn 시)
     */
    registerUnit(index, name, team) {
        this.stats[index] = {
            name: name,
            team: team,
            damage: 0, tank: 0, heal: 0
        };
    }

    /**
     * DOM에서 유닛 정보를 읽어 자동 등록
     */
    ensureStatEntry(idx, cell) {
        if (idx === undefined || this.stats[idx]) return;
        if (!cell) return;
        const uDiv = cell.querySelector('.unit-character');
        if (!uDiv) return;
        this.stats[idx] = {
            name: uDiv.querySelector('.unit-name')?.innerText || `Unit_${idx}`,
            team: uDiv.classList.contains('is-enemy') ? 'enemy' : 'player',
            damage: 0, tank: 0, heal: 0
        };
    }

    /**
     * 피해 기록
     */
    recordDamage(sourceIdx, targetIdx, amount) {
        if (sourceIdx !== undefined && this.stats[sourceIdx]) {
            this.stats[sourceIdx].damage += amount || 0;
        }
        if (targetIdx !== undefined && this.stats[targetIdx]) {
            this.stats[targetIdx].tank += amount || 0;
        }
    }

    /**
     * 힐 기록
     */
    recordHeal(targetIdx, amount, cell) {
        if (this.stats[targetIdx]) {
            this.stats[targetIdx].heal += amount || 0;
        } else if (cell) {
            const uDiv = cell.querySelector('.unit-character');
            if (uDiv) {
                this.stats[targetIdx] = {
                    name: uDiv.querySelector('.unit-name')?.innerText || `Unit_${targetIdx}`,
                    team: uDiv.classList.contains('is-enemy') ? 'enemy' : 'player',
                    damage: 0, tank: 0, heal: amount || 0
                };
            }
        }
    }

    /**
     * 유닛 이동 시 통계 인덱스도 이동
     */
    moveUnit(fromIdx, toIdx) {
        if (this.stats[fromIdx]) {
            this.stats[toIdx] = this.stats[fromIdx];
            delete this.stats[fromIdx];
        }
    }

    /**
     * DPS 통계 UI 렌더링
     */
    renderUI() {
        if (!this.stats) return;
        const dpsSelect = document.getElementById('dps-type-select');
        if (!dpsSelect) return;
        const statType = dpsSelect.value; // 'damage', 'tank', 'heal'
        
        let maxVal = 1;
        const playerStats = [];
        const enemyStats = [];

        for (let idx in this.stats) {
            const st = this.stats[idx];
            const val = st[statType] || 0;
            if (val > maxVal) maxVal = val;
            if (st.team === 'player') playerStats.push(st);
            else enemyStats.push(st);
        }

        playerStats.sort((a, b) => (b[statType] || 0) - (a[statType] || 0));
        enemyStats.sort((a, b) => (b[statType] || 0) - (a[statType] || 0));

        const renderList = (containerId, list, color) => {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';
            if (list.length === 0) {
                container.innerHTML = `<div style="font-size:0.8rem;color:#94a3b8;text-align:center;padding:8px;">데이터 없음</div>`;
                return;
            }
            list.slice(0, 6).forEach(st => {
                const val = st[statType] || 0;
                const pct = maxVal > 1 ? Math.max(2, (val / maxVal) * 100) : 2;
                container.innerHTML += `
                    <div style="display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #334155;">
                            <span style="font-weight:500;">${st.name}</span>
                            <span style="font-weight: bold; color:#1e293b;">${Math.round(val)}</span>
                        </div>
                        <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius:4px; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                `;
            });
        };

        renderList('dps-list-player', playerStats, statType === 'heal' ? '#10b981' : (statType === 'tank' ? '#94a3b8' : '#3b82f6'));
        renderList('dps-list-enemy', enemyStats, statType === 'heal' ? '#059669' : (statType === 'tank' ? '#64748b' : '#ef4444'));
    }
}
