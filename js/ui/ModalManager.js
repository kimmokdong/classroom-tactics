export class ModalManager {
    constructor(gameApp) {
        this.app = gameApp;
        this.lastFocusedElement = null;
        this.onKeydown = event => {
            if (event.key === 'Escape') this.closeResultModal();
            if (event.key !== 'Tab') return;
            const modal = document.getElementById('result-modal');
            const focusable = [...modal.querySelectorAll('button:not([disabled]), [href], select, [tabindex]:not([tabindex="-1"])')];
            if (!focusable.length) return;
            const current = focusable.indexOf(document.activeElement);
            const next = event.shiftKey ? (current <= 0 ? focusable.length - 1 : current - 1) : (current === focusable.length - 1 ? 0 : current + 1);
            event.preventDefault();
            focusable[next].focus();
        };
    }

    closeResultModal() {
        const modal = document.getElementById('result-modal');
        if (modal.style.display === 'none') return;
        modal.style.display = 'none';
        document.removeEventListener('keydown', this.onKeydown);
        this.lastFocusedElement?.focus?.();
        const onConfirm = this.onConfirm;
        this.onConfirm = null;
        if (onConfirm) onConfirm();
    }

    showResultModal(title, msg, type, onConfirm) {
        const modal = document.getElementById('result-modal');
        const titleEl = document.getElementById('result-title');
        const msgEl = document.getElementById('result-msg');
        const iconEl = document.getElementById('result-icon');
        const btn = document.getElementById('btn-result-ok');

        titleEl.innerText = title;
        msgEl.innerHTML = msg;

        if (type === 'win') {
            iconEl.innerText = '🏆';
            titleEl.style.color = '#2563eb';
            btn.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
            btn.style.boxShadow = '0 4px 15px rgba(37,99,235,0.4)';
        } else if (type === 'loss' || type === 'gameover') {
            iconEl.innerText = '💀';
            titleEl.style.color = '#d63031';
            btn.style.background = 'linear-gradient(135deg, #ff7675, #d63031)';
            btn.style.boxShadow = '0 4px 15px rgba(214,48,49,0.4)';
        } else {
            iconEl.innerText = '🛡️';
            titleEl.style.color = '#0984e3';
            btn.style.background = 'linear-gradient(135deg, #74b9ff, #0984e3)';
            btn.style.boxShadow = '0 4px 15px rgba(9,132,227,0.4)';
        }

        this.lastFocusedElement = document.activeElement;
        this.onConfirm = onConfirm;
        btn.onclick = () => this.closeResultModal();

        modal.style.display = 'flex';
        document.addEventListener('keydown', this.onKeydown);
        btn.focus();
    }
}
