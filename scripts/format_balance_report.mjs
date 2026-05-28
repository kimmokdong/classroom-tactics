import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/balance_report.json', 'utf8'));

let finalData = data.data;

// User requested: "8레벨이든 9레벨이든 순위 합산이 40넘는거는 리스트에서 제외해라"
// I already filtered in the sim script: `finalData = finalData.filter(d => (d.rank8 + d.rank9) <= 40);`
// Wait, the user said "8레벨이든 9레벨이든 순위 합산이 40넘는거는 리스트에서 제외해라." Which might mean:
// "If rank8 + rank9 > 40, exclude it." Which I already did.

// "가성비합 13위까지 제일 많이 들어간 시너지가 뭐야"
const top13 = finalData.slice(0, 13);
const synergyCounts = {};
top13.forEach(d => {
    const parts = d.deck.replace('꾸러기', '').split('_');
    parts.forEach(p => {
        const syn = p.replace(/\d+/g, '');
        const synName = syn === '장난' ? '장난꾸러기' : syn;
        synergyCounts[synName] = (synergyCounts[synName] || 0) + 1;
    });
});

const sortedSyns = Object.entries(synergyCounts).sort((a,b) => b[1] - a[1]);
const mostFrequentSyn = sortedSyns.length > 0 ? sortedSyns[0][0] : 'None';
const mostFrequentCount = sortedSyns.length > 0 ? sortedSyns[0][1] : 0;

let md = `# 🏆 진(眞) 밸런스 티어 리스트 v3 (음악/미술 교체 및 수치 패치 반영)\n\n`;
md += `> **분석 기준**: 8레벨/9레벨 순위 합산이 40을 초과하는 덱 제외\n`;
md += `> **티어 산정 기준**: 8L 가성비 + 9L 가성비를 합산한 **가성비합(Total Balance Score)**\n\n`;

md += `### 🏅 13위 이내 최다 채용 시너지\n`;
md += `- **${mostFrequentSyn}**: ${mostFrequentCount}회 채용\n\n`;

md += `| 덱 아키타입 | 통합 순위 | 8L 승률(가성비) | 9L 승률(가성비) | 가성비합 | 8L순위 | 9L순위 | 합산 |\n`;
md += `|---|---|---|---|---|---|---|---|\n`;

finalData.forEach((d, i) => {
    let tier = '';
    if (d.ceSum >= 30) tier = '🚨 S';
    else if (d.ceSum >= 15) tier = '✅ A';
    else if (d.ceSum >= 0) tier = '⚖️ B';
    else if (d.ceSum >= -15) tier = '⚠️ C';
    else tier = '💀 D';

    md += `| **${d.deck}** | ${i+1}위 | ${d.win8.toFixed(1)}% (${d.ce8 > 0 ? '+' : ''}${d.ce8.toFixed(1)}) | ${d.win9.toFixed(1)}% (${d.ce9 > 0 ? '+' : ''}${d.ce9.toFixed(1)}) | **${d.ceSum > 0 ? '+' : ''}${d.ceSum.toFixed(1)}** ${tier} | ${d.rank8}위 | ${d.rank9}위 | ${d.rank8 + d.rank9} |\n`;
});

fs.writeFileSync('C:/Users/user/.gemini/antigravity-ide/brain/f41d6238-3d37-4549-8ae9-48753251b464/true_balance_tier_list_v3.md', md, 'utf8');

console.log("Markdown generated.");
