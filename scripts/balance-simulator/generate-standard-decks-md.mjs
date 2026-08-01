import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { UNIT_POOL } from '../../js/data.js';
import { ITEMS } from '../../js/items.js';
import { validateStandardDecks } from './validate-standard-decks.mjs';

const unitsById = new Map(UNIT_POOL.map(unit => [unit.id, unit]));
const itemsById = new Map(ITEMS.map(item => [item.id, item]));
const roleLabels = { mainTank: '메인 탱커', mainDealer: '메인 딜러', subDealer: '서브 딜러' };
const synergyTypeLabels = { subjects: '과목', clubs: '동아리' };
const dispositionLabels = {
    usable: '그대로 사용 가능',
    modified: '일부 수정 후 사용 가능',
    reclassified: '전략군 재분류',
    excluded: '제외',
    'needs-new-design': '신규 설계 필요'
};
const escapeCell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

export function generateStandardDecksMarkdown(data) {
    const result = validateStandardDecks(data);
    if (!result.valid) throw new Error(result.errors.join('\n'));

    const checkpointsById = new Map(data.checkpoints.map(checkpoint => [checkpoint.id, checkpoint]));
    const groupCounts = Object.entries(Object.groupBy(data.decks, deck => deck.strategyGroup))
        .map(([group, decks]) => [group, decks.length]);
    const dispositionCounts = Object.entries(Object.groupBy(data.legacyAudit, entry => entry.disposition))
        .map(([status, entries]) => [status, entries.length]);
    const lines = [
        '# 교실 대전 표준 덱',
        '',
        `> schemaVersion: ${data.schemaVersion}`,
        `> rulesVersion: ${data.rulesVersion}`,
        `> deckSetVersion: ${data.deckSetVersion}`,
        `> primaryCheckpoint: ${data.primaryCheckpoint}`,
        '> 이 문서는 balance/standard-decks.json에서 자동 생성했습니다.',
        '',
        '## 요약',
        '',
        `- 활성 덱: ${data.decks.length}개`,
        `- 레거시 감사: ${data.legacyAudit.length}개`,
        `- 전략군: ${groupCounts.map(([group, count]) => `${group} ${count}개`).join(', ')}`,
        `- 감사 분류: ${dispositionCounts.map(([status, count]) => `${dispositionLabels[status]} ${count}개`).join(', ')}`,
        '',
        '## 활성 덱',
        ''
    ];

    data.decks.forEach(deck => {
        const checkpoint = checkpointsById.get(deck.checkpointId);
        lines.push(`### ${deck.name}`, '');
        lines.push('- ID: `' + deck.id + '`');
        lines.push('- 전략군: `' + deck.strategyGroup + '`');
        lines.push(`- 체크포인트: ${checkpoint.name} / Lv.${checkpoint.boardLevel} / ${checkpoint.phase}`);
        if (deck.parentDeckId) lines.push('- 부모 덱: `' + deck.parentDeckId + '`');
        lines.push('- 기본 item set: `' + deck.defaultItemSet + '`');
        lines.push(`- 이관 판정: ${deck.migrationStatus} — ${deck.changeReason}`);
        lines.push('- 역할: ' + Object.entries(deck.roles)
            .map(([role, unitId]) => `${roleLabels[role]}=${unitsById.get(unitId).name}(${unitId})`)
            .join(', '));
        lines.push('- 기대 시너지: ' + (deck.expectedSynergies
            .map(synergy => `${synergyTypeLabels[synergy.type]} ${synergy.name} ${synergy.level}`)
            .join(', ') || '없음'));
        lines.push(`- 출처: ${deck.sourceLegacyIds.map(id => `\`${id}\``).join(', ')}`);
        lines.push(`- 태그: ${deck.tags.join(', ') || '없음'}`);
        lines.push(`- 비고: ${deck.notes || '없음'}`, '');
        lines.push('| 위치 | 위치 그룹 | 유닛 | 성급 | 고정 아이템 |');
        lines.push('|---:|---|---|---:|---|');
        [...deck.units].sort((a, b) => a.position - b.position).forEach(unit => {
            const itemNames = unit.items.map(itemId => itemsById.get(itemId).name).join(', ') || '없음';
            lines.push(`| ${unit.position} | ${unit.positionGroup} | ${unitsById.get(unit.unitId).name} (${unit.unitId}) | ${unit.star} | ${itemNames} |`);
        });
        lines.push('');
    });

    lines.push('## 레거시 68개 감사', '');
    lines.push('| 원본 ID | 분류 | 레벨 | 판정 | 활성 대상 | 이유 |');
    lines.push('|---|---|---:|---|---|---|');
    data.legacyAudit.forEach(entry => {
        lines.push(`| ${entry.sourceId} | ${escapeCell(entry.category)} | ${entry.level} | ${dispositionLabels[entry.disposition]} | ${entry.targetDeckIds.join(', ') || '-'} | ${escapeCell(entry.reason)} |`);
    });
    lines.push('');

    return lines.join('\n');
}

export function generateStandardDecksMarkdownFile(inputPath = 'balance/standard-decks.json', outputPath) {
    const data = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
    const markdown = generateStandardDecksMarkdown(data);
    if (outputPath) fs.writeFileSync(path.resolve(outputPath), markdown, 'utf8');
    return markdown;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    try {
        const markdown = generateStandardDecksMarkdownFile(process.argv[2], process.argv[3]);
        if (!process.argv[3]) process.stdout.write(markdown);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
