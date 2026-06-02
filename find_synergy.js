import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from './js/data.js';

// Get active level for a synergy count
function getActiveLevel(count, synergyData) {
    let levels = Object.keys(synergyData.levels).map(Number).sort((a,b)=>a-b);
    let active = 0;
    if (synergyData.exactMatch) {
        if (levels.includes(count)) active = count;
    } else {
        levels.forEach(l => { if (count >= l) active = l; });
    }
    return active;
}

// Calculate waste (units providing traits that don't reach any active level, or are above the active level but below next)
function calculateSynergies(deckIds) {
    let deck = deckIds.map(id => UNIT_POOL.find(u => u.id === id));
    let counts = { subjects: {}, clubs: {} };
    deck.forEach(u => {
        let subs = Array.isArray(u.subject) ? u.subject : [u.subject];
        let clubs = Array.isArray(u.club) ? u.club : [u.club];
        subs.forEach(s => counts.subjects[s] = (counts.subjects[s] || 0) + 1);
        clubs.forEach(c => counts.clubs[c] = (counts.clubs[c] || 0) + 1);
    });

    let active = [];
    let waste = 0;
    
    for (let s in counts.subjects) {
        let count = counts.subjects[s];
        let lvl = getActiveLevel(count, SYNERGIES.subjects[s]);
        if (lvl > 0) active.push(`${s}(${lvl})`);
        waste += (count - lvl);
    }
    for (let c in counts.clubs) {
        let count = counts.clubs[c];
        let lvl = getActiveLevel(count, SYNERGIES.clubs[c]);
        if (lvl > 0) active.push(`${c}(${lvl})`);
        waste += (count - lvl);
    }
    
    return { active, waste, counts };
}

// Just checking manually designed decks
const deckGroups = [
  // 1. 도덕/선도부/보건부 라인
  { name: '도덕선도 7렙', ids: ['u1_1', 'u1_10', 'u2_10', 'u4_9', 'u4_1', 'u5_4', 'u4_6'] },
  { name: '도덕선도 8렙', ids: ['u1_1', 'u2_2', 'u2_10', 'u3_9', 'u4_1', 'u5_4', 'u4_9', 'u5_3'] },
  { name: '도덕선도 9렙', ids: ['u1_1', 'u2_2', 'u2_10', 'u3_9', 'u4_1', 'u5_4', 'u4_9', 'u5_3', 'u1_10'] }, // 낭비있을듯
  { name: '도덕선도 10렙', ids: ['u1_1', 'u2_2', 'u2_10', 'u3_9', 'u4_1', 'u5_4', 'u4_9', 'u5_3', 'u1_10', 'u4_6'] }
];

deckGroups.forEach(d => {
    let res = calculateSynergies(d.ids);
    console.log(`[${d.name}] ${d.ids.length}명`);
    console.log(` - 시너지: ${res.active.join(', ')}`);
    console.log(` - 낭비 포인트: ${res.waste}`);
});
