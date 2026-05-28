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
                name: cols[1].replace(/\*\*/g, '').trim(),
                balanceStr: cols[5].replace(/\*\*/g, '').replace('+', '').trim()
            });
        }
    }
    return decks;
}

const lvl8 = parseReport('./scratch/meta_report_items_lvl8.md');
const lvl9 = parseReport('./scratch/meta_report_items_lvl9.md');

const synergyStats = {};

for (let d8 of lvl8) {
    const d9 = lvl9.find(d => d.name === d8.name);
    if (d9) {
        const bal8 = parseFloat(d8.balanceStr);
        const bal9 = parseFloat(d9.balanceStr);
        const sumBal = bal8 + bal9;
        
        // Extract synergies from name
        const parts = d8.name.split('_');
        for (let p of parts) {
            // Remove digits
            const synName = p.replace(/[0-9]/g, '');
            if (!synergyStats[synName]) {
                synergyStats[synName] = { count: 0, totalScore: 0, deckList: [] };
            }
            synergyStats[synName].count++;
            synergyStats[synName].totalScore += sumBal;
            synergyStats[synName].deckList.push(d8.name);
        }
    }
}

const results = Object.keys(synergyStats).map(name => {
    const s = synergyStats[name];
    return {
        name,
        count: s.count,
        avgScore: s.totalScore / s.count,
        decks: s.deckList.join(', ')
    };
});

results.sort((a, b) => b.avgScore - a.avgScore);

console.log("=== 개별 시너지 평균 기여도 분석 (통합 가성비 기준) ===");
results.forEach((r, i) => {
    const avg = (r.avgScore > 0 ? '+' : '') + r.avgScore.toFixed(1);
    console.log(`${i+1}위: [${r.name}] 평균 ${avg}점 (표본 ${r.count}개)`);
    // console.log(`  -> 포함된 덱: ${r.decks}`);
});
