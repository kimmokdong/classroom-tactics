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
            const rank = parseInt(cols[0]);
            decks.push({
                rank: rank,
                name: cols[1].replace(/\*\*/g, '').trim(),
                gold: cols[2].replace(/\*\*/g, '').trim(),
                winrateStr: cols[4].split(' ')[0].replace(/\*\*/g, '').replace('%', '').trim(),
                balanceStr: cols[5].replace(/\*\*/g, '').replace('+', '').trim()
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
    if (d9) {
        const wr8 = parseFloat(d8.winrateStr);
        const wr9 = parseFloat(d9.winrateStr);
        const bal8 = parseFloat(d8.balanceStr);
        const bal9 = parseFloat(d9.balanceStr);
        
        combined.push({
            name: d8.name,
            rank8: d8.rank,
            rank9: d9.rank,
            wr8, wr9, bal8, bal9,
            sumWr: wr8 + wr9,
            sumBal: bal8 + bal9
        });
    }
}

// Sort by sumBal descending
combined.sort((a, b) => b.sumBal - a.sumBal);

let out = `# ⚖️ 8L+9L 통합 진짜 밸런스 티어표 (합산 기준)\n\n`;
out += `> 8레벨과 9레벨의 승률 및 가성비를 합산하여, 초중후반 모두 강력한 진정한 OP덱과 최약체 덱을 가려냅니다.\n\n`;
out += `| 통합 순위 | 덱 아키타입 | 8L+9L 승률 합 | 8L+9L 가성비 합 | 8L 순위 | 9L 순위 | 8L 가성비 | 9L 가성비 |\n`;
out += `|---|---|---|---|---|---|---|---|\n`;

let csv = '\uFEFF통합 순위,덱 아키타입,승률 합산,가성비 합산,8L 순위,9L 순위,8L 가성비,9L 가성비\n';

combined.forEach((d, i) => {
    const rank = i + 1;
    const wrSumStr = d.sumWr.toFixed(1) + '%';
    const balSumStr = (d.sumBal > 0 ? '+' : '') + d.sumBal.toFixed(1);
    
    const bal8Str = (d.bal8 > 0 ? '+' : '') + d.bal8.toFixed(1);
    const bal9Str = (d.bal9 > 0 ? '+' : '') + d.bal9.toFixed(1);

    out += `| ${rank} | **${d.name}** | **${wrSumStr}** | **${balSumStr}** | ${d.rank8} | ${d.rank9} | ${bal8Str} | ${bal9Str} |\n`;
    csv += `${rank},${d.name},${wrSumStr},${balSumStr},${d.rank8},${d.rank9},${bal8Str},${bal9Str}\n`;
});

fs.writeFileSync('C:/Users/user/.gemini/antigravity-ide/brain/f41d6238-3d37-4549-8ae9-48753251b464/true_balance_tier_list.md', out);
fs.writeFileSync('./scratch/true_balance_tier_list.csv', csv);
console.log('✅ True balance list generated!');
