import { EXP_TABLE, SYNERGIES, UNIT_POOL } from '../../js/data.js';
import { ITEMS } from '../../js/items.js';
import { getActiveSynergyLevel, getSynergyData } from '../../js/systems/SynergyManager.js';

const unitById = new Map(UNIT_POOL.map(unit => [unit.id, unit]));
const itemById = new Map(ITEMS.map(item => [item.id, item]));
const starCopies = [0, 1, 3, 9];
const validEndReasons = new Set(['decisive', 'simultaneous-draw', 'max-time']);

const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function wilsonInterval(successes, sampleSize, z = 1.96) {
    if (!Number.isFinite(successes) || !Number.isFinite(sampleSize) || sampleSize <= 0 || successes < 0 || successes > sampleSize) {
        return { lower: null, upper: null, sampleSize: 0 };
    }
    const rate = successes / sampleSize;
    const denominator = 1 + z ** 2 / sampleSize;
    const center = (rate + z ** 2 / (2 * sampleSize)) / denominator;
    const margin = z * Math.sqrt((rate * (1 - rate) + z ** 2 / (4 * sampleSize)) / sampleSize) / denominator;
    return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin), sampleSize };
}

export function classifyExtremeMatchup(rate) {
    if (!Number.isFinite(rate)) return 'insufficient-data';
    if (rate <= 0.10) return 'extreme-disadvantage';
    if (rate < 0.25) return 'strongly-countered';
    if (rate < 0.40) return 'disadvantage';
    if (rate <= 0.60) return 'balanced';
    if (rate <= 0.75) return 'advantage';
    if (rate < 0.90) return 'strong-counter';
    return 'extreme-advantage';
}

function newCounter() {
    return { attempts: 0, battles: 0, wins: 0, losses: 0, simultaneousDraws: 0, maxTime: 0, failures: 0 };
}

function addResult(counter, result, deckId) {
    counter.attempts++;
    counter.battles++;
    if (result.endReason === 'decisive') {
        if (result.winnerDeckId === deckId) counter.wins++;
        else counter.losses++;
    } else if (result.endReason === 'simultaneous-draw') counter.simultaneousDraws++;
    else if (result.endReason === 'max-time') counter.maxTime++;
}

function addFailure(counter) {
    counter.attempts++;
    counter.failures++;
}

function finalizeCounter(counter) {
    const normalBattles = counter.wins + counter.losses + counter.simultaneousDraws;
    const decisiveBattles = counter.wins + counter.losses;
    const scorePoints = counter.wins + counter.simultaneousDraws * 0.5;
    return {
        ...counter,
        normalBattles,
        decisiveBattles,
        scoreRate: normalBattles ? scorePoints / normalBattles : null,
        decisiveWinRate: decisiveBattles ? counter.wins / decisiveBattles : null,
        scoreRate95: wilsonInterval(scorePoints, normalBattles),
        simultaneousDrawRate: counter.attempts ? counter.simultaneousDraws / counter.attempts : 0,
        maxTimeRate: counter.attempts ? counter.maxTime / counter.attempts : 0,
        failureRate: counter.attempts ? counter.failures / counter.attempts : 0
    };
}

function standardDeviation(values) {
    const mean = average(values);
    return mean === null ? null : Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

export function judgeInternalDeck(stats, target = { min: 0.45, max: 0.55 }) {
    const rates = (stats.opponentRates || stats.opponents?.map(row => row.scoreRate) || []).filter(Number.isFinite);
    if (!Number.isFinite(stats.scoreRate)) return 'insufficient-data';
    const favorableRatio = rates.length ? rates.filter(rate => rate > 0.55).length / rates.length : 0;
    const weakRatio = rates.length ? rates.filter(rate => rate < 0.45).length / rates.length : 0;
    const highWinRatio = rates.length ? rates.filter(rate => rate >= 0.70).length / rates.length : 0;
    const advantageRatio = rates.length ? rates.filter(rate => rate > 0.50).length / rates.length : 0;
    const noClearWeakness = rates.every(rate => rate >= 0.40);

    if (stats.scoreRate >= 0.625 || highWinRatio >= 0.5 || (advantageRatio >= 0.8 && noClearWeakness)) {
        return 'severe-overperformance';
    }
    if (stats.scoreRate >= 0.575 && stats.scoreRate95?.lower > 0.525 && favorableRatio >= 0.6) {
        return 'overperformance-candidate';
    }
    if (stats.scoreRate <= 0.425 && stats.scoreRate95?.upper < 0.475 && weakRatio >= 0.6) {
        return 'underperformance-candidate';
    }
    if (stats.scoreRate >= target.max || stats.scoreRate <= target.min) return 'observe';
    return 'normal-range';
}

export function calculateDeckInvestment(deck, data) {
    const checkpoint = data.checkpoints.find(entry => entry.id === deck.checkpointId);
    if (!checkpoint) throw new Error(`${deck.id}: 투자 비용 계산용 체크포인트가 없습니다.`);
    const requiredXp = Array.from({ length: checkpoint.boardLevel - 1 }, (_, index) => EXP_TABLE[index + 1] || 0)
        .reduce((sum, value) => sum + value, 0);
    const unitCosts = deck.units.map(entry => {
        const unit = unitById.get(entry.unitId);
        if (!unit) throw new Error(`${deck.id}: 투자 비용 계산용 유닛이 없습니다: ${entry.unitId}`);
        return { unitId: entry.unitId, tier: unit.tier, star: entry.star, copies: starCopies[entry.star], gold: unit.tier * starCopies[entry.star] };
    });
    const itemIds = deck.units.flatMap(unit => unit.items);
    const completedItemCount = itemIds.filter(itemId => itemById.get(itemId)?.type === 'combined').length;
    const baseItemCount = itemIds.length - completedItemCount;
    const entriesById = new Map(deck.units.map(unit => [unit.unitId, unit]));
    return {
        unitGoldCost: unitCosts.reduce((sum, unit) => sum + unit.gold, 0),
        unitCosts,
        requiredXp,
        paidXpGoldEquivalent: Math.ceil(requiredXp / 4) * 4,
        completedItemCount,
        baseItemEquivalentCount: completedItemCount * 2 + baseItemCount,
        roleItemCounts: Object.fromEntries(Object.entries(deck.roles).map(([role, unitId]) => [role, entriesById.get(unitId)?.items.length || 0])),
        itemIds,
        uniqueItemIds: [...new Set(itemIds)].sort()
    };
}

function createDeckRecord(league, deckId) {
    return {
        league,
        deckId,
        counter: newCounter(),
        durationTotal: 0,
        survivorTotal: 0,
        survivingHpTotal: 0,
        opponents: new Map(),
        placements: new Map()
    };
}

function resultPerspective(result, deckId) {
    const isDeckA = result.deckAId === deckId;
    const isPlayer = result.playerDeckId === deckId;
    return {
        opponentDeckId: isDeckA ? result.deckBId : result.deckAId,
        placement: isDeckA ? result.placementA : result.placementB,
        survivors: isPlayer ? result.survivingPlayers : result.survivingEnemies,
        survivingHp: isPlayer ? result.survivingPlayerHp : result.survivingEnemyHp
    };
}

function addDeckResult(record, result) {
    addResult(record.counter, result, record.deckId);
    const perspective = resultPerspective(result, record.deckId);
    record.durationTotal += result.endTick || 0;
    record.survivorTotal += perspective.survivors || 0;
    record.survivingHpTotal += perspective.survivingHp || 0;
    const opponent = record.opponents.get(perspective.opponentDeckId) || newCounter();
    addResult(opponent, result, record.deckId);
    record.opponents.set(perspective.opponentDeckId, opponent);
    const placement = record.placements.get(perspective.placement) || newCounter();
    addResult(placement, result, record.deckId);
    record.placements.set(perspective.placement, placement);
}

function addDeckFailure(record, failure) {
    addFailure(record.counter);
    const isDeckA = failure.deckAId === record.deckId;
    const opponentDeckId = isDeckA ? failure.deckBId : failure.deckAId;
    const placementId = isDeckA ? failure.placementA : failure.placementB;
    const opponent = record.opponents.get(opponentDeckId) || newCounter();
    addFailure(opponent);
    record.opponents.set(opponentDeckId, opponent);
    const placement = record.placements.get(placementId) || newCounter();
    addFailure(placement);
    record.placements.set(placementId, placement);
}

function finalizeDeckRecord(record, investment, target) {
    const totals = finalizeCounter(record.counter);
    const opponents = [...record.opponents].map(([opponentDeckId, counter]) => ({ opponentDeckId, ...finalizeCounter(counter) }));
    const placements = [...record.placements].map(([placement, counter]) => ({ placement, ...finalizeCounter(counter) }));
    const opponentRates = opponents.map(row => row.scoreRate).filter(Number.isFinite);
    const placementRates = placements.map(row => row.scoreRate).filter(Number.isFinite);
    const bestMatchup = opponents.filter(row => Number.isFinite(row.scoreRate)).sort((left, right) => right.scoreRate - left.scoreRate)[0] || null;
    const worstMatchup = opponents.filter(row => Number.isFinite(row.scoreRate)).sort((left, right) => left.scoreRate - right.scoreRate)[0] || null;
    const placementSensitivity = placementRates.length ? Math.max(...placementRates) - Math.min(...placementRates) : null;
    const finalized = {
        league: record.league,
        deckId: record.deckId,
        ...totals,
        averageSurvivingUnits: record.counter.battles ? record.survivorTotal / record.counter.battles : null,
        averageSurvivingHp: record.counter.battles ? record.survivingHpTotal / record.counter.battles : null,
        averageBattleTime: record.counter.battles ? record.durationTotal / record.counter.battles : null,
        opponents,
        placements,
        bestMatchup,
        worstMatchup,
        extremeWinMatchupCount: opponentRates.filter(rate => rate >= 0.90).length,
        extremeLossMatchupCount: opponentRates.filter(rate => rate <= 0.10).length,
        matchupPolarization: standardDeviation(opponentRates),
        placementSensitivity,
        placementWarning: placementSensitivity >= 0.20 ? '배치 의존 상성일 가능성' : null,
        favorableMatchupRatio: opponentRates.length ? opponentRates.filter(rate => rate > 0.55).length / opponentRates.length : null,
        investment
    };
    finalized.judgment = record.league.startsWith('internal:')
        ? judgeInternalDeck({ ...finalized, opponentRates }, target)
        : 'context-only';
    finalized.matchupShape = finalized.extremeWinMatchupCount || finalized.extremeLossMatchupCount ? 'extreme-polarized' : 'regular';
    return finalized;
}

function createMatchupRecord(league, deckAId, deckBId) {
    return { league, deckAId, deckBId, counter: newCounter(), placements: new Map() };
}

function addMatchupResult(record, result) {
    addResult(record.counter, result, record.deckAId);
    const key = `${result.placementA}|${result.placementB}`;
    const placement = record.placements.get(key) || newCounter();
    addResult(placement, result, record.deckAId);
    record.placements.set(key, placement);
}

function addMatchupFailure(record, failure) {
    addFailure(record.counter);
    const key = `${failure.placementA}|${failure.placementB}`;
    const placement = record.placements.get(key) || newCounter();
    addFailure(placement);
    record.placements.set(key, placement);
}

function finalizeMatchup(record) {
    const totals = finalizeCounter(record.counter);
    const placements = [...record.placements].map(([key, counter]) => {
        const [placementA, placementB] = key.split('|');
        return { placementA, placementB, ...finalizeCounter(counter) };
    });
    const placementRates = placements.map(row => row.scoreRate).filter(Number.isFinite);
    const classificationA = classifyExtremeMatchup(totals.scoreRate);
    return {
        league: record.league,
        deckAId: record.deckAId,
        deckBId: record.deckBId,
        ...totals,
        deckBScoreRate: Number.isFinite(totals.scoreRate) ? 1 - totals.scoreRate : null,
        classificationA,
        classificationB: classifyExtremeMatchup(Number.isFinite(totals.scoreRate) ? 1 - totals.scoreRate : null),
        extremeStatus: classificationA.startsWith('extreme-')
            ? totals.normalBattles >= 90 ? 'confirmed' : 'candidate'
            : 'not-extreme',
        placements,
        placementSensitivity: placementRates.length ? Math.max(...placementRates) - Math.min(...placementRates) : null
    };
}

function caseScore(result, deckId) {
    if (result.endReason === 'simultaneous-draw') return 0.5;
    if (result.endReason !== 'decisive') return null;
    return result.winnerDeckId === deckId ? 1 : 0;
}

function roleMetric(unit) {
    const metric = {};
    if (unit.roles.includes('dealer')) {
        metric.dealer = {
            teamDamageShare: unit.teamDamageShare,
            killParticipation: unit.killParticipation,
            firstSkillTick: unit.firstSkillTick,
            skillCasts: unit.skillCasts,
            damagePerSurvivalTick: unit.damagePerSurvivalTick
        };
    }
    if (unit.roles.includes('tank')) {
        metric.tank = {
            teamTankingShare: unit.teamTankingShare,
            effectiveDamageAbsorbed: unit.damageTaken,
            survivalTicks: unit.survivalTicks,
            enemySkillHits: unit.enemySkillHits,
            ccAppliedTicks: unit.ccAppliedTicks
        };
    }
    if (unit.roles.includes('support')) {
        metric.support = {
            healing: unit.healing,
            shielding: unit.shielding,
            ccAppliedTicks: unit.ccAppliedTicks,
            skillCasts: unit.skillCasts
        };
    }
    return metric;
}

function addUnitMetrics(groups, result) {
    for (const unit of result.unitMetrics || []) {
        if (unit.isSummon) continue;
        const key = `${result.league}|${unit.unitId}|${unit.star}`;
        const group = groups.get(key) || {
            league: result.league,
            unitId: unit.unitId,
            name: unit.name,
            star: unit.star,
            tier: unit.tier,
            roles: unit.roles,
            battles: 0,
            normalBattles: 0,
            scorePoints: 0,
            firstDeaths: 0,
            firstSkillTickTotal: 0,
            firstSkillTickCount: 0,
            sums: {
                damage: 0,
                damageTaken: 0,
                healing: 0,
                shielding: 0,
                skillCasts: 0,
                ccAppliedTicks: 0,
                kills: 0,
                killParticipation: 0,
                survivalTicks: 0,
                teamDamageShare: 0,
                teamTankingShare: 0,
                enemySkillHits: 0,
                damagePerSurvivalTick: 0
            }
        };
        group.battles++;
        const score = caseScore(result, unit.deckId);
        if (score !== null) {
            group.normalBattles++;
            group.scorePoints += score;
        }
        group.firstDeaths += Number(unit.firstDeath);
        if (Number.isFinite(unit.firstSkillTick)) {
            group.firstSkillTickTotal += unit.firstSkillTick;
            group.firstSkillTickCount++;
        }
        Object.keys(group.sums).forEach(metric => { group.sums[metric] += unit[metric] || 0; });
        groups.set(key, group);
    }
}

function finalizeUnitMetrics(groups) {
    return [...groups.values()].map(group => {
        const averages = Object.fromEntries(Object.entries(group.sums).map(([metric, sum]) => [`average${metric[0].toUpperCase()}${metric.slice(1)}`, sum / group.battles]));
        const representative = {
            roles: group.roles,
            teamDamageShare: averages.averageTeamDamageShare,
            teamTankingShare: averages.averageTeamTankingShare,
            killParticipation: averages.averageKillParticipation,
            firstSkillTick: group.firstSkillTickCount ? group.firstSkillTickTotal / group.firstSkillTickCount : null,
            skillCasts: averages.averageSkillCasts,
            damagePerSurvivalTick: averages.averageDamagePerSurvivalTick,
            damageTaken: averages.averageDamageTaken,
            survivalTicks: averages.averageSurvivalTicks,
            enemySkillHits: averages.averageEnemySkillHits,
            ccAppliedTicks: averages.averageCcAppliedTicks,
            healing: averages.averageHealing,
            shielding: averages.averageShielding
        };
        return {
            league: group.league,
            unitId: group.unitId,
            name: group.name,
            star: group.star,
            tier: group.tier,
            roles: group.roles,
            battles: group.battles,
            scoreRate: group.normalBattles ? group.scorePoints / group.normalBattles : null,
            scoreRate95: wilsonInterval(group.scorePoints, group.normalBattles),
            firstDeathRate: group.firstDeaths / group.battles,
            averageFirstSkillTick: representative.firstSkillTick,
            investmentGold: group.tier * starCopies[group.star],
            ...averages,
            roleMetrics: roleMetric(representative),
            interpretation: 'association-only'
        };
    });
}

const diagnosticKeys = ['totalDamage', 'totalHealing', 'totalShielding', 'unattributedDamage', 'unattributedHealing', 'unattributedShielding', 'unknownSourceEventCount'];

function createDiagnosticsTotals() {
    return Object.fromEntries(diagnosticKeys.map(key => [key, 0]));
}

function addDiagnostics(totals, result) {
    diagnosticKeys.forEach(key => { totals[key] += result.diagnostics?.[key] || 0; });
}

function finalizeDiagnostics(totals) {
    const unattributedDamageRate = totals.totalDamage ? totals.unattributedDamage / totals.totalDamage : 0;
    return { ...totals, unattributedDamageRate, warning: unattributedDamageRate > 0.01 ? '미귀속 피해가 전체 피해의 1%를 초과함' : null };
}

function createAssociationRecord(fields) {
    return { ...fields, counter: newCounter(), deckIds: new Set(), copies: 0 };
}

function finalizeAssociation(record) {
    return {
        ...Object.fromEntries(Object.entries(record).filter(([key]) => !['counter', 'deckIds'].includes(key))),
        ...finalizeCounter(record.counter),
        deckCount: record.deckIds.size,
        deckIds: [...record.deckIds].sort(),
        interpretation: 'association-only'
    };
}

function buildGrowthRows(deckRows, data, investments) {
    const rowsByDeck = new Map(deckRows
        .filter(row => row.league === `internal:${data.decks.find(deck => deck.id === row.deckId)?.strategyGroup}`)
        .map(row => [row.deckId, row]));
    const checkpoints = new Map(data.checkpoints.map(checkpoint => [checkpoint.id, checkpoint]));
    const decks = new Map(data.decks.map(deck => [deck.id, deck]));
    return data.decks.flatMap(child => {
        if (!child.parentDeckId) return [];
        const parent = decks.get(child.parentDeckId);
        const parentRow = rowsByDeck.get(child.parentDeckId);
        const childRow = rowsByDeck.get(child.id);
        if (!parent || !parentRow || !childRow) return [];
        const parentInvestment = investments.get(parent.id);
        const childInvestment = investments.get(child.id);
        const from = checkpoints.get(parent.checkpointId);
        const to = checkpoints.get(child.checkpointId);
        return [{
            parentDeckId: parent.id,
            childDeckId: child.id,
            fromCheckpoint: parent.checkpointId,
            toCheckpoint: child.checkpointId,
            fromLevel: from?.boardLevel ?? null,
            toLevel: to?.boardLevel ?? null,
            parentScoreRate: parentRow.scoreRate,
            childScoreRate: childRow.scoreRate,
            scoreRateDelta: Number.isFinite(parentRow.scoreRate) && Number.isFinite(childRow.scoreRate)
                ? childRow.scoreRate - parentRow.scoreRate
                : null,
            unitGoldCostDelta: childInvestment.unitGoldCost - parentInvestment.unitGoldCost,
            paidXpGoldEquivalentDelta: childInvestment.paidXpGoldEquivalent - parentInvestment.paidXpGoldEquivalent,
            completedItemCountDelta: childInvestment.completedItemCount - parentInvestment.completedItemCount,
            interpretation: 'checkpoint-association-only'
        }];
    });
}

function buildTargetWarnings(statistics, targetBands) {
    const warnings = [];
    const metrics = targetBands?.metrics || {};
    const warningMin = metrics.scoreRate?.warningMin ?? 0.40;
    const warningMax = metrics.scoreRate?.warningMax ?? 0.60;
    for (const row of statistics.decks.filter(deck => deck.league.startsWith('internal:'))) {
        if (Number.isFinite(row.scoreRate) && (row.scoreRate < warningMin || row.scoreRate > warningMax)) {
            warnings.push({ code: 'deck-score-band', league: row.league, deckId: row.deckId, value: row.scoreRate, min: warningMin, max: warningMax });
        }
        for (const [metric, limit] of [
            ['simultaneousDrawRate', metrics.simultaneousDrawRate?.max ?? 0.05],
            ['maxTimeRate', metrics.maxTimeRate?.max ?? 0.05],
            ['failureRate', metrics.failureRate?.max ?? 0]
        ]) {
            if (row[metric] > limit) warnings.push({ code: `deck-${metric}`, league: row.league, deckId: row.deckId, value: row[metric], max: limit });
        }
    }
    for (const row of statistics.matchups.filter(matchup => matchup.classificationA.startsWith('extreme-'))) {
        warnings.push({ code: 'extreme-matchup', league: row.league, deckAId: row.deckAId, deckBId: row.deckBId, value: row.scoreRate, status: row.extremeStatus });
    }
    if (statistics.diagnostics.warning) warnings.push({ code: 'diagnostics', message: statistics.diagnostics.warning });
    return warnings;
}

export function createBattleAggregator(data, targetBands) {
    const deckRecords = new Map();
    const matchupRecords = new Map();
    const unitGroups = new Map();
    const synergyRecords = new Map();
    const itemRecords = new Map();
    const diagnosticsTotals = createDiagnosticsTotals();
    const outcomes = { decisive: 0, simultaneousDraw: 0, maxTime: 0, failure: 0, invalidResult: 0 };
    const target = {
        min: targetBands?.metrics?.scoreRate?.targetMin ?? 0.45,
        max: targetBands?.metrics?.scoreRate?.targetMax ?? 0.55
    };
    const deckRecord = (league, deckId) => {
        const key = `${league}|${deckId}`;
        if (!deckRecords.has(key)) deckRecords.set(key, createDeckRecord(league, deckId));
        return deckRecords.get(key);
    };
    const matchupRecord = row => {
        const key = `${row.league}|${row.deckAId}|${row.deckBId}`;
        if (!matchupRecords.has(key)) matchupRecords.set(key, createMatchupRecord(row.league, row.deckAId, row.deckBId));
        return matchupRecords.get(key);
    };
    const investments = new Map(data.decks.map(deck => [deck.id, calculateDeckInvestment(deck, data)]));
    const synergiesByDeck = new Map(data.decks.map(deck => [deck.id, activeSynergies(deck)]));

    const addSuccessfulResult = result => {
        if (!validEndReasons.has(result?.endReason)) {
            outcomes.invalidResult++;
            return;
        }
        if (result.endReason === 'decisive') outcomes.decisive++;
        else if (result.endReason === 'simultaneous-draw') outcomes.simultaneousDraw++;
        else outcomes.maxTime++;
        addDeckResult(deckRecord(result.league, result.deckAId), result);
        addDeckResult(deckRecord(result.league, result.deckBId), result);
        addMatchupResult(matchupRecord(result), result);
        addUnitMetrics(unitGroups, result);
        addDiagnostics(diagnosticsTotals, result);

        for (const side of ['deckA', 'deckB']) {
            const deckId = result[`${side}Id`];
            for (const synergy of synergiesByDeck.get(deckId) || []) {
                const key = `${result.league}|${synergy.type}|${synergy.name}|${synergy.level}`;
                const record = synergyRecords.get(key) || createAssociationRecord({ league: result.league, ...synergy });
                addResult(record.counter, result, deckId);
                record.deckIds.add(deckId);
                record.copies++;
                synergyRecords.set(key, record);
            }
            const itemCounts = new Map();
            for (const itemId of result.configurations?.[side]?.units?.flatMap(unit => unit.items || []) || []) {
                itemCounts.set(itemId, (itemCounts.get(itemId) || 0) + 1);
            }
            for (const [itemId, copies] of itemCounts) {
                const key = `${result.league}|${itemId}`;
                const item = itemById.get(itemId);
                const record = itemRecords.get(key) || createAssociationRecord({
                    league: result.league,
                    itemId,
                    name: item?.name || itemId,
                    itemType: item?.type || null
                });
                addResult(record.counter, result, deckId);
                record.deckIds.add(deckId);
                record.copies += copies;
                itemRecords.set(key, record);
            }
        }
    };

    const addFailedResult = failure => {
        outcomes.failure++;
        if (!failure.deckAId || !failure.deckBId) return;
        addDeckFailure(deckRecord(failure.league, failure.deckAId), failure);
        addDeckFailure(deckRecord(failure.league, failure.deckBId), failure);
        addMatchupFailure(matchupRecord(failure), failure);
    };

    return {
        addResult: addSuccessfulResult,
        addFailure: addFailedResult,
        finalize() {
            const decks = [...deckRecords.values()].map(record => finalizeDeckRecord(record, investments.get(record.deckId), target));
            const statistics = {
                definitions: {
                    scoreRate: '(wins + 0.5 × simultaneous draws) / normally completed battles',
                    decisiveWinRate: 'wins / (wins + losses)',
                    matchupPolarization: 'population standard deviation of opponent scoreRate',
                    placementSensitivity: 'maximum minus minimum placement scoreRate',
                    associationMetrics: '같은 덱에 포함된 시너지·아이템과 전투 결과의 연관 통계',
                    growth: '서로 다른 체크포인트 내부 리그 결과의 연관 비교'
                },
                outcomes: { ...outcomes },
                decks,
                matchups: [...matchupRecords.values()].map(finalizeMatchup),
                units: finalizeUnitMetrics(unitGroups),
                synergies: [...synergyRecords.values()].map(finalizeAssociation)
                    .sort((left, right) => `${left.league}|${left.type}|${left.name}|${left.level}`.localeCompare(`${right.league}|${right.type}|${right.name}|${right.level}`)),
                items: [...itemRecords.values()].map(finalizeAssociation)
                    .sort((left, right) => `${left.league}|${left.itemId}`.localeCompare(`${right.league}|${right.itemId}`)),
                diagnostics: finalizeDiagnostics(diagnosticsTotals),
                deckInvestments: [...investments].map(([deckId, investment]) => ({ deckId, ...investment })),
                knownDeckCount: data.decks.length
            };
            statistics.growth = buildGrowthRows(decks, data, investments);
            statistics.warnings = buildTargetWarnings(statistics, targetBands);
            return statistics;
        }
    };
}

export function aggregateBattleResults(results, failures, data, targetBands) {
    const aggregator = createBattleAggregator(data, targetBands);
    results.forEach(aggregator.addResult);
    failures.forEach(aggregator.addFailure);
    return aggregator.finalize();
}

function activeSynergies(deck) {
    const board = deck.units.map(entry => unitById.get(entry.unitId)).filter(Boolean);
    const counts = getSynergyData(board);
    return Object.entries(counts).flatMap(([type, names]) => Object.entries(names).flatMap(([name, count]) => {
        const definition = SYNERGIES[type]?.[name];
        if (!definition) return [];
        const level = getActiveSynergyLevel(count, Object.keys(definition.levels), definition.exactMatch);
        return level ? [{ type, name, level }] : [];
    })).sort((left, right) => `${left.type}:${left.name}`.localeCompare(`${right.type}:${right.name}`));
}

export function createUnitReplacement(deck, fromUnitId, toUnitId) {
    const index = deck.units.findIndex(unit => unit.unitId === fromUnitId);
    if (index < 0) throw new Error(`${deck.id}: 교체할 유닛이 없습니다: ${fromUnitId}`);
    if (deck.units.some(unit => unit.unitId === toUnitId)) throw new Error(`${deck.id}: 대체 유닛이 이미 덱에 있습니다: ${toUnitId}`);
    const from = unitById.get(fromUnitId);
    const to = unitById.get(toUnitId);
    if (!from || !to) throw new Error('유닛 교체 실험에 미등록 유닛이 있습니다.');
    if (from.tier !== to.tier || !from.role.some(role => to.role.includes(role))) {
        throw new Error('대체 유닛은 같은 코스트이며 역할 하나 이상이 같아야 합니다.');
    }

    const before = activeSynergies(deck);
    const variant = structuredClone(deck);
    variant.units[index].unitId = toUnitId;
    Object.keys(variant.roles).forEach(role => {
        if (variant.roles[role] === fromUnitId) variant.roles[role] = toUnitId;
    });
    const after = activeSynergies(variant);
    variant.expectedSynergies = after;
    const synergyChanged = JSON.stringify(before) !== JSON.stringify(after);
    return {
        deck: variant,
        intervention: {
            fromUnitId,
            toUnitId,
            tier: from.tier,
            sharedRoles: from.role.filter(role => to.role.includes(role)),
            beforeSynergies: before,
            afterSynergies: after,
            synergyChanged,
            warning: synergyChanged ? '유닛 본체 효과와 시너지 변화가 혼합됨' : null
        }
    };
}

function meanInterval(values) {
    const mean = average(values);
    if (values.length < 2) return { lower: null, upper: null, sampleSize: values.length };
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
    const margin = 1.96 * Math.sqrt(variance / values.length);
    return { lower: Math.max(-1, mean - margin), upper: Math.min(1, mean + margin), sampleSize: values.length };
}

export function analyzePairedExperiment({ controlResults, variantResults, deckId, kind = 'unit-replacement', synergyChanged = false }) {
    const variants = new Map(variantResults.map(result => [result.caseId, result]));
    const pairs = controlResults.flatMap(control => {
        const variant = variants.get(control.caseId);
        if (!variant) return [];
        const controlScore = caseScore(control, deckId);
        const variantScore = caseScore(variant, deckId);
        return controlScore === null || variantScore === null ? [] : [{ caseId: control.caseId, controlScore, variantScore, difference: variantScore - controlScore }];
    });
    const differences = pairs.map(pair => pair.difference);
    const scoreRateDelta = average(differences);
    const delta95 = meanInterval(differences);
    return {
        kind,
        deckId,
        pairedCaseCount: pairs.length,
        controlScoreRate: average(pairs.map(pair => pair.controlScore)),
        variantScoreRate: average(pairs.map(pair => pair.variantScore)),
        scoreRateDelta,
        delta95,
        pairedDifferences: differences,
        synergyChanged,
        interpretation: synergyChanged ? 'mixed-unit-and-synergy-effect' : 'controlled-unit-effect',
        confirmedPositive: delta95.lower !== null && delta95.lower > 0
    };
}

export function assessSynergyExperiments(experiments) {
    const skeletonIds = new Set(experiments.map(experiment => experiment.skeletonId).filter(Boolean));
    const differences = experiments.flatMap(experiment => experiment.pairedDifferences || []);
    const averageDelta = average(experiments.map(experiment => experiment.scoreRateDelta).filter(Number.isFinite));
    const delta95 = meanInterval(differences);
    const consistentPositive = experiments.length > 0 && experiments.every(experiment => experiment.scoreRateDelta > 0);
    let judgment = 'insufficient-evidence';
    if (skeletonIds.size >= 3 && consistentPositive && delta95.lower > 0) {
        if (averageDelta >= 0.12) judgment = 'severe-overperformance-candidate';
        else if (averageDelta >= 0.07) judgment = 'overperformance-candidate';
    }
    return { skeletonCount: skeletonIds.size, experimentCount: experiments.length, averageScoreRateDelta: averageDelta, delta95, consistentPositive, judgment };
}
