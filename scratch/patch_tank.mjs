import fs from 'fs';

const c = fs.readFileSync('run_simulation.js', 'utf8');
const lines = c.split('\r\n');

// 라인 230~239 범위를 찾아서 교체
let startIdx = -1, endIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('탱커 후보 없으면 방마저 합이 제일')) {
        startIdx = i;
    }
    if (startIdx !== -1 && lines[i].trim() === '}' && i > startIdx + 3) {
        endIdx = i;
        break;
    }
}

console.log('Found at lines:', startIdx + 1, '-', endIdx + 1);
console.log('Old block:');
lines.slice(startIdx, endIdx + 1).forEach((l, i) => console.log((startIdx + i + 1) + ': ' + l));

if (startIdx !== -1 && endIdx !== -1) {
    const newLines = [
        '    // 탱커 후보 없으면 5단계 우선순위로 임시 탱커 강제 지정',
        '    // 1.사거리짧을수록 2.성급높을수록 3.고코스트 4.체력많을수록 5.방마저합높을수록',
        '    if (tanks.length === 0) {',
        '        let byPriority = [...units].sort((a, b) => {',
        '            if (a.u.stats.range !== b.u.stats.range) return a.u.stats.range - b.u.stats.range;',
        '            if (a.u.star !== b.u.star) return b.u.star - a.u.star;',
        '            if (a.u.tier !== b.u.tier) return b.u.tier - a.u.tier;',
        '            if (a.u.stats.hp !== b.u.stats.hp) return b.u.stats.hp - a.u.stats.hp;',
        '            return (b.u.stats.armor + b.u.stats.mr) - (a.u.stats.armor + a.u.stats.mr);',
        '        });',
        '        tanks = [byPriority[0]];',
        '        dps = units.filter(x => x !== tanks[0]);',
        '    }'
    ];
    lines.splice(startIdx, endIdx - startIdx + 1, ...newLines);
    fs.writeFileSync('run_simulation.js', lines.join('\r\n'), 'utf8');
    console.log('SUCCESS');
} else {
    console.log('Block not found');
}
