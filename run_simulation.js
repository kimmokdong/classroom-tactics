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
const POP_SIZE = 70;
const GENERATIONS = 70;
const BATTLES_PER_EVAL = 5;
const MUTATION_RATE = 0.3;
const TOTAL_GOLD = 200;
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
    if (prob === 0) return Infinity; // 확률 0%면 절대 불가능
    
    // 해당 티어의 유닛 종류 수 계산
    let tierCount = UNIT_POOL.filter(x => x.tier === u.tier).length;
    if (tierCount === 0) return Infinity;
    
    // 특정 기물 1개가 상점 한 칸에서 뜰 확률
    let targetProbPerSlot = prob / tierCount;
    // 1회 리롤(5칸) 당 뜰 기댓값
    let expectedPerRoll = targetProbPerSlot * 5;
    // 1장을 얻기 위해 필요한 평균 리롤 횟수
    let expectedRolls = 1 / expectedPerRoll;
    // 리롤 1번당 비용 (2골드)
    let rollCostPerCopy = expectedRolls * 2;
    
    // 분산 패널티: 3성을 찍거나 고티어 2성을 찾을 때는 평균값보다 훨씬 많은 소모가 필요함을 감안
    let varianceTax = 1.0;
    if (u.star === 3) varianceTax = 1.3;
    if (u.tier === 5 && u.star === 2) varianceTax = 1.2;
    
    let totalRollCost = rollCostPerCopy * copies * varianceTax;
    
    return base + totalRollCost;
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

function enforceStarConstraints(deck, type) {
    // 4, 5코는 어떤 레벨 덱에서도 3성 금지
    deck.forEach(u => {
        if (u.tier >= 4) u.star = 2;
    });
    
    if (type === '6L') {
        // 6렙: 2코 우선으로 4개 3성. 3코도 가능하나 4,5코는 절대 불가
        let allowedCandidates = deck
            .map((u, idx) => ({ u, idx }))
            .filter(x => x.u.tier <= 3) // 3코 이하만 3성 가능
            .sort((a,b) => {
                if (a.u.tier === 2 && b.u.tier !== 2) return -1;
                if (a.u.tier !== 2 && b.u.tier === 2) return 1;
                return a.u.tier - b.u.tier;
            });
        // 먼저 전부 2성으로 초기화(3코 이하만)
        allowedCandidates.forEach(x => deck[x.idx].star = 2);
        // 상위 4개만 3성
        for(let i = 0; i < Math.min(4, allowedCandidates.length); i++) {
            deck[allowedCandidates[i].idx].star = 3;
        }
    } else if (type === '7L') {
        // 7렙: 3코 우선으로 3개 3성. 4,5코는 절대 불가
        let allowedCandidates = deck
            .map((u, idx) => ({ u, idx }))
            .filter(x => x.u.tier <= 3) // 3코 이하만 3성 가능
            .sort((a,b) => {
                if (a.u.tier === 3 && b.u.tier !== 3) return -1;
                if (a.u.tier !== 3 && b.u.tier === 3) return 1;
                return b.u.tier - a.u.tier;
            });
        allowedCandidates.forEach(x => deck[x.idx].star = 2);
        for(let i = 0; i < Math.min(3, allowedCandidates.length); i++) {
            deck[allowedCandidates[i].idx].star = 3;
        }
    } else {
        // 8, 9렙은 3코 이하만 3성 가능 (이미 위에서 4,5코 2성 처리됨)
        deck.forEach(u => { if (u.tier <= 3) u.star = 2; });
    }
}

function assignItems(deck, type) {
    enforceStarConstraints(deck, type);
    
    let units = deck.map((u, i) => {
        let isTank = Array.isArray(u.role) && u.role.includes('tank');
        let isDealer = Array.isArray(u.role) && u.role.includes('dealer');
        let isSupport = Array.isArray(u.role) && u.role.includes('support');
        
        // AD 판별: 포지션에 '물리'나 '공격력'이 있으면 AD, 아니면 기본 스탯 의존
        let isAD = false;
        if (u.position && (u.position.includes('물리') || u.position.includes('공격력'))) {
            isAD = true;
        } else if (u.stats.ad > 60 && (!u.position || u.position === '')) {
            isAD = true;
        }

        // 점수: 3성이면 +50, 코스트(티어)로 기본 가중치
        let score = u.star * 10 + u.tier;
        if (u.star === 3) score += 50;
        return { idx: i, u, score, isTank, isDealer, isSupport, isAD };
    });
    
    // 점수(성급/코스트) 순으로 내림차순 정렬
    units.sort((a,b) => b.score - a.score);
    
    let tanks = units.filter(x => x.isTank);
    
    // 탱커 역할을 가진 유닛이 한 명도 없다면, 임시 탱커 강제 지정 (5단계 우선순위)
    if (tanks.length === 0) {
        let byPriority = [...units].sort((a, b) => {
            if (a.u.stats.range !== b.u.stats.range) return a.u.stats.range - b.u.stats.range;
            if (a.u.star !== b.u.star) return b.u.star - a.u.star;
            if (a.u.tier !== b.u.tier) return b.u.tier - a.u.tier;
            if (a.u.stats.hp !== b.u.stats.hp) return b.u.stats.hp - a.u.stats.hp;
            return (b.u.stats.armor + b.u.stats.mr) - (a.u.stats.armor + a.u.stats.mr);
        });
        tanks = [byPriority[0]];
    }
    
    let mainTank = tanks[0];
    
    // 메인 탱커를 제외한 나머지 풀에서 딜러/서포터 추출
    let nonTanks = units.filter(x => x !== mainTank);
    
    // 메인 딜러 선정: 찐 딜러 > 서포터 > 아무나
    let dealers = nonTanks.filter(x => x.isDealer);
    let mainDps = dealers[0];
    if (!mainDps) {
        let supports = nonTanks.filter(x => x.isSupport);
        mainDps = supports[0] || nonTanks[0] || units[1];
    }
    
    // 서브 에이스: 메인탱과 메인딜 제외하고 가장 점수 높은 유닛
    let remaining = units.filter(x => x !== mainTank && x !== mainDps);
    let subDps = remaining[0];
    
    // 아이템 부여 (기존 템 초기화 후 재할당)
    deck.forEach(u => u.items = []);
    if (mainTank) deck[mainTank.idx].items = [...TANK_ITEMS];
    if (mainDps) deck[mainDps.idx].items = mainDps.isAD ? [...AD_ITEMS] : [...AP_ITEMS];
    if (subDps && subDps !== mainTank && subDps !== mainDps) deck[subDps.idx].items = subDps.isAD ? [...AD_ITEMS] : [...AP_ITEMS];
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
        if (!synData) return 0;
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

function getDeckSignature(deck) {
    let name = getDeckName(deck);
    let cores = deck.filter(u => u.items && u.items.length > 0).map(u => u.name).sort().join('-');
    return `${name}__${cores}`;
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
    
    pop.sort((a,b) => b.fitness - a.fitness);
    
    let uniqueDecks = [];
    let seenSigs = new Set();
    
    for (let p of pop) {
        let sig = getDeckSignature(p.deck);
        if (!seenSigs.has(sig)) {
            seenSigs.add(sig);
            uniqueDecks.push(p.deck);
        }
        if (uniqueDecks.length >= 10) break;
    }
    
    if (uniqueDecks.length < 10) {
        for (let p of pop) {
            if (!uniqueDecks.includes(p.deck)) {
                uniqueDecks.push(p.deck);
            }
            if (uniqueDecks.length >= 10) break;
        }
    }
    
    return uniqueDecks;
}

function runGAForType(type, popSize, generations) {
    let population = [];
    for(let i=0; i<popSize; i++) {
        let d = generateRandomDeck(type);
        assignItems(d, type);
        population.push({ deck: d, wins: 0, matches: 0, type });
    }
    
    for(let g=0; g<generations; g++) {
        population.forEach(p => { p.wins = 0; p.matches = 0; });
        for(let i=0; i<population.length; i++) {
            let cost = estimateCost(population[i].deck, type);
            if (cost > TOTAL_GOLD) {
                population[i].wins = -9999; // Budget exceeded, eliminate
                continue;
            }
            for(let m=0; m<BATTLES_PER_EVAL; m++) {
                let j = Math.floor(Math.random() * population.length);
                if(i === j) continue;
                if(fight(population[i].deck, population[j].deck)) {
                    population[i].wins++;
                } else {
                    population[j].wins++;
                }
                population[i].matches++;
                population[j].matches++;
            }
        }
        population.sort((a,b) => b.wins - a.wins);
        
        let newPop = [];
        let elites = population.slice(0, Math.floor(popSize * 0.2));
        newPop.push(...elites.map(e => ({ deck: JSON.parse(JSON.stringify(e.deck)), wins: 0, matches: 0, type })));
        
        while(newPop.length < popSize) {
            let p1 = elites[Math.floor(Math.random() * elites.length)].deck;
            let p2 = elites[Math.floor(Math.random() * elites.length)].deck;
            let child = [];
            
            p1.forEach(u => { if(Math.random() < 0.5) child.push(Object.assign({}, u)); });
            p2.forEach(u => { 
                if(child.length < (type==='6L'?6:type==='7L'?7:type==='8L'?8:9) && !child.find(c => c.id === u.id)) {
                    child.push(Object.assign({}, u));
                }
            });
            
            if(Math.random() < MUTATION_RATE) {
                if(child.length > 0) {
                    child.splice(Math.floor(Math.random() * child.length), 1);
                    let pool = UNIT_POOL.filter(u => !child.find(c => c.id === u.id));
                    if(pool.length > 0) {
                        let nu = Object.assign({}, pool[Math.floor(Math.random() * pool.length)]);
                        nu.star = 2;
                        child.push(nu);
                    }
                }
            }
            
            while(child.length < (type==='6L'?6:type==='7L'?7:type==='8L'?8:9)) {
                let pool = UNIT_POOL.filter(u => !child.find(c => c.id === u.id));
                let nu = Object.assign({}, pool[Math.floor(Math.random() * pool.length)]);
                nu.star = 2;
                child.push(nu);
            }
            
            assignItems(child, type);
            newPop.push({ deck: child, wins: 0, matches: 0, type });
        }
        population = newPop;
    }
    
    population.forEach(p => { p.wins = 0; p.matches = 0; });
    for(let i=0; i<population.length; i++) {
        let costI = estimateCost(population[i].deck, type);
        if (costI > TOTAL_GOLD) {
            population[i].wins = -9999;
            continue;
        }
        for(let j=i+1; j<population.length; j++) {
            let costJ = estimateCost(population[j].deck, type);
            if (costJ > TOTAL_GOLD) {
                population[j].wins = -9999;
                continue;
            }
            if(fight(population[i].deck, population[j].deck)) {
                population[i].wins++;
            } else {
                population[j].wins++;
            }
            population[i].matches++;
            population[j].matches++;
        }
    }
    population.sort((a,b) => b.wins - a.wins);
    
    // deduplicate by signature
    let uniqueDecks = [];
    let seenSigs = new Set();
    
    for (let p of population) {
        let sig = getDeckSignature(p.deck);
        if (!seenSigs.has(sig)) {
            seenSigs.add(sig);
            p.wins = 0;
            p.matches = 0;
            uniqueDecks.push(p);
        }
        if (uniqueDecks.length >= 10) break;
    }
    
    if (uniqueDecks.length < 10) {
        for (let p of population) {
            if (!uniqueDecks.includes(p)) {
                p.wins = 0;
                p.matches = 0;
                uniqueDecks.push(p);
            }
            if (uniqueDecks.length >= 10) break;
        }
    }
    
    return uniqueDecks;
}

function getUnitByName(name, star=2) {
    let base = UNIT_POOL.find(u => u.name === name);
    if (!base) return null;
    let u = JSON.parse(JSON.stringify(base));
    u.star = star;
    return u;
}

function buildCustomDeck(type, unitNames) {
    let deck = unitNames.map(n => getUnitByName(n, 2)).filter(u => u !== null);
    assignItems(deck, type);
    return { deck, wins: 0, matches: 0, type };
}

function main() {
    console.log("Generating top 10 decks for each level via GA...");
    let pop6L = runGAForType('6L', POP_SIZE, GENERATIONS);
    let pop7L = runGAForType('7L', POP_SIZE, GENERATIONS);
    let pop8L = runGAForType('8L', POP_SIZE, GENERATIONS);
    let pop9L = runGAForType('9L', POP_SIZE, GENERATIONS);
    
    let results = [...pop6L, ...pop7L, ...pop8L, ...pop9L];
    
    console.log("Adding 5 custom optimized decks...");
    let custom1 = buildCustomDeck('6L', ['과학탐구원', '칠판 낙서꾼', '골목대장', '발명품 매니아', '미친 과학자', '천재 퀀트']);
    let custom2 = buildCustomDeck('7L', ['찰흙 조각가', '골목대장', '발명품 매니아', '미술 치료사', '양호실 도우미', '수채화 장인', '피카소의 재림']);
    let custom3 = buildCustomDeck('8L', ['달리기 선수', '과학탐구원', '체육부장', '바른생활 사나이', '수학천재', '올림피아드 금상', '육상부 에이스', '전교 체육부장']);
    let custom4 = buildCustomDeck('8L', ['복도 지킴이', '국어부장', '문학소녀', '양호실 도우미', '시조 읊는 선비', '전교 학생회장', '나이팅게일', '교장 선생님']);
    let custom5 = buildCustomDeck('9L', ['복도 지킴이', '국어부장', '문학소녀', '양호실 도우미', '시조 읊는 선비', '전교 학생회장', '나이팅게일', '교장 선생님', '수석 연구원']);
    
    results.push(custom1, custom2, custom3, custom4, custom5);
    
    console.log(`Starting Round Robin Tournament for ${results.length} decks (2 matches each)...`);
    for(let i=0; i<results.length; i++) {
        for(let j=i+1; j<results.length; j++) {
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
    rankSection += `## 🏆 최종 순위 통계 (Top 45)\n\n`;
    rankSection += `| 순위 | 덱 타입 | 덱 명칭 | 승률 | 🛡️ 메인 탱커 | ⚔️ 메인 딜러 | 🪄 서브 에이스 |\n`;
    rankSection += `|---|---|---|---|---|---|---|\n`;
    
    for(let i=0; i<results.length; i++) {
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
        let typeStr = r.type;
        if ([custom1, custom2, custom3, custom4, custom5].includes(r)) {
            typeStr = `**${r.type}(유저)**`;
        }
        rankSection += `| **${i+1}위** | ${typeStr} | **${dname}** | ${winrate}% | ${unitDesc(tanks[0])} | ${unitDesc(dpss[0])} | ${unitDesc(dpss[1])} |\n`;
        
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
    let allWinrates = results.map(r => ((r.wins / r.matches) * 100));
    let minWR = Math.min(...allWinrates).toFixed(1);
    let maxWR = Math.max(...allWinrates).toFixed(1);
    
    report += rankSection;
    report += `---\n\n`;
    report += `## 1. 전체 개요\n\n`;
    report += `| 항목 | 내용 |\n|------|------|\n`;
    report += `| 총 덱 수 | ${results.length}개 |\n`;
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
        let pct = ((st.count / results.length) * 100).toFixed(0);
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
    report += `| 시너지 | 등장 횟수 | 시너지 | 등장 횟수 |\n`;
    report += `|---|---|---|---|\n`;
    let subKeys = Object.keys(SYNERGIES.subjects);
    for(let i=0; i<subKeys.length; i+=2) {
        let s1 = subKeys[i];
        let c1 = synergyMeta[s1] || 0;
        let s2 = subKeys[i+1];
        let c2 = s2 ? (synergyMeta[s2] || 0) : '-';
        report += `| **${s1}** | ${c1} | **${s2||''}** | ${c2} |\n`;
    }
    report += `\n`;
    
    // 동아리(Club) 시너지
    report += `### 📌 동아리(Club) 시너지 등장 횟수\n\n`;
    report += `| 시너지 | 등장 횟수 | 시너지 | 등장 횟수 |\n`;
    report += `|---|---|---|---|\n`;
    let clubKeys = Object.keys(SYNERGIES.clubs);
    for(let i=0; i<clubKeys.length; i+=2) {
        let s1 = clubKeys[i];
        let c1 = synergyMeta[s1] || 0;
        let s2 = clubKeys[i+1];
        let c2 = s2 ? (synergyMeta[s2] || 0) : '-';
        report += `| **${s1}** | ${c1} | **${s2||''}** | ${c2} |\n`;
    }
    report += `\n`;
    
    // --- 4. 핵심 기물(유닛) 분석 섹션 ---
    report += `---\n\n`;
    report += `## 4. 핵심 기물(유닛) 분석\n\n`;
    
    const getTopN = (obj, n) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0, n);
    
    report += `### 🛡️ 메인 탱커 채용률\n`;
    report += `| 순위 | 유닛 명칭 | 채용 횟수 |\n|---|---|---|\n`;
    getTopN(roleMeta.tank, 5).forEach(([k,v], idx) => report += `| ${idx+1}위 | **${k}** | ${v}회 |\n`);
    report += `\n`;
    
    report += `### ⚔️ 메인 딜러 채용률\n`;
    report += `| 순위 | 유닛 명칭 | 채용 횟수 |\n|---|---|---|\n`;
    getTopN(roleMeta.dealer, 5).forEach(([k,v], idx) => report += `| ${idx+1}위 | **${k}** | ${v}회 |\n`);
    report += `\n`;
    
    report += `### 🪄 서브 에이스 채용률\n`;
    report += `| 순위 | 유닛 명칭 | 채용 횟수 |\n|---|---|---|\n`;
    getTopN(roleMeta.subAce, 5).forEach(([k,v], idx) => report += `| ${idx+1}위 | **${k}** | ${v}회 |\n`);
    report += `\n`;
    
    // --- 5. 주요 발견 사항 섹션 ---
    report += `---\n\n`;
    report += `## 5. 주요 발견 사항\n\n`;
    
    report += `### ✅ 긍정적 변화\n`;
    // 골고루 채용되는 코어 유닛
    let wellUsed = Object.entries(unitMeta).filter(([,v]) => v.carry >= 3).length;
    if (wellUsed > 10) report += `- 다양한 핵심 기물 활용: 총 ${wellUsed}개의 기물이 3회 이상 캐리로 활약했습니다.\n`;
    else report += `- 없음\n`;
    report += `\n`;
    
    report += `### ⚠️ 문제점\n`;
    let allSyns = [...Object.keys(SYNERGIES.subjects), ...Object.keys(SYNERGIES.clubs)];
    let deadSyns = allSyns.filter(s => (synergyMeta[s] || 0) === 0);
    if (deadSyns.length > 0) report += `- **멸종 시너지**: ${deadSyns.join(', ')} (0회 등장)\n`;
    
    // 과도한 시너지 감지
    let overSyns = Object.entries(synergyMeta).filter(([,v]) => v >= 18).map(([k,v]) => `${k}(${v}회)`);
    if (overSyns.length > 0) report += `- **과도한 시너지 쏠림**: ${overSyns.join(', ')}\n`;
    
    // 단일 유닛 독점 감지
    let dominantUnits = [...getTopN(roleMeta.tank, 1), ...getTopN(roleMeta.dealer, 1)].filter(([,cnt]) => cnt >= 12);
    dominantUnits.forEach(([name, cnt]) => {
        report += `- **${name} 독점** (${cnt}/45 덱에서 채용)\n`;
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
        report += `| **${s} 시너지 (전구간)** | 📈 버프 필요 | 45위 내 0회 등장, 완전 멸종 |\n`;
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
    let levelVariance = Object.values(levelStats).map(s => Math.abs(s.count - 11)); // average ~11
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
    report += `| 레벨 분포 균등성 | ${lvlScore}/25 | 6L~9L 각 10~12개가 이상적 |\n`;
    report += `| 시너지 다양성 | ${synScore}/25 | ${activeSyns}/${allSyns.length}개 시너지 활성화 |\n`;
    report += `| 승률 분포 | ${wrScore}/25 | 1위~45위 승률 편차 ${wrSpread.toFixed(1)}% |\n`;
    report += `| 유닛 다양성 | ${unitScore}/25 | ${usedUnits}/${UNIT_POOL.length}개 유닛 사용됨 |\n`;
    report += `| **종합 건강도** | **${healthScore}/100 (${healthGrade}등급)** | ${gradeEmoji} |\n`;
    report += `\n`;
    
    function parseReportText(content) {
        let lines = content.split('\n');
        let decks = {}; // name -> rank
        let top10Synergies = [];
        let top10Units = [];
        for (let line of lines) {
            if (line.includes('| **') && line.includes('위** |')) {
                let cols = line.split('|').map(s => s.trim());
                if (cols.length >= 7) {
                    let rankStr = cols[1];
                    let rank = parseInt(rankStr.replace(/\D/g, ''));
                    let deckName = cols[3].replace(/\*/g, '');
                    let tank = cols[5] ? cols[5].split('(')[0].trim() : '-';
                    let dealer = cols[6] ? cols[6].split('(')[0].trim() : '-';
                    let sub = cols[7] ? cols[7].split('(')[0].trim() : '-';
                    
                    decks[deckName] = rank;
                    if (rank <= 10) {
                        let syns = deckName.split('_').map(s => s.replace(/\d+/g, ''));
                        top10Synergies.push(...syns);
                        if (tank && tank !== '-') top10Units.push(tank);
                        if (dealer && dealer !== '-') top10Units.push(dealer);
                        if (sub && sub !== '-') top10Units.push(sub);
                    }
                }
            }
        }
        return { decks, top10Synergies, top10Units };
    }

    let targetFile = 'report_1.txt';
    let files = ['report_1.txt', 'report_2.txt', 'report_3.txt'];
    let existingFiles = files.filter(f => fs.existsSync(f));
    let prev1File = null;
    let prev2File = null;

    if (existingFiles.length > 0) {
        let sortedFiles = existingFiles.map(f => {
            return { file: f, mtime: fs.statSync(f).mtimeMs };
        }).sort((a, b) => b.mtime - a.mtime);

        if (sortedFiles.length === 1) {
            targetFile = 'report_2.txt';
            prev1File = sortedFiles[0].file;
        } else if (sortedFiles.length === 2) {
            targetFile = 'report_3.txt';
            prev1File = sortedFiles[0].file;
            prev2File = sortedFiles[1].file;
        } else {
            targetFile = sortedFiles[2].file;
            prev1File = sortedFiles[0].file;
            prev2File = sortedFiles[1].file;
        }
    }

    let comparisonReport = '';
    let p1Data = null, p2Data = null;

    if (prev1File) {
        p1Data = parseReportText(fs.readFileSync(prev1File, 'utf-8'));
    }
    if (prev2File) {
        p2Data = parseReportText(fs.readFileSync(prev2File, 'utf-8'));
    }

    if (p1Data && p2Data) {
        let currData = parseReportText(rankSection);
        
        let allSyns = [...currData.top10Synergies, ...p1Data.top10Synergies, ...p2Data.top10Synergies];
        let allUnits = [...currData.top10Units, ...p1Data.top10Units, ...p2Data.top10Units];
        
        let synCounts = {};
        allSyns.forEach(s => synCounts[s] = (synCounts[s] || 0) + 1);
        let unitCounts = {};
        allUnits.forEach(u => unitCounts[u] = (unitCounts[u] || 0) + 1);
        
        let opSyns = Object.entries(synCounts).sort((a,b)=>b[1]-a[1]).slice(0, 5);
        let opUnits = Object.entries(unitCounts).sort((a,b)=>b[1]-a[1]).slice(0, 5);
        
        comparisonReport += `\n---\n\n## 🔍 3연속 교차 검증 OP 추출 (Top 10 기준)\n\n`;
        comparisonReport += `> 최근 3번의 시뮬레이션 중 상위 10위권 덱에서 공통적으로 자주 기용된 핵심 요소입니다.\n\n`;
        
        comparisonReport += `### 🚨 요주의 시너지 TOP 5\n`;
        comparisonReport += `| 순위 | 시너지 명칭 | 3연속 Top10 등장 횟수 |\n`;
        comparisonReport += `|---|---|---|\n`;
        opSyns.forEach((s, idx) => comparisonReport += `| **${idx+1}위** | **${s[0]}** | ${s[1]}회 |\n`);
        
        comparisonReport += `\n### 🚨 요주의 핵심 유닛 TOP 5\n`;
        comparisonReport += `| 순위 | 유닛 명칭 | 3연속 Top10 기용 횟수 |\n`;
        comparisonReport += `|---|---|---|\n`;
        opUnits.forEach((u, idx) => comparisonReport += `| **${idx+1}위** | **${u[0]}** | ${u[1]}회 |\n`);
        
        comparisonReport += `\n`;
    }

    comparisonReport += `\n---\n\n## 🔄 교차 검증 순위 비교 (전체 순위)\n\n`;
    comparisonReport += `| 현재 순위 | 덱 명칭 | 1회 전 순위 | 2회 전 순위 |\n`;
    comparisonReport += `|---|---|---|---|\n`;
    
    for (let i = 0; i < results.length; i++) {
        let deckName = getDeckName(results[i].deck);
        let currentRank = i + 1;
        let r1Str = p1Data && p1Data.decks[deckName] ? `${p1Data.decks[deckName]}위` : '-';
        let r2Str = p2Data && p2Data.decks[deckName] ? `${p2Data.decks[deckName]}위` : '-';
        comparisonReport += `| **${currentRank}위** | **${deckName}** | ${r1Str} | ${r2Str} |\n`;
    }
    comparisonReport += `\n`;

    report += comparisonReport;

    let timestamp = new Date().toLocaleString('ko-KR');
    
    // Add prefix
    let prefix = `> [골드 예산] / [날짜] 기준
> 🕒 **리포트 제출 시간**: ${timestamp}

---

`;
    
    report = prefix + report;

    fs.writeFileSync(targetFile, report);
    console.log(`Simulation complete! Report saved to ${targetFile}.`);
    console.log(report.substring(0, 1500) + "\n... (생략)");
}


main();

