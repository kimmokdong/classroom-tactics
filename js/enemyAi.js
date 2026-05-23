import { UNIT_POOL } from './data.js';

export function generateEnemyBoard(world, round) {
    const totalRounds = (world - 1) * 5 + round; // 1-1은 1, 2-1은 6
    // 초반에는 1~2 코스트로 시작하고 후반 갈수록 가파르게 증가하는 예산
    const budget = totalRounds + Math.floor(totalRounds * totalRounds * 0.05);
    const enemyBoard = Array(24).fill(null); // 3x8 보드
    let currentCost = 0;
    
    // 사용 가능한 유닛 풀 (현재 라운드에 따라 허용 티어 제한 가능)
    const allowedMaxTier = Math.min(5, Math.ceil(world / 2) + 1);
    const validPool = UNIT_POOL.filter(u => u.tier <= allowedMaxTier);

    let attempts = 0;
    while(currentCost < budget && attempts < 50) {
        attempts++;
        const unitTemplate = validPool[Math.floor(Math.random() * validPool.length)];
        
        // 예산 초과 방지 및 후반 라운드에서는 1코스트 스팸 방지를 위한 로직
        if(currentCost + unitTemplate.tier > budget) continue;
        
        const idx = Math.floor(Math.random() * 24);
        if(!enemyBoard[idx]) {
            const enemyUnit = JSON.parse(JSON.stringify(unitTemplate));
            enemyUnit.star = 1;
            enemyUnit.items = [];
            
            // 후반 라운드일수록 2성 확률 부여 (예시)
            if(world >= 3 && Math.random() < 0.3) {
                enemyUnit.star = 2;
                enemyUnit.stats.hp = Math.round(enemyUnit.stats.hp * 1.8);
                enemyUnit.stats.ad = Math.round(enemyUnit.stats.ad * 1.5);
                enemyUnit.stats.ap = Math.round(enemyUnit.stats.ap * 1.5);
            }
            
            enemyUnit.isEnemy = true;
            enemyBoard[idx] = enemyUnit;
            currentCost += (enemyUnit.tier * (enemyUnit.star === 2 ? 3 : 1));
        }
    }
    
    return enemyBoard;
}
