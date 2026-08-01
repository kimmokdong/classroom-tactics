import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateBoard, pearsonCorrelation } from '../js/ai/BoardEvaluator.js';
import { SYNERGIES, UNIT_POOL } from '../js/data.js';
import { getActiveSynergyLevel } from '../js/systems/SynergyManager.js';

function unit(id, star = 1, items = []) {
    const value = structuredClone(UNIT_POOL.find(candidate => candidate.id === id));
    value.star = star;
    value.items = items;
    if (star >= 2) { value.stats.hp *= 1.8; value.stats.ad *= 1.5; }
    if (star === 3) { value.stats.hp *= 1.8; value.stats.ad *= 1.5; }
    value.stats.maxHp = value.stats.hp;
    return value;
}

function board(entries) {
    const result = Array(24).fill(null);
    entries.forEach(([index, value]) => { result[index] = value; });
    return result;
}

test('동일한 보드는 항상 같은 점수와 세부 근거를 반환한다', () => {
    const value = board([[0, unit('u1_1')], [16, unit('u1_2')], [17, unit('u1_8')]]);
    assert.deepEqual(evaluateBoard(value, { debug: true }), evaluateBoard(value, { debug: true }));
    assert.ok(evaluateBoard(value, { debug: true }).details.units.length === 3);
});

test('별 등급·시너지·역할 공백이 가격 이외의 점수 차이를 만든다', () => {
    const twoStarLowCost = board([[16, unit('u4_2', 2)]]);
    const oneStarHighCost = board([[16, unit('u5_1', 1)]]);
    assert.ok(evaluateBoard(twoStarLowCost).score > evaluateBoard(oneStarHighCost).score);

    const activeSynergy = board([[0, unit('u1_1')], [1, unit('u1_10')]]);
    const synergyResult = evaluateBoard(activeSynergy, { debug: true });
    assert.ok(synergyResult.details.synergies.some(synergy => synergy.name === '도덕' && synergy.level === 2 && synergy.score > 0));
    const strongerSynergy = structuredClone(SYNERGIES);
    strongerSynergy.subjects['도덕'].levels[2].teamDef = 1000;
    assert.ok(evaluateBoard(activeSynergy, { synergies: strongerSynergy }).breakdown.synergies > synergyResult.breakdown.synergies);
    assert.equal(getActiveSynergyLevel(1, Object.keys(SYNERGIES.subjects['사회'].levels), true), 1);
    assert.equal(getActiveSynergyLevel(2, Object.keys(SYNERGIES.subjects['사회'].levels), true), 0);

    const dealersOnly = board([[16, unit('u1_2')], [17, unit('u1_3')]]);
    const balanced = board([[0, unit('u1_10')], [16, unit('u1_2')]]);
    assert.ok(evaluateBoard(balanced).breakdown.roles > evaluateBoard(dealersOnly).breakdown.roles);
});

test('아이템 역할 적합도와 앞·뒷줄 배치를 구분한다', () => {
    const fitted = board([[16, unit('u4_2', 1, ['comb_as_as'])]]);
    const mismatched = board([[16, unit('u4_2', 1, ['comb_armor_armor'])]]);
    assert.ok(evaluateBoard(fitted).breakdown.items > evaluateBoard(mismatched).breakdown.items);

    const tankFront = board([[0, unit('u4_9')]]);
    const tankBack = board([[16, unit('u4_9')]]);
    assert.ok(evaluateBoard(tankFront).breakdown.placement > evaluateBoard(tankBack).breakdown.placement);
    assert.ok(evaluateBoard(tankBack, { frontRow: 2 }).breakdown.placement > evaluateBoard(tankBack).breakdown.placement);
});

test('벤치의 합성 가능성과 이전 보드의 전환 비용을 반영한다', () => {
    const current = board([[0, unit('u1_1')]]);
    const nearUpgrade = evaluateBoard(current, { bench: [unit('u1_1')] });
    assert.ok(nearUpgrade.breakdown.upgrades > 0);

    const previous = board([[0, unit('u4_1')], [16, unit('u4_2')]]);
    assert.ok(evaluateBoard(current, { previousBoard: previous }).breakdown.transition < 0);
});

test('평가 점수와 실제 결과 비교용 피어슨 상관계수를 계산한다', () => {
    assert.equal(pearsonCorrelation([[1, 1], [2, 2], [3, 3]]), 1);
    assert.equal(pearsonCorrelation([[1, 3], [2, 2], [3, 1]]), -1);
});
