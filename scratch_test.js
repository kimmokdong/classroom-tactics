const UNIT_POOL = [
    { id: 'u1', name: '바른생활 사나이', tier: 2, star: 1 },
    { id: 'u2', name: '천재 피아니스트', tier: 4, star: 1 }
];

class AgentBot {
    constructor() {
        this.bench = [];
        this.deck = [];
    }
    checkCombine() {
        let allUnits = [...this.bench, ...this.deck];
        let counts = {};
        for (let u of allUnits) {
            let key = u.id + '_' + u.star;
            counts[key] = (counts[key] || 0) + 1;
        }
        
        let combined = false;
        for (let key in counts) {
            if (counts[key] >= 3) {
                let [id, starStr] = key.split('_');
                let star = parseInt(starStr);
                if (star >= 3 || isNaN(star)) continue;
                
                let removed = 0;
                for(let i=this.bench.length-1; i>=0; i--) {
                    if (String(this.bench[i].id) === id && this.bench[i].star === star) {
                        this.bench.splice(i, 1);
                        removed++;
                        if (removed === 3) break;
                    }
                }
                if (removed < 3) {
                    for(let i=this.deck.length-1; i>=0; i--) {
                        if (String(this.deck[i].id) === id && this.deck[i].star === star) {
                            this.deck.splice(i, 1);
                            removed++;
                            if (removed === 3) break;
                        }
                    }
                }
                
                let baseUnit = UNIT_POOL.find(u => String(u.id) === id);
                if (baseUnit) {
                    let upgraded = Object.assign({}, baseUnit);
                    upgraded.star = star + 1;
                    this.bench.push(upgraded);
                    combined = true;
                }
                break;
            }
        }
        if (combined) this.checkCombine(); 
    }
}

let bot = new AgentBot();
bot.bench.push({ id: 'u1', name: '바른생활 사나이', tier: 2, star: 1 });
bot.bench.push({ id: 'u1', name: '바른생활 사나이', tier: 2, star: 1 });
bot.deck.push({ id: 'u1', name: '바른생활 사나이', tier: 2, star: 1 });

console.log("Before:", { bench: bot.bench.length, deck: bot.deck.length });
bot.checkCombine();
console.log("After:", { bench: bot.bench.length, deck: bot.deck.length });
console.log("Bench contains:", bot.bench.map(u => u.name + '(' + u.star + ')'));
