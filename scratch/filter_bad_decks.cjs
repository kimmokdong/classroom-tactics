const fs = require('fs');

// 1. CSV 데이터 파싱
const csvRaw = fs.readFileSync('./scratch/master_tier_list.csv', 'utf-8');
const lines = csvRaw.split('\n').filter(l => l.trim().length > 0);
const dataLines = lines.slice(1);

const excludeNames = new Set();
let count = 0;

console.log('🗑️ 순위 합산 40 초과 덱 필터링 시작...');

for (const line of dataLines) {
    const cols = line.split(',');
    if (cols.length < 4) continue;
    
    const rank8 = parseInt(cols[0]);
    const rank9 = parseInt(cols[1]);
    const name = cols[3].trim();
    
    const rankSum = rank8 + rank9;
    
    if (rankSum > 40) {
        console.log(`- 제외됨: ${name} (8L:${rank8}위 + 9L:${rank9}위 = 합산 ${rankSum})`);
        excludeNames.add(name);
        count++;
    }
}

console.log(`\n총 ${count}개 덱 제외 대상 선정.\n`);

// 2. meta_decks.json 필터링
const decksPath = './js/meta_decks.json';
const decks = JSON.parse(fs.readFileSync(decksPath, 'utf-8'));
const originalLen = decks.length;

const newDecks = decks.filter(d => !excludeNames.has(d.name));

fs.writeFileSync(decksPath, JSON.stringify(newDecks, null, 2));

console.log(`✅ meta_decks.json 업데이트 완료: ${originalLen}개 -> ${newDecks.length}개 덱으로 축소됨.`);
