const fs = require('fs');

function parseReport(filename) {
    const lines = fs.readFileSync(filename, 'utf-8').split('\n');
    let tableStart = lines.findIndex(l => l.startsWith('| 순위 |'));
    if (tableStart === -1) return [];
    
    // Skip header and separator
    const dataLines = lines.slice(tableStart + 2);
    
    const decks = [];
    for (let line of dataLines) {
        if (!line.startsWith('|')) break; // End of table
        const cols = line.split('|').map(s => s.trim()).filter(s => s.length > 0);
        if (cols.length >= 6) {
            const rank = parseInt(cols[0]);
            if (rank > 25) break; // Only top 25
            decks.push({
                rank: rank,
                name: cols[1],
                gold: cols[2].replace('**', '').replace('**', ''),
                winrate: cols[4].split(' ')[0].replace('**', '').replace('**', ''),
                balance: cols[5].replace('**', '').replace('**', '')
            });
        }
    }
    return decks;
}

const lvl8 = parseReport('./scratch/meta_report_items_lvl8.md');
const lvl9 = parseReport('./scratch/meta_report_items_lvl9.md');

let out = `# 🏆 8레벨 vs 9레벨 상위 25덱 티어 비교표 (최종 밸런싱)\n\n`;
out += `| 순위 | 덱 아키타입 (8레벨) | 덱 밸류(8L) | 실제 승률(8L) | 가성비 점수(8L) | 덱 아키타입 (9레벨) | 덱 밸류(9L) | 실제 승률(9L) | 가성비 점수(9L) |\n`;
out += `|---|---|---|---|---|---|---|---|---|\n`;

for (let i = 0; i < 25; i++) {
    const d8 = lvl8[i] || { name: '-', gold: '-', winrate: '-', balance: '-' };
    const d9 = lvl9[i] || { name: '-', gold: '-', winrate: '-', balance: '-' };
    out += `| ${i+1} | ${d8.name} | ${d8.gold} | ${d8.winrate} | ${d8.balance} | ${d9.name} | ${d9.gold} | ${d9.winrate} | ${d9.balance} |\n`;
}

fs.writeFileSync('./scratch/combined_tier_list.md', out);
console.log('✅ scratch/combined_tier_list.md generated!');
