/**
 * 교실 택틱스 전용 아이템 데이터베이스
 * TFT 기반 8종 기본 아이템 및 36종 완성 아이템
 */

const itemsData = [
    // ==========================================
    // 1. 기본 아이템 (Base Components)
    // ==========================================
    {
        id: "base_ad", name: "날카로운 삼각자", type: "base",
        stats: { ad: 10 }, 
        desc: "공격력이 10 증가합니다."
    },
    {
        id: "base_as", name: "삼선 슬리퍼", type: "base",
        stats: { as: 0.10 }, 
        desc: "공격 속도가 10% 증가합니다."
    },
    {
        id: "base_ap", name: "레이저 포인터", type: "base",
        stats: { ap: 10 }, 
        desc: "주문력이 10 증가합니다."
    },
    {
        id: "base_mana", name: "핫식스", type: "base",
        stats: { mana: 15 }, 
        desc: "시작 마나가 15 증가합니다."
    },
    {
        id: "base_armor", name: "과잠바", type: "base",
        stats: { armor: 20 }, 
        desc: "방어력이 20 증가합니다."
    },
    {
        id: "base_mr", name: "노이즈캔슬링 이어폰", type: "base",
        stats: { mr: 20 }, 
        desc: "마법 저항력이 20 증가합니다."
    },
    {
        id: "base_hp", name: "어머니의 도시락", type: "base",
        stats: { maxHp: 150 }, 
        desc: "최대 체력이 150 증가합니다."
    },
    {
        id: "base_crit", name: "두꺼운 뿔테안경", type: "base",
        stats: { critChance: 0.20 }, 
        desc: "치명타 확률이 20% 증가합니다."
    },

    // ==========================================
    // 2. 완성 아이템 (Combined Items) - AD 베이스
    // ==========================================
    {
        id: "comb_ad_ad", name: "전교 1등의 샤프", type: "combined", recipe: ["base_ad", "base_ad"],
        stats: { ad: 70 }, effect: "deathblade",
        desc: "순수 물리 공격력이 극대화된 무기입니다."
    },
    {
        id: "comb_ad_as", name: "체력장 만점 기록부", type: "combined", recipe: ["base_ad", "base_as"],
        stats: { ad: 10, as: 0.10 }, effect: "giantSlayer",
        desc: "기본 공격 및 스킬 피해량이 10% 증가합니다. 대상 최대 체력이 1,500을 초과하면 25%로 증가합니다."
    },
    {
        id: "comb_ad_ap", name: "마법의 컨닝페이퍼", type: "combined", recipe: ["base_ad", "base_ap"],
        stats: { ad: 10, ap: 10 }, effect: "gunbladeHeal",
        desc: "피해 흡혈이 22% 증가합니다. 입힌 피해량만큼 체력 비율이 가장 낮은 아군을 회복시킵니다."
    },
    {
        id: "comb_ad_mana", name: "삼색 볼펜", type: "combined", recipe: ["base_ad", "base_mana"],
        stats: { ad: 10, mana: 15 }, effect: "shojin",
        desc: "기본 공격 시 마나를 추가로 5 회복합니다."
    },
    {
        id: "comb_ad_armor", name: "체육부장의 호각", type: "combined", recipe: ["base_ad", "base_armor"],
        stats: { ad: 10, armor: 20 }, effect: "edgeOfNight",
        desc: "체력이 60% 이하로 떨어지면 잠시 타겟팅 불가(무적) 상태가 되며 공격 속도가 15% 증가합니다."
    },
    {
        id: "comb_ad_mr", name: "매점 VIP 쿠폰", type: "combined", recipe: ["base_ad", "base_mr"],
        stats: { ad: 10, mr: 20 }, effect: "bloodthirsterShield",
        desc: "피해 흡혈이 20% 증가합니다. 체력이 40% 이하가 되면 5초간 최대 체력 25%의 보호막을 얻습니다."
    },
    {
        id: "comb_ad_hp", name: "무거운 전공서적", type: "combined", recipe: ["base_ad", "base_hp"],
        stats: { ad: 10, maxHp: 150 }, effect: "steraks",
        desc: "체력이 60% 이하가 되면 최대 체력의 25%와 공격력 35를 전투 끝까지 얻습니다."
    },
    {
        id: "comb_ad_crit", name: "제도용 컴퍼스", type: "combined", recipe: ["base_ad", "base_crit"],
        stats: { ad: 10, critChance: 0.10 }, effect: "skillCrit",
        desc: "모든 스킬에 치명타가 적용됩니다. 치명타 피해량이 10% 증가합니다."
    },

    // ==========================================
    // 3. 완성 아이템 - AS 베이스
    // ==========================================
    {
        id: "comb_as_as", name: "로켓 실내화", type: "combined", recipe: ["base_as", "base_as"],
        stats: { as: 0.20 }, effect: "rfc",
        desc: "기본 공격 사거리가 1칸 증가하며 공격 속도가 40% 증가합니다."
    },
    {
        id: "comb_as_ap", name: "야간자율학습용 스탠드", type: "combined", recipe: ["base_as", "base_ap"],
        stats: { as: 0.10, ap: 10 }, effect: "guinsoo",
        desc: "기본 공격 시 공격 속도가 4%, 주문력이 2씩 전투 종료 시까지 무한히 증가합니다."
    },
    {
        id: "comb_as_mana", name: "정전기 책받침", type: "combined", recipe: ["base_as", "base_mana"],
        stats: { as: 0.10, mana: 15 }, effect: "statikk",
        desc: "매 3번째 공격마다 다수의 적에게 100의 마법 피해를 입히고 마법 저항력을 30% 감소시킵니다."
    },
    {
        id: "comb_as_armor", name: "선도부 완장", type: "combined", recipe: ["base_as", "base_armor"],
        stats: { as: 0.10, armor: 20 }, effect: "titans",
        desc: "공격하거나 피해를 입을 때마다 공격력 2, 주문력이 2% 증가합니다. (최대 25중첩). 최대 중첩 시 방어력과 마법 저항력이 20 증가합니다."
    },
    {
        id: "comb_as_mr", name: "분필 지우개 털이개", type: "combined", recipe: ["base_as", "base_mr"],
        stats: { as: 0.10, mr: 20 }, effect: "runaans",
        desc: "기본 공격 시 주변 적 하나에게 추가로 분필을 날려 공격력의 50% 피해를 입힙니다."
    },
    {
        id: "comb_as_hp", name: "급식실 프리패스권", type: "combined", recipe: ["base_as", "base_hp"],
        stats: { as: 0.10, maxHp: 150 }, effect: "zzrot",
        desc: "사망 시 체력 1000의 학교 지킴이 강아지를 소환하여 주변 적들을 도발합니다."
    },
    {
        id: "comb_as_crit", name: "수학의 정석", type: "combined", recipe: ["base_as", "base_crit"],
        stats: { as: 0.10, critChance: 0.10 }, effect: "lastWhisper",
        desc: "물리 피해를 입히면 3초 동안 대상의 방어력을 30% 감소시킵니다."
    },

    // ==========================================
    // 4. 완성 아이템 - AP 베이스
    // ==========================================
    {
        id: "comb_ap_ap", name: "교장선생님의 마이크", type: "combined", recipe: ["base_ap", "base_ap"],
        stats: { ap: 20 }, effect: "rabadon",
        desc: "주문력이 50 증가하며, 최종 주문력이 추가로 20% 증폭됩니다."
    },
    {
        id: "comb_ap_mana", name: "두꺼운 백과사전", type: "combined", recipe: ["base_ap", "base_mana"],
        stats: { ap: 10, mana: 15 }, effect: "archangel",
        desc: "전투 중에 5초마다 주문력이 25씩 증가합니다."
    },
    {
        id: "comb_ap_armor", name: "양호실 구급상자", type: "combined", recipe: ["base_ap", "base_armor"],
        stats: { ap: 10, armor: 20 }, effect: "locket",
        desc: "전투 시작 시 자신과 좌우 2칸 이내의 아군에게 250의 보호막을 8초 동안 씌워줍니다."
    },
    {
        id: "comb_ap_mr", name: "겨울용 수면양말", type: "combined", recipe: ["base_ap", "base_mr"],
        stats: { ap: 10, mr: 20 }, effect: "ionic",
        desc: "주변 1칸 내 적들의 마법 저항력을 30% 깎습니다. 적이 스킬을 쓰면 최대 마나 비례 마법 피해를 입힙니다."
    },
    {
        id: "comb_ap_hp", name: "불타는 학구열", type: "combined", recipe: ["base_ap", "base_hp"],
        stats: { ap: 10, maxHp: 150 }, effect: "morello",
        desc: "스킬 피해를 입히면 10초 동안 적 최대 체력의 10%만큼 화염 피해를 입히고 치유량을 50% 감소시킵니다."
    },
    {
        id: "comb_ap_crit", name: "보석 박힌 샤프심", type: "combined", recipe: ["base_ap", "base_crit"],
        stats: { ap: 10, critChance: 0.10 }, effect: "skillCrit",
        desc: "모든 마법 및 고정 피해 스킬에 치명타가 적용됩니다."
    },

    // ==========================================
    // 5. 완성 아이템 - Mana 베이스
    // ==========================================
    {
        id: "comb_mana_mana", name: "밤샘용 핫식스 박스", type: "combined", recipe: ["base_mana", "base_mana"],
        stats: { mana: 30, maxMana: -10 }, effect: "blueBuff",
        desc: "스킬 사용 시 즉시 10의 마나를 회복합니다."
    },
    {
        id: "comb_mana_armor", name: "반성문", type: "combined", recipe: ["base_mana", "base_armor"],
        stats: { mana: 15, armor: 20 }, effect: "protectorsVow",
        desc: "체력이 50% 이하가 되면 3칸 내 아군에게 최대 체력 25%의 보호막을 주고 방마저를 20 증가시킵니다."
    },
    {
        id: "comb_mana_mr", name: "따뜻한 보온병", type: "combined", recipe: ["base_mana", "base_mr"],
        stats: { mana: 15, mr: 20 }, effect: "chalice",
        desc: "전투 시작 시 자신과 좌우 1칸 아군들의 주문력을 25 증가시킵니다."
    },
    {
        id: "comb_mana_hp", name: "어머니의 편지", type: "combined", recipe: ["base_mana", "base_hp"],
        stats: { mana: 15, maxHp: 150 }, effect: "redemption",
        desc: "5초마다 1칸 내 아군 잃은 체력 10%를 회복시키고 받는 광역 피해를 3초간 25% 줄여줍니다."
    },
    {
        id: "comb_mana_crit", name: "찍기용 주사위", type: "combined", recipe: ["base_mana", "base_crit"],
        stats: { mana: 15, critChance: 0.10 }, effect: "hoj",
        desc: "피해량 15% 증가 및 피해 흡혈 15%를 얻습니다. 매 라운드마다 둘 중 하나의 효과가 두 배로 증폭됩니다."
    },

    // ==========================================
    // 6. 완성 아이템 - Armor 베이스
    // ==========================================
    {
        id: "comb_armor_armor", name: "철벽의 책가방", type: "combined", recipe: ["base_armor", "base_armor"],
        stats: { armor: 40 }, effect: "bramble",
        desc: "치명타 추가 피해를 무시합니다. 기본 공격을 받으면 가시를 방출하여 마법 반사 피해를 입힙니다."
    },
    {
        id: "comb_armor_mr", name: "외톨이의 후드티", type: "combined", recipe: ["base_armor", "base_mr"],
        stats: { armor: 20, mr: 20 }, effect: "gargoyle",
        desc: "자신을 타겟팅하고 있는 적 1명당 방어력과 마법 저항력이 15씩 증가합니다."
    },
    {
        id: "comb_armor_hp", name: "뜨거운 핫팩", type: "combined", recipe: ["base_armor", "base_hp"],
        stats: { armor: 20, maxHp: 150 }, effect: "sunfire",
        desc: "2초마다 2칸 내의 적 1명을 불태워 10초 동안 최대 체력의 10%만큼 피해를 입히고 치유량을 반토막 냅니다."
    },
    {
        id: "comb_armor_crit", name: "압수된 핸드폰", type: "combined", recipe: ["base_armor", "base_crit"],
        stats: { armor: 20, critChance: 0.10 }, effect: "shroud",
        desc: "전투 시작 시 일직선으로 광선을 쏴 맞은 적들의 첫 스킬 마나 요구량을 30% 증가시킵니다."
    },

    // ==========================================
    // 7. 완성 아이템 - MR 베이스
    // ==========================================
    {
        id: "comb_mr_mr", name: "소음방지 귀마개", type: "combined", recipe: ["base_mr", "base_mr"],
        stats: { mr: 40 }, effect: "dclaw",
        desc: "마법 저항력이 크게 증가합니다. 매 2초마다 최대 체력의 5%를 회복합니다."
    },
    {
        id: "comb_mr_hp", name: "비밀 쪽지", type: "combined", recipe: ["base_mr", "base_hp"],
        stats: { mr: 20, maxHp: 150 }, effect: "zephyr",
        desc: "전투 시작 시 대칭되는 위치에 있는 적 하나를 5초 동안 회오리바람으로 띄워 타겟팅 불가 상태로 만듭니다."
    },
    {
        id: "comb_mr_crit", name: "전교회장 배지", type: "combined", recipe: ["base_mr", "base_crit"],
        stats: { mr: 20, critChance: 0.10 }, effect: "qss",
        desc: "전투 시작 후 15초 동안 모든 군중 제어기(CC)에 면역이 됩니다."
    },

    // ==========================================
    // 8. 완성 아이템 - HP & Crit 베이스
    // ==========================================
    {
        id: "comb_hp_hp", name: "초대형 텀블러", type: "combined", recipe: ["base_hp", "base_hp"],
        stats: { maxHp: 800 }, effect: "warmog",
        desc: "순수 체력이 극대화된 방어구입니다."
    },
    {
        id: "comb_hp_crit", name: "일진의 너클", type: "combined", recipe: ["base_hp", "base_crit"],
        stats: { maxHp: 150, critChance: 0.10 }, effect: "guardbreaker",
        desc: "피해량이 15% 증가합니다. 보호막을 가진 적을 공격하면 피해량이 추가로 25% 증가합니다."
    },
    {
        id: "comb_crit_crit", name: "분실물 보관함", type: "combined", recipe: ["base_crit", "base_crit"],
        stats: { critChance: 0.40 }, effect: "thievesGloves",
        desc: "매 라운드마다 무작위 완성 아이템 2개를 임시로 장착합니다. (다른 아이템 장착 불가)"
    }
];

export const ITEMS = itemsData;
