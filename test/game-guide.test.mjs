import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('시작 화면에서 초보자 게임 가이드를 새 창으로 열 수 있다', async () => {
    const [titleHtml, guideHtml] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../public/game-guide.html', import.meta.url), 'utf8')
    ]);

    assert.match(titleHtml, /href="\.\/game-guide\.html"/);
    assert.match(titleHtml, /target="_blank"/);
    assert.match(titleHtml, /rel="noopener"/);
    assert.match(titleHtml, />게임 가이드</);

    assert.match(guideHtml, /처음이어도/);
    assert.match(guideHtml, /학생 구매/);
    assert.match(guideHtml, /자동 전투/);
    assert.match(guideHtml, /같은 학생 <strong>3명은 2성<\/strong>/);
    assert.match(guideHtml, /최대 3칸/);
    assert.match(guideHtml, /일반 상점 리롤/);
    assert.match(guideHtml, /2-1 · 3-1 · 4-1/);
    assert.match(guideHtml, /2~4 · 5 · 6\+연속/);
    assert.match(guideHtml, /예상 첫 대상/);
    assert.match(guideHtml, /전투 복기/);
    assert.match(guideHtml, /주황 칸 · 앞줄 휩쓸기/);
    assert.match(guideHtml, /빨간 조준선 · 표식 폭발/);
    assert.match(guideHtml, /보라색 줄 · 행 마나 봉인/);
    assert.match(guideHtml, /친구 방은 2~6명/);
    assert.match(guideHtml, /탈락 후 관전/);
    assert.match(guideHtml, /연결 유예 시간은 90초/);
    assert.match(guideHtml, /\.\/images\/title-command-gameplay\.jpg/);
    assert.equal(guideHtml.match(/class="og-marker /g)?.length, 6);
    assert.doesNotMatch(guideHtml, /\{\{[^}]+\}\}/);
});
