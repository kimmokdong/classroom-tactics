export const STAT_NAMES_KO = {
    teamAp: "팀 전체 주문력",
    selfAp: "추가 주문력",
    critChance: "치명타 확률",
    critDmg: "치명타 피해량",
    dmgAmp: "피해량 증폭",
    shield: "보호막",
    allStats: "체력·공격력·주문력·방어력·마법저항력 전체 강화",
    skillDmgAmp: "스킬 피해량 증폭",
    skillCrit: "스킬 치명타",
    manaReduc: "최대 마나 감소",
    teamHp: "팀 전체 최대 체력",
    selfHpMult: "본인 체력 배율",
    tickHeal: "주기적 체력 회복",
    bonusMagicDmg: "추가 마법피해 장전",
    bonusMana: "피격/타격 시 추가 마나",
    teamDef: "팀 방어력/마법저항력",
    selfDefMult: "본인 방어력 배율",
    startShieldPct: "체력 비례 보호막",
    distAmp: "거리 비례 피해 증폭",
    rangeBuff: "사거리 증가",
    maxAsBuff: "잃은 체력 비례 공속",
    dmgReduc: "피해 감소",
    startShield: "시작 보호막",
    stackAdAp: "타격당 공격력/주문력 스택",
    stackAdApPct: "타격당 공격력/주문력 증가",
    vampBuff: "피해 흡혈",
    teamManaRegen: "아군 전체 초당 마나 재생",
    artManaRegen: "음악 유닛 추가 마나 재생",
    adBuff: "기본 공격력",
    splashAdRatio: "광역 피해량 비율"
};

export function formatStat(k, v) {
    const name = STAT_NAMES_KO[k] || k;
    let valStr = v;

    // 이 키들은 무조건 절대 수치로 표기
    const flatStats = ['rangeBuff', 'teamManaRegen', 'artManaRegen', 'startShield', 'stackAdAp', 'bonusMagicDmg'];

    if (typeof v === 'number') {
        if (v > 0 && v < 5 && !flatStats.includes(k)) {
            valStr = `+${Math.round(v * 100)}%`;
        } else {
            valStr = `+${v}`;
        }
    }
    if (v === true) valStr = "적용됨";
    return `${name} ${valStr}`;
}

export const SHOP_PROBABILITIES = {
    1: [100, 0, 0, 0, 0],
    2: [100, 0, 0, 0, 0],
    3: [75, 25, 0, 0, 0],
    4: [55, 30, 15, 0, 0],
    5: [45, 33, 20, 2, 0],
    6: [25, 40, 30, 5, 0],
    7: [19, 30, 35, 15, 1],
    8: [15, 20, 35, 25, 5],
    9: [10, 15, 30, 30, 15]
};
