import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from './js/data.js';
import { SynergyManager } from './js/systems/SynergyManager.js';
import { BattleEngine } from './js/battleEngine.js';

// --- MOCK APP ENVIRONMENT ---
class DummyApp {
    constructor() {
        this.state = {
            board: [],
            globalBuffs: { teamHp: 0, teamAdAp: 0, teamDef: 0, critChance: 0, dmgAmp: 0, vamp: 0, startShield: 0, tickHealPct: 0, asMult: 0, startMana: 0, rangeBuff: 0, distAmp: 0 },
            hp: 100
        };
        this.ITEMS = [
            { id: 'gargoyle', name: '가고일', stats: { armor: 30, mr: 30, maxHp: 200 }, effect: 'gargoyle' },
            { id: 'warmog', name: '워모그', stats: { maxHp: 1000 } },
            { id: 'dclaw', name: '용발', stats: { mr: 70, maxHp: 200 }, effect: 'dclaw' },
            { id: 'ie', name: '인피', stats: { ad: 30, critChance: 0.2 }, effect: 'skillCrit' },
            { id: 'guinsoo', name: '구인수', stats: { ad: 15, ap: 15, as: 0.15 }, effect: 'guinsoo' },
            { id: 'gs', name: '거학', stats: { ad: 20, ap: 20 }, effect: 'giantSlayer' },
            { id: 'rabadon', name: '데캡', stats: { ap: 50, apPct: 0.25 } },
            { id: 'jg', name: '보건', stats: { ap: 30, critChance: 0.2 }, effect: 'skillCrit' },
            { id: 'blue', name: '블루', stats: { ap: 20, mana: 40 }, effect: 'blueBuff' }
        ];
    }
}
const dummyApp = new DummyApp();
const synergyManager = new SynergyManager(dummyApp);

// --- AGENT PARAMS ---
const TOTAL_GOLD = parseInt(process.env.TOTAL_GOLD) || 320; // 벤치마크 스크립트에서 주입받음
const BOT_COUNT_PER_TYPE = 100; // 각 타입별 100마리 (총 400마리 배틀로얄)
const TANK_ITEMS = ['gargoyle', 'warmog', 'dclaw'];
const AD_ITEMS = ['ie', 'guinsoo', 'gs'];
const AP_ITEMS = ['rabadon', 'jg', 'blue'];
// 현재 레벨에서 다음 레벨로 가는 비용 (최신 EXP_TABLE 기준: 6->7:36, 7->8:60, 8->9:68)
const LEVEL_UP_COST = { 6: 36, 7: 60, 8: 68 }; 
// 1렙부터 해당 레벨까지 순수하게 골드로 샀을 때 누적 필요 경험치(비용)
const BASE_LEVEL_COST = { '6L': 38, '7L': 72, '8L': 132, '9L': 200 };

// 1인용 솔로플레이 환경에 맞게 기물 풀 대폭 축소 (기물 독점 난이도 증가)
const TIER_COPIES = { 1: 18, 2: 15, 3: 12, 4: 10, 5: 7 };
const SHOP_ODDS = {
    6: [35, 40, 20, 5, 0],
    7: [19, 30, 35, 15, 1],
    8: [15, 20, 35, 25, 5],
    9: [10, 15, 30, 30, 15]
};

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- AGENT BOT CLASS ---
class AgentBot {
    constructor(targetType) {
        this.targetType = targetType;
        this.level = parseInt(targetType[0]);
        this.gold = TOTAL_GOLD - BASE_LEVEL_COST[targetType];
        this.deck = [];
        this.bench = [];
        this.pool = this.initPool();
    }

    initPool() {
        let p = [];
        for (let u of UNIT_POOL) {
            let maxCopies = TIER_COPIES[u.tier];
            for(let i=0; i<maxCopies; i++) {
                let unitClone = Object.assign({}, u);
                unitClone.star = 1;
                p.push(unitClone);
            }
        }
        return p;
    }

    rollShop() {
        if (this.gold < 2) return [];
        this.gold -= 2;
        let shop = [];
        let odds = SHOP_ODDS[this.level];
        
        for(let i=0; i<5; i++) {
            let r = Math.random() * 100;
            let sum = 0, selectedTier = 1;
            for(let t=0; t<5; t++) {
                sum += odds[t];
                if(r <= sum) { selectedTier = t+1; break; }
            }
            
            let tierUnits = this.pool.filter(u => u.tier === selectedTier && u.star === 1);
            if(tierUnits.length > 0) {
                let chosen = randomChoice(tierUnits);
                
                let shopUnit = Object.assign({}, chosen);
                shopUnit.star = 1;
                shop.push(shopUnit);
            }
        }
        return shop;
    }

    buy(unit) {
        if (this.gold < unit.tier || this.bench.length >= 30) return false;
        
        let idx = this.pool.findIndex(u => String(u.id) === String(unit.id) && u.star === 1);
        if (idx !== -1) {
            this.pool.splice(idx, 1);
        } else {
            return false;
        }

        this.gold -= unit.tier;
        this.bench.push(Object.assign({}, unit));
        this.checkCombine();
        return true;
    }

    sell(unitIndex) {
        let u = this.bench.splice(unitIndex, 1)[0];
        let refund = u.tier * (u.star === 3 ? 9 : (u.star === 2 ? 3 : 1));
        this.gold += refund;
        let copies = u.star === 3 ? 9 : (u.star === 2 ? 3 : 1);
        let original = UNIT_POOL.find(x => x.id === u.id);
        for(let i=0; i<copies; i++) this.pool.push(Object.assign({}, original));
    }

    checkCombine() {
        let allUnits = [...this.bench, ...this.deck];
        let counts = {};
        for (let u of allUnits) {
            let key = u.id + '|' + u.star;
            counts[key] = (counts[key] || 0) + 1;
        }
        
        let combined = false;
        for (let key in counts) {
            if (counts[key] >= 3) {
                let parts = key.split('|');
                let id = parts[0];
                let star = parseInt(parts[1]);
                if (star >= 3 || isNaN(star)) continue;
                
                let removed = 0;
                let removedFromDeck = 0;
                // 먼저 벤치에서 빼기 시도
                for(let i=this.bench.length-1; i>=0; i--) {
                    if (String(this.bench[i].id) === id && this.bench[i].star === star) {
                        this.bench.splice(i, 1);
                        removed++;
                        if (removed === 3) break;
                    }
                }
                // 3개를 못 채웠다면 덱(필드)에서도 빼기
                if (removed < 3) {
                    for(let i=this.deck.length-1; i>=0; i--) {
                        if (String(this.deck[i].id) === id && this.deck[i].star === star) {
                            this.deck.splice(i, 1);
                            removed++;
                            removedFromDeck++;
                            if (removed === 3) break;
                        }
                    }
                }
                
                let baseUnit = UNIT_POOL.find(u => String(u.id) === id);
                if (baseUnit) {
                    let upgraded = Object.assign({}, baseUnit);
                    upgraded.star = star + 1;
                    if (removedFromDeck > 0) {
                        this.deck.push(upgraded);
                    } else {
                        this.bench.push(upgraded);
                    }
                    combined = true;
                }
                break;
            }
        }
        if (combined) {
            this.checkCombine();
        }
    }

    getBenchSummary() {
        let summary = {};
        for(let u of this.bench) summary[u.id] = (summary[u.id] || 0) + (u.star === 3 ? 9 : (u.star === 2 ? 3 : 1));
        return summary;
    }
}

// --- BOT STRATEGIES ---
function simulate6L_7L(bot) {
    let targetTier = bot.level === 6 ? [2] : [3];
    let targetCount = bot.level === 6 ? 4 : 3;
    let lockedTargets = []; 
    
    let isTargetDone = () => {
        let c3 = 0;
        bot.bench.forEach(u => { if (u.star === 3 && lockedTargets.includes(u.id)) c3++; });
        return c3 >= targetCount;
    };

    while (bot.gold >= 2 && !isTargetDone()) {
        let shop = bot.rollShop();
        if (shop.length === 0) break;
        
        for (let u of shop) {
            if (lockedTargets.includes(u.id)) bot.buy(u);
            else if (lockedTargets.length < targetCount && targetTier.includes(u.tier)) bot.buy(u);
        }
        
        let allBotUnits = [...bot.bench, ...bot.deck];
        allBotUnits.forEach(u => {
            if (targetTier.includes(u.tier) && u.star === 3 && !lockedTargets.includes(u.id)) {
                if (lockedTargets.length < targetCount) lockedTargets.push(String(u.id));
            }
        });
        
        if (bot.bench.length >= 30) {
            let sold = false;
            for(let i=bot.bench.length-1; i>=0; i--) {
                if (!lockedTargets.includes(bot.bench[i].id)) {
                    bot.sell(i);
                    sold = true;
                    break;
                }
            }
            if (!sold) bot.sell(0); 
        }
    }
    
    bot.bench.sort((a,b) => (b.tier + b.star*10) - (a.tier + a.star*10));
    while(bot.deck.length < bot.level && bot.bench.length > 0) {
        bot.deck.push(bot.bench.shift());
    }
    if (bot.gold >= LEVEL_UP_COST[bot.level]) {
        bot.gold -= LEVEL_UP_COST[bot.level];
        bot.level++;
        if (bot.bench.length > 0) {
            bot.deck.push(bot.bench.shift());
        }
    }
}

function simulate8L(bot) {
    let targetTier = [4];
    let targetCount = 2;
    let lockedTargets = []; 
    
    let isTargetDone = () => {
        let c2 = 0;
        bot.bench.forEach(u => { if (u.star >= 2 && lockedTargets.includes(u.id)) c2++; });
        return c2 >= targetCount;
    };

    while (bot.gold >= 2 && !isTargetDone()) {
        let shop = bot.rollShop();
        if (shop.length === 0) break;
        
        for (let u of shop) {
            if (lockedTargets.includes(u.id)) bot.buy(u);
            else if (lockedTargets.length < targetCount && targetTier.includes(u.tier)) bot.buy(u);
            else if (u.tier >= 3 && bot.bench.length < 8) bot.buy(u);
        }
        
        let allBotUnits = [...bot.bench, ...bot.deck];
        allBotUnits.forEach(u => {
            if (targetTier.includes(u.tier) && u.star === 2 && !lockedTargets.includes(String(u.id))) {
                if (lockedTargets.length < targetCount) lockedTargets.push(String(u.id));
            }
        });
        
        if (bot.bench.length >= 30) {
            let sorted = bot.bench.map((u, i) => ({u, i})).filter(x => !lockedTargets.includes(x.u.id));
            sorted.sort((a,b) => (a.u.tier + a.u.star*2) - (b.u.tier + b.u.star*2));
            if (sorted.length > 0) bot.sell(sorted[0].i);
            else bot.sell(0);
        }
    }
    
    bot.bench.sort((a,b) => (b.tier + b.star*10) - (a.tier + a.star*10));
    while(bot.deck.length < 8 && bot.bench.length > 0) {
        bot.deck.push(bot.bench.shift());
    }
    
    while(bot.bench.length > 0) bot.sell(0);
    
    if (bot.gold >= LEVEL_UP_COST[8]) {
        bot.gold -= LEVEL_UP_COST[8];
        bot.level = 9;
        while(bot.gold >= 2) {
            let shop = bot.rollShop();
            shop.sort((a,b) => b.tier - a.tier);
            if (shop.length > 0) {
                if (bot.buy(shop[0])) {
                    bot.deck.push(bot.bench.shift());
                    break;
                }
            }
        }
    } else {
        while(bot.gold >= 2) {
            let shop = bot.rollShop();
            if (shop.length === 0) break;
            
            let worstIdx = 0;
            let worstVal = bot.deck[0] ? (bot.deck[0].tier + bot.deck[0].star*10) : 999;
            for(let i=1; i<bot.deck.length; i++) {
                if(!bot.deck[i]) continue;
                let val = bot.deck[i].tier + bot.deck[i].star*10;
                if(val < worstVal) { worstVal = val; worstIdx = i; }
            }
            
            shop.sort((a,b) => b.tier - a.tier);
            let bestShop = shop[0];
            if (bot.deck[worstIdx] && bestShop.tier > bot.deck[worstIdx].tier && bot.gold >= bestShop.tier) {
                bot.gold += bot.deck[worstIdx].tier * (bot.deck[worstIdx].star===2?3:1);
                bot.deck.splice(worstIdx, 1);
                bot.gold -= bestShop.tier;
                bot.deck.push(Object.assign({}, bestShop));
            }
        }
    }
}

function simulate9L(bot) {
    while(bot.gold >= 2) {
        let shop = bot.rollShop();
        if (shop.length === 0) break;
        for(let u of shop) {
            if (u.tier >= 4) bot.buy(u);
        }
        if (bot.bench.length >= 30) {
            let sorted = bot.bench.map((u, i) => ({u, i}));
            sorted.sort((a,b) => (a.u.tier + a.u.star*10) - (b.u.tier + b.u.star*10));
            bot.sell(sorted[0].i);
        }
    }
    bot.bench.sort((a,b) => (b.tier + b.star*10) - (a.tier + a.star*10));
    while(bot.deck.length < 9 && bot.bench.length > 0) {
        bot.deck.push(bot.bench.shift());
    }
}

function assignItems(deck, type) {
    let units = deck.map((u, i) => {
        let isTank = Array.isArray(u.role) && u.role.includes('tank');
        let isDealer = Array.isArray(u.role) && u.role.includes('dealer');
        let isSupport = Array.isArray(u.role) && u.role.includes('support');
        let isAD = false;
        if (u.position && (u.position.includes('물리') || u.position.includes('공격력'))) isAD = true;
        else if (u.stats.ad > 60 && (!u.position || u.position === '')) isAD = true;

        let score = u.star * 10 + u.tier;
        if (u.star === 3) score += 50;
        return { idx: i, u, score, isTank, isDealer, isSupport, isAD };
    });
    
    units.sort((a,b) => b.score - a.score);
    let tanks = units.filter(x => x.isTank);
    if (tanks.length === 0) {
        let byPriority = [...units].sort((a, b) => {
            if (a.u.stats.range !== b.u.stats.range) return a.u.stats.range - b.u.stats.range;
            if (a.u.star !== b.u.star) return b.u.star - a.u.star;
            if (a.u.tier !== b.u.tier) return b.u.tier - a.u.tier;
            return b.u.stats.hp - a.u.stats.hp;
        });
        if(byPriority.length > 0) tanks = [byPriority[0]];
    }
    
    let mainTank = tanks[0];
    let nonTanks = units.filter(x => x !== mainTank);
    let dealers = nonTanks.filter(x => x.isDealer);
    let mainDps = dealers[0] || nonTanks.filter(x => x.isSupport)[0] || nonTanks[0];
    
    let remaining = units.filter(x => x !== mainTank && x !== mainDps);
    let subDps = remaining[0];
    
    deck.forEach(u => u.items = []);
    if (mainTank) deck[mainTank.idx].items = [...TANK_ITEMS];
    if (mainDps) deck[mainDps.idx].items = mainDps.isAD ? [...AD_ITEMS] : [...AP_ITEMS];
    if (subDps && subDps !== mainTank && subDps !== mainDps) deck[subDps.idx].items = subDps.isAD ? [...AD_ITEMS] : [...AP_ITEMS];
}

function fight(deckA, deckB) {
    if(deckA.length===0 || deckB.length===0) return true;
    dummyApp.state.board = deckA;
    let countsA = synergyManager.getSynergyData(deckA);
    let boardA = synergyManager.applySynergyStats(deckA, countsA, false);
    
    dummyApp.state.board = deckB;
    let countsB = synergyManager.getSynergyData(deckB);
    let boardB = synergyManager.applySynergyStats(deckB, countsB, true);
    
    let pBoard = Array(24).fill(null);
    let eBoard = Array(24).fill(null);
    boardA.forEach((u, i) => pBoard[i] = u);
    boardB.forEach((u, i) => eBoard[i] = u);
    
    let engine = new BattleEngine(pBoard, eBoard, []);
    engine.run();
    return engine.board.some(u => u && u.team === 'player' && u.currHp > 0);
}

function getDeckName(deck) {
    let counts = synergyManager.getSynergyData(deck);
    let active = [];
    const getActive = (count, synData) => {
        if (!synData) return 0;
        let levels = Object.keys(synData.levels).map(Number).sort((a,b)=>a-b);
        let activeLvl = 0;
        if (synData.exactMatch) { if (levels.includes(count)) activeLvl = count; }
        else { levels.forEach(l => { if (count >= l) activeLvl = l; }); }
        return activeLvl;
    };
    for (let s in counts.subjects) { let lvl = getActive(counts.subjects[s], SYNERGIES.subjects[s]); if (lvl > 0) active.push(s + lvl); }
    for (let c in counts.clubs) { let lvl = getActive(counts.clubs[c], SYNERGIES.clubs[c]); if (lvl > 0) active.push(c + lvl); }
    if (active.length === 0) return "무지성잡덱";
    active.sort((a,b) => parseInt(b.slice(-1)) - parseInt(a.slice(-1)));
    return active.slice(0, 3).join('_');
}

function getDeckSignature(deck) {
    let name = getDeckName(deck);
    let cores = deck.filter(u => u.items && u.items.length > 0).map(u => u.name).sort().join('-');
    return `${name}__${cores}`;
}

// --- MAIN SIMULATION & REPORT ---
async function main() {
    console.log("=== Agent-based Pure Random Evaluation Started ===");
    console.log(`Total Gold: ${TOTAL_GOLD}`);
    
    let allDecks = [];
    let types = ['6L', '7L', '8L', '9L'];
    
    for (let type of types) {
        console.log(`Simulating Bots for ${type}...`);
        let typeDecks = [];
        for(let i=0; i<BOT_COUNT_PER_TYPE; i++) {
            let bot = new AgentBot(type);
            if (type === '6L' || type === '7L') simulate6L_7L(bot);
            else if (type === '8L') simulate8L(bot);
            else if (type === '9L') simulate9L(bot);
            
            bot.deck = bot.deck.filter(u => u !== null && u !== undefined);
            if(bot.deck.length > 0) {
                assignItems(bot.deck, type);
                typeDecks.push({ deck: bot.deck, wins: 0, matches: 0, type: type, sig: getDeckSignature(bot.deck) });
            }
        }
        allDecks = allDecks.concat(typeDecks);
    }
    
    console.log(`Total unique decks created: ${allDecks.length}`);
    console.log("Starting Battle Royale Tournament...");
    
    for(let i=0; i<allDecks.length; i++) {
        for(let j=i+1; j<allDecks.length; j++) {
            if(fight(allDecks[i].deck, allDecks[j].deck)) allDecks[i].wins++;
            else allDecks[j].wins++;
            allDecks[i].matches++;
            allDecks[j].matches++;
        }
    }
    
    allDecks.sort((a,b) => (b.wins/b.matches) - (a.wins/a.matches));
    
    let topUnique = [];
    let seenSigs = new Set();
    for (let p of allDecks) {
        if (!seenSigs.has(p.sig)) {
            seenSigs.add(p.sig);
            topUnique.push(p);
        }
    }
    
    let top45 = topUnique.slice(0, 45);
    
    let markdown = `# 🤖 에이전트(무작위 밸류 진화) 시뮬레이션 리포트\n`;
    markdown += `> **예산**: ${TOTAL_GOLD} 골드 / **기물 풀**: 4코 10장, 5코 7장 고증 반영 / **분석 시간**: ${new Date().toLocaleString()}\n`;
    markdown += `> **평가 방식**: 시너지를 전혀 고려하지 않고 맹목적 목표 달성과 랜덤 배치로 짜여진 봇들의 덱 ${allDecks.length}개가 토너먼트 배틀로얄을 치른 후 살아남은 승률 기반 순위표입니다.\n\n---\n\n`;
    
    markdown += `## 🏆 최종 최적해 순위 통계 (Top 45)\n\n`;
    markdown += `| 순위 | 덱 타입 | 덱 명칭 (발견된 시너지) | 승률 | 🛡️ 메인 탱커 | ⚔️ 메인 딜러 | 🎯 서브 딜러 | 코스트 | 구성 유닛 상세 |\n`;
    markdown += `|:---:|:---:|:---|:---:|:---|:---|:---|:---:|:---|\n`;
    
    top45.forEach((p, index) => {
        let winrate = ((p.wins / p.matches) * 100).toFixed(1);
        let items = p.deck.filter(u => u.items && u.items.length > 0);
        let tank = items.find(u => u.items.includes('gargoyle')) || items[0];
        let dealer = items.find(u => u.items.includes('ie') || u.items.includes('rabadon')) || items[1];
        let sub = items.find(u => u !== tank && u !== dealer) || items[2];
        
        let tName = tank ? `${tank.name}(${tank.star}★)` : '-';
        let dName = dealer ? `${dealer.name}(${dealer.star}★)` : '-';
        let sName = sub ? `${sub.name}(${sub.star}★)` : '-';
        
        let cost = p.deck.reduce((sum, u) => sum + (u.tier * (u.star===3?9:(u.star===2?3:1))), 0);
        
        let deckDetail = p.deck.map(u => {
            let str = `${u.name}(${u.star}★)`;
            if (u === tank || u === dealer || u === sub) str = `**${str}**`;
            return str;
        }).join(', ');
        
        let rawName = p.sig.split('__')[0];
        let rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index+1}`;
        
        markdown += `| ${rankBadge} | ${p.type} | **${rawName}** | **${winrate}%** | ${tName} | ${dName} | ${sName} | ${cost}G | ${deckDetail} |\n`;
    });
    
    console.log(`Simulation complete! Report saved to report_${TOTAL_GOLD}G.txt`);
    fs.writeFileSync(`report_${TOTAL_GOLD}G.txt`, markdown);
}

main();
