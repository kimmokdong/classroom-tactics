import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from './js/data.js';
import { ITEMS } from './js/items.js';
import { BattleEngine } from './js/battleEngine.js';
import { SynergyManager } from './js/systems/SynergyManager.js';

const TIER_POOL_SIZES = { 1: 10, 2: 10, 3: 9, 4: 7, 5: 4 };
const SHOP_PROBS = {
    7: [19, 30, 35, 15, 1],
    8: [15, 20, 35, 25, 5],
    9: [10, 15, 30, 30, 15]
};

const mockApp = { state: { globalBuffs: {} }, ITEMS: ITEMS };
const synManager = new SynergyManager(mockApp);

const BIS_ITEMS = {
    AP_CARRY: ['comb_ap_ap', 'comb_ap_crit', 'comb_mana_mana'],
    AD_CARRY: ['comb_ad_ad', 'comb_as_crit', 'comb_ad_mr'],
    AS_CARRY: ['comb_as_as', 'comb_ad_as', 'comb_ad_mr'],
    AD_CRIT: ['comb_ad_ad', 'comb_ad_crit', 'comb_as_crit'],
    TANK: ['comb_hp_hp', 'comb_armor_armor', 'comb_mr_mr']
};

function getHeuristicScores(u) {
    let tankScore = u.stats.hp / 100;
    if (u.stats.range <= 1) tankScore += 5;
    if (u.skill.type.includes('shield') || u.skill.type.includes('taunt') || u.skill.type.includes('heal') || u.skill.type.includes('cc')) tankScore += 10;
    
    let adScore = u.stats.ad / 10;
    if (u.skill.adRatio) adScore += 10;
    if (u.club === '육상부' || u.club === '장난꾸러기' || u.club === '방송부') adScore += 5;

    let apScore = (u.stats.ap || 100) / 20; 
    if (u.skill.apRatio) apScore += 10;
    if (u.stats.range >= 2) apScore += 3;
    if (['국어', '과학', '미술', '음악', '영어'].includes(u.subject)) apScore += 5;
    
    return { tankScore, adScore, apScore };
}

function assignItemsByRole(uData) {
    if (uData.scores.tankScore > Math.max(uData.scores.adScore, uData.scores.apScore)) {
        uData.unit.items = [...BIS_ITEMS.TANK];
        uData.roleText = '🛡️' + uData.unit.name;
    } else {
        if (uData.scores.adScore > uData.scores.apScore) {
            if (uData.club === '육상부') uData.unit.items = [...BIS_ITEMS.AS_CARRY];
            else if (uData.subject === '수학') uData.unit.items = [...BIS_ITEMS.AD_CRIT];
            else uData.unit.items = [...BIS_ITEMS.AD_CARRY];
        } else {
            uData.unit.items = [...BIS_ITEMS.AP_CARRY];
        }
        uData.roleText = '⚔️' + uData.unit.name;
    }
}

// ----------------- Monte Carlo Shop Roll -----------------
function rollShopRealistic(deck) {
    let gold = 300;
    const unitCopies = {};
    deck.units.forEach(u => unitCopies[u.id] = 1);
    
    // 초기 지급된 1마리씩의 기물값 차감
    deck.units.forEach(u => {
        const tier = UNIT_POOL.find(x => x.id === u.id).tier;
        gold -= tier;
    });

    const rollPhase = (probs, limit) => {
        while (gold >= 2 && (limit === undefined || gold > limit)) {
            gold -= 2;
            for (let s = 0; s < 5; s++) {
                const rand = Math.random() * 100;
                let rolledTier = 1, pSum = 0;
                for (let t = 0; t < 5; t++) {
                    pSum += probs[t];
                    if (rand < pSum) { rolledTier = t + 1; break; }
                }
                const poolUnits = deck.units.filter(u => UNIT_POOL.find(x => x.id === u.id).tier === rolledTier);
                if (poolUnits.length > 0) {
                    for (let poolU of poolUnits) {
                        if (Math.random() < (1 / TIER_POOL_SIZES[rolledTier])) {
                            const isTarget = deck.strategy === 7 && deck.rerollTargets && deck.rerollTargets.includes(poolU.id);
                            const maxCopies = isTarget ? 9 : 3;
                            if (unitCopies[poolU.id] < maxCopies && gold >= rolledTier) {
                                gold -= rolledTier;
                                unitCopies[poolU.id]++;
                            }
                            break;
                        }
                    }
                }
            }
        }
    };

    let finalLevel = deck.strategy;
    
    if (deck.strategy === 7) {
        gold -= 70; 
        while (gold >= 2) {
            let targetsHit = deck.rerollTargets.filter(id => unitCopies[id] >= 9).length;
            if (targetsHit >= 3) break;
            
            gold -= 2;
            const probs = SHOP_PROBS[7];
            for (let s = 0; s < 5; s++) {
                const rand = Math.random() * 100;
                let rolledTier = 1, pSum = 0;
                for (let t = 0; t < 5; t++) {
                    pSum += probs[t];
                    if (rand < pSum) { rolledTier = t + 1; break; }
                }
                const poolUnits = deck.units.filter(u => UNIT_POOL.find(x => x.id === u.id).tier === rolledTier);
                if (poolUnits.length > 0) {
                    for (let poolU of poolUnits) {
                        if (Math.random() < (1 / TIER_POOL_SIZES[rolledTier])) {
                            const isTarget = deck.strategy === 7 && deck.rerollTargets && deck.rerollTargets.includes(poolU.id);
                            const maxCopies = isTarget ? 9 : 3;
                            if (unitCopies[poolU.id] < maxCopies && gold >= rolledTier) {
                                gold -= rolledTier;
                                unitCopies[poolU.id]++;
                            }
                            break;
                        }
                    }
                }
            }
        }
        
        let targetsHit = deck.rerollTargets.filter(id => unitCopies[id] >= 9).length;
        if (targetsHit >= 3 && gold >= 50) {
            gold -= 50;
            finalLevel = 8;
            rollPhase(SHOP_PROBS[8]);
        } else {
            finalLevel = 7;
        }
    } else if (deck.strategy === 8) {
        gold -= 120;
        rollPhase(SHOP_PROBS[8]);
    } else if (deck.strategy === 9) {
        gold -= 200;
        rollPhase(SHOP_PROBS[9]);
    }

    const starLevels = {};
    for (const [id, copies] of Object.entries(unitCopies)) {
        if (copies >= 9 && deck.strategy === 7) starLevels[id] = 3;
        else if (copies >= 3) starLevels[id] = 2;
        else starLevels[id] = 1;
    }
    return { starLevels, finalLevel };
}

function instantiateDeck(deck) {
    const { starLevels, finalLevel } = rollShopRealistic(deck);
    const board = Array(24).fill(null);
    let unitsData = [];

    // 필드에 올릴 유닛 필터링 (7렙이면 1명 제외)
    let fieldedUnits = [...deck.units];
    if (deck.strategy === 7 && finalLevel === 7) {
        let nonTargets = fieldedUnits.filter(u => !deck.rerollTargets.includes(u.id));
        nonTargets.sort((a, b) => {
            const tierA = UNIT_POOL.find(x => x.id === a.id).tier;
            const tierB = UNIT_POOL.find(x => x.id === b.id).tier;
            return tierA - tierB;
        });
        const toRemove = nonTargets[0];
        fieldedUnits = fieldedUnits.filter(u => u.id !== toRemove.id);
    }

    for (let uDef of fieldedUnits) {
        const baseUnit = UNIT_POOL.find(u => u.id === uDef.id);
        const cloned = JSON.parse(JSON.stringify(baseUnit));
        const star = starLevels[baseUnit.id] || 1;
        cloned.star = star;
        const multiplier = star === 3 ? 3.24 : (star === 2 ? 1.8 : 1.0);
        
        cloned.stats.hp = Math.floor(cloned.stats.hp * multiplier);
        cloned.stats.maxHp = cloned.stats.hp;
        cloned.currHp = cloned.stats.hp;
        cloned.stats.ad = Math.floor(cloned.stats.ad * multiplier);
        cloned.currMana = cloned.stats.mana || 0;
        cloned.stats.maxMana = cloned.stats.maxMana || cloned.stats.mana || 0;
        cloned.currShield = 0;
        cloned.combat = { shield: 0, vamp: 0, dmgAmp: 0, critChance: 0.10, critDmg: 1.5, dmgReduc: 0, itemEffects: {} };
        cloned.items = [];
        
        let gIdx = uDef.gridIndex !== undefined ? uDef.gridIndex : Math.floor(Math.random() * 24);
        while(board[gIdx]) { gIdx = (gIdx + 1) % 24; }
        cloned.gridIndex = gIdx;
        board[gIdx] = cloned;
        
        unitsData.push({ unit: cloned, tier: baseUnit.tier, scores: getHeuristicScores(baseUnit), id: baseUnit.id, club: baseUnit.club, subject: baseUnit.subject });
    }

    // 아이템 배분 로직 (9 코어템) - 전 전략 공통 적용 (탱커 1순위 배분)
    let core3 = [];
    
    unitsData.sort((a, b) => (b.scores.tankScore + b.tier * 10 + b.unit.star * 15) - (a.scores.tankScore + a.tier * 10 + a.unit.star * 15));
    const mainTank = unitsData[0];
    mainTank.unit.items = [...BIS_ITEMS.TANK];
    mainTank.isMainTank = true;
    mainTank.roleText = '🛡️' + mainTank.unit.name;
    core3.push(mainTank);

    const carries = unitsData.filter(u => !u.isMainTank);
    carries.sort((a, b) => (Math.max(b.scores.adScore, b.scores.apScore) + b.tier * 10 + b.unit.star * 15) - (Math.max(a.scores.adScore, a.scores.apScore) + a.tier * 10 + a.unit.star * 15));
    const mainCarry = carries[0];
    mainCarry.isMainCarry = true;
    assignItemsByRole(mainCarry);
    mainCarry.roleText = '👑' + mainCarry.unit.name;
    core3.push(mainCarry);

    const subs = carries.filter(u => !u.isMainCarry);
    subs.sort((a, b) => {
        const scoreB = Math.max(b.scores.tankScore, b.scores.adScore, b.scores.apScore) + b.tier * 10 + b.unit.star * 15;
        const scoreA = Math.max(a.scores.tankScore, a.scores.adScore, a.scores.apScore) + a.tier * 10 + a.unit.star * 15;
        return scoreB - scoreA;
    });
    const subAce = subs[0];
    assignItemsByRole(subAce);
    subAce.roleText = '🌟' + subAce.unit.name;
    core3.push(subAce);

    const synData = synManager.getSynergyData(board);
    const activeSyns = [];
    
    for (const [subj, count] of Object.entries(synData.subjects)) {
        const levels = Object.keys(SYNERGIES.subjects[subj]?.levels || {});
        let maxLvl = 0;
        levels.forEach(l => { if (count >= Number(l)) maxLvl = Number(l); });
        if (SYNERGIES.subjects[subj]?.exactMatch) maxLvl = levels.includes(String(count)) ? count : 0;
        if (maxLvl > 0) activeSyns.push({ name: subj, count: maxLvl });
    }
    for (const [club, count] of Object.entries(synData.clubs)) {
        const levels = Object.keys(SYNERGIES.clubs[club]?.levels || {});
        let maxLvl = 0;
        levels.forEach(l => { if (count >= Number(l)) maxLvl = Number(l); });
        if (maxLvl > 0) activeSyns.push({ name: club, count: maxLvl });
    }
    
    activeSyns.sort((a, b) => b.count - a.count);
    let synName = activeSyns.map(s => `${s.name}${s.count}`).join('_');
    if (!synName) synName = '잡탕';
    
    board.fullDeckName = `${synName} (${core3.map(c=>c.roleText).join(', ')})`;
    return board;
}

// ----------------- Genetic Algorithm -----------------

function generateRandomDeck(strategy) {
    const size = strategy === 9 ? 9 : 8;
    const units = [];
    const pool = [...UNIT_POOL];
    
    let rerollTargets = [];
    if (strategy === 7) {
        const cost3Pool = pool.filter(u => u.tier === 3);
        for(let i=0; i<3; i++) {
            const idx = Math.floor(Math.random() * cost3Pool.length);
            rerollTargets.push(cost3Pool[idx].id);
            units.push({ id: cost3Pool[idx].id, gridIndex: Math.floor(Math.random()*24) });
            cost3Pool.splice(idx, 1);
        }
    }

    while(units.length < size) {
        const candidate = pool[Math.floor(Math.random() * pool.length)];
        if (!units.find(u => u.id === candidate.id)) {
            units.push({ id: candidate.id, gridIndex: Math.floor(Math.random()*24) });
        }
    }
    
    return { strategy, units, rerollTargets };
}

function runBattle(deckA, deckB, iterations = 3) {
    let winsA = 0, winsB = 0;
    for (let i = 0; i < iterations; i++) {
        const boardA = instantiateDeck(deckA);
        const boardB = instantiateDeck(deckB);
        
        deckA.lastName = boardA.fullDeckName;
        deckB.lastName = boardB.fullDeckName;

        const synA = synManager.getSynergyData(boardA);
        const buffedA = synManager.applySynergyStats(boardA, synA, false);
        const synB = synManager.getSynergyData(boardB);
        const buffedB = synManager.applySynergyStats(boardB, synB, false);

        const engine = new BattleEngine(buffedA, buffedB);
        engine.run();
        
        let pCount = 0, eCount = 0;
        engine.board.forEach(u => {
            if (u && u.currHp > 0) {
                if (u.team === 'player') pCount++;
                else if (u.team === 'enemy') eCount++;
            }
        });
        if (pCount > 0 && eCount === 0) winsA++;
        else if (eCount > 0 && pCount === 0) winsB++;
    }
    return { winsA, winsB };
}

function crossover(p1, p2) {
    const child = { strategy: p1.strategy, units: [], rerollTargets: [...(p1.rerollTargets||[])] };
    const allUnits = [...p1.units, ...p2.units];
    // For 7L, targets are locked
    if (p1.strategy === 7) {
        p1.rerollTargets.forEach(id => {
            if (!child.units.find(u=>u.id===id)) {
                child.units.push({ id, gridIndex: Math.floor(Math.random()*24) });
            }
        });
    }
    const size = p1.strategy === 9 ? 9 : 8;
    for (let u of allUnits) {
        if (child.units.length >= size) break;
        if (!child.units.find(x => x.id === u.id)) child.units.push(u);
    }
    while(child.units.length < size) {
        const candidate = UNIT_POOL[Math.floor(Math.random() * UNIT_POOL.length)];
        if (!child.units.find(x => x.id === candidate.id)) child.units.push({ id: candidate.id, gridIndex: Math.floor(Math.random()*24) });
    }
    return child;
}

function mutate(deck) {
    const p = Math.random();
    if (p < 0.2) {
        const idx = Math.floor(Math.random() * deck.units.length);
        if (deck.strategy === 7 && deck.rerollTargets.includes(deck.units[idx].id)) return; // Don't mutate targets
        let candidate;
        do { candidate = UNIT_POOL[Math.floor(Math.random() * UNIT_POOL.length)]; } 
        while (deck.units.find(x => x.id === candidate.id));
        deck.units[idx] = { id: candidate.id, gridIndex: Math.floor(Math.random()*24) };
    }
}

async function runGA() {
    console.log('🧬 300골드 리얼 몬테카를로 GA 시작...');
    const POP_SIZE = 20;
    const GENS = 15;
    
    let pop7 = Array(POP_SIZE).fill(0).map(() => generateRandomDeck(7));
    let pop8 = Array(POP_SIZE).fill(0).map(() => generateRandomDeck(8));
    let pop9 = Array(POP_SIZE).fill(0).map(() => generateRandomDeck(9));

    for (let g = 0; g < GENS; g++) {
        console.log(`\n--- Generation ${g+1}/${GENS} ---`);
        for (let pop of [pop7, pop8, pop9]) {
            // Fitness eval against random peers in same pop
            pop.forEach(d => d.fitness = 0);
            for (let i = 0; i < POP_SIZE; i++) {
                for (let j = 0; j < 3; j++) { // 3 random opponents
                    let opp = Math.floor(Math.random() * POP_SIZE);
                    const { winsA, winsB } = runBattle(pop[i], pop[opp], 3); // 3 iterations
                    pop[i].fitness += winsA;
                    pop[opp].fitness += winsB;
                }
            }
            pop.sort((a, b) => b.fitness - a.fitness);
            
            const nextPop = pop.slice(0, 4); // Elites
            while (nextPop.length < POP_SIZE) {
                const p1 = pop[Math.floor(Math.random() * 8)];
                const p2 = pop[Math.floor(Math.random() * 8)];
                const child = crossover(p1, p2);
                mutate(child);
                nextPop.push(child);
            }
            // replace in-place
            for(let k=0; k<POP_SIZE; k++) pop[k] = nextPop[k];
        }
        console.log(`7L Elite: ${pop7[0].lastName}`);
        console.log(`8L Elite: ${pop8[0].lastName}`);
        console.log(`9L Elite: ${pop9[0].lastName}`);
    }

    console.log('\n🏆 진화 종료. 최종 풀리그 (Top 10씩 30개 덱) 시작...');
    const finalPool = [...pop7.slice(0,10), ...pop8.slice(0,10), ...pop9.slice(0,10)];
    finalPool.forEach(d => { d.wins = 0; d.matches = 0; });
    
    let matchCount = 0;
    const totalMatches = (30 * 29) / 2;
    for (let i = 0; i < 30; i++) {
        for (let j = i + 1; j < 30; j++) {
            matchCount++;
            if (matchCount%10===0) process.stdout.write(`\r결승 리그 진행률: ${matchCount}/${totalMatches}`);
            const { winsA, winsB } = runBattle(finalPool[i], finalPool[j], 30); // 30 iterations for final
            finalPool[i].wins += winsA;
            finalPool[j].wins += winsB;
            finalPool[i].matches += 30;
            finalPool[j].matches += 30;
        }
    }
    
    finalPool.forEach(s => s.winrate = s.wins / s.matches);
    finalPool.sort((a, b) => b.winrate - a.winrate);
    
    let csv = `\uFEFF실전순위,운영전략,풀시너지 덱 아키타입 및 핵심 3기물,실전 승률(몬테카를로)\n`;
    finalPool.forEach((s, idx) => {
        let stStr = s.strategy === 7 ? '7렙 3코리롤' : (s.strategy === 8 ? '8렙 스탠다드' : '9렙 패스트9');
        csv += `${idx + 1}위,${stStr},${s.lastName},${(s.winrate * 100).toFixed(1)}%\n`;
    });
    fs.writeFileSync('./scratch/ga_realistic_tier_list.csv', csv, 'utf-8');
    fs.writeFileSync('./scratch/final_decks.json', JSON.stringify(finalPool, null, 2), 'utf-8');

    console.log('\n✅ 리얼 GA 최종 티어표 저장 완료: ./scratch/ga_realistic_tier_list.csv');
}

runGA();
