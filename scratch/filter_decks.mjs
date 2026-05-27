import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from '../js/data.js';

function getActiveSynergies(boardNames) {
    const counts = {};
    for (let uName of boardNames) {
        let u = UNIT_POOL.find(x => x.name === uName);
        if (u) {
            if (u.subject) counts[u.subject] = (counts[u.subject] || 0) + 1;
            if (u.club) counts[u.club] = (counts[u.club] || 0) + 1;
        }
    }
    const active = [];
    for (let syn in counts) {
        const count = counts[syn];
        let synDef = SYNERGIES.subjects[syn] || SYNERGIES.clubs[syn];
        if (!synDef) continue;
        
        let maxThresh = 0;
        let thresholds = Object.keys(synDef.levels).map(Number).sort((a,b)=>a-b);
        if (synDef.exactMatch) {
            if (thresholds.includes(count)) maxThresh = count;
        } else {
            for (let t of thresholds) {
                if (count >= t) maxThresh = t;
            }
        }
        
        if (maxThresh > 0) {
            active.push(`${syn}(${maxThresh})`);
        }
    }
    return active;
}

const csv = fs.readFileSync('scratch/balance_heuristic_results.csv', 'utf8');
const lines = csv.split('\n').filter(x => x.trim() !== '');
const results = [];

let validCount = 0;
for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\d+),([^,]+),([^,]+),([^,]+),"(.*)"$/);
    if (!match) continue;
    const [, rank, winrate, ehp, cost, composition] = match;
    
    const unitsRaw = composition.split(' + ');
    let hasHighTier3Star = false;
    const boardNames = [];
    
    for (let uStr of unitsRaw) {
        const uMatch = uStr.match(/★(\d) ([^\[]+) \[(.*)\]/);
        if (uMatch) {
            const star = parseInt(uMatch[1]);
            const name = uMatch[2].trim();
            const unitDef = UNIT_POOL.find(x => x.name === name);
            if (unitDef) {
                if ((unitDef.tier === 4 || unitDef.tier === 5) && star === 3) {
                    hasHighTier3Star = true;
                    break;
                }
                // Unique units only for synergy counting
                if (!boardNames.includes(name)) boardNames.push(name);
            }
        }
    }
    
    if (!hasHighTier3Star) {
        validCount++;
        const activeSyns = getActiveSynergies(boardNames);
        results.push({
            rank: validCount, // New rank
            origRank: rank,
            winrate,
            cost,
            syns: activeSyns.length > 0 ? activeSyns.join(', ') : '없음',
            comp: composition
        });
        if (validCount >= 20) break;
    }
}

let md = '| 순위(기존) | 승률 | 덱비용 | 발동 시너지 | 덱 구성 |\n';
md += '| :---: | :---: | :---: | :--- | :--- |\n';
for (let r of results) {
    md += `| ${r.rank}위(${r.origRank}위) | **${r.winrate}** | ${r.cost}G | ${r.syns} | ${r.comp} |\n`;
}

console.log(md);
