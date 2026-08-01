import assert from 'node:assert/strict';
import test from 'node:test';

import { applyCrammingReward, runProgressionBenchmark } from '../scripts/balance-simulator/analyze-stage15.mjs';

test('Stage15는 벼락치기 보상을 7레벨 도달 시 한 번만 지급한다', () => {
    const opponent = { id: 'test', level: 6, gold: 10 };
    const pending = new Set(['test']);
    assert.equal(applyCrammingReward(opponent, pending), false);
    opponent.level = 7;
    assert.equal(applyCrammingReward(opponent, pending), true);
    assert.equal(opponent.gold, 50);
    assert.equal(applyCrammingReward(opponent, pending), false);
    assert.equal(opponent.gold, 50);
});

test('Stage15 수능 만점자는 4-1 시점의 동일 시드 기준보다 레벨을 앞당긴다', () => {
    const result = runProgressionBenchmark({ seedCount: 1, lastRound: 16 });
    const row = result.effects.find(value => value.scenario === 'p1' && value.strategy === 'all' && value.round === 16);
    assert.ok(row.levelDelta > 0);
    assert.ok(row.fiveCostUnitsDelta >= 0);
});
