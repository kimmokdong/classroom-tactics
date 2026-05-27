const fs = require('fs');

let itemsCode = fs.readFileSync('js/items.js', 'utf8');

// 1. base_crit to 20%
itemsCode = itemsCode.replace(
    /stats: \{ critChance: 0.10 \}/g,
    'stats: { critChance: 0.20 }'
);
itemsCode = itemsCode.replace(
    /치명타 확률이 10% 증가합니다\./g,
    '치명타 확률이 20% 증가합니다.'
);

// comb_crit_crit to 40%
itemsCode = itemsCode.replace(
    /stats: \{ critChance: 0\.20 \}, effect: "thievesGloves"/,
    'stats: { critChance: 0.40 }, effect: "thievesGloves"'
);

// 2. deathblade desc
itemsCode = itemsCode.replace(
    /desc: "전투 시작 시 추가로 공격력이 20 증가합니다\."/,
    'desc: "추가로 공격력이 50 증가합니다. (총 +70)"'
);

// 3. rabadon desc
itemsCode = itemsCode.replace(
    /desc: "추가로 주문력이 20% 증폭됩니다\."/,
    'desc: "추가로 주문력이 50% 증가합니다. (총 +70%)"'
);

// 4. dclaw desc
itemsCode = itemsCode.replace(
    /desc: "마법 피해를 입을 때마다 최대 체력의 2%를 회복합니다\."/,
    'desc: "매 2초마다 최대 체력의 5%를 회복합니다."'
);

// 5. warmog desc
itemsCode = itemsCode.replace(
    /desc: "최대 체력이 500 증가합니다\."/,
    'desc: "최대 체력이 800 증가합니다."'
);

// 6. titans desc
itemsCode = itemsCode.replace(
    /desc: "공격하거나 피해를 입을 때마다 공격력 2, 주문력이 2% 증가합니다\. \(최대 25중첩\)"/,
    'desc: "공격하거나 피해를 입을 때마다 공격력 2, 주문력이 2% 증가합니다. (최대 25중첩). 최대 중첩 시 방어력과 마법 저항력이 20 증가합니다."'
);

fs.writeFileSync('js/items.js', itemsCode, 'utf8');
console.log('items.js updated.');
