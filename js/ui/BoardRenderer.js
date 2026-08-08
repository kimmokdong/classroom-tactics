export class BoardRenderer {
    constructor(gameApp) {
        this.app = gameApp;
    }

    renderBoard() {
        const boardEl = document.getElementById('battle-board');
        const benchEl = document.getElementById('bench-board');

        boardEl.innerHTML = '';
        benchEl.innerHTML = '';

        for (let i = 0; i < 48; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell board-cell';
            cell.dataset.index = i;
            if (i >= 24) {
                this.setupDropZone(cell, 'board');
            } else {
                cell.style.background = 'rgba(255, 100, 100, 0.05)';
                cell.style.border = '2px dashed rgba(255, 0, 0, 0.2)';
            }
            boardEl.appendChild(cell);
        }

        for (let i = 0; i < 10; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell bench-cell';
            cell.dataset.index = i;
            this.setupDropZone(cell, 'bench');
            benchEl.appendChild(cell);
        }
    }

    setupDropZone(cell, targetType) {
        cell.tabIndex = -1;
        cell.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                cell.click();
            }
        };
        cell.onclick = (e) => {
            if (e.target.closest('.unit-character') || window.isBattlePhase) return;
            const targetIdx = parseInt(cell.dataset.index);
            const adjustedIdx = targetType === 'board' ? targetIdx - 24 : targetIdx;
            const targetArray = targetType === 'board' ? this.app.state.board : this.app.state.bench;

            if (this.app.selectedInventoryItem !== null) {
                const unit = targetArray[adjustedIdx];
                if (!unit) {
                    this.app.showFeedback?.('아이템은 유닛이 있는 칸에 장착할 수 있습니다.', 'warning');
                    return;
                }
                if (this.app.giveItemToUnit(this.app.selectedInventoryItem, unit)) {
                    this.app.clearInteractionSelection();
                }
                return;
            }

            const selected = this.app.selectedUnit;
            if (selected && this.app.moveUnit(selected.type, selected.index, targetType, targetIdx)) {
                this.app.clearInteractionSelection();
                this.app.updateOnboarding?.();
            }
        };
        cell.ondragover = (e) => e.preventDefault();
        cell.ondrop = (e) => {
            e.preventDefault();
            const itemIdxStr = e.dataTransfer.getData('itemIdx');
            if (itemIdxStr) {
                e.stopPropagation();
                const targetIdx = parseInt(cell.dataset.index);
                const isBoard = targetType === 'board';
                const arr = isBoard ? this.app.state.board : this.app.state.bench;
                const idx = isBoard ? targetIdx - 24 : targetIdx;
                const unit = arr[idx];
                if (unit) {
                    this.app.giveItemToUnit(parseInt(itemIdxStr), unit);
                }
                return;
            }

            const sourceType = e.dataTransfer.getData('sourceType');
            const sourceIdx = parseInt(e.dataTransfer.getData('sourceIdx'));
            const targetIdx = parseInt(cell.dataset.index);
            if (sourceType) this.app.moveUnit(sourceType, sourceIdx, targetType, targetIdx);
        };
    }
}
