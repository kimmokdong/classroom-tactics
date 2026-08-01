import { createHash } from 'node:crypto';

import { BattleEngine, createSeededRandom } from '../../js/battleEngine.js';
import { createUnitInstance, prepareBattle } from '../../js/battle/combatPreparation.js';
import { createInitialState } from '../../js/core/GameState.js';
import { AUGMENTS, UNIT_POOL } from '../../js/data.js';
import { ITEMS } from '../../js/items.js';
import { AugmentManager } from '../../js/systems/AugmentManager.js';
import { SynergyManager } from '../../js/systems/SynergyManager.js';
import { PLACEMENTS } from './create-case-suite.mjs';

const unitsById = new Map(UNIT_POOL.map(unit => [unit.id, unit]));
const augmentsById = new Map(Object.values(AUGMENTS).flat().map(augment => [augment.id, augment]));
const columnMaps = {
    standard: [0, 1, 2, 3, 4, 5, 6, 7],
    mirrored: [7, 6, 5, 4, 3, 2, 1, 0],
    spread: [3, 2, 1, 0, 7, 6, 5, 4]
};

export function transformPosition(position, placement, teamRole = 'player') {
    if (!Number.isInteger(position) || position < 0 || position >= 24) throw new Error(`유효하지 않은 배치 칸: ${position}`);
    if (!PLACEMENTS.includes(placement)) throw new Error(`유효하지 않은 배치 유형: ${placement}`);
    if (!['player', 'opponent'].includes(teamRole)) throw new Error(`유효하지 않은 진영: ${teamRole}`);
    const row = Math.floor(position / 8);
    const column = columnMaps[placement][position % 8];
    const orientedRow = teamRole === 'opponent' ? 2 - row : row;
    return orientedRow * 8 + column;
}

export function buildDeckBoard(deck, {
    placement,
    teamRole,
    configurationSeed,
    itemSeed
}) {
    const board = Array(24).fill(null);
    const units = deck.units.map(entry => {
        const template = unitsById.get(entry.unitId);
        if (!template) throw new Error(`${deck.id}: 미등록 유닛 ${entry.unitId}`);
        const position = transformPosition(entry.position, placement, teamRole);
        if (board[position]) throw new Error(`${deck.id}: 배치 충돌 ${position}`);
        const unit = createUnitInstance(template, {
            star: entry.star,
            itemIds: [...entry.items],
            instanceId: `${deck.id}:${entry.unitId}:${configurationSeed}`,
            teamRole,
            random: createSeededRandom(`${itemSeed}:${entry.unitId}`)
        });
        board[position] = unit;
        return {
            unitId: entry.unitId,
            star: unit.star,
            items: [...unit.items],
            thievesItems: [...(unit.thievesItems || [])],
            sourcePosition: entry.position,
            placementPosition: transformPosition(entry.position, placement, 'player'),
            positionGroup: entry.positionGroup
        };
    });

    return {
        board,
        configuration: {
            deckId: deck.id,
            checkpointId: deck.checkpointId,
            placement,
            configurationSeed,
            itemSeed,
            units
        }
    };
}

export function suppressSynergyCounts(synergies, suppression) {
    const result = {
        subjects: { ...(synergies?.subjects || {}) },
        clubs: { ...(synergies?.clubs || {}) }
    };
    if (suppression?.type && suppression?.name && result[suppression.type]) {
        delete result[suppression.type][suppression.name];
    }
    return result;
}

export function suppressUnitTrait(board, suppression) {
    if (!suppression?.type || !suppression?.name) return board;
    const field = suppression.type === 'subjects' ? 'subject' : suppression.type === 'clubs' ? 'club' : null;
    if (!field) return board;
    return board.map(unit => {
        if (!unit) return unit;
        const current = unit[field];
        if (Array.isArray(current) && current.includes(suppression.name)) {
            return { ...unit, [field]: current.filter(name => name !== suppression.name) };
        }
        return current === suppression.name ? { ...unit, [field]: null } : unit;
    });
}

function applyPlayerAugments(state, board, augmentIds, playerHp) {
    state.board = board;
    state.hp = playerHp;
    const manager = new AugmentManager({
        state,
        UNIT_POOL,
        random: () => 0.5,
        addExp() {},
        addToBench() { return true; },
        itemManager: {
            giveRandomBaseItem() {},
            giveRandomCombinedItem() {}
        }
    });
    for (const augmentId of augmentIds) {
        const augment = augmentsById.get(augmentId);
        if (!augment) throw new Error(`미등록 증강체: ${augmentId}`);
        manager.applyAugment(augment);
    }
    manager.dispose();
}

function applyEnemyHpReduction(board, ratio) {
    if (!ratio) return;
    board.filter(Boolean).forEach(unit => {
        unit.stats.maxHp = Math.round((unit.stats.maxHp || unit.stats.hp) * (1 - ratio));
        unit.stats.hp = unit.stats.maxHp;
    });
}

function prepareSymmetricBoards(left, right, suppressedSynergyByDeckId, playerAugmentIds, playerHp) {
    const state = createInitialState();
    state.gold = 50;
    applyPlayerAugments(state, left.board, playerAugmentIds, playerHp);
    const synergyManager = new SynergyManager({ state, ITEMS });
    const randomByBoard = new Map([
        [left.board, createSeededRandom(`${left.configuration.itemSeed}:synergy`)],
        [right.board, createSeededRandom(`${right.configuration.itemSeed}:synergy`)]
    ]);
    const suppressionFor = deckId => suppressedSynergyByDeckId instanceof Map
        ? suppressedSynergyByDeckId.get(deckId)
        : suppressedSynergyByDeckId?.[deckId];
    const applySynergyStats = (board, synergies, isEnemy, random, options) => {
        const deckId = board === left.board ? left.configuration.deckId : right.configuration.deckId;
        return synergyManager.applySynergyStats(
            board,
            suppressSynergyCounts(synergies, suppressionFor(deckId)),
            isEnemy,
            randomByBoard.get(board) || random,
            options
        );
    };

    // 기부 패시브는 양쪽에 적용하되 저장 상태의 플레이어 전용 전역 보너스는 배제한다.
    const prepared = prepareBattle({
        player: { board: left.board, teamRole: 'player', applyPlayerOnlyBonuses: true },
        opponent: { board: right.board, teamRole: 'player', applyPlayerOnlyBonuses: false },
        applySynergyStats,
        random: () => 0.5
    });
    prepared.playerBoard = suppressUnitTrait(prepared.playerBoard, suppressionFor(left.configuration.deckId));
    prepared.enemyBoard = suppressUnitTrait(prepared.enemyBoard, suppressionFor(right.configuration.deckId));
    applyEnemyHpReduction(prepared.enemyBoard, state.globalBuffs.enforcerAura);
    return prepared;
}

function digest(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function preparedConfiguration(configuration, board) {
    const preparedById = new Map(board.filter(Boolean).map(unit => [unit.id, unit]));
    return {
        ...configuration,
        units: configuration.units.map(unit => {
            const prepared = preparedById.get(unit.unitId);
            if (!prepared) throw new Error(`${configuration.deckId}: 준비된 유닛을 찾을 수 없습니다: ${unit.unitId}`);
            return {
                ...unit,
                items: [...(prepared.items || [])],
                thievesItems: [...(prepared.thievesItems || [])],
                donationItems: [...(prepared.donationItems || [])]
            };
        })
    };
}

const starCopies = [0, 1, 3, 9];

function createUnitMetric(unit, deckId, isSummon = false) {
    const unitId = unit.id || (isSummon ? 'zzrot-dog' : null);
    return {
        instanceId: unit.instanceId || `${unit.team}:${unitId || unit.name}:${unit.gridIndex}`,
        unitId,
        name: unit.name,
        team: unit.team,
        deckId,
        roles: isSummon ? ['summon'] : Array.isArray(unit.role) ? [...unit.role] : unit.role ? [unit.role] : [],
        star: unit.star || 1,
        tier: unit.tier || 0,
        items: [...(unit.items || [])],
        investmentGold: isSummon ? 0 : (unit.tier || 0) * starCopies[unit.star || 1],
        isSummon,
        ownerInstanceId: unit.ownerInstanceId || null,
        damage: 0,
        damageTaken: 0,
        healing: 0,
        shielding: 0,
        skillCasts: 0,
        firstSkillTick: null,
        ccAppliedTicks: 0,
        ccReceivedTicks: 0,
        enemySkillHits: 0,
        kills: 0,
        killParticipation: 0,
        ownerAttributedSummonDamage: 0,
        deathTick: null,
        survivalTicks: null,
        survived: false,
        firstDeath: false,
        teamDamageShare: 0,
        teamTankingShare: 0,
        damagePerSurvivalTick: 0
    };
}

export function collectCaseBattleMetrics(initialUnits, logs, end, teamDeckIds) {
    const units = new Map(initialUnits.map(unit => {
        const metric = createUnitMetric(unit, teamDeckIds[unit.team]);
        return [metric.instanceId, metric];
    }));
    const lastDamager = new Map();
    const contributors = new Map();
    const teamDamage = { player: 0, enemy: 0 };
    let firstDeathRecorded = false;
    let totalDamage = 0;
    let totalHealing = 0;
    let totalShielding = 0;
    let unattributedDamage = 0;
    let unattributedHealing = 0;
    let unattributedShielding = 0;
    let unknownSourceEventCount = 0;

    for (const log of logs) {
        if (log.type === 'spawn' && log.unit) {
            const owner = units.get(log.ownerInstanceId || log.unit.ownerInstanceId);
            const metric = createUnitMetric(log.unit, owner?.deckId || teamDeckIds[log.unit.team], true);
            units.set(metric.instanceId, metric);
        }

        const source = units.get(log.sourceInstanceId);
        const target = units.get(log.targetInstanceId);
        if (log.type === 'attack' || log.type === 'damage') {
            const amount = Math.max(0, Number(log.dmg) || 0);
            totalDamage += amount;
            if (target) target.damageTaken += amount;
            const sourceKnown = source && log.sourceType !== 'unknown' && !log.unattributed;
            if (sourceKnown) {
                source.damage += amount;
                teamDamage[source.team] += amount;
                if (source.isSummon && source.ownerInstanceId) {
                    const owner = units.get(source.ownerInstanceId);
                    if (owner) owner.ownerAttributedSummonDamage += amount;
                }
                if (target && source.team !== target.team && amount > 0) {
                    lastDamager.set(target.instanceId, source.instanceId);
                    const targetContributors = contributors.get(target.instanceId) || new Set();
                    targetContributors.add(source.instanceId);
                    contributors.set(target.instanceId, targetContributors);
                }
            } else if (amount > 0) {
                unattributedDamage += amount;
                unknownSourceEventCount++;
                if (target) teamDamage[target.team === 'player' ? 'enemy' : 'player'] += amount;
            }
        } else if (log.type === 'heal') {
            const amount = Math.max(0, Number(log.amount) || 0);
            totalHealing += amount;
            if (source) source.healing += amount;
            else if (amount > 0) {
                unattributedHealing += amount;
                unknownSourceEventCount++;
            }
        } else if (log.type === 'shield') {
            const amount = Math.max(0, Number(log.amount) || 0);
            totalShielding += amount;
            if (source) source.shielding += amount;
            else if (amount > 0) {
                unattributedShielding += amount;
                unknownSourceEventCount++;
            }
        } else if (log.type === 'cc') {
            const duration = Math.max(0, Number(log.duration) || 0);
            if (source) source.ccAppliedTicks += duration;
            else if (duration > 0) unknownSourceEventCount++;
            if (target) target.ccReceivedTicks += duration;
        } else if (log.type === 'skill') {
            if (source) {
                source.skillCasts++;
                source.firstSkillTick ??= log.tick;
            }
            for (const instanceId of log.targetInstanceIds || []) {
                const skillTarget = units.get(instanceId);
                if (skillTarget && source && skillTarget.team !== source.team) skillTarget.enemySkillHits++;
            }
        } else if (log.type === 'die' && target) {
            target.deathTick ??= log.tick;
            if (!firstDeathRecorded && !target.isSummon) {
                target.firstDeath = true;
                firstDeathRecorded = true;
            }
            const killer = units.get(lastDamager.get(target.instanceId));
            if (killer) killer.kills++;
            for (const instanceId of contributors.get(target.instanceId) || []) {
                const contributor = units.get(instanceId);
                if (contributor) contributor.killParticipation++;
            }
        }
    }

    const metrics = [...units.values()];
    const teamTanking = {
        player: metrics.filter(unit => unit.team === 'player').reduce((sum, unit) => sum + unit.damageTaken, 0),
        enemy: metrics.filter(unit => unit.team === 'enemy').reduce((sum, unit) => sum + unit.damageTaken, 0)
    };
    metrics.forEach(unit => {
        unit.survivalTicks = unit.deathTick ?? end.tick;
        unit.survived = unit.deathTick === null;
        unit.teamDamageShare = teamDamage[unit.team] ? unit.damage / teamDamage[unit.team] : 0;
        unit.teamTankingShare = teamTanking[unit.team] ? unit.damageTaken / teamTanking[unit.team] : 0;
        unit.damagePerSurvivalTick = unit.damage / Math.max(1, unit.survivalTicks);
    });

    const unattributedDamageRate = totalDamage ? unattributedDamage / totalDamage : 0;
    return {
        units: metrics,
        diagnostics: {
            totalDamage,
            totalHealing,
            totalShielding,
            unattributedDamage,
            unattributedHealing,
            unattributedShielding,
            unknownSourceEventCount,
            unattributedDamageRate,
            warning: unattributedDamageRate > 0.01 ? '미귀속 피해가 전체 피해의 1%를 초과함' : null
        }
    };
}

export function runBattleCase(battleCase, {
    decksById,
    maxTicks = 600,
    suppressedSynergyByDeckId,
    playerAugmentIds = [],
    playerHp = 100
} = {}) {
    if (!Number.isSafeInteger(maxTicks) || maxTicks < 1) throw new Error('maxTicks는 1 이상의 정수여야 합니다.');
    if (!Array.isArray(playerAugmentIds)) throw new Error('playerAugmentIds는 배열이어야 합니다.');
    if (!Number.isFinite(playerHp) || playerHp < 0) throw new Error('playerHp는 0 이상의 수여야 합니다.');
    const deckMap = decksById instanceof Map ? decksById : new Map((decksById || []).map(deck => [deck.id, deck]));
    const deckA = deckMap.get(battleCase.deckAId);
    const deckB = deckMap.get(battleCase.deckBId);
    if (!deckA || !deckB) throw new Error(`case 덱을 찾을 수 없습니다: ${battleCase.deckAId}, ${battleCase.deckBId}`);

    const deckABoard = buildDeckBoard(deckA, {
        placement: battleCase.placementA,
        teamRole: battleCase.sideDirection === 'a-left' ? 'player' : 'opponent',
        configurationSeed: battleCase.seeds.deckA,
        itemSeed: battleCase.seeds.itemA
    });
    const deckBBoard = buildDeckBoard(deckB, {
        placement: battleCase.placementB,
        teamRole: battleCase.sideDirection === 'a-left' ? 'opponent' : 'player',
        configurationSeed: battleCase.seeds.deckB,
        itemSeed: battleCase.seeds.itemB
    });
    const left = battleCase.sideDirection === 'a-left' ? deckABoard : deckBBoard;
    const right = battleCase.sideDirection === 'a-left' ? deckBBoard : deckABoard;
    const prepared = prepareSymmetricBoards(left, right, suppressedSynergyByDeckId, playerAugmentIds, playerHp);
    const configurations = battleCase.sideDirection === 'a-left'
        ? {
            deckA: preparedConfiguration(deckABoard.configuration, prepared.playerBoard),
            deckB: preparedConfiguration(deckBBoard.configuration, prepared.enemyBoard)
        }
        : {
            deckA: preparedConfiguration(deckABoard.configuration, prepared.enemyBoard),
            deckB: preparedConfiguration(deckBBoard.configuration, prepared.playerBoard)
        };
    const engine = new BattleEngine(prepared.playerBoard, prepared.enemyBoard, playerAugmentIds, 50, battleCase.seeds.battle);
    engine.maxTicks = maxTicks;
    const initialUnits = engine.board.filter(Boolean).map(unit => structuredClone(unit));
    const logs = engine.run();
    const end = logs.findLast(log => log.type === 'end');
    if (!end) throw new Error('전투 종료 로그가 없습니다.');
    if (!Number.isFinite(end.tick) || end.tick > maxTicks) throw new Error(`최대 전투 시간 초과: ${end.tick}/${maxTicks}`);

    const playerDeckId = left.configuration.deckId;
    const enemyDeckId = right.configuration.deckId;
    const winnerDeckId = end.winner === 'player' ? playerDeckId : end.winner === 'enemy' ? enemyDeckId : null;
    const metrics = collectCaseBattleMetrics(initialUnits, logs, end, { player: playerDeckId, enemy: enemyDeckId });
    return {
        caseId: battleCase.id,
        league: battleCase.league,
        checkpointA: battleCase.checkpointA,
        checkpointB: battleCase.checkpointB,
        placementA: battleCase.placementA,
        placementB: battleCase.placementB,
        sideDirection: battleCase.sideDirection,
        repetition: battleCase.repetition,
        deckAId: deckA.id,
        deckBId: deckB.id,
        playerDeckId,
        enemyDeckId,
        winner: end.winner,
        winnerDeckId,
        playerAugmentIds: [...playerAugmentIds],
        playerHp,
        endReason: end.endReason,
        endTick: end.tick,
        maxTicks,
        survivingPlayers: end.survivingPlayers,
        survivingEnemies: end.survivingEnemies,
        survivingPlayerHp: end.survivingPlayerHp,
        survivingEnemyHp: end.survivingEnemyHp,
        logCount: logs.length,
        logDigest: digest(logs),
        seeds: { ...battleCase.seeds },
        configurations,
        unitMetrics: metrics.units,
        diagnostics: metrics.diagnostics
    };
}
