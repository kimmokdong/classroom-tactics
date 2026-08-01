import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { compareBalanceRuns, getBaseline, setBaseline } from './compare-runs.mjs';
import { analyzeImpact, createInputFingerprint } from './impact-analysis.mjs';
import { loadSimulationInputs, runStandardDecks } from './run-standard-decks.mjs';
import { readBalanceRun, writeBalanceRun } from './write-results.mjs';

export function parseSimulationCliArguments(args) {
    const options = { setBaseline: false };
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--profile') {
            if (!args[index + 1]) throw new Error('--profile 값이 필요합니다.');
            options.profileName = args[++index];
        } else if (argument === '--case') {
            if (!args[index + 1]) throw new Error('--case 값이 필요합니다.');
            options.caseId = args[++index];
        } else if (argument === '--baseline') {
            if (!args[index + 1]) throw new Error('--baseline 값이 필요합니다.');
            options.baselineRunId = args[++index];
        } else if (argument === '--set-baseline') {
            options.setBaseline = true;
        } else if (argument === '--help') {
            options.help = true;
        } else {
            throw new Error(`알 수 없는 옵션: ${argument}`);
        }
    }
    return options;
}

function sameComparisonContract(before, after) {
    return ['profile', 'directCase', 'rulesVersion', 'seedSuiteVersion', 'expectedBattleCount', 'simulationProfileSchemaVersion']
        .every(field => before?.[field] === after?.[field])
        && ['simulationProfiles', 'targetBands']
            .every(field => before?.inputHashes?.[field] === after?.inputHashes?.[field]);
}

const matchupKey = row => `${row.league}|${row.deckAId}|${row.deckBId}`;

export function findSuspiciousMatchupKeys(statistics) {
    return (statistics?.matchups || [])
        .filter(row => Number.isFinite(row.scoreRate)
            && (row.scoreRate <= 0.25 || row.scoreRate >= 0.75 || row.placementSensitivity >= 0.20))
        .map(matchupKey);
}

export function simulateDecks({
    profileName,
    caseId,
    baselineRunId,
    setBaseline: shouldSetBaseline = false,
    outputRoot = path.resolve('reports/balance')
} = {}) {
    const inputs = loadSimulationInputs();
    const automaticFlow = !profileName && !caseId;
    const caseProfileName = profileName || 'quick';
    const executionProfileName = automaticFlow ? 'auto' : caseProfileName;
    const baseline = baselineRunId ? { runId: baselineRunId } : getBaseline(outputRoot);
    const previous = baseline ? readBalanceRun(baseline.runId, outputRoot) : null;
    const fingerprint = createInputFingerprint({
        data: inputs.data,
        profiles: inputs.profiles,
        profileSchemaVersion: inputs.profileSchemaVersion,
        targetBands: inputs.targetBands
    });
    const cache = analyzeImpact(previous?.manifest, fingerprint, { profile: executionProfileName, directCase: caseId || null });

    if (cache.cacheReusable && previous) {
        if (shouldSetBaseline) setBaseline(previous.manifest.runId, outputRoot);
        return {
            cached: true,
            runId: previous.manifest.runId,
            summary: previous.canonical.summary,
            reportPath: path.join(previous.runDirectory, 'report.md'),
            cache,
            comparisonPath: null,
            failures: previous.canonical.failures.map(failure => ({ ...failure, reproduce: `npm run simulate:decks -- --case "${failure.caseId}"` }))
        };
    }

    const streamLargeProfile = ['standard', 'deep'].includes(caseProfileName) && !caseId;
    const rawOutputPath = streamLargeProfile
        ? path.join(path.resolve(outputRoot), '.tmp', `battles-${process.pid}-${crypto.randomUUID()}.ndjson`)
        : undefined;
    const resultLedgerPath = streamLargeProfile
        ? path.join(path.resolve(outputRoot), '.tmp', `ledger-${process.pid}-${crypto.randomUUID()}.json-fragments`)
        : undefined;
    let run;
    let flowFailures = [];
    try {
        if (automaticFlow) {
            const smoke = runStandardDecks({ ...inputs, profileName: 'smoke' });
            const smokeSummary = { ...smoke.summary };
            flowFailures = [...smoke.failures];
            if (smoke.failures.length > 0) {
                run = smoke;
                run.summary.automaticFlow = { haltedAt: 'smoke', smoke: smokeSummary, standardExpansion: null };
            } else {
                run = runStandardDecks({ ...inputs, profileName: 'quick' });
                const suspiciousMatchupKeys = findSuspiciousMatchupKeys(run.statistics);
                const expansion = suspiciousMatchupKeys.length > 0
                    ? runStandardDecks({ ...inputs, profileName: 'standard', matchupKeys: suspiciousMatchupKeys, retainResults: false })
                    : null;
                flowFailures = [...run.failures, ...(expansion?.failures || [])];
                run.summary.automaticFlow = {
                    haltedAt: null,
                    smoke: smokeSummary,
                    suspiciousMatchupCount: suspiciousMatchupKeys.length,
                    standardExpansion: expansion?.summary || null
                };
                run.statistics.automaticFlow = {
                    smoke: { summary: smokeSummary, outcomes: smoke.statistics.outcomes, warnings: smoke.statistics.warnings },
                    standardExpansion: expansion ? {
                        matchupKeys: suspiciousMatchupKeys,
                        summary: expansion.summary,
                        outcomes: expansion.statistics.outcomes,
                        decks: expansion.statistics.decks,
                        matchups: expansion.statistics.matchups,
                        warnings: expansion.statistics.warnings,
                        failures: expansion.failures
                    } : null
                };
                if (expansion) expansion.results.length = 0;
            }
            run.summary.caseProfile = run.summary.profile;
            run.summary.profile = executionProfileName;
        } else {
            run = runStandardDecks({ ...inputs, profileName: caseProfileName, caseId, rawOutputPath, resultLedgerPath });
            flowFailures = [...run.failures];
        }

        const storage = writeBalanceRun({
            run,
            ...inputs,
            outputRoot,
            manifestContext: {
                ...fingerprint,
                cache,
                executionCommand: automaticFlow
                    ? 'npm run simulate:decks'
                    : `npm run simulate:decks -- --profile ${caseProfileName}${caseId ? ` --case "${caseId}"` : ''}`
            }
        });
        const canCompare = previous && sameComparisonContract(previous.manifest, storage.manifest);
        const comparison = canCompare
            ? compareBalanceRuns({ baselineRunId: previous.manifest.runId, candidateRunId: storage.manifest.runId, outputRoot })
            : null;
        const activeBaseline = shouldSetBaseline || !baseline
            ? setBaseline(storage.manifest.runId, outputRoot)
            : getBaseline(outputRoot);
        return {
            cached: false,
            runId: storage.manifest.runId,
            summary: run.summary,
            reportPath: path.join(storage.runDirectory, 'report.md'),
            cache,
            baseline: activeBaseline,
            comparisonPath: comparison?.comparisonDirectory || null,
            comparisonSkipped: previous && !canCompare ? 'incompatible-run-contract' : null,
            failures: flowFailures.map(failure => ({ ...failure, reproduce: `npm run simulate:decks -- --case "${failure.caseId}"` }))
        };
    } finally {
        if (rawOutputPath) fs.rmSync(rawOutputPath, { force: true });
        if (resultLedgerPath) fs.rmSync(resultLedgerPath, { force: true });
    }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    try {
        const options = parseSimulationCliArguments(process.argv.slice(2));
        if (options.help) {
            console.log('사용법: npm run simulate:decks -- [--profile smoke|quick|standard|deep] [--case CASE_ID] [--baseline RUN_ID] [--set-baseline]\n--profile 생략 시 Smoke → Quick → 의심 상성 Standard 확대를 자동 실행합니다.');
        } else {
            const result = simulateDecks(options);
            console.log(JSON.stringify(result, null, 2));
            if (result.failures.length > 0) process.exitCode = 1;
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
