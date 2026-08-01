import { ITEMS } from '../items.js';
import { getSynergyData } from '../systems/SynergyManager.js';

const TEAM_ROLES = new Set(['player', 'opponent', 'neutral']);

function assertTeamRole(teamRole) {
    if (!TEAM_ROLES.has(teamRole)) throw new RangeError(`지원하지 않는 teamRole: ${teamRole}`);
}

export function isValidItemId(itemId, catalog = ITEMS) {
    return typeof itemId === 'string' && catalog.some(item => item.id === itemId);
}

export function validateItemIds(itemIds = [], catalog = ITEMS) {
    if (!Array.isArray(itemIds)) throw new TypeError('itemIds는 배열이어야 합니다.');
    if (itemIds.length > 3) throw new RangeError('유닛은 아이템을 최대 3개까지 장착할 수 있습니다.');
    const invalid = itemIds.find(itemId => !isValidItemId(itemId, catalog));
    if (invalid) throw new RangeError(`등록되지 않은 아이템 ID: ${invalid}`);
    return [...itemIds];
}

export function rollThievesItems(random = Math.random, catalog = ITEMS) {
    if (typeof random !== 'function') throw new TypeError('random은 함수여야 합니다.');
    const pool = catalog.filter(item => item.type === 'combined' && item.id !== 'comb_crit_crit');
    if (pool.length === 0) throw new RangeError('도둑의 장갑으로 선택할 완성 아이템이 없습니다.');
    return Array.from({ length: 2 }, () => {
        const roll = random();
        if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new RangeError('random은 0 이상 1 미만을 반환해야 합니다.');
        return pool[Math.floor(roll * pool.length)].id;
    });
}

export function equipUnitItems(unit, itemIds = [], { catalog = ITEMS, random = Math.random } = {}) {
    if (!unit || typeof unit !== 'object') throw new TypeError('장착할 유닛이 필요합니다.');
    const hadThievesGloves = unit.items?.includes('comb_crit_crit');
    unit.items = validateItemIds(itemIds, catalog);
    if (unit.items.includes('comb_crit_crit')) {
        if (!hadThievesGloves || !Array.isArray(unit.thievesItems) || unit.thievesItems.length !== 2) {
            unit.thievesItems = rollThievesItems(random, catalog);
        }
    } else {
        delete unit.thievesItems;
    }
    return unit;
}

export function promoteUnitToStar(unit, targetStar) {
    if (!unit?.stats || !Number.isFinite(unit.stats.hp) || !Number.isFinite(unit.stats.ad)) {
        throw new TypeError('별 등급을 적용할 유닛 스탯이 올바르지 않습니다.');
    }
    const currentStar = unit.star || 1;
    if (!Number.isInteger(currentStar) || currentStar < 1 || currentStar > 3
        || !Number.isInteger(targetStar) || targetStar < currentStar || targetStar > 3) {
        throw new RangeError(`올바르지 않은 별 등급 변경: ${currentStar} → ${targetStar}`);
    }

    const promoted = structuredClone(unit);
    promoted.star = currentStar;
    while (promoted.star < targetStar) {
        promoted.stats.hp = Math.round(promoted.stats.hp * 1.8);
        promoted.stats.ad = Math.round(promoted.stats.ad * 1.5);
        promoted.star++;
    }
    promoted.stats.maxHp = promoted.stats.hp;
    return promoted;
}

export function createUnitInstance(template, {
    star = 1,
    itemIds = [],
    instanceId,
    teamRole = 'neutral',
    catalog = ITEMS,
    random = Math.random
} = {}) {
    if (!template || typeof template !== 'object') throw new TypeError('유닛 템플릿이 필요합니다.');
    assertTeamRole(teamRole);
    const unit = structuredClone(template);
    unit.star = 1;
    unit.items = [];
    delete unit.thievesItems;
    if (instanceId !== undefined) unit.instanceId = instanceId;
    unit.isEnemy = teamRole === 'opponent';
    const promoted = promoteUnitToStar(unit, star);
    return equipUnitItems(promoted, itemIds, { catalog, random });
}

export function prepareBattle({
    player,
    opponent,
    applySynergyStats,
    getSynergies = getSynergyData,
    random = Math.random
}) {
    if (typeof applySynergyStats !== 'function') throw new TypeError('applySynergyStats 함수가 필요합니다.');
    if (typeof getSynergies !== 'function') throw new TypeError('getSynergies 함수가 필요합니다.');
    if (typeof random !== 'function') throw new TypeError('random은 함수여야 합니다.');

    const prepareTeam = (team, defaultRole) => {
        const {
            board,
            teamRole = defaultRole,
            applyPlayerOnlyBonuses = teamRole === 'player'
        } = team || {};
        if (!Array.isArray(board) || board.length !== 24) throw new RangeError('전투 보드는 정확히 24칸이어야 합니다.');
        assertTeamRole(teamRole);
        const synergies = getSynergies(board);
        const isEnemy = teamRole === 'opponent';
        return {
            board: applySynergyStats(board, synergies, isEnemy, random, { teamRole, applyPlayerOnlyBonuses }),
            synergies
        };
    };

    const preparedPlayer = prepareTeam(player, 'player');
    const preparedOpponent = prepareTeam(opponent, 'opponent');
    return {
        playerBoard: preparedPlayer.board,
        enemyBoard: preparedOpponent.board,
        playerSynergies: preparedPlayer.synergies,
        enemySynergies: preparedOpponent.synergies
    };
}
