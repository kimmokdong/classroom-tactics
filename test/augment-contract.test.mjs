import test from 'node:test';
import assert from 'node:assert/strict';

import { AUGMENTS, UNIT_POOL } from '../js/data.js';
import { EventBus } from '../js/core/EventBus.js';
import { createInitialState } from '../js/core/GameState.js';
import {
    AUGMENT_EVENTS,
    AugmentManager,
    deserializeAugments,
    serializeAugments,
    validateAugmentDefinition
} from '../js/systems/AugmentManager.js';

const findAugment = id => Object.values(AUGMENTS).flat().find(augment => augment.id === id);

function createApp(random = () => 0) {
    const state = createInitialState();
    const grantedUnits = [];
    const grantedItems = { base: 0, combined: 0 };
    const app = {
        state,
        AUGMENTS,
        UNIT_POOL,
        eventBus: new EventBus(),
        random,
        addExp(amount) { state.exp += amount; },
        addToBench(unit) { grantedUnits.push(unit); return true; },
        itemManager: {
            giveRandomBaseItem() { grantedItems.base++; },
            giveRandomCombinedItem() { grantedItems.combined++; }
        },
        updateHeader() {},
        renderUnits() {}
    };
    return { app, grantedUnits, grantedItems };
}

test('모든 증강체가 공통 계약을 만족하고 ID가 고유하다', () => {
    const all = Object.values(AUGMENTS).flat();
    assert.deepEqual(Object.fromEntries(Object.entries(AUGMENTS).map(([tier, augments]) => [tier, augments.length])), {
        silver: 15,
        gold: 15,
        prismatic: 18
    });
    assert.equal(all.length, 48);
    assert.equal(new Set(all.map(augment => augment.id)).size, all.length);
    assert.ok(all.every(validateAugmentDefinition));
});

test('즉시 지급 효과와 중복 금지 정책이 데이터 기준으로 실행된다', () => {
    const { app, grantedUnits } = createApp();
    const manager = new AugmentManager(app);

    assert.equal(manager.applyAugment(findAugment('s6')), true);
    assert.equal(app.state.gold, 15);
    assert.equal(grantedUnits.length, 4);
    assert.ok(grantedUnits.every(unit => unit.tier === 2));
    assert.equal(manager.applyAugment(findAugment('s6')), false);
    assert.equal(grantedUnits.length, 4);
    manager.dispose();
});

test('신규 자율학습 간식은 기존 즉시 골드 지급 계약을 사용한다', () => {
    const { app } = createApp();
    const manager = new AugmentManager(app);
    assert.equal(manager.applyAugment(findAugment('s12')), true);
    assert.equal(app.state.gold, 16);
    assert.equal(findAugment('s12').duration, 'instant');
    manager.dispose();
});

test('전투 종료 이벤트는 승리 시 반드시 70:30 비용 풀에서 한 유닛을 지급한다', () => {
    for (const [randomValue, expectedTier] of [[0.1, 1], [0.9, 2]]) {
        const { app, grantedUnits } = createApp(() => randomValue);
        const manager = new AugmentManager(app);
        manager.applyAugment(findAugment('s10'));

        app.eventBus.emit(AUGMENT_EVENTS.BATTLE_ENDED, { winner: 'enemy' });
        assert.equal(grantedUnits.length, 0);
        app.eventBus.emit(AUGMENT_EVENTS.BATTLE_ENDED, { winner: 'player' });
        assert.equal(grantedUnits.length, 1);
        assert.equal(grantedUnits[0].tier, expectedTier);
        manager.dispose();
    }
});

test('라운드 무료 새로고침은 매 라운드 3회로 초기화된다', () => {
    const { app } = createApp();
    const manager = new AugmentManager(app);
    manager.applyAugment(findAugment('p4'));
    assert.equal(app.state.roundFreeRerolls, 3);

    app.state.roundFreeRerolls = 1;
    app.eventBus.emit(AUGMENT_EVENTS.ROUND_STARTED, { stage: [4, 2] });
    assert.equal(app.state.roundFreeRerolls, 3);
    manager.dispose();
});

test('지속 증강체 제거 시 적용한 수치가 되돌아간다', () => {
    const { app } = createApp();
    const manager = new AugmentManager(app);
    manager.applyAugment(findAugment('g7'));
    assert.equal(app.state.globalBuffs.teamAdAp, 8);
    assert.equal(app.state.globalBuffs.critChance, 0.1);

    assert.equal(manager.removeAugment('g7'), true);
    assert.equal(app.state.globalBuffs.teamAdAp, 0);
    assert.equal(app.state.globalBuffs.critChance, 0);
    assert.equal(manager.removeAugment('g7'), false);
    manager.dispose();
});

test('증강체 저장 형식은 ID 목록이며 계약 정의로 복원된다', () => {
    const selected = [findAugment('s4'), findAugment('g4'), findAugment('p3')];
    const serialized = serializeAugments(selected);
    assert.deepEqual(serialized, ['s4', 'g4', 'p3']);
    assert.deepEqual(deserializeAugments(serialized, AUGMENTS).map(augment => augment.id), serialized);
});

test('설명과 실제 효과의 핵심 수치가 일치한다', () => {
    const enforcer = findAugment('g4');
    const classSet = findAugment('g7');
    const rage = findAugment('p3');
    assert.equal(enforcer.effect.values.enforcerAura, 0.1);
    assert.match(enforcer.description, /10%/);
    assert.deepEqual(classSet.effect.values, { teamAdAp: 8, critChance: 0.1 });
    assert.match(classSet.description, /\+8/);
    assert.match(classSet.description, /10%/);
    assert.equal(rage.effect.values.dmgAmp, 0.25);
    assert.match(rage.description, /25%/);
});

test('이벤트 구독은 중복 등록되지 않고 해제할 수 있다', () => {
    const eventBus = new EventBus();
    let calls = 0;
    const listener = () => calls++;
    const unsubscribe = eventBus.on('test', listener);
    eventBus.on('test', listener);
    eventBus.emit('test');
    assert.equal(calls, 1);
    unsubscribe();
    eventBus.emit('test');
    assert.equal(calls, 1);
});
