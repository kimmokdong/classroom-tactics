import { ITEMS } from '../items.js';

export class GuideRenderer {
    constructor(gameApp) {
        this.app = gameApp;
        this.init();
    }

    init() {
    // --- Guide Modal Setup ---
    const btnGuide = document.getElementById('btn-guide');
    const guideModal = document.getElementById('guide-modal');
    const btnCloseGuide = document.getElementById('btn-close-guide');
    const guideTabBtns = document.querySelectorAll('.guide-tab-btn');
    const guideTabContents = document.querySelectorAll('.guide-tab-content');

    if (btnGuide) {
        btnGuide.onclick = () => {
            guideModal.style.display = 'flex';
            renderGuideItemMatrix();
        };
    }
    if (btnCloseGuide) {
        btnCloseGuide.onclick = () => {
            guideModal.style.display = 'none';
        };
    }

    guideTabBtns.forEach(btn => {
        btn.onclick = () => {
            guideTabBtns.forEach(b => b.classList.remove('active'));
            guideTabContents.forEach(c => c.style.display = 'none');

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.style.display = 'block';
        };
    });

    // --- Guide Hover Interactions ---
    const guideHoverTriggers = document.querySelectorAll('.guide-hover-trigger');
    const guideDemoUnit = document.getElementById('guide-unit-demo');
    if (guideDemoUnit && guideHoverTriggers.length > 0) {
        guideHoverTriggers.forEach(trigger => {
            trigger.addEventListener('mouseenter', () => {
                const effectClass = trigger.getAttribute('data-show');
                if (effectClass) {
                    guideDemoUnit.classList.add(`show-${effectClass}`);
                }
            });
            trigger.addEventListener('mouseleave', () => {
                const effectClass = trigger.getAttribute('data-show');
                if (effectClass) {
                    guideDemoUnit.classList.remove(`show-${effectClass}`);
                }
            });
        });
    }

    function renderGuideItemMatrix() {
        const matrixContainer = document.getElementById('guide-item-matrix');
        if (!matrixContainer || matrixContainer.querySelector('table')) return;

        const basicItems = ITEMS.filter(it => it.type === 'base');
        const combinedItems = ITEMS.filter(it => it.type === 'combined');

        const getIcon = (itemId) => this.app ? this.app.getIconForItem(itemId) : '❓';

        const table = document.createElement('table');
        table.className = 'item-matrix-table';
        table.style.borderCollapse = 'collapse';
        table.style.margin = '0 auto';
        table.style.background = 'rgba(255, 255, 255, 0.9)';
        table.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
        table.style.borderRadius = '12px';
        table.style.overflow = 'hidden';

        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');

        const thEmpty = document.createElement('th');
        thEmpty.style.padding = '4px';
        thEmpty.style.border = '1px solid #cbd5e1';
        thEmpty.style.background = '#e2e8f0';
        trHead.appendChild(thEmpty);

        basicItems.forEach((it, colIndex) => {
            const th = document.createElement('th');
            th.dataset.headerCol = colIndex;
            th.style.padding = '4px';
            th.style.border = '1px solid #cbd5e1';
            th.style.background = '#e2e8f0';
            th.style.cursor = 'help';
            th.style.fontSize = '1.4rem';
            th.style.textAlign = 'center';
            th.style.width = '40px';
            th.style.height = '40px';
            th.style.transition = 'background-color 0.2s';
            th.innerHTML = getIcon(it.id);

            th.onmouseenter = (e) => {
                const html = `<div style="font-weight:bold; color:#475569; font-size:1rem; margin-bottom:4px;">${getIcon(it.id)} ${it.name} <span style="font-size:0.75rem; color:#666;">${this.app ? this.app.formatItemStats(it.stats) : ''}</span></div><div style="color:#475569;">${it.desc}</div>`;
                if (this.app) this.app.showCustomTooltip(e, html);

                const cells = table.querySelectorAll(`td[data-col="${colIndex}"]`);
                cells.forEach(c => c.style.backgroundColor = 'rgba(0, 0, 0, 0.08)');
            };
            th.onmouseleave = () => {
                if (this.app) this.app.hideCustomTooltip();

                const cells = table.querySelectorAll(`td[data-col="${colIndex}"]`);
                cells.forEach(c => c.style.backgroundColor = 'transparent');
            };

            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        basicItems.forEach((rowItem, rowIndex) => {
            const tr = document.createElement('tr');

            const th = document.createElement('th');
            th.dataset.headerRow = rowIndex;
            th.style.padding = '4px';
            th.style.border = '1px solid #cbd5e1';
            th.style.background = '#e2e8f0';
            th.style.cursor = 'help';
            th.style.fontSize = '1.4rem';
            th.style.textAlign = 'center';
            th.style.width = '40px';
            th.style.height = '40px';
            th.style.transition = 'background-color 0.2s';
            th.innerHTML = getIcon(rowItem.id);

            th.onmouseenter = (e) => {
                const html = `<div style="font-weight:bold; color:#475569; font-size:1rem; margin-bottom:4px;">${getIcon(rowItem.id)} ${rowItem.name} <span style="font-size:0.75rem; color:#666;">${this.app ? this.app.formatItemStats(rowItem.stats) : ''}</span></div><div style="color:#475569;">${rowItem.desc}</div>`;
                if (this.app) this.app.showCustomTooltip(e, html);

                const cells = table.querySelectorAll(`td[data-row="${rowIndex}"]`);
                cells.forEach(c => c.style.backgroundColor = 'rgba(0, 0, 0, 0.08)');
            };
            th.onmouseleave = () => {
                if (this.app) this.app.hideCustomTooltip();

                const cells = table.querySelectorAll(`td[data-row="${rowIndex}"]`);
                cells.forEach(c => c.style.backgroundColor = 'transparent');
            };

            tr.appendChild(th);

            basicItems.forEach((colItem, colIndex) => {
                const comboItem = combinedItems.find(c => {
                    if (!c.recipe) return false;
                    if (rowItem.id === colItem.id) return c.recipe[0] === rowItem.id && c.recipe[1] === colItem.id;
                    return c.recipe.includes(rowItem.id) && c.recipe.includes(colItem.id);
                });

                const td = document.createElement('td');
                td.dataset.row = rowIndex;
                td.dataset.col = colIndex;
                td.style.padding = '4px';
                td.style.border = '1px solid #cbd5e1';
                td.style.textAlign = 'center';
                td.style.cursor = 'help';
                td.style.transition = 'background-color 0.1s, transform 0.1s';

                if (comboItem) {
                    td.style.fontSize = '1.4rem';
                    td.style.backgroundColor = '#fef9c3';
                    td.dataset.defaultBg = '#fef9c3';
                    td.innerHTML = getIcon(comboItem.id);

                    td.onmouseenter = (e) => {
                        const rowHeader = table.querySelector(`th[data-header-row="${rowIndex}"]`);
                        const colHeader = table.querySelector(`th[data-header-col="${colIndex}"]`);
                        if (rowHeader) rowHeader.style.backgroundColor = 'rgba(253, 224, 71, 0.5)';
                        if (colHeader) colHeader.style.backgroundColor = 'rgba(253, 224, 71, 0.5)';

                        const cellsRow = table.querySelectorAll(`td[data-row="${rowIndex}"]`);
                        cellsRow.forEach(c => c.style.backgroundColor = 'rgba(253, 224, 71, 0.3)');
                        const cellsCol = table.querySelectorAll(`td[data-col="${colIndex}"]`);
                        cellsCol.forEach(c => c.style.backgroundColor = 'rgba(253, 224, 71, 0.3)');

                        td.style.backgroundColor = 'rgba(250, 204, 21, 0.6)';
                        td.style.transform = 'scale(1.15)';
                        td.style.zIndex = '10';
                        td.style.position = 'relative';

                        const html = `<div style="font-weight:bold; color:#d97706; font-size:1rem; margin-bottom:4px;">${getIcon(comboItem.id)} ${comboItem.name} <span style="font-size:0.75rem; color:#666;">${this.app ? this.app.formatItemStats(comboItem.stats) : ''}</span></div><div style="color:#475569;">${comboItem.desc}</div>`;
                        if (this.app) this.app.showCustomTooltip(e, html);
                    };
                    td.onmouseleave = () => {
                        const rowHeader = table.querySelector(`th[data-header-row="${rowIndex}"]`);
                        const colHeader = table.querySelector(`th[data-header-col="${colIndex}"]`);
                        if (rowHeader) rowHeader.style.backgroundColor = '#e2e8f0';
                        if (colHeader) colHeader.style.backgroundColor = '#e2e8f0';

                        const cellsRow = table.querySelectorAll(`td[data-row="${rowIndex}"]`);
                        cellsRow.forEach(c => c.style.backgroundColor = c.dataset.defaultBg || 'transparent');
                        const cellsCol = table.querySelectorAll(`td[data-col="${colIndex}"]`);
                        cellsCol.forEach(c => c.style.backgroundColor = c.dataset.defaultBg || 'transparent');

                        td.style.transform = 'scale(1)';
                        td.style.zIndex = '1';
                        if (this.app) this.app.hideCustomTooltip();
                    };
                } else {
                    td.innerHTML = '';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        matrixContainer.innerHTML = '';
        matrixContainer.appendChild(table);
    }

    }
}
