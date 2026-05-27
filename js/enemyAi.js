import { UNIT_POOL } from './data.js';

const SHOP_PROBABILITIES = {
    1: [100, 0, 0, 0, 0],
    2: [100, 0, 0, 0, 0],
    3: [75, 25, 0, 0, 0],
    4: [55, 30, 15, 0, 0],
    5: [45, 33, 20, 2, 0],
    6: [25, 40, 30, 5, 0],
    7: [19, 30, 35, 15, 1],
    8: [15, 20, 35, 25, 5],
    9: [10, 15, 30, 30, 15],
    10: [5, 10, 25, 40, 20]
};

function getEnemyLevel(world, round) {
    if (world === 1) return round <= 3 ? 3 : 4;
    if (world === 2) return round <= 3 ? 5 : 6;
    if (world === 3) return 7;
    if (world === 4) return 8;
    if (world === 5) return 9;
    return 10;
}

function generateShop(level) {
    const probs = SHOP_PROBABILITIES[level] || SHOP_PROBABILITIES[10];
    const shop = [];
    for (let i = 0; i < 5; i++) {
        const rand = Math.random() * 100;
        let cumulative = 0;
        let selectedTier = 1;
        for (let t = 1; t <= 5; t++) {
            cumulative += probs[t - 1];
            if (rand < cumulative) {
                selectedTier = t;
                break;
            }
        }
        const pool = UNIT_POOL.filter(u => u.tier === selectedTier);
        if (pool.length > 0) {
            shop.push(pool[Math.floor(Math.random() * pool.length)]);
        }
    }
    return shop;
}

function createUnit(template, star) {
    let u = JSON.parse(JSON.stringify(template));
    u.star = star;
    u.items = [];
    u.isEnemy = true;
    if (star >= 2) {
        u.stats.hp = Math.round(u.stats.hp * 1.8);
        u.stats.ad = Math.round(u.stats.ad * 1.5);
        u.stats.ap = Math.round(u.stats.ap * 1.5);
    }
    if (star === 3) {
        u.stats.hp = Math.round(u.stats.hp * 1.8);
        u.stats.ad = Math.round(u.stats.ad * 1.5);
        u.stats.ap = Math.round(u.stats.ap * 1.5);

        // [신규 기획] 적 AI도 1~3코스트 3성 패시브 적용 (동일 밸런스)
        if (u.tier <= 3) {
            u.stats.armor += Math.round(50 - (u.tier * 10));
            u.stats.mr += Math.round(50 - (u.tier * 10));
            u.stats.hp += Math.round(500 - (u.tier * 100));
        }
    }
    u.stats.maxHp = u.stats.hp;
    return u;
}

export function generateEnemyBoard(world, round) {
    const totalRounds = (world - 1) * 5 + round;
    const enemyLevel = getEnemyLevel(world, round);

    // 예산: 1-1은 13G, 7-1은 343G 정도로 기하급수적 성장
    let budget = 10 + (totalRounds * 3) + Math.floor(totalRounds * totalRounds * 0.25);

    let purchasedPool = [];
    let safeGuard = 0;

    // 가상 플레이어 상점 리롤 & 구매 시뮬레이션
    while (budget >= 2 && safeGuard < 500) {
        safeGuard++;
        const shop = generateShop(enemyLevel);

        for (let unit of shop) {
            if (budget >= unit.tier) {
                budget -= unit.tier;
                purchasedPool.push(unit.id);
            }
        }
        // 리롤 비용 차감
        budget -= 2;
    }

    // 구매한 유닛 병합 (Auto-combine)
    let counts = {};
    for (let id of purchasedPool) {
        counts[id] = (counts[id] || 0) + 1;
    }

    let finalUnits = [];
    for (let id in counts) {
        let count = counts[id];
        let star3 = Math.floor(count / 9);
        let rem = count % 9;
        let star2 = Math.floor(rem / 3);
        let star1 = rem % 3;

        const baseUnit = UNIT_POOL.find(u => u.id === id);
        for (let i = 0; i < star3; i++) finalUnits.push(createUnit(baseUnit, 3));
        for (let i = 0; i < star2; i++) finalUnits.push(createUnit(baseUnit, 2));
        for (let i = 0; i < star1; i++) finalUnits.push(createUnit(baseUnit, 1));
    }

    // 우선순위 정렬: 별(Star) 내림차순 -> 코스트(Tier) 내림차순 -> 랜덤
    finalUnits.sort((a, b) => {
        if (a.star !== b.star) return b.star - a.star;
        if (a.tier !== b.tier) return b.tier - a.tier;
        return Math.random() - 0.5;
    });

    // 보드 스폰 개수 제한 (적 레벨만큼)
    const spawnCount = Math.min(enemyLevel, finalUnits.length);
    const selectedUnits = finalUnits.slice(0, spawnCount);

    const enemyBoard = Array(24).fill(null);
    const availableSlots = Array.from({ length: 24 }, (_, i) => i);

    // 무작위 셔플 후 배치
    availableSlots.sort(() => Math.random() - 0.5);
    for (let i = 0; i < selectedUnits.length; i++) {
        enemyBoard[availableSlots[i]] = selectedUnits[i];
    }

    return enemyBoard;
}
