import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BattleEngine,
    clampPenetration,
    createSeededRandom,
    getAttackCooldown,
    getBattleWinner,
    updateGargoyleDefense
} from '../js/battleEngine.js';
import { UNIT_POOL } from '../js/data.js';
import { ITEMS } from '../js/items.js';
import { resolveBattleGold, StageManager } from '../js/systems/StageManager.js';
import { applyDonationItems } from '../js/systems/SynergyManager.js';
import { BattleRenderer } from '../js/battleRenderer.js';

function unit(id) {
    const value = structuredClone(UNIT_POOL.find(candidate => candidate.id === id));
    value.star = 1;
    value.items = [];
    value.stats.maxHp = value.stats.hp;
    value.combat = { shield: 0, bonusMana: 0, startMana: 0, itemEffects: {} };
    return value;
}

test('동시 전멸은 무승부다', () => {
    assert.equal(getBattleWinner(false, false), 'draw');
    assert.equal(getBattleWinner(true, false), 'player');
    assert.equal(getBattleWinner(false, true), 'enemy');
    assert.equal(getBattleWinner(true, true), null);
});

test('비정상 공속도 유한한 쿨다운으로 정규화된다', () => {
    for (const value of [0, -1, NaN, Infinity]) {
        const cooldown = getAttackCooldown(value);
        assert.ok(Number.isFinite(cooldown));
        assert.ok(cooldown >= 1);
    }
});

test('처형 피해 로그는 대상의 실제 남은 체력만 기록한다', () => {
    const engine = Object.create(BattleEngine.prototype);
    engine.tick = 1;
    engine.logs = [];
    const target = { team: 'enemy', gridIndex: 1, currHp: 100, stats: { maxHp: 1000 }, combat: {} };
    const attacker = { team: 'player', gridIndex: 25, combat: { executionPct: 0.2 } };

    engine.checkHpThresholds(target, [target, attacker], attacker);

    assert.equal(target.currHp, 0);
    assert.equal(engine.logs.find(log => log.type === 'damage').dmg, 100);
});

test('방어 관통은 90%를 넘지 않는다', () => {
    assert.equal(clampPenetration(4.2), 0.9);
    assert.equal(clampPenetration(-1), 0);
});

test('외톨이의 후드티 보너스는 반복 계산돼도 누적되지 않는다', () => {
    const target = { stats: { armor: 40, mr: 30 }, combat: {} };
    updateGargoyleDefense(target, 2, 1);
    updateGargoyleDefense(target, 2, 1);
    assert.deepEqual(target.stats, { armor: 70, mr: 60 });
});

test('골드 0은 기본값 50으로 바뀌지 않는다', () => {
    assert.equal(resolveBattleGold(0), 0);
    assert.equal(resolveBattleGold(undefined), 50);
});

test('전투 중 재시작 요청은 공통 진입점에서 거부된다', () => {
    const manager = new StageManager({ isBattlePhase: true });
    assert.equal(manager.handleBattleStart(), false);
});

test('기부 천사는 완성 아이템만 최대 3칸까지 임시 지급한다', () => {
    const board = Array(24).fill(null);
    board[0] = unit('u5_5');
    board[1] = unit('u1_1');
    board[1].items = ['base_ad', 'base_as'];

    applyDonationItems(board, ITEMS, createSeededRandom('donation-test'));

    assert.equal(board[0].donationItems.length, 1);
    assert.equal(board[1].donationItems.length, 1);
    assert.ok([...board[0].donationItems, ...board[1].donationItems]
        .every(id => ITEMS.find(item => item.id === id)?.type === 'combined'));
    assert.ok(board[1].items.length + board[1].donationItems.length <= 3);
});

test('분실물 보관함 유닛은 기부 천사의 임시 아이템도 받지 않는다', () => {
    const board = Array(24).fill(null);
    board[0] = unit('u5_5');
    board[1] = unit('u1_1');
    board[1].items = ['comb_crit_crit'];

    applyDonationItems(board, ITEMS, createSeededRandom('lost-and-found-donation'));

    assert.deepEqual(board[1].donationItems, []);
});

test('같은 시드와 같은 입력은 같은 전투 로그를 만든다', () => {
    const makeEngine = () => {
        const player = Array(24).fill(null);
        const enemy = Array(24).fill(null);
        player[0] = unit('u1_1');
        player[1] = unit('u1_2');
        enemy[0] = unit('u1_3');
        enemy[1] = unit('u1_4');
        return new BattleEngine(player, enemy, [], 10, 'same-seed');
    };

    assert.deepEqual(makeEngine().run(), makeEngine().run());
});

test('창체 교육과 CPR은 플레이어·적 양쪽에 같은 규칙으로 적용된다', () => {
    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    for (const [index, id] of ['u2_11', 'u3_11'].entries()) {
        player[index] = unit(id);
        enemy[index] = unit(id);
    }
    const engine = new BattleEngine(player, enemy, [], 50, 'changche-team-parity');
    engine.maxTicks = 1;
    const logs = engine.run();

    assert.deepEqual(
        logs.filter(log => log.type === 'changche_lv1').map(log => log.team).sort(),
        ['enemy', 'player']
    );
    assert.equal(engine.playerCprCharges, 2);
    assert.equal(engine.enemyCprCharges, 2);

    const playerTarget = engine.board[24];
    const enemyTarget = engine.board[0];
    playerTarget.currHp = 0;
    enemyTarget.currHp = 0;
    engine.handleDeath(playerTarget, engine.board.filter(Boolean));
    engine.handleDeath(enemyTarget, engine.board.filter(Boolean));
    assert.equal(playerTarget.currHp, 1);
    assert.equal(enemyTarget.currHp, 1);
    assert.equal(engine.playerCprCharges, 1);
    assert.equal(engine.enemyCprCharges, 1);
});

test('창체 3단계 역할군 버프는 20·10·2 단위의 조정값을 적용한다', () => {
    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    ['u2_11', 'u3_11', 'u5_5', 'u1_3', 'u4_9', 'u2_9'].forEach((id, index) => {
        player[index] = unit(id);
    });
    enemy[0] = unit('u1_1');

    const dealerAd = player[3].stats.ad;
    const tankHp = player[4].stats.maxHp;
    const tankArmor = player[4].stats.armor;
    const supportMana = player[5].stats.maxMana;
    const engine = new BattleEngine(player, enemy, [], 50, 'changche-level3-values');
    engine.maxTicks = 1;
    engine.run();

    const dealer = engine.board[27];
    const tank = engine.board[28];
    const support = engine.board[29];
    assert.equal(dealer.stats.ad, Math.round(dealerAd * 1.20));
    assert.equal(tank.stats.maxHp, Math.round(tankHp * 1.20));
    assert.equal(tank.stats.armor, tankArmor + 20);
    assert.equal(support.stats.maxMana, Math.floor(supportMana * 0.90));
    assert.equal(support.combat.teamManaRegen, 2);
});

test('경제부 4 시너지는 플레이어·적 양쪽의 진영별 골드 배율을 적용한다', () => {
    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    for (const [index, id] of ['u2_5', 'u3_12', 'u4_8', 'u5_5'].entries()) {
        player[index] = unit(id);
        enemy[index] = unit(id);
    }
    const engine = new BattleEngine(player, enemy, [], 50, 'economy-team-parity', 10);
    engine.maxTicks = 1;
    const playerAd = engine.board[24].stats.ad;
    const enemyAd = engine.board[0].stats.ad;
    const logs = engine.run();

    assert.equal(engine.board[24].stats.ad, Math.round(playerAd * 2.3));
    assert.equal(engine.board[0].stats.ad, Math.round(enemyAd * 1.5));
    assert.deepEqual(
        logs.filter(log => log.type === 'eco_buff').map(log => log.team).sort(),
        ['enemy', 'player']
    );
});

test('렌더러 stop은 인터벌·프레임·종료 타이머를 모두 정리한다', () => {
    const cleared = [];
    const cancelled = [];
    const removed = [];
    const oldClearInterval = globalThis.clearInterval;
    const oldClearTimeout = globalThis.clearTimeout;
    const oldCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const oldWindow = globalThis.window;
    const oldDocument = globalThis.document;

    globalThis.clearInterval = id => cleared.push(id);
    globalThis.clearTimeout = id => cleared.push(id);
    globalThis.cancelAnimationFrame = id => cancelled.push(id);
    globalThis.window = { removeEventListener: (...args) => removed.push(args) };
    globalThis.document = { getElementById: () => ({ style: { display: 'flex' } }) };

    const renderer = {
        timer: 1,
        animId: 2,
        endTimeout: 3,
        fxCleanupTimeout: 4,
        resizeCanvas() {},
        fxCanvas: { width: 10, height: 10 },
        ctx: { clearRect() {} }
    };

    try {
        BattleRenderer.prototype.stop.call(renderer);
        assert.deepEqual(cleared.sort(), [1, 3, 4]);
        assert.deepEqual(cancelled, [2]);
        assert.equal(removed.length, 1);
        assert.equal(renderer.timer, null);
        assert.equal(renderer.animId, null);
        assert.equal(renderer.endTimeout, null);
        assert.equal(renderer.fxCleanupTimeout, null);
    } finally {
        globalThis.clearInterval = oldClearInterval;
        globalThis.clearTimeout = oldClearTimeout;
        globalThis.cancelAnimationFrame = oldCancelAnimationFrame;
        globalThis.window = oldWindow;
        globalThis.document = oldDocument;
    }
});

test('렌더러 재생 속도는 1배속과 2배속만 허용한다', () => {
    const oldDocument = globalThis.document;
    const oldLocalStorage = globalThis.localStorage;
    const saved = [];
    const skipButton = {};
    globalThis.document = { querySelectorAll: () => [], getElementById: () => skipButton };
    globalThis.localStorage = { setItem: (...args) => saved.push(args) };
    const renderer = { playbackSpeed: 1, isSkipping: true, updatePlaybackControls() {} };

    try {
        assert.equal(BattleRenderer.prototype.setPlaybackSpeed.call(renderer, 2), 2);
        assert.equal(renderer.isSkipping, false);
        assert.equal(BattleRenderer.prototype.setPlaybackSpeed.call(renderer, 99), 1);
        assert.deepEqual(saved.at(-1), ['classroom-tactics-battle-speed', '1']);
        renderer.hitStopUntil = 1000;
        BattleRenderer.prototype.skipToEnd.call(renderer);
        assert.equal(renderer.isSkipping, true);
        assert.equal(renderer.hitStopUntil, 0);
        assert.equal(skipButton.disabled, true);

        renderer.isMultiplayer = true;
        renderer.isSkipping = false;
        renderer.hitStopUntil = 1000;
        assert.equal(BattleRenderer.prototype.setPlaybackSpeed.call(renderer, 2), 1);
        BattleRenderer.prototype.skipToEnd.call(renderer);
        assert.equal(renderer.playbackSpeed, 1);
        assert.equal(renderer.isSkipping, false);
        assert.equal(renderer.hitStopUntil, 1000);
    } finally {
        globalThis.document = oldDocument;
        globalThis.localStorage = oldLocalStorage;
    }
});

test('마나 정보가 없는 피해 로그는 기존 마나 표시를 덮어쓰지 않는다', () => {
    const oldDocument = globalThis.document;
    const oldWindow = globalThis.window;
    const oldSetTimeout = globalThis.setTimeout;
    const targetDiv = { dataset: { currMana: '40', viewing: 'false' } };
    const hpFill = { style: {} };
    const manaFill = { style: {} };
    const damageText = { style: {}, parentNode: null };
    const cell = {
        querySelector(selector) {
            return {
                '.unit-character': targetDiv,
                '.hp-fill': hpFill,
                '.mana-fill': manaFill
            }[selector] || null;
        },
        appendChild(node) { node.parentNode = this; },
        removeChild(node) { node.parentNode = null; }
    };

    globalThis.document = {
        createElement: () => damageText,
        getElementById: () => null
    };
    globalThis.window = { gameApp: null };
    globalThis.setTimeout = callback => callback();

    try {
        BattleRenderer.prototype.executeAction.call({
            cells: [cell],
            dpsStats: {},
            dpsTracker: { stats: { 0: { damage: 0, tank: 0 } } },
            fxCanvas: null,
            unitTransforms: []
        }, {
            type: 'damage',
            target: 0,
            dmg: 10,
            currHp: 90,
            maxHp: 100
        });

        assert.equal(targetDiv.dataset.currMana, '40');
        assert.equal(manaFill.style.width, undefined);
    } finally {
        globalThis.document = oldDocument;
        globalThis.window = oldWindow;
        globalThis.setTimeout = oldSetTimeout;
    }
});
