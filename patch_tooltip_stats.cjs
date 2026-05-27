const fs = require('fs');

// 1. Patch main.js (remove hardcoded bonus stats)
let mainCode = fs.readFileSync('js/main.js', 'utf8');
mainCode = mainCode.replace(/if \(u\.combat\.itemEffects\.rfc\) u\.stats\.range \+= 1;\n/g, '');
mainCode = mainCode.replace(/if \(u\.combat\.itemEffects\.rabadon\) u\.stats\.ap \+= 50;\n/g, '');
mainCode = mainCode.replace(/if \(u\.combat\.itemEffects\.deathblade\) u\.stats\.ad \+= 50;\n/g, '');
mainCode = mainCode.replace(/if \(u\.combat\.itemEffects\.warmog\) u\.stats\.maxHp \+= 500;\n/g, '');
mainCode = mainCode.replace(/if \(u\.combat\.itemEffects\.blueBuff\) u\.stats\.maxMana = Math\.max\(10, u\.stats\.maxMana - 10\);\n/g, '');
mainCode = mainCode.replace(/if \(u\.combat\.itemEffects\.guardbreaker\) u\.combat\.dmgAmp \+= 0\.15;\n/g, '');
fs.writeFileSync('js/main.js', mainCode, 'utf8');

// 2. Patch items.js (add combined stats and simplify descriptions)
let itemsCode = fs.readFileSync('js/items.js', 'utf8');

// Deathblade (ad: 20 -> 70, remove description bonus)
itemsCode = itemsCode.replace(
    /stats: \{ ad: 20 \}, effect: "deathblade",\s*desc: "추가로 공격력이 20 증가합니다."/g,
    `stats: { ad: 70 }, effect: "deathblade",\n        desc: "순수 물리 공격력이 극대화된 무기입니다."`
);

// Guardbreaker (maxHp: 150, critChance: 0.10 -> dmgAmp: 0.15 in desc)
// Wait, guardbreaker adds dmgAmp. I will put it in stats as dmgAmp: 0.15 and remove from main.js!
itemsCode = itemsCode.replace(
    /stats: \{ maxHp: 150, critChance: 0\.10 \}, effect: "guardbreaker",\s*desc: "피해량이 15% 증가합니다. 보호막이 있는 대상을 공격하면 3초간 피해량이 25%로 증가합니다."/g,
    `stats: { maxHp: 150, critChance: 0.10, dmgAmp: 0.15 }, effect: "guardbreaker",\n        desc: "보호막이 있는 대상을 공격하면 3초간 피해량이 25%로 증가합니다."`
);

// RFC (as: 0.20 -> range: 1, desc simplify)
itemsCode = itemsCode.replace(
    /stats: \{ as: 0\.20 \}, effect: "rfc",\s*desc: "공격 사거리가 1칸 증가하고 기본 공격이 빗나가지 않습니다."/g,
    `stats: { as: 0.20, range: 1 }, effect: "rfc",\n        desc: "기본 공격이 빗나가지 않습니다."`
);

// BlueBuff (mana: 30 -> desc simpl)
itemsCode = itemsCode.replace(
    /stats: \{ mana: 30 \}, effect: "blueBuff",\s*desc: "최대 마나가 10 감소하며, 스킬 사용 시 즉시 10의 마나를 회복합니다."/g,
    `stats: { mana: 30, maxMana: -10 }, effect: "blueBuff",\n        desc: "스킬 사용 시 즉시 10의 마나를 회복합니다."`
);

// Rabadon (ap: 40 -> 90)
itemsCode = itemsCode.replace(
    /stats: \{ ap: 40 \}, effect: "rabadon",\s*desc: "추가로 주문력이 50 증가합니다."/g,
    `stats: { ap: 90 }, effect: "rabadon",\n        desc: "순수 주문력이 극대화된 마법 도구입니다."`
);

// Warmog (maxHp: 300 -> 800)
itemsCode = itemsCode.replace(
    /stats: \{ maxHp: 300 \}, effect: "warmog",\s*desc: "최대 체력이 800 증가합니다."/g,
    `stats: { maxHp: 800 }, effect: "warmog",\n        desc: "순수 체력이 극대화된 방어구입니다."`
);

fs.writeFileSync('js/items.js', itemsCode, 'utf8');
console.log('Patch complete');
