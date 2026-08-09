import test from 'node:test';
import assert from 'node:assert/strict';

import { BattleEngine, createSeededRandom } from '../js/battleEngine.js';
import { createUnitInstance, prepareBattle } from '../js/battle/combatPreparation.js';
import { createInitialState } from '../js/core/GameState.js';
import { UNIT_POOL } from '../js/data.js';
import { ITEMS } from '../js/items.js';
import {
    generatePveBoard,
    getNextStage,
    getPveEncounter,
    getPveRewardPlan,
    isPveStage
} from '../js/pveRounds.js';
import { SynergyManager } from '../js/systems/SynergyManager.js';

const template = id => UNIT_POOL.find(unit => unit.id === id);
const PLAYER_POSITIONS = [2, 5, 17, 20, 0, 7, 16, 23];

function buildPlayerBoard(ids, itemSets = {}) {
    const board = Array(24).fill(null);
    ids.forEach((id, index) => {
        board[PLAYER_POSITIONS[index]] = createUnitInstance(template(id), {
            teamRole: 'player',
            itemIds: itemSets[index] || []
        });
    });
    return board;
}

function runPve(playerBoard, stage, seed) {
    const state = createInitialState();
    const manager = new SynergyManager({ state, ITEMS });
    const random = createSeededRandom(seed);
    const prepared = prepareBattle({
        player: { board: playerBoard, teamRole: 'player', applyPlayerOnlyBonuses: false },
        opponent: { board: generatePveBoard(stage, { includeOpening: true }), teamRole: 'opponent' },
        applySynergyStats: manager.applySynergyStats.bind(manager),
        random
    });
    const logs = new BattleEngine(prepared.playerBoard, prepared.enemyBoard, [], 0, seed).run();
    return logs.findLast(log => log.type === 'end');
}

function runPveLogs(playerBoard, stage, seed) {
    const state = createInitialState();
    const manager = new SynergyManager({ state, ITEMS });
    const prepared = prepareBattle({
        player: { board: playerBoard, teamRole: 'player', applyPlayerOnlyBonuses: false },
        opponent: { board: generatePveBoard(stage, { includeOpening: true }), teamRole: 'opponent' },
        applySynergyStats: manager.applySynergyStats.bind(manager),
        random: createSeededRandom(seed)
    });
    return new BattleEngine(prepared.playerBoard, prepared.enemyBoard, [], 0, seed).run();
}

function winRate(boardFactory, stage, samples = 20) {
    let wins = 0;
    for (let index = 0; index < samples; index++) {
        if (runPve(boardFactory(), stage, `pve:${stage.join('-')}:${index}`).winner === 'player') wins++;
    }
    return wins / samples;
}

test('멀티 준비전과 이후 x-5만 PVE로 분류하고 1-3 뒤 2-1로 이동한다', () => {
    assert.equal(isPveStage([1, 1]), false);
    assert.equal(isPveStage([1, 1], { includeOpening: true }), true);
    assert.equal(isPveStage([2, 1], { includeOpening: true }), false);
    assert.equal(isPveStage([3, 5]), true);
    assert.deepEqual(getNextStage([1, 3], { skipOpeningRounds: true }), [2, 1]);
    assert.deepEqual(getNextStage([1, 3]), [1, 4]);
    assert.deepEqual(getNextStage([2, 5]), [3, 1]);
});

test('PVE 보상은 결과와 무관하게 정해진 조각 가치를 유지한다', () => {
    const intro = getPveRewardPlan([1, 2], () => 0, { includeOpening: true });
    const earlyExam = getPveRewardPlan([3, 5], () => 0);
    const lateComponents = getPveRewardPlan([4, 5], () => 0);
    const lateCompleted = getPveRewardPlan([4, 5], () => 0.99);
    assert.equal(intro.componentValue, 1);
    assert.equal(earlyExam.componentValue, 2);
    assert.equal(lateComponents.componentValue, 2);
    assert.equal(lateCompleted.componentValue, 2);
    assert.deepEqual([lateComponents.baseItems, lateComponents.combinedItems], [2, 0]);
    assert.deepEqual([lateCompleted.baseItems, lateCompleted.combinedItems], [0, 1]);
});

test('각 PVE 편성은 24칸 적 보드와 고유 몬스터 정보를 만든다', () => {
    for (const stage of [[1, 1], [1, 2], [1, 3], [2, 5], [6, 5]]) {
        const board = generatePveBoard(stage, { includeOpening: true });
        assert.equal(board.length, 24);
        assert.ok(board.some(Boolean));
        board.filter(Boolean).forEach(unit => {
            assert.equal(unit.isPveMonster, true);
            assert.equal(unit.isEnemy, true);
            assert.equal(unit.stats.maxHp, unit.stats.hp);
        });
        assert.ok(getPveEncounter(stage, { includeOpening: true })?.name);
    }
});

test('1-1은 모든 1코스트 1성 유닛이 단독으로 100% 클리어한다', () => {
    const oneCosts = UNIT_POOL.filter(unit => unit.tier === 1);
    for (const unit of oneCosts) {
        const rate = winRate(() => buildPlayerBoard([unit.id]), [1, 1], 12);
        assert.equal(rate, 1, `${unit.name}의 1-1 승률이 ${rate * 100}%입니다.`);
    }
});

test('1-2는 약한 1코스트 2인 배치도 안정적으로 클리어한다', () => {
    const rate = winRate(() => buildPlayerBoard(['u1_4', 'u1_8']), [1, 2], 20);
    assert.equal(rate, 1);
});

test('1-3은 최약체 단독 배치로는 실패하지만 정상적인 3인 배치는 안정적으로 클리어한다', () => {
    const weakestSolo = winRate(() => buildPlayerBoard(['u1_8']), [1, 3], 20);
    const filledBoard = winRate(() => buildPlayerBoard(['u1_1', 'u1_4', 'u1_8']), [1, 3], 20);
    assert.equal(weakestSolo, 0);
    assert.ok(filledBoard >= 0.9, `3인 배치의 1-3 승률이 ${filledBoard * 100}%입니다.`);
});

test('후반 PVE는 정상 빌드업은 안정적으로 통과하고 부실한 1코 보드는 4-5 이후 위험하다', () => {
    const naturalIds = ['u1_1', 'u2_2', 'u2_10', 'u3_1', 'u3_9', 'u4_1', 'u5_4', 'u4_9'];
    const expectedSizes = { 2: 4, 3: 5, 4: 6, 5: 7, 6: 8 };
    for (const world of [2, 3, 4, 5, 6]) {
        const count = expectedSizes[world];
        const itemSets = {
            0: ['comb_armor_hp'],
            [count - 1]: world >= 4 ? ['comb_ad_as', 'comb_ad_crit'] : ['comb_ad_as']
        };
        const rate = winRate(
            () => buildPlayerBoard(naturalIds.slice(0, count), itemSets),
            [world, 5],
            16
        );
        assert.ok(rate >= 0.9, `${world}-5 정상 빌드업 승률이 ${rate * 100}%입니다.`);
    }

    const junkIds = ['u1_1', 'u1_3', 'u1_4', 'u1_5', 'u1_8'];
    const junkRates = [4, 5, 6].map(world => winRate(() => buildPlayerBoard(junkIds), [world, 5], 16));
    assert.ok(junkRates.every(rate => rate <= 0.5), `부실 보드 승률이 ${junkRates.map(rate => `${rate * 100}%`).join(', ')}입니다.`);
});

test('초반 준비전에는 예고 패턴이 없고 2-5부터 피할 수 있는 특수 패턴이 등장한다', () => {
    const player = buildPlayerBoard(['u1_1', 'u2_2', 'u2_10', 'u3_1']);
    const openingLogs = runPveLogs(player, [1, 3], 'opening-pattern-check');
    const examLogs = runPveLogs(player, [2, 5], 'exam-pattern-check');
    assert.equal(openingLogs.some(log => log.type === 'pve_warning'), false);
    assert.ok(examLogs.some(log => log.type === 'pve_warning' && log.pattern === 'front_slam'));
    assert.ok(examLogs.some(log => log.type === 'pve_resolve' && log.pattern === 'front_slam'));
});

test('6-5의 감독 드론 둘은 서로 다른 시점에 표식을 예고하고 같은 시드는 같은 칸을 고른다', () => {
    const player = buildPlayerBoard(['u1_1', 'u2_2', 'u2_10', 'u3_1', 'u3_9', 'u4_1', 'u5_4', 'u4_9']);
    const first = runPveLogs(player, [6, 5], 'staggered-pattern');
    const second = runPveLogs(player, [6, 5], 'staggered-pattern');
    const selectWarnings = logs => logs
        .filter(log => log.type === 'pve_warning' && log.pattern === 'marked_blast')
        .map(log => ({ tick: log.tick, source: log.sourceUnitId, targets: log.targets }));
    const ticks = [...new Set(selectWarnings(first).map(log => log.tick))];
    assert.ok(ticks.length >= 2);
    assert.deepEqual(selectWarnings(first), selectWarnings(second));
});
