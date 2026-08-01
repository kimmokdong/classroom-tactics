import test from 'node:test';
import assert from 'node:assert/strict';

import { COMPOSITION_PATHS } from '../js/enemyAi.js';
import { aggregateBattles, BALANCE_PRESETS, runBattleCase } from '../scripts/run_balance_experiment.mjs';

test('p12는 보건부 6 미만에서 전투에 영향을 주지 않는다', () => {
    const options = {
        playerComposition: COMPOSITION_PATHS.find(value => value.id === 'welfare'),
        enemyComposition: COMPOSITION_PATHS.find(value => value.id === 'science'),
        preset: BALANCE_PRESETS[1], pattern: 'standard', swapped: false, seed: 'p12-inactive'
    };
    const baseline = runBattleCase(options);
    const augmented = runBattleCase({ ...options, playerAugments: ['p12'] });
    assert.deepEqual(augmented.units, baseline.units);
    assert.equal(augmented.winner, baseline.winner);
});

test('밸런스 실험은 동일 시드를 재현하고 전투 과정 지표를 집계한다', () => {
    const options = {
        playerComposition: COMPOSITION_PATHS[0],
        enemyComposition: COMPOSITION_PATHS[1],
        preset: BALANCE_PRESETS[1],
        pattern: 'standard',
        swapped: false,
        seed: 'balance-regression'
    };
    const first = runBattleCase(options);
    const second = runBattleCase(options);
    assert.deepEqual(first, second);
    assert.ok(first.durationTicks > 0);
    assert.ok(first.firstDeathTick > 0);
    assert.ok(first.units.some(unit => unit.damage > 0));
    assert.ok(first.units.some(unit => unit.damageTaken > 0));
    assert.ok(first.units.some(unit => unit.skillCasts > 0));
    assert.equal(first.unattributedDamage, 0);

    const aggregates = aggregateBattles([first]);
    for (const category of ['units', 'compositions', 'synergies', 'augments', 'items', 'matchups', 'strengthTiers', 'growth']) {
        assert.ok(aggregates[category].length > 0, `${category} 집계가 비어 있습니다.`);
    }
    assert.ok(aggregates.units.every(row => Number.isFinite(row.contributionPerCost)));
    assert.ok(aggregates.distributions.duration.p50 > 0);
});
