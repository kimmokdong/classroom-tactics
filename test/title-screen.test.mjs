import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('시작 화면은 싱글·멀티 모드와 기존 게임 진입 동작을 제공한다', async () => {
    const [html, main] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../js/main.js', import.meta.url), 'utf8')
    ]);

    assert.match(html, /id="title-screen"/);
    assert.match(html, /id="btn-title-single"/);
    assert.match(html, /id="btn-title-multi"/);
    assert.doesNotMatch(html, /START SCREEN DEMO|data-title-demo=/);
    assert.equal(html.match(/data-kind="과목"/g)?.length, 10);
    assert.equal(html.match(/data-kind="동아리"/g)?.length, 7);
    for (const synergy of ['국어', '수학', '사회', '과학', '영어', '체육', '음악', '미술', '도덕', '창체', '선도부', '방송부', '육상부', '보건부', '급식부', '장난꾸러기', '경제부']) {
        assert.match(html, new RegExp(`<strong>${synergy}<\\/strong>`));
    }
    assert.equal(html.match(/data-title-preview="u5_[234]"/g)?.length, 3);
    assert.match(html, /\/images\/title-command-gameplay\.jpg/);
    for (const label of ['시너지 패널', '생기부 특기사항', '아이템 인벤토리', '6 × 8 실전 보드', '유닛 정보 · 전투 로그']) {
        assert.match(html, new RegExp(label));
    }
    assert.doesNotMatch(html, /class="title-scene title-items"/);
    assert.match(html, /만든이 <strong>김목동<\/strong>/);
    assert.match(html, /0\.1 \(0807\)/);
    assert.match(main, /titleScreen\?\.classList\.add\('is-leaving'\)/);
    assert.match(main, /playBgmSequence\('prep'\)/);
    assert.match(main, /titleScreen\.dataset\.scene = scene/);
    assert.match(main, /new SkillPreviewer\(\)/);
    assert.match(main, /previewer\.start\(canvas, unit\)/);
    assert.match(main, /setInterval\(rotateTitleScene, 5000\)/);
    assert.match(main, /clearInterval\(titleSceneTimer\)/);
    assert.match(main, /document\.body\.dataset\.titleScene = scene/);
});

test('신규 고코스트 승인 데모는 두 유닛과 전용 스킬 연출을 재생한다', async () => {
    const [html, previewer, fxSystem, fxRenderer] = await Promise.all([
        readFile(new URL('../new-unit-skill-demo.html', import.meta.url), 'utf8'),
        readFile(new URL('../js/ui/SkillPreviewer.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/battle/FxSystem.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/battle/FxRenderer.js', import.meta.url), 'utf8')
    ]);

    for (const text of ['모의투자 우승자', '분산 투자', '전교 액션스타', '원테이크 액션']) assert.match(html, new RegExp(text));
    assert.equal(html.match(/new SkillPreviewer\(\)/g)?.length, 1);
    assert.match(previewer, /demo_u4_10.*school_portfolio/);
    assert.match(previewer, /demo_u5_6.*school_action_star/);
    assert.match(fxSystem, /type === 'school_portfolio'/);
    assert.match(fxSystem, /type === 'school_action_star'/);
    assert.match(fxRenderer, /p\.type === 'portfolio_network'/);
    assert.match(fxRenderer, /p\.type === 'action_star_cinematic'/);
});
