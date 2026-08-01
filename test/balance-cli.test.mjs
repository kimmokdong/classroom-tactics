import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseCompareCliArguments } from '../scripts/balance-simulator/compare-runs.mjs';
import { createCaseSuite } from '../scripts/balance-simulator/create-case-suite.mjs';
import { findSuspiciousMatchupKeys, parseSimulationCliArguments, simulateDecks } from '../scripts/balance-simulator/simulate-decks.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../balance/standard-decks.json', import.meta.url), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(new URL('../balance/simulation-profiles.json', import.meta.url), 'utf8')).profiles;

test('표준 덱 CLI는 단일 case를 저장하고 재현·비교 인자를 해석한다', () => {
    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'balance-cli-'));
    try {
        const caseId = createCaseSuite(data, profiles.smoke)[0].id;
        assert.deepEqual(parseSimulationCliArguments(['--profile', 'smoke', '--case', caseId, '--set-baseline']), {
            profileName: 'smoke', caseId, setBaseline: true
        });
        assert.deepEqual(parseCompareCliArguments(['--base', 'before', '--candidate', 'after']), {
            baselineRunId: 'before', candidateRunId: 'after'
        });
        assert.deepEqual(parseCompareCliArguments(['--base', 'before', '--candidate', 'after', '--force']), {
            baselineRunId: 'before', candidateRunId: 'after', force: true
        });
        assert.deepEqual(parseSimulationCliArguments([]), { setBaseline: false });
        assert.deepEqual(findSuspiciousMatchupKeys({ matchups: [
            { league: 'a', deckAId: '1', deckBId: '2', scoreRate: 0.8, placementSensitivity: 0 },
            { league: 'a', deckAId: '1', deckBId: '3', scoreRate: 0.5, placementSensitivity: 0.21 },
            { league: 'a', deckAId: '2', deckBId: '3', scoreRate: 0.5, placementSensitivity: 0.1 }
        ] }), ['a|1|2', 'a|1|3']);
        const result = simulateDecks({ profileName: 'smoke', caseId, outputRoot, setBaseline: true });
        assert.equal(result.cached, false);
        assert.equal(result.summary.successCount, 1);
        assert.equal(fs.existsSync(result.reportPath), true);
        assert.equal(result.baseline.runId, result.runId);
    } finally {
        fs.rmSync(outputRoot, { recursive: true, force: true });
    }
});
