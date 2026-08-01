import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import { SYNERGIES, UNIT_POOL } from '../../js/data.js';
import { ITEMS } from '../../js/items.js';
import { getActiveSynergyLevel, getSynergyData } from '../../js/systems/SynergyManager.js';

const schema = JSON.parse(fs.readFileSync(new URL('../../balance/standard-decks.schema.json', import.meta.url), 'utf8'));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
const unitsById = new Map(UNIT_POOL.map(unit => [unit.id, unit]));
const itemIds = new Set(ITEMS.map(item => item.id));
const roleRequirements = { mainTank: 'tank', mainDealer: 'dealer', subDealer: 'dealer' };
const damageItemFamilies = {
    AD: new Set(['comb_ad_ad', 'comb_ad_as', 'comb_ad_crit']),
    AP: new Set(['comb_ap_ap', 'comb_ap_mana', 'comb_ap_crit'])
};
const strategyRules = {
    reroll_core7: { boardLevel: 7, phase: 'core', itemSet: 'baseline6' },
    reroll_final8: { boardLevel: 8, phase: 'final', itemSet: 'baseline6' },
    standard_core8: { boardLevel: 8, phase: 'core', itemSet: 'baseline6' },
    standard_final9: { boardLevel: 9, phase: 'final', itemSet: 'baseline6' },
    highvalue_final9: { boardLevel: 9, phase: 'final', itemSet: 'capped9' }
};

function actualSynergies(units) {
    const counts = getSynergyData(units);
    return Object.entries(counts).flatMap(([type, typeCounts]) => Object.entries(typeCounts).flatMap(([name, count]) => {
        const synergy = SYNERGIES[type]?.[name];
        if (!synergy) return [];
        const level = getActiveSynergyLevel(count, Object.keys(synergy.levels), synergy.exactMatch);
        return level ? [{ type, name, level }] : [];
    }));
}

const synergyKey = synergy => `${synergy.type}:${synergy.name}:${synergy.level}`;
const unitSetKey = deck => deck.units.map(unit => unit.unitId).sort().join(',');

function preferredDamageItemFamily(unit) {
    if (/^(AD|AS)/.test(unit.archetype || '') || (unit.skill?.adRatio && !unit.skill?.apRatio)) return 'AD';
    if (/^AP/.test(unit.archetype || '') || (unit.skill?.apRatio && !unit.skill?.adRatio)) return 'AP';
    return null;
}

function validateDamageItems(deck, errors, warnings) {
    const dealerIds = new Set([deck.roles.mainDealer, deck.roles.subDealer]);
    for (const entry of deck.units) {
        const unit = unitsById.get(entry.unitId);
        const expectedFamily = dealerIds.has(entry.unitId) && entry.items.length > 0 && unit
            ? preferredDamageItemFamily(unit)
            : null;
        const matches = expectedFamily && entry.items.every(itemId => damageItemFamilies[expectedFamily].has(itemId));
        if (expectedFamily && !matches) {
            const actualFamily = Object.entries(damageItemFamilies)
                .find(([, itemIds]) => entry.items.every(itemId => itemIds.has(itemId)))?.[0] || '혼합';
            const exception = entry.itemExceptionReason ? `; 의도적 예외: ${entry.itemExceptionReason}` : '; 예외 사유 없음';
            warnings.push(`deck ${deck.id}: ${entry.unitId} ${actualFamily} 아이템이 ${expectedFamily} 권장군과 불일치${exception}`);
        } else if (entry.itemExceptionReason) {
            errors.push(`deck ${deck.id}: ${entry.unitId} 불필요한 itemExceptionReason`);
        }
    }
}

function validateStrategy(deck, checkpoint, decksById, errors) {
    const prefix = `deck ${deck.id}: `;
    const rule = strategyRules[deck.strategyGroup];
    const units = deck.units.map(entry => ({ entry, data: unitsById.get(entry.unitId) }));
    const roleUnit = role => units.find(unit => unit.entry.unitId === deck.roles[role]);
    const tank = roleUnit('mainTank');
    const dealer = roleUnit('mainDealer');

    if (checkpoint.boardLevel !== rule.boardLevel || checkpoint.phase !== rule.phase) {
        errors.push(prefix + 'strategyGroup과 boardLevel/phase 불일치');
    }
    if (deck.defaultItemSet !== rule.itemSet) errors.push(prefix + 'strategyGroup과 defaultItemSet 불일치');
    if (deck.roles.mainTank === deck.roles.mainDealer) errors.push(prefix + '메인 탱커와 메인 딜러가 같음');

    if (deck.strategyGroup === 'reroll_core7') {
        const coreStars = units.filter(unit => unit.data?.tier === 3 && unit.entry.star === 3);
        if (tank?.data.tier !== 3 || tank.entry.star !== 3 || dealer?.data.tier !== 3 || dealer.entry.star !== 3) {
            errors.push(prefix + 'core7 메인 탱커·딜러는 서로 다른 3코스트 3성이어야 함');
        }
        if (coreStars.length < 2) errors.push(prefix + 'core7 3코스트 3성 2명 미만');
        if (coreStars.some(unit => ![deck.roles.mainTank, deck.roles.mainDealer].includes(unit.entry.unitId))) {
            errors.push(prefix + 'core7 추가 3성이 명시되지 않음');
        }
        if (units.some(unit => unit.data?.tier === 5)) errors.push(prefix + 'core7 5코스트 금지');
        if (units.some(unit => unit.data?.tier === 4 && unit.entry.star > 1)) errors.push(prefix + 'core7 4코스트는 최대 1성');
    }

    if (deck.strategyGroup === 'standard_core8') {
        if (tank?.data.tier !== 4 || tank.entry.star !== 2 || dealer?.data.tier !== 4 || dealer.entry.star !== 2) {
            errors.push(prefix + 'core8 메인 탱커·딜러는 서로 다른 4코스트 2성이어야 함');
        }
        if (units.some(unit => unit.data?.tier === 5)) errors.push(prefix + 'core8 5코스트 금지');
        if (units.filter(unit => unit.data?.tier === 4 && unit.entry.star === 2).length > 3) {
            errors.push(prefix + 'core8 4코스트 2성 과다');
        }
    }

    if (['reroll_final8', 'standard_final9'].includes(deck.strategyGroup)) {
        const expectedParentGroup = deck.strategyGroup === 'reroll_final8' ? 'reroll_core7' : 'standard_core8';
        const parent = decksById.get(deck.parentDeckId);
        if (!parent || parent.strategyGroup !== expectedParentGroup) {
            errors.push(prefix + `유효한 ${expectedParentGroup} parentDeckId 필요`);
        } else {
            const parentIds = new Set(parent.units.map(unit => unit.unitId));
            const childIds = new Set(deck.units.map(unit => unit.unitId));
            if (deck.units.length !== parent.units.length + 1 || [...parentIds].some(id => !childIds.has(id))) {
                errors.push(prefix + '부모 덱에서 유닛 1명만 추가해야 함');
            }
            for (const role of ['mainTank', 'mainDealer']) {
                const parentRole = parent.roles[role];
                const childUnit = deck.units.find(unit => unit.unitId === parentRole);
                if (deck.roles[role] !== parentRole || childUnit?.star !== parent.units.find(unit => unit.unitId === parentRole)?.star) {
                    errors.push(prefix + `${role} 핵심 유닛·성급 유지 실패`);
                }
            }
        }
    }

    if (deck.strategyGroup === 'reroll_final8') {
        if (units.some(unit => unit.data?.tier === 4 && unit.entry.star > 2)) errors.push(prefix + 'final8 4코스트는 최대 2성');
        if (units.some(unit => unit.data?.tier === 5 && unit.entry.star > 1)) errors.push(prefix + 'final8 5코스트는 최대 1성');
    }
    if (deck.strategyGroup === 'standard_final9' && units.some(unit => unit.data?.tier === 5 && unit.entry.star !== 1)) {
        errors.push(prefix + 'standard final9 5코스트는 1성이어야 함');
    }
    if (deck.strategyGroup === 'highvalue_final9') {
        const mainFiveStar = [tank, dealer].some(unit => unit?.data.tier === 5 && unit.entry.star === 2);
        const highCostTwoStars = units.filter(unit => unit.data?.tier >= 4 && unit.entry.star === 2).length;
        if (!mainFiveStar) errors.push(prefix + 'highvalue final9 메인 탱커·딜러 중 5코스트 2성 필요');
        if (highCostTwoStars < 3) errors.push(prefix + 'highvalue final9 4·5코스트 2성 3명 미만');
    }
}

export function validateStandardDecks(data) {
    const schemaValid = validateSchema(data);
    const errors = schemaValid ? [] : validateSchema.errors.map(error => `schema ${error.instancePath || '/'} ${error.message}`);
    const warnings = [];
    if (!schemaValid) return { valid: false, errors, warnings };

    const checkpointsById = new Map();
    data.checkpoints.forEach(checkpoint => {
        if (checkpointsById.has(checkpoint.id)) errors.push(`중복 checkpoint ID ${checkpoint.id}`);
        checkpointsById.set(checkpoint.id, checkpoint);
    });
    if (!checkpointsById.has(data.primaryCheckpoint)) errors.push(`primaryCheckpoint가 존재하지 않음: ${data.primaryCheckpoint}`);

    const decksById = new Map();
    data.decks.forEach(deck => {
        if (decksById.has(deck.id)) errors.push(`deck ${deck.id}: 중복 deck ID`);
        decksById.set(deck.id, deck);
    });

    const usedCompositions = new Map();
    data.decks.forEach(deck => {
        const prefix = `deck ${deck.id}: `;
        const checkpoint = checkpointsById.get(deck.checkpointId);
        if (!checkpoint) errors.push(prefix + `미등록 checkpointId ${deck.checkpointId}`);
        else {
            if (deck.units.length !== checkpoint.boardLevel) errors.push(prefix + 'unit count와 boardLevel 불일치');
            validateStrategy(deck, checkpoint, decksById, errors);
        }

        const composition = unitSetKey(deck);
        if (usedCompositions.has(composition)) errors.push(prefix + `중복 유닛 조합 (${usedCompositions.get(composition)})`);
        usedCompositions.set(composition, deck.id);

        const usedUnits = new Set();
        const usedPositions = new Set();
        const realUnits = [];
        deck.units.forEach(unit => {
            if (usedUnits.has(unit.unitId)) errors.push(prefix + `중복 unitId ${unit.unitId}`);
            if (usedPositions.has(unit.position)) errors.push(prefix + `중복 position ${unit.position}`);
            usedUnits.add(unit.unitId);
            usedPositions.add(unit.position);
            const realUnit = unitsById.get(unit.unitId);
            if (!realUnit) errors.push(prefix + `미등록 unitId ${unit.unitId}`);
            else realUnits.push(realUnit);
            unit.items.forEach(itemId => { if (!itemIds.has(itemId)) errors.push(prefix + `미등록 itemId ${itemId}`); });
        });

        Object.entries(deck.roles).forEach(([role, unitId]) => {
            const unit = unitsById.get(unitId);
            if (!usedUnits.has(unitId)) errors.push(prefix + `${role}가 덱에 없는 유닛을 참조`);
            else if (!unit.role.includes(roleRequirements[role])) errors.push(prefix + `${role} 역할 불일치 ${unitId}`);
        });
        const entriesById = new Map(deck.units.map(unit => [unit.unitId, unit]));
        if (entriesById.get(deck.roles.mainTank)?.positionGroup !== 'front-center') errors.push(prefix + 'mainTank 위치 그룹 불일치');
        if (entriesById.get(deck.roles.mainDealer)?.positionGroup !== 'back-center') errors.push(prefix + 'mainDealer 위치 그룹 불일치');
        if (entriesById.get(deck.roles.subDealer)?.positionGroup !== 'back-side') errors.push(prefix + 'subDealer 위치 그룹 불일치');
        const expectedItemCounts = deck.defaultItemSet === 'capped9'
            ? { mainTank: 3, mainDealer: 3, subDealer: 3 }
            : { mainTank: 3, mainDealer: 3, subDealer: 0 };
        Object.entries(expectedItemCounts).forEach(([role, count]) => {
            if (entriesById.get(deck.roles[role])?.items.length !== count) errors.push(prefix + `${role} ${deck.defaultItemSet} 아이템 수 불일치`);
        });
        const expectedTotalItems = deck.defaultItemSet === 'capped9' ? 9 : 6;
        const totalItems = deck.units.reduce((sum, unit) => sum + unit.items.length, 0);
        if (totalItems !== expectedTotalItems) errors.push(prefix + `${deck.defaultItemSet} 전체 아이템 수 불일치`);
        const roleIds = new Set(Object.values(deck.roles));
        if (deck.units.some(unit => !roleIds.has(unit.unitId) && unit.items.length > 0)) {
            errors.push(prefix + '역할 외 유닛에 아이템 배정');
        }
        validateDamageItems(deck, errors, warnings);

        const expectedKeys = deck.expectedSynergies.map(synergyKey);
        if (new Set(expectedKeys).size !== expectedKeys.length) errors.push(prefix + '중복 expectedSynergy');
        if (realUnits.length === deck.units.length) {
            const actualKeys = actualSynergies(realUnits).map(synergyKey).sort();
            if (JSON.stringify(actualKeys) !== JSON.stringify([...expectedKeys].sort())) {
                errors.push(prefix + `expectedSynergies 불일치 (actual: ${actualKeys.join(', ') || '없음'})`);
            }
        }
    });

    const auditById = new Map();
    data.legacyAudit.forEach(entry => {
        if (auditById.has(entry.sourceId)) errors.push(`중복 legacy audit ID ${entry.sourceId}`);
        auditById.set(entry.sourceId, entry);
        entry.unitIds.forEach(unitId => { if (!unitsById.has(unitId)) errors.push(`${entry.sourceId}: 미등록 unitId ${unitId}`); });
        entry.targetDeckIds.forEach(deckId => {
            const deck = decksById.get(deckId);
            if (!deck) errors.push(`${entry.sourceId}: 미등록 targetDeckId ${deckId}`);
            else if (!deck.sourceLegacyIds.includes(entry.sourceId)) errors.push(`${entry.sourceId}: target deck 정참조 누락 ${deckId}`);
        });
        if (entry.targetDeckIds.length === 0 && !['excluded', 'needs-new-design'].includes(entry.disposition)) {
            errors.push(`${entry.sourceId}: 활성 대상 없는 disposition 불일치`);
        }
    });
    data.decks.forEach(deck => deck.sourceLegacyIds.forEach(sourceId => {
        const audit = auditById.get(sourceId);
        if (!audit) errors.push(`deck ${deck.id}: 미등록 sourceLegacyId ${sourceId}`);
        else if (!audit.targetDeckIds.includes(deck.id)) errors.push(`deck ${deck.id}: legacy audit 역참조 누락 ${sourceId}`);
    }));

    return { valid: errors.length === 0, errors, warnings };
}

export function validateStandardDeckFile(filePath = 'balance/standard-decks.json') {
    const data = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
    return { data, ...validateStandardDecks(data) };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    try {
        const result = validateStandardDeckFile(process.argv[2]);
        result.warnings.forEach(warning => console.warn('- 경고: ' + warning));
        if (!result.valid) {
            result.errors.forEach(error => console.error('- ' + error));
            process.exitCode = 1;
        } else {
            console.log(`표준 덱 ${result.data.decks.length}개, 레거시 감사 ${result.data.legacyAudit.length}개 검증 통과`);
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
