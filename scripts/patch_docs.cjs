const fs = require('fs');

// Patch item_mechanics_review.md
let docPath = 'C:\\Users\\hyunseung\\.gemini\\antigravity-ide\\brain\\5f292bd6-e0f9-4fdf-bdcd-3d09941f1092\\item_mechanics_review.md';
let doc = fs.readFileSync(docPath, 'utf8');

doc = doc.replace(
    /공격력 \+20\*\* 부여/,
    '공격력 +50** 부여'
);
doc = doc.replace(
    /주문력 수치가 실시간으로 20% 곱산 증폭 반영됨\./,
    '주문력 수치가 실시간으로 50 추가 합산 반영됨.'
);
doc = doc.replace(
    /마법 피해 피격 시 최대 체력 비례 회복\./,
    '매 2초마다 최대 체력의 5% 회복 엔진 구현.'
);
doc = doc.replace(
    /추가 체력이 툴팁 및 스탯에 실시간 반영됨\./,
    '총 800 추가 체력이 툴팁 및 스탯에 실시간 반영됨.'
);

fs.writeFileSync(docPath, doc, 'utf8');

// Patch 게임정보.md
let gameInfoPath = '게임정보.md';
let gameInfo = fs.readFileSync(gameInfoPath, 'utf8');

gameInfo = gameInfo.replace(
    /공격력 \+20\*\* 부여/g,
    '공격력 +50** 부여'
);
gameInfo = gameInfo.replace(
    /주문력 수치가 실시간으로 20% 곱산 증폭 반영됨\./g,
    '주문력 수치가 실시간으로 50 추가 합산 반영됨.'
);
gameInfo = gameInfo.replace(
    /마법 피해 피격 시 최대 체력 비례 회복\./g,
    '매 2초마다 최대 체력의 5% 회복 엔진 구현.'
);
gameInfo = gameInfo.replace(
    /추가 체력이 툴팁 및 스탯에 실시간 반영됨\./g,
    '총 800 추가 체력이 툴팁 및 스탯에 실시간 반영됨.'
);

fs.writeFileSync(gameInfoPath, gameInfo, 'utf8');
console.log('Docs updated.');
