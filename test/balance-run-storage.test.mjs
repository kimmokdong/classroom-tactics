import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { compareBalanceRuns, getBaseline, setBaseline } from '../scripts/balance-simulator/compare-runs.mjs';
import { analyzeImpact, createInputFingerprint } from '../scripts/balance-simulator/impact-analysis.mjs';
import { canonicalJson, canonicalSha256, readBalanceRun, sha256, writeBalanceRun } from '../scripts/balance-simulator/write-results.mjs';

const data = { schemaVersion: 1, rulesVersion: 'test-rules', decks: [{ id: 'deck-a', name: 'A' }, { id: 'deck-b', name: 'B' }] };
const fingerprint = {
    inputHashes: { standardDecks: 'decks', simulationProfiles: 'profiles', targetBands: 'bands' },
    sourceHashes: { 'js/battleEngine.js': 'engine', 'js/data.js': 'data', 'js/items.js': 'items', 'js/systems/SynergyManager.js': 'synergy' },
    git: { commit: null, dirty: null, warning: null }
};

function createRun(winnerDeckId, scoreRate) {
    return {
        summary: { rulesVersion: 'test-rules', profile: 'smoke', directCase: null, expectedCaseCount: 2, successCount: 2, failureCount: 0 },
        statistics: {
            outcomes: { decisive: 1, simultaneousDraw: 1, maxTime: 0, failure: 0, invalidResult: 0 },
            diagnostics: { unattributedDamageRate: 0, warning: null },
            decks: [{ league: 'internal:test', deckId: 'deck-a', scoreRate, decisiveWinRate: scoreRate, normalBattles: 2, maxTimeRate: 0, failureRate: 0, averageBattleTime: 10 }],
            matchups: [{ league: 'internal:test', deckAId: 'deck-a', deckBId: 'deck-b', scoreRate, deckBScoreRate: 1 - scoreRate, maxTimeRate: 0, failureRate: 0 }],
            units: [{ league: 'internal:test', unitId: 'u1', star: 1, scoreRate, averageDamage: 100, averageDamageTaken: 50, averageHealing: 0, averageShielding: 0 }],
            deckInvestments: [], synergies: [], items: []
        },
        results: [
            { caseId: 'case-1', deckAId: 'deck-a', deckBId: 'deck-b', endReason: 'decisive', winnerDeckId },
            { caseId: 'case-2', deckAId: 'deck-a', deckBId: 'deck-b', endReason: 'simultaneous-draw', winnerDeckId: null }
        ],
        failures: []
    };
}

test('Windows에서 결과 폴더 rename이 잠기면 복사 방식으로 저장을 완료한다', { skip: process.platform !== 'win32' }, () => {
    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'balance-run-windows-fallback-'));
    const renameSync = fs.renameSync;
    try {
        let blocked = false;
        fs.renameSync = (source, target) => {
            if (!blocked && path.basename(source).includes('.tmp-')) {
                blocked = true;
                throw Object.assign(new Error('locked'), { code: 'EPERM' });
            }
            return renameSync(source, target);
        };
        const storage = writeBalanceRun({
            run: createRun('deck-a', 0.75), data, profiles: { smoke: {} }, targetBands: {}, outputRoot, runId: 'fallback',
            profileSchemaVersion: 2,
            manifestContext: { ...fingerprint, createdAt: '2026-08-08T00:00:00.000Z' }
        });
        assert.equal(blocked, true);
        assert.equal(fs.existsSync(path.join(storage.runDirectory, 'report.md')), true);
        assert.equal(fs.readdirSync(path.join(outputRoot, 'runs')).some(name => name.includes('.tmp-')), false);
    } finally {
        fs.renameSync = renameSync;
        fs.rmSync(outputRoot, { recursive: true, force: true });
    }
});

test('실행 결과는 고유 run에 보존되고 baseline·paired 비교·보수적 캐시 판정을 지원한다', () => {
    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'balance-run-storage-'));
    try {
        const baseline = writeBalanceRun({
            run: createRun('deck-a', 0.75), data, profiles: { smoke: {} }, targetBands: {}, outputRoot, runId: 'baseline',
            profileSchemaVersion: 2,
            manifestContext: { ...fingerprint, createdAt: '2026-07-17T00:00:00.000Z', cache: { mode: 'full', reason: 'test', reusedCaseCount: 0 } }
        });
        const repeat = writeBalanceRun({
            run: createRun('deck-a', 0.75), data, profiles: { smoke: {} }, targetBands: {}, outputRoot, runId: 'repeat',
            profileSchemaVersion: 2,
            manifestContext: { ...fingerprint, createdAt: '2026-07-17T00:00:01.000Z', cache: { mode: 'full', reason: 'test', reusedCaseCount: 0 } }
        });
        const candidate = writeBalanceRun({
            run: createRun('deck-b', 0.25), data, profiles: { smoke: {} }, targetBands: {}, outputRoot, runId: 'candidate',
            profileSchemaVersion: 2,
            manifestContext: { ...fingerprint, sourceHashes: { ...fingerprint.sourceHashes, 'js/battleEngine.js': 'changed' }, createdAt: '2026-07-17T00:00:02.000Z', cache: { mode: 'full', reason: 'test', reusedCaseCount: 0 } }
        });
        const stored = readBalanceRun('baseline', outputRoot);
        assert.equal(stored.manifest.canonicalHash, baseline.canonicalHash);
        assert.equal(fs.existsSync(path.join(baseline.runDirectory, 'raw', 'battles.ndjson')), true);
        assert.equal(fs.existsSync(path.join(baseline.runDirectory, 'csv', 'deck-rankings.csv')), true);
        assert.equal(fs.existsSync(path.join(baseline.runDirectory, 'aggregates', 'items.json')), true);
        assert.equal(fs.existsSync(path.join(candidate.runDirectory, 'report.md')), true);
        assert.equal(stored.manifest.simulationProfileSchemaVersion, 2);
        assert.equal(fs.readdirSync(path.join(outputRoot, 'runs')).some(name => name.includes('.tmp-')), false);
        assert.equal(repeat.canonicalHash, baseline.canonicalHash);
        assert.equal(JSON.parse(fs.readFileSync(path.join(outputRoot, 'latest.json'), 'utf8')).runId, 'candidate');
        assert.equal(canonicalSha256(stored.canonical), sha256(canonicalJson(stored.canonical)));

        const ledgerRun = createRun('deck-a', 0.75);
        const ledgerPath = path.join(outputRoot, 'ledger.fragments');
        const rawPath = path.join(outputRoot, 'ledger.ndjson');
        fs.writeFileSync(ledgerPath, ledgerRun.results.map(canonicalJson).join(','), 'utf8');
        fs.writeFileSync(rawPath, ledgerRun.results.map(row => JSON.stringify(row)).join('\n') + '\n', 'utf8');
        ledgerRun.results = [];
        ledgerRun.resultLedgerPath = ledgerPath;
        ledgerRun.rawResultsPath = rawPath;
        const ledgerStorage = writeBalanceRun({
            run: ledgerRun, data, profiles: { smoke: {} }, profileSchemaVersion: 2, targetBands: {}, outputRoot, runId: 'ledger',
            manifestContext: { ...fingerprint, createdAt: '2026-07-17T00:00:02.500Z', cache: { mode: 'full', reason: 'test', reusedCaseCount: 0 } }
        });
        const ledgerStored = readBalanceRun('ledger', outputRoot);
        assert.equal(ledgerStored.canonical.results.length, 2);
        assert.equal(ledgerStorage.canonicalHash, baseline.canonicalHash);
        assert.equal(fs.existsSync(ledgerPath), false);
        assert.equal(fs.existsSync(rawPath), false);

        assert.deepEqual(analyzeImpact(stored.manifest, fingerprint, { profile: 'smoke' }), {
            mode: 'reuse', cacheReusable: true, reusedCaseCount: 2, reason: 'identical-input-fingerprint', changedFiles: []
        });
        const changed = { ...fingerprint, sourceHashes: { ...fingerprint.sourceHashes, 'js/battleEngine.js': 'changed' } };
        assert.equal(analyzeImpact(stored.manifest, changed, { profile: 'smoke' }).mode, 'full');
        assert.equal(analyzeImpact(null, fingerprint, { profile: 'smoke' }).reason, 'baseline-missing');
        assert.equal(analyzeImpact({ ...stored.manifest, git: { commit: null, dirty: null, warning: 'old' } }, fingerprint, { profile: 'smoke' }).reason, 'git-unavailable');

        const realFingerprint = createInputFingerprint({ data, profiles: { smoke: {} }, profileSchemaVersion: 2, targetBands: {} });
        assert.ok(realFingerprint.sourceHashes['scripts/balance-simulator/simulate-decks.mjs']);
        assert.ok(realFingerprint.sourceHashes['scripts/balance-simulator/write-results.mjs']);
        assert.notEqual(
            realFingerprint.inputHashes.simulationProfiles,
            createInputFingerprint({ data, profiles: { smoke: {} }, profileSchemaVersion: 1, targetBands: {} }).inputHashes.simulationProfiles
        );

        assert.equal(setBaseline('baseline', outputRoot).runId, 'baseline');
        assert.equal(getBaseline(outputRoot).runId, 'baseline');
        const comparison = compareBalanceRuns({ baselineRunId: 'baseline', candidateRunId: 'candidate', outputRoot });
        assert.equal(comparison.comparison.paired.pairedCaseCount, 2);
        assert.equal(comparison.comparison.paired.winToLossFlipCount, 1);
        assert.equal(comparison.comparison.deckDiff[0].scoreRateDelta, -0.5);
        assert.deepEqual(comparison.comparison.warnings, ['전투 기반 코드가 변경되어 완전한 순수 수치 A/B 비교가 아님']);
        assert.equal(fs.existsSync(path.join(comparison.comparisonDirectory, 'comparison.json')), true);
        assert.equal(fs.existsSync(path.join(comparison.comparisonDirectory, 'unit-diff.csv')), true);

        const incompatibleRun = createRun('deck-a', 0.75);
        incompatibleRun.summary.profile = 'quick';
        writeBalanceRun({
            run: incompatibleRun, data, profiles: { quick: {} }, profileSchemaVersion: 2, targetBands: {}, outputRoot, runId: 'incompatible',
            manifestContext: { ...fingerprint, createdAt: '2026-07-17T00:00:03.000Z', cache: { mode: 'full', reason: 'test', reusedCaseCount: 0 } }
        });
        assert.throws(() => compareBalanceRuns({ baselineRunId: 'baseline', candidateRunId: 'incompatible', outputRoot }), /호환되지 않는 실행/);
        assert.ok(compareBalanceRuns({ baselineRunId: 'baseline', candidateRunId: 'incompatible', outputRoot, force: true }).comparison.warnings[0].includes('강제 비교'));

        writeBalanceRun({
            run: createRun('deck-a', 0.75), data, profiles: { smoke: {} }, profileSchemaVersion: 2, targetBands: {}, outputRoot, runId: 'corrupt',
            manifestContext: { ...fingerprint, createdAt: '2026-07-17T00:00:04.000Z', cache: { mode: 'full', reason: 'test', reusedCaseCount: 0 } }
        });
        const corruptPath = path.join(outputRoot, 'runs', 'corrupt', 'results.canonical.json');
        const corrupt = JSON.parse(fs.readFileSync(corruptPath, 'utf8'));
        corrupt.summary.successCount = 999;
        fs.writeFileSync(corruptPath, JSON.stringify(corrupt), 'utf8');
        assert.throws(() => readBalanceRun('corrupt', outputRoot), /canonical 해시 불일치/);
    } finally {
        fs.rmSync(outputRoot, { recursive: true, force: true });
    }
});
