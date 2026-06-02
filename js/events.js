export const EVENTS = [
    // 1~10: 이로운 이벤트 (팀 스탯 증가, 골드 획득 등)
    {
        id: "ev_1", type: "single", name: "선생님의 칭찬", desc: "분위기가 좋아져 이번 라운드 전투에서 아군의 공격 속도가 15% 증가합니다.",
        icon: "👏", actionName: "공속 버프 발동!", actionDesc: "전투 시작 시 공속 버프가 부여됩니다."
    },
    {
        id: "ev_2", type: "single", name: "매점 할인권 당첨", desc: "기분이 좋아진 학생들이 더 열심히 싸웁니다. 공격력이 10 증가합니다.",
        icon: "🎫", actionName: "공격력 버프 발동!", actionDesc: "전투 시작 시 공격력 버프가 부여됩니다."
    },
    {
        id: "ev_3", type: "single", name: "수업 일찍 끝남", desc: "학생들의 집중력이 최고조에 달합니다. 주문력이 15 증가합니다.",
        icon: "⏰", actionName: "주문력 버프 발동!", actionDesc: "전투 시작 시 주문력 버프가 부여됩니다."
    },
    {
        id: "ev_4", type: "single", name: "분실물 골드 발견", desc: "누군가 흘린 돈을 주웠습니다. 5골드를 즉시 획득합니다.",
        icon: "💰", actionName: "5 골드 획득!", actionDesc: "지갑이 두둑해졌습니다."
    },
    {
        id: "ev_5", type: "single", name: "야자 취소", desc: "모두의 기력이 회복됩니다. 모든 아군의 방어력과 마법 저항력이 15 증가합니다.",
        icon: "🏃‍♂️", actionName: "방마저 버프 발동!", actionDesc: "전투 시작 시 방어력/마저 버프가 부여됩니다."
    },
    {
        id: "ev_6", type: "single", name: "교장 선생님 훈화", desc: "오랜 시간 서있어서 단련되었습니다. 모든 아군의 최대 체력이 15% 증가합니다.",
        icon: "🎤", actionName: "체력 버프 발동!", actionDesc: "전투 시작 시 최대 체력이 15% 증가합니다."
    },
    {
        id: "ev_7", type: "single", name: "스승의 날 행사", desc: "사기가 증진되어 전투 시작 시 아군의 마나가 15 회복됩니다.",
        icon: "🌹", actionName: "시작 마나 버프 발동!", actionDesc: "전투 시작 시 마나가 +15 된 상태로 시작합니다."
    },
    {
        id: "ev_8", type: "single", name: "기본 지급품", desc: "학교에서 무작위 기본 아이템을 1개 지급합니다.",
        icon: "🎒", actionName: "아이템 획득!", actionDesc: "인벤토리를 확인하세요."
    },
    {
        id: "ev_9", type: "single", name: "특별 간식 배급", desc: "이번 전투 동안 모든 아군의 받는 피해량이 10% 감소합니다.",
        icon: "🌭", actionName: "피해 감소 버프 발동!", actionDesc: "전투에서 더욱 튼튼해집니다."
    },
    {
        id: "ev_10", type: "choice", name: "교실 바닥에 떨어진 돈", desc: "바닥에 10골드가 떨어져 있습니다.",
        icon: "💵", 
        choices: [
            { id: "ev_10_a", name: "교무실에 갖다준다", desc: "선생님의 신뢰를 얻습니다. 무작위 기본 아이템 1개를 받습니다.", icon: "👼" },
            { id: "ev_10_b", name: "슬쩍 챙긴다", desc: "10골드를 획득하지만, 죄책감으로 이번 전투 공격력이 10 감소합니다.", icon: "😈" }
        ]
    },

    // 11~20: 중립/선택형 이벤트 (리스크 & 리턴)
    {
        id: "ev_11", type: "choice", name: "급작스런 수행평가", desc: "선생님이 갑자기 수행평가를 실시합니다.",
        icon: "📝", 
        choices: [
            { id: "ev_11_a", name: "열심히 푼다", desc: "이번 전투 최대 체력이 20% 증가하지만 공격 속도가 10% 감소합니다.", icon: "✍️" },
            { id: "ev_11_b", name: "대충 찍는다", desc: "이번 전투 공격 속도가 20% 증가하지만 최대 체력이 10% 감소합니다.", icon: "🎲" }
        ]
    },
    {
        id: "ev_12", type: "choice", name: "수상한 자판기", desc: "기능고장 난 매점 자판기가 흔들립니다.",
        icon: "🧃", 
        choices: [
            { id: "ev_12_a", name: "발로 찬다", desc: "50% 확률로 무작위 완성 아이템을 획득하거나, 실패 시 5 데미지를 입습니다.", icon: "🦵" },
            { id: "ev_12_b", name: "조용히 지나간다", desc: "아무 일도 일어나지 않습니다.", icon: "🚶" }
        ]
    },
    {
        id: "ev_13", type: "choice", name: "복도 달리기 단속", desc: "복도를 뛰어가다 선도부와 마주쳤습니다.",
        icon: "🛑", 
        choices: [
            { id: "ev_13_a", name: "도망친다", desc: "성공적으로 도망쳐 이번 전투 공속이 10% 오르거나, 걸려서 5 데미지를 입습니다.", icon: "🏃" },
            { id: "ev_13_b", name: "순순히 잡힌다", desc: "반성문을 씁니다. 아무 일도 일어나지 않습니다.", icon: "🙇" }
        ]
    },
    {
        id: "ev_14", type: "single", name: "갑작스러운 정전", desc: "학교에 정전이 발생했습니다! 시야가 좁아져 이번 전투에서 모두의 사거리가 1칸으로 고정됩니다.",
        icon: "🔌", actionName: "시야 감소 발동!", actionDesc: "전투에서 사거리가 1로 고정됩니다."
    },
    {
        id: "ev_15", type: "single", name: "히터 고장", desc: "교실이 너무 춥습니다. 이번 전투에서 모든 아군의 마나 회복 속도(평타 및 초당)가 30% 감소합니다.",
        icon: "❄️", actionName: "추위 패널티 발동!", actionDesc: "마나 수급이 느려집니다."
    },
    {
        id: "ev_16", type: "single", name: "에어컨 빵빵", desc: "여름날 최고의 환경입니다. 이번 전투에서 모든 아군의 공격 속도가 20% 증가합니다.",
        icon: "🌀", actionName: "시원함 버프 발동!", actionDesc: "공속이 20% 증가합니다."
    },
    {
        id: "ev_17", type: "choice", name: "불법 배달 음식", desc: "배달 음식이 학교 정문에 도착했습니다.",
        icon: "🍔", 
        choices: [
            { id: "ev_17_a", name: "선생님 몰래 가져온다", desc: "아군의 공격력이 20 증가하지만, 랜덤한 아군 한 명은 징계를 받아 전투에 참여하지 못합니다.", icon: "🤫" },
            { id: "ev_17_b", name: "포기한다", desc: "아쉬움을 뒤로합니다. 아무 일도 일어나지 않습니다.", icon: "😔" }
        ]
    },
    {
        id: "ev_18", type: "choice", name: "주인 없는 교무수첩", desc: "책상 위에 교무수첩이 놓여있습니다.",
        icon: "📓", 
        choices: [
            { id: "ev_18_a", name: "펼쳐본다", desc: "약점을 파악하여 이번 전투 방어 관통력(상대 방어/마저 무시) 20%를 얻거나, 들켜서 체력을 10 잃습니다.", icon: "👀" },
            { id: "ev_18_b", name: "모른 척 한다", desc: "아무 일도 일어나지 않습니다.", icon: "🙈" }
        ]
    },
    {
        id: "ev_19", type: "single", name: "체육대회 준비", desc: "학생들이 열혈 상태입니다. 이번 전투 동안 주변 1칸 내 아군이 있을 경우 공격력이 15% 증가합니다.",
        icon: "🔥", actionName: "열혈 버프 발동!", actionDesc: "주변에 아군이 있으면 강해집니다."
    },
    {
        id: "ev_20", type: "single", name: "수능 한파", desc: "갑자기 날씨가 추워져 이번 전투 시작 시 모든 아군과 적군이 3초간 얼어붙습니다(기절).",
        icon: "🥶", actionName: "동결 발동!", actionDesc: "전투 시작 시 모두 3초 기절합니다."
    },

    // 21~30: 적 강화 및 특별 상황 (위험 이벤트)
    {
        id: "ev_21", type: "single", name: "전학생의 등장", desc: "적 진영에 강력한 전학생(체력 +30%)이 합류한 상태입니다.",
        icon: "🎒", actionName: "적 강화 발동!", actionDesc: "적군 전체 체력이 30% 증가합니다."
    },
    {
        id: "ev_22", type: "single", name: "학부모 참관 수업", desc: "적들이 긴장하여 더 강해집니다. 적군의 공격력이 20% 증가합니다.",
        icon: "👨‍👩‍👦", actionName: "적 공격력 증가!", actionDesc: "적들이 강해집니다."
    },
    {
        id: "ev_23", type: "single", name: "교장 선생님의 분노", desc: "적 진영 중 가장 코스트가 높은 유닛이 격노하여 공격 속도와 주문력이 50% 증가합니다.",
        icon: "😡", actionName: "보스 강화!", actionDesc: "적의 핵심 유닛이 강력해졌습니다."
    },
    {
        id: "ev_24", type: "choice", name: "교무실 호출", desc: "학생부 선생님이 부르십니다.",
        icon: "📢", 
        choices: [
            { id: "ev_24_a", name: "뇌물을 바친다", desc: "10골드를 잃지만 위기를 무사히 넘깁니다.", icon: "🪙" },
            { id: "ev_24_b", name: "그냥 간다", desc: "혼이 나서 8 데미지를 입습니다.", icon: "💥" }
        ]
    },
    {
        id: "ev_25", type: "single", name: "급식실 파업", desc: "밥을 못 먹어 아군 전체의 체력이 20% 깎인 채로 전투를 시작합니다.",
        icon: "🍽️", actionName: "허기짐 패널티 발동!", actionDesc: "전투 시작 체력이 80%가 됩니다."
    },
    {
        id: "ev_26", type: "single", name: "화재 경보기 오작동", desc: "시끄러운 소리에 혼란에 빠져 아군 전체의 방어력이 20 감소합니다.",
        icon: "🔔", actionName: "혼란 패널티 발동!", actionDesc: "방어력이 20 감소합니다."
    },
    {
        id: "ev_27", type: "single", name: "전국 모의고사 날", desc: "극심한 스트레스로 양팀 모두 매 초마다 최대 체력의 2%씩 피해를 입습니다.",
        icon: "📖", actionName: "스트레스 발동!", actionDesc: "모든 유닛이 지속 피해를 입습니다."
    },
    {
        id: "ev_28", type: "single", name: "학교 폭력 예방 주간", desc: "평화로운 분위기에 물들어, 전투가 시작된 후 최초 5초간 아무도 데미지를 입힐 수 없습니다.",
        icon: "🕊️", actionName: "평화 발동!", actionDesc: "5초간 모두 무적 상태가 됩니다."
    },
    {
        id: "ev_29", type: "single", name: "보충수업", desc: "선생님이 적군을 특별 지도했습니다. 적군의 모든 스탯이 10% 증가합니다.",
        icon: "📚", actionName: "적 전체 강화!", actionDesc: "적군이 전반적으로 강력해졌습니다."
    },
    {
        id: "ev_30", type: "choice", name: "버려진 실험 가운", desc: "과학실 앞에 수상한 액체가 묻은 가운이 있습니다.",
        icon: "🥼", 
        choices: [
            { id: "ev_30_a", name: "입어본다", desc: "무작위 완성 아이템 1개를 얻거나, 실험 부작용으로 팀 전체 최대 체력이 15% 깎입니다.", icon: "👕" },
            { id: "ev_30_b", name: "태워버린다", desc: "아무 일도 일어나지 않습니다.", icon: "🔥" }
        ]
    }
];
