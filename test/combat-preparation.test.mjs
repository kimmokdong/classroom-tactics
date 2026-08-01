import test from 'node:test';
import assert from 'node:assert/strict';

import { BattleEngine, createSeededRandom } from '../js/battleEngine.js';
import {
    createUnitInstance,
    equipUnitItems,
    prepareBattle,
    promoteUnitToStar
} from '../js/battle/combatPreparation.js';
import { createInitialState } from '../js/core/GameState.js';
import { COMPOSITION_PATHS, applyAiDifficultyModifier } from '../js/enemyAi.js';
import { UNIT_POOL } from '../js/data.js';
import { ITEMS } from '../js/items.js';
import { ItemManager } from '../js/systems/ItemManager.js';
import { SaveManager } from '../js/systems/SaveManager.js';
import { applyLateGameEnemyModifier } from '../js/systems/StageManager.js';
import { getSynergyData, SynergyManager } from '../js/systems/SynergyManager.js';
import { BALANCE_PRESETS, buildExperimentBoard } from '../scripts/run_balance_experiment.mjs';

const template = id => UNIT_POOL.find(unit => unit.id === id);

function createSynergyManager() {
    const state = createInitialState();
    state.gold = 50;
    state.globalBuffs.teamHp = 17;
    state.globalBuffs.startMana = 5;
    return new SynergyManager({ state, ITEMS });
}

test('공용 유닛 생성은 1·2·3성에 순차 배율을 적용하고 원본을 보존한다', () => {
    const source = {
        id: 'contract-unit',
        tier: 1,
        star: 1,
        items: [],
        stats: { hp: 101, maxHp: 101, ad: 31, ap: 13, armor: 7, mr: 8 }
    };
    const snapshot = structuredClone(source);

    const one = createUnitInstance(source, { star: 1, teamRole: 'player' });
    const two = promoteUnitToStar(one, 2);
    const three = promoteUnitToStar(two, 3);

    assert.deepEqual({ hp: one.stats.hp, ad: one.stats.ad }, { hp: 101, ad: 31 });
    assert.deepEqual({ hp: two.stats.hp, ad: two.stats.ad }, { hp: 182, ad: 47 });
    assert.deepEqual({ hp: three.stats.hp, ad: three.stats.ad }, { hp: 328, ad: 71 });
    assert.equal(three.stats.maxHp, 328);
    assert.equal(three.stats.ap, 13);
    assert.equal(three.stats.armor, 7);
    assert.equal(three.stats.mr, 8);
    assert.equal('starLevel' in three, false);
    assert.deepEqual(source, snapshot);
});

test('공용 아이템 계약은 0·1·3개와 잘못된 ID를 구분하고 같은 시드를 재현한다', () => {
    const baseItems = ITEMS.filter(item => item.type === 'base').slice(0, 3).map(item => item.id);
    const source = template('u1_1');
    const zero = createUnitInstance(source);
    const one = createUnitInstance(source, { itemIds: baseItems.slice(0, 1) });
    const three = createUnitInstance(source, { itemIds: baseItems });

    assert.deepEqual(zero.items, []);
    assert.deepEqual(one.items, baseItems.slice(0, 1));
    assert.deepEqual(three.items, baseItems);
    assert.throws(() => equipUnitItems(three, [...baseItems, baseItems[0]]), /3/);
    assert.throws(() => createUnitInstance(source, { itemIds: ['not-an-item'] }), /not-an-item/);

    const first = createUnitInstance(source, {
        itemIds: ['comb_crit_crit'],
        random: createSeededRandom('thieves-contract')
    });
    const second = createUnitInstance(source, {
        itemIds: ['comb_crit_crit'],
        random: createSeededRandom('thieves-contract')
    });
    assert.deepEqual(first.thievesItems, second.thievesItems);
    assert.equal(first.thievesItems.length, 2);
    first.thievesItems.forEach(itemId => {
        const item = ITEMS.find(candidate => candidate.id === itemId);
        assert.equal(item.type, 'combined');
        assert.notEqual(item.id, 'comb_crit_crit');
    });
});

test('아이템 매니저도 공용 장착 계약을 사용해 조합·가득 찬 슬롯·잘못된 ID를 안전하게 처리한다', () => {
    const previousDocument = globalThis.document;
    const previousAlert = globalThis.alert;
    let alerts = 0;
    globalThis.document = {
        querySelector() { return null; },
        getElementById() { return { innerHTML: '' }; }
    };
    globalThis.alert = () => { alerts++; };

    try {
        const state = createInitialState();
        const app = {
            state,
            ITEMS,
            random: createSeededRandom('item-manager-contract'),
            renderUnits() {},
            calculateSynergy() {},
            showUnitInfo() {},
            soundManager: { playSFX() {} }
        };
        const manager = new ItemManager(app);
        manager.renderInventory = () => {};
        const unit = createUnitInstance(template('u1_1'), { itemIds: ['base_crit'] });

        state.inventory[0] = 'base_crit';
        assert.equal(manager.giveItemToUnit(0, unit), true);
        assert.deepEqual(unit.items, ['comb_crit_crit']);
        assert.equal(unit.thievesItems.length, 2);

        state.inventory[0] = 'not-an-item';
        assert.equal(manager.giveItemToUnit(0, unit), false);
        assert.equal(state.inventory[0], 'not-an-item');

        const full = createUnitInstance(template('u1_2'), {
            itemIds: ITEMS.filter(item => item.type === 'base').slice(0, 3).map(item => item.id)
        });
        state.inventory[0] = 'comb_ad_ad';
        assert.equal(manager.giveItemToUnit(0, full), false);
        assert.equal(state.inventory[0], 'comb_ad_ad');
        assert.equal(alerts, 1);
    } finally {
        globalThis.document = previousDocument;
        globalThis.alert = previousAlert;
    }
});

test('게임과 시뮬레이터의 전투 준비 결과가 같고 팀 역할별 보너스가 분리된다', () => {
    const effectItem = ITEMS.find(item => item.type === 'combined' && item.effect && item.id !== 'comb_crit_crit');
    assert.ok(effectItem);
    const player = Array(24).fill(null);
    const opponent = Array(24).fill(null);
    player[0] = createUnitInstance(template('u5_5'), { teamRole: 'player' });
    player[1] = createUnitInstance(template('u1_1'), { itemIds: [effectItem.id], teamRole: 'player' });
    opponent[0] = createUnitInstance(template('u5_5'), { teamRole: 'opponent' });
    opponent[1] = createUnitInstance(template('u1_1'), { itemIds: [effectItem.id], teamRole: 'opponent' });
    const original = { player: structuredClone(player), opponent: structuredClone(opponent) };

    const commonManager = createSynergyManager();
    const prepared = prepareBattle({
        player: { board: player, teamRole: 'player', applyPlayerOnlyBonuses: true },
        opponent: { board: opponent, teamRole: 'opponent', applyPlayerOnlyBonuses: false },
        applySynergyStats: commonManager.applySynergyStats.bind(commonManager),
        random: createSeededRandom('battle-preparation-parity')
    });

    const directManager = createSynergyManager();
    const directRandom = createSeededRandom('battle-preparation-parity');
    const directPlayer = directManager.applySynergyStats(
        player,
        getSynergyData(player),
        false,
        directRandom,
        { teamRole: 'player', applyPlayerOnlyBonuses: true }
    );
    const directOpponent = directManager.applySynergyStats(
        opponent,
        getSynergyData(opponent),
        true,
        directRandom,
        { teamRole: 'opponent', applyPlayerOnlyBonuses: false }
    );

    assert.deepEqual(prepared.playerBoard, directPlayer);
    assert.deepEqual(prepared.enemyBoard, directOpponent);
    assert.deepEqual(prepared.playerSynergies, getSynergyData(player));
    assert.deepEqual(prepared.enemySynergies, getSynergyData(opponent));
    assert.deepEqual(player, original.player);
    assert.deepEqual(opponent, original.opponent);
    assert.ok(prepared.playerBoard.some(unit => unit?.donationItems?.length));
    assert.equal(prepared.enemyBoard.some(unit => unit?.donationItems?.length), false);
    assert.equal(prepared.playerBoard[1].combat.itemEffects[effectItem.effect], 1);
    assert.notEqual(prepared.playerBoard[1].stats.hp, player[1].stats.hp);
});

test('시작 마나는 준비 단계에서 한 번만 기록되고 전투 엔진에서 한 번만 적용된다', () => {
    const manaItem = ITEMS.find(item => item.type === 'combined' && item.stats.mana > 0);
    assert.ok(manaItem);
    const board = Array(24).fill(null);
    board[0] = createUnitInstance(template('u1_1'), { itemIds: [manaItem.id], teamRole: 'player' });
    const baseMana = board[0].stats.mana || 0;
    const manager = createSynergyManager();
    const prepared = manager.applySynergyStats(
        board,
        getSynergyData(board),
        false,
        createSeededRandom('start-mana-once'),
        { teamRole: 'player', applyPlayerOnlyBonuses: true }
    );

    assert.equal(prepared[0].stats.mana || 0, baseMana);
    assert.equal(prepared[0].combat.startMana, 5 + manaItem.stats.mana);
    const engine = new BattleEngine(prepared, Array(24).fill(null), [], 0, 'start-mana-once');
    assert.equal(engine.board[24].currMana, baseMana + 5 + manaItem.stats.mana);
});

test('같은 효과 아이템 여러 개는 효과 개수로 기록된다', () => {
    const effectItem = ITEMS.find(item => item.type === 'combined' && item.effect && item.id !== 'comb_crit_crit');
    const board = Array(24).fill(null);
    board[0] = createUnitInstance(template('u1_1'), {
        itemIds: [effectItem.id, effectItem.id],
        teamRole: 'player'
    });
    const manager = createSynergyManager();
    const prepared = manager.applySynergyStats(
        board,
        getSynergyData(board),
        false,
        createSeededRandom('stacked-item-effects'),
        { teamRole: 'player', applyPlayerOnlyBonuses: false }
    );

    assert.equal(prepared[0].combat.itemEffects[effectItem.effect], 2);
});

test('AI 난이도 보정은 공용 3성 기본값과 분리되고 시뮬레이터에는 섞이지 않는다', () => {
    const lowTier = UNIT_POOL.find(unit => unit.tier <= 3);
    const base = createUnitInstance(lowTier, { star: 3, teamRole: 'opponent' });
    const snapshot = structuredClone(base);
    const modified = applyAiDifficultyModifier(base);
    const defenseBonus = Math.round(25 - lowTier.tier * 5);
    const hpBonus = Math.round(250 - lowTier.tier * 50);

    assert.deepEqual(base, snapshot);
    assert.equal(modified.stats.hp, base.stats.hp + hpBonus);
    assert.equal(modified.stats.maxHp, modified.stats.hp);
    assert.equal(modified.stats.armor, base.stats.armor + defenseBonus);
    assert.equal(modified.stats.mr, base.stats.mr + defenseBonus);

    const latePlayer = Array(24).fill(null);
    const lateOpponent = Array(24).fill(null);
    lateOpponent[0] = modified;
    const lateManager = createSynergyManager();
    const preparedLate = prepareBattle({
        player: { board: latePlayer, teamRole: 'player' },
        opponent: { board: lateOpponent, teamRole: 'opponent' },
        applySynergyStats: lateManager.applySynergyStats.bind(lateManager),
        random: createSeededRandom('late-enemy-modifier')
    }).enemyBoard;
    const beforeLateModifier = structuredClone(preparedLate);
    assert.deepEqual(applyLateGameEnemyModifier(structuredClone(preparedLate), 4), beforeLateModifier);
    const lateModified = applyLateGameEnemyModifier(preparedLate, 5);
    assert.equal(lateModified[0].stats.hp, Math.round(beforeLateModifier[0].stats.hp * 1.15));
    assert.equal(lateModified[0].stats.maxHp, Math.round(beforeLateModifier[0].stats.maxHp * 1.15));
    assert.equal(lateModified[0].stats.armor, beforeLateModifier[0].stats.armor + 15);
    assert.equal(lateModified[0].stats.mr, beforeLateModifier[0].stats.mr + 15);

    const preset = BALANCE_PRESETS.find(value => value.id === 'star-3');
    const simulatorBoard = buildExperimentBoard(COMPOSITION_PATHS[0], preset, 'standard', true, 'ai-separation');
    simulatorBoard.filter(Boolean).forEach(unit => {
        const expected = createUnitInstance(template(unit.id), { star: 3, teamRole: 'opponent' });
        assert.deepEqual(
            { hp: unit.stats.hp, ad: unit.stats.ad, armor: unit.stats.armor, mr: unit.stats.mr },
            { hp: expected.stats.hp, ad: expected.stats.ad, armor: expected.stats.armor, mr: expected.stats.mr }
        );
    });
});

test('저장 복구는 잘못된 아이템 ID만 제거하고 나머지 진행 상태를 유지한다', () => {
    const app = { state: createInitialState() };
    const manager = new SaveManager(app, null);
    const savedUnit = createUnitInstance(template('u1_1'), { itemIds: ['base_ad'] });
    savedUnit.items.push('not-an-item');
    const normalized = manager.normalizeState({
        gold: 37,
        board: [savedUnit],
        inventory: ['not-an-item', 'base_as'],
        pendingRewards: [
            { type: 'item', itemId: 'not-an-item' },
            { type: 'item', itemId: 'base_hp' },
            { type: 'unit', unit: { ...savedUnit, items: ['not-an-item', 'base_ap'] } }
        ]
    });

    assert.equal(normalized.gold, 37);
    assert.deepEqual(normalized.board[0].items, ['base_ad']);
    assert.deepEqual(normalized.inventory.slice(0, 2), [null, 'base_as']);
    assert.deepEqual(normalized.pendingRewards.map(reward => reward.type), ['item', 'unit']);
    assert.deepEqual(normalized.pendingRewards[1].unit.items, ['base_ap']);
});
