import fs from 'fs';
import { UNIT_POOL } from './js/data.js';

if (!fs.existsSync('./scratch/final_decks.json')) {
    console.error("final_decks.json not found.");
    process.exit(1);
}

const decks = JSON.parse(fs.readFileSync('./scratch/final_decks.json', 'utf-8'));

// 시너지 분석 구조: synergyFreq[synName][level][deckStrategy] = count
// example: synergyFreq['음악']['2']['7'] = 5
const synergyFreq = {};
const unitFreq = {}; // unitFreq[unitName] = count

decks.forEach(deck => {
    const strat = deck.strategy; // 7, 8, or 9
    
    // lastName 예시: "방송부3_수학2_미술2_장난꾸러기2 (🛡️피카소의 재림, 👑천재 피아니스트, 🌟수채화 장인)"
    if (deck.lastName) {
        const match = deck.lastName.match(/(.*?) \((.*?)\)/);
        if (match) {
            const synString = match[1].split(',').pop().trim();
            const synergies = synString.split('_');
            synergies.forEach(syn => {
                const name = syn.replace(/[0-9]/g, '');
                const countStr = syn.replace(/[^0-9]/g, '');
                if (name && countStr) {
                    if (!synergyFreq[name]) synergyFreq[name] = {};
                    if (!synergyFreq[name][countStr]) synergyFreq[name][countStr] = { '7': 0, '8': 0, '9': 0 };
                    synergyFreq[name][countStr][strat]++;
                }
            });
        }
    }
    
    // 유닛 파싱
    deck.units.forEach(u => {
        const unitData = UNIT_POOL.find(x => x.id === u.id);
        if (unitData) {
            unitFreq[unitData.name] = (unitFreq[unitData.name] || 0) + 1;
        }
    });
});

// 마크다운 생성
let md = `# 📊 상세 시너지 및 유닛 기용 빈도 분석 (최종 30개 정예 덱 기준)\n\n`;

md += `## 🔗 1. 시너지 레벨별 / 덱 전략별 기용 빈도\n`;
md += `| 시너지 이름 | 시너지 레벨 | 전체 기용 횟수 | 7렙 덱 | 8렙 덱 | 9렙 덱 |\n`;
md += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;

for (const synName of Object.keys(synergyFreq).sort()) {
    for (const level of Object.keys(synergyFreq[synName]).sort((a,b)=>Number(a)-Number(b))) {
        const counts = synergyFreq[synName][level];
        const total = counts['7'] + counts['8'] + counts['9'];
        md += `| **${synName}** | **${level}** | **${total}회** | ${counts['7']}회 | ${counts['8']}회 | ${counts['9']}회 |\n`;
    }
}

md += `\n## 👥 2. 전체 기물 기용 빈도 (3코어 외 모든 유닛 포함)\n`;
md += `| 유닛 이름 | 비용(코스트) | 총 기용 횟수 (30덱 중) | 기용률 |\n`;
md += `| :--- | :---: | :---: | :---: |\n`;

const sortedUnits = Object.entries(unitFreq).sort((a,b) => b[1] - a[1]);
sortedUnits.forEach(([name, count]) => {
    const unitData = UNIT_POOL.find(x => x.name === name);
    const cost = unitData ? unitData.tier : '?';
    const pickRate = ((count / 30) * 100).toFixed(1) + '%';
    md += `| ${name} | ${cost}코스트 | **${count}회** | ${pickRate} |\n`;
});

fs.writeFileSync('./scratch/detailed_frequency_analysis.md', md, 'utf-8');
console.log("Analysis generated at ./scratch/detailed_frequency_analysis.md");
