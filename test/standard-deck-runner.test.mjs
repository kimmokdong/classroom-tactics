import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    countCaseSuite,
    createCaseSuite,
    createLeagueMatchups,
    parseCaseId,
    validateSimulationProfile
} from '../scripts/balance-simulator/create-case-suite.mjs';
import { runBattleCase } from '../scripts/balance-simulator/run-battle-case.mjs';
import { parseCliArguments, runStandardDecks } from '../scripts/balance-simulator/run-standard-decks.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../balance/standard-decks.json', import.meta.url), 'utf8'));
const profileFile = JSON.parse(fs.readFileSync(new URL('../balance/simulation-profiles.json', import.meta.url), 'utf8'));
const profiles = profileFile.profiles;
const decksById = new Map(data.decks.map(deck => [deck.id, deck]));
const strategyByDeck = new Map(data.decks.map(deck => [deck.id, deck.strategyGroup]));

test('리그별 대진 수와 참가 전략군이 정확하다', () => {
    const matchups = createLeagueMatchups(data);
    const counts = Object.fromEntries(Object.entries(Object.groupBy(matchups, row => row.league))
        .map(([league, rows]) => [league, rows.length]));
    assert.deepEqual(counts, {
        'internal:reroll_core7': 15,
        'internal:reroll_final8': 15,
        'internal:standard_core8': 15,
        'internal:standard_final9': 15,
        'internal:highvalue_final9': 91,
        'cross:level8': 36,
        'cross:level9': 84,
        'open:final': 325
    });
    assert.equal(matchups.length, 596);

    for (const row of matchups) {
        const groupA = strategyByDeck.get(row.deckAId);
        const groupB = strategyByDeck.get(row.deckBId);
        if (row.league.startsWith('internal:')) {
            assert.equal(groupA, row.league.slice('internal:'.length));
            assert.equal(groupB, groupA);
        } else if (row.league === 'cross:level8') {
            assert.equal(groupA, 'reroll_final8');
            assert.equal(groupB, 'standard_core8');
        } else if (row.league === 'cross:level9') {
            assert.equal(groupA, 'standard_final9');
            assert.equal(groupB, 'highvalue_final9');
        } else {
            assert.equal(row.league, 'open:final');
            assert.ok(['reroll_final8', 'standard_final9', 'highvalue_final9'].includes(groupA));
            assert.ok(['reroll_final8', 'standard_final9', 'highvalue_final9'].includes(groupB));
        }
    }
});

test('프로필별 case 수와 3×3 배치·좌우 조합이 안정적이다', () => {
    const expectedCounts = { smoke: 3_576, quick: 42_912, standard: 128_736, deep: 343_296 };
    for (const [name, expected] of Object.entries(expectedCounts)) {
        assert.equal(validateSimulationProfile(profiles[name], name), profiles[name]);
        assert.equal(countCaseSuite(data, profiles[name]), expected);
    }

    const cases = createCaseSuite(data, profiles.quick);
    assert.equal(cases.length, expectedCounts.quick);
    assert.equal(new Set(cases.map(row => row.id)).size, cases.length);
    assert.ok(cases.every(row => row.id.split('|').length === 10));

    const first = cases[0];
    const oneMatchup = cases.filter(row => row.league === first.league
        && row.deckAId === first.deckAId
        && row.deckBId === first.deckBId
        && row.repetition === first.repetition);
    assert.equal(oneMatchup.length, 18);
    assert.equal(new Set(oneMatchup.map(row => `${row.placementA}|${row.placementB}`)).size, 9);
    assert.deepEqual(new Set(oneMatchup.map(row => row.sideDirection)), new Set(['a-left', 'b-left']));

    const smokeCases = createCaseSuite(data, profiles.smoke);
    assert.ok(smokeCases.every(row => row.placementA === row.placementB));
    assert.equal(smokeCases.filter(row => row.league === smokeCases[0].league
        && row.deckAId === smokeCases[0].deckAId
        && row.deckBId === smokeCases[0].deckBId).length, 6);
});

test('동일 case는 같은 결과를 내고 최대 전투 시간을 넘지 않는다', () => {
    const battleCase = createCaseSuite(data, profiles.smoke)[0];
    const first = runBattleCase(battleCase, { decksById });
    const second = runBattleCase(battleCase, { decksById });
    assert.deepEqual(second, first);
    assert.ok(first.endTick <= first.maxTicks);
    assert.equal(first.maxTicks, 600);
});

test('좌우 교대 후 논리 덱 구성과 아이템은 그대로 유지된다', () => {
    const cases = createCaseSuite(data, profiles.quick);
    const donationDeckId = data.decks.find(deck => deck.units.some(unit => unit.unitId === 'u5_5')).id;
    const base = cases.find(row => row.sideDirection === 'a-left'
        && (row.deckAId === donationDeckId || row.deckBId === donationDeckId));
    const swapped = cases.find(row => row.league === base.league
        && row.deckAId === base.deckAId
        && row.deckBId === base.deckBId
        && row.placementA === base.placementA
        && row.placementB === base.placementB
        && row.repetition === base.repetition
        && row.sideDirection === 'b-left');
    assert.ok(swapped);
    assert.equal(base.seeds.deckA, swapped.seeds.deckA);
    assert.equal(base.seeds.deckB, swapped.seeds.deckB);
    assert.equal(base.seeds.itemA, swapped.seeds.itemA);
    assert.equal(base.seeds.itemB, swapped.seeds.itemB);
    assert.notEqual(base.seeds.battle, swapped.seeds.battle);

    const baseResult = runBattleCase(base, { decksById });
    const swappedResult = runBattleCase(swapped, { decksById });
    assert.deepEqual(swappedResult.configurations, baseResult.configurations);
    assert.ok(Object.values(baseResult.configurations)
        .flatMap(configuration => configuration.units)
        .some(unit => unit.donationItems.length > 0));
    for (const metric of baseResult.unitMetrics.filter(unit => !unit.isSummon)) {
        const configuration = metric.deckId === baseResult.deckAId
            ? baseResult.configurations.deckA
            : baseResult.configurations.deckB;
        const configuredUnit = configuration.units.find(unit => unit.unitId === metric.unitId);
        assert.deepEqual(metric.items, configuredUnit.items);
    }
    assert.equal(baseResult.playerDeckId, base.deckAId);
    assert.equal(swappedResult.playerDeckId, base.deckBId);
});

test('case ID를 직접 복원해 한 건만 재실행할 수 있다', () => {
    const battleCase = createCaseSuite(data, profiles.quick)[37];
    assert.deepEqual(parseCaseId(data, battleCase.id), battleCase);
    const run = runStandardDecks({ data, profiles, profileName: 'quick', caseId: battleCase.id });
    assert.deepEqual(run.summary, {
        rulesVersion: data.rulesVersion,
        profile: 'quick',
        directCase: battleCase.id,
        expectedCaseCount: 1,
        successCount: 1,
        failureCount: 0
    });
    assert.equal(run.results[0].caseId, battleCase.id);
    assert.deepEqual(parseCliArguments(['--profile', 'deep', '--case', battleCase.id]), {
        profileName: 'deep',
        caseId: battleCase.id
    });
});

test('실패 case를 격리하고 같은 ID·시드로 단독 재현한다', () => {
    let firstCaseId;
    const batch = runStandardDecks({
        data,
        profiles,
        profileName: 'smoke',
        runCase: battleCase => {
            firstCaseId ||= battleCase.id;
            if (battleCase.id === firstCaseId) throw new Error('의도한 실패');
            return { caseId: battleCase.id };
        }
    });
    assert.equal(batch.summary.expectedCaseCount, 3_576);
    assert.equal(batch.summary.successCount, 3_575);
    assert.equal(batch.summary.failureCount, 1);
    assert.equal(batch.failures[0].caseId, firstCaseId);

    const rerun = runStandardDecks({
        data,
        profiles,
        profileName: 'smoke',
        caseId: batch.failures[0].caseId,
        runCase: () => { throw new Error('의도한 실패'); }
    });
    assert.equal(rerun.summary.expectedCaseCount, 1);
    assert.equal(rerun.failures[0].caseId, batch.failures[0].caseId);
    assert.deepEqual(rerun.failures[0].seeds, batch.failures[0].seeds);
});

test('작은 maxTicks에서도 종료 로그를 만들며 무한 반복하지 않는다', () => {
    const battleCase = createCaseSuite(data, profiles.smoke)[0];
    const result = runBattleCase(battleCase, { decksById, maxTicks: 1 });
    assert.equal(result.endTick, 1);
    assert.equal(result.maxTicks, 1);
    assert.equal(result.winner, 'draw');
    assert.throws(() => runBattleCase(battleCase, { decksById, maxTicks: 0 }), /maxTicks/);
});

test('선별 Standard는 지정한 상성만 216 case로 확대한다', () => {
    const matchup = createLeagueMatchups(data)[0];
    const key = `${matchup.league}|${matchup.deckAId}|${matchup.deckBId}`;
    const run = runStandardDecks({
        data,
        profiles,
        profileName: 'standard',
        matchupKeys: [key],
        runCase: battleCase => ({
            ...battleCase,
            caseId: battleCase.id,
            playerDeckId: battleCase.deckAId,
            enemyDeckId: battleCase.deckBId,
            winnerDeckId: null,
            endReason: 'simultaneous-draw',
            endTick: 1,
            survivingPlayers: 0,
            survivingEnemies: 0,
            survivingPlayerHp: 0,
            survivingEnemyHp: 0,
            unitMetrics: [],
            diagnostics: {},
            configurations: {}
        })
    });
    assert.equal(run.summary.expectedCaseCount, 216);
    assert.equal(run.summary.successCount, 216);
    assert.equal(run.statistics.matchups.length, 1);
});

test('Deep 상세 결과는 NDJSON으로 스트리밍하고 canonical에는 경량 case만 남긴다', () => {
    const battleCase = createCaseSuite(data, profiles.smoke)[0];
    const rawOutputPath = path.join(os.tmpdir(), `deep-raw-${process.pid}.ndjson`);
    try {
        const run = runStandardDecks({ data, profiles, profileName: 'deep', caseId: battleCase.id, rawOutputPath });
        assert.equal('unitMetrics' in run.results[0], false);
        const raw = JSON.parse(fs.readFileSync(rawOutputPath, 'utf8').trim());
        assert.ok(raw.unitMetrics.length > 0);
        assert.equal(raw.caseId, run.results[0].caseId);
    } finally {
        fs.rmSync(rawOutputPath, { force: true });
    }
});
