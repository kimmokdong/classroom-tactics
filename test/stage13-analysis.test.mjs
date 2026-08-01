import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import { AUGMENTS, UNIT_POOL } from '../js/data.js';
import {
    annotateCrossDeckComparison,
    analyzeEconomicAugments,
    eligibleDeckIds,
    runAugmentBenchmark,
    validateAugmentBalanceConfig
} from '../scripts/balance-simulator/analyze-stage13.mjs';

const config = JSON.parse(fs.readFileSync('balance/augment-balance.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('balance/standard-decks.json', 'utf8'));

test('Stage13 분류는 현재 48종을 중복 없이 모두 포함한다', () => {
    const result = validateAugmentBalanceConfig(config, AUGMENTS);
    assert.equal(result.augmentCount, 48);
    assert.deepEqual(result.counts, {
        combat: { silver: 7, gold: 7, prismatic: 4 },
        economic: { silver: 8, gold: 8, prismatic: 7 },
        synergy: { silver: 0, gold: 0, prismatic: 7 }
    });
});

test('시너지 전용 증강체는 조건을 충족한 덱만 적격으로 선택한다', () => {
    assert.deepEqual(eligibleDeckIds(data, config, 'p13'), [
        'broadcast-vertical-standard-core8',
        'broadcast-vertical-standard-final9'
    ]);
    assert.deepEqual(eligibleDeckIds(data, config, 'p22'), ['cafeteria-vertical-highvalue-final9']);
});

test('원거리 특수 증강체는 원거리 유닛이 3분의 2 이상인 덱만 평가한다', () => {
    const ids = eligibleDeckIds(data, config, 'p10');
    assert.ok(ids.length > 0);
    for (const id of ids) {
        const deck = data.decks.find(candidate => candidate.id === id);
        const ranged = deck.units.filter(entry => {
            const unit = UNIT_POOL.find(candidate => candidate.id === entry.unitId);
            return (unit.stats.range || 1) >= 2;
        }).length;
        assert.ok(ranged / deck.units.length >= config.eligibility.p10.value);
    }
});

test('전투형 증강체는 같은 표준 덱 case의 무증강 결과와 대응 비교한다', () => {
    const result = runAugmentBenchmark({
        data,
        config,
        augmentIds: ['s13'],
        representativeDeckIds: ['arts-reroll-final8', 'prank-reroll-final8'],
        repetitions: 1,
        placements: ['standard']
    });
    assert.equal(result.battleCount, 4);
    assert.equal(result.rows[0].casePairs, 2);
    assert.equal(result.rows[0].battles, 4);
    assert.equal(result.rows[0].eligibleDeckIds.length, 2);
});

test('통합 덱은 같은 등급 중앙값과 비교하고 덱·증강체 원인을 분리한다', () => {
    const rows = [
        { rarity: 'gold', evaluationMode: 'universal', baselineScoreRate: 0.40, augmentScoreRate: 0.50, upliftPp: 10 },
        { rarity: 'gold', evaluationMode: 'universal', baselineScoreRate: 0.50, augmentScoreRate: 0.60, upliftPp: 10 },
        { rarity: 'gold', evaluationMode: 'universal', baselineScoreRate: 0.65, augmentScoreRate: 0.80, upliftPp: 15 },
        { rarity: 'gold', evaluationMode: 'conditional', baselineScoreRate: 0.10, augmentScoreRate: 1, upliftPp: 90 }
    ];
    annotateCrossDeckComparison(rows, config);
    assert.equal(rows[1].crossDeck.deviationPp, 0);
    assert.equal(rows[2].crossDeck.baselineDeviationPp, 15);
    assert.equal(rows[2].crossDeck.upliftDeviationPp, 5);
    assert.equal(rows[2].crossDeck.judgment, '일시정지');
    assert.equal(rows[3].crossDeck, undefined);
});

test('경제형 23종은 계약 기반 표준 가치 또는 별도 지표를 가진다', () => {
    const rows = analyzeEconomicAugments(config, data);
    assert.equal(rows.length, 23);
    assert.equal(rows.find(row => row.augmentId === 's11').value, 8);
    assert.equal(rows.find(row => row.augmentId === 'g6').value, 14);
    assert.equal(rows.find(row => row.augmentId === 'p11').value, 30);
    assert.equal(rows.find(row => row.augmentId === 'p4').value, 36);
    assert.equal(rows.find(row => row.augmentId === 's1').metric, 'hpSaved');
    assert.equal(rows.find(row => row.augmentId === 'g1').metric, 'shopTierPointsPerRefresh');
    assert.equal(rows.find(row => row.augmentId === 's6').judgment, '높은 편');
    assert.equal(rows.find(row => row.augmentId === 's10').judgment, '상황 의존');
    assert.equal(rows.find(row => row.augmentId === 'g10').value, 24);
    assert.equal(rows.find(row => row.augmentId === 'g10').judgment, '높은 편');
    assert.equal(rows.find(row => row.augmentId === 'p1').judgment, '범위');
    assert.equal(rows.find(row => row.augmentId === 'p4').judgment, '범위');
});
