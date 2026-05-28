const fs = require('fs');

function parseReport(filename) {
    const lines = fs.readFileSync(filename, 'utf-8').split('\n');
    let tableStart = lines.findIndex(l => l.startsWith('| 순위 |'));
    if (tableStart === -1) return [];
    
    const dataLines = lines.slice(tableStart + 2);
    
    const decks = [];
    for (let line of dataLines) {
        if (!line.startsWith('|')) break;
        const cols = line.split('|').map(s => s.trim()).filter(s => s.length > 0);
        if (cols.length >= 6) {
            decks.push({
                rank: parseInt(cols[0]),
                name: cols[1].replace(/\*\*/g, '').trim(),
                gold: cols[2].replace(/\*\*/g, '').trim(),
                winrateStr: cols[4].split(' ')[0].replace(/\*\*/g, '').replace('%', '').trim(),
                balanceStr: cols[5].replace(/\*\*/g, '').replace('+', '').trim(),
                winrateOrig: cols[4].split(' ')[0].replace(/\*\*/g, '').trim(),
                balanceOrig: cols[5].replace(/\*\*/g, '').trim()
            });
        }
    }
    return decks;
}

const lvl8 = parseReport('./scratch/meta_report_items_lvl8.md');
const lvl9 = parseReport('./scratch/meta_report_items_lvl9.md');

// Combine
const combined = [];

for (let d8 of lvl8) {
    const d9 = lvl9.find(d => d.name === d8.name);
    
    let d9_rank = '-';
    let d9_gold = '-';
    let d9_wrOrig = '-';
    let d9_balOrig = '-';
    let rankChange = 'NEW';
    let sumWr = 0;
    let sumBal = 0;

    const wr8 = parseFloat(d8.winrateStr);
    const bal8 = parseFloat(d8.balanceStr);

    if (d9) {
        d9_rank = d9.rank;
        d9_gold = d9.gold;
        d9_wrOrig = d9.winrateOrig;
        d9_balOrig = d9.balanceOrig;

        const diff = d8.rank - d9.rank;
        const sign = diff > 0 ? '+' : (diff < 0 ? '-' : ' ');
        const absDiff = Math.abs(diff).toString().padStart(2, '0');
        rankChange = diff === 0 ? ` 00` : `${sign}${absDiff}`;
        
        const wr9 = parseFloat(d9.winrateStr);
        const bal9 = parseFloat(d9.balanceStr);

        sumWr = wr8 + wr9;
        sumBal = bal8 + bal9;
    }

    combined.push({
        name: d8.name,
        rank8: d8.rank,
        rank9: d9_rank,
        rankChange: rankChange,
        gold8: d8.gold,
        wrOrig8: d8.winrateOrig,
        balOrig8: d8.balanceOrig,
        gold9: d9_gold,
        wrOrig9: d9_wrOrig,
        balOrig9: d9_balOrig,
        sumWr: sumWr,
        sumBal: sumBal
    });
}

// Sort by 8L rank as primary sorting
combined.sort((a, b) => a.rank8 - b.rank8);

let csv = '\uFEFF';
csv += '8L순위,9L순위,순위변동,덱 아키타입,8L 밸류,8L 승률,8L 가성비,9L 밸류,9L 승률,9L 가성비,8L+9L 승률합,8L+9L 가성비합,가성비 통합순위\n';

// Calculate true balance rank separately
const trueBalanceRanked = [...combined].sort((a, b) => b.sumBal - a.sumBal);
const getTrueBalanceRank = (name) => {
    return trueBalanceRanked.findIndex(d => d.name === name) + 1;
};

for (let d of combined) {
    const trueRank = getTrueBalanceRank(d.name);
    const wrSumStr = d.sumWr ? d.sumWr.toFixed(1) + '%' : '-';
    const balSumStr = d.sumBal ? ((d.sumBal > 0 ? '+' : '') + d.sumBal.toFixed(1)) : '-';
    
    csv += `${d.rank8},${d.rank9},${d.rankChange},${d.name},${d.gold8},${d.wrOrig8},${d.balOrig8},${d.gold9},${d.wrOrig9},${d.balOrig9},${wrSumStr},${balSumStr},${trueRank}위\n`;
}

fs.writeFileSync('./scratch/master_tier_list_v2.csv', csv);
console.log('✅ Master CSV generated (v2)!');
