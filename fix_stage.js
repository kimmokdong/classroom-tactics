const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'js', 'systems', 'StageManager.js');
let content = fs.readFileSync(file, 'utf8');

const target =         this.app.state.board.forEach(u => { if (u) u.donationItems = null; });
        const donationAngels = this.app.state.board.filter(u => u && u.id === 'u5_5');
        let totalDonations = 0;
        donationAngels.forEach(angel => {
            const star = angel.star || 1;
            totalDonations += (star === 1 ? 1 : star === 2 ? 2 : 5);
        });

        if (totalDonations > 0) {
            const completedItems = ITEMS.filter(i => i.isCombined);
            let eligibleUnits = this.app.state.board.filter(u => u && (!u.items || u.items.length < 3) && u.id !== 'u5_5');
            eligibleUnits = eligibleUnits.sort(() => 0.5 - Math.random());
            let donationsGiven = 0;
            for (const u of eligibleUnits) {
                if (donationsGiven >= totalDonations) break;
                const randomItem = completedItems[Math.floor(Math.random() * completedItems.length)];
                u.donationItems = u.donationItems || [];
                u.donationItems.push(randomItem.id);
                donationsGiven++;
            }
            if (donationsGiven > 0) {
                if (battleLogEl) {
                    const li = document.createElement('li');
                    li.style.color = '#e67e22';
                    li.style.fontSize = '0.85rem';
                    li.style.borderBottom = '1px dashed #eee';
                    li.style.paddingBottom = '3px';
                    li.innerHTML = \\\🎁 <strong>기부 천사</strong>가 아군 \\\명에게 무작위 완성 아이템을 기부했습니다! (유닛을 클릭해 확인하세요)\\\;
                    battleLogEl.appendChild(li);
                }
            }
        };

const replacement =         this.app.state.board.forEach(u => { if (u) u.donationItems = null; });
        const donationAngels = [];
        this.app.state.board.forEach((u, idx) => { if (u && u.id === 'u5_5') donationAngels.push({ unit: u, idx }); });

        if (donationAngels.length > 0) {
            const completedItems = ITEMS.filter(i => i.isCombined);
            let totalDonationsGiven = 0;

            donationAngels.forEach(angelData => {
                const u = angelData.unit;
                const index = angelData.idx;
                const star = (u.star || 1) - 1;
                const adjItemSkill = u.skill && u.skill.adjPassiveItems;
                if (!adjItemSkill) return;
                const giftCount = adjItemSkill[Math.min(star, adjItemSkill.length - 1)];

                const ux = index % 8;
                const uy = Math.floor(index / 8);
                const adjacent = this.app.state.board.filter((a, aIdx) => {
                    if (!a || a === u) return false;
                    const ax = aIdx % 8;
                    const ay = Math.floor(aIdx / 8);
                    return Math.max(Math.abs(ax - ux), Math.abs(ay - uy)) <= 1;
                });

                let shuffledAdj = adjacent.sort(() => 0.5 - Math.random());
                let givenCount = 0;

                for (let i = 0; i < shuffledAdj.length; i++) {
                    if (givenCount >= giftCount) break;
                    
                    const a = shuffledAdj[i];
                    const existingItems = (a.items || []).length;
                    if (existingItems < 3) {
                        if (!a.donationItems) a.donationItems = [];
                        const randomItem = completedItems[Math.floor(Math.random() * completedItems.length)];
                        a.donationItems.push(randomItem.id);
                        a.triggerDonationFX = true;
                        givenCount++;
                        totalDonationsGiven++;
                    }
                }
            });

            if (totalDonationsGiven > 0) {
                if (battleLogEl) {
                    const li = document.createElement('li');
                    li.style.color = '#e67e22';
                    li.style.fontSize = '0.85rem';
                    li.style.borderBottom = '1px dashed #eee';
                    li.style.paddingBottom = '3px';
                    li.innerHTML = \\\🎁 <strong>기부 천사</strong>가 주변 아군 \\\명에게 무작위 완성 아이템을 기부했습니다!\\\;
                    battleLogEl.appendChild(li);
                }
            }
        };

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Success');
} else {
    console.log('Target not found in StageManager.js');
}
