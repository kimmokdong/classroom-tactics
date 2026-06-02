const fs = require('fs');

const oldContent = fs.readFileSync('C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\dffff154-de57-4783-8295-ce019c0a3ef9\\simulation_report_v2_run2.md', 'utf8');
const newContent = fs.readFileSync('C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\dffff154-de57-4783-8295-ce019c0a3ef9\\simulation_report_v3_new_items.md', 'utf8');

function parseReport(content) {
    const lines = content.split('\n');
    const data = {};
    let currentMode = '';
    
    for (const line of lines) {
        if (line.includes('## 🥇 Lv.')) {
            currentMode = line;
        } else if (line.includes('## 🏆 무제한급')) {
            currentMode = '무제한급';
        }
        
        // 올스타 리그 랭킹만 뽑아서 비교 (중복 덱 방지)
        if (currentMode === '무제한급' && line.includes('| 🏆')) {
            const parts = line.split('|').map(s => s.trim());
            if (parts.length >= 5) {
                const winRateStr = parts[2].replace(/\*/g, '').replace('%', '');
                const winRate = parseFloat(winRateStr);
                const deckName = parts[3];
                data[deckName] = winRate;
            }
        }
    }
    return data;
}

const oldData = parseReport(oldContent);
const newData = parseReport(newContent);

let comparisonMD = '# 📈 아이템 풀 개편 전후 승률 비교 리포트\n\n';
comparisonMD += '| 덱 명칭 | 이전 승률 | 현재 승률 | 변동 |\n';
comparisonMD += '|---|---|---|---|\n';

const diffs = [];
for (const deckName in newData) {
    if (oldData[deckName] !== undefined) {
        const oldVal = oldData[deckName];
        const newVal = newData[deckName];
        const diff = newVal - oldVal;
        diffs.push({ deckName, oldVal, newVal, diff });
    }
}

diffs.sort((a, b) => b.diff - a.diff);

for (const item of diffs) {
    const diffStr = item.diff > 0 ? `+${item.diff.toFixed(1)}%` : `${item.diff.toFixed(1)}%`;
    const emoji = item.diff > 2.0 ? '🚀' : item.diff < -2.0 ? '📉' : '➖';
    comparisonMD += `| ${item.deckName} | ${item.oldVal.toFixed(1)}% | ${item.newVal.toFixed(1)}% | ${emoji} ${diffStr} |\n`;
}

fs.writeFileSync('C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\dffff154-de57-4783-8295-ce019c0a3ef9\\comparison_report_v3.md', comparisonMD);
console.log('Comparison report generated');
