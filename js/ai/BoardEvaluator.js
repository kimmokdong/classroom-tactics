import { ITEM_POOLS, SYNERGIES } from '../data.js';
import { ITEMS } from '../items.js';
import { getActiveSynergyLevel, getSynergyData } from '../systems/SynergyManager.js';

export const DEFAULT_BOARD_EVALUATION_WEIGHTS = Object.freeze({
    tier: 10,
    stats: { hp: 0.012, ad: 0.12, ap: 0.025, armor: 0.07, mr: 0.07, as: 5, range: 0.5 },
    starMultipliers: [1, 1.15, 1.3],
    synergyLevel: 4,
    synergyEffect: 1.5,
    inactiveTrait: -1.5,
    rolePresent: { tank: 12, dealer: 12, support: 4 },
    missingRole: { tank: -20, dealer: -24 },
    roleOverflow: -2,
    itemBase: 2,
    itemCombined: 5,
    itemFit: 6,
    itemMismatch: -2,
    placementFit: 3,
    placementMismatch: -3,
    utility: 2.5,
    nearUpgrade: 8,
    transitionUnit: -4
});

const round = value => Math.round(value * 100) / 100;
const values = value => Array.isArray(value) ? value : [value];

function effectMagnitude(effect) {
    return Object.entries(effect || {}).reduce((score, [key, value]) => {
        if (key === 'desc') return score;
        if (typeof value === 'boolean') return score + (value ? 0.75 : 0);
        if (typeof value === 'number') return score + Math.log2(1 + Math.abs(value));
        return score;
    }, 0);
}

function itemMatchesRole(unit, item, pools) {
    if (pools[unit.archetype]?.includes(item.id)) return true;
    const stats = item.stats || {};
    const roles = unit.role || [];
    if (roles.includes('tank') && (stats.maxHp || stats.armor || stats.mr)) return true;
    if (roles.includes('dealer') && (stats.ad || stats.adPct || stats.ap || stats.apPct || stats.as || stats.critChance)) return true;
    return roles.includes('support') && (stats.mana || stats.ap || stats.apPct);
}

function utilityCount(skill = {}) {
    const text = `${skill.type || ''} ${Object.keys(skill).join(' ')}`.toLowerCase();
    return ['stun', 'taunt', 'silence', 'debuff', 'shield', 'heal', 'mana', 'cleanse', 'immune', 'revive']
        .filter(keyword => text.includes(keyword)).length;
}

function placementScore(unit, index, weights, frontRow) {
    const row = Math.floor(index / 8);
    const backRow = 2 - frontRow;
    const roles = unit.role || [];
    const shouldFront = roles.includes('tank');
    const shouldBack = !shouldFront && (roles.includes('support') || (roles.includes('dealer') && unit.stats.range > 1));
    if ((!shouldFront && !shouldBack) || (shouldFront && row === frontRow) || (shouldBack && row === backRow)) return weights.placementFit;
    return weights.placementMismatch;
}

function transitionScore(board, previousBoard, weight) {
    if (!previousBoard?.some(Boolean)) return 0;
    const remaining = board.filter(Boolean).map(unit => unit.id);
    let removed = 0;
    previousBoard.filter(Boolean).forEach(unit => {
        const index = remaining.indexOf(unit.id);
        if (index === -1) removed++;
        else remaining.splice(index, 1);
    });
    return (removed + remaining.length) * weight;
}

export function evaluateBoard(board, options = {}) {
    const weights = {
        ...DEFAULT_BOARD_EVALUATION_WEIGHTS,
        ...options.weights,
        stats: { ...DEFAULT_BOARD_EVALUATION_WEIGHTS.stats, ...options.weights?.stats },
        rolePresent: { ...DEFAULT_BOARD_EVALUATION_WEIGHTS.rolePresent, ...options.weights?.rolePresent },
        missingRole: { ...DEFAULT_BOARD_EVALUATION_WEIGHTS.missingRole, ...options.weights?.missingRole }
    };
    const items = options.items || ITEMS;
    const synergies = options.synergies || SYNERGIES;
    const itemPools = options.itemPools || ITEM_POOLS;
    const units = board.map((unit, index) => unit ? { unit, index } : null).filter(Boolean);
    const breakdown = { units: 0, synergies: 0, roles: 0, items: 0, placement: 0, utility: 0, upgrades: 0, transition: 0 };
    const details = { units: [], synergies: [], roles: {}, upgrades: [] };

    units.forEach(({ unit, index }) => {
        const stats = unit.stats || {};
        const base = unit.tier * weights.tier + Object.entries(weights.stats)
            .reduce((score, [key, weight]) => score + (stats[key] || 0) * weight, 0);
        const star = Math.min(3, Math.max(1, unit.star || 1));
        const unitScore = base * weights.starMultipliers[star - 1];
        const unitItems = unit.items || [];
        const itemScore = unitItems.reduce((score, itemId) => {
            const item = items.find(candidate => candidate.id === itemId);
            if (!item) return score;
            return score + (item.type === 'combined' ? weights.itemCombined : weights.itemBase)
                + (itemMatchesRole(unit, item, itemPools) ? weights.itemFit : weights.itemMismatch);
        }, 0);
        const positionScore = placementScore(unit, index, weights, options.frontRow ?? 0);
        const utilityScore = utilityCount(unit.skill) * weights.utility;

        breakdown.units += unitScore;
        breakdown.items += itemScore;
        breakdown.placement += positionScore;
        breakdown.utility += utilityScore;
        if (options.debug) details.units.push({ id: unit.id, name: unit.name, unit: round(unitScore), items: round(itemScore), placement: positionScore, utility: utilityScore });
    });

    const synergyCounts = getSynergyData(board);
    for (const [type, counts] of Object.entries(synergyCounts)) {
        for (const [name, count] of Object.entries(counts)) {
            const definition = synergies[type]?.[name];
            if (!definition) continue;
            const level = getActiveSynergyLevel(count, Object.keys(definition.levels), definition.exactMatch);
            const effect = level ? definition.levels[level] : null;
            const score = level
                ? level * weights.synergyLevel + effectMagnitude(effect) * weights.synergyEffect
                : count * weights.inactiveTrait;
            breakdown.synergies += score;
            if (options.debug) details.synergies.push({ type, name, count, level, score: round(score), effect: effect?.desc || null });
        }
    }

    const roleCounts = { tank: 0, dealer: 0, support: 0 };
    units.forEach(({ unit }) => values(unit.role).forEach(role => { if (role in roleCounts) roleCounts[role]++; }));
    for (const [role, count] of Object.entries(roleCounts)) {
        if (count > 0) breakdown.roles += weights.rolePresent[role] || 0;
        else breakdown.roles += weights.missingRole[role] || 0;
        breakdown.roles += Math.max(0, count - Math.max(2, Math.ceil(units.length * 0.7))) * weights.roleOverflow;
    }
    details.roles = roleCounts;

    const copyCounts = new Map();
    [...units.map(entry => entry.unit), ...(options.bench || []).filter(Boolean)].forEach(unit => {
        copyCounts.set(unit.id, (copyCounts.get(unit.id) || 0) + (unit.star === 3 ? 9 : unit.star === 2 ? 3 : 1));
    });
    copyCounts.forEach((copies, id) => {
        const target = copies < 3 ? 3 : 9;
        const distance = target - copies;
        if (distance === 1) {
            const score = weights.nearUpgrade;
            breakdown.upgrades += score;
            if (options.debug) details.upgrades.push({ id, copies, distance, score });
        }
    });

    breakdown.transition = transitionScore(board, options.previousBoard, weights.transitionUnit);
    Object.keys(breakdown).forEach(key => { breakdown[key] = round(breakdown[key]); });
    const score = round(Math.max(0, Object.values(breakdown).reduce((sum, value) => sum + value, 0)));
    return options.debug ? { score, breakdown, details } : { score, breakdown };
}

export function pearsonCorrelation(pairs) {
    if (pairs.length < 2) return 0;
    const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
    const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
    const numerator = pairs.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
    const denominator = Math.sqrt(
        pairs.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0)
        * pairs.reduce((sum, [, y]) => sum + (y - meanY) ** 2, 0)
    );
    return denominator === 0 ? 0 : numerator / denominator;
}
