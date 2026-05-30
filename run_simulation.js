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
        // Define items here since constants.js might not have full item defs
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

// --- GA PARAMS ---
const POP_SIZE = 20;
const GENERATIONS = 15;
const BATTLES_PER_EVAL = 5;
const MUTATION_RATE = 0.3;
const TOTAL_GOLD = 250;
const LEVEL_COST = { 7: 100, 8: 160, 9: 240 };

// 3 types of items
const TANK_ITEMS = ['gargoyle', 'warmog', 'dclaw'];
const AD_ITEMS = ['ie', 'guinsoo', 'gs'];
const AP_ITEMS = ['rabadon', 'jg', 'blue'];

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const BASE_LEVEL_COST = { '6L': 0, '7L': 40, '8L': 100, '9L': 180 };
const LEVEL_UP_COST = { 6: 40, 7: 60, 8: 80 }; // cost to go to next level

function estimateUnitCost(u, rollLevel) {
    let copies = u.star === 3 ? 9 : (u.star === 2 ? 3 : 1);
    let base = u.tier * copies;
    
    let odds;
    if (rollLevel === 6) odds = [35, 40, 20, 5, 0];
    else if (rollLevel === 7) odds = [19, 30, 35, 15, 1];
    else if (rollLevel === 8) odds = [15, 20, 35, 25, 5];
    else odds = [10, 15, 30, 30, 15];
    
    let prob = odds[u.tier - 1] / 100;
    if (prob === 0) return Infinity;
    let rollCost = (1 / prob) * 2 * copies * 0.15; // slightly higher roll tax
    
    return base + rollCost;
}

function generateRandomDeck(type) {
    let deck = [];
    let currentLevel = parseInt(type[0]);
    let rollLevel = currentLevel;
    let spentGold = BASE_LEVEL_COST[type];
    
    const addUnit = (tier, star) => {
        let pool = UNIT_POOL.filter(u => u.tier === tier);
        if(pool.length === 0) pool = UNIT_POOL;
        let u = Object.assign({}, randomChoice(pool));
        u.star = star;
        while(deck.find(existing => existing.id === u.id)) {
            u = Object.assign({}, randomChoice(pool));
            u.star = star;
        }
        spentGold += estimateUnitCost(u, rollLevel);
        deck.push(u);
    };

    if (type === '6L') {
        // Core: Five 3-stars of 1/2 costs, plus one 2-star
        for(let i=0; i<5; i++) {
            let tier = Math.random() < 0.5 ? 1 : 2;
            addUnit(tier, 3);
        }
        addUnit(Math.random() < 0.5 ? 2 : 3, 2);
        
        // Push levels if gold remains
        if (spentGold + LEVEL_UP_COST[currentLevel] < TOTAL_GOLD) {
            spentGold += LEVEL_UP_COST[currentLevel];
            currentLevel++; // to 7
            addUnit(3, 2);
            if (spentGold + LEVEL_UP_COST[currentLevel] < TOTAL_GOLD) {
                spentGold += LEVEL_UP_COST[currentLevel];
                currentLevel++; // to 8
                addUnit(4, 2);
            }
        }
    } else if (type === '7L') {
        // Core: Three 3-stars of 3 costs, plus four 2-stars
        for(let i=0; i<3; i++) addUnit(3, 3);
        for(let i=0; i<4; i++) addUnit(Math.random() < 0.5 ? 2 : 3, 2);
        
        // Push levels if gold remains
        if (spentGold + LEVEL_UP_COST[currentLevel] < TOTAL_GOLD) {
            spentGold += LEVEL_UP_COST[currentLevel];
            currentLevel++; // to 8
            addUnit(4, 2);
        }
    } else if (type === '8L' || type === '9L') {
        let coreCount = type === '8L' ? 4 : 5; // number of 4/5 costs
        let targetSize = type === '8L' ? 8 : 9;
        
        // Pick carries first (4 or 5 cost)
        for(let i=0; i<coreCount; i++) {
            let tier = Math.random() < 0.6 ? 4 : 5;
            addUnit(tier, 2);
        }
        
        // Fill the rest with 1~3 cost units that match synergies of the carries
        let requiredFillers = targetSize - coreCount;
        for(let i=0; i<requiredFillers; i++) {
            let currentSyns = new Set();
            deck.forEach(u => {
                currentSyns.add(u.subject);
                currentSyns.add(u.club);
            });
            
            // Pool of 1~3 cost units that share a synergy, prioritizing 1~2 costs
            let synPool = UNIT_POOL.filter(u => u.tier <= 3 && !deck.find(d => d.id === u.id) && (currentSyns.has(u.subject) || currentSyns.has(u.club)));
            
            if(synPool.length > 0) {
                // Favor 1,2 costs if possible to show synergy shuttle effect
                let lowCostPool = synPool.filter(u => u.tier <= 2);
                let chosenPool = lowCostPool.length > 0 && Math.random() < 0.7 ? lowCostPool : synPool;
                
                let u = Object.assign({}, randomChoice(chosenPool));
                u.star = 2;
                spentGold += estimateUnitCost(u, rollLevel);
                deck.push(u);
            } else {
                addUnit(Math.random() < 0.5 ? 2 : 3, 2); // fallback
            }
        }
        
        // If 8L and budget remains, push to 9
        if (type === '8L' && spentGold + LEVEL_UP_COST[currentLevel] < TOTAL_GOLD) {
            spentGold += LEVEL_UP_COST[currentLevel];
            currentLevel++; // to 9
            // Add a 5-cost value unit
            addUnit(5, 2);
        }
    }
    
    return deck;
}

function estimateCost(deck, type) {
    let rollLevel = parseInt(type[0]);
    let spentGold = BASE_LEVEL_COST[type];
    for (let u of deck) {
        spentGold += estimateUnitCost(u, rollLevel);
    }
    return spentGold;
}

function assignItems(deck, type) {
    // Determine Tank vs DPS based on stats
    let units = deck.map((u, i) => {
        let isTank = (u.stats.armor + u.stats.mr > 70) || (u.stats.hp >= 600 && u.stats.range === 1);
        let isAD = u.stats.ad > u.stats.ap;
        let score = u.star * 10 + u.tier;
        if (type === '7L' && u.star === 3) score += 100; // force 3-stars to get items
        return { idx: i, u, score, isTank, isAD };
    });
    
    units.sort((a,b) => b.score - a.score);
    
    // Pick 1 tank, 1 main DPS, 1 sub DPS
    let tanks = units.filter(x => x.isTank);
    let dps = units.filter(x => !x.isTank);
    
    let mainTank = tanks[0] || units[0];
    let mainDps = dps[0] || units[1];
    let subDps = dps[1] || units[2] || tanks[1];
    
    deck.forEach(u => u.items = []); // clear
    deck[mainTank.idx].items = [...TANK_ITEMS];
    deck[mainDps.idx].items = mainDps.isAD ? [...AD_ITEMS] : [...AP_ITEMS];
    deck[subDps.idx].items = subDps.isAD ? [...AD_ITEMS] : [...AP_ITEMS];
}

function fight(deckA, deckB) {
    // Prep boards
    dummyApp.state.board = deckA;
    let countsA = synergyManager.getSynergyData(deckA);
    let boardA = synergyManager.applySynergyStats(deckA, countsA, false);
    
    dummyApp.state.board = deckB;
    let countsB = synergyManager.getSynergyData(deckB);
    let boardB = synergyManager.applySynergyStats(deckB, countsB, true);
    
    // Create random placement
    let pBoard = Array(24).fill(null);
    let eBoard = Array(24).fill(null);
    
    boardA.forEach((u, i) => pBoard[i] = u);
    boardB.forEach((u, i) => eBoard[i] = u);
    
    let engine = new BattleEngine(pBoard, eBoard, []);
    engine.run();
    
    let pAlive = engine.board.some(u => u && u.team === 'player' && u.currHp > 0);
    return pAlive; // true if A won
}

function getDeckName(deck) {
    let counts = synergyManager.getSynergyData(deck);
    let active = [];
    
    const getActive = (count, synData) => {
        let levels = Object.keys(synData.levels).map(Number).sort((a,b)=>a-b);
        let activeLvl = 0;
        if (synData.exactMatch) { if (levels.includes(count)) activeLvl = count; }
        else { levels.forEach(l => { if (count >= l) activeLvl = l; }); }
        return activeLvl;
    };

    for (let s in counts.subjects) {
        let lvl = getActive(counts.subjects[s], SYNERGIES.subjects[s]);
        if (lvl > 0) active.push(s + lvl);
    }
    for (let c in counts.clubs) {
        let lvl = getActive(counts.clubs[c], SYNERGIES.clubs[c]);
        if (lvl > 0) active.push(c + lvl);
    }
    
    if (active.length === 0) return "잡탕";
    // Sort by level descending
    active.sort((a,b) => parseInt(b.slice(-1)) - parseInt(a.slice(-1)));
    return active.slice(0, 3).join('_');
}

async function runGA(type) {
    console.log(`\n=== Running GA for ${type} Decks ===`);
    let pop = [];
    
    // Idea B: Seeding 6/7 synergy decks into Gen 0
    let seedTraits = ['도덕', '방송부', '육상부', '급식부', '장난꾸러기', '선도부'];
    for (let trait of seedTraits) {
        let matchingUnits = UNIT_POOL.filter(u => u.subject === trait || u.club === trait);
        // Only seed if we have enough units to make a 6/7 synergy deck
        if (matchingUnits.length >= 6) {
            let deckSize = type === '9L' ? 9 : 8;
            if (type === '7L') deckSize = 7; // Wait, 7L in generateRandomDeck size was 8 actually
            
            // Try to add all matching units first
            let seedDeck = [];
            for (let u of matchingUnits) {
                if (seedDeck.length >= deckSize) break;
                let copy = Object.assign({}, u);
                copy.star = (type === '7L' && copy.tier === 3) ? 3 : 2; // naive star
                seedDeck.push(copy);
            }
            
            // Fill the rest with random units if needed
            while(seedDeck.length < deckSize) {
                let r = Object.assign({}, randomChoice(UNIT_POOL));
                r.star = 2;
                if (!seedDeck.find(existing => existing.id === r.id)) {
                    seedDeck.push(r);
                }
            }
            
            assignItems(seedDeck, type);
            pop.push({ deck: seedDeck, fitness: 0, wins: 0, cost: estimateCost(seedDeck, type) });
        }
    }
    
    // Fill the rest with random decks
    while (pop.length < POP_SIZE) {
        let d = generateRandomDeck(type);
        assignItems(d, type);
        pop.push({ deck: d, fitness: 0, wins: 0, cost: estimateCost(d, type) });
    }
    
    for (let gen = 0; gen < GENERATIONS; gen++) {
        // Reset fitness
        pop.forEach(p => { p.fitness = 0; p.wins = 0; });
        
        // Evaluate
        for(let i=0; i<pop.length; i++) {
            if (pop[i].cost > TOTAL_GOLD) {
                pop[i].fitness = -100; // Unbuildable penalty
                continue;
            }
            // Fight randoms
            for(let k=0; k<BATTLES_PER_EVAL; k++) {
                let enemy = randomChoice(pop).deck;
                if (fight(pop[i].deck, enemy)) {
                    pop[i].wins++;
                }
            }
            pop[i].fitness = pop[i].wins;
        }
        
        pop.sort((a,b) => b.fitness - a.fitness);
        
        if (gen === GENERATIONS - 1) break;
        
        let newPop = pop.slice(0, 10); // Keep top 10 (Elitism)
        
        while(newPop.length < POP_SIZE) {
            let p1 = pop[Math.floor(Math.random() * 20)].deck;
            let p2 = pop[Math.floor(Math.random() * 20)].deck;
            
            // Crossover
            let split = Math.floor(p1.length / 2);
            let childDeck = [...p1.slice(0, split), ...p2.slice(split)].slice(0, p1.length);
            
            // Fix duplicates
            let seen = new Set();
            childDeck = childDeck.filter(u => {
                if(seen.has(u.id)) return false;
                seen.add(u.id);
                return true;
            });
            while(childDeck.length < p1.length) {
                let r = Object.assign({}, randomChoice(UNIT_POOL));
                r.star = p1[0].star === 3 ? 2 : 2; // naive fallback
                if(!seen.has(r.id)) { childDeck.push(r); seen.add(r.id); }
            }
            
            // Mutation
            if (Math.random() < MUTATION_RATE) {
                let idx = Math.floor(Math.random() * childDeck.length);
                let r;
                
                // 70% chance to do synergy-biased mutation
                if (Math.random() < 0.70) {
                    let tempDeck = [...childDeck];
                    tempDeck.splice(idx, 1);
                    
                    let subjects = tempDeck.map(u => u.subject);
                    let clubs = tempDeck.map(u => u.club);
                    let allTraits = [...subjects, ...clubs].reduce((acc, val) => {
                        acc[val] = (acc[val] || 0) + 1;
                        return acc;
                    }, {});
                    
                    let topTraits = Object.keys(allTraits).sort((a,b) => allTraits[b] - allTraits[a]);
                    if (topTraits.length > 0) {
                        let targetTrait = topTraits[0];
                        let matchingUnits = UNIT_POOL.filter(u => u.subject === targetTrait || u.club === targetTrait);
                        // Filter out units already in the deck
                        matchingUnits = matchingUnits.filter(u => !childDeck.find(existing => existing.id === u.id));
                        if (matchingUnits.length > 0) {
                            r = Object.assign({}, randomChoice(matchingUnits));
                        }
                    }
                }
                
                if (!r) {
                    let available = UNIT_POOL.filter(u => !childDeck.find(existing => existing.id === u.id));
                    if (available.length > 0) {
                        r = Object.assign({}, randomChoice(available));
                    } else {
                        r = Object.assign({}, randomChoice(UNIT_POOL)); // fallback
                    }
                }
                
                r.star = childDeck[idx].star;
                childDeck[idx] = r;
            }
            
            // Enforce constraints
            if(type === '7L') {
                let c3Count = 0;
                childDeck.forEach(u => {
                    if(u.tier === 3 && u.star === 3) c3Count++;
                    else if (u.star === 3) u.star = 2; // no other 3-stars
                });
                // Fix if missing 3 cost 3-stars
            } else {
                childDeck.forEach(u => { if(u.star === 3) u.star = 2; });
            }
            
            assignItems(childDeck, type);
            newPop.push({ deck: childDeck, fitness: 0, wins: 0, cost: estimateCost(childDeck, type) });
        }
        pop = newPop;
    }
    
    return pop.slice(0, 10).map(p => p.deck);
}

async function main() {
    console.log("Generating Top Decks via Genetic Algorithm...");
    let top6L = await runGA('6L');
    let top7L = await runGA('7L');
    let top8L = await runGA('8L');
    let top9L = await runGA('9L');
    
    let allTopDecks = [...top6L, ...top7L, ...top8L, ...top9L];
    console.log(`\n=== Running Full Round Robin (40 Decks x 39 Opponents x 2) ===`);
    
    let results = allTopDecks.map((d, i) => ({ id: i, deck: d, wins: 0, matches: 0, type: i<10?'6L':(i<20?'7L':(i<30?'8L':'9L')) }));
    
    for(let i=0; i<40; i++) {
        for(let j=0; j<40; j++) {
            if (i === j) continue;
            // 2 matches each pair
            for(let m=0; m<2; m++) {
                if (fight(results[i].deck, results[j].deck)) {
                    results[i].wins++;
                } else {
                    results[j].wins++;
                }
                results[i].matches++;
                results[j].matches++;
            }
        }
    }
    
    results.sort((a,b) => b.wins - a.wins);
    
    let report = '';
    let synergyMeta = {};
    let synergyLevelMeta = {};
    let unitMeta = {};
    let roleMeta = { tank: {}, dealer: {}, subAce: {} };
    // 레벨별 통계 수집
    let levelStats = { '6L': { count: 0, wins: [] }, '7L': { count: 0, wins: [] }, '8L': { count: 0, wins: [] }, '9L': { count: 0, wins: [] } };
    
    // --- 순위 통계 섹션 ---
    let rankSection = `# 📊 시뮬레이션 리포트 분석\n> ${TOTAL_GOLD}골드 / ${new Date().toLocaleDateString('ko-KR')} 기준\n\n---\n\n`;
    rankSection += `## 🏆 최종 순위 통계 (Top 40)\n\n`;
    rankSection += `| 순위 | 덱 타입 | 덱 명칭 | 승률 | 🛡️ 메인 탱커 | ⚔️ 메인 딜러 | 🪄 서브 에이스 |\n`;
    rankSection += `|---|---|---|---|---|---|---|\n`;
    
    for(let i=0; i<40; i++) {
        let r = results[i];
        let winrate = ((r.wins / r.matches) * 100).toFixed(1);
        let dname = getDeckName(r.deck);
        
        let tanks = [], dpss = [];
        r.deck.forEach(u => {
            if(u.items && u.items.length > 0) {
                if(u.items.includes('gargoyle')) tanks.push(u);
                else dpss.push(u);
            }
        });
        
        const unitDesc = (u) => u ? `${u.name}(${u.tier}코, ${u.star}성)` : '-';
        rankSection += `| **${i+1}위** | ${r.type} | **${dname}** | ${winrate}% | ${unitDesc(tanks[0])} | ${unitDesc(dpss[0])} | ${unitDesc(dpss[1])} |\n`;
        
        // 메타 데이터 수집
        levelStats[r.type].count++;
        levelStats[r.type].wins.push(parseFloat(winrate));
        
        if (tanks[0]) roleMeta.tank[tanks[0].name] = (roleMeta.tank[tanks[0].name]||0) + 1;
        if (dpss[0]) roleMeta.dealer[dpss[0].name] = (roleMeta.dealer[dpss[0].name]||0) + 1;
        if (dpss[1]) roleMeta.subAce[dpss[1].name] = (roleMeta.subAce[dpss[1].name]||0) + 1;

        let counts = synergyManager.getSynergyData(r.deck);
        const getActive = (count, synData) => {
            if (!synData) return 0;
            let levels = Object.keys(synData.levels).map(Number).sort((a,b)=>a-b);
            let activeLvl = 0;
            if (synData.exactMatch) { if (levels.includes(count)) activeLvl = count; }
            else { levels.forEach(l => { if (count >= l) activeLvl = l; }); }
            return activeLvl;
        };
        for(let s in counts.subjects) {
            let lvl = getActive(counts.subjects[s], SYNERGIES.subjects[s]);
            if (lvl > 0) {
                synergyMeta[s] = (synergyMeta[s]||0) + 1;
                synergyLevelMeta[`${s}${lvl}`] = (synergyLevelMeta[`${s}${lvl}`]||0) + 1;
            }
        }
        for(let c in counts.clubs) {
            let lvl = getActive(counts.clubs[c], SYNERGIES.clubs[c]);
            if (lvl > 0) {
                synergyMeta[c] = (synergyMeta[c]||0) + 1;
                synergyLevelMeta[`${c}${lvl}`] = (synergyLevelMeta[`${c}${lvl}`]||0) + 1;
            }
        }
        
        r.deck.forEach(u => {
            if (!unitMeta[u.name]) unitMeta[u.name] = { total: 0, carry: 0, tier: u.tier };
            unitMeta[u.name].total++;
            if(u.items && u.items.length > 0) unitMeta[u.name].carry++;
        });
    }
    
    // 미등장 유닛도 0으로 채우기
    UNIT_POOL.forEach(u => {
        if (!unitMeta[u.name]) unitMeta[u.name] = { total: 0, carry: 0, tier: u.tier };
    });
    
    // --- 1. 전체 개요 섹션 ---
    let allWinrates = results.slice(0, 40).map(r => ((r.wins / r.matches) * 100));
    let minWR = Math.min(...allWinrates).toFixed(1);
    let maxWR = Math.max(...allWinrates).toFixed(1);
    
    report += rankSection;
    report += `---\n\n`;
    report += `## 1. 전체 개요\n\n`;
    report += `| 항목 | 내용 |\n|------|------|\n`;
    report += `| 총 덱 수 | 40개 |\n`;
    report += `| 골드 예산 | ${TOTAL_GOLD}골드 |\n`;
    report += `| 승률 범위 | ${minWR}% ~ ${maxWR}% |\n`;
    report += `| 1위 승률 | ${maxWR}% |\n\n`;
    
    // --- 2. 레벨별 분포 섹션 ---
    report += `---\n\n`;
    report += `## 2. 레벨(덱 타입)별 분포\n\n`;
    report += `| 레벨 | 덱 수 | 비율 | 승률 범위 | 평가 |\n`;
    report += `|------|-------|------|-----------|------|\n`;
    
    for (let lvl of ['6L', '7L', '8L', '9L']) {
        let st = levelStats[lvl];
        let pct = ((st.count / 40) * 100).toFixed(0);
        let wrRange = '없음';
        let grade = '⚫ 미등장';
        if (st.wins.length > 0) {
            let lo = Math.min(...st.wins).toFixed(1);
            let hi = Math.max(...st.wins).toFixed(1);
            wrRange = `${lo}%~${hi}%`;
            if (st.count >= 8 && st.count <= 12) grade = '🟢 적절';
            else if (st.count >= 5) grade = '🟡 약간 치우침';
            else if (st.count > 0) grade = '🔴 부족';
        }
        let label = lvl === '6L' ? '6렙 리롤' : lvl === '7L' ? '7렙 리롤' : lvl === '8L' ? '8렙 밸류' : '9렙 밸류';
        report += `| **${lvl}** (${label}) | ${st.count}개 | ${pct}% | ${wrRange} | ${grade} |\n`;
    }
    report += `\n`;
    
    // --- 3. 시너지 분석 섹션 ---
    report += `---\n\n`;
    report += `## 3. 시너지 분석\n\n`;
    
    // 교과(Subject) 시너지
    report += `### 📌 교과(Subject) 시너지 등장 횟수\n\n`;
    report += `| 시너지 | 단계별 내역 | 총합 | 평가 |\n`;
    report += `|--------|-------------|------|------|\n`;
    
    let subjectNames = Object.keys(SYNERGIES.subjects);
    let subjectData = subjectNames.map(name => {
        let total = synergyMeta[name] || 0;
        let levels = Object.keys(SYNERGIES.subjects[name].levels).map(Number).sort((a,b) => a-b);
        let detail = levels.map(l => {
            let key = `${name}${l}`;
            let cnt = synergyLevelMeta[key] || 0;
            return cnt > 0 ? `${l}단계: ${cnt}회` : null;
        }).filter(x => x).join(', ');
        return { name, total, detail: detail || '없음' };
    });
    subjectData.sort((a, b) => b.total - a.total);
    
    let subjectAvg = subjectData.reduce((s, x) => s + x.total, 0) / subjectData.length;
    subjectData.forEach(s => {
        let grade;
        if (s.total === 0) grade = '🔴 **멸종**';
        else if (s.total <= subjectAvg * 0.3) grade = '🔴 매우 부족';
        else if (s.total <= subjectAvg * 0.6) grade = '🟡 살짝 낮음';
        else if (s.total <= subjectAvg * 1.5) grade = '🟢 적절';
        else if (s.total <= subjectAvg * 2.0) grade = '🟡 살짝 높음';
        else grade = '🔴 과도함';
        report += `| **${s.name}** | ${s.detail} | **${s.total}회** | ${grade} |\n`;
    });
    report += `\n`;
    
    // 동아리(Club) 시너지
    report += `### 📌 동아리(Club) 시너지 등장 횟수\n\n`;
    report += `| 시너지 | 단계별 내역 | 총합 | 평가 |\n`;
    report += `|--------|-------------|------|------|\n`;
    
    let clubNames = Object.keys(SYNERGIES.clubs);
    let clubData = clubNames.map(name => {
        let total = synergyMeta[name] || 0;
        let levels = Object.keys(SYNERGIES.clubs[name].levels).map(Number).sort((a,b) => a-b);
        let detail = levels.map(l => {
            let key = `${name}${l}`;
            let cnt = synergyLevelMeta[key] || 0;
            return cnt > 0 ? `${l}단계: ${cnt}회` : null;
        }).filter(x => x).join(', ');
        return { name, total, detail: detail || '없음' };
    });
    clubData.sort((a, b) => b.total - a.total);
    
    let clubAvg = clubData.reduce((s, x) => s + x.total, 0) / clubData.length;
    clubData.forEach(s => {
        let grade;
        if (s.total === 0) grade = '🔴 **멸종**';
        else if (s.total <= clubAvg * 0.3) grade = '🔴 매우 부족';
        else if (s.total <= clubAvg * 0.6) grade = '🟡 살짝 낮음';
        else if (s.total <= clubAvg * 1.5) grade = '🟢 적절';
        else if (s.total <= clubAvg * 2.0) grade = '🟡 살짝 높음';
        else grade = '🔴 과도함';
        report += `| **${s.name}** | ${s.detail} | **${s.total}회** | ${grade} |\n`;
    });
    report += `\n`;
    
    // --- 4. 핵심 기물 분석 섹션 ---
    report += `---\n\n`;
    report += `## 4. 핵심 기물(유닛) 분석\n\n`;
    
    const getTopN = (roleObj, n = 5) => Object.entries(roleObj).sort((a,b) => b[1]-a[1]).slice(0, n);
    
    report += `### 🛡️ 메인 탱커 채용률\n\n`;
    report += `| 유닛 | 등장 횟수 | 평가 |\n`;
    report += `|------|-----------|------|\n`;
    getTopN(roleMeta.tank).forEach(([name, cnt]) => {
        let tier = unitMeta[name] ? unitMeta[name].tier : '?';
        let grade = cnt >= 15 ? '🔴 과도함' : cnt >= 8 ? '🟡 높음' : cnt >= 3 ? '🟢 적절' : '🟡 낮음';
        report += `| **${name}** (${tier}코) | ${cnt}회 | ${grade} |\n`;
    });
    report += `\n`;
    
    report += `### ⚔️ 메인 딜러 채용률\n\n`;
    report += `| 유닛 | 등장 횟수 | 평가 |\n`;
    report += `|------|-----------|------|\n`;
    getTopN(roleMeta.dealer).forEach(([name, cnt]) => {
        let tier = unitMeta[name] ? unitMeta[name].tier : '?';
        let grade = cnt >= 15 ? '🔴 과도함' : cnt >= 8 ? '🟡 높음' : cnt >= 3 ? '🟢 적절' : '🟡 낮음';
        report += `| **${name}** (${tier}코) | ${cnt}회 | ${grade} |\n`;
    });
    report += `\n`;
    
    report += `### 🪄 서브 에이스 채용률\n\n`;
    report += `| 유닛 | 등장 횟수 | 평가 |\n`;
    report += `|------|-----------|------|\n`;
    getTopN(roleMeta.subAce).forEach(([name, cnt]) => {
        let tier = unitMeta[name] ? unitMeta[name].tier : '?';
        let grade = cnt >= 15 ? '🔴 과도함' : cnt >= 8 ? '🟡 높음' : cnt >= 3 ? '🟢 적절' : '🟡 낮음';
        report += `| **${name}** (${tier}코) | ${cnt}회 | ${grade} |\n`;
    });
    report += `\n`;
    
    // --- 5. 주요 발견 사항 섹션 ---
    report += `---\n\n`;
    report += `## 5. 주요 발견 사항\n\n`;
    
    // 긍정적 변화 자동 감지
    report += `### ✅ 긍정적 변화\n`;
    let levelBalanced = Object.values(levelStats).every(s => s.count >= 5 && s.count <= 15);
    if (levelBalanced) report += `- 레벨 분포가 비교적 균등하게 분포됨\n`;
    if (parseFloat(maxWR) < 75) report += `- 1위 승률(${maxWR}%)이 적절한 수준으로 단일 덱 독점 없음\n`;
    
    let tank4costCount = 0;
    getTopN(roleMeta.tank, 10).forEach(([name, cnt]) => {
        let meta = unitMeta[name];
        if (meta && meta.tier === 4 && cnt >= 2) tank4costCount += cnt;
    });
    if (tank4costCount >= 3) report += `- 4코스트 탱커가 상위권에서 활용되고 있음 (${tank4costCount}회)\n`;
    report += `\n`;
    
    // 문제점 자동 감지
    report += `### ⚠️ 문제점\n`;
    
    // 멸종 시너지 감지
    let allSyns = [...Object.keys(SYNERGIES.subjects), ...Object.keys(SYNERGIES.clubs)];
    let deadSyns = allSyns.filter(s => (synergyMeta[s] || 0) === 0);
    if (deadSyns.length > 0) report += `- **멸종 시너지**: ${deadSyns.join(', ')} (0회 등장)\n`;
    
    // 과도한 시너지 감지
    let overSyns = Object.entries(synergyMeta).filter(([,v]) => v >= 18).map(([k,v]) => `${k}(${v}회)`);
    if (overSyns.length > 0) report += `- **과도한 시너지 쏠림**: ${overSyns.join(', ')}\n`;
    
    // 단일 유닛 독점 감지
    let dominantUnits = [...getTopN(roleMeta.tank, 1), ...getTopN(roleMeta.dealer, 1)].filter(([,cnt]) => cnt >= 12);
    dominantUnits.forEach(([name, cnt]) => {
        report += `- **${name} 독점** (${cnt}/40 덱에서 채용)\n`;
    });
    
    // 미사용 유닛 감지
    let unusedUnits = Object.entries(unitMeta).filter(([,v]) => v.total === 0).map(([k]) => k);
    if (unusedUnits.length > 0) {
        report += `- **미사용 유닛 (${unusedUnits.length}개)**: ${unusedUnits.slice(0, 8).join(', ')}${unusedUnits.length > 8 ? ` 외 ${unusedUnits.length - 8}개` : ''}\n`;
    }
    report += `\n`;
    
    // --- 6. 밸런스 패치 제안 섹션 ---
    report += `---\n\n`;
    report += `## 6. 밸런스 패치 제안\n\n`;
    
    report += `### 🔧 수치 조정 제안\n\n`;
    report += `| 대상 | 조치 | 근거 |\n`;
    report += `|------|------|------|\n`;
    
    // 버프 대상 (멸종 시너지)
    deadSyns.forEach(s => {
        report += `| **${s} 시너지 (전구간)** | 📈 버프 필요 | 40위 내 0회 등장, 완전 멸종 |\n`;
    });
    
    // 너프 대상 (과도한 시너지 특정 구간)
    Object.entries(synergyLevelMeta).filter(([,v]) => v >= 12).forEach(([k, v]) => {
        let synName = k.replace(/[0-9]+$/, '');
        let lvl = k.replace(/[^0-9]/g, '');
        report += `| **${synName} ${lvl}단계** | 📉 특정구간 너프 | ${v}회로 해당 단계 쏠림 과도 |\n`;
    });
    
    // 버프 대상 (미사용 유닛 중 주요 기물)
    let lowUsageUnits = Object.entries(unitMeta).filter(([,v]) => v.total <= 1 && v.tier >= 3).map(([k, v]) => k);
    lowUsageUnits.slice(0, 5).forEach(name => {
        report += `| **${name}** | 📈 스탯/스킬 버프 | ${unitMeta[name].tier}코스트인데 채용 ${unitMeta[name].total}회 |\n`;
    });
    report += `\n`;
    
    // --- 7. 종합 평가 섹션 ---
    report += `---\n\n`;
    report += `## 7. 종합 평가\n\n`;
    
    let healthScore = 0;
    // 레벨 분포 점수 (최대 25점)
    let levelVariance = Object.values(levelStats).map(s => Math.abs(s.count - 10));
    let lvlScore = Math.max(0, 25 - levelVariance.reduce((a,b) => a+b, 0));
    healthScore += lvlScore;
    
    // 시너지 다양성 점수 (최대 25점)
    let activeSyns = allSyns.filter(s => (synergyMeta[s] || 0) > 0).length;
    let synScore = Math.round((activeSyns / allSyns.length) * 25);
    healthScore += synScore;
    
    // 승률 분포 점수 (최대 25점)
    let wrSpread = parseFloat(maxWR) - parseFloat(minWR);
    let wrScore = wrSpread < 30 ? 25 : wrSpread < 50 ? 18 : wrSpread < 70 ? 10 : 5;
    healthScore += wrScore;
    
    // 유닛 다양성 점수 (최대 25점)
    let usedUnits = Object.entries(unitMeta).filter(([,v]) => v.total > 0).length;
    let unitScore = Math.round((usedUnits / UNIT_POOL.length) * 25);
    healthScore += unitScore;
    
    let healthGrade = healthScore >= 80 ? 'S' : healthScore >= 65 ? 'A' : healthScore >= 50 ? 'B' : healthScore >= 35 ? 'C' : 'D';
    let gradeEmoji = { S: '🏆', A: '🟢', B: '🟡', C: '🟠', D: '🔴' }[healthGrade];
    
    report += `| 평가 항목 | 점수 | 기준 |\n`;
    report += `|-----------|------|------|\n`;
    report += `| 레벨 분포 균등성 | ${lvlScore}/25 | 6L~9L 각 10개가 이상적 |\n`;
    report += `| 시너지 다양성 | ${synScore}/25 | ${activeSyns}/${allSyns.length}개 시너지 활성화 |\n`;
    report += `| 승률 분포 | ${wrScore}/25 | 1위~40위 승률 편차 ${wrSpread.toFixed(1)}% |\n`;
    report += `| 유닛 다양성 | ${unitScore}/25 | ${usedUnits}/${UNIT_POOL.length}개 유닛 사용됨 |\n`;
    report += `| **종합 건강도** | **${healthScore}/100 (${healthGrade}등급)** | ${gradeEmoji} |\n`;
    report += `\n`;
    
    let targetFile = 'report_1.txt';
    if (fs.existsSync('report_1.txt') && fs.existsSync('report_2.txt')) {
        let stat1 = fs.statSync('report_1.txt');
        let stat2 = fs.statSync('report_2.txt');
        if (stat1.mtimeMs < stat2.mtimeMs) {
            targetFile = 'report_1.txt';
        } else {
            targetFile = 'report_2.txt';
        }
    } else if (fs.existsSync('report_1.txt')) {
        targetFile = 'report_2.txt';
    }

    let timestamp = new Date().toLocaleString('ko-KR');
    report = `[시뮬레이션 실행 일시: ${timestamp}]\n\n` + report;

    fs.writeFileSync(targetFile, report);
    console.log(`Simulation complete! Report saved to ${targetFile}.`);
    console.log(report.substring(0, 1500) + "\n... (생략)");
}

main();
