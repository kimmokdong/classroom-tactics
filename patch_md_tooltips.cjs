const fs = require('fs');

let md = fs.readFileSync('게임정보.md', 'utf8');

// Deathblade
md = md.replace(/\| \*\*전교 1등의 샤프\*\* \(AD\+AD\) \| `deathblade` : 킬 관여 시 스택이 쌓이며 최대 25스택.* \|/g, '| **전교 1등의 샤프** (AD+AD) | `deathblade` : 순수 물리 공격력이 70으로 극대화되는 기본 스탯(ad) 강화 템. | 🟢 완벽 |');
// RFC
md = md.replace(/\| \*\*로켓 실내화\*\* \(AS\+AS\) \| `rfc` : 기본 공격 사거리 1칸 증가 및 회피 불가.* \|/g, '| **로켓 실내화** (AS+AS) | `rfc` : 기본 사거리 1칸 증가(range: 1 스탯 부여) 및 회피 불가 적용. | 🟢 완벽 |');
// BlueBuff
md = md.replace(/\| \*\*밤샘용 핫식스 박스\*\* \(Mana\+Mana\) \| `blueBuff` : 최대 마나를 10 깎아서.* \|/g, '| **밤샘용 핫식스 박스** (Mana+Mana) | `blueBuff` : 스탯에서 최대 마나 10 감소(maxMana: -10) 및 스킬 사용 시 10 회복. | 🟢 완벽 |');
// Rabadon
md = md.replace(/\| \*\*교장선생님의 마이크\*\* \(AP\+AP\) \| `rabadon` : 기본 주문력이.* \|/g, '| **교장선생님의 마이크** (AP+AP) | `rabadon` : 순수 주문력이 90으로 극대화되는 기본 스탯(ap) 강화 템. | 🟢 완벽 |');
// Warmog
md = md.replace(/\| \*\*초대형 텀블러\*\* \(HP\+HP\) \| `warmog` : 기본 체력이 대폭 증가.* \|/g, '| **초대형 텀블러** (HP+HP) | `warmog` : 순수 최대 체력이 800으로 극대화되는 기본 스탯(maxHp) 강화 템. | 🟢 완벽 |');
// Guardbreaker
md = md.replace(/\| \*\*일진의 너클\*\* \(HP\+Crit\) \| `guardbreaker` : 보호막 있는 적 공격 시 피해량 증가.* \|/g, '| **일진의 너클** (HP+Crit) | `guardbreaker` : 스탯에서 피해 증폭(dmgAmp: 0.15) 기본 제공 및 보호막 공격 시 피해량 25% 증가. | 🟢 완벽 |');

fs.writeFileSync('게임정보.md', md, 'utf8');
console.log('게임정보.md 툴팁 업데이트 완료');
