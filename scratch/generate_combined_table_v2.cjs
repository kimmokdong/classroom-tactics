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
            decks.push({
                rank: rank,
                name: cols[1].replace(/\*\*/g, '').trim(),
                gold: cols[2].replace(/\*\*/g, '').trim(),
                winrate: cols[4].split(' ')[0].replace(/\*\*/g, '').trim(),
                balance: cols[5].replace(/\*\*/g, '').trim()
            });
        }
    }
    return decks;
}

const lvl8 = parseReport('./scratch/meta_report_items_lvl8.md');
const lvl9 = parseReport('./scratch/meta_report_items_lvl9.md');

let out = `# 🏆 8레벨 vs 9레벨 상위 25덱 티어 비교표 (순위 변동 포함)\n\n`;
out += `| 8L 순위 | 9L 순위 | 변동 | 덱 아키타입 | 8L 밸류 | 8L 승률 | 8L 가성비 | 9L 밸류 | 9L 승률 | 9L 가성비 |\n`;
out += `|---|---|---|---|---|---|---|---|---|---|\n`;

for (let i = 0; i < 25; i++) {
    const d8 = lvl8[i];
    if (!d8) break;

    const d9 = lvl9.find(d => d.name === d8.name);
    let rankChange = '-';
    let d9_rank = '-';
    let d9_gold = '-';
    let d9_wr = '-';
    let d9_bal = '-';

    if (d9) {
        const diff = d8.rank - d9.rank;
        const sign = diff > 0 ? '+' : (diff < 0 ? '-' : ' ');
        const absDiff = Math.abs(diff).toString().padStart(2, '0');
        if (diff === 0) {
            rankChange = ` 00`;
        } else {
            rankChange = `${sign}${absDiff}`;
        }
        
        d9_rank = d9.rank;
        d9_gold = d9.gold;
        d9_wr = d9.winrate;
        d9_bal = d9.balance;
    } else {
        rankChange = `NEW`;
    }

    out += `| ${d8.rank} | ${d9_rank} | ${rankChange} | **${d8.name}** | ${d8.gold} | ${d8.winrate} | ${d8.balance} | **${d9_gold}** | **${d9_wr}** | **${d9_bal}** |\n`;
}

fs.writeFileSync('C:/Users/user/.gemini/antigravity-ide/brain/f41d6238-3d37-4549-8ae9-48753251b464/meta_tier_list.md', out);
console.log('✅ Updated meta_tier_list.md generated!');
