import test from 'node:test';
import assert from 'node:assert/strict';

import { UNIT_POOL } from '../js/data.js';
import { createInitialState } from '../js/core/GameState.js';
import { UnitManager } from '../js/systems/UnitManager.js';

function createUnit(id = 'u1_1') {
    const unit = structuredClone(UNIT_POOL.find(candidate => candidate.id === id));
    unit.star = 1;
    unit.items = [];
    return unit;
}

function createManager() {
    const returnedItems = [];
    const app = {
        state: createInitialState(),
        itemManager: { addItemToInventory: id => returnedItems.push(id) },
        soundManager: { playSFX() {} },
        updateHeader() {},
        calculateSynergy() {},
        clearInteractionSelection() {},
        showFeedback() {}
    };
    const manager = new UnitManager(app);
    manager.renderUnits = () => {};
    return { app, manager, returnedItems };
}

function dropEvent(data) {
    let prevented = false;
    let stopped = false;
    return {
        dataTransfer: { getData: key => data[key] ?? '' },
        preventDefault: () => { prevented = true; },
        stopPropagation: () => { stopped = true; },
        get prevented() { return prevented; },
        get stopped() { return stopped; }
    };
}

test('보드와 대기석 유닛을 상점에 놓으면 기존 판매 정산을 거쳐 판매된다', () => {
    const previousWindow = globalThis.window;
    globalThis.window = { isBattlePhase: false };
    try {
        const { app, manager, returnedItems } = createManager();
        app.state.gold = 0;
        const boardUnit = createUnit('u2_1');
        boardUnit.items = ['base_ad'];
        app.state.board[0] = boardUnit;
        const boardDrop = dropEvent({ sourceType: 'board', sourceIdx: '0' });

        assert.equal(manager.handleSellDrop(boardDrop), true);
        assert.equal(app.state.board[0], null);
        assert.equal(app.state.gold, 2);
        assert.deepEqual(returnedItems, ['base_ad']);
        assert.equal(boardDrop.prevented, true);
        assert.equal(boardDrop.stopped, true);

        const benchUnit = createUnit('u1_1');
        app.state.bench[2] = benchUnit;
        assert.equal(manager.handleSellDrop(dropEvent({ sourceType: 'bench', sourceIdx: '2' })), true);
        assert.equal(app.state.bench[2], null);
        assert.equal(app.state.gold, 3);
    } finally {
        globalThis.window = previousWindow;
    }
});

test('전투 중이거나 아이템·적 유닛을 놓으면 판매되지 않는다', () => {
    const previousWindow = globalThis.window;
    globalThis.window = { isBattlePhase: false };
    try {
        const { app, manager } = createManager();
        const unit = createUnit();
        app.state.bench[0] = unit;

        assert.equal(manager.handleSellDrop(dropEvent({ itemIdx: '0' })), false);
        assert.equal(app.state.bench[0], unit);

        unit.isEnemy = true;
        assert.equal(manager.handleSellDrop(dropEvent({ sourceType: 'bench', sourceIdx: '0' })), false);
        assert.equal(app.state.bench[0], unit);

        delete unit.isEnemy;
        globalThis.window.isBattlePhase = true;
        assert.equal(manager.handleSellDrop(dropEvent({ sourceType: 'bench', sourceIdx: '0' })), false);
        assert.equal(app.state.bench[0], unit);
    } finally {
        globalThis.window = previousWindow;
    }
});
