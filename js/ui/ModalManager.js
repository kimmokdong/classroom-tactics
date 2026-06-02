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

    showEventModal(eventData, onSelect) {
        const modal = document.getElementById('event-modal');
        const titleEl = document.getElementById('event-title');
        const subtitleEl = document.getElementById('event-subtitle');
        const cardsContainer = document.getElementById('event-cards-container');
        const singleActionDiv = document.getElementById('event-single-action');
        const btnOk = document.getElementById('btn-event-ok');

        titleEl.innerText = eventData.name;
        subtitleEl.innerText = eventData.desc;
        cardsContainer.innerHTML = '';
        singleActionDiv.style.display = 'none';

        if (eventData.type === 'choice') {
            eventData.choices.forEach((choice, index) => {
                const card = document.createElement('div');
                card.className = 'augment-card'; 
                card.style.cssText = `
                    background: linear-gradient(145deg, #ffffff, #f0f4f8);
                    border: 2px solid #e2e8f0; border-radius: 16px; padding: 20px;
                    width: 250px; text-align: center; cursor: pointer; transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.05); display: flex; flex-direction: column; align-items: center;
                `;
                card.onmouseover = () => { card.style.transform = 'translateY(-5px)'; card.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)'; card.style.borderColor = '#3498db'; };
                card.onmouseout = () => { card.style.transform = 'none'; card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)'; card.style.borderColor = '#e2e8f0'; };
                
                card.innerHTML = `
                    <div style="font-size: 3rem; margin-bottom: 15px;">${choice.icon || '❓'}</div>
                    <h3 style="color: #2c3e50; font-size: 1.3rem; margin-bottom: 10px; font-weight: 800;">${choice.name}</h3>
                    <p style="color: #475569; font-size: 0.95rem; line-height: 1.5; margin-bottom: 15px; flex-grow: 1;">${choice.desc}</p>
                `;
                card.onclick = () => {
                    modal.style.display = 'none';
                    if (onSelect) onSelect(choice);
                };
                cardsContainer.appendChild(card);
            });
        } else {
            const card = document.createElement('div');
            card.style.cssText = `
                background: linear-gradient(145deg, #ffffff, #f0f4f8);
                border: 2px solid #e2e8f0; border-radius: 16px; padding: 20px;
                width: 300px; text-align: center; display: flex; flex-direction: column; align-items: center;
            `;
            card.innerHTML = `
                <div style="font-size: 4rem; margin-bottom: 15px;">${eventData.icon || '⚠️'}</div>
                <h3 style="color: #e74c3c; font-size: 1.4rem; margin-bottom: 10px; font-weight: 800;">${eventData.actionName || '발동됨'}</h3>
                <p style="color: #475569; font-size: 1rem; line-height: 1.5; margin-bottom: 0;">${eventData.actionDesc || ''}</p>
            `;
            cardsContainer.appendChild(card);
            
            singleActionDiv.style.display = 'flex';
            btnOk.onclick = () => {
                modal.style.display = 'none';
                if (onSelect) onSelect();
            };
        }

        modal.style.display = 'flex';
    }
}
