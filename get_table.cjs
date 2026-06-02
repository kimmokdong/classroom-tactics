const fs = require('fs');
const lines = fs.readFileSync('js/data.js', 'utf8').split('\n');
const units = [];
let current = {};
for(let i=0; i<lines.length; i++) {
    if(lines[i].includes("id: 'u")) {
        const m1 = lines[i].match(/tier: (\d)/);
        const m2 = lines[i].match(/name: '([^']+)'/);
        const m3 = lines[i].match(/position: '([^']+)'/);
        const m4 = lines[i].match(/role: \[([^\]]+)\]/);
        const m5 = lines[i].match(/icon: '([^']+)'/);
        if(m1 && m2 && m3 && m4) {
            current = { 
                tier: parseInt(m1[1]), 
                name: m2[1], 
                pos: m3[1], 
                role: m4[1].replace(/'/g, ''), 
                icon: m5 ? m5[1] : '' 
            };
        }
    } else if(lines[i].includes("skill: { name:") && current.name) {
        const m = lines[i].match(/desc: '([^']+)'/);
        if(m) {
            current.desc = m[1];
            units.push(current);
            current = {};
        }
    }
}
units.sort((a,b) => a.tier - b.tier);
let result = '| 유닛명 | 코스트 | 포지션 | 역할군 | 스킬 핵심 효과 |\n| :--- | :---: | :--- | :--- | :--- |\n';
units.forEach(u => {
    let rStr = u.role.includes('tank') ? '탱커' : '';
    rStr += (u.role.includes('tank') && (u.role.includes('dealer')||u.role.includes('support'))) ? '/' : '';
    rStr += u.role.includes('dealer') ? '딜러' : '';
    rStr += (u.role.includes('dealer') && u.role.includes('support')) ? '/' : '';
    rStr += u.role.includes('support') ? '서포터' : '';
    result += '| **' + u.name + '** | ' + u.tier + ' | ' + u.icon + ' ' + u.pos + ' | `' + rStr + '` | ' + u.desc + ' |\n';
});
fs.writeFileSync('temp_table.md', result, 'utf8');
console.log('총 유닛 수:', units.length);
