export const EXP_TABLE = { 1: 2, 2: 4, 3: 8, 4: 14, 5: 24, 6: 36, 7: 50, 8: 70, 9: 90 };

export const SYNERGIES = {
  subjects: {
    '국어': { name: '국어', desc: '[아군 전체] 주문력 버프', levels: { 2: { teamAp: 30, selfAp: 42, desc: '아군 전체 주문력 +30 (국어 유닛은 추가 +42)' }, 4: { teamAp: 80, selfAp: 144, desc: '아군 전체 주문력 +80 (국어 유닛은 추가 +144)' } } },
    '수학': { name: '수학', desc: '치명타 및 방어력 관통', levels: { 2: { critChance: 0.12, critDmg: 0.18, armorPen: 0.12, desc: '치명타 확률 +12%, 치명타 피해 +18%, 방어력 관통 +12%' }, 4: { critChance: 0.43, critDmg: 0.86, armorPen: 0.72, desc: '치명타 확률 +43%, 치명타 피해 +86%, 방어력 관통 +72%' } } },
    '사회': { name: '사회', desc: '고립(1) 또는 완전체(4) 시 발동', exactMatch: true, levels: { 1: { shield: 60, desc: '주변에 아군이 없는 고립 상태로 배치 시 보호막 60 획득' }, 4: { allStats: 0.36, desc: '사회 유닛 4명 배치 시 모든 스탯 +36% 증가' } } },
    '과학': { name: '과학', desc: '피해 증폭 및 스킬 치명타', levels: { 2: { dmgAmp: 0.20, skillCrit: true, critChance: 0.10, desc: '스킬 치명타 가능, 치명타 확률 +10%, 가하는 피해량 +20% 증폭' }, 4: { dmgAmp: 0.60, skillCrit: true, critChance: 0.36, desc: '스킬 치명타 가능, 치명타 확률 +36%, 가하는 피해량 +60% 증폭' } } },
    '영어': { name: '영어', desc: '마나통 감소 및 마나 스틸', levels: { 2: { manaReduc: 0.24, manaBurnFlat: 6, burnToMana: true, desc: '적 전체 최대 마나 -24%. 스킬 사용 시 타겟(가장 가까운 적) 반경 1칸 내 모든 적의 마나를 각각 6씩 강탈하여 아군 전체에게 균등 분배' }, 4: { manaReduc: 0.50, manaBurnFlat: 15, burnToMana: true, bonusMagicDmg: 0.20, desc: '적 전체 최대 마나 -50%. 스킬 사용 시 타겟 반경 1칸 내 모든 적의 마나를 각각 15씩 강탈하여 분배. 기본공격 및 스킬 적중 시 (주문력 20%+공속비례) 추가 마법 피해' } } },
    '체육': { name: '체육', desc: '[아군 전체] 최대 체력 버프', levels: { 2: { teamHp: 100, selfHpMult: 2.0, desc: '아군 전체 최대 체력 +100 (체육 유닛은 기본 체력의 2배 적용)' }, 4: { teamHp: 300, selfHpMult: 2.0, desc: '아군 전체 최대 체력 +300 (체육 유닛은 기본 체력의 2배 적용)' } } },
    '음악': { name: '음악', desc: '초당 마나 재생', levels: { 2: { teamManaRegen: 1, artManaRegen: 2, desc: '아군 전체 초당 마나 재생 +1 (음악 유닛은 추가 +2)' }, 4: { teamManaRegen: 4, artManaRegen: 7, desc: '아군 전체 초당 마나 재생 +4 (음악 유닛은 추가 +7)' } } },
    '미술': { name: '미술', desc: '색채의 캔버스 (장판 효과)', levels: { 2: { canvasDuration: 50, canvasRadius: 1, allyDmgReduc: 0.20, enemyDmgAmp: 0.20, canvasManaRegen: 3, desc: '스킬 사용 시 반경 1칸 미술 장판 5초 생성 (장판 내 아군 피해 20% 감소, 적 피해 20% 증폭, 초당 마나 +3)' }, 4: { canvasDuration: 50, canvasRadius: 2, allyDmgReduc: 0.50, enemyDmgAmp: 0.50, canvasManaRegen: 5, desc: '스킬 사용 시 반경 2칸 미술 장판 5초 생성 (장판 내 아군 피해 50% 감소, 적 피해 50% 증폭, 초당 마나 +5)' } } },
    '도덕': { name: '도덕', desc: '[아군 전체] 방어/마저 버프', levels: { 2: { teamDef: 5, selfDefMult: 2.0, desc: '아군 전체 방어력 및 마법저항력 +5 (도덕 유닛은 기본 방/마저 2배 적용)' }, 4: { teamDef: 10, selfDefMult: 2.0, desc: '아군 전체 방어력 및 마법저항력 +10 (도덕 유닛은 기본 방/마저 2배 적용)' }, 6: { teamDef: 32, selfDefMult: 2.0, desc: '아군 전체 방어력 및 마법저항력 +32 (도덕 유닛은 기본 방/마저 2배 적용)' } } },
    '창체': { name: '창체', desc: '다양한 특별 교육 누적', levels: { 1: { desc: '[학교폭력 예방] 전투 시작 시 가장 공격력이 높은 적 2명 4초간 무장해제 및 침묵' }, 2: { desc: '[심폐소생술 교육] (1) 효과 + 전투 중 아군 최초 2명 사망 면역(1 HP) 및 2초 무적, 30% 회복' }, 3: { desc: '[맞춤형 진로 교육] (1,2) 효과 + 전투 시작 시 아군 전원 역할군 맞춤 영구 버프 부여 (딜러: 공/주문 25% 증폭, 탱커: 체력 25% 및 방마저 30 증가, 서포터: 스킬 마나 15% 감소 및 초당 마나 2 회복)' } } }
  },
  clubs: {
    '선도부': { name: '선도부', desc: '시작 보호막 및 피해 증폭', levels: { 2: { startShieldPct: 0.10, dmgAmp: 0.05, desc: '전투 시작 시 최대 체력의 10% 보호막 획득, 가하는 피해량 5% 증폭' }, 4: { startShieldPct: 0.25, dmgAmp: 0.15, desc: '전투 시작 시 최대 체력의 25% 보호막 획득, 가하는 피해량 15% 증폭' }, 6: { startShieldPct: 0.20, dmgAmp: 0.20, desc: '전투 시작 시 최대 체력의 20% 보호막 획득, 가하는 피해량 20% 증폭' } } },
    '방송부': { name: '방송부', desc: '시작 마나 부여, 사거리 증가 및 피해 증폭', levels: { 3: { startMana: 20, distAmp: 0.10, rangeBuff: 1, desc: '시작 마나 +20, 사거리 +1칸, 대상과의 거리에 비례하여 피해량 최대 10% 증폭' }, 5: { startMana: 40, distAmp: 0.30, rangeBuff: 2, desc: '시작 마나 +40, 사거리 +2칸, 대상과의 거리에 비례하여 피해량 최대 30% 증폭' }, 7: { startMana: 70, distAmp: 0.60, rangeBuff: 3, desc: '시작 마나 +70, 사거리 +3칸, 대상과의 거리에 비례하여 피해량 최대 60% 증폭' } } },
    '육상부': { name: '육상부', desc: '이동 시 중첩 획득 및 적에게 질주', levels: { 2: { dash: true, moveAsBuff: 0.10, movePenBuff: 0.05, maxStacks: 10, desc: '시작 시 가장 가까운 적에게 질주. 매 칸을 이동할 때마다 공속 +10%, 방어력 관통 +5% 획득 (최대 10회 중첩)' }, 4: { dash: true, moveAsBuff: 0.36, movePenBuff: 0.18, maxStacks: 10, desc: '시작 시 질주. 매 칸을 이동할 때마다 공속 +36%, 방관 +18% 획득 (최대 10회 중첩)' }, 6: { dash: true, moveAsBuff: 0.72, movePenBuff: 0.42, maxStacks: 10, keepStacks: true, desc: '시작 시 질주. 매 칸을 이동할 때마다 공속 +72%, 방관 +42% 획득 (최대 10회 중첩). 획득한 스택 영구 유지' } } },
    '보건부': { name: '보건부', desc: '처음 사망하는 아군 부활', levels: { 2: { reviveCount: 1, reviveHpPct: 0.50, shieldPct: 0.10, desc: '처음 사망하는 아군 1명이 최대 체력의 50%로 부활. 부활 시 2초간 디버프 면역 및 주변 아군 10% 보호막 부여' }, 4: { reviveCount: 2, reviveHpPct: 0.50, shieldPct: 0.10, stun: true, selfDefBuff: 1.0, desc: '처음 사망하는 아군 2명이 50%로 부활. 부활 시 2초간 디버프 면역, 주변 아군 10% 보호막, 반경 1칸 적 1.5초 기절 및 본인 방/마저 100% 증가' }, 6: { reviveCount: 3, reviveHpPct: 0.84, shieldPct: 0.15, stun: true, selfDefBuff: 1.0, burstDmg: 0.36, teamHeal: 0.36, desc: '처음 사망하는 아군 3명이 84%로 부활. 4시너지 효과(기절, 보호막 등)에 더해 부활 시 반경 1칸 적에게 최대 체력 36% 폭발 피해 및 아군 전체 36% 회복' } } },
    '급식부': { name: '급식부', desc: '포만감 중첩 (시간 비례 강화)', levels: { 3: { startShield: 100, satietyTick: 50, stackHpPct: 0.05, stackArmorMr: 5, desc: '전투 시작 시 100의 보호막 획득. 매 5초마다 최대 체력 5%, 방/마저 5씩 증가' }, 5: { startShield: 300, satietyTick: 50, stackHpPct: 0.15, stackArmorMr: 15, desc: '전투 시작 시 300의 보호막 획득. 매 5초마다 최대 체력 15%, 방/마저 15씩 증가' }, 7: { startShield: 600, satietyTick: 50, stackHpPct: 0.30, stackArmorMr: 30, desc: '전투 시작 시 600의 보호막 획득. 매 5초마다 최대 체력 30%, 방/마저 30씩 증가' } } },
    '장난꾸러기': { name: '장난꾸러기', desc: '스킬 2회 사용 시 장난 발동', levels: { 2: { prankLevel: 1, desc: '스킬을 2회 사용할 때마다 무작위 적에게 바나나 껍질 투척 (1.5초 기절)' }, 4: { prankLevel: 2, desc: '스킬을 2회 사용할 때마다 무작위 적에게 폭음탄 투척 (1.5초 기절 + 대상 최대 체력 12% 비례 마법 피해)' }, 6: { prankLevel: 3, desc: '스킬을 2회 사용할 때마다 모든 적에게 폭음탄 투척 (광역 2초 기절 + 대상 최대 체력 18% 비례 마법 피해)' } } },
    '경제부': { name: '경제부', desc: '이자 한도 증가 및 자본력 혜택', levels: { 2: { extraInterestCap: 7, desc: '기본 이자 한도(5G)가 7G로 증가합니다.' }, 3: { extraInterestCap: 999, freeReroll: true, desc: '이자 한도가 무제한이 되며, 매 라운드 상점 리롤 1회가 무료(0G)가 됩니다.' } } }
  }
};

export const AUGMENTS = {
  silver: [
    { id: 's1', name: '지각 면제권', desc: '다음 3번의 패배에서 플레이어의 체력이 깎이지 않습니다.' },
    { id: 's2', name: '매점 죽돌이', desc: '매 라운드 종료 시 1골드를 고정적으로 추가 획득합니다.' },
    { id: 's3', name: '재시험 기회', desc: '즉시 상점 새로고침을 5회 무료로 이용할 수 있습니다.' },
    { id: 's4', name: '체육복 대여', desc: '모든 아군 유닛의 최대 체력이 영구적으로 +150 증가합니다.' },
    { id: 's5', name: '야자 땡땡이', desc: '즉시 +10의 경험치를 얻습니다.' },
    { id: 's6', name: '교과서 물려받기', desc: '무작위 2코스트 유닛 4마리와 5골드를 즉시 획득합니다.' },
    { id: 's7', name: '쉬는 시간의 여유', desc: '모든 아군 유닛이 초당 2%의 체력을 자동 회복합니다.' },
    { id: 's8', name: '당번의 책임감', desc: '전장에 배치된 아군 유닛이 3명 이하라면, 받는 피해가 15% 감소합니다.' },
    { id: 's9', name: '도덕적 우월감', desc: '아군 전체의 방어력과 마법 저항력이 +15 증가합니다.' },
    { id: 's10', name: '분실물 센터', desc: '전투 승리 시 무조건 1코스트 혹은 2코스트 유닛을 획득합니다. (1코스트 확률 70%, 2코스트 확률 30%)' },
    { id: 's11', name: '분실물 습득', desc: '즉시 무작위 기본 아이템 1개와 3골드를 획득합니다.' }
  ],
  gold: [
    { id: 'g1', name: '선행 학습', desc: '상점에 등장하는 유닛 확률이 현재 레벨보다 1레벨 높은 기준으로 적용됩니다.' },
    { id: 'g2', name: '벼락치기', desc: '플레이어 레벨이 7레벨에 도달하는 즉시 40골드를 획득합니다.' },
    { id: 'g3', name: '우등생 특혜', desc: '전투에서 승리할 때마다 1경험치와 1골드를 추가 획득합니다.' },
    { id: 'g4', name: '선도부의 위압감', desc: '적 전체의 최대 체력이 시작부터 10% 깎인 채로 전투에 돌입합니다.' },
    { id: 'g5', name: '보충 수업', desc: '현재 전장에 배치된 1성 유닛 중 하나를 무작위로 2성으로 진화시킵니다.' },
    { id: 'g6', name: '특별 전학생', desc: '즉시 무작위 4코스트 유닛 1마리와 10골드를 획득합니다.' },
    { id: 'g7', name: '전교 1등의 노트', desc: '아군 전체의 공격력과 주문력이 +8, 치명타 확률이 +10% 증가합니다.' },
    { id: 'g8', name: '과학 경진대회', desc: '모든 아군이 20%의 피해 흡혈 효과를 얻습니다.' },
    { id: 'g9', name: '든든한 급식', desc: '전투 시작 시 모든 아군 유닛이 체력 300의 보호막을 얻습니다.' },
    { id: 'g10', name: '수학여행', desc: '다음 15번의 상점 새로고침이 무료(0G)가 됩니다.' },
    { id: 'g11', name: '교장선생님의 지원', desc: '즉시 무작위 완성 아이템 1개를 획득합니다.' }
  ],
  prismatic: [
    { id: 'p1', name: '수능 만점자', position: '물리 원딜', role: ['dealer'], desc: '즉시 72의 경험치를 얻고, 5코스트 전설 유닛 1마리를 무작위로 획득합니다.' },
    { id: 'p2', name: '조기 졸업', desc: '레벨업에 필요한 모든 경험치 요구량이 30% 영구 감소합니다.' },
    { id: 'p3', name: '학생 주임의 분노', desc: '모든 아군 유닛이 가하는 피해량이 25% 증폭됩니다.' },
    { id: 'p4', name: '무상 급식', desc: '남은 게임 동안 매 턴 상점의 첫 새로고침 3번이 항상 무료가 됩니다.' },
    { id: 'p5', name: '스파르타 교육', desc: '플레이어 체력이 30 이하시, 아군 전체가 피해 감소 30%와 피흡 30%를 영구 획득합니다.' },
    { id: 'p6', name: '부자 재단', desc: '이자 획득 상한선(기본 5G)이 무제한으로 풀립니다.' },
    { id: 'p7', name: '반장 선거 압승', desc: '아군 전체의 공격 속도가 30% 증가하고, 전투 시작 시 50의 마나를 즉시 얻습니다.' },
    { id: 'p8', name: '조기 귀가', desc: '패배 시 깎이는 플레이어 본체의 체력 피해가 절반(50%)으로 영구히 줄어듭니다.' },
    { id: 'p9', name: '전설의 졸업생', desc: '즉시 무작위 5코스트 전설 유닛 3마리와 20골드를 획득합니다.' },
    { id: 'p10', name: '방송부 스피커 장악', desc: '아군 전체의 기본 사거리가 +1 증가하고 대상과 거리가 멀수록 데미지가 추가 증폭됩니다.' },
    { id: 'p11', name: '학부모회의 기부', desc: '즉시 무작위 완성 아이템 2개와 10골드를 획득합니다.' },
    { id: 'p12', name: '[보건부 6] 불로불사', desc: '보건부 6 활성화 시: 보건부 유닛이 부활할 때마다 즉시 전체 아군의 체력을 100% 회복시키며, 부활한 유닛은 남은 전투 동안 가하는 모든 피해량이 100% 증폭됩니다.' },
    { id: 'p13', name: '[방송부 7] 긴급 속보', desc: '방송부 7 활성화 시: 전투 시작 직후 3.5초간 적 전체를 침묵 및 기절시킵니다. 방송부 유닛의 사거리가 전장 전체로 무한히 확장되며, 공격 속도가 30% 추가 상승합니다.' },
    { id: 'p14', name: '[육상부 6] 빛의 속도', desc: '육상부 6 활성화 시: 전투 시작과 동시에 즉시 육상부 5중첩을 얻습니다. 최대 중첩(10스택) 도달 시 기본 공격이 일직선상의 적들을 관통하며 입힌 피해의 30%를 흡혈합니다.' },
    { id: 'p15', name: '[도덕 6] 절대 선', desc: '도덕 6 활성화 시: 적에게 피해를 입을 때마다 자신의 방어력 및 마법 저항력 총합의 100%만큼 적에게 고정 피해를 반사합니다. 추가로 매초 최대 체력의 4%를 지속 회복합니다.' },
    { id: 'p21', name: '[선도부 6] 철권 통치', desc: '선도부 6 활성화 시: 전투 시작 시 획득하는 선도부 보호막이 최대 체력의 80%로 대폭 상향되며 파괴 전까지 영구 지속됩니다. 또한 가하는 피해량 증폭이 50%로 고정 적용됩니다.' },
    { id: 'p22', name: '[급식부 7] 특급 만찬', desc: '급식부 7 활성화 시: 포만감 스택 주기(기본 5초)가 2.5초로 단축되며, 급식부 유닛이 얻는 스탯(최대 체력 및 방/마저 증가)이 팀 전체 아군에게 100% 동일하게 공유됩니다.' },
    { id: 'p23', name: '[장난꾸러기 6] 대혼돈의 교실', desc: '장난꾸러기 6 활성화 시: 발동 조건이 스킬 2회에서 1회로 감소하여 스킬을 쓸 때마다 폭음탄을 던집니다. 폭음탄의 대상 최대 체력 비례 마법 피해가 36%로 증폭됩니다.' }
  ]
};

export const UNIT_POOL = [
  // 1-Cost (10 units)
  {
    id: 'u1_1', name: '칠판닦이 당번', position: '공격형 탱커', role: ['tank','dealer'], subject: '도덕', club: '선도부', tier: 1, icon: '🧹', manaType: '근성', stats: { hp: 500, mana: 50, maxMana: 100, ad: 40, ap: 100, armor: 30, mr: 30, as: 0.6, range: 1 },
    skill: { name: '일벌백계', desc: '주변 1칸 적에게 피해 + 본인 방어력 증가', type: 'aoe_damage_buff', vfx: 'slam_yellow', aoeRange: 1, adRatio: [1.5, 1.7, 2.0], selfDefBuff: [0.2, 0.35, 0.5], buffDuration: [30, 40, 50] }
  },
  {
    id: 'u1_2', name: '달리기 선수', position: '물리 암살자', role: ['dealer'], subject: '체육', club: '육상부', tier: 1, icon: '🏃', manaType: '전투', stats: { hp: 500, mana: 0, maxMana: 60, ad: 70, ap: 100, armor: 15, mr: 15, as: 0.8, range: 1 },
    skill: { name: '전력질주', desc: '가장 먼 적에게 돌진하여 물리 피해 + 기절', type: 'dash_damage', vfx: 'dash_blue', hpRatio: [0.1, 0.1, 0.15], stunDuration: [10, 15, 25] }
  },
  {
    id: 'u1_3', name: '영단어 암기왕', position: '공격력 마법사', role: ['dealer'], subject: '영어', club: '장난꾸러기', tier: 1, icon: '🔤', manaType: '전투', stats: { hp: 400, mana: 0, maxMana: 60, ad: 50, ap: 100, armor: 15, mr: 20, as: 0.7, range: 2 },
    skill: { name: '단어 폭격', desc: '랜덤 적 3명에게 물리 피해', type: 'random_aoe', vfx: 'magic_purple', targetCount: 3, adRatio: [1.2, 1.3, 1.6] }
  },
  {
    id: 'u1_4', name: '국어부장', position: '주문력 마법사', role: ['dealer'], subject: '국어', club: '방송부', tier: 1, icon: '📖', manaType: '집중', stats: { hp: 500, mana: 0, maxMana: 80, ad: 30, ap: 100, armor: 15, mr: 25, as: 0.6, range: 3 },
    skill: { name: '집요한 팩트체크', desc: '단일 적에게 맹렬한 팩트체크를 날려 일정 시간 지속적인 마법 피해(도트)를 입힙니다.', type: 'single_dot', vfx: 'debuff_dark', apRatio: [4.0, 6.0, 9.0], dotDuration: [100, 80, 60] }
  },
  {
    id: 'u1_5', name: '수학 짝꿍', position: '물리 원딜', role: ['dealer'], subject: '수학', club: '급식부', tier: 1, icon: '➕', manaType: '근성', stats: { hp: 500, mana: 0, maxMana: 0, ad: 35, ap: 100, armor: 25, mr: 20, as: 0.6, range: 1 },
    skill: { name: '지수 함수 성장', desc: '패시브: 매 수회 공격마다 자신의 공격력과 공격 속도가 영구적으로 스탯 증가', type: 'passive', vfx: 'buff_green', buffPct: [0.01, 0.02, 0.04], charges: [3, 3, 3] }
  },
  {
    id: 'u1_6', name: '지리덕후', position: '공격력 마법사', role: ['dealer'], subject: '사회', club: '보건부', tier: 1, icon: '🌍', manaType: '전투', stats: { hp: 450, mana: 0, maxMana: 90, ad: 45, ap: 100, armor: 20, mr: 30, as: 0.6, range: 2 },
    skill: { name: '지도 분석', desc: '대상에게 물리 피해 + 방어력 관통', type: 'single_damage', vfx: 'debuff_dark', armorRatio: [1.5, 1.5, 1.5], armorPen: [0.3, 0.5, 0.7] }
  },
  {
    id: 'u1_7', name: '과학탐구원', position: '물리 전사', role: ['dealer'], subject: '과학', club: '육상부', tier: 1, icon: '🔭', manaType: '전투', stats: { hp: 550, mana: 0, maxMana: 60, ad: 60, ap: 100, armor: 15, mr: 15, as: 0.75, range: 1 },
    skill: { name: '실험 반응', desc: '대상에게 물리 피해 + 피해 흡혈 획득', type: 'single_damage_buff', vfx: 'fire_red', adRatio: [1.8, 2.0, 2.8], vampBuff: [0.1, 0.1, 0.15], buffDuration: [30, 40, 50] }
  },
  {
    id: 'u1_8', name: '리코더 요정', position: '주문력 힐러', role: ['support'], subject: '음악', club: '급식부', tier: 1, icon: '🎵', manaType: '집중', stats: { hp: 400, mana: 20, maxMana: 80, ad: 25, ap: 100, armor: 15, mr: 15, as: 0.6, range: 3 },
    skill: { name: '힐링 멜로디', desc: '체력이 가장 낮은 아군 체력 회복', type: 'heal', vfx: 'heal_white', healPct: [0.2, 0.3, 0.45] }
  },
  {
    id: 'u1_9', name: '찰흙 조각가', position: '주문력 탱커', role: ['tank'], subject: '미술', club: '장난꾸러기', tier: 1, icon: '🗿', manaType: '근성', stats: { hp: 450, mana: 0, maxMana: 70, ad: 40, ap: 100, armor: 25, mr: 20, as: 0.6, range: 1 },
    skill: { name: '점토 방벽', desc: '본인에게 보호막 부여', type: 'self_shield', vfx: 'shield_gray', adRatio: [3.0, 3.3, 5.0] }
  },
  {
    id: 'u1_10', name: '복도 지킴이', position: '퓨어 탱커', role: ['tank'], subject: '도덕', club: '보건부', tier: 1, icon: '🛑', manaType: '근성', stats: { hp: 550, mana: 0, maxMana: 60, ad: 50, ap: 100, armor: 35, mr: 30, as: 0.55, range: 1 },
    skill: { name: '출입금지', desc: '본인 마법저항력 증가 + 주변 적 도발', type: 'taunt', vfx: 'shield_gray', selfMrBuff: [0.3, 0.5, 1.2], tauntDuration: [10, 20, 50] }
  },

  // 2-Cost (10 units)
  {
    id: 'u2_1', name: '과학실험부장', position: '주문력 마법사', role: ['dealer'], subject: '과학', club: '방송부', tier: 2, icon: '🧪', manaType: '집중', stats: { hp: 600, mana: 30, maxMana: 90, ad: 35, ap: 100, armor: 20, mr: 20, as: 0.65, range: 3 },
    skill: { name: '폭발 실험', desc: '대상 주변 1칸에 마법 피해', type: 'aoe_magic', vfx: 'fire_red', aoeRange: 1, apRatio: [2.0, 3.2, 6.0] }
  },
  {
    id: 'u2_2', name: '체육부장', position: '물리 전사', role: ['dealer','tank'], subject: '체육', club: '선도부', tier: 2, icon: '⚽', manaType: '근성', stats: { hp: 650, mana: 20, maxMana: 80, ad: 45, ap: 100, armor: 35, mr: 35, as: 0.6, range: 1 },
    skill: { name: '태클 돌진', desc: '대상에게 물리 피해 + 기절', type: 'single_damage_cc', vfx: 'dash_blue', hpRatio: [0.15, 0.15, 0.25], stunDuration: [20, 25, 35] }
  },
  {
    id: 'u2_3', name: '문학소녀', position: '주문력 인챈터', role: ['support'], subject: '국어', club: '보건부', tier: 2, icon: '📚', manaType: '집중', stats: { hp: 500, mana: 20, maxMana: 60, ad: 45, ap: 100, armor: 20, mr: 30, as: 0.6, range: 3 },
    skill: { name: '영감의 시', desc: '아군 전체 공격 속도 증가 + 적 전체 마저 감소', type: 'team_buff_enemy_debuff', vfx: 'buff_green', buffStat: 'as', buffPct: [0.3, 0.4, 0.6], enemyMrReduc: [10, 20, 35], buffDuration: [50, 60, 80] }
  },
  {
    id: 'u2_4', name: '수학천재', position: '물리 원딜', role: ['dealer'], subject: '수학', club: '육상부', tier: 2, icon: '📐', manaType: '전투', stats: { hp: 500, mana: 0, maxMana: 60, ad: 70, ap: 100, armor: 20, mr: 20, as: 0.8, range: 2 },
    skill: { name: '피타고라스의 일격', desc: '대상에게 삼각자를 던져 물리 피해를 입히고, 주변의 다른 적에게 최대 수회 튕기며 추가 물리 피해', type: 'bounce_damage', vfx: 'triangle_ruler', adRatio: [2.0, 2.0, 2.0], charges: [3, 4, 5] }
  },
  {
    id: 'u2_5', name: '역사 매니아', position: '체력비례 전문가', role: ['dealer'], subject: '사회', club: '경제부', tier: 2, icon: '📜', manaType: '집중', stats: { hp: 650, mana: 0, maxMana: 80, ad: 40, ap: 100, armor: 30, mr: 20, as: 0.65, range: 2 },
    skill: { name: '고대의 지혜', desc: '대상 최대 체력 비례 고정 피해를 입힙니다.', type: 'true_damage', vfx: 'debuff_dark', trueDmgPct: [0.12, 0.18, 0.30], apRatio: [0.02, 0.02, 0.02] }
  },
  {
    id: 'u2_6', name: '팝송 매니아', position: '마나제어 전문가', role: ['dealer'], subject: '영어', club: '보건부', tier: 2, icon: '🎧', manaType: '집중', stats: { hp: 450, mana: 15, maxMana: 50, ad: 45, ap: 100, armor: 15, mr: 25, as: 0.7, range: 3 },
    skill: { name: '리듬 디스', desc: '무작위 적 3명에게 마법 피해 + 마나 획득 감소', type: 'random_aoe_debuff', vfx: 'magic_purple', targetCount: 3, apRatio: [1.2, 1.8, 4.0], manaReducPct: [0.5, 0.5, 0.75], debuffDuration: [20, 30, 40] }
  },
  {
    id: 'u2_7', name: '급식 당번', position: '주문력 힐러', role: ['support'], subject: '미술', club: '급식부', tier: 2, icon: '🍱', manaType: '집중', stats: { hp: 700, mana: 0, maxMana: 100, ad: 40, ap: 100, armor: 30, mr: 30, as: 0.55, range: 2 },
    skill: { name: '영양 만점 급식', desc: '아군 전체 회복', type: 'team_heal', vfx: 'heal_white', hpRatio: [0.08, 0.08, 0.15] }
  },
  {
    id: 'u2_8', name: '골목대장', position: '물리 전사', role: ['dealer','tank'], subject: '체육', club: '장난꾸러기', tier: 2, icon: '🧢', manaType: '근성', stats: { hp: 600, mana: 0, maxMana: 60, ad: 50, ap: 100, armor: 25, mr: 20, as: 0.75, range: 1 },
    skill: { name: '주먹이 운다', desc: '대상에게 강력한 물리 피해 + 주변 1칸 스플래시 피해 + 본인 공격력 영구 증가', type: 'single_damage_stack', vfx: 'slam_yellow', adRatio: [3.0, 3.3, 5.0], hpRatioSplash: [0.05, 0.05, 0.05], splashRange: 1, permAdBuff: [0.15, 0.25, 0.5] }
  },
  {
    id: 'u2_9', name: '합창단 에이스', position: '주문력 인챈터', role: ['support'], subject: '음악', club: '방송부', tier: 2, icon: '🎤', manaType: '집중', stats: { hp: 550, mana: 30, maxMana: 90, ad: 35, ap: 100, armor: 15, mr: 20, as: 0.7, range: 3 },
    skill: { name: '하모니', desc: '가까운 아군 2명에게 보호막 부여', type: 'ally_shield', vfx: 'shield_gray', targetCount: 2, apRatio: [2.0, 3.0, 5.0] }
  },
  {
    id: 'u2_11', name: '진로진학 멘토', position: '주문력 인챈터', role: ['support','dealer'], subject: '창체', club: '소속없음', tier: 2, icon: '🧭', manaType: '집중', stats: { hp: 550, mana: 20, maxMana: 70, ad: 40, ap: 100, armor: 25, mr: 25, as: 0.65, range: 3 },
    skill: { name: '맞춤형 처방', desc: '가장 체력 비율이 낮은 아군을 치유하고, 회복한 수치만큼 무작위 적 1명에게 마법 피해를 입힙니다.', type: 'heal_and_damage', vfx: 'heal_white', apRatio: [2.0, 3.0, 5.0] }
  },
  {
    id: 'u2_10', name: '바른생활 사나이', position: '공격형 탱커', role: ['tank'], subject: '도덕', club: '선도부', tier: 2, icon: '🙋‍♂️', manaType: '근성', stats: { hp: 650, mana: 0, maxMana: 70, ad: 45, ap: 100, armor: 35, mr: 30, as: 0.6, range: 1 },
    skill: { name: '규칙 엄수', desc: '주변 적 전체 공격력 감소', type: 'aoe_debuff', vfx: 'debuff_dark', aoeRange: 1, armorRatio: [0.4, 0.4, 0.4], debuffDuration: [50, 60, 80] }
  },
  {
    id: 'u2_12', name: '칠판 낙서꾼', position: '디버프 전문가', role: ['support','dealer'], subject: '수학', club: '장난꾸러기', tier: 2, icon: '🖍️', manaType: '집중', stats: { hp: 550, mana: 0, maxMana: 70, ad: 60, ap: 100, armor: 25, mr: 25, as: 0.7, range: 2 },
    skill: { name: '난해한 수식', desc: '적 밀집 지역에 마법 피해를 주고 3초간 침묵 상태(스킬 사용 불가)로 만듭니다.', type: 'aoe_magic_silence', vfx: 'magic_purple', aoeRange: 1, apRatio: [1.2, 1.8, 3.0], silenceDuration: [30, 30, 30] }
  },

  // 3-Cost (9 units)
  {
    id: 'u3_1', name: '올림피아드 금상', position: '공격력 마법사', role: ['dealer'], subject: '수학', club: '선도부', tier: 3, icon: '🏆', manaType: '전투', stats: { hp: 800, mana: 0, maxMana: 60, ad: 50, ap: 100, armor: 40, mr: 40, as: 0.65, range: 1 },
    skill: { name: '완벽한 풀이', desc: '대상에게 방어력을 관통하는 단일 물리 피해', type: 'single_damage', vfx: 'slam_yellow', adRatio: [6.0, 7.0, 9.0], armorPen: [0.55, 0.715, 0.88] }
  },
  {
    id: 'u3_2', name: '양호실 도우미', position: '주문력 인챈터', role: ['support','tank'], subject: '도덕', club: '보건부', tier: 3, icon: '💊', manaType: '근성', stats: { hp: 750, mana: 30, maxMana: 90, ad: 60, ap: 100, armor: 35, mr: 60, as: 0.65, range: 1 },
    skill: { name: '응급 처치', desc: '체력 비율이 가장 낮은 아군 회복 + 보호막', type: 'heal_shield', vfx: 'heal_white', mrRatio: [2.5, 2.5, 2.5] }
  },
  {
    id: 'u3_3', name: '육상부 에이스', position: '하이브리드 원딜', role: ['dealer'], subject: '체육', club: '육상부', tier: 3, icon: '🥇', manaType: '전투', stats: { hp: 730, mana: 0, maxMana: 50, ad: 75, ap: 100, armor: 20, mr: 20, as: 0.85, range: 1 },
    skill: { name: '미친 스퍼트', desc: '공격 속도 대폭 증가', type: 'self_buff', vfx: 'buff_green', buffType: 'attackSpeed', asBuff: [0.5, 0.8, 1.5], buffDuration: [20, 30, 50] }
  },
  {
    id: 'u3_4', name: '발명품 매니아', position: '주문력 마법사', role: ['dealer'], subject: '과학', club: '장난꾸러기', tier: 3, icon: '💡', manaType: '전투', stats: { hp: 650, mana: 0, maxMana: 80, ad: 60, ap: 100, armor: 20, mr: 30, as: 0.75, range: 2 },
    skill: { name: '폭탄 투척', desc: '가장 밀집된 적 주변 광역 마법 피해', type: 'aoe_magic_cluster', vfx: 'fire_red', aoeRange: 1, adRatio: [2.75, 3.0, 3.7] }
  },
  {
    id: 'u3_5', name: '사회탐구 1타', position: '주문력 암살자', role: ['dealer'], subject: '사회', club: '방송부', tier: 3, icon: '🗺️', manaType: '집중', stats: { hp: 600, mana: 40, maxMana: 100, ad: 45, ap: 100, armor: 25, mr: 40, as: 0.7, range: 4 },
    skill: { name: '세계화 전략', desc: '가장 먼 적에게 마법 피해', type: 'farthest_magic', vfx: 'magic_purple', apRatio: [3.5, 5.0, 8.0] }
  },
  {
    id: 'u3_6', name: '시조 읊는 선비', position: '주문력 마법사', role: ['dealer','support'], subject: '국어', club: '급식부', tier: 3, icon: '🍵', manaType: '집중', stats: { hp: 700, mana: 0, maxMana: 90, ad: 50, ap: 100, armor: 30, mr: 45, as: 0.65, range: 2 },
    skill: { name: '연쇄 시조음', desc: '적들에게 튕기는 시조음결을 던져 마법 피해와 치유 감소(50%) 부여', type: 'bounce_magic', vfx: 'magic_purple', apRatio: [2.5, 3.5, 5.0], charges: [4, 5, 7], antiHealDuration: [50, 50, 50], bounceRatio: 1.0 }
  },
  {
    id: 'u3_7', name: '영어 프리토커', position: '마나제어 전문가', role: ['dealer','support'], subject: '영어', club: '방송부', tier: 3, icon: '🗣️', manaType: '집중', stats: { hp: 600, mana: 20, maxMana: 80, ad: 55, ap: 100, armor: 20, mr: 25, as: 0.75, range: 3 },
    skill: { name: '토론 압살', desc: '대상 마나 소멸 + 마법 피해', type: 'mana_burn', vfx: 'debuff_dark', manaBurnPct: [0.3, 0.5, 0.8], apRatio: [3.0, 4.5, 7.5] }
  },
  {
    id: 'u3_8', name: '오케스트라 단장', position: '주문력 인챈터', role: ['support'], subject: '음악', club: '급식부', tier: 3, icon: '🎼', manaType: '집중', stats: { hp: 650, mana: 50, maxMana: 90, ad: 40, ap: 100, armor: 25, mr: 30, as: 0.65, range: 3 },
    skill: { name: '교향곡', desc: '아군 전체 힐 + 공속 증가', type: 'team_heal_buff', vfx: 'heal_white', healPct: [0.15, 0.20, 0.30], asBuff: [0.30, 0.45, 0.60], buffDuration: [30, 40, 50] }
  },
  {
    id: 'u3_9', name: '수채화 장인', position: '마나제어 전문가', role: ['dealer','support'], subject: '미술', club: '선도부', tier: 3, icon: '🎨', manaType: '집중', stats: { hp: 750, mana: 30, maxMana: 100, ad: 45, ap: 100, armor: 40, mr: 30, as: 0.6, range: 2 },
    skill: { name: '색의 마법', desc: '랜덤 적 2명에게 마법 피해 + 마나 봉인', type: 'random_aoe_debuff', vfx: 'magic_purple', targetCount: 2, apRatio: [1.5, 2.5, 4.0], manaReducPct: [1.0, 1.0, 1.0], debuffDuration: [30, 40, 50] }
  },
  {
    id: 'u3_10', name: '미술 치료사', position: '주문력 인챈터', role: ['support'], subject: '미술', club: '보건부', tier: 3, icon: '👩‍⚕️', manaType: '집중', stats: { hp: 700, mana: 20, maxMana: 90, ad: 40, ap: 100, armor: 30, mr: 40, as: 0.65, range: 3 },
    skill: { name: '마음 그리기', desc: '체력이 가장 낮은 아군의 방해 효과를 해제하고 보호막을 부여하며 4초간 공격력과 주문력을 증가시킵니다.', type: 'cleanse_shield_buff', vfx: 'heal_white', shieldFlat: [200, 300, 500], buffPct: [0.3, 0.3, 0.3], buffDuration: [40, 40, 40] }
  },
  {
    id: 'u3_11', name: '또래 상담 에이스', position: '주문력 인챈터', role: ['support','tank'], subject: '창체', club: '소속없음', tier: 3, icon: '💬', manaType: '근성', stats: { hp: 850, mana: 30, maxMana: 100, ad: 50, ap: 100, armor: 45, mr: 45, as: 0.6, range: 1 },
    skill: { name: '마음의 방벽', desc: '반경 2칸 내 아군에게 보호막을 씌우고, 보호막 유지 중 군중 제어기(CC) 면역 부여', type: 'aoe_shield_cc_immune', vfx: 'shield_gray', aoeRange: 2, shieldFlat: [350, 500, 800] }
  },
  {
    id: 'u3_12', name: '해외 보따리상', position: '처형 전문가', role: ['dealer'], subject: '영어', club: '경제부', tier: 3, icon: '📦', manaType: '전투', stats: { hp: 650, mana: 0, maxMana: 80, ad: 45, ap: 100, armor: 25, mr: 25, as: 0.75, range: 3 },
    skill: { name: '관세 폭탄', desc: '현재 체력이 가장 적은 적을 우선 지정하여 마법 피해를 줍니다. 이 스킬로 대상을 처치하면 50% 확률로 1골드를 획득합니다.', type: 'lowest_hp_magic_gold', vfx: 'magic_purple', apRatio: [3.5, 5.0, 7.5] }
  },

  // 4-Cost (7 units)
  {
    id: 'u4_1', name: '전교 체육부장', position: '퓨어 탱커', role: ['tank'], subject: '체육', club: '선도부', tier: 4, icon: '🦍', manaType: '근성', stats: { hp: 1250, mana: 0, maxMana: 100, ad: 80, ap: 100, armor: 65, mr: 65, as: 0.7, range: 1 },
    skill: { name: '전력 태클', desc: '주변(3x3 반경 1칸) 적에게 피해 + 기절 + 본인에게 보호막 부여', type: 'aoe_damage_cc_shield', vfx: 'slam_yellow', aoeRange: 1, hpRatioDmg: [0.1, 0.2, 0.4], stunDuration: [20, 30, 40], hpRatioShield: [0.3, 0.4, 0.6] }
  },
  {
    id: 'u4_2', name: '수능 만점자', position: '물리 원딜', role: ['dealer'], subject: '수학', club: '방송부', tier: 4, icon: '💯', manaType: '전투', stats: { hp: 1100, mana: 50, maxMana: 90, ad: 90, ap: 100, armor: 40, mr: 40, as: 0.9, range: 3 },
    skill: { name: '정밀 분석', desc: '일정 시간 방어력 무시, 치명타 100% 및 공격 속도 증가', type: 'self_buff', vfx: 'buff_green', buffType: 'precision', asBuff: [0.5, 0.8, 1.5], buffDuration: [50, 70, 100] }
  },
  {
    id: 'u4_3', name: '미친 과학자', position: '주문력 마법사', role: ['dealer'], subject: '과학', club: '장난꾸러기', tier: 4, icon: '🌋', manaType: '전투', stats: { hp: 950, mana: 40, maxMana: 110, ad: 80, ap: 100, armor: 45, mr: 45, as: 0.85, range: 2 },
    skill: { name: '연쇄 폭발', desc: '타겟 중심 십자열(상하좌우) 적에게 마법 피해', type: 'cross_magic', vfx: 'fire_red', apRatio: [3.0, 3.5, 4.5] }
  },
  {
    id: 'u4_4', name: '논술의 신', position: '물리 암살자', role: ['dealer'], subject: '국어', club: '육상부', tier: 4, icon: '✍️', manaType: '전투', stats: { hp: 1050, mana: 0, maxMana: 80, ad: 110, ap: 100, armor: 40, mr: 30, as: 0.8, range: 1 },
    skill: { name: '필살의 논리', desc: '단일 적에게 강력한 마법 피해', type: 'single_damage', vfx: 'slam_yellow', apRatio: [8.0, 12.0, 20.0] }
  },
  {
    id: 'u4_5', name: '전교 학생회장', position: '주문력 인챈터', role: ['support','tank'], subject: ['사회', '국어'], club: '급식부', tier: 4, icon: '👑', manaType: '근성', stats: { hp: 1100, mana: 0, maxMana: 130, ad: 60, ap: 100, armor: 45, mr: 45, as: 0.65, range: 1 },
    skill: { name: '전교생 집합', desc: '아군 전체 공격력 및 주문력 증가 + 피해 감소 및 보호막', type: 'team_buff_shield', vfx: 'buff_green', statBuffPct: [0.25, 0.35, 0.5], shieldFlat: [400, 600, 900], dmgReducPct: [0.15, 0.20, 0.30], buffDuration: [40, 40, 40] }
  },
  {
    id: 'u4_6', name: '나이팅게일', position: '주문력 힐러', role: ['support'], subject: '도덕', club: '보건부', tier: 4, icon: '🕊️', manaType: '집중', stats: { hp: 1200, mana: 40, maxMana: 100, ad: 75, ap: 100, armor: 50, mr: 65, as: 0.7, range: 3 },
    skill: { name: '천사의 손길', desc: '아군 전체 회복 + 가장 많이 다친 아군 추가 회복', type: 'team_heal_plus', vfx: 'heal_white', defMrRatio: [1.5, 2.0, 3.0], extraHealPct: [0.2, 0.3, 0.5] }
  },
  {
    id: 'u4_7', name: '천재 피아니스트', position: '주문력 인챈터', role: ['support','dealer'], subject: '음악', club: ['방송부', '급식부'], tier: 4, icon: '🎹', manaType: '집중', stats: { hp: 900, mana: 40, maxMana: 100, ad: 85, ap: 100, armor: 35, mr: 40, as: 0.85, range: 3 },
    skill: { name: '즉흥 연주', desc: '적 전체 마법 피해 + 아군 전체 마나 회복', type: 'global_magic_mana', vfx: 'magic_purple', apRatio: [2.0, 3.2, 5.0], teamMana: [30, 50, 80] }
  },
  {
    id: 'u4_8', name: '천재 퀀트', position: '공격력 마법사', role: ['dealer'], subject: ['수학', '과학'], club: '경제부', tier: 4, icon: '💹', manaType: '전투', stats: { hp: 950, mana: 0, maxMana: 60, ad: 70, ap: 100, armor: 30, mr: 30, as: 0.75, range: 3 },
    skill: { name: '주가 떡상', desc: '대상에게 물리 피해(공격력의 200/300/500%)를 입히고 처치 시 마나를 50 회복합니다. 이 피해량은 플레이어의 현재 보유 골드 10당 20%씩 곱연산으로 증폭됩니다.', type: 'single_physical_gold_scaling', vfx: 'slam_yellow', adRatio: [2.0, 3.0, 5.0], killManaRestore: 50 }
  },

  // 5-Cost (4 units)
  {
    id: 'u5_1', name: '외고 전학생', position: '하이브리드 원딜', role: ['dealer'], subject: ['영어', '음악'], club: '육상부', tier: 5, icon: '✈️', manaType: '전투', stats: { hp: 1080, mana: 0, maxMana: 100, ad: 90, ap: 100, armor: 35, mr: 35, as: 0.85, range: 2 },
    skill: { name: '글로벌 스트라이크', desc: '공격 속도 증가 + 사거리 증가 + 추가 고정 피해', type: 'self_buff_hyper', vfx: 'buff_green', asBuff: [0.8, 1.2, 99.0], rangeBuff: [2, 3, 20], bonusTrueDmg: [50, 100, 9999], asRatio: [50, 100, 9999], buffDuration: [30, 30, 999] }
  },
  {
    id: 'u5_2', name: '수석 연구원', position: '디버프 전문가', role: ['support','dealer'], subject: '과학', club: '급식부', tier: 5, icon: '👽', manaType: '집중', stats: { hp: 1100, mana: 50, maxMana: 150, ad: 90, ap: 100, armor: 40, mr: 40, as: 0.9, range: 3 },
    skill: { name: '차원 분열', desc: '적 전체 광역 마법 피해 + 방/마저 감소', type: 'global_magic_debuff', vfx: 'fire_red', apRatio: [3.0, 4.5, 99.0], defReducPct: [0.3, 0.4, 0.99], debuffDuration: [50, 70, 999] }
  },
  {
    id: 'u5_3', name: '피카소의 재림', position: '주문력 인챈터', role: ['support'], subject: '미술', club: '장난꾸러기', tier: 5, icon: '🧑‍🎨', manaType: '집중', stats: { hp: 1050, mana: 40, maxMana: 120, ad: 100, ap: 100, armor: 35, mr: 35, as: 0.95, range: 3 },
    skill: { name: '명작 탄생', desc: '적 전체 마법 피해 + 아군 전체 전투 중 스탯 증가 버프', type: 'global_magic_team_buff', vfx: 'magic_purple', adRatio: [2.0, 2.2, 99.0], teamStatBuff: [0.1, 0.2, 9.9] }
  },
  {
    id: 'u5_4', name: '교장 선생님', position: '디버프 전문가', role: ['support','tank'], subject: '도덕', club: '선도부', tier: 5, icon: '👨‍🏫', manaType: '근성', stats: { hp: 1300, mana: 80, maxMana: 200, ad: 80, ap: 100, armor: 60, mr: 60, as: 0.7, range: 1 },
    skill: { name: '훈시', desc: '적 전체 기절 및 디버프 + 본인 방어력과 마저에 비례한 마법 피해', type: 'global_cc_dmg_debuff', vfx: 'stun_star', stunDuration: [30, 40, 999], statReducPct: [0.3, 0.4, 0.99], debuffDuration: [50, 50, 999], defMrRatio: [1.0, 1.5, 99.0] }
  },
  {
    id: 'u5_5', name: '기부 천사', position: '서포터', role: ['support'], subject: '창체', club: '소속없음', tier: 5, icon: '🎁', manaType: '집중', stats: { hp: 1150, mana: 50, maxMana: 140, ad: 85, ap: 100, armor: 45, mr: 45, as: 0.8, range: 3 },
    skill: { name: '사랑의 바자회', desc: '패시브: 전투 시작 시 자신과 상하좌우로 인접한 아군에게 완성 아이템 1/2/4개 임시 부여. 액티브: 맵 전체 아군 거대 보호막 및 회복', type: 'global_heal_shield', vfx: 'heal_white', adjPassiveItems: [1, 2, 4], shieldFlat: [400, 600, 9999], healFlat: [300, 500, 9999] }
  }
];
