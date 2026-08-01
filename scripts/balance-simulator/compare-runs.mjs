import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { readBalanceRun, writeCsv, writeJson, writeText } from './write-results.mjs';

const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function meanInterval(values) {
    const mean = average(values);
    if (values.length < 2) return { lower: null, upper: null, sampleSize: values.length };
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
    const margin = 1.96 * Math.sqrt(variance / values.length);
    return { lower: mean - margin, upper: mean + margin, sampleSize: values.length };
}

function caseScore(result) {
    if (result.endReason === 'simultaneous-draw') return 0.5;
    if (result.endReason !== 'decisive') return null;
    return result.winnerDeckId === result.deckAId ? 1 : 0;
}

function diffRows(baselineRows = [], candidateRows = [], keyOf, fields) {
    const baseline = new Map(baselineRows.map(row => [keyOf(row), row]));
    const candidate = new Map(candidateRows.map(row => [keyOf(row), row]));
    return [...new Set([...baseline.keys(), ...candidate.keys()])].sort().map(key => {
        const before = baseline.get(key) || null;
        const after = candidate.get(key) || null;
        return {
            key,
            ...Object.fromEntries(fields.map(field => [`${field}Before`, before?.[field] ?? null])),
            ...Object.fromEntries(fields.map(field => [`${field}After`, after?.[field] ?? null])),
            ...Object.fromEntries(fields.map(field => [`${field}Delta`, Number.isFinite(before?.[field]) && Number.isFinite(after?.[field]) ? after[field] - before[field] : null]))
        };
    });
}

function sourceChanged(baselineManifest, candidateManifest) {
    const before = baselineManifest.sourceHashes || {};
    const after = candidateManifest.sourceHashes || {};
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].some(key => before[key] !== after[key]);
}

export function setBaseline(runId, outputRoot = path.resolve('reports/balance')) {
    const run = readBalanceRun(runId, outputRoot);
    const baseline = { runId, canonicalHash: run.manifest.canonicalHash, setAt: new Date().toISOString() };
    writeJson(path.join(path.resolve(outputRoot), 'baselines', 'current.json'), baseline);
    return baseline;
}

export function getBaseline(outputRoot = path.resolve('reports/balance')) {
    const filePath = path.join(path.resolve(outputRoot), 'baselines', 'current.json');
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
}

export function parseCompareCliArguments(args) {
    const options = {};
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--base') {
            if (!args[index + 1]) throw new Error('--base 값이 필요합니다.');
            options.baselineRunId = args[++index];
        } else if (argument === '--candidate') {
            if (!args[index + 1]) throw new Error('--candidate 값이 필요합니다.');
            options.candidateRunId = args[++index];
        } else if (argument === '--force') {
            options.force = true;
        } else if (argument === '--help') {
            options.help = true;
        } else {
            throw new Error(`알 수 없는 옵션: ${argument}`);
        }
    }
    return options;
}

function compatibilityIssues(baseline, candidate) {
    const fields = [
        ['profile', baseline.manifest.profile, candidate.manifest.profile],
        ['directCase', baseline.manifest.directCase, candidate.manifest.directCase],
        ['rulesVersion', baseline.manifest.rulesVersion ?? baseline.canonical.summary.rulesVersion, candidate.manifest.rulesVersion ?? candidate.canonical.summary.rulesVersion],
        ['seedSuiteVersion', baseline.manifest.seedSuiteVersion, candidate.manifest.seedSuiteVersion],
        ['expectedBattleCount', baseline.manifest.expectedBattleCount, candidate.manifest.expectedBattleCount],
        ['simulationProfileSchemaVersion', baseline.manifest.simulationProfileSchemaVersion, candidate.manifest.simulationProfileSchemaVersion]
    ];
    const issues = fields.flatMap(([field, before, after]) => before === after ? [] : [`${field}: ${JSON.stringify(before)} ≠ ${JSON.stringify(after)}`]);
    for (const input of ['simulationProfiles', 'targetBands']) {
        const before = baseline.manifest.inputHashes?.[input];
        const after = candidate.manifest.inputHashes?.[input];
        if (before !== after) issues.push(`inputHashes.${input}: ${JSON.stringify(before)} ≠ ${JSON.stringify(after)}`);
    }
    const baselineCases = new Set([...baseline.canonical.results, ...baseline.canonical.failures].map(row => row.caseId));
    const candidateCases = new Set([...candidate.canonical.results, ...candidate.canonical.failures].map(row => row.caseId));
    if (baselineCases.size !== candidateCases.size || [...baselineCases].some(caseId => !candidateCases.has(caseId))) {
        issues.push(`caseSet: ${baselineCases.size}개 ≠ ${candidateCases.size}개`);
    }
    return issues;
}

export function compareBalanceRuns({ baselineRunId, candidateRunId, outputRoot = path.resolve('reports/balance'), force = false }) {
    const baseline = readBalanceRun(baselineRunId, outputRoot);
    const candidate = readBalanceRun(candidateRunId, outputRoot);
    const incompatibilities = compatibilityIssues(baseline, candidate);
    if (incompatibilities.length > 0 && !force) {
        throw new Error(`호환되지 않는 실행은 비교할 수 없습니다: ${incompatibilities.join('; ')}`);
    }
    const baselineByCase = new Map(baseline.canonical.results.map(result => [result.caseId, result]));
    const baselineCaseIds = new Set([...baseline.canonical.results, ...baseline.canonical.failures].map(row => row.caseId));
    const candidateCaseIds = new Set([...candidate.canonical.results, ...candidate.canonical.failures].map(row => row.caseId));
    const intersectionCount = [...baselineCaseIds].filter(caseId => candidateCaseIds.has(caseId)).length;
    const pairs = candidate.canonical.results.flatMap(after => {
        const before = baselineByCase.get(after.caseId);
        const beforeScore = before && caseScore(before);
        const afterScore = caseScore(after);
        return beforeScore === null || beforeScore === undefined || afterScore === null ? [] : [{ caseId: after.caseId, beforeScore, afterScore, delta: afterScore - beforeScore }];
    });
    const deltas = pairs.map(pair => pair.delta);
    const deckDiff = diffRows(baseline.canonical.statistics.decks, candidate.canonical.statistics.decks, row => `${row.league}|${row.deckId}`, ['scoreRate', 'decisiveWinRate', 'averageBattleTime', 'maxTimeRate', 'failureRate']);
    const matchupDiff = diffRows(baseline.canonical.statistics.matchups, candidate.canonical.statistics.matchups, row => `${row.league}|${row.deckAId}|${row.deckBId}`, ['scoreRate', 'deckBScoreRate', 'maxTimeRate', 'failureRate']);
    const unitDiff = diffRows(baseline.canonical.statistics.units, candidate.canonical.statistics.units, row => `${row.league}|${row.unitId}|${row.star}`, ['scoreRate', 'averageDamage', 'averageDamageTaken', 'averageHealing', 'averageShielding']);
    const synergyDiff = diffRows(baseline.canonical.statistics.synergies, candidate.canonical.statistics.synergies, row => `${row.league}|${row.type}|${row.name}|${row.level}`, ['scoreRate']);
    const warnings = [
        ...(incompatibilities.length ? [`강제 비교: ${incompatibilities.join('; ')}`] : []),
        ...(sourceChanged(baseline.manifest, candidate.manifest) ? ['전투 기반 코드가 변경되어 완전한 순수 수치 A/B 비교가 아님'] : [])
    ];
    const comparison = {
        schemaVersion: 1,
        baseline: { runId: baselineRunId, canonicalHash: baseline.manifest.canonicalHash },
        candidate: { runId: candidateRunId, canonicalHash: candidate.manifest.canonicalHash },
        warnings,
        caseCompatibility: {
            baselineCaseCount: baselineCaseIds.size,
            candidateCaseCount: candidateCaseIds.size,
            intersectionCount,
            baselineOnlyCount: baselineCaseIds.size - intersectionCount,
            candidateOnlyCount: candidateCaseIds.size - intersectionCount
        },
        paired: {
            pairedCaseCount: pairs.length,
            pairedDelta: average(deltas),
            pairedConfidenceInterval: meanInterval(deltas),
            winToLossFlipCount: pairs.filter(pair => pair.beforeScore === 1 && pair.afterScore === 0).length,
            lossToWinFlipCount: pairs.filter(pair => pair.beforeScore === 0 && pair.afterScore === 1).length
        },
        deckDiff,
        matchupDiff,
        unitDiff,
        synergyDiff,
        failureDelta: candidate.canonical.failures.length - baseline.canonical.failures.length
    };
    const comparisonDirectory = path.join(path.resolve(outputRoot), 'comparisons', `${baselineRunId}__${candidateRunId}`);
    writeJson(path.join(comparisonDirectory, 'comparison.json'), comparison);
    writeCsv(path.join(comparisonDirectory, 'deck-diff.csv'), deckDiff, ['key', 'scoreRateBefore', 'scoreRateAfter', 'scoreRateDelta', 'decisiveWinRateDelta', 'averageBattleTimeDelta', 'maxTimeRateDelta', 'failureRateDelta']);
    writeCsv(path.join(comparisonDirectory, 'matchup-diff.csv'), matchupDiff, ['key', 'scoreRateBefore', 'scoreRateAfter', 'scoreRateDelta', 'deckBScoreRateDelta', 'maxTimeRateDelta', 'failureRateDelta']);
    writeCsv(path.join(comparisonDirectory, 'unit-diff.csv'), unitDiff, ['key', 'scoreRateBefore', 'scoreRateAfter', 'scoreRateDelta', 'averageDamageDelta', 'averageDamageTakenDelta', 'averageHealingDelta', 'averageShieldingDelta']);
    writeCsv(path.join(comparisonDirectory, 'synergy-diff.csv'), synergyDiff, ['key', 'scoreRateBefore', 'scoreRateAfter', 'scoreRateDelta']);
    const lines = [
        '# 밸런스 실행 비교',
        '',
        `- 기준: \`${baselineRunId}\``,
        `- 후보: \`${candidateRunId}\``,
        `- 대응 case: ${comparison.paired.pairedCaseCount}`,
        `- case 교집합 / 기준 전용 / 후보 전용: ${comparison.caseCompatibility.intersectionCount} / ${comparison.caseCompatibility.baselineOnlyCount} / ${comparison.caseCompatibility.candidateOnlyCount}`,
        `- 대응 scoreRate 변화: ${comparison.paired.pairedDelta === null ? '없음' : `${(comparison.paired.pairedDelta * 100).toFixed(2)}%p`}`,
        `- 승→패 / 패→승: ${comparison.paired.winToLossFlipCount} / ${comparison.paired.lossToWinFlipCount}`,
        ...warnings.map(warning => `- 경고: ${warning}`)
    ];
    writeText(path.join(comparisonDirectory, 'report.md'), `${lines.join('\n')}\n`);
    return { comparisonDirectory, comparison };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    try {
        const options = parseCompareCliArguments(process.argv.slice(2));
        if (options.help) {
            console.log('사용법: npm run simulate:compare -- --base RUN_ID --candidate RUN_ID [--force]');
        } else if (!options.baselineRunId || !options.candidateRunId) {
            throw new Error('--base와 --candidate가 필요합니다.');
        } else {
            const result = compareBalanceRuns(options);
            console.log(JSON.stringify({ comparisonDirectory: result.comparisonDirectory, paired: result.comparison.paired, warnings: result.comparison.warnings }, null, 2));
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
