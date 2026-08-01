import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { SYNERGIES, UNIT_POOL } from '../js/data.js';
import {
    selectSynergyEffectCases,
    selectSynergyInterventions,
    summarizeSynergyPremiums,
    summarizeUnitCostBands
} from '../scripts/balance-simulator/analyze-stage11.mjs';
import { suppressSynergyCounts, suppressUnitTrait } from '../scripts/balance-simulator/run-battle-case.mjs';

test('코스트 밴드는 역할별 중앙값의 상승 경향을 판정한다', () => {
    const rows = ['dealer', 'tank', 'support'].flatMap(role => [1, 2, 3, 4, 5].map(tier => ({
        unitId: `${role}-${tier}`,
        role,
        tier,
        scoreRate: tier / 10
    })));
    const result = summarizeUnitCostBands(rows);
    assert.equal(result.allRolesMonotonic, true);
    assert.deepEqual(result.roles[0].adjacentMedianDeltas.map(row => row.delta), [0.1, 0.1, 0.1, 0.1]);
});

test('시너지 교체 후보는 같은 코스트·공유 역할을 보존하고 활성 시너지 하나만 제거한다', () => {
    const data = JSON.parse(fs.readFileSync(new URL('../balance/standard-decks.json', import.meta.url), 'utf8'));
    const scores = UNIT_POOL.flatMap(unit => unit.role.map(role => ({ unitId: unit.id, role, scoreRate: unit.tier / 10 })));
    const interventions = selectSynergyInterventions(data, scores);
    assert.ok(interventions.length >= 30);
    for (const selected of interventions) {
        const from = UNIT_POOL.find(unit => unit.id === selected.intervention.fromUnitId);
        const to = UNIT_POOL.find(unit => unit.id === selected.intervention.toUnitId);
        assert.equal(from.tier, to.tier);
        assert.ok(from.role.some(role => to.role.includes(role)));
        assert.equal(selected.intervention.beforeSynergies.length - selected.intervention.afterSynergies.length, 1);
    }
});

test('시너지 프리미엄은 서로 다른 덱 계열 3개부터 근거를 인정한다', () => {
    const experiments = ['a', 'b', 'c'].map(skeletonId => ({
        removedSynergy: 'subjects:과학:2',
        skeletonId,
        synergyPremium: 0.1,
        premiumDifferences: [0, 0.2, 0.1, 0.1]
    }));
    const result = summarizeSynergyPremiums(experiments);
    assert.equal(result.supportedSynergyCount, 1);
    assert.equal(result.synergies[0].judgment, '유의미');
});

test('시너지 평균은 전투 수가 아니라 덱 계열을 같은 비중으로 집계한다', () => {
    const result = summarizeSynergyPremiums([
        { removedSynergy: 'subjects:수학:2', skeletonId: 'a', synergyPremium: 1, premiumDifferences: [1, 1, 1, 1] },
        { removedSynergy: 'subjects:수학:2', skeletonId: 'b', synergyPremium: 0, premiumDifferences: [0] },
        { removedSynergy: 'subjects:수학:2', skeletonId: 'c', synergyPremium: 0, premiumDifferences: [0] }
    ]);
    assert.equal(result.synergies[0].meanPremium, 0.3333);
    assert.equal(result.synergies[0].premium95.sampleSize, 3);
});

test('기물 자체 점수 차이가 큰 시너지 교체는 판정 근거에서 제외한다', () => {
    const result = summarizeSynergyPremiums([
        { removedSynergy: 'clubs:방송부:3', skeletonId: 'a', intrinsicGap: 0.2, synergyPremium: -0.5, premiumDifferences: [-0.5] },
        { removedSynergy: 'clubs:방송부:3', skeletonId: 'b', intrinsicGap: 0.2, synergyPremium: -0.5, premiumDifferences: [-0.5] },
        { removedSynergy: 'clubs:방송부:3', skeletonId: 'c', intrinsicGap: 0.05, synergyPremium: 0, premiumDifferences: [0] }
    ]);
    assert.equal(result.synergies[0].matchedExperimentCount, 1);
    assert.equal(result.synergies[0].judgment, '근거 부족');
    assert.equal(result.synergies[0].meanPremium, 0);
});

test('시너지 효과 제거는 입력을 보존하고 지정한 시너지 개수만 지운다', () => {
    const input = { subjects: { 과학: 2 }, clubs: { 방송부: 3, 급식부: 3 } };
    const result = suppressSynergyCounts(input, { type: 'clubs', name: '방송부' });
    assert.deepEqual(result, { subjects: { 과학: 2 }, clubs: { 급식부: 3 } });
    assert.equal(input.clubs.방송부, 3);
});

test('전투 엔진이 다시 세는 시너지 태그도 복제본에서만 제거한다', () => {
    const board = [{ id: 'a', subject: '창체', club: ['방송부', '급식부'] }];
    const withoutSubject = suppressUnitTrait(board, { type: 'subjects', name: '창체' });
    const withoutClub = suppressUnitTrait(board, { type: 'clubs', name: '방송부' });
    assert.equal(withoutSubject[0].subject, null);
    assert.deepEqual(withoutClub[0].club, ['급식부']);
    assert.equal(board[0].subject, '창체');
    assert.deepEqual(board[0].club, ['방송부', '급식부']);
});

test('순수 시너지 효과 실험은 경제부를 제외하고 덱 계열별 대표를 제한한다', () => {
    const data = JSON.parse(fs.readFileSync(new URL('../balance/standard-decks.json', import.meta.url), 'utf8'));
    const cases = selectSynergyEffectCases(data, 3);
    assert.ok(cases.length > 20);
    assert.ok(cases.every(entry => entry.synergy.name !== '경제부'));
    const counts = new Map();
    for (const entry of cases) {
        const key = `${entry.synergy.type}:${entry.synergy.name}:${entry.synergy.level}`;
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    assert.ok([...counts.values()].every(count => count <= 3));
});

test('Stage11에서 기각한 수치 실험은 기존 계약으로 복원한다', () => {
    assert.equal(SYNERGIES.subjects.도덕.levels[4].teamDef, 20);
});
