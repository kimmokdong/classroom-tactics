import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { generateStandardDecksMarkdown } from '../scripts/balance-simulator/generate-standard-decks-md.mjs';
import { validateStandardDecks } from '../scripts/balance-simulator/validate-standard-decks.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const loadJson = relativePath => JSON.parse(fs.readFileSync(new URL('../' + relativePath, import.meta.url), 'utf8'));
const sample = loadJson('balance/standard-decks.json');

test('활성 표준 덱 38개와 레거시 감사 68개가 Schema·전략군 검증을 통과한다', () => {
    assert.equal(sample.decks.length, 38);
    assert.equal(sample.legacyAudit.length, 68);
    assert.deepEqual(Object.fromEntries(Object.entries(Object.groupBy(sample.decks, deck => deck.strategyGroup)).map(([group, decks]) => [group, decks.length])), {
        reroll_core7: 6,
        reroll_final8: 6,
        standard_core8: 6,
        standard_final9: 6,
        highvalue_final9: 14
    });
    assert.deepEqual(validateStandardDecks(sample), { valid: true, errors: [], warnings: [] });
});

test('중복 deck/checkpoint ID와 잘못된 primaryCheckpoint를 거부한다', () => {
    const invalid = structuredClone(sample);
    invalid.decks.push(structuredClone(invalid.decks[0]));
    invalid.checkpoints.push(structuredClone(invalid.checkpoints[0]));
    invalid.primaryCheckpoint = 'missing-checkpoint';
    const result = validateStandardDecks(invalid);
    assert.equal(result.valid, false);
    ['중복 deck ID', '중복 checkpoint ID', 'primaryCheckpoint가 존재하지 않음']
        .forEach(message => assert.ok(result.errors.some(error => error.includes(message)), message));
});

test('중복 유닛·위치와 미등록 유닛·아이템을 거부한다', () => {
    const invalid = structuredClone(sample);
    const deck = invalid.decks[0];
    deck.units[1].unitId = deck.units[0].unitId;
    deck.units[2].position = deck.units[0].position;
    deck.units[3].unitId = 'u5_999';
    deck.units[4].items = ['not-an-item'];
    const result = validateStandardDecks(invalid);
    assert.equal(result.valid, false);
    ['중복 unitId', '중복 position', '미등록 unitId', '미등록 itemId']
        .forEach(message => assert.ok(result.errors.some(error => error.includes(message)), message));
});

test('성급·아이템 슬롯·보드 위치·위치 그룹의 형식 제약을 검증한다', () => {
    const invalid = structuredClone(sample);
    const deck = invalid.decks[0];
    deck.units[0].star = 4;
    deck.units[1].items = ['base-ad', 'base-as', 'base-ap', 'base-hp'];
    deck.units[2].position = 24;
    deck.units[3].positionGroup = 'anywhere';
    const result = validateStandardDecks(invalid);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.startsWith('schema ')));
});

test('core7의 3코스트 3성 핵심 쌍과 5코스트 금지를 검증한다', () => {
    const invalid = structuredClone(sample);
    const deck = invalid.decks.find(candidate => candidate.strategyGroup === 'reroll_core7');
    deck.units.find(unit => unit.unitId === deck.roles.mainTank).star = 2;
    deck.units[0].unitId = 'u5_4';
    const result = validateStandardDecks(invalid);
    assert.equal(result.valid, false);
    ['core7 메인 탱커·딜러', 'core7 5코스트 금지']
        .forEach(message => assert.ok(result.errors.some(error => error.includes(message)), message));
});

test('core8·성장 부모·고밸류·item set·기대 시너지 규칙을 검증한다', () => {
    const invalid = structuredClone(sample);
    const core8 = invalid.decks.find(deck => deck.strategyGroup === 'standard_core8');
    core8.units.find(unit => unit.unitId === core8.roles.mainTank).star = 1;
    const final8 = invalid.decks.find(deck => deck.strategyGroup === 'reroll_final8');
    final8.parentDeckId = 'missing-parent';
    const highvalue = invalid.decks.find(deck => deck.strategyGroup === 'highvalue_final9');
    highvalue.units.find(unit => unit.unitId === highvalue.roles.mainDealer).items = [];
    highvalue.expectedSynergies[0].level += 1;
    const result = validateStandardDecks(invalid);
    assert.equal(result.valid, false);
    ['core8 메인 탱커·딜러', 'parentDeckId 필요', 'capped9 아이템 수 불일치', 'expectedSynergies 불일치']
        .forEach(message => assert.ok(result.errors.some(error => error.includes(message)), message));
});

test('아이템 총량·역할 외 장착을 거부하고 딜러 계열 불일치를 경고한다', () => {
    const invalid = structuredClone(sample);
    const deck = invalid.decks.find(candidate => candidate.defaultItemSet === 'baseline6');
    const bench = deck.units.find(unit => !Object.values(deck.roles).includes(unit.unitId));
    bench.items = ['comb_ad_ad'];
    const invalidResult = validateStandardDecks(invalid);
    assert.equal(invalidResult.valid, false);
    assert.ok(invalidResult.errors.some(error => error.includes('전체 아이템 수 불일치')));
    assert.ok(invalidResult.errors.some(error => error.includes('역할 외 유닛에 아이템 배정')));

    const warned = structuredClone(sample);
    const apDealerDeck = warned.decks.find(candidate => candidate.roles.mainDealer === 'u4_3');
    const dealer = apDealerDeck.units.find(unit => unit.unitId === apDealerDeck.roles.mainDealer);
    dealer.items = ['comb_ad_ad', 'comb_ad_as', 'comb_ad_crit'];
    const warnedResult = validateStandardDecks(warned);
    assert.equal(warnedResult.valid, true);
    assert.ok(warnedResult.warnings.some(warning => warning.includes('AP 권장군과 불일치')));
    dealer.itemExceptionReason = '대조 실험용 AD 세트';
    assert.ok(validateStandardDecks(warned).warnings.some(warning => warning.includes('의도적 예외')));
});

test('레거시 감사 ID·대상 역참조·제외 이유를 검증한다', () => {
    assert.ok(sample.legacyAudit.every(entry => entry.reason.length > 0));
    assert.ok(sample.legacyAudit.some(entry => entry.reason.includes('10레벨 체크포인트')));
    assert.ok(sample.legacyAudit.some(entry => entry.reason.includes('완전히 같아')));

    const invalid = structuredClone(sample);
    invalid.legacyAudit[1].sourceId = invalid.legacyAudit[0].sourceId;
    invalid.legacyAudit[2].targetDeckIds = ['missing-deck'];
    const linked = invalid.legacyAudit.find(entry => entry.targetDeckIds.length > 0);
    const linkedDeck = invalid.decks.find(deck => deck.id === linked.targetDeckIds[0]);
    linkedDeck.sourceLegacyIds = linkedDeck.sourceLegacyIds.filter(sourceId => sourceId !== linked.sourceId);
    if (linkedDeck.sourceLegacyIds.length === 0) {
        linkedDeck.sourceLegacyIds = [invalid.legacyAudit.find(entry => entry.sourceId !== linked.sourceId).sourceId];
    }
    const result = validateStandardDecks(invalid);
    assert.equal(result.valid, false);
    ['중복 legacy audit ID', '미등록 targetDeckId', 'target deck 정참조 누락']
        .forEach(message => assert.ok(result.errors.some(error => error.includes(message)), message));
});

test('시뮬레이션 프로필과 목표 밴드가 최소 실행 계약을 제공한다', () => {
    const profiles = loadJson('balance/simulation-profiles.json');
    const bands = loadJson('balance/target-bands.json');
    assert.equal(profiles.schemaVersion, 2);
    assert.deepEqual(Object.keys(profiles.profiles), ['smoke', 'quick', 'standard', 'deep']);
    assert.ok(profiles.profiles.smoke.repetitions <= profiles.profiles.deep.repetitions);
    assert.deepEqual(profiles.profiles.standard.placements, ['standard', 'mirrored', 'spread']);
    assert.equal(profiles.profiles.smoke.pairedPlacementsOnly, true);
    assert.ok(bands.metrics.scoreRate.targetMin < bands.metrics.scoreRate.targetMax);
    assert.equal(bands.metrics.failureRate.max, 0);
});

test('생성 Markdown은 JSON과 정확히 일치하고 68개 감사 사유를 포함한다', () => {
    const generated = generateStandardDecksMarkdown(sample);
    const committed = fs.readFileSync(new URL('../docs/standard_decks.md', import.meta.url), 'utf8');
    assert.equal(committed, generated);
    assert.match(generated, /활성 덱: 38개/);
    assert.match(generated, /레거시 감사: 68개/);
    assert.match(generated, /humanities-standard-final9/);
});

test('검증기와 생성기 CLI가 전체 덱과 파일 출력을 처리한다', () => {
    const validator = fileURLToPath(new URL('../scripts/balance-simulator/validate-standard-decks.mjs', import.meta.url));
    const generator = fileURLToPath(new URL('../scripts/balance-simulator/generate-standard-decks-md.mjs', import.meta.url));
    const outputPath = path.join(os.tmpdir(), `standard-decks-${process.pid}.md`);
    const validation = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
    const generation = spawnSync(process.execPath, [generator, 'balance/standard-decks.json', outputPath], { cwd: root, encoding: 'utf8' });
    assert.equal(validation.status, 0, validation.stderr);
    assert.match(validation.stdout, /표준 덱 38개, 레거시 감사 68개 검증 통과/);
    assert.equal(generation.status, 0, generation.stderr);
    assert.match(fs.readFileSync(outputPath, 'utf8'), /레거시 68개 감사/);
    fs.rmSync(outputPath, { force: true });
});
