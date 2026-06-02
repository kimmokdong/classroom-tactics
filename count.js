const fs = require('fs');
const txt = fs.readFileSync('report_1.txt', 'utf8');
const units = ['전교 체육부장', '수능 만점자', '미친 과학자', '논술의 신', '나이팅게일', '천재 피아니스트', '천재 퀀트', '공익광고 모델', '전교 학생회장'];
let result = [];
units.forEach(u => {
    const matches = txt.match(new RegExp(u + '\\(4코', 'g'));
    result.push({ name: u, count: matches ? matches.length : 0 });
});
result.sort((a, b) => a.count - b.count);
console.log(result);
