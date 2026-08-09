import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildBattleSummary,
    formatBattleSummaryHtml,
    getIncomePreview,
    getIncomingThreatCount,
    getLikelyTargetIndex,
    getNextContextTip,
    getStreakBonus,
    getThreatAreaIndices
} from '../js/gameplayInsights.js';
import { DpsTracker } from '../js/battle/DpsTracker.js';

test('연승·연패 보너스는 2~4회 1G, 5회 2G, 6회 이상 3G다', () => {
    assert.deepEqual([0, 1, 2, 4, 5, 6, 9].map(getStreakBonus), [0, 0, 1, 1, 2, 3, 3]);
});

test('상황형 초보 안내는 패배·증강체·별·시너지·경제·아이템 순으로 한 번씩 제안한다', () => {
    const state = {
        recentBattleResults: [{ result: 'enemy' }],
        augments: [{ id: 's1' }],
        gold: 10,
        board: [{ id: 'u1', name: '국어부장', star: 1, items: [] }],
        bench: [{ id: 'u1', name: '국어부장', star: 1 }],
        inventory: ['item']
    };
    const synergyData = { subjects: { 국어: 1 }, clubs: {} };
    const definitions = { subjects: { 국어: { levels: { 2: {} } } }, clubs: {} };
    assert.equal(getNextContextTip(state, synergyData, definitions, []).id, 'first-loss');
    assert.equal(getNextContextTip(state, synergyData, definitions, ['first-loss']).id, 'first-augment');
    assert.equal(getNextContextTip(state, synergyData, definitions, ['first-loss', 'first-augment']).id, 'two-copies');
});

test('다음 전투의 승리·패배 수입을 실제 정산 순서로 미리 계산한다', () => {
    const preview = getIncomePreview({ gold: 19, winStreak: 1, lossStreak: 0, snackShop: true });
    assert.equal(preview.lossInterest, 1);
    assert.equal(preview.winInterest, 2);
    assert.equal(preview.winTotal, 10); // 기본5 + 승리1 + 이자2 + 2연승1 + 매점1
    assert.equal(preview.lossTotal, 7); // 기본5 + 이자1 + 매점1
    const pve = getIncomePreview({ gold: 19, winStreak: 2, lossStreak: 0 }, { isPve: true });
    assert.equal(pve.winInterest, 1);
    assert.equal(pve.winTotal, 7); // 기본5 + 이자1 + 유지된 연승1
});

test('전투 로그와 통계에서 첫 이탈·스킬 횟수·주요 기여를 요약한다', () => {
    const summary = buildBattleSummary([
        { tick: 35, type: 'skill', team: 'player', unitName: '국어부장' },
        { tick: 70, type: 'die', team: 'player', unitName: '달리기 선수' },
        { tick: 80, type: 'skill', team: 'player', unitName: '국어부장' }
    ], {
        24: { team: 'player', name: '국어부장', damage: 820, tank: 100, heal: 0 },
        25: { team: 'player', name: '달리기 선수', damage: 120, tank: 700, heal: 20 }
    });
    assert.equal(summary.damage.name, '국어부장');
    assert.equal(summary.tank.name, '달리기 선수');
    assert.equal(summary.firstDeath.seconds, 7);
    assert.equal(summary.skillCasts, 2);
    assert.match(summary.observation, /앞줄 위치|방어 아이템/);
    assert.match(formatBattleSummaryHtml(summary), /전투 복기/);
});

test('선택한 아군의 가장 가까운 예상 첫 대상과 범위 칸을 찾는다', () => {
    const enemies = Array(24).fill(null);
    enemies[16] = { name: '왼쪽 적' };
    enemies[23] = { name: '오른쪽 적' };
    assert.equal(getLikelyTargetIndex(0, enemies), 16);
    assert.deepEqual(getThreatAreaIndices(9, 1), [0, 1, 2, 8, 9, 10, 16, 17, 18]);
    const allies = Array(24).fill(null);
    allies[0] = { name: '앞줄' };
    allies[23] = { name: '뒷줄' };
    assert.equal(getIncomingThreatCount(0, allies, enemies), 1);
});

test('전투 통계 초기화는 게임 상태가 바라보는 객체 참조를 유지한다', () => {
    const tracker = new DpsTracker();
    const shared = tracker.stats;
    tracker.stats[24] = { name: '학생', damage: 100 };
    tracker.reset();
    assert.equal(tracker.stats, shared);
    assert.deepEqual(shared, {});
});
