import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../js/core/GameState.js';
import { AUGMENTS, UNIT_POOL } from '../js/data.js';
import { EventBus } from '../js/core/EventBus.js';
import { AugmentManager } from '../js/systems/AugmentManager.js';
import { ItemManager } from '../js/systems/ItemManager.js';
import { SaveManager, SAVE_KEY, SAVE_PHASES, SAVE_VERSION } from '../js/systems/SaveManager.js';
import { UnitManager } from '../js/systems/UnitManager.js';

class MemoryStorage {
    constructor() { this.values = new Map(); this.failWrites = false; }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) {
        if (this.failWrites) throw new Error('quota');
        this.values.set(key, String(value));
    }
    removeItem(key) { this.values.delete(key); }
}

function unit(id = 'u1_1') {
    const value = structuredClone(UNIT_POOL.find(candidate => candidate.id === id));
    value.star = 1;
    value.items = [];
    value.stats.maxHp = value.stats.hp;
    return value;
}

test('저장 데이터는 버전·실행 ID·단계를 포함하고 임시 전투 상태를 제외한다', () => {
    const storage = new MemoryStorage();
    const app = { state: createInitialState() };
    app.state.gold = 42;
    app.state.augments = [{ ...AUGMENTS.silver[0], tier: 'silver' }];
    app.state.board[0] = unit();
    app.state.board[0].combat = { temporary: true };
    app.state.dpsStats = { 24: { damage: 100 } };
    const manager = new SaveManager(app, storage);

    assert.equal(manager.save(SAVE_PHASES.NEXT_ROUND_READY), true);
    const saved = JSON.parse(storage.getItem(SAVE_KEY));
    assert.equal(saved.metadata.saveVersion, SAVE_VERSION);
    assert.equal(saved.metadata.runId, app.state.runId);
    assert.equal(saved.metadata.runSeed, app.state.runSeed);
    assert.ok(saved.metadata.savedAt > 0);
    assert.equal(saved.metadata.currentPhase, SAVE_PHASES.NEXT_ROUND_READY);
    assert.deepEqual(saved.state.augments, ['s1']);
    assert.equal(saved.state.dpsStats, undefined);
    assert.equal(saved.state.board[0].combat, undefined);

    const restoredApp = { state: createInitialState() };
    const restoredManager = new SaveManager(restoredApp, storage);
    assert.ok(restoredManager.load());
    assert.equal(restoredApp.state.gold, 42);
    assert.equal(restoredApp.state.augments[0].id, 's1');
    assert.ok(restoredApp.state.augments[0].effect);
});

test('미완료 거래는 적용 전 상태로 복구되고 완료 거래는 중복 적용되지 않는다', () => {
    const storage = new MemoryStorage();
    const app = { state: createInitialState() };
    const manager = new SaveManager(app, storage);
    app.state.gold = 10;
    assert.equal(manager.beginTransaction('battle:1'), true);
    app.state.gold += 50;

    const recoveredApp = { state: createInitialState() };
    const recovered = new SaveManager(recoveredApp, storage);
    recovered.load();
    assert.equal(recoveredApp.state.gold, 10);
    assert.equal(recovered.metadata.pendingTransactionId, undefined);
    assert.equal(recovered.metadata.currentPhase, SAVE_PHASES.BATTLE_FINISHED);

    assert.equal(recovered.runTransaction('battle:1', () => { recoveredApp.state.gold += 7; }), true);
    assert.equal(recovered.runTransaction('battle:1', () => { recoveredApp.state.gold += 7; }), false);
    assert.equal(recoveredApp.state.gold, 17);

    const reloadedApp = { state: createInitialState() };
    const reloaded = new SaveManager(reloadedApp, storage);
    reloaded.load();
    assert.equal(reloadedApp.state.gold, 17);
    assert.equal(reloaded.runTransaction('battle:1', () => { reloadedApp.state.gold += 7; }), false);
});

test('거래 완료 저장이 실패하면 메모리 상태도 적용 전으로 되돌린다', () => {
    const storage = new MemoryStorage();
    const app = { state: createInitialState() };
    const manager = new SaveManager(app, storage);
    app.state.gold = 10;
    assert.equal(manager.beginTransaction('reward:quota'), true);
    app.state.gold = 100;
    storage.failWrites = true;
    assert.equal(manager.commitTransaction('reward:quota'), false);
    assert.equal(app.state.gold, 10);
    assert.equal(manager.metadata.pendingTransactionId, undefined);
});

test('구버전·부분 손상 저장은 마이그레이션하고 파싱 불가 저장은 안전하게 폐기한다', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
        gold: 33,
        hp: 88,
        stage: [2, 3],
        globalBuffs: { teamHp: 15 },
        augments: ['s4']
    }));
    const legacyApp = { state: createInitialState() };
    const legacy = new SaveManager(legacyApp, storage);
    legacy.load();
    assert.equal(legacy.metadata.saveVersion, SAVE_VERSION);
    assert.equal(legacyApp.state.gold, 33);
    assert.deepEqual(legacyApp.state.stage, [2, 3]);
    assert.equal(legacyApp.state.globalBuffs.teamHp, 15);
    assert.equal(legacyApp.state.augments[0].id, 's4');

    storage.setItem(SAVE_KEY, JSON.stringify({ metadata: { saveVersion: 1 }, state: { gold: '깨짐', board: '깨짐', globalBuffs: { teamHp: 9 } } }));
    const partialApp = { state: createInitialState() };
    new SaveManager(partialApp, storage).load();
    assert.equal(partialApp.state.gold, 10);
    assert.equal(partialApp.state.board.length, 24);
    assert.equal(partialApp.state.globalBuffs.teamHp, 9);

    storage.setItem(SAVE_KEY, '{not-json');
    const brokenApp = { state: createInitialState() };
    assert.equal(new SaveManager(brokenApp, storage).load(), null);
    assert.equal(storage.getItem(SAVE_KEY), null);
});

test('가득 찬 인벤토리와 대기석의 보상은 대기열에 남았다가 빈칸에 적용된다', () => {
    const app = {
        state: createInitialState(),
        ITEMS: [],
        renderUnits() {},
        calculateSynergy() {},
        soundManager: { playSFX() {} }
    };
    const itemManager = new ItemManager(app);
    itemManager.renderInventory = () => {};
    const unitManager = new UnitManager(app);
    unitManager.renderUnits = () => {};

    app.state.inventory.fill('base_ad');
    assert.equal(itemManager.addItemToInventory('base_as'), false);
    app.state.bench.fill(unit());
    assert.equal(unitManager.addToBench(unit('u2_1')), false);
    assert.deepEqual(app.state.pendingRewards.map(reward => reward.type), ['item', 'unit']);

    app.state.inventory[0] = null;
    itemManager.flushPendingRewards();
    assert.equal(app.state.inventory[0], 'base_as');
    app.state.bench[0] = null;
    unitManager.flushPendingUnitRewards();
    assert.equal(app.state.bench[0].id, 'u2_1');
    assert.equal(app.state.pendingRewards.length, 0);
});

test('같은 단계의 증강체 보상은 다른 카드를 연속 클릭해도 한 번만 적용된다', () => {
    const storage = new MemoryStorage();
    const app = {
        state: createInitialState(),
        AUGMENTS,
        UNIT_POOL,
        eventBus: new EventBus(),
        updateHeader() {},
        addExp() {},
        addToBench() { return true; },
        itemManager: { giveRandomBaseItem() {}, giveRandomCombinedItem() {} }
    };
    app.saveManager = new SaveManager(app, storage);
    const manager = new AugmentManager(app);
    assert.equal(manager.applyAugment(AUGMENTS.silver[3]), true);
    assert.equal(manager.applyAugment(AUGMENTS.silver[4]), false);
    assert.equal(app.state.augments.length, 1);
    assert.equal(app.state.globalBuffs.teamHp, 150);
    manager.dispose();
});
