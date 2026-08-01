import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { canonicalJson, sha256 } from './write-results.mjs';

const SOURCE_ROOTS = ['js', 'scripts/balance-simulator'];

const hashFile = filePath => fs.existsSync(filePath) ? sha256(fs.readFileSync(filePath)) : null;

export function getGitMetadata(root = process.cwd()) {
    try {
        const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().length > 0;
        return { commit, dirty, warning: null };
    } catch {
        return { commit: null, dirty: null, warning: 'Git 메타데이터를 읽을 수 없어 캐시 재사용을 보수적으로 처리합니다.' };
    }
}

function sourceFiles(root) {
    return SOURCE_ROOTS.flatMap(relativeRoot => {
        const absoluteRoot = path.join(root, relativeRoot);
        if (!fs.existsSync(absoluteRoot)) return [];
        const pending = [absoluteRoot];
        const files = [];
        while (pending.length > 0) {
            const current = pending.pop();
            for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
                const absolutePath = path.join(current, entry.name);
                if (entry.isDirectory()) pending.push(absolutePath);
                else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) files.push(path.relative(root, absolutePath).replaceAll('\\', '/'));
            }
        }
        return files;
    }).sort();
}

export function createInputFingerprint({ root = process.cwd(), data, profiles, profileSchemaVersion, targetBands } = {}) {
    const inputHashes = {
        standardDecks: data === undefined ? hashFile(path.join(root, 'balance/standard-decks.json')) : sha256(canonicalJson(data)),
        simulationProfiles: profiles === undefined
            ? hashFile(path.join(root, 'balance/simulation-profiles.json'))
            : sha256(canonicalJson({ schemaVersion: profileSchemaVersion ?? null, profiles })),
        targetBands: targetBands === undefined ? hashFile(path.join(root, 'balance/target-bands.json')) : sha256(canonicalJson(targetBands))
    };
    const sourceHashes = Object.fromEntries(sourceFiles(root).map(relativePath => [relativePath, hashFile(path.join(root, relativePath))]));
    return { inputHashes, sourceHashes, git: getGitMetadata(root) };
}

const changedKeys = (before = {}, after = {}) => [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => before[key] !== after[key]);

export function analyzeImpact(previousManifest, fingerprint, { profile, directCase = null } = {}) {
    if (!previousManifest) {
        return { mode: 'full', cacheReusable: false, reusedCaseCount: 0, reason: 'baseline-missing', changedFiles: [] };
    }
    const changedInputs = changedKeys(previousManifest.inputHashes, fingerprint.inputHashes);
    const changedSources = changedKeys(previousManifest.sourceHashes, fingerprint.sourceHashes);
    const executionChanged = previousManifest.profile !== profile || previousManifest.directCase !== directCase;
    const gitUnsafe = previousManifest.git?.warning || fingerprint.git.warning
        || previousManifest.git?.commit !== fingerprint.git.commit
        || previousManifest.git?.dirty !== fingerprint.git.dirty
        || previousManifest.git?.dirty === true
        || fingerprint.git.dirty === true;
    if (changedInputs.length || changedSources.length || executionChanged || gitUnsafe) {
        // ponytail: 보수적 전체 재실행. 덱별 영향 분석은 실행 시간이 실제 병목일 때 snapshot diff로 확장한다.
        return {
            mode: 'full',
            cacheReusable: false,
            reusedCaseCount: 0,
            reason: previousManifest.git?.warning || fingerprint.git.warning
                ? 'git-unavailable'
                : gitUnsafe
                    ? 'git-state-changed'
                    : executionChanged
                        ? 'execution-config-changed'
                        : 'input-or-engine-changed',
            changedFiles: [...changedInputs, ...changedSources]
        };
    }
    return {
        mode: 'reuse',
        cacheReusable: true,
        reusedCaseCount: previousManifest.successCount,
        reason: 'identical-input-fingerprint',
        changedFiles: []
    };
}
