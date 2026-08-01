import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateBoard } from '../js/ai/BoardEvaluator.js';
import { createInitialState } from '../js/core/GameState.js';
import { generateEnemyBoard } from '../js/enemyAi.js';
import { UNIT_POOL } from '../js/data.js';
import { SaveManager } from '../js/systems/SaveManager.js';

class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
}

function setRound(state, round) {
    state.stage = [Math.floor((round - 1) / 5) + 1, (round - 1) % 5 + 1];
}

function advance(state, lastRound) {
    const encounters = [];
    for (let round = 1; round <= lastRound; round++) {
        setRound(state, round);
        encounters.push({ id: generateEnemyBoard(state), opponentId: state.opponentLobby.currentOpponentId });
    }
    return encounters;
}

test('동일 시드는 상대 성장·매칭을 재현하고 플레이어 보드를 직접 읽지 않는다', () => {
    const first = createInitialState();
    const second = createInitialState();
    first.runSeed = second.runSeed = 'opponent-seed';
    second.board[0] = structuredClone(UNIT_POOL.at(-1));

    const firstEncounters = advance(first, 12);
    const secondEncounters = advance(second, 12);
    assert.deepEqual(firstEncounters, secondEncounters);
    assert.deepEqual(first.opponentLobby, second.opponentLobby);

    const ids = firstEncounters.map(encounter => encounter.opponentId);
    ids.forEach((id, index) => assert.ok(!ids.slice(Math.max(0, index - 2), index).includes(id)));
    const before = structuredClone(first.opponentLobby);
    const repeated = generateEnemyBoard(first);
    assert.deepEqual(first.opponentLobby, before);
    assert.deepEqual(repeated, firstEncounters.at(-1).id);
});

test('가상 로비는 2약·3보통·2강 분포와 서로 다른 리롤·레벨업 성장을 유지한다', () => {
    const state = createInitialState();
    state.runSeed = 12345;
    advance(state, 31);
    const opponents = state.opponentLobby.opponents;
    const tierCount = tier => opponents.filter(opponent => opponent.profile.strengthTier === tier).length;
    assert.deepEqual([tierCount('weak'), tierCount('normal'), tierCount('strong')], [2, 3, 2]);

    opponents.forEach(opponent => {
        assert.ok(opponent.gold >= 0);
        assert.ok(opponent.board.filter(Boolean).length <= opponent.level);
        assert.ok(opponent.board.filter(Boolean).every(unit => UNIT_POOL.some(template => template.id === unit.id)));
        if (opponent.profile.strategy !== 'reroll') assert.ok(opponent.board.filter(Boolean).every(unit => unit.star < 3));
    });

    const reroll = opponents.find(opponent => opponent.profile.strategy === 'reroll');
    const fastLevel = opponents.find(opponent => opponent.profile.strategy === 'fastLevel');
    assert.ok(reroll.level < fastLevel.level);
    assert.ok(reroll.board.some(Boolean) && fastLevel.board.some(Boolean));
    const average = tier => {
        const group = opponents.filter(opponent => opponent.profile.strengthTier === tier);
        return group.reduce((sum, opponent) => sum + evaluateBoard(opponent.board, { frontRow: 2 }).score, 0) / group.length;
    };
    assert.ok(average('strong') > average('weak'));
    assert.ok(opponents.every(opponent => opponent.transitionState === 'final'));
});

test('가상 상대의 경제·상점 시드·덱 전환 상태와 지연된 성과 보정이 저장 후 복원된다', () => {
    const storage = new MemoryStorage();
    const state = createInitialState();
    state.runSeed = 'save-opponents';
    for (let round = 1; round <= 8; round++) {
        if (round > 1) state.recentBattleResults.push({ round: round - 1, result: 'player' });
        setRound(state, round);
        generateEnemyBoard(state);
    }
    assert.equal(state.opponentLobby.playerAdjustment, 0.05);

    const app = { state };
    const manager = new SaveManager(app, storage);
    assert.equal(manager.save(), true);
    const restoredApp = { state: createInitialState() };
    assert.ok(new SaveManager(restoredApp, storage).load());
    assert.deepEqual(restoredApp.state.opponentLobby, state.opponentLobby);
    assert.deepEqual(restoredApp.state.recentBattleResults, state.recentBattleResults);
});
