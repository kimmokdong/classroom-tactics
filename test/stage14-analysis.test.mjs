import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { runItemAugmentBenchmark, withCoreItems } from '../scripts/balance-simulator/analyze-stage14.mjs';

const config = JSON.parse(fs.readFileSync('balance/augment-balance.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('balance/standard-decks.json', 'utf8'));

test('Stage14는 같은 전투 조건에서 아이템과 증강체의 4상태를 비교한다', () => {
    const source = data.decks.find(deck => deck.id === 'arts-reroll-final8');
    assert.ok(source.units.some(unit => unit.items.length));
    assert.ok(withCoreItems(source).units.every(unit => unit.items.length <= 2));

    const result = runItemAugmentBenchmark({
        data,
        config,
        augmentIds: ['s13'],
        representativeDeckIds: ['arts-reroll-final8', 'prank-reroll-final8'],
        repetitions: 1,
        placements: ['standard']
    });

    assert.equal(result.battleCount, 8);
    assert.equal(result.rows[0].casePairs, 2);
    assert.equal(result.rows[0].battles, 8);
    assert.ok(Number.isFinite(result.rows[0].interactionPp));
});
