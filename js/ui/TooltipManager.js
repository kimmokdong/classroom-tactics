export class TooltipManager {
    constructor() {
        this.initObserver();
    }

    initObserver() {
        const tooltip = document.getElementById('tooltip');
        if (tooltip) {
            const observer = new MutationObserver(() => {
                if (tooltip.style.display === 'block') {
                    const rect = tooltip.getBoundingClientRect();
                    let left = parseInt(tooltip.style.left || 0);
                    let top = parseInt(tooltip.style.top || 0);
                    let adjusted = false;

                    if (left + rect.width > window.innerWidth) {
                        left = window.innerWidth - rect.width - 20;
                        adjusted = true;
                    }
                    if (top + rect.height > window.innerHeight) {
                        top = window.innerHeight - rect.height - 20;
                        adjusted = true;
                    }

                    if (adjusted) {
                        observer.disconnect();
                        tooltip.style.left = left + 'px';
                        tooltip.style.top = top + 'px';
                        observer.observe(tooltip, { attributes: true, attributeFilter: ['style'] });
                    }
                }
            });
            observer.observe(tooltip, { attributes: true, attributeFilter: ['style'] });
        }
    }

    showCustomTooltip(e, html, isInteractive = false) {
        const tooltip = document.getElementById('tooltip');
        if (!tooltip) return;

        if (isInteractive) {
            window.isContextMenuOpen = true;
            tooltip.style.pointerEvents = 'auto';
        } else {
            tooltip.style.pointerEvents = 'none';
        }

        tooltip.innerHTML = html;
        tooltip.style.display = 'block';

        // Wait a frame for offsetWidth to update
        requestAnimationFrame(() => {
            let left = e.clientX + 15;
            let top = e.clientY + 15;
            if (left + tooltip.offsetWidth > window.innerWidth) left = window.innerWidth - tooltip.offsetWidth - 10;
            if (top + tooltip.offsetHeight > window.innerHeight) top = window.innerHeight - tooltip.offsetHeight - 10;

            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        });
    }

    hideCustomTooltip() {
        if (window.isContextMenuOpen) return;
        const tooltip = document.getElementById('tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }
}
