import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RUN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function updateCanonicalHash(hash, value) {
    if (Array.isArray(value)) {
        hash.update('[');
        value.forEach((entry, index) => {
            if (index > 0) hash.update(',');
            updateCanonicalHash(hash, entry);
        });
        hash.update(']');
        return;
    }
    if (value && typeof value === 'object') {
        hash.update('{');
        Object.keys(value).sort().forEach((key, index) => {
            if (index > 0) hash.update(',');
            hash.update(`${JSON.stringify(key)}:`);
            updateCanonicalHash(hash, value[key]);
        });
        hash.update('}');
        return;
    }
    hash.update(JSON.stringify(value));
}

export function canonicalSha256(value) {
    const hash = crypto.createHash('sha256');
    updateCanonicalHash(hash, value);
    return hash.digest('hex');
}

function atomicWriteFile(filePath, text) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporaryPath, text, 'utf8');
        fs.renameSync(temporaryPath, filePath);
    } catch (error) {
        fs.rmSync(temporaryPath, { force: true });
        throw error;
    }
}

export function writeJson(filePath, value) {
    atomicWriteFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeText(filePath, text) {
    atomicWriteFile(filePath, text);
}

export function writeCsv(filePath, rows, columns) {
    const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const text = [columns.join(','), ...rows.map(row => columns.map(column => escape(
        typeof row[column] === 'object' && row[column] !== null ? JSON.stringify(row[column]) : row[column]
    )).join(','))].join('\n');
    atomicWriteFile(filePath, `${text}\n`);
}

function writeNdjson(filePath, rows) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    let file;
    try {
        file = fs.openSync(temporaryPath, 'w');
        rows.forEach(row => fs.writeSync(file, `${JSON.stringify(row)}\n`));
        fs.closeSync(file);
        file = undefined;
        fs.renameSync(temporaryPath, filePath);
    } catch (error) {
        if (file !== undefined) fs.closeSync(file);
        fs.rmSync(temporaryPath, { force: true });
        throw error;
    }
}

function copyFileTo(filePath, target) {
    const source = fs.openSync(filePath, 'r');
    const buffer = Buffer.allocUnsafe(64 * 1024);
    try {
        let bytesRead;
        while ((bytesRead = fs.readSync(source, buffer, 0, buffer.length, null)) > 0) {
            fs.writeSync(target, buffer, 0, bytesRead);
        }
    } finally {
        fs.closeSync(source);
    }
}

function canonicalSha256WithLedger(canonical, ledgerPath) {
    const hash = crypto.createHash('sha256');
    hash.update('{"failures":');
    updateCanonicalHash(hash, canonical.failures);
    hash.update(',"results":[');
    const source = fs.openSync(ledgerPath, 'r');
    const buffer = Buffer.allocUnsafe(64 * 1024);
    try {
        let bytesRead;
        while ((bytesRead = fs.readSync(source, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, bytesRead));
    } finally {
        fs.closeSync(source);
    }
    hash.update('],"statistics":');
    updateCanonicalHash(hash, canonical.statistics);
    hash.update(',"summary":');
    updateCanonicalHash(hash, canonical.summary);
    hash.update('}');
    return hash.digest('hex');
}

function writeCanonicalFile(filePath, canonical, ledgerPath) {
    if (!ledgerPath) {
        writeJson(filePath, canonical);
        return;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    let file;
    try {
        file = fs.openSync(temporaryPath, 'w');
        fs.writeSync(file, `{"summary":${JSON.stringify(canonical.summary)},"statistics":${JSON.stringify(canonical.statistics)},"results":[`);
        copyFileTo(ledgerPath, file);
        fs.writeSync(file, `],"failures":${JSON.stringify(canonical.failures)}}\n`);
        fs.closeSync(file);
        file = undefined;
        fs.renameSync(temporaryPath, filePath);
    } catch (error) {
        if (file !== undefined) fs.closeSync(file);
        fs.rmSync(temporaryPath, { force: true });
        throw error;
    }
}

function createRunId() {
    return `${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
}

function validateRunId(runId) {
    if (!RUN_ID_PATTERN.test(runId)) throw new Error(`안전하지 않은 run ID: ${runId}`);
}

export function resolveRunDirectory(outputRoot, runId) {
    validateRunId(runId);
    return path.join(path.resolve(outputRoot), 'runs', runId);
}

function buildReport(run, manifest, data) {
    const names = new Map((data?.decks || []).map(deck => [deck.id, deck.name]));
    const interval = row => Number.isFinite(row.scoreRate95?.lower)
        ? `${(row.scoreRate95.lower * 100).toFixed(1)}~${(row.scoreRate95.upper * 100).toFixed(1)}%`
        : '표본 부족';
    const associationEdges = rows => {
        const ranked = rows.filter(row => Number.isFinite(row.scoreRate)).sort((left, right) => right.scoreRate - left.scoreRate);
        return [...new Map([...ranked.slice(0, 5), ...ranked.slice(-5)].map(row => [JSON.stringify(row), row])).values()];
    };
    const deckRows = (run.statistics?.decks || []).filter(row => Number.isFinite(row.scoreRate));
    const internalLeagues = [...new Set(deckRows.filter(row => row.league.startsWith('internal:')).map(row => row.league))].sort();
    const leagueEdges = internalLeagues.flatMap(league => {
        const ranked = deckRows.filter(row => row.league === league).sort((left, right) => right.scoreRate - left.scoreRate);
        return ranked.length ? [{ league, kind: '상위', ...ranked[0] }, { league, kind: '하위', ...ranked.at(-1) }] : [];
    });
    const candidates = deckRows.filter(row => !['normal-range', 'context-only'].includes(row.judgment));
    const extremes = [...(run.statistics?.matchups || [])]
        .filter(row => row.classificationA?.startsWith('extreme-'))
        .sort((left, right) => Math.abs(right.scoreRate - 0.5) - Math.abs(left.scoreRate - 0.5))
        .slice(0, 20);
    const units = associationEdges(run.statistics?.units || []);
    const synergies = associationEdges(run.statistics?.synergies || []);
    const items = associationEdges(run.statistics?.items || []);
    const growth = run.statistics?.growth || [];
    const warnings = run.statistics?.warnings || [];
    const automaticFlow = run.summary?.automaticFlow;
    const diagnostics = run.statistics?.diagnostics || {};
    const lines = [
        '# 밸런스 시뮬레이션 결과',
        '',
        `- Run ID: \`${manifest.runId}\``,
        `- 프로필: \`${manifest.profile}\``,
        `- Canonical SHA-256: \`${manifest.canonicalHash}\``,
        `- 성공/실패: ${manifest.successCount}/${manifest.failureCount}`,
        `- 캐시 재사용 전투: ${manifest.cache.reusedCaseCount}`,
        '',
        '## 내부 리그 상·하위',
        '',
        '| 리그 | 구분 | 덱 | scoreRate | 95% 구간 | 표본 |',
        '| --- | --- | --- | ---: | --- | ---: |',
        ...leagueEdges.map(row => `| ${row.league} | ${row.kind} | ${names.get(row.deckId) || row.deckId} | ${(row.scoreRate * 100).toFixed(1)}% | ${interval(row)} | ${row.normalBattles} |`),
        '',
        '## 밸런스 후보 덱',
        '',
        ...(candidates.length ? candidates.map(row => `- ${row.league} / ${names.get(row.deckId) || row.deckId}: ${row.judgment} (${(row.scoreRate * 100).toFixed(1)}%, 95% ${interval(row)})`) : ['- 없음']),
        '',
        '## 극단 상성',
        '',
        ...(extremes.length ? extremes.map(row => `- ${row.league}: ${names.get(row.deckAId) || row.deckAId} vs ${names.get(row.deckBId) || row.deckBId} — ${(row.scoreRate * 100).toFixed(1)}% (${row.extremeStatus})`) : ['- 없음']),
        '',
        '## 유닛 연관 상·하단',
        '',
        ...(units.length ? units.map(row => `- ${row.league} / ${row.name || row.unitId} ${row.star}성 — ${(row.scoreRate * 100).toFixed(1)}% (95% ${interval(row)}) / ${row.battles}회`) : ['- 없음']),
        '',
        '## 시너지 연관 상·하단',
        '',
        ...(synergies.length ? synergies.map(row => `- ${row.league} / ${row.type}:${row.name} ${row.level} — ${(row.scoreRate * 100).toFixed(1)}% (95% ${interval(row)}) / ${row.battles}회`) : ['- 없음']),
        '',
        '## 아이템 연관 상·하단',
        '',
        ...(items.length ? items.map(row => `- ${row.league} / ${row.name || row.itemId} — ${(row.scoreRate * 100).toFixed(1)}% (95% ${interval(row)}) / ${row.battles}회`) : ['- 없음']),
        '',
        '## 성장 체크포인트',
        '',
        ...(growth.length ? growth.map(row => `- ${names.get(row.parentDeckId) || row.parentDeckId} Lv.${row.fromLevel} → ${names.get(row.childDeckId) || row.childDeckId} Lv.${row.toLevel}: ${Number.isFinite(row.scoreRateDelta) ? `${(row.scoreRateDelta * 100).toFixed(1)}%p` : '표본 없음'}`) : ['- 없음']),
        '',
        '## 목표 밴드 경고',
        '',
        ...(warnings.length ? warnings.map(warning => `- ${warning.code}: ${JSON.stringify(warning)}`) : ['- 없음']),
        ...(automaticFlow ? [
            '',
            '## 자동 실행 흐름',
            '',
            `- Smoke: ${automaticFlow.smoke.successCount}/${automaticFlow.smoke.failureCount}`,
            `- 의심 상성: ${automaticFlow.suspiciousMatchupCount ?? 0}개`,
            automaticFlow.standardExpansion
                ? `- Standard 확대: ${automaticFlow.standardExpansion.successCount}/${automaticFlow.standardExpansion.failureCount}`
                : `- Standard 확대: ${automaticFlow.haltedAt ? 'Smoke 실패로 중단' : '대상 없음'}`
        ] : []),
        '',
        '## 진단',
        '',
        `- 최대 시간: ${run.statistics?.outcomes?.maxTime ?? 0}`,
        `- 실패: ${run.statistics?.outcomes?.failure ?? 0}`,
        `- 미귀속 피해율: ${((diagnostics.unattributedDamageRate || 0) * 100).toFixed(2)}%`,
        diagnostics.warning ? `- 경고: ${diagnostics.warning}` : '- 경고: 없음'
    ];
    return `${lines.join('\n')}\n`;
}

export function writeBalanceRun({
    run,
    data,
    profiles,
    profileSchemaVersion,
    targetBands,
    outputRoot = path.resolve('reports/balance'),
    runId = createRunId(),
    manifestContext = {}
}) {
    if (!run?.summary || !run?.statistics || !Array.isArray(run.results) || !Array.isArray(run.failures)) {
        throw new Error('저장할 표준 덱 실행 결과 형식이 아닙니다.');
    }
    const runDirectory = resolveRunDirectory(outputRoot, runId);
    if (fs.existsSync(runDirectory)) throw new Error(`이미 존재하는 run ID입니다: ${runId}`);
    const stagingDirectory = `${runDirectory}.tmp-${crypto.randomUUID()}`;

    const canonical = { summary: run.summary, statistics: run.statistics, results: run.results, failures: run.failures };
    const canonicalHash = run.resultLedgerPath
        ? canonicalSha256WithLedger(canonical, run.resultLedgerPath)
        : canonicalSha256(canonical);
    const inputHashes = manifestContext.inputHashes || {};
    const sourceHashes = manifestContext.sourceHashes || {};
    const manifest = {
        schemaVersion: 2,
        runId,
        profile: run.summary.profile,
        directCase: run.summary.directCase,
        rulesVersion: run.summary.rulesVersion,
        baseSeed: manifestContext.baseSeed ?? null,
        seedSuiteVersion: manifestContext.seedSuiteVersion ?? run.summary.rulesVersion,
        executionCommand: manifestContext.executionCommand ?? null,
        createdAt: manifestContext.createdAt ?? new Date().toISOString(),
        nodeVersion: process.version,
        git: manifestContext.git || { commit: null, dirty: null, warning: 'Git 메타데이터를 읽을 수 없습니다.' },
        inputHashes,
        sourceHashes,
        engineFileHash: sourceHashes['js/battleEngine.js'] ?? null,
        dataFileHash: sourceHashes['js/data.js'] ?? null,
        standardDecksFileHash: inputHashes.standardDecks ?? null,
        itemFileHash: sourceHashes['js/items.js'] ?? null,
        synergyFileHash: sourceHashes['js/systems/SynergyManager.js'] ?? null,
        standardDeckSchemaVersion: data?.schemaVersion ?? null,
        simulationProfileSchemaVersion: profileSchemaVersion ?? null,
        expectedBattleCount: run.summary.expectedCaseCount,
        successCount: run.summary.successCount,
        failureCount: run.summary.failureCount,
        cache: manifestContext.cache || { mode: 'full', reason: '새 실행', reusedCaseCount: 0 },
        canonicalHash
    };

    const aggregateRows = {
        decks: run.statistics.decks || [],
        matchups: run.statistics.matchups || [],
        units: run.statistics.units || [],
        synergies: run.statistics.synergies || [],
        items: run.statistics.items || [],
        investment: run.statistics.deckInvestments || [],
        growth: run.statistics.growth || []
    };
    try {
        writeJson(path.join(stagingDirectory, 'manifest.json'), manifest);
        writeJson(path.join(stagingDirectory, 'config.snapshot.json'), { schemaVersion: profileSchemaVersion ?? null, profiles, targetBands });
        writeJson(path.join(stagingDirectory, 'standard-decks.snapshot.json'), data);
        writeCanonicalFile(path.join(stagingDirectory, 'results.canonical.json'), canonical, run.resultLedgerPath);
        writeJson(path.join(stagingDirectory, 'failures.json'), run.failures);
        const rawTarget = path.join(stagingDirectory, 'raw', 'battles.ndjson');
        if (run.rawResultsPath && fs.existsSync(run.rawResultsPath)) {
            fs.mkdirSync(path.dirname(rawTarget), { recursive: true });
            fs.copyFileSync(run.rawResultsPath, rawTarget);
        } else {
            writeNdjson(rawTarget, run.results);
        }
        Object.entries(aggregateRows).forEach(([name, rows]) => writeJson(path.join(stagingDirectory, 'aggregates', `${name}.json`), rows));

        writeCsv(path.join(stagingDirectory, 'csv', 'deck-rankings.csv'), aggregateRows.decks, ['league', 'deckId', 'scoreRate', 'decisiveWinRate', 'normalBattles', 'maxTimeRate', 'failureRate', 'averageBattleTime', 'placementSensitivity', 'judgment']);
        writeCsv(path.join(stagingDirectory, 'csv', 'matchup-matrix.csv'), aggregateRows.matchups, ['league', 'deckAId', 'deckBId', 'scoreRate', 'deckBScoreRate', 'normalBattles', 'classificationA', 'extremeStatus', 'placementSensitivity']);
        writeCsv(path.join(stagingDirectory, 'csv', 'units.csv'), aggregateRows.units, ['league', 'unitId', 'name', 'star', 'tier', 'battles', 'scoreRate', 'firstDeathRate', 'averageDamage', 'averageDamageTaken', 'averageHealing', 'averageShielding']);
        writeCsv(path.join(stagingDirectory, 'csv', 'synergies.csv'), aggregateRows.synergies, ['league', 'type', 'name', 'level', 'battles', 'scoreRate']);
        writeCsv(path.join(stagingDirectory, 'csv', 'items.csv'), aggregateRows.items, ['league', 'itemId', 'name', 'battles', 'copies', 'scoreRate']);
        writeCsv(path.join(stagingDirectory, 'csv', 'growth.csv'), aggregateRows.growth, ['parentDeckId', 'childDeckId', 'fromLevel', 'toLevel', 'parentScoreRate', 'childScoreRate', 'scoreRateDelta', 'unitGoldCostDelta', 'paidXpGoldEquivalentDelta']);
        atomicWriteFile(path.join(stagingDirectory, 'report.md'), buildReport(run, manifest, data));
        fs.mkdirSync(path.dirname(runDirectory), { recursive: true });
        fs.renameSync(stagingDirectory, runDirectory);
    } catch (error) {
        fs.rmSync(stagingDirectory, { recursive: true, force: true });
        throw error;
    }
    if (run.rawResultsPath) fs.rmSync(run.rawResultsPath, { force: true });
    if (run.resultLedgerPath) fs.rmSync(run.resultLedgerPath, { force: true });
    writeJson(path.join(path.resolve(outputRoot), 'latest.json'), { runId, canonicalHash, updatedAt: new Date().toISOString() });

    return { runDirectory, manifest, canonicalHash };
}

export function readBalanceRun(runId, outputRoot = path.resolve('reports/balance')) {
    const runDirectory = resolveRunDirectory(outputRoot, runId);
    if (!fs.existsSync(runDirectory)) throw new Error(`저장된 run을 찾을 수 없습니다: ${runId}`);
    const read = fileName => JSON.parse(fs.readFileSync(path.join(runDirectory, fileName), 'utf8'));
    const manifest = read('manifest.json');
    const canonical = read('results.canonical.json');
    const actualHash = canonicalSha256(canonical);
    if (actualHash !== manifest.canonicalHash) {
        throw new Error(`canonical 해시 불일치: ${runId}`);
    }
    return { runDirectory, manifest, canonical };
}
