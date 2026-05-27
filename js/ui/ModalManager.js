export class ModalManager {
    constructor(gameApp) {
        this.app = gameApp;
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

        btn.onclick = () => {
            modal.style.display = 'none';
            if (onConfirm) onConfirm();
        };

        modal.style.display = 'flex';
    }
}
