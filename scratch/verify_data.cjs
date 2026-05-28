/**
 * master_tier_list.csv 데이터와 8L/9L 개별 리포트 데이터의 정합성 검증 스크립트
 */
const fs = require('fs');

// ─── 1. CSV 파싱 ───
const csvRaw = fs.readFileSync('./scratch/master_tier_list.csv', 'utf-8');
const csvLines = csvRaw.split('\n').filter(l => l.trim().length > 0);
const csvHeader = csvLines[0].replace(/^\uFEFF/, '');
const csvData = csvLines.slice(1).map(line => {
    const cols = line.split(',');
    return {
        rank8: parseInt(cols[0]),
        rank9: parseInt(cols[1]),
        rankChange: cols[2].trim(),
        name: cols[3].trim(),
        gold8: cols[4].trim(),
        wr8: cols[5].trim(),
        bal8: cols[6].trim(),
        gold9: cols[7].trim(),
        wr9: cols[8].trim(),
        bal9: cols[9].trim(),
        wrSum: cols[10].trim(),
        balSum: cols[11].trim(),
        trueBalRank: cols[12].trim()
    };
});

// ─── 2. MD 리포트 파싱 ───
function parseReport(filename) {
    const content = fs.readFileSync(filename, 'utf-8');
    const lines = content.split('\\n').length > 1 ? content.split('\\n') : content.split('\n');
    
    // 이 파일들은 이스케이프된 줄바꿈(\n)이 들어 있을 수 있음
    // 실제 파일 구조 확인
    const allText = content;
    
    const decks = [];
    // 테이블 행 패턴: | 숫자 | 이름 | ... |
    const rowRegex = /\|\s*(\d+)\s*\|\s*([\w가-힣_]+)\s*\|\s*\*\*(\d+G)\*\*\s*\|\s*([\d.]+%)\s*\|\s*\*\*([\d.]+%)\*\*\s*[^\|]*\|\s*\*\*([+-]?[\d.]+)\*\*\s*\|\s*(\d+)\s*\|/g;
    
    let match;
    while ((match = rowRegex.exec(allText)) !== null) {
        decks.push({
            rank: parseInt(match[1]),
            name: match[2].trim(),
            gold: match[3].trim(),
            expectedWr: match[4].trim(),
            actualWr: match[5].trim(),
            balance: match[6].trim(),
            totalWins: parseInt(match[7])
        });
    }
    return decks;
}

const lvl8 = parseReport('./scratch/meta_report_items_lvl8.md');
const lvl9 = parseReport('./scratch/meta_report_items_lvl9.md');

console.log(`\n📊 데이터 검증 시작`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`CSV 행 수: ${csvData.length}`);
console.log(`8L 리포트 덱 수: ${lvl8.length}`);
console.log(`9L 리포트 덱 수: ${lvl9.length}`);

// ─── 3. 교차 검증 ───
let errors = [];
let warnings = [];

for (const row of csvData) {
    // 8L 검증
    const d8 = lvl8.find(d => d.name === row.name);
    if (!d8) {
        errors.push(`❌ [8L] "${row.name}" - 8L 리포트에서 찾을 수 없음`);
    } else {
        if (d8.rank !== row.rank8) errors.push(`❌ [8L 순위] "${row.name}": CSV=${row.rank8}, 리포트=${d8.rank}`);
        if (d8.gold !== row.gold8) errors.push(`❌ [8L 골드] "${row.name}": CSV=${row.gold8}, 리포트=${d8.gold}`);
        if (d8.actualWr !== row.wr8) errors.push(`❌ [8L 승률] "${row.name}": CSV=${row.wr8}, 리포트=${d8.actualWr}`);
        if (d8.balance !== row.bal8) errors.push(`❌ [8L 가성비] "${row.name}": CSV=${row.bal8}, 리포트=${d8.balance}`);
    }

    // 9L 검증
    const d9 = lvl9.find(d => d.name === row.name);
    if (!d9) {
        errors.push(`❌ [9L] "${row.name}" - 9L 리포트에서 찾을 수 없음`);
    } else {
        if (d9.rank !== row.rank9) errors.push(`❌ [9L 순위] "${row.name}": CSV=${row.rank9}, 리포트=${d9.rank}`);
        if (d9.gold !== row.gold9) errors.push(`❌ [9L 골드] "${row.name}": CSV=${row.gold9}, 리포트=${d9.gold}`);
        if (d9.actualWr !== row.wr9) errors.push(`❌ [9L 승률] "${row.name}": CSV=${row.wr9}, 리포트=${d9.actualWr}`);
        if (d9.balance !== row.bal9) errors.push(`❌ [9L 가성비] "${row.name}": CSV=${row.bal9}, 리포트=${d9.balance}`);
    }

    // 승률합 검증
    if (d8 && d9) {
        const wr8 = parseFloat(d8.actualWr);
        const wr9 = parseFloat(d9.actualWr);
        const expectedWrSum = (wr8 + wr9).toFixed(1) + '%';
        if (expectedWrSum !== row.wrSum) {
            errors.push(`❌ [승률합] "${row.name}": CSV=${row.wrSum}, 계산값=${expectedWrSum}`);
        }
        
        const bal8 = parseFloat(d8.balance);
        const bal9 = parseFloat(d9.balance);
        const rawBalSum = bal8 + bal9;
        const expectedBalSum = (rawBalSum > 0 ? '+' : '') + rawBalSum.toFixed(1);
        if (expectedBalSum !== row.balSum) {
            errors.push(`❌ [가성비합] "${row.name}": CSV=${row.balSum}, 계산값=${expectedBalSum}`);
        }
    }

    // 순위 변동 검증
    if (d8 && d9) {
        const diff = row.rank8 - row.rank9;
        const sign = diff > 0 ? '+' : (diff < 0 ? '-' : ' ');
        const absDiff = Math.abs(diff).toString().padStart(2, '0');
        const expectedRankChange = diff === 0 ? ` 00` : `${sign}${absDiff}`;
        if (expectedRankChange !== row.rankChange) {
            warnings.push(`⚠️ [순위변동] "${row.name}": CSV="${row.rankChange}", 계산값="${expectedRankChange}"`);
        }
    }
}

// ─── 4. 가성비 통합순위 검증 ───
const balSumValues = csvData.map(d => ({
    name: d.name,
    balSum: parseFloat(d.balSum)
})).sort((a, b) => b.balSum - a.balSum);

for (let i = 0; i < balSumValues.length; i++) {
    const expectedRank = `${i + 1}위`;
    const csvRow = csvData.find(d => d.name === balSumValues[i].name);
    if (csvRow && csvRow.trueBalRank !== expectedRank) {
        errors.push(`❌ [통합순위] "${balSumValues[i].name}": CSV=${csvRow.trueBalRank}, 계산값=${expectedRank} (가성비합=${balSumValues[i].balSum})`);
    }
}

// ─── 5. 결과 출력 ───
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`\n🔍 검증 결과:`);

if (errors.length === 0 && warnings.length === 0) {
    console.log(`\n✅ 모든 데이터가 완벽하게 일치합니다!`);
} else {
    if (errors.length > 0) {
        console.log(`\n❌ 오류 ${errors.length}건:`);
        errors.forEach(e => console.log(`  ${e}`));
    }
    if (warnings.length > 0) {
        console.log(`\n⚠️ 경고 ${warnings.length}건:`);
        warnings.forEach(w => console.log(`  ${w}`));
    }
}

// ─── 6. 밸런스 리포트 주장 검증 ───
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`\n📋 밸런스 리포트 주요 주장 검증:`);

// 가성비합 분포 검증
const sPlus = csvData.filter(d => parseFloat(d.balSum) >= 50);
const ab = csvData.filter(d => { const v = parseFloat(d.balSum); return v >= 10 && v < 50; });
const c = csvData.filter(d => { const v = parseFloat(d.balSum); return v >= -10 && v < 10; });
const df = csvData.filter(d => parseFloat(d.balSum) < -10);

console.log(`  S티어(+50이상): ${sPlus.length}개 (리포트: 2개) ${sPlus.length === 2 ? '✅' : '❌'}`);
console.log(`  A~B티어(+10~+50): ${ab.length}개 (리포트: 16개) ${ab.length === 16 ? '✅' : '❌'}`);
console.log(`  C티어(-10~+10): ${c.length}개 (리포트: 7개) ${c.length === 7 ? '✅' : '❌'}`);
console.log(`  D~F티어(-10이하): ${df.length}개 (리포트: 5개) ${df.length === 5 ? '✅' : '❌'}`);

// 최대 격차 검증
const allBal = csvData.map(d => parseFloat(d.balSum));
const maxBal = Math.max(...allBal);
const minBal = Math.min(...allBal);
const maxGap = maxBal - minBal;
console.log(`\n  최대 가성비합 격차: ${maxGap.toFixed(1)}점 (1위: ${maxBal}, 꼴찌: ${minBal})`);

// 상위25 격차 검증
const top25 = [...csvData].sort((a,b) => parseFloat(b.balSum) - parseFloat(a.balSum)).slice(0, 25);
const top25Max = parseFloat(top25[0].balSum);
const top25Min = parseFloat(top25[24].balSum);
console.log(`  상위25 격차: ${(top25Max - top25Min).toFixed(1)}점 (리포트 목표: 50점 이하)`);

// 보건부 덱 검증
const healthDecks = csvData.filter(d => d.name.includes('보건부'));
console.log(`\n  보건부 포함 덱 (${healthDecks.length}개):`);
healthDecks.forEach(d => {
    console.log(`    ${d.name}: 8L ${d.wr8}(${d.bal8}), 9L ${d.wr9}(${d.bal9}), 통합 ${d.balSum}`);
});

// 시너지 기여도 계산
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`\n📈 시너지별 평균 가성비합 기여도 (데이터 기반 재계산):`);
const synergies = {};
for (const d of csvData) {
    // 덱 이름에서 시너지 추출
    const parts = d.name.split('_');
    const syns = new Set();
    for (const p of parts) {
        const synName = p.replace(/\d+$/, '');
        syns.add(synName);
    }
    for (const s of syns) {
        if (!synergies[s]) synergies[s] = [];
        synergies[s].push(parseFloat(d.balSum));
    }
}

const synRank = Object.entries(synergies).map(([name, vals]) => ({
    name,
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    count: vals.length
})).sort((a, b) => b.avg - a.avg);

synRank.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name}: 평균 ${s.avg.toFixed(1)} (표본 ${s.count}개)`);
});
