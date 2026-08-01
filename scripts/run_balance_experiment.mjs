import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { BattleEngine, createSeededRandom } from '../js/battleEngine.js';
import { createInitialState } from '../js/core/GameState.js';
import { COMPOSITION_PATHS } from '../js/enemyAi.js';
import { ITEM_POOLS, SYNERGIES, UNIT_POOL } from '../js/data.js';
import { ITEMS } from '../js/items.js';
import { getActiveSynergyLevel, getSynergyData, SynergyManager } from '../js/systems/SynergyManager.js';
import { createUnitInstance, prepareBattle } from '../js/battle/combatPreparation.js';

export const BALANCE_PRESETS = Object.freeze([
    { id: 'early', kind: 'growth', stage: '2-1', phase: 'early', level: 4, maxTier: 2, star: 1, itemCount: 0, strengthTier: 'weak' },
    { id: 'mid', kind: 'growth', stage: '4-1', phase: 'mid', level: 6, maxTier: 3, star: 2, itemCount: 1, strengthTier: 'normal' },
    { id: 'late', kind: 'growth', stage: '6-1', phase: 'final', level: 8, maxTier: 5, star: 2, itemCount: 2, strengthTier: 'strong' },
    { id: 'star-1', kind: 'star', stage: '4-1', phase: 'mid', level: 6, maxTier: 3, star: 1, itemCount: 1, strengthTier: 'normal' },
    { id: 'star-2', kind: 'star', stage: '4-1', phase: 'mid', level: 6, maxTier: 3, star: 2, itemCount: 1, strengthTier: 'normal' },
    { id: 'star-3', kind: 'star', stage: '4-1', phase: 'mid', level: 6, maxTier: 3, star: 3, itemCount: 1, strengthTier: 'normal' }
]);

export const PLACEMENT_PATTERNS = Object.freeze(['standard', 'mirrored', 'spread']);

const values = value => Array.isArray(value) ? value : [value];
const hasRole = (unit, role) => values(unit.role).includes(role);
const combinedItems = new Set(ITEMS.filter(item => item.type === 'combined').map(item => item.id));

function scaledUnit(template, star, itemCount, random, instanceId, teamRole) {
    const pool = (ITEM_POOLS[template.archetype] || []).filter(id => combinedItems.has(id));
    const itemIds = [];
    while (itemIds.length < itemCount && pool.length) {
        const index = Math.floor(random() * pool.length);
        itemIds.push(pool.splice(index, 1)[0]);
    }
    return createUnitInstance(template, { star, itemIds, instanceId, teamRole, random });
}

function selectCompositionUnits(composition, preset) {
    const ids = [...new Set([...(composition[preset.phase] || []), ...composition.optionalUnits])];
    const candidates = ids.map(id => UNIT_POOL.find(unit => unit.id === id)).filter(unit => unit && unit.tier <= preset.maxTier);
    const selected = [];
    const take = predicate => {
        const candidate = candidates.filter(unit => !selected.includes(unit) && predicate(unit)).sort((a, b) => b.tier - a.tier || a.id.localeCompare(b.id))[0];
        if (candidate) selected.push(candidate);
    };
    take(unit => hasRole(unit, 'tank'));
    take(unit => hasRole(unit, 'dealer'));
    take(unit => hasRole(unit, 'support'));
    candidates.sort((a, b) => b.tier - a.tier || a.id.localeCompare(b.id)).forEach(unit => {
        if (selected.length < preset.level && !selected.includes(unit)) selected.push(unit);
    });
    return selected.slice(0, preset.level);
}

function arrangeUnits(units, isEnemy, pattern) {
    const board = Array(24).fill(null);
    const columns = pattern === 'spread' ? [0, 7, 1, 6, 2, 5, 3, 4] : pattern === 'mirrored' ? [4, 3, 5, 2, 6, 1, 7, 0] : [3, 4, 2, 5, 1, 6, 0, 7];
    const frontRow = isEnemy ? 2 : 0;
    const backRow = isEnemy ? 0 : 2;
    const rows = {
        tank: columns.map(column => frontRow * 8 + column),
        melee: columns.map(column => 8 + column),
        ranged: columns.map(column => backRow * 8 + column)
    };
    units.forEach(unit => {
        const preferred = hasRole(unit, 'tank') ? rows.tank : unit.stats.range > 1 ? rows.ranged : rows.melee;
        const slot = preferred.find(index => !board[index]) ?? [...rows.tank, ...rows.melee, ...rows.ranged].find(index => !board[index]);
        board[slot] = unit;
    });
    return board;
}

function activeSynergies(board) {
    const counts = getSynergyData(board);
    const active = [];
    for (const [type, traits] of Object.entries(counts)) {
        for (const [name, count] of Object.entries(traits)) {
            const definition = SYNERGIES[type]?.[name];
            if (!definition) continue;
            const level = getActiveSynergyLevel(count, Object.keys(definition.levels), definition.exactMatch);
            if (level) active.push({ type, name, count, level });
        }
    }
    return active;
}

export function buildExperimentBoard(composition, preset, pattern, isEnemy, seed) {
    const random = createSeededRandom(seed);
    const units = selectCompositionUnits(composition, preset).map((template, index) => scaledUnit(
        template,
        preset.star,
        preset.itemCount,
        random,
        `${composition.id}:${preset.id}:${index}:${template.id}`,
        isEnemy ? 'opponent' : 'player'
    ));
    return arrangeUnits(units, isEnemy, pattern);
}

function unitKey(unit) {
    return `${unit.team}:${unit.instanceId}`;
}

function collectBattleMetrics(engine, initialUnits, logs, metadata) {
    const byIndex = new Map();
    const units = new Map();
    initialUnits.forEach(unit => {
        const entry = {
            id: unit.id,
            name: unit.name,
            team: unit.team,
            composition: unit.team === 'player' ? metadata.playerComposition : metadata.enemyComposition,
            strengthTier: unit.team === 'player' ? metadata.playerStrengthTier : metadata.enemyStrengthTier,
            star: unit.star || 1,
            tier: unit.tier,
            items: [...(unit.items || [])],
            damage: 0,
            damageTaken: 0,
            healing: 0,
            skillCasts: 0,
            survivalTicks: null
        };
        byIndex.set(unit.gridIndex, entry);
        units.set(unitKey(unit), entry);
    });
    const find = index => byIndex.get(index);
    const end = logs.findLast(log => log.type === 'end') || { tick: engine.maxTicks, winner: 'draw', survivingPlayers: 0, survivingEnemies: 0 };
    let firstDeathTick = null;
    const skillCasters = new Map();
    const unresolvedDamage = [];
    for (const log of logs) {
        if (log.type === 'move') {
            const unit = find(log.unit);
            if (unit) { byIndex.delete(log.unit); byIndex.set(log.to, unit); }
        } else if (log.type === 'attack') {
            const source = find(log.from);
            const target = find(log.to);
            if (source) source.damage += log.dmg || 0;
            if (target) target.damageTaken += log.dmg || 0;
        } else if (log.type === 'damage') {
            const source = find(log.source);
            const target = find(log.target);
            if (source) source.damage += log.dmg || 0;
            else if (target && log.dmg > 0) unresolvedDamage.push({ tick: log.tick, target, amount: log.dmg });
            if (target) target.damageTaken += log.dmg || 0;
        } else if (log.type === 'heal') {
            const target = find(log.target);
            if (target) target.healing += log.amount || 0;
        } else if (log.type === 'skill') {
            const caster = find(log.caster);
            if (caster) {
                caster.skillCasts++;
                const key = `${log.tick}:${caster.team}`;
                const casters = skillCasters.get(key) || [];
                casters.push(caster);
                skillCasters.set(key, casters);
            }
        } else if (log.type === 'die') {
            const target = find(log.target);
            if (target && target.survivalTicks === null) target.survivalTicks = log.tick;
            if (firstDeathTick === null) firstDeathTick = log.tick;
        }
    }
    let unattributedDamage = 0;
    unresolvedDamage.forEach(entry => {
        const sourceTeam = entry.target.team === 'player' ? 'enemy' : 'player';
        const casters = skillCasters.get(`${entry.tick}:${sourceTeam}`) || [];
        if (casters.length === 1) casters[0].damage += entry.amount;
        else unattributedDamage += entry.amount;
    });
    units.forEach(unit => { if (unit.survivalTicks === null) unit.survivalTicks = end.tick; });
    return {
        ...metadata,
        winner: end.winner,
        durationTicks: end.tick,
        firstDeathTick,
        unattributedDamage,
        survivingPlayers: end.survivingPlayers,
        survivingEnemies: end.survivingEnemies,
        units: [...units.values()]
    };
}

export function runBattleCase({ playerComposition, enemyComposition, preset, pattern, swapped, seed, playerAugments = [] }) {
    const left = swapped ? enemyComposition : playerComposition;
    const right = swapped ? playerComposition : enemyComposition;
    const playerRaw = buildExperimentBoard(left, preset, pattern, false, `${seed}:player`);
    const enemyRaw = buildExperimentBoard(right, preset, pattern, true, `${seed}:enemy`);
    const playerSynergies = activeSynergies(playerRaw);
    const enemySynergies = activeSynergies(enemyRaw);
    const state = createInitialState();
    state.gold = 50;
    const synergyManager = new SynergyManager({ state, ITEMS });
    const prepared = prepareBattle({
        player: { board: playerRaw, teamRole: 'player', applyPlayerOnlyBonuses: true },
        opponent: { board: enemyRaw, teamRole: 'opponent', applyPlayerOnlyBonuses: false },
        applySynergyStats: synergyManager.applySynergyStats.bind(synergyManager),
        random: createSeededRandom(`${seed}:synergy`)
    });
    const playerBoard = prepared.playerBoard;
    const enemyBoard = prepared.enemyBoard;
    const engine = new BattleEngine(playerBoard, enemyBoard, playerAugments, 50, seed);
    const initialUnits = engine.board.filter(Boolean).map(unit => structuredClone(unit));
    const logs = engine.run();
    return collectBattleMetrics(engine, initialUnits, logs, {
        seed,
        stage: preset.stage,
        preset: preset.id,
        experimentKind: preset.kind,
        placement: pattern,
        swapped,
        playerComposition: left.id,
        enemyComposition: right.id,
        playerStrengthTier: preset.strengthTier,
        enemyStrengthTier: preset.strengthTier,
        playerAugments,
        playerSynergies,
        enemySynergies
    });
}

function add(group, key, valuesToAdd) {
    const row = group[key] ||= { key, battles: 0, wins: 0, damage: 0, damageTaken: 0, healing: 0, skillCasts: 0, survivalTicks: 0, survivors: 0, durationTicks: 0 };
    row.battles++;
    Object.entries(valuesToAdd).forEach(([name, value]) => { row[name] = (row[name] || 0) + (value || 0); });
}

function finalize(group) {
    return Object.values(group).map(row => ({
        ...row,
        winRate: row.battles ? row.wins / row.battles : 0,
        averageDamage: row.battles ? row.damage / row.battles : 0,
        averageDamageTaken: row.battles ? row.damageTaken / row.battles : 0,
        averageHealing: row.battles ? row.healing / row.battles : 0,
        averageSkillCasts: row.battles ? row.skillCasts / row.battles : 0,
        averageSurvivalTicks: row.battles ? row.survivalTicks / row.battles : 0,
        averageSurvivors: row.battles ? row.survivors / row.battles : 0,
        averageDurationTicks: row.battles ? row.durationTicks / row.battles : 0
    }));
}

export function aggregateBattles(battles) {
    const groups = { units: {}, starControlled: {}, compositions: {}, synergies: {}, augments: {}, items: {}, matchups: {}, strengthTiers: {}, growth: {} };
    for (const battle of battles) {
        const teamWon = team => battle.winner === team;
        battle.units.forEach(unit => {
            const contribution = unit.damage + unit.damageTaken * 0.35 + unit.healing * 0.5;
            add(groups.units, `${unit.id}|${unit.star}`, { wins: teamWon(unit.team), damage: unit.damage, damageTaken: unit.damageTaken, healing: unit.healing, skillCasts: unit.skillCasts, survivalTicks: unit.survivalTicks, contribution, contributionPerCost: contribution / unit.tier });
            if (battle.experimentKind === 'star') add(groups.starControlled, `${unit.id}|${unit.star}`, { wins: teamWon(unit.team), damage: unit.damage, damageTaken: unit.damageTaken, healing: unit.healing, skillCasts: unit.skillCasts, survivalTicks: unit.survivalTicks, contribution, contributionPerCost: contribution / unit.tier });
            unit.items.forEach(item => add(groups.items, item, { wins: teamWon(unit.team), damage: unit.damage, damageTaken: unit.damageTaken, healing: unit.healing }));
        });
        for (const team of ['player', 'enemy']) {
            const composition = battle[`${team}Composition`];
            const won = teamWon(team);
            const survivors = team === 'player' ? battle.survivingPlayers : battle.survivingEnemies;
            add(groups.compositions, `${composition}|${battle.stage}`, { wins: won, survivors, durationTicks: battle.durationTicks });
            add(groups.strengthTiers, battle[`${team}StrengthTier`], { wins: won, survivors, durationTicks: battle.durationTicks });
            if (battle.experimentKind === 'growth') add(groups.growth, battle.preset, { wins: won, survivors, durationTicks: battle.durationTicks });
            const synergies = battle[`${team}Synergies`];
            synergies.forEach(synergy => add(groups.synergies, `${synergy.type}:${synergy.name}|${synergy.level}`, { wins: won, survivors }));
        }
        const augmentKey = battle.playerAugments.length ? battle.playerAugments.join('+') : 'none';
        add(groups.augments, augmentKey, { wins: battle.winner === 'player', survivors: battle.survivingPlayers, durationTicks: battle.durationTicks });
        add(groups.matchups, `${battle.playerComposition} vs ${battle.enemyComposition}|${battle.stage}`, { wins: battle.winner === 'player', survivors: battle.survivingPlayers, durationTicks: battle.durationTicks });
    }
    const aggregates = Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, finalize(group)]));
    [...aggregates.units, ...aggregates.starControlled].forEach(row => {
        row.averageContribution = row.contribution / row.battles;
        row.contributionPerCost = row.contributionPerCost / row.battles;
    });
    const durations = battles.map(battle => battle.durationTicks).sort((a, b) => a - b);
    const firstDeaths = battles.map(battle => battle.firstDeathTick).filter(Number.isFinite).sort((a, b) => a - b);
    const percentile = (list, ratio) => list.length ? list[Math.min(list.length - 1, Math.floor(list.length * ratio))] : null;
    aggregates.distributions = { duration: { p50: percentile(durations, 0.5), p90: percentile(durations, 0.9), max: durations.at(-1) ?? null }, firstDeath: { p50: percentile(firstDeaths, 0.5), p90: percentile(firstDeaths, 0.9), min: firstDeaths[0] ?? null } };
    aggregates.starEfficiency = aggregates.starControlled.map(row => ({ key: row.key, contributionPerCost: row.contributionPerCost, winRate: row.winRate }));
    aggregates.synergyLevelEfficiency = aggregates.synergies.map(row => ({ key: row.key, winRate: row.winRate, averageSurvivors: row.averageSurvivors }));
    return aggregates;
}

function csvRows(aggregates) {
    const columns = ['category', 'key', 'battles', 'winRate', 'averageDamage', 'averageDamageTaken', 'averageHealing', 'averageSkillCasts', 'averageSurvivalTicks', 'contributionPerCost', 'averageSurvivors', 'averageDurationTicks'];
    const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [columns.join(',')];
    for (const category of ['units', 'compositions', 'synergies', 'augments', 'items', 'matchups', 'strengthTiers', 'growth']) {
        aggregates[category].forEach(row => rows.push(columns.map(column => escape(column === 'category' ? category : row[column])).join(',')));
    }
    return rows.join('\n');
}

export function runBalanceExperiment(options = {}) {
    const repetitions = Math.max(1, options.repetitions ?? 1);
    const baseSeed = options.baseSeed || 'balance-v1';
    const compositions = options.compositions || COMPOSITION_PATHS;
    const presets = options.presets || BALANCE_PRESETS;
    const placements = options.placements || PLACEMENT_PATTERNS;
    const augmentSets = options.augmentSets || [[]];
    const battles = [];
    const failures = [];
    for (let left = 0; left < compositions.length; left++) {
        for (let right = left + 1; right < compositions.length; right++) {
            for (const preset of presets) {
                for (const pattern of placements) {
                    for (const playerAugments of augmentSets) {
                        for (let repetition = 0; repetition < repetitions; repetition++) {
                            for (const swapped of [false, true]) {
                                const seed = `${baseSeed}:${compositions[left].id}:${compositions[right].id}:${preset.id}:${pattern}:${repetition}:${swapped ? 'swap' : 'base'}`;
                                try {
                                    battles.push(runBattleCase({ playerComposition: compositions[left], enemyComposition: compositions[right], preset, pattern, swapped, seed, playerAugments }));
                                } catch (error) {
                                    failures.push({ seed, playerComposition: compositions[left].id, enemyComposition: compositions[right].id, preset: preset.id, placement: pattern, swapped, playerAugments, error: error instanceof Error ? error.message : String(error) });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return { metadata: { version: 1, baseSeed, repetitions, battleCount: battles.length, failureCount: failures.length, compositions: compositions.map(value => value.id), presets: presets.map(value => value.id), placements, augmentSets }, failures, battles, aggregates: aggregateBattles(battles) };
}

export function writeBalanceResults(result, outputDir = path.resolve('reports/balance')) {
    fs.mkdirSync(outputDir, { recursive: true });
    const jsonPath = path.join(outputDir, 'balance-latest.json');
    const csvPath = path.join(outputDir, 'balance-latest.csv');
    fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    fs.writeFileSync(csvPath, `${csvRows(result.aggregates)}\n`, 'utf8');
    return { jsonPath, csvPath };
}

async function main() {
    const repetitions = Math.max(1, Number.parseInt(process.env.BALANCE_REPETITIONS || '1', 10) || 1);
    const baseSeed = process.env.BALANCE_SEED || 'balance-v1';
    const selectedIds = (process.env.BALANCE_COMPS || '').split(',').map(value => value.trim()).filter(Boolean);
    const compositions = selectedIds.length ? COMPOSITION_PATHS.filter(value => selectedIds.includes(value.id)) : COMPOSITION_PATHS;
    const augmentIds = (process.env.BALANCE_AUGMENTS || '').split(',').map(value => value.trim()).filter(Boolean);
    const augmentSets = [[], ...augmentIds.map(id => [id])];
    if (compositions.length < 2) throw new Error('BALANCE_COMPS에는 존재하는 조합 ID를 2개 이상 지정해야 합니다.');
    const result = runBalanceExperiment({ repetitions, baseSeed, compositions, augmentSets });
    const paths = writeBalanceResults(result, process.env.BALANCE_OUTPUT_DIR || path.resolve('reports/balance'));
    console.log(JSON.stringify({ metadata: result.metadata, distributions: result.aggregates.distributions, output: paths }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch(error => { console.error(error); process.exitCode = 1; });
}
