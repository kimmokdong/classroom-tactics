import { BattleEngine } from '../js/battleEngine.js';
import { UNIT_POOL, SYNERGIES } from '../js/data.js';

const ROLE_CATEGORIES = {
    TANK: ['도덕', '보건부', '체육', '급식부', '사회'],
    DPS: ['수학', '선도부', '과학', '육상부', '방송부', '국어', '영어', '미술', '음악', '장난꾸러기']
};

function getSynergyRole(synName) {
    if (ROLE_CATEGORIES.TANK.includes(synName)) return 'TANK';
    if (ROLE_CATEGORIES.DPS.includes(synName)) return 'DPS';
    return 'DPS'; // default
}

function getUnitRole(unit) {
    if (ROLE_CATEGORIES.TANK.includes(unit.subject) || ROLE_CATEGORIES.TANK.includes(unit.club)) return 'TANK';
    return 'DPS';
}

// Calculate team synergies similar to game logic
function getSynergyData(team) {
    const counts = { subjects: {}, clubs: {} };
    team.forEach(u => {
        if (!u) return;
        counts.subjects[u.subject] = (counts.subjects[u.subject] || 0) + 1;
        counts.clubs[u.club] = (counts.clubs[u.club] || 0) + 1;
    });

    const active = {};
    for (const [synType, synDict] of Object.entries(SYNERGIES)) {
        for (const [synName, synData] of Object.entries(synDict)) {
            const count = counts[synType][synName] || 0;
            let activeLevel = null;
            if (synData.exactMatch) {
                if (synData.levels[count]) activeLevel = count;
            } else {
                const reqs = Object.keys(synData.levels).map(Number).sort((a,b)=>b-a);
                for (const req of reqs) {
                    if (count >= req) { activeLevel = req; break; }
                }
            }
            if (activeLevel) {
                active[synName] = { level: activeLevel, effect: synData.levels[activeLevel] };
            }
        }
    }
    return active;
}

// Apply synergy stats to a team
function applySynergyStats(board, activeSynergies, isEnemy) {
    const buffed = board.map(u => {
        if (!u) return null;
        const newU = JSON.parse(JSON.stringify(u));
        newU.combat = { shield: 0, vamp: 0, dmgAmp: 0, critChance: 0.10, critDmg: 1.5, dmgReduc: 0, itemEffects: {} };
        return newU;
    });

    let teamHpBuff = 0, teamDefBuff = 0, teamApBuff = 0;
    
    // Global team buffs pass
    for (const [synName, syn] of Object.entries(activeSynergies)) {
        const eff = syn.effect;
        if (eff.teamHp) teamHpBuff += eff.teamHp;
        if (eff.teamDef) teamDefBuff += eff.teamDef;
        if (eff.teamAp) teamApBuff += eff.teamAp;
        
        buffed.forEach(u => {
            if (!u) return;
            if (eff.allStats) {
                u.stats.maxHp *= (1 + eff.allStats);
                u.stats.hp *= (1 + eff.allStats);
                u.stats.ad *= (1 + eff.allStats);
                u.stats.ap *= (1 + eff.allStats);
                u.stats.armor *= (1 + eff.allStats);
                u.stats.mr *= (1 + eff.allStats);
            }
            if (eff.teamManaRegen) u.combat.teamManaRegen = (u.combat.teamManaRegen || 0) + eff.teamManaRegen;
        });
    }

    // Individual buffs pass
    buffed.forEach(u => {
        if (!u) return;
        u.stats.maxHp += teamHpBuff;
        u.stats.hp += teamHpBuff;
        u.stats.armor += teamDefBuff;
        u.stats.mr += teamDefBuff;
        u.stats.ap += teamApBuff;

        for (const [synName, syn] of Object.entries(activeSynergies)) {
            const eff = syn.effect;
            const hasSyn = u.subject === synName || u.club === synName;

            if (hasSyn) {
                if (eff.selfAp) u.stats.ap += eff.selfAp;
                if (eff.critChance) u.combat.critChance += eff.critChance;
                if (eff.critDmg) u.combat.critDmg += eff.critDmg;
                if (eff.skillCrit) u.combat.itemEffects.skillCrit = true;
                if (eff.dmgAmp) u.combat.dmgAmp += eff.dmgAmp;
                if (eff.manaReduc) u.stats.maxMana *= (1 - eff.manaReduc);
                if (eff.selfHpMult) {
                    u.stats.maxHp *= eff.selfHpMult;
                    u.stats.hp *= eff.selfHpMult;
                }
                if (eff.tickHeal) u.combat.tickHeal = eff.tickHeal;
                if (eff.bonusMagicDmg) u.combat.bonusMagicDmg = eff.bonusMagicDmg;
                if (eff.artManaRegen) u.combat.artManaRegen = eff.artManaRegen;
                if (eff.selfDefMult) {
                    u.stats.armor *= eff.selfDefMult;
                    u.stats.mr *= eff.selfDefMult;
                }
                if (eff.startShieldPct) u.combat.shield += u.stats.maxHp * eff.startShieldPct;
                if (eff.distAmp) u.combat.distAmp = eff.distAmp;
                if (eff.rangeBuff) u.stats.range += eff.rangeBuff;
                if (eff.maxAsBuff) u.combat.maxAsBuff = eff.maxAsBuff;
                if (eff.dmgReduc) u.combat.dmgReduc += eff.dmgReduc;
                if (eff.startShield) u.combat.shield += eff.startShield;
                if (eff.stackAdApPct) u.combat.stackAdApPct = eff.stackAdApPct;
            }
        }
        
        // 2-star scaling multiplier
        if (u.star === 2) {
            u.stats.maxHp *= 1.8;
            u.stats.hp *= 1.8;
            u.stats.ad *= 1.5;
            u.stats.ap *= 1.5;
        }
    });

    return buffed;
}

// Prepare teams
const allSynergyTiers = [];
for (const synDict of Object.values(SYNERGIES)) {
    for (const [synName, synData] of Object.entries(synDict)) {
        if (synData.exactMatch) {
            allSynergyTiers.push({ name: `${synName}(4)`, synergy: synName, count: 4 });
            continue;
        }
        for (const level of Object.keys(synData.levels)) {
            allSynergyTiers.push({ name: `${synName}(${level})`, synergy: synName, count: Number(level) });
        }
    }
}
allSynergyTiers.push({ name: `노시너지`, synergy: null, count: 8 });

// Fisher-Yates Shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function buildTeam(synName, targetCount, isEnemy) {
    let team = Array(24).fill(null);
    let members = [];
    
    let synergyPool = [];
    let fillerPool = [];

    let mainRole = 'DPS';
    if (synName) {
        mainRole = getSynergyRole(synName);
        synergyPool = UNIT_POOL.filter(u => u.subject === synName || u.club === synName);
        
        // Filler pool logic: Look for missing roles, prioritize High Cost (Tier 3-5)
        const missingRole = mainRole === 'TANK' ? 'DPS' : 'TANK';
        
        fillerPool = UNIT_POOL.filter(u => {
            if (u.subject === synName || u.club === synName) return false;
            // High priority if it matches missing role and is tier >= 3
            if (getUnitRole(u) === missingRole && u.tier >= 3) return true;
            // Also accept other high cost units just in case pool is too small
            if (u.tier >= 4) return true;
            return false;
        });
        
        // Fallback if filler pool is somehow too small (very unlikely with 38 units)
        if (fillerPool.length < 8) {
            const backup = UNIT_POOL.filter(u => u.subject !== synName && u.club !== synName);
            fillerPool = fillerPool.concat(backup);
        }
    } else {
        fillerPool = [...UNIT_POOL];
    }
    
    // Pick unique units from the synergy pool
    if (synName && targetCount > 0) {
        shuffleArray(synergyPool);
        let picked = 0;
        while(picked < targetCount) {
            for (let i = 0; i < synergyPool.length && picked < targetCount; i++) {
                members.push(JSON.parse(JSON.stringify(synergyPool[i])));
                picked++;
            }
        }
    }

    // Fill the rest with smart fillers
    shuffleArray(fillerPool);
    let p = 0;
    while (members.length < 8) {
        members.push(JSON.parse(JSON.stringify(fillerPool[p % fillerPool.length])));
        p++;
    }

    // Setup base stats
    for (let i = 0; i < 8; i++) {
        members[i].star = 2; // All 2-star
        members[i].team = isEnemy ? 'enemy' : 'player';
    }
    
    const startIndex = isEnemy ? 0 : 16;
    for (let i = 0; i < 8; i++) {
        team[startIndex + i] = members[i];
    }
    return team;
}

function runMatchup(teamAInfo, teamBInfo, iterations = 30) {
    let winsA = 0, winsB = 0;
    
    for (let i = 0; i < iterations; i++) {
        let boardA = buildTeam(teamAInfo.synergy, teamAInfo.count, false);
        let boardB = buildTeam(teamBInfo.synergy, teamBInfo.count, true);
        
        const synA = getSynergyData(boardA.filter(u => u));
        const synB = getSynergyData(boardB.filter(u => u));
        
        let buffedA = applySynergyStats(boardA, synA, false);
        let buffedB = applySynergyStats(boardB, synB, true);
        
        const engine = new BattleEngine(buffedA, buffedB);
        const originalLog = console.log;
        console.log = () => {};
        engine.run();
        console.log = originalLog;
        
        let aliveA = engine.board.slice(24).filter(u => u && u.currHp > 0).length;
        let aliveB = engine.board.slice(0, 24).filter(u => u && u.currHp > 0).length;
        
        if (aliveA > aliveB) winsA++;
        else if (aliveB > aliveA) winsB++;
        else {
            winsA += 0.5;
            winsB += 0.5;
        }
    }
    return { winsA, winsB };
}

console.log("=== 지능형 역할군 기반 메타 시뮬레이터 시작 (Ultimate AI Draft) ===");
console.log(`시너지 조합 수: ${allSynergyTiers.length}`);

const results = [];
const ITERATIONS = 30; // 30 iterations for speed, still gives ~20k matches

let totalMatchups = (allSynergyTiers.length * (allSynergyTiers.length - 1)) / 2;
let completed = 0;

for (let i = 0; i < allSynergyTiers.length; i++) {
    for (let j = i + 1; j < allSynergyTiers.length; j++) {
        const teamA = allSynergyTiers[i];
        const teamB = allSynergyTiers[j];
        
        const r = runMatchup(teamA, teamB, ITERATIONS);
        const wr = (r.winsA / ITERATIONS) * 100;
        
        results.push({ 
            A: teamA.name, 
            B: teamB.name, 
            winRateA: wr.toFixed(1) 
        });
        
        completed++;
        if (completed % 100 === 0) {
            console.log(`진행 상황: ${completed} / ${totalMatchups} 완료`);
        }
    }
}

import('fs').then(fs => {
    fs.writeFileSync('./scratch/ultimate_synergy_eval.json', JSON.stringify(results, null, 2));
    console.log("✅ 완료! 결과가 scratch/ultimate_synergy_eval.json 에 저장되었습니다.");
});
