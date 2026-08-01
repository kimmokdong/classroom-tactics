import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    countCaseSuite,
    createLeagueMatchups,
    iterateCaseSuite,
    parseCaseId,
    validateSimulationProfile
} from './create-case-suite.mjs';
import { createBattleAggregator } from './aggregate-battle-results.mjs';
import { runBattleCase } from './run-battle-case.mjs';
import { validateStandardDecks } from './validate-standard-decks.mjs';
import { canonicalJson } from './write-results.mjs';

export function loadSimulationInputs({
    decksPath = 'balance/standard-decks.json',
    profilesPath = 'balance/simulation-profiles.json',
    targetBandsPath = 'balance/target-bands.json'
} = {}) {
    const data = JSON.parse(fs.readFileSync(path.resolve(decksPath), 'utf8'));
    const validation = validateStandardDecks(data);
    if (!validation.valid) throw new Error(`표준 덱 검증 실패:\n${validation.errors.join('\n')}`);
    const profileFile = JSON.parse(fs.readFileSync(path.resolve(profilesPath), 'utf8'));
    if (!profileFile.profiles || typeof profileFile.profiles !== 'object') throw new Error('시뮬레이션 프로필 파일 형식이 잘못되었습니다.');
    const targetBands = JSON.parse(fs.readFileSync(path.resolve(targetBandsPath), 'utf8'));
    return { data, profiles: profileFile.profiles, profileSchemaVersion: profileFile.schemaVersion, targetBands };
}

const matchupKey = row => `${row.league}|${row.deckAId}|${row.deckBId}`;

export function compactBattleResult(result, outputDetail = 'summary') {
    const summary = {
        caseId: result.caseId,
        league: result.league,
        deckAId: result.deckAId,
        deckBId: result.deckBId,
        endReason: result.endReason,
        winnerDeckId: result.winnerDeckId,
        endTick: result.endTick
    };
    if (outputDetail === 'summary') return summary;
    return {
        ...summary,
        checkpointA: result.checkpointA,
        checkpointB: result.checkpointB,
        placementA: result.placementA,
        placementB: result.placementB,
        sideDirection: result.sideDirection,
        repetition: result.repetition,
        playerDeckId: result.playerDeckId,
        enemyDeckId: result.enemyDeckId,
        winner: result.winner,
        survivingPlayers: result.survivingPlayers,
        survivingEnemies: result.survivingEnemies,
        survivingPlayerHp: result.survivingPlayerHp,
        survivingEnemyHp: result.survivingEnemyHp,
        logDigest: result.logDigest,
        seeds: result.seeds
    };
}

export function runStandardDecks({
    data,
    profiles,
    targetBands,
    profileName = 'smoke',
    caseId,
    maxTicks = 600,
    runCase = runBattleCase,
    matchupKeys,
    rawOutputPath,
    resultLedgerPath,
    retainResults = true
}) {
    const profile = profiles?.[profileName];
    if (!profile) throw new Error(`알 수 없는 시뮬레이션 프로필: ${profileName}`);
    validateSimulationProfile(profile, profileName);
    const decksById = new Map(data.decks.map(deck => [deck.id, deck]));
    const selectedMatchups = matchupKeys ? new Set(matchupKeys) : null;
    if (selectedMatchups) {
        const validMatchupKeys = new Set(createLeagueMatchups(data).map(matchupKey));
        const invalid = [...selectedMatchups].find(key => !validMatchupKeys.has(key));
        if (invalid) throw new Error(`알 수 없는 matchup key: ${invalid}`);
    }
    const allCases = caseId ? [parseCaseId(data, caseId)] : iterateCaseSuite(data, profile);
    const cases = selectedMatchups
        ? (function* () { for (const battleCase of allCases) if (selectedMatchups.has(matchupKey(battleCase))) yield battleCase; })()
        : allCases;
    const casesPerMatchup = countCaseSuite(data, profile) / createLeagueMatchups(data).length;
    const expectedCaseCount = caseId ? 1 : selectedMatchups ? selectedMatchups.size * casesPerMatchup : countCaseSuite(data, profile);
    const results = [];
    const failures = [];
    const aggregator = createBattleAggregator(data, targetBands);
    const streamRawResults = Boolean(rawOutputPath);
    const streamResultLedger = Boolean(resultLedgerPath);
    let successCount = 0;
    let rawFile;
    let ledgerFile;
    let firstLedgerResult = true;
    if (streamRawResults) {
        fs.mkdirSync(path.dirname(path.resolve(rawOutputPath)), { recursive: true });
        rawFile = fs.openSync(path.resolve(rawOutputPath), 'w');
    }
    if (streamResultLedger) {
        fs.mkdirSync(path.dirname(path.resolve(resultLedgerPath)), { recursive: true });
        ledgerFile = fs.openSync(path.resolve(resultLedgerPath), 'w');
    }

    try {
        for (const battleCase of cases) {
            try {
                const result = runCase(battleCase, { decksById, maxTicks });
                aggregator.addResult(result);
                successCount++;
                const compact = compactBattleResult(result, profile.outputDetail);
                if (rawFile !== undefined) {
                    const rawResult = profile.outputDetail === 'full' ? result : compact;
                    fs.writeSync(rawFile, `${JSON.stringify(rawResult)}\n`);
                }
                if (ledgerFile !== undefined) {
                    fs.writeSync(ledgerFile, `${firstLedgerResult ? '' : ','}${canonicalJson(compact)}`);
                    firstLedgerResult = false;
                } else if (retainResults) {
                    results.push(compact);
                }
            } catch (error) {
                const failure = {
                caseId: battleCase.id,
                league: battleCase.league,
                deckAId: battleCase.deckAId,
                deckBId: battleCase.deckBId,
                checkpointA: battleCase.checkpointA,
                checkpointB: battleCase.checkpointB,
                placementA: battleCase.placementA,
                placementB: battleCase.placementB,
                sideDirection: battleCase.sideDirection,
                repetition: battleCase.repetition,
                seeds: { ...battleCase.seeds },
                name: error?.name || 'Error',
                message: error?.message || String(error)
                };
                failures.push(failure);
                aggregator.addFailure(failure);
            }
        }
    } finally {
        if (rawFile !== undefined) fs.closeSync(rawFile);
        if (ledgerFile !== undefined) fs.closeSync(ledgerFile);
    }

    const statistics = aggregator.finalize();
    return {
        summary: {
            rulesVersion: data.rulesVersion,
            profile: profileName,
            directCase: caseId || null,
            expectedCaseCount,
            successCount,
            failureCount: failures.length
        },
        statistics,
        results,
        failures,
        rawResultsPath: streamRawResults ? path.resolve(rawOutputPath) : null,
        resultLedgerPath: streamResultLedger ? path.resolve(resultLedgerPath) : null
    };
}

export function parseCliArguments(args) {
    const options = { profileName: 'smoke' };
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--profile') {
            if (!args[index + 1]) throw new Error('--profile 값이 필요합니다.');
            options.profileName = args[++index];
        } else if (argument === '--case') {
            if (!args[index + 1]) throw new Error('--case 값이 필요합니다.');
            options.caseId = args[++index];
        } else if (argument === '--help') {
            options.help = true;
        } else {
            throw new Error(`알 수 없는 옵션: ${argument}`);
        }
    }
    return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    try {
        const options = parseCliArguments(process.argv.slice(2));
        if (options.help) {
            console.log('사용법: node scripts/balance-simulator/run-standard-decks.mjs [--profile smoke|quick|standard|deep] [--case "CASE_ID"]');
        } else {
            const inputs = loadSimulationInputs();
            const run = runStandardDecks({ ...inputs, ...options });
            const output = options.caseId ? run : { summary: run.summary, statistics: run.statistics, failures: run.failures };
            console.log(JSON.stringify(output, null, 2));
            if (run.failures.length > 0) process.exitCode = 1;
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
