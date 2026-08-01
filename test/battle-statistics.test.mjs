import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { BattleEngine } from '../js/battleEngine.js';
import { UNIT_POOL } from '../js/data.js';
import {
    aggregateBattleResults,
    analyzePairedExperiment,
    assessSynergyExperiments,
    calculateDeckInvestment,
    classifyExtremeMatchup,
    createBattleAggregator,
    createUnitReplacement,
    judgeInternalDeck,
    wilsonInterval
} from '../scripts/balance-simulator/aggregate-battle-results.mjs';
import { createCaseSuite } from '../scripts/balance-simulator/create-case-suite.mjs';
import { runBattleCase } from '../scripts/balance-simulator/run-battle-case.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../balance/standard-decks.json', import.meta.url), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(new URL('../balance/simulation-profiles.json', import.meta.url), 'utf8')).profiles;
const targetBands = JSON.parse(fs.readFileSync(new URL('../balance/target-bands.json', import.meta.url), 'utf8'));
const decksById = new Map(data.decks.map(deck => [deck.id, deck]));
const [deckA, deckB] = data.decks.filter(deck => deck.strategyGroup === 'reroll_core7');

function battleUnit(id, overrides = {}) {
    const value = structuredClone(UNIT_POOL.find(candidate => candidate.id === id));
    value.star = 1;
    value.items = [];
    value.skill = null;
    value.instanceId = `test:${id}`;
    value.stats.maxHp = value.stats.hp;
    value.combat = { shield: 0, bonusMana: 0, startMana: 0, itemEffects: {} };
    Object.assign(value.stats, overrides);
    value.stats.maxHp = overrides.maxHp ?? overrides.hp ?? value.stats.maxHp;
    return value;
}

function makeEngine(playerUnit, enemyUnit, maxTicks = 1) {
    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    if (playerUnit) player[0] = playerUnit;
    if (enemyUnit) enemy[0] = enemyUnit;
    const engine = new BattleEngine(player, enemy, [], 0, 'stage-5-test');
    engine.maxTicks = maxTicks;
    return engine;
}

function syntheticResult({
    caseId,
    league = 'internal:reroll_core7',
    endReason = 'decisive',
    winnerDeckId = deckA.id,
    placementA = 'front',
    placementB = 'front',
    unitMetrics = [],
    diagnostics = {}
}) {
    return {
        caseId,
        league,
        deckAId: deckA.id,
        deckBId: deckB.id,
        playerDeckId: deckA.id,
        winnerDeckId,
        endReason,
        endTick: 10,
        placementA,
        placementB,
        survivingPlayers: winnerDeckId === deckA.id ? 2 : 0,
        survivingEnemies: winnerDeckId === deckB.id ? 2 : 0,
        survivingPlayerHp: winnerDeckId === deckA.id ? 500 : 0,
        survivingEnemyHp: winnerDeckId === deckB.id ? 500 : 0,
        unitMetrics,
        diagnostics
    };
}

test('전투 종료는 동시 전멸·최대 시간·마지막 틱 승부를 구분한다', () => {
    const emptyLogs = makeEngine(null, null).run();
    assert.deepEqual(emptyLogs.at(-1), {
        tick: 0,
        type: 'end',
        winner: 'draw',
        endReason: 'simultaneous-draw',
        survivingPlayers: 0,
        survivingEnemies: 0,
        survivingPlayerHp: 0,
        survivingEnemyHp: 0,
        team: null
    });

    const durable = { hp: 1_000_000, maxHp: 1_000_000, ad: 0, as: 10, range: 8, maxMana: 999 };
    const maxTimeLogs = makeEngine(battleUnit('u1_1', durable), battleUnit('u1_2', durable)).run();
    assert.equal(maxTimeLogs.at(-1).winner, 'draw');
    assert.equal(maxTimeLogs.at(-1).endReason, 'max-time');

    const finisher = battleUnit('u1_1', { ad: 1_000_000, as: 10, range: 8, maxMana: 999 });
    const victim = battleUnit('u1_2', { hp: 1, maxHp: 1, ad: 0, as: 10, range: 8, maxMana: 999 });
    const decisiveLogs = makeEngine(finisher, victim, 11).run();
    assert.equal(decisiveLogs.at(-1).tick, 11);
    assert.equal(decisiveLogs.at(-1).winner, 'player');
    assert.equal(decisiveLogs.at(-1).endReason, 'decisive');
});

test('공격·보호막·군중 제어 로그는 출처와 대상을 식별한다', () => {
    const player = battleUnit('u1_1', { hp: 10_000, maxHp: 10_000, ad: 1, range: 8 });
    const enemy = battleUnit('u1_2', { hp: 10_000, maxHp: 10_000, ad: 1, range: 8 });
    const engine = makeEngine(player, enemy, 11);
    const source = engine.board[24];
    const target = engine.board[0];
    engine.addBuff(target, 'stun', null, 0, 2, source.gridIndex);
    engine.addBuff(source, 'shield', 'shield', 100, 2, source.gridIndex);
    const logs = engine.run();

    const attack = logs.find(log => log.type === 'attack');
    const cc = logs.find(log => log.type === 'cc');
    const shield = logs.find(log => log.type === 'shield');
    assert.equal(attack.sourceUnitId, attack.from === 24 ? 'u1_1' : 'u1_2');
    assert.ok(attack.sourceInstanceId && attack.targetInstanceId);
    assert.deepEqual(
        [cc.sourceUnitId, cc.targetUnitId, cc.sourceType],
        ['u1_1', 'u1_2', 'unit']
    );
    assert.deepEqual(
        [shield.sourceUnitId, shield.targetUnitId, shield.amount],
        ['u1_1', 'u1_1', 100]
    );
});

test('실제 case는 역할별 유닛 지표와 귀속 불명 피해 진단을 만든다', () => {
    const battleCase = createCaseSuite(data, profiles.smoke)[0];
    const result = runBattleCase(battleCase, { decksById });
    assert.ok(['decisive', 'simultaneous-draw', 'max-time'].includes(result.endReason));
    assert.ok(result.unitMetrics.length >= 2);
    assert.ok(result.unitMetrics.some(unit => unit.roles.length > 0));
    assert.ok(result.unitMetrics.every(unit => Number.isFinite(unit.survivalTicks)));
    assert.ok(result.diagnostics.totalDamage >= result.diagnostics.unattributedDamage);
    assert.equal(result.diagnostics.warning, null);

    const online = createBattleAggregator(data, targetBands);
    online.addResult(result);
    const onlineStatistics = online.finalize();
    assert.deepEqual(onlineStatistics, aggregateBattleResults([result], [], data, targetBands));
    assert.ok(onlineStatistics.synergies.length > 0);
    assert.ok(onlineStatistics.items.length > 0);
    assert.ok(onlineStatistics.items.every(item => item.interpretation === 'association-only'));
});

test('core→final 체크포인트는 투자량과 scoreRate 성장 행을 만든다', () => {
    const child = data.decks.find(deck => deck.parentDeckId);
    const parent = data.decks.find(deck => deck.id === child.parentDeckId);
    const cases = createCaseSuite(data, profiles.smoke);
    const parentCase = cases.find(row => row.league === `internal:${parent.strategyGroup}`
        && [row.deckAId, row.deckBId].includes(parent.id));
    const childCase = cases.find(row => row.league === `internal:${child.strategyGroup}`
        && [row.deckAId, row.deckBId].includes(child.id));
    const statistics = aggregateBattleResults([
        runBattleCase(parentCase, { decksById }),
        runBattleCase(childCase, { decksById })
    ], [], data, targetBands);
    const growth = statistics.growth.find(row => row.parentDeckId === parent.id && row.childDeckId === child.id);

    assert.ok(growth);
    assert.equal(growth.fromLevel + 1, growth.toLevel);
    assert.ok(Number.isFinite(growth.unitGoldCostDelta));
    assert.equal(growth.interpretation, 'checkpoint-association-only');
});

test('무승부는 양쪽 패배가 아니며 최대 시간·실패와 별도로 집계한다', () => {
    const roleUnit = {
        unitId: 'u1_1', name: '표본', star: 1, tier: 1, deckId: deckA.id, isSummon: false,
        roles: ['dealer', 'tank'], damage: 100, damageTaken: 80, healing: 0, shielding: 0,
        skillCasts: 2, firstSkillTick: 7, ccAppliedTicks: 3, enemySkillHits: 4, kills: 1,
        killParticipation: 0.5, survivalTicks: 10, damagePerSurvivalTick: 10,
        teamDamageShare: 0.4, teamTankingShare: 0.3, firstDeath: false
    };
    const results = [
        syntheticResult({ caseId: 'win', placementA: 'front', unitMetrics: [roleUnit], diagnostics: { totalDamage: 100, unattributedDamage: 2 } }),
        syntheticResult({ caseId: 'loss', winnerDeckId: deckB.id, placementA: 'back' }),
        syntheticResult({ caseId: 'draw', endReason: 'simultaneous-draw', winnerDeckId: null, placementA: 'middle' }),
        syntheticResult({ caseId: 'timeout', endReason: 'max-time', winnerDeckId: null, placementA: 'middle' })
    ];
    const failures = [{
        caseId: 'failure', league: 'internal:reroll_core7', deckAId: deckA.id, deckBId: deckB.id,
        placementA: 'front', placementB: 'back'
    }];
    const statistics = aggregateBattleResults(results, failures, data, targetBands);
    const deck = statistics.decks.find(row => row.deckId === deckA.id);
    const unit = statistics.units.find(row => row.unitId === 'u1_1');

    assert.deepEqual(statistics.outcomes, { decisive: 2, simultaneousDraw: 1, maxTime: 1, failure: 1, invalidResult: 0 });
    assert.equal(deck.normalBattles, 3);
    assert.equal(deck.decisiveBattles, 2);
    assert.equal(deck.scoreRate, 0.5);
    assert.equal(deck.decisiveWinRate, 0.5);
    assert.equal(deck.simultaneousDrawRate, 0.2);
    assert.equal(deck.maxTimeRate, 0.2);
    assert.equal(deck.failureRate, 0.2);
    assert.equal(deck.scoreRate95.sampleSize, 3);
    assert.equal(deck.placementWarning !== null, true);
    assert.equal(unit.averageFirstSkillTick, 7);
    assert.equal(unit.roleMetrics.tank.enemySkillHits, 4);
    assert.equal(unit.interpretation, 'association-only');
    assert.equal(statistics.diagnostics.unattributedDamageRate, 0.02);
    assert.ok(statistics.diagnostics.warning);
    assert.ok(statistics.warnings.length > 0);
});

test('95% 구간·내부 리그 판정·극단 상성은 명시된 임계값을 따른다', () => {
    assert.deepEqual(wilsonInterval(0, 0), { lower: null, upper: null, sampleSize: 0 });
    const interval = wilsonInterval(60, 100);
    assert.equal(interval.sampleSize, 100);
    assert.ok(interval.lower < 0.6 && interval.upper > 0.6);
    assert.equal(judgeInternalDeck({ scoreRate: 0.63, opponentRates: [0.5] }), 'severe-overperformance');
    assert.equal(judgeInternalDeck({ scoreRate: 0.58, scoreRate95: { lower: 0.53 }, opponentRates: [0.6, 0.6, 0.6, 0.4] }), 'overperformance-candidate');
    assert.equal(judgeInternalDeck({ scoreRate: 0.4, scoreRate95: { upper: 0.46 }, opponentRates: [0.4, 0.4, 0.4, 0.5] }), 'underperformance-candidate');
    assert.equal(judgeInternalDeck({ scoreRate: 0.56, scoreRate95: { lower: 0.5 }, opponentRates: [0.5] }), 'observe');
    assert.equal(classifyExtremeMatchup(0.05), 'extreme-disadvantage');
    assert.equal(classifyExtremeMatchup(0.2), 'strongly-countered');
    assert.equal(classifyExtremeMatchup(0.5), 'balanced');
    assert.equal(classifyExtremeMatchup(0.8), 'strong-counter');
    assert.equal(classifyExtremeMatchup(0.95), 'extreme-advantage');

    const crossResults = Array.from({ length: 90 }, (_, index) => syntheticResult({ caseId: `extreme-${index}`, league: 'cross:level8' }));
    const cross = aggregateBattleResults(crossResults, [], data, targetBands);
    assert.equal(cross.matchups[0].extremeStatus, 'confirmed');
    assert.ok(cross.decks.every(row => row.judgment === 'context-only'));
});

test('덱 투자 비용은 별 등급 복제 수·구매 경험치·아이템을 분리한다', () => {
    const investment = calculateDeckInvestment(data.decks[0], data);
    assert.equal(investment.requiredXp, 74);
    assert.equal(investment.paidXpGoldEquivalent, 76);
    assert.equal(investment.completedItemCount, 6);
    assert.equal(investment.baseItemEquivalentCount, 12);
    assert.equal(investment.unitGoldCost, investment.unitCosts.reduce((sum, unit) => sum + unit.tier * unit.copies, 0));
    assert.deepEqual(investment.roleItemCounts, { mainTank: 3, mainDealer: 3, subDealer: 0 });
});

test('유닛 교체는 동일 코스트·공유 역할만 허용하고 나머지 조건을 보존한다', () => {
    let fixture;
    for (const deck of data.decks) {
        const selected = new Set(deck.units.map(unit => unit.unitId));
        for (const entry of deck.units) {
            const from = UNIT_POOL.find(unit => unit.id === entry.unitId);
            const to = UNIT_POOL.find(unit => !selected.has(unit.id)
                && unit.tier === from.tier
                && unit.role.some(role => from.role.includes(role)));
            if (to) {
                fixture = { deck, entry, to };
                break;
            }
        }
        if (fixture) break;
    }
    assert.ok(fixture);

    const original = structuredClone(fixture.entry);
    const replacement = createUnitReplacement(fixture.deck, fixture.entry.unitId, fixture.to.id);
    const changed = replacement.deck.units.find(unit => unit.unitId === fixture.to.id);
    assert.deepEqual({ star: changed.star, items: changed.items, position: changed.position }, {
        star: original.star,
        items: original.items,
        position: original.position
    });
    assert.equal(replacement.intervention.tier, fixture.to.tier);
    assert.ok(replacement.intervention.sharedRoles.length > 0);
    assert.equal(Boolean(replacement.intervention.warning), replacement.intervention.synergyChanged);
    assert.equal(fixture.deck.units.some(unit => unit.unitId === fixture.to.id), false);
});

test('대응 case 통제 실험은 유닛 효과와 시너지 효과를 분리해 판정한다', () => {
    const controlResults = Array.from({ length: 4 }, (_, index) => ({
        caseId: `pair-${index}`, endReason: 'decisive', winnerDeckId: deckB.id
    }));
    const variantResults = controlResults.map(result => ({
        ...result, winnerDeckId: deckA.id
    }));
    const replacement = analyzePairedExperiment({ controlResults, variantResults, deckId: deckA.id });
    assert.equal(replacement.pairedCaseCount, 4);
    assert.equal(replacement.scoreRateDelta, 1);
    assert.equal(replacement.confirmedPositive, true);
    assert.equal(replacement.interpretation, 'controlled-unit-effect');

    const candidate = assessSynergyExperiments(['a', 'b', 'c'].map(skeletonId => ({
        skeletonId, scoreRateDelta: 0.08, pairedDifferences: [0.08, 0.08]
    })));
    const severe = assessSynergyExperiments(['a', 'b', 'c'].map(skeletonId => ({
        skeletonId, scoreRateDelta: 0.13, pairedDifferences: [0.13, 0.13]
    })));
    assert.equal(candidate.judgment, 'overperformance-candidate');
    assert.equal(severe.judgment, 'severe-overperformance-candidate');
});
