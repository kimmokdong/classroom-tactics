import { UNIT_POOL } from './data.js';
import { ITEMS } from './items.js';

// pve_ladder.json에서 데이터 불러오기 (Vite 환경)
import pveData from '../pve_ladder.json';

// 아이템 추천 로직 (run_simulation_v2.js의 로직과 동일)
const ITEM_POOLS = {
    '물리 원딜': ['bf_sword', 'recurve_bow', 'brawlers_gloves', 'comb_ad_as', 'comb_ad_ad', 'comb_ad_crit', 'comb_ad_armor', 'comb_as_as', 'comb_as_ap'],
    '주문력 원딜': ['needlessly_large_rod', 'tear_of_the_goddess', 'brawlers_gloves', 'comb_ap_ap', 'comb_ap_mana', 'comb_ap_crit', 'comb_mana_mana'],
    '근접 브루저': ['bf_sword', 'chain_vest', 'giants_belt', 'comb_ad_armor', 'comb_ad_hp', 'comb_armor_hp', 'comb_hp_hp', 'comb_ad_mr'],
    '암살자': ['bf_sword', 'brawlers_gloves', 'recurve_bow', 'comb_ad_crit', 'comb_crit_crit', 'comb_ad_ad', 'comb_ap_crit'],
    '퓨어 탱커': ['chain_vest', 'negatron_cloak', 'giants_belt', 'comb_armor_armor', 'comb_mr_mr', 'comb_hp_hp', 'comb_armor_hp', 'comb_armor_mr'],
    '유틸 탱커': ['giants_belt', 'tear_of_the_goddess', 'chain_vest', 'comb_hp_mana', 'comb_armor_mana', 'comb_mr_mana', 'comb_hp_hp'],
    '인챈터 서폿': ['tear_of_the_goddess', 'needlessly_large_rod', 'negatron_cloak', 'comb_mana_mana', 'comb_ap_mana', 'comb_ap_mr', 'comb_mana_mr'],
    '만능형': ['bf_sword', 'needlessly_large_rod', 'chain_vest', 'negatron_cloak', 'giants_belt', 'tear_of_the_goddess', 'recurve_bow', 'brawlers_gloves']
};

function assignItemsByArchetype(unit) {
    unit.items = [];
    const baseUnit = UNIT_POOL.find(u => u.name === unit.name);
    if (!baseUnit) return;
    
    const archetype = baseUnit.archetype || '만능형';
    let pool = ITEM_POOLS[archetype] || ITEM_POOLS['만능형'];
    
    // 섞기
    pool = [...pool].sort(() => 0.5 - Math.random());
    
    // 코어 유닛은 완성템 3개
    let itemsToGive = 3; 
    let itemIds = [];
    for (const itemId of pool) {
        if (itemIds.length >= itemsToGive) break;
        const itemDef = ITEMS.find(i => i.id === itemId);
        if (itemDef && itemDef.type === 'combined') {
            itemIds.push(itemId);
        }
    }
    unit.items = itemIds;
}

function createUnit(templateName, star, isCore = false) {
    const template = UNIT_POOL.find(u => u.name === templateName);
    if (!template) return null;

    let u = JSON.parse(JSON.stringify(template));
    u.star = star;
    u.items = [];
    u.isEnemy = true;
    
    if (star >= 2) {
        u.stats.hp = Math.round(u.stats.hp * 1.8);
        u.stats.ad = Math.round(u.stats.ad * 1.5);
    }
    if (star === 3) {
        u.stats.hp = Math.round(u.stats.hp * 1.8);
        u.stats.ad = Math.round(u.stats.ad * 1.5);
        if (u.tier <= 3) {
            u.stats.armor += Math.round(25 - (u.tier * 5));
            u.stats.mr += Math.round(25 - (u.tier * 5));
            u.stats.hp += Math.round(250 - (u.tier * 50));
        }
    }
    u.stats.maxHp = u.stats.hp;

    // 코어 유닛(메인딜, 메인탱, 서브딜)에게 아이템 장착
    if (isCore) {
        assignItemsByArchetype(u);
    }

    return u;
}

function spawnDeckToBoard(deckDef) {
    const enemyBoard = Array(24).fill(null);
    const availableSlots = Array.from({ length: 24 }, (_, i) => i);
    availableSlots.sort(() => Math.random() - 0.5);

    for (let i = 0; i < deckDef.units.length; i++) {
        if (i >= 24) break;
        const uDef = deckDef.units[i];
        
        // 시뮬레이터와 동일한 성급 보정 로직 (초반 덱은 예외 처리)
        const baseUnit = UNIT_POOL.find(u => u.name === uDef.name);
        let star = 2; // 기본 2성
        
        if (deckDef.level <= 4) {
            // 3~4렙 덱 (Phase 1): 대부분 1성, 30% 확률로 2성
            star = Math.random() < 0.3 ? 2 : 1;
        } else if (deckDef.level <= 6) {
            // 5~6렙 덱 (Phase 2): 전부 2성
            star = 2;
        } else if (deckDef.level === 7) {
            if (baseUnit && baseUnit.tier <= 3) star = 3; // 7렙 덱: 1~3코 3성
        } else if (deckDef.level === 8) {
            if (baseUnit && baseUnit.tier <= 2) star = 3; // 8렙 덱: 1~2코 3성
        } else {
            if (baseUnit && baseUnit.tier === 1) star = 3; // 9~10렙 덱: 1코 3성
        }

        const isCore = ['main_tank', 'main_dealer', 'sub_dealer'].includes(uDef.assignedRole);
        const unitInstance = createUnit(uDef.name, star, isCore);
        
        if (unitInstance) {
            enemyBoard[availableSlots[i]] = unitInstance;
        }
    }
    return enemyBoard;
}

// -----------------------------------------------------
// 다이내믹 MMR 래더 로직
// -----------------------------------------------------
export function generateEnemyBoard(gameState) {
    const world = gameState.stage[0];
    const round = gameState.stage[1];
    const totalRounds = (world - 1) * 5 + round;

    // 유저의 내부 MMR 추정치 계산 (0 ~ 3000)
    // - 시간 경과(스테이지)에 따라 베이스 MMR 상승 (최대 7스테이지 도달 시 3000)
    // - 연승/연패에 따른 추가 가감 (+- 변동폭)
    const baseMmr = Math.min(3000, (totalRounds / 31) * 3000);
    const winStreakBonus = (gameState.winStreak || 0) * 150;
    const lossStreakPenalty = (gameState.lossStreak || 0) * 150;
    const playerMmr = Math.max(0, Math.min(3000, baseMmr + winStreakBonus - lossStreakPenalty));
    
    // 로깅
    console.log(`[PVE Ladder] 스테이지 ${world}-${round} (Round ${totalRounds}) | Player MMR: ${Math.round(playerMmr)}`);

    const { metaDecks, earlyDecks } = pveData;

    // 1-1 (Round 1): 무작위 1코 1마리
    if (totalRounds === 1) {
        const pool = UNIT_POOL.filter(u => u.tier === 1);
        const u = createUnit(pool[Math.floor(Math.random() * pool.length)].name, 1);
        const board = Array(24).fill(null);
        board[12] = u; // 중앙쯤 배치
        return board;
    }
    
    // 1-2 (Round 2): 무작위 1코 2마리
    if (totalRounds === 2) {
        const pool = UNIT_POOL.filter(u => u.tier === 1);
        const u1 = createUnit(pool[Math.floor(Math.random() * pool.length)].name, 1);
        const u2 = createUnit(pool[Math.floor(Math.random() * pool.length)].name, 1);
        const board = Array(24).fill(null);
        board[11] = u1;
        board[12] = u2;
        return board;
    }

    // Phase 1 (1-3 ~ 1-5): 미니 덱 (Lv 3~4)
    if (world === 1) {
        const candidates = earlyDecks.filter(d => d.level <= 4);
        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        return spawnDeckToBoard(selected);
    }

    // Phase 2 (2-1 ~ 2-5): 미니 덱 (Lv 5~6)
    if (world === 2) {
        const candidates = earlyDecks.filter(d => d.level >= 5 && d.level <= 6);
        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        return spawnDeckToBoard(selected);
    }

    // 메타 덱 필터링 (Phase 3 ~ 6)
    let targetLevel = 7;
    if (world === 3) targetLevel = 7;
    else if (world === 4) targetLevel = 8;
    else if (world === 5) targetLevel = 9;
    else if (world >= 6) targetLevel = 10;

    // 최종장 (7-1 등) 일 경우 가장 MMR 높은 엑조디아 덱
    if (world >= 7) {
        const candidates = metaDecks.filter(d => d.level === 10);
        // MMR 상위 3개 중 하나
        const top3 = candidates.slice(-3);
        const selected = top3[Math.floor(Math.random() * top3.length)];
        return spawnDeckToBoard(selected);
    }

    // 일반 페이즈: 타겟 레벨 덱들 중에서 내 MMR과 가장 가까운 덱 3개를 추려 그중 랜덤 스폰
    const levelDecks = metaDecks.filter(d => d.level === targetLevel);
    
    if (levelDecks.length === 0) {
        // fallback
        return spawnDeckToBoard(metaDecks[Math.floor(Math.random() * metaDecks.length)]);
    }

    // MMR 차이 기준으로 정렬
    levelDecks.sort((a, b) => Math.abs(a.mmr - playerMmr) - Math.abs(b.mmr - playerMmr));
    
    // 가장 가까운 3개 (또는 그 이하)
    const closestDecks = levelDecks.slice(0, Math.min(3, levelDecks.length));
    const selected = closestDecks[Math.floor(Math.random() * closestDecks.length)];

    console.log(`[PVE Ladder] 스폰 덱: ${selected.fullName} (Deck MMR: ${selected.mmr})`);

    return spawnDeckToBoard(selected);
}
