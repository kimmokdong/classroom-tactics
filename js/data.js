export const EXP_TABLE = { 1: 2, 2: 4, 3: 8, 4: 14, 5: 24, 6: 36, 7: 50, 8: 70, 9: 100 };

export const SYNERGIES = {
    subjects: {
        '국어': { name: '국어', desc: '[아군 전체] 주문력 % 증가', levels: { 2: { teamAp: 40, selfAp: 60 }, 4: { teamAp: 120, selfAp: 180 } } },
        '수학': { name: '수학', desc: '치명타 (스킬에도 적용)', levels: { 2: { critChance: 0.3, critDmg: 0.3, skillCrit: true }, 4: { critChance: 0.5, critDmg: 0.5, skillCrit: true } } },
        '사회': { name: '사회', desc: '고립(1) 또는 완전체(4) 시 발동', exactMatch: true, levels: { 1: { shield: 300 }, 4: { allStats: 0.3 } } },
        '과학': { name: '과학', desc: '피해 증폭 및 스킬 치명타', levels: { 2: { dmgAmp: 0.1 }, 4: { dmgAmp: 0.25, skillCrit: true, critChance: 0.1 } } },
        '영어': { name: '영어', desc: '마나통 감소', levels: { 2: { manaReduc: 0.15 }, 4: { manaReduc: 0.3 } } },
        '체육': { name: '체육', desc: '[아군 전체] 최대 체력 버프', levels: { 2: { teamHp: 150, selfHpMult: 2 }, 4: { teamHp: 400, selfHpMult: 2 } } },
        '음악': { name: '음악', desc: '체력 회복 및 강화 타격', levels: { 2: { tickHeal: 0.05, bonusMagicDmg: 50 }, 4: { tickHeal: 0.12, bonusMagicDmg: 150 } } },
        '미술': { name: '미술', desc: '초당 마나 재생', levels: { 2: { teamManaRegen: 1, artManaRegen: 2 }, 4: { teamManaRegen: 2, artManaRegen: 3 } } },
        '도덕': { name: '도덕', desc: '[아군 전체] 방어/마저 버프 (도덕 유닛은 2배 적용)', levels: { 2: { teamDef: 10, selfDefMult: 2.0 }, 4: { teamDef: 25, selfDefMult: 2.0 }, 6: { teamDef: 50, selfDefMult: 2.0 } } }
    },
    clubs: {
        '선도부': { name: '선도부', desc: '시작 보호막 및 피해 증폭', levels: { 2: { startShieldPct: 0.15, dmgAmp: 0.1 }, 4: { startShieldPct: 0.25, dmgAmp: 0.2 }, 6: { startShieldPct: 0.4, dmgAmp: 0.35 } } },
        '방송부': { name: '방송부', desc: '거리 비례 피해 증폭', levels: { 3: { distAmp: 0.20 }, 5: { distAmp: 0.40 }, 7: { distAmp: 0.60, rangeBuff: 1 } } },
        '육상부': { name: '육상부', desc: '잃은 체력 비례 공격 속도 증가', levels: { 2: { maxAsBuff: 0.1 }, 4: { maxAsBuff: 0.15 }, 6: { maxAsBuff: 0.3 } } },
        '보건부': { name: '보건부', desc: '피해 감소', levels: { 2: { dmgReduc: 0.25 }, 4: { dmgReduc: 0.45 }, 6: { dmgReduc: 0.55 } } },
        '급식부': { name: '급식부', desc: '보호막 및 스택', levels: { 3: { startShield: 200, stackAdApPct: 0.005 }, 5: { startShield: 400, stackAdApPct: 0.01 }, 7: { startShield: 700, stackAdApPct: 0.02 } } },
        '장난꾸러기': { name: '장난꾸러기', desc: '공격력 강화', levels: { 2: { adBuff: 0.3 }, 4: { adBuff: 0.5 }, 6: { adBuff: 1.0 } } }
    }
};

export const AUGMENTS = {
    silver: [
        { id: 's1', name: '지각 면제권', desc: '다음 3번의 패배에서 플레이어의 체력이 깎이지 않습니다.' },
        { id: 's2', name: '매점 죽돌이', desc: '매 라운드 종료 시 1골드를 고정적으로 추가 획득합니다.' },
        { id: 's3', name: '재시험 기회', desc: '즉시 상점 새로고침을 5회 무료로 이용할 수 있습니다.' },
        { id: 's4', name: '체육복 대여', desc: '모든 아군 유닛의 최대 체력이 영구적으로 +150 증가합니다.' },
        { id: 's5', name: '야자 땡땡이', desc: '즉시 +10의 경험치를 얻습니다.' },
        { id: 's6', name: '교과서 물려받기', desc: '즉시 1~2코스트 무작위 유닛 3마리를 획득합니다.' },
        { id: 's7', name: '쉬는 시간의 여유', desc: '모든 아군 유닛이 초당 2%의 체력을 자동 회복합니다.' },
        { id: 's8', name: '당번의 책임감', desc: '전장에 배치된 아군 유닛이 3명 이하라면, 받는 피해가 15% 감소합니다.' },
        { id: 's9', name: '도덕적 우월감', desc: '아군 전체의 방어력과 마법 저항력이 +15 증가합니다.' },
        { id: 's10', name: '분실물 센터', desc: '전투 승리 시 30% 확률로 무작위 1코스트 유닛 하나를 획득합니다.' },
        { id: 's11', name: '분실물 습득', desc: '즉시 무작위 기본 아이템 2개를 획득합니다.' }
    ],
    gold: [
        { id: 'g1', name: '선행 학습', desc: '상점에 등장하는 유닛 확률이 현재 레벨보다 1레벨 높은 기준으로 적용됩니다.' },
        { id: 'g2', name: '벼락치기', desc: '플레이어 레벨이 7레벨에 도달하는 즉시 40골드를 획득합니다.' },
        { id: 'g3', name: '우등생 특혜', desc: '전투에서 승리할 때마다 1경험치와 1골드를 추가 획득합니다.' },
        { id: 'g4', name: '선도부의 위압감', desc: '적 전체의 최대 체력이 시작부터 15% 깎인 채로 전투에 돌입합니다.' },
        { id: 'g5', name: '보충 수업', desc: '현재 전장에 배치된 1성 유닛 중 하나를 무작위로 2성으로 진화시킵니다.' },
        { id: 'g6', name: '특별 전학생', desc: '즉시 무작위 4코스트 유닛 1마리와 10골드를 획득합니다.' },
        { id: 'g7', name: '전교 1등의 노트', desc: '아군 전체의 공격력과 주문력이 +20, 치명타 확률이 +15% 증가합니다.' },
        { id: 'g8', name: '과학 경진대회', desc: '모든 아군이 20%의 피해 흡혈 효과를 얻습니다.' },
        { id: 'g9', name: '든든한 급식', desc: '전투 시작 시 모든 아군 유닛이 체력 300의 보호막을 얻습니다.' },
        { id: 'g10', name: '수학여행', desc: '이번 3스테이지 전체 진행 동안 상점 새로고침 비용이 1G로 할인됩니다.' },
        { id: 'g11', name: '교장선생님의 지원', desc: '즉시 무작위 완성 아이템 1개를 획득합니다.' }
    ],
    prismatic: [
        { id: 'p1', name: '수능 만점자', desc: '즉시 1 레벨업을 하며, 5코스트 전설 유닛 1마리를 무작위로 획득합니다.' },
        { id: 'p2', name: '조기 졸업', desc: '레벨업에 필요한 모든 경험치 요구량이 30% 영구 감소합니다.' },
        { id: 'p3', name: '학생 주임의 분노', desc: '모든 아군 유닛이 가하는 타격 피해량이 40% 증폭됩니다.' },
        { id: 'p4', name: '무상 급식', desc: '남은 게임 동안 매 턴 상점의 첫 새로고침 3번이 항상 무료가 됩니다.' },
        { id: 'p5', name: '스파르타 교육', desc: '플레이어 체력이 30 이하시, 아군 전체가 피해 감소 30%와 피흡 30%를 영구 획득합니다.' },
        { id: 'p6', name: '부자 재단', desc: '이자 획득 상한선(기본 5G)이 무제한으로 풀립니다.' },
        { id: 'p7', name: '반장 선거 압승', desc: '아군 전체의 공격 속도가 30% 증가하고, 전투 시작 시 50의 마나를 즉시 얻습니다.' },
        { id: 'p8', name: '조기 귀가', desc: '패배 시 깎이는 플레이어 본체의 체력 피해가 절반(50%)으로 영구히 줄어듭니다.' },
        { id: 'p9', name: '전설의 졸업생', desc: '즉시 무작위 5코스트 전설 유닛을 3마리 획득합니다.' },
        { id: 'p10', name: '방송부 스피커 장악', desc: '아군 전체의 기본 사거리가 +1 증가하고 대상과 거리가 멀수록 데미지가 추가 증폭됩니다.' },
        { id: 'p11', name: '학부모회의 기부', desc: '즉시 무작위 완성 아이템 2개와 10골드를 획득합니다.' }
    ]
};

export const UNIT_POOL = [
    // 1-Cost (10 units)
    { id: 'u1_1', name: '칠판닦이 당번', subject: '도덕', club: '선도부', tier: 1, icon: '🧹', manaType: '근성', stats: { hp: 500, mana: 50, maxMana: 100, ad: 40, ap: 100, armor: 30, mr: 30, as: 0.6, range: 1 },
      skill: { name: '일벌백계', desc: '주변 1칸 적에게 피해 + 본인 방어력 증가', type: 'aoe_damage_buff', vfx: 'slam_yellow', aoeRange: 1, adRatio: [1.5, 2.2, 3.5], selfDefBuff: [0.2, 0.35, 0.5], buffDuration: [30, 40, 50] } },
    { id: 'u1_2', name: '달리기 선수', subject: '체육', club: '육상부', tier: 1, icon: '🏃', manaType: '전투', stats: { hp: 400, mana: 0, maxMana: 60, ad: 55, ap: 100, armor: 15, mr: 15, as: 0.8, range: 1 },
      skill: { name: '전력질주', desc: '가장 먼 적에게 돌진하여 물리 피해 + 기절', type: 'dash_damage', vfx: 'dash_blue', hpRatio: [0.1, 0.15, 0.25], stunDuration: [10, 15, 20] } },
    { id: 'u1_3', name: '영단어 암기왕', subject: '영어', club: '장난꾸러기', tier: 1, icon: '🔤', manaType: '전투', stats: { hp: 400, mana: 0, maxMana: 60, ad: 50, ap: 100, armor: 15, mr: 20, as: 0.7, range: 1 },
      skill: { name: '단어 폭격', desc: '랜덤 적 3명에게 물리 피해', type: 'random_aoe', vfx: 'magic_purple', targetCount: 3, adRatio: [1.2, 1.8, 3.0] } },
    { id: 'u1_4', name: '국어부장', subject: '국어', club: '방송부', tier: 1, icon: '📖', manaType: '집중', stats: { hp: 400, mana: 0, maxMana: 80, ad: 30, ap: 100, armor: 15, mr: 25, as: 0.6, range: 3 },
      skill: { name: '집요한 팩트체크', desc: '대상에게 맹렬한 팩트체크를 날려 일정 시간 지속적인 마법 피해(도트딜)를 입힙니다.', type: 'single_dot', vfx: 'debuff_dark', apRatio: [3.0, 4.5, 7.0], dotDuration: [100, 80, 60] } },
    { id: 'u1_5', name: '수학 짝꿍', subject: '수학', club: '급식부', tier: 1, icon: '➕', manaType: '근성', stats: { hp: 550, mana: 0, maxMana: 0, ad: 35, ap: 100, armor: 25, mr: 20, as: 0.6, range: 1 },
      skill: { name: '지수 함수 성장', desc: '패시브: 매 수회 공격마다 자신의 공격력과 공격 속도가 영구적으로 스탯 증가', type: 'passive', vfx: 'buff_green', buffPct: [0.01, 0.02, 0.04], charges: [3, 3, 3] } },
    { id: 'u1_6', name: '지리덕후', subject: '사회', club: '보건부', tier: 1, icon: '🌍', manaType: '근성', manaType: '전투', stats: { hp: 450, mana: 0, maxMana: 90, ad: 30, ap: 100, armor: 20, mr: 30, as: 0.6, range: 2 },
      skill: { name: '지도 분석', desc: '대상에게 물리 피해 + 방어력 관통', type: 'single_damage', vfx: 'debuff_dark', armorRatio: [1.5, 2.5, 4.0], armorPen: [0.3, 0.5, 0.7] } },
    { id: 'u1_7', name: '과학탐구원', subject: '과학', club: '육상부', tier: 1, icon: '🔭', manaType: '전투', stats: { hp: 400, mana: 0, maxMana: 60, ad: 45, ap: 100, armor: 15, mr: 15, as: 0.75, range: 2 },
      skill: { name: '실험 반응', desc: '대상에게 물리 피해 + 피해 흡혈 획득', type: 'single_damage_buff', vfx: 'fire_red', adRatio: [1.8, 2.8, 4.5], vampBuff: [0.1, 0.1, 0.1], buffDuration: [30, 40, 50] } },
    { id: 'u1_8', name: '리코더 요정', subject: '음악', club: '급식부', tier: 1, icon: '🎵', manaType: '집중', stats: { hp: 400, mana: 20, maxMana: 80, ad: 25, ap: 100, armor: 15, mr: 15, as: 0.6, range: 3 },
      skill: { name: '힐링 멜로디', desc: '체력이 가장 낮은 아군 체력 회복', type: 'heal', vfx: 'heal_white', healPct: [0.2, 0.3, 0.45] } },
    { id: 'u1_9', name: '찰흙 조각가', subject: '미술', club: '장난꾸러기', tier: 1, icon: '🗿', manaType: '근성', stats: { hp: 450, mana: 0, maxMana: 70, ad: 40, ap: 100, armor: 25, mr: 20, as: 0.6, range: 1 },
      skill: { name: '점토 방벽', desc: '본인에게 보호막 부여', type: 'self_shield', vfx: 'shield_gray', adRatio: [1.5, 2.5, 4.0] } },
    { id: 'u1_10', name: '복도 지킴이', subject: '도덕', club: '보건부', tier: 1, icon: '🛑', manaType: '근성', stats: { hp: 550, mana: 0, maxMana: 80, ad: 35, ap: 100, armor: 35, mr: 30, as: 0.55, range: 1 },
      skill: { name: '출입금지', desc: '본인 마법저항력 증가 + 주변 적 도발', type: 'taunt', vfx: 'shield_gray', selfMrBuff: [0.3, 0.5, 0.8], tauntDuration: [10, 20, 40] } },

    // 2-Cost (10 units)
    { id: 'u2_1', name: '과학실험부장', subject: '과학', club: '방송부', tier: 2, icon: '🧪', manaType: '집중', stats: { hp: 500, mana: 30, maxMana: 90, ad: 35, ap: 100, armor: 20, mr: 20, as: 0.65, range: 3 },
      skill: { name: '폭발 실험', desc: '대상 주변 1칸에 마법 피해', type: 'aoe_magic', vfx: 'fire_red', aoeRange: 1, apRatio: [2.0, 3.2, 5.0] } },
    { id: 'u2_2', name: '체육부장', subject: '체육', club: '선도부', tier: 2, icon: '⚽', manaType: '근성', stats: { hp: 650, mana: 20, maxMana: 80, ad: 45, ap: 100, armor: 35, mr: 35, as: 0.6, range: 1 },
      skill: { name: '태클 돌진', desc: '대상에게 물리 피해 + 기절', type: 'single_damage_cc', vfx: 'dash_blue', hpRatio: [0.15, 0.25, 0.4], stunDuration: [20, 25, 30] } },
    { id: 'u2_3', name: '문학소녀', subject: '국어', club: '보건부', tier: 2, icon: '📚', manaType: '집중', stats: { hp: 500, mana: 40, maxMana: 100, ad: 30, ap: 100, armor: 20, mr: 30, as: 0.6, range: 3 },
      skill: { name: '영감의 시', desc: '아군 전체 공격 속도 증가 + 적 전체 마저 감소', type: 'team_buff_enemy_debuff', vfx: 'buff_green', buffStat: 'as', buffPct: [0.3, 0.4, 0.6], enemyMrReduc: [10, 20, 35], buffDuration: [50, 60, 80] } },
    { id: 'u2_4', name: '수학천재', subject: '수학', club: '육상부', tier: 2, icon: '📐', manaType: '전투', stats: { hp: 500, mana: 0, maxMana: 60, ad: 55, ap: 100, armor: 20, mr: 20, as: 0.8, range: 1 },
      skill: { name: '피타고라스의 일격', desc: '대상에게 삼각자를 던져 물리 피해를 입히고, 주변의 다른 적에게 최대 수회 튕기며 추가 물리 피해', type: 'bounce_damage', vfx: 'dash_blue', adRatio: [2.0, 2.7, 4.0], charges: [3, 4, 5] } },
    { id: 'u2_5', name: '역사 매니아', subject: '사회', club: '방송부', tier: 2, icon: '📜', manaType: '집중', stats: { hp: 550, mana: 0, maxMana: 80, ad: 40, ap: 100, armor: 30, mr: 20, as: 0.65, range: 2 },
      skill: { name: '고대의 지혜', desc: '대상 최대 체력 비례 고정 피해를 입힙니다.', type: 'true_damage', vfx: 'debuff_dark', trueDmgPct: [0.12, 0.18, 0.25], apRatio: [0.02, 0.02, 0.02] } },
    { id: 'u2_6', name: '팝송 매니아', subject: '영어', club: '보건부', tier: 2, icon: '🎧', manaType: '집중', stats: { hp: 450, mana: 20, maxMana: 70, ad: 45, ap: 100, armor: 15, mr: 25, as: 0.7, range: 3 },
      skill: { name: '리듬 디스', desc: '무작위 적 3명에게 마법 피해 + 마나 획득 감소', type: 'random_aoe_debuff', vfx: 'magic_purple', targetCount: 3, apRatio: [1.2, 1.8, 3.0], manaReducPct: [0.5, 0.5, 0.75], debuffDuration: [20, 30, 40] } },
    { id: 'u2_7', name: '급식 당번', subject: '미술', club: '급식부', tier: 2, icon: '🍱', manaType: '집중', stats: { hp: 700, mana: 0, maxMana: 100, ad: 40, ap: 100, armor: 30, mr: 30, as: 0.55, range: 1 },
      skill: { name: '영양 만점 급식', desc: '아군 전체 회복', type: 'team_heal', vfx: 'heal_white', hpRatio: [0.08, 0.12, 0.2] } },
    { id: 'u2_8', name: '골목대장', subject: '체육', club: '장난꾸러기', tier: 2, icon: '🧢', manaType: '근성', stats: { hp: 600, mana: 0, maxMana: 60, ad: 50, ap: 100, armor: 25, mr: 20, as: 0.75, range: 1 },
      skill: { name: '주먹이 운다', desc: '대상에게 강력한 물리 피해 + 주변 1칸 스플래시 피해 + 본인 공격력 영구 증가', type: 'single_damage_stack', vfx: 'slam_yellow', adRatio: [3.0, 4.5, 7.0], hpRatioSplash: [0.05, 0.08, 0.15], splashRange: 1, permAdBuff: [0.15, 0.25, 0.4] } },
    { id: 'u2_9', name: '합창단 에이스', subject: '음악', club: '방송부', tier: 2, icon: '🎤', manaType: '집중', stats: { hp: 450, mana: 30, maxMana: 90, ad: 35, ap: 100, armor: 15, mr: 20, as: 0.7, range: 3 },
      skill: { name: '하모니', desc: '가까운 아군 2명에게 보호막 부여', type: 'ally_shield', vfx: 'shield_gray', targetCount: 2, apRatio: [2.0, 3.0, 5.0] } },
    { id: 'u2_10', name: '바른생활 사나이', subject: '도덕', club: '선도부', tier: 2, icon: '🙋‍♂️', manaType: '근성', stats: { hp: 650, mana: 0, maxMana: 70, ad: 45, ap: 100, armor: 35, mr: 30, as: 0.6, range: 1 },
      skill: { name: '규칙 엄수', desc: '주변 적 전체 공격력 감소', type: 'aoe_debuff', vfx: 'debuff_dark', aoeRange: 1, armorRatio: [0.4, 0.6, 1.0], debuffDuration: [50, 60, 80] } },

    // 3-Cost (9 units)
    { id: 'u3_1', name: '올림피아드 금상', subject: '수학', club: '선도부', tier: 3, icon: '🏆', manaType: '전투', stats: { hp: 800, mana: 0, maxMana: 60, ad: 50, ap: 100, armor: 40, mr: 40, as: 0.65, range: 1 },
      skill: { name: '완벽한 풀이', desc: '대상에게 방어력을 관통하는 단일 물리 피해', type: 'single_damage', vfx: 'slam_yellow', adRatio: [5.0, 7.0, 10.0], armorPen: [0.55, 0.715, 0.88] } },
    { id: 'u3_2', name: '양호실 도우미', subject: '도덕', club: '보건부', tier: 3, icon: '💊', manaType: '근성', stats: { hp: 750, mana: 40, maxMana: 120, ad: 40, ap: 100, armor: 35, mr: 35, as: 0.65, range: 2 },
      skill: { name: '응급 처치', desc: '체력 비율이 가장 낮은 아군 회복 + 보호막', type: 'heal_shield', vfx: 'heal_white', mrRatio: [1.65, 2.75, 4.4] } },
    { id: 'u3_3', name: '육상부 에이스', subject: '체육', club: '육상부', tier: 3, icon: '🥇', manaType: '전투', stats: { hp: 630, mana: 0, maxMana: 50, ad: 60, ap: 100, armor: 20, mr: 20, as: 0.85, range: 1 },
      skill: { name: '미친 스퍼트', desc: '공격 속도 대폭 증가', type: 'self_buff', vfx: 'buff_green', buffType: 'attackSpeed', asBuff: [0.5, 0.8, 1.5], buffDuration: [20, 30, 50] } },
    { id: 'u3_4', name: '발명품 매니아', subject: '과학', club: '장난꾸러기', tier: 3, icon: '💡', manaType: '전투', stats: { hp: 650, mana: 0, maxMana: 80, ad: 60, ap: 100, armor: 20, mr: 30, as: 0.75, range: 2 },
      skill: { name: '폭탄 투척', desc: '가장 밀집된 적 주변 광역 마법 피해', type: 'aoe_magic_cluster', vfx: 'fire_red', aoeRange: 1, adRatio: [2.75, 3.85, 6.05] } },
    { id: 'u3_5', name: '사회탐구 1타', subject: '사회', club: '방송부', tier: 3, icon: '🗺️', manaType: '집중', stats: { hp: 600, mana: 40, maxMana: 100, ad: 45, ap: 100, armor: 25, mr: 40, as: 0.7, range: 4 },
      skill: { name: '세계화 전략', desc: '가장 먼 적에게 마법 피해', type: 'farthest_magic', vfx: 'magic_purple', apRatio: [3.5, 5.0, 8.0] } },
    { id: 'u3_6', name: '시조 읊는 선비', subject: '국어', club: '급식부', tier: 3, icon: '🍵', manaType: '근성', stats: { hp: 700, mana: 0, maxMana: 90, ad: 50, ap: 100, armor: 30, mr: 45, as: 0.65, range: 2 },
      skill: { name: '연쇄 시조창', desc: '대상에게 튕기는 읊조림을 던져 마법 피해와 치유 감소(50%) 부여', type: 'bounce_magic', vfx: 'magic_purple', apRatio: [1.5, 2.2, 3.5], charges: [4, 5, 7], antiHealDuration: [50, 50, 50], bounceRatio: 1.0 } },
    { id: 'u3_7', name: '영어 프리토커', subject: '영어', club: '방송부', tier: 3, icon: '🗣️', manaType: '집중', stats: { hp: 600, mana: 20, maxMana: 80, ad: 55, ap: 100, armor: 20, mr: 25, as: 0.75, range: 3 },
      skill: { name: '토론 압살', desc: '대상 마나 소멸 + 마법 피해', type: 'mana_burn', vfx: 'debuff_dark', manaBurnPct: [0.3, 0.5, 0.8], apRatio: [3.3, 4.8, 7.5] } },
    { id: 'u3_8', name: '오케스트라 단장', subject: '음악', club: '급식부', tier: 3, icon: '🎼', manaType: '집중', stats: { hp: 650, mana: 50, maxMana: 120, ad: 40, ap: 100, armor: 25, mr: 30, as: 0.65, range: 3 },
      skill: { name: '교향곡', desc: '아군 전체 힐 + 공속 증가', type: 'team_heal_buff', vfx: 'heal_white', healPct: [0.15, 0.20, 0.30], asBuff: [0.20, 0.30, 0.45], buffDuration: [30, 40, 50] } },
    { id: 'u3_9', name: '수채화 장인', subject: '미술', club: '선도부', tier: 3, icon: '🎨', manaType: '집중', stats: { hp: 750, mana: 30, maxMana: 100, ad: 45, ap: 100, armor: 40, mr: 30, as: 0.6, range: 2 },
      skill: { name: '색의 마법', desc: '랜덤 적에게 마법 피해 + 마나 봉인', type: 'random_aoe_debuff', vfx: 'magic_purple', targetCount: 4, apRatio: [1.5, 2.5, 4.0], manaReducPct: [1.0, 1.0, 1.0], debuffDuration: [30, 40, 50] } },

    // 4-Cost (7 units)
    { id: 'u4_1', name: '전교 체육부장', subject: '체육', club: '선도부', tier: 4, icon: '🦍', manaType: '근성', stats: { hp: 1150, mana: 0, maxMana: 100, ad: 80, ap: 100, armor: 65, mr: 65, as: 0.7, range: 1 },
      skill: { name: '전력 태클', desc: '주변 넓은 범위 적에게 피해 + 기절 + 본인에게 보호막 부여', type: 'aoe_damage_cc_shield', vfx: 'slam_yellow', aoeRange: 2, hpRatioDmg: [0.10, 0.20, 0.35], stunDuration: [20, 30, 40], hpRatioShield: [0.15, 0.25, 0.45] } },
    { id: 'u4_2', name: '수능 만점자', subject: '수학', club: '방송부', tier: 4, icon: '💯', manaType: '전투', stats: { hp: 950, mana: 50, maxMana: 90, ad: 90, ap: 100, armor: 40, mr: 40, as: 0.9, range: 3 },
      skill: { name: '정밀 분석', desc: '일정 시간 방어력 무시, 치명타 100% 및 공격 속도 증가', type: 'self_buff', vfx: 'buff_green', buffType: 'precision', asBuff: [0.5, 0.8, 1.5], buffDuration: [50, 70, 100] } },
    { id: 'u4_3', name: '미친 과학자', subject: '과학', club: '장난꾸러기', tier: 4, icon: '🌋', manaType: '전투', stats: { hp: 950, mana: 40, maxMana: 110, ad: 80, ap: 100, armor: 45, mr: 45, as: 0.85, range: 2 },
      skill: { name: '연쇄 폭발', desc: '적 전체에 광역 마법 피해', type: 'global_magic', vfx: 'fire_red', adRatio: [2.5, 4.0, 6.5] } },
    { id: 'u4_4', name: '논술의 신', subject: '국어', club: '육상부', tier: 4, icon: '✍️', manaType: '전투', stats: { hp: 900, mana: 0, maxMana: 80, ad: 90, ap: 100, armor: 40, mr: 30, as: 0.8, range: 1 },
      skill: { name: '필살의 논리', desc: '단일 대상 강력한 마법 피해', type: 'single_damage', vfx: 'slam_yellow', apRatio: [8.0, 12.0, 20.0] } },
    { id: 'u4_5', name: '전교 학생회장', subject: '사회', club: '급식부', tier: 4, icon: '👑', manaType: '근성', stats: { hp: 1100, mana: 0, maxMana: 130, ad: 60, ap: 100, armor: 45, mr: 45, as: 0.65, range: 1 },
      skill: { name: '전교생 집합', desc: '아군 전체 공격력 및 주문력 증가 + 피해 감소 및 보호막', type: 'team_buff_shield', vfx: 'buff_green', statBuffPct: [0.25, 0.35, 0.5], shieldFlat: [300, 500, 800], dmgReducPct: [0.1, 0.15, 0.25], buffDuration: [80, 80, 80] } },
    { id: 'u4_6', name: '나이팅게일', subject: '도덕', club: '보건부', tier: 4, icon: '🕊️', manaType: '집중', stats: { hp: 1050, mana: 60, maxMana: 140, ad: 55, ap: 100, armor: 50, mr: 65, as: 0.7, range: 3 },
      skill: { name: '천사의 손길', desc: '아군 전체 회복 + 가장 많이 다친 아군 추가 회복', type: 'team_heal_plus', vfx: 'heal_white', defMrRatio: [1.5, 2.0, 3.0], extraHealPct: [0.2, 0.3, 0.5] } },
    { id: 'u4_7', name: '천재 피아니스트', subject: '음악', club: '방송부', tier: 4, icon: '🎹', manaType: '집중', stats: { hp: 900, mana: 40, maxMana: 100, ad: 85, ap: 100, armor: 35, mr: 40, as: 0.85, range: 3 },
      skill: { name: '즉흥 연주', desc: '적 전체 마법 피해 + 아군 전체 마나 회복', type: 'global_magic_mana', vfx: 'magic_purple', apRatio: [2.0, 3.2, 5.0], teamMana: [30, 50, 80] } },

    // 5-Cost (4 units)
    { id: 'u5_1', name: '외고 전학생', subject: '영어', club: '육상부', tier: 5, icon: '✈️', manaType: '전투', stats: { hp: 1080, mana: 0, maxMana: 100, ad: 90, ap: 100, armor: 35, mr: 35, as: 0.85, range: 2 },
      skill: { name: '글로벌 스트라이크', desc: '공격 속도 증가 + 사거리 증가 + 추가 고정 피해', type: 'self_buff_hyper', vfx: 'buff_green', asBuff: [0.8, 1.2, 2.0], rangeBuff: [2, 3, 4], bonusTrueDmg: [50, 100, 200], asRatio: [50, 100, 200], buffDuration: [30, 30, 30] } },
    { id: 'u5_2', name: '수석 연구원', subject: '과학', club: '급식부', tier: 5, icon: '👽', manaType: '집중', stats: { hp: 1100, mana: 50, maxMana: 150, ad: 90, ap: 100, armor: 40, mr: 40, as: 0.9, range: 3 },
      skill: { name: '차원 분열', desc: '적 전체 광역 마법 피해 + 방/마저 감소', type: 'global_magic_debuff', vfx: 'fire_red', apRatio: [3.0, 4.5, 8.0], defReducPct: [0.3, 0.4, 0.5], debuffDuration: [50, 70, 100] } },
    { id: 'u5_3', name: '피카소의 재림', subject: '미술', club: '장난꾸러기', tier: 5, icon: '🧑‍🎨', manaType: '전투', stats: { hp: 1050, mana: 40, maxMana: 120, ad: 100, ap: 100, armor: 35, mr: 35, as: 0.95, range: 3 },
      skill: { name: '명작 탄생', desc: '적 전체 마법 피해 + 아군 전체 전투 중 스탯 증가 버프', type: 'global_magic_team_buff', vfx: 'magic_purple', adRatio: [2.0, 3.5, 6.0], teamStatBuff: [0.1, 0.2, 0.3] } },
    { id: 'u5_4', name: '교장 선생님', subject: '도덕', club: '선도부', tier: 5, icon: '👨‍🏫', manaType: '근성', stats: { hp: 1500, mana: 80, maxMana: 200, ad: 80, ap: 100, armor: 70, mr: 70, as: 0.7, range: 1 },
      skill: { name: '훈시', desc: '적 전체 기절 및 디버프 + 본인 방어력과 마저에 비례한 마법 피해', type: 'global_cc_dmg_debuff', vfx: 'stun_star', stunDuration: [30, 40, 50], statReducPct: [0.3, 0.4, 0.5], debuffDuration: [60, 60, 60], defMrRatio: [1.5, 2.5, 5.0] } }
];
