import assert from 'node:assert/strict';
import test from 'node:test';

import { createUnitInstance } from '../js/battle/combatPreparation.js';
import { createInitialState } from '../js/core/GameState.js';
import { UNIT_POOL } from '../js/data.js';
import { ITEMS } from '../js/items.js';
import { SynergyManager } from '../js/systems/SynergyManager.js';
import { runItemBenchmark } from '../scripts/balance-simulator/analyze-stage12.mjs';

test('Stage12 아이템 풀리그는 같은 셸에서 아이템과 진영만 교대한다', () => {
    const result = runItemBenchmark({
        repetitions: 1,
        profileNames: ['ad'],
        itemIds: ['comb_ad_ad', 'comb_hp_hp'],
        maxTicks: 600
    });

    assert.equal(result.battleCount, 6);
    assert.equal(result.rows.length, 3);
    assert.ok(result.rows.every(row => row.battles === 4 && row.scoreRate95.sampleSize === 4));
    assert.equal(result.summary.profiles.find(profile => profile.profile === 'ad').top.length, 2);
});

test('완성 아이템의 사거리·주문력 증폭·최대 마나 스탯을 공용 경로가 적용한다', () => {
    const source = UNIT_POOL.find(unit => unit.id === 'u3_5');
    const base = createUnitInstance(source, {
        itemIds: ['comb_as_as', 'comb_ap_ap', 'comb_mana_mana'],
        random: () => 0.5
    });
    const manager = new SynergyManager({ state: createInitialState(), ITEMS });
    const [prepared] = manager.applySynergyStats(
        [base],
        { subjects: {}, clubs: {} },
        false,
        () => 0.5
    );

    assert.equal(prepared.stats.range, source.stats.range + 1);
    assert.equal(prepared.stats.as, source.stats.as * 1.4);
    assert.equal(prepared.stats.ap, (source.stats.ap + 50) * 1.2);
    assert.equal(prepared.stats.maxMana, source.stats.maxMana - 10);
});
