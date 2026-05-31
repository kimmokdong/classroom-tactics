import fs from 'fs';

let content = fs.readFileSync('js/data.js', 'utf8');

// Update 사회
content = content.replace(/levels:\s*\{\s*1:\s*\{\s*shield:\s*50[^}]*?\},\s*4:\s*\{\s*allStats:\s*0\.10[^}]*?\}\s*\}/g,
  "levels: { 1: { shield: 50, desc: '고립 상태로 배치 시 보호막 50 획득' }, 3: { allStats: 0.10, desc: '모든 스탯 +10% 증가' }, 5: { allStats: 0.25, desc: '모든 스탯 +25% 증가' } }");

// Update 급식부
content = content.replace(/levels:\s*\{\s*3:\s*\{([^}]+?)\},\s*5:\s*\{([^}]+?)\},\s*7:\s*\{([^}]+?)\}\s*\}/g,
  "levels: { 3: {$1}, 5: {$2}, 8: {$3} }");

// Update 장난꾸러기
content = content.replace(/levels:\s*\{\s*2:\s*\{([^}]+?)\},\s*4:\s*\{([^}]+?)\},\s*6:\s*\{([^}]+?)\}\s*\}/g,
  "levels: { 2: {$1}, 3: {$2}, 5: {$3}, 6: { prankLevel: 4, desc: '모든 적 폭음탄 및 추가피해' } }");

// Update 과학
content = content.replace(/levels:\s*\{\s*2:\s*\{([^}]+?)\},\s*4:\s*\{([^}]+?)\}\s*\}/g,
  "levels: { 2: {$1}, 4: {$2}, 5: { dmgAmp: 0.60, skillCrit: true, critChance: 0.30, desc: '스킬 치명타 가능, 치명타 확률 +30%, 가하는 피해량 +60% 증폭' } }");

// Update 체육
content = content.replace(/levels:\s*\{\s*2:\s*\{([^}]+?)\},\s*4:\s*\{([^}]+?)\}\s*\}/g,
  "levels: { 2: {$1}, 3: { teamHp: 150, selfHpMult: 2.0, desc: '아군 전체 최대 체력 +150' }, 4: {$2}, 5: { teamHp: 400, selfHpMult: 2.0, desc: '아군 전체 최대 체력 +400' } }");

fs.writeFileSync('js/data.js', content);
console.log('SYNERGIES breakpoints updated.');
