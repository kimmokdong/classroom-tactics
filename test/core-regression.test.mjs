import test from 'node:test';
import assert from 'node:assert/strict';

import { BattleEngine } from '../js/battleEngine.js';
import { BattleRenderer } from '../js/battleRenderer.js';
import { UNIT_POOL } from '../js/data.js';
import { POOL_SIZES, SHOP_PROBABILITIES } from '../js/core/constants.js';
import { createInitialState } from '../js/core/GameState.js';
import { ShopManager } from '../js/systems/ShopManager.js';
import { SaveManager } from '../js/systems/SaveManager.js';
import { StageManager } from '../js/systems/StageManager.js';
import { SynergyManager } from '../js/systems/SynergyManager.js';
import { UnitManager } from '../js/systems/UnitManager.js';

function unit(id) {
    const value = structuredClone(UNIT_POOL.find(candidate => candidate.id === id));
    value.star = 1;
    value.items = [];
    value.stats.maxHp = value.stats.hp;
    value.combat = { shield: 0, bonusMana: 0, startMana: 0, itemEffects: {} };
    return value;
}

test('코스트별 공용 기물 풀 한도는 22·18·16·9·8이다', () => {
    assert.deepEqual(POOL_SIZES, { 1: 22, 2: 18, 3: 16, 4: 9, 5: 8 });
});

function createShopApp() {
    const state = createInitialState();
    UNIT_POOL.forEach(candidate => { state.sharedPool[candidate.id] = 20; });
    return {
        state,
        calls: { header: 0, units: 0, upgrades: [] },
        updateHeader() { this.calls.header++; },
        renderUnits() { this.calls.units++; },
        checkForUpgrade(id) { this.calls.upgrades.push(id); },
        soundManager: { playSFX() {} }
    };
}

function createUnitApp() {
    const state = createInitialState();
    const returnedItems = [];
    return {
        state,
        returnedItems,
        updateHeader() {},
        calculateSynergy() {},
        soundManager: { playSFX() {} },
        itemManager: { addItemToInventory(id) { returnedItems.push(id); } }
    };
}

test('상점 구매는 골드·상점·대기석을 한 번에 갱신하고 실패 시 상태를 보존한다', () => {
    const app = createShopApp();
    const manager = new ShopManager(app);
    const offered = unit('u2_1');
    app.state.gold = offered.tier;
    app.state.shop[0] = offered;

    assert.equal(manager.buyUnit(0), true);
    assert.equal(app.state.gold, 0);
    assert.equal(app.state.shop[0], null);
    assert.equal(app.state.bench[0].id, offered.id);
    assert.notEqual(app.state.bench[0], offered);
    assert.deepEqual(app.calls.upgrades, [offered.id]);

    app.state.shop[1] = offered;
    assert.equal(manager.buyUnit(1), false);
    assert.equal(app.state.shop[1], offered);

    app.state.gold = offered.tier;
    app.state.bench.fill(unit('u1_1'));
    assert.equal(manager.buyUnit(1), false);
    assert.equal(app.state.gold, offered.tier);
    assert.equal(app.state.shop[1], offered);
});

test('상점 새로고침은 일반·무료 새로고침 비용과 레벨 확률표를 지킨다', () => {
    const app = createShopApp();
    const manager = new ShopManager(app);
    manager.renderShop = () => {};
    app.state.gold = 10;
    manager.refreshShop();
    assert.equal(app.state.gold, 8);

    app.state.roundFreeRerolls = 1;
    manager.refreshShop();
    assert.equal(app.state.gold, 8);
    assert.equal(app.state.roundFreeRerolls, 0);

    Object.values(SHOP_PROBABILITIES).forEach(probabilities => assert.equal(probabilities.reduce((sum, value) => sum + value, 0), 100));
    assert.deepEqual(SHOP_PROBABILITIES[1], [100, 0, 0, 0, 0]);
});

test('유닛 이동·필드 인원 제한·판매·합성이 상태를 일관되게 처리한다', () => {
    const previousWindow = globalThis.window;
    const previousAlert = globalThis.alert;
    globalThis.window = { isBattlePhase: false };
    globalThis.alert = () => {};

    try {
        const app = createUnitApp();
        const manager = new UnitManager(app);
        manager.renderUnits = () => {};
        app.state.level = 1;
        app.state.bench[0] = unit('u1_1');
        app.state.bench[1] = unit('u1_2');
        manager.moveUnit('bench', 0, 'board', 24);
        assert.equal(app.state.board[0].id, 'u1_1');
        manager.moveUnit('bench', 1, 'board', 25);
        assert.equal(app.state.bench[1].id, 'u1_2');
        assert.equal(app.state.board[1], null);

        const sellTarget = unit('u2_1');
        sellTarget.star = 2;
        sellTarget.items = ['base_ad'];
        app.state.bench[2] = sellTarget;
        app.state.gold = 0;
        manager.sellUnit('bench', 2, sellTarget);
        assert.equal(app.state.bench[2], null);
        assert.equal(app.state.gold, 5);
        assert.deepEqual(app.returnedItems, ['base_ad']);

        const copies = [unit('u1_3'), unit('u1_3'), unit('u1_3')];
        copies[0].items = ['base_as'];
        copies[0].permGrowth = { ad: 1, as: 0.1, ap: 2, hp: 3 };
        copies[1].permGrowth = { ad: 2, as: 0.2, ap: 3, hp: 4 };
        copies[2].permGrowth = { ad: 3, as: 0.3, ap: 4, hp: 5 };
        app.state.bench[3] = copies[0];
        app.state.bench[4] = copies[1];
        app.state.bench[5] = copies[2];
        const baseHp = copies[0].stats.hp;
        const baseAd = copies[0].stats.ad;
        manager.checkForUpgrade('u1_3');
        const upgraded = app.state.bench.find(candidate => candidate?.id === 'u1_3');
        assert.equal(upgraded.star, 2);
        assert.equal(upgraded.stats.hp, Math.round(baseHp * 1.8));
        assert.equal(upgraded.stats.ad, Math.round(baseAd * 1.5));
        assert.deepEqual(upgraded.items, ['base_as']);
        assert.equal(Number(upgraded.permGrowth.as.toFixed(1)), 0.6);
        assert.deepEqual({ ad: upgraded.permGrowth.ad, ap: upgraded.permGrowth.ap, hp: upgraded.permGrowth.hp }, { ad: 6, ap: 9, hp: 12 });
    } finally {
        globalThis.window = previousWindow;
        globalThis.alert = previousAlert;
    }
});

test('전투 인스턴스는 원본 유닛과 분리되고 사망한 대상 대신 다음 대상을 선택한다', () => {
    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    player[0] = unit('u1_2');
    player[0].skill = null;
    player[0].stats.ad = 10000;
    player[0].stats.as = 10;
    player[0].stats.range = 8;
    player[0].stats.maxMana = 999;
    enemy[0] = unit('u1_3');
    enemy[1] = unit('u1_4');
    enemy.forEach(candidate => {
        if (!candidate) return;
        candidate.skill = null;
        candidate.stats.ad = 0;
        candidate.stats.maxMana = 999;
    });

    const original = structuredClone(player[0]);
    const engine = new BattleEngine(player, enemy, [], 0, 'retarget');
    engine.board[24].stats.ad = 1;
    assert.deepEqual(player[0], original);
    engine.board[24].stats.ad = 10000;

    const logs = engine.run();
    const targets = logs.filter(log => log.type === 'attack' && log.from === 24).map(log => log.to);
    assert.equal(new Set(targets).size, 2);
    assert.equal(logs.find(log => log.type === 'end').winner, 'player');
});

test('상태 이상은 전투 중 적용되고 지속시간이 끝나면 제거된다', () => {
    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    player[0] = unit('u1_1');
    enemy[0] = unit('u1_3');
    for (const candidate of [player[0], enemy[0]]) {
        candidate.skill = null;
        candidate.stats.hp = 1000000;
        candidate.stats.maxHp = 1000000;
        candidate.stats.ad = 0;
        candidate.stats.as = 0.1;
        candidate.stats.maxMana = 999;
    }
    const engine = new BattleEngine(player, enemy, [], 0, 'buff-expiry');
    engine.addBuff(engine.board[24], 'stun', null, 0, 1);
    assert.equal(engine.board[24].buffs.length, 1);
    engine.run();
    assert.equal(engine.board[24].buffs.length, 0);
});

test('비율 스탯 버프는 재시전해도 기준 스탯에서 계산되고 강한 값으로 정확히 갱신된다', () => {
    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    player[0] = unit('u4_5');
    player[0].star = 2;
    enemy[23] = unit('u1_1');
    const engine = new BattleEngine(player, enemy, [], 0, 'buff-refresh');
    const caster = engine.board.find(candidate => candidate?.id === 'u4_5');
    const activeUnits = engine.board.filter(Boolean);
    const baseAd = caster.stats.ad;
    caster.stats.ap = 300;

    engine.skillEngine.execute(caster, activeUnits, engine);
    const firstBuffedAd = caster.stats.ad;
    assert.equal(firstBuffedAd, baseAd * 1.45);
    engine.skillEngine.execute(caster, activeUnits, engine);
    assert.equal(caster.stats.ad, firstBuffedAd);

    engine.addBuff(caster, 'buff', 'ad', baseAd * 0.8, 40);
    assert.equal(caster.stats.ad, baseAd * 1.8);
});

test('방송부 거리 피해 증폭은 전장 최대 거리에서 설정 상한을 넘지 않는다', () => {
    const engine = new BattleEngine([], [], [], 0, 'distance-amp');
    assert.equal(engine.getDistanceDamageAmp(0, 0.6), 0);
    assert.equal(engine.getDistanceDamageAmp(7, 0.6), 0.6);
    assert.equal(engine.getDistanceDamageAmp(99, 0.6), 0.6);
});

test('수채화 장인의 색의 마법은 대상에게 마나 봉인을 건다', () => {
    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    player[0] = unit('u3_9');
    player[0].star = 3;
    enemy[0] = unit('u1_1');
    const engine = new BattleEngine(player, enemy, [], 0, 'watercolor-mana-seal');
    const activeUnits = engine.board.filter(Boolean);
    const caster = activeUnits.find(candidate => candidate.id === 'u3_9');
    const target = activeUnits.find(candidate => candidate.id === 'u1_1');

    engine.skillEngine.execute(caster, activeUnits, engine);
    assert.ok(target.buffs.some(buff => buff.type === 'manaSeal'));
});

test('급식부 최대 체력 중첩은 전투 시작 체력을 기준으로 선형 증가한다', () => {
    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    player[0] = unit('u1_5');
    enemy[0] = unit('u1_5');
    for (const candidate of [player[0], enemy[0]]) {
        candidate.skill = null;
        candidate.stats.hp = 1000;
        candidate.stats.maxHp = 1000;
        candidate.stats.ad = 0;
        candidate.stats.as = 0.1;
    }
    Object.assign(player[0].combat, { isCafeteria: true, satietyTick: 10, stackHpPct: 0.30, stackArmorMr: 0 });

    const engine = new BattleEngine(player, enemy, [], 0, 'cafeteria-linear');
    engine.maxTicks = 21;
    engine.run();
    const cafeteria = engine.board.find(candidate => candidate?.team === 'player');

    assert.equal(cafeteria.combat.satietyCount, 2);
    assert.equal(cafeteria.stats.maxHp, 1600);
});

test('특급 만찬은 급식부 수와 무관하게 2.5초마다 팀 전체에 한 번만 중첩된다', () => {
    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    for (let index = 0; index < 8; index++) {
        const candidate = unit(UNIT_POOL[index].id);
        candidate.skill = null;
        candidate.stats.hp = 1000;
        candidate.stats.maxHp = 1000;
        candidate.stats.ad = 0;
        candidate.stats.as = 0.1;
        candidate.stats.maxMana = 999;
        if (index < 7) {
            candidate.club = '급식부';
            Object.assign(candidate.combat, { isCafeteria: true, satietyTick: 50, stackHpPct: 0.10, stackArmorMr: 10 });
        }
        player[index] = candidate;
    }
    enemy[0] = unit('u1_10');
    enemy[0].skill = null;
    enemy[0].stats.hp = 1000000;
    enemy[0].stats.maxHp = 1000000;
    enemy[0].stats.ad = 0;
    enemy[0].stats.as = 0.1;
    enemy[0].stats.maxMana = 999;

    const engine = new BattleEngine(player, enemy, ['p22'], 0, 'special-meal-once');
    const before = engine.board.filter(candidate => candidate?.team === 'player').map(candidate => ({
        id: candidate.id,
        armor: candidate.stats.armor,
        mr: candidate.stats.mr
    }));
    engine.maxTicks = 26;
    engine.run();

    for (const expected of before) {
        const candidate = engine.board.find(value => value?.team === 'player' && value.id === expected.id);
        assert.equal(candidate.stats.maxHp, 1100);
        assert.equal(candidate.stats.armor, expected.armor + 10);
        assert.equal(candidate.stats.mr, expected.mr + 10);
    }
});

test('육상부 유닛은 전투 시작 시 가장 가까운 적에게 질주하고 이동 칸만큼 중첩을 얻는다', () => {
    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    player[23] = unit('u1_2');
    enemy[0] = unit('u1_5');
    Object.assign(player[23].combat, {
        isRunner: true,
        runnerDash: true,
        moveAsBuff: 0.04,
        movePenBuff: 0.02,
        runnerMaxStacks: 10
    });
    const baseAs = player[23].stats.as;

    const engine = new BattleEngine(player, enemy, [], 0, 'runner-dash');
    engine.maxTicks = 1;
    const logs = engine.run();
    const dash = logs.find(log => log.type === 'move' && log.isDash);
    const runner = engine.board.find(candidate => candidate?.id === 'u1_2');

    assert.ok(dash);
    assert.equal(runner.combat.runnerStacks, dash.steps);
    assert.equal(runner.stats.as, baseAs * Math.pow(1.04, dash.steps));
});

test('장난꾸러기 2 룰렛은 전투 시작 시 꽝·바나나·폭음탄 중 하나만 발동한다', () => {
    const manager = new SynergyManager({ state: createInitialState(), ITEMS: [] });
    const [caster] = manager.applySynergyStats(
        [unit('u3_4')],
        { subjects: {}, clubs: { 장난꾸러기: 2 } },
        false,
        () => 0.5
    );

    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    player[23] = caster;
    enemy[0] = unit('u1_5');
    enemy[1] = unit('u1_5');
    enemy.forEach(target => {
        if (!target) return;
        target.skill = null;
        target.stats.hp = 100000;
        target.stats.maxHp = 100000;
        target.stats.ad = 0;
        target.stats.mr = 0;
    });

    const engine = new BattleEngine(player, enemy, [], 0, 'prank-roulette');
    engine.random = () => 0.5;
    engine.maxTicks = 1;
    const logs = engine.run();
    const roulette = logs.find(log => log.type === 'prank_roulette' && log.team === 'player');
    const targets = engine.board.filter(candidate => candidate?.team === 'enemy');

    assert.equal(roulette.result, 'banana');
    assert.equal(roulette.tick, -20);
    assert.equal(targets.filter(target => target.buffs.some(buff => buff.type === 'stun' && buff.duration === 19)).length, 1);
    assert.equal(logs.filter(log => log.fxType === 'fire_red').length, 0);
});

test('과학 4 시너지는 과학 유닛에게 시작 마나 40을 부여한다', () => {
    const manager = new SynergyManager({ state: createInitialState(), ITEMS: [] });
    const [scientist] = manager.applySynergyStats(
        [unit('u4_3')],
        { subjects: { 과학: 4 }, clubs: {} },
        false,
        () => 0.5
    );

    assert.equal(scientist.combat.startMana, 40);
    assert.equal(scientist.combat.dmgAmp, 0.8);
});

test('수학 6 시너지는 스킬 치명타와 치명타당 마나 5 회복을 적용한다', () => {
    const manager = new SynergyManager({ state: createInitialState(), ITEMS: [] });
    const [mathematician] = manager.applySynergyStats(
        [unit('u2_4')],
        { subjects: { 수학: 6 }, clubs: {} },
        false,
        () => 0.5
    );

    assert.equal(mathematician.combat.critChance, 0.7);
    assert.equal(mathematician.combat.critDmg, 2.3);
    assert.equal(mathematician.combat.armorPen, 0.6);
    assert.equal(mathematician.combat.skillCrit, true);
    assert.equal(mathematician.combat.critManaRestore, 5);

    const player = Array(24).fill(null);
    const enemy = Array(24).fill(null);
    player[0] = mathematician;
    enemy[0] = unit('u1_3');
    enemy[0].stats.hp = 100000;
    enemy[0].stats.maxHp = 100000;
    const engine = new BattleEngine(player, enemy, [], 0, 'math-six-crit-mana');
    const activeUnits = engine.board.filter(Boolean);
    const caster = activeUnits.find(candidate => candidate.team === 'player');
    caster.combat.critChance = 1;
    caster.currMana = 0;
    engine.random = () => 0;
    engine.skillEngine.execute(caster, activeUnits, engine);

    assert.ok(caster.currMana >= 5);
    assert.equal(caster.currMana % 5, 0);
});

test('신규 4·5코 유닛은 도감 데이터와 전투 스킬 판정을 함께 제공한다', () => {
    const portfolio = unit('u4_10');
    assert.equal(portfolio.name, '모의투자 우승자');
    assert.equal(portfolio.subject, '수학');
    assert.equal(portfolio.club, '경제부');

    const portfolioBoard = Array(24).fill(null);
    const portfolioEnemies = Array(24).fill(null);
    portfolioBoard[0] = portfolio;
    [0, 1, 8, 23].forEach((index, slot) => {
        portfolioEnemies[index] = unit('u1_1');
        portfolioEnemies[index].stats.hp = 100000;
        portfolioEnemies[index].stats.maxHp = 100000;
        portfolioEnemies[index].skill = null;
    });
    const portfolioEngine = new BattleEngine(portfolioBoard, portfolioEnemies, [], 0, 'new-four-cost');
    const portfolioUnits = portfolioEngine.board.filter(Boolean);
    const portfolioCaster = portfolioUnits.find(candidate => candidate.team === 'player');
    portfolioEngine.skillEngine.execute(portfolioCaster, portfolioUnits, portfolioEngine);
    const portfolioSkill = portfolioEngine.logs.find(log => log.type === 'skill');
    assert.equal(portfolioSkill.targets.length, 3);
    assert.equal(portfolioSkill.fxType, 'school_portfolio');
    assert.equal(portfolioCaster.currShield, 286);

    const actionStar = unit('u5_6');
    assert.equal(actionStar.name, '전교 액션스타');
    assert.equal(actionStar.subject, '창체');
    assert.deepEqual(actionStar.club, ['장난꾸러기', '육상부']);

    const actionBoard = Array(24).fill(null);
    const actionEnemies = Array(24).fill(null);
    actionBoard[0] = actionStar;
    [7, 15, 23].forEach(index => {
        actionEnemies[index] = unit('u1_1');
        actionEnemies[index].stats.hp = 100000;
        actionEnemies[index].stats.maxHp = 100000;
        actionEnemies[index].skill = null;
    });
    const actionEngine = new BattleEngine(actionBoard, actionEnemies, [], 0, 'new-five-cost');
    const actionUnits = actionEngine.board.filter(Boolean);
    const actionCaster = actionUnits.find(candidate => candidate.team === 'player');
    actionEngine.skillEngine.execute(actionCaster, actionUnits, actionEngine);
    const actionSkill = actionEngine.logs.find(log => log.type === 'skill');
    assert.equal(actionSkill.targets.length, 3);
    assert.equal(actionSkill.fxType, 'school_action_star');
    assert.equal(actionCaster.currShield, 362.5);
    assert.equal(actionEngine.logs.filter(log => log.type === 'cc' && log.ccType === 'stun').length, 3);
    assert.ok(actionEngine.logs.filter(log => log.type === 'move' && log.isDash).length >= 1);
});

function runBattleResult(winner, { hp = 100, shopLocked = false, duplicateCallback = false } = {}) {
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousPlay = BattleRenderer.prototype.play;
    const events = [];
    const calls = { refresh: 0, renderShop: 0, clearSelection: 0, modal: [] };
    const battleBoard = { children: [] };
    const startButton = { disabled: false, textContent: '⚔️ 전투 시작' };
    globalThis.window = { isBattlePhase: false, addEventListener() {}, removeEventListener() {} };
    globalThis.document = {
        getElementById(id) {
            if (id === 'battle-board') return battleBoard;
            if (id === 'battle-log') return { innerHTML: '', appendChild() {} };
            if (id === 'btn-start-battle') return startButton;
            return null;
        },
        querySelectorAll() { return []; }
    };
    BattleRenderer.prototype.play = function play(onEnd) {
        onEnd(winner, { survivingEnemies: 2 });
        if (duplicateCallback) onEnd(winner, { survivingEnemies: 2 });
    };

    try {
        const state = createInitialState();
        state.gold = 10;
        state.hp = hp;
        state.shopLocked = shopLocked;
        state.board[0] = unit('u1_2');
        state.board[0].stats.ad = 10000;
        state.enemyBoard[0] = unit('u1_3');
        const app = {
            state,
            eventBus: { emit(event) { events.push(event); } },
            soundManager: { playSFX() {}, playBgmSequence() {} },
            synergyManager: { getActiveSynergyLevel() { return 0; } },
            getSynergyData() { return { clubs: { 경제부: 0 }, subjects: {} }; },
            applySynergyStats(board) { return board.map(candidate => candidate && structuredClone(candidate)); },
            renderUnits() {}, updateHeader() {}, calculateSynergy() {}, spawnEnemyBoard() {},
            clearInteractionSelection() { calls.clearSelection++; },
            addExp(amount) { state.exp += amount; },
            refreshShop() { calls.refresh++; }, renderShop() { calls.renderShop++; },
            showResultModal(...args) { calls.modal.push(args); },
            showAugmentSelection() {}, showStoreTimeSelection() {}
        };
        const storage = {
            value: null,
            getItem() { return this.value; },
            setItem(key, value) { this.value = value; },
            removeItem() { this.value = null; }
        };
        app.saveManager = new SaveManager(app, storage);
        const manager = new StageManager(app);
        manager.handleBattleStart();
        const resultModal = calls.modal.at(-1);
        const beforeConfirm = {
            stage: [...state.stage],
            refresh: calls.refresh,
            startButton: { ...startButton }
        };
        if (resultModal?.[2] !== 'gameover') resultModal?.[3]?.();
        return { state, events, calls, beforeConfirm, startButton };
    } finally {
        BattleRenderer.prototype.play = previousPlay;
        globalThis.window = previousWindow;
        globalThis.document = previousDocument;
    }
}

test('전투 결과는 승패·체력·보상·다음 라운드·상점 잠금을 반영한다', () => {
    const pending = runBattleResult('player');
    assert.deepEqual(pending.beforeConfirm.stage, [1, 1]);
    assert.equal(pending.beforeConfirm.refresh, 0);
    assert.deepEqual(pending.beforeConfirm.startButton, { disabled: true, textContent: '⚔️ 전투 중...' });
    assert.deepEqual(pending.startButton, { disabled: false, textContent: '⚔️ 전투 시작' });
    assert.equal(pending.calls.clearSelection, 1);
    assert.deepEqual(pending.state.stage, [1, 2]);
    assert.equal(pending.calls.refresh, 1);

    const win = runBattleResult('player', { shopLocked: true });
    assert.equal(win.state.gold, 17);
    assert.equal(win.state.exp, 2);
    assert.deepEqual(win.state.stage, [1, 2]);
    assert.equal(win.state.shopLocked, false);
    assert.equal(win.calls.renderShop, 1);
    assert.equal(win.calls.refresh, 0);
    assert.ok(win.events.includes('BATTLE_ENDED'));
    assert.ok(win.events.includes('ROUND_STARTED'));

    const loss = runBattleResult('enemy');
    assert.equal(loss.state.hp, 95);
    assert.equal(loss.state.gold, 16);
    assert.deepEqual(loss.state.stage, [1, 2]);

    const gameOver = runBattleResult('enemy', { hp: 4 });
    assert.equal(gameOver.calls.modal[0][2], 'gameover');
    assert.deepEqual(gameOver.state.stage, [1, 1]);

    const duplicate = runBattleResult('player', { duplicateCallback: true });
    assert.equal(duplicate.state.gold, 17);
    assert.deepEqual(duplicate.state.stage, [1, 2]);
});
