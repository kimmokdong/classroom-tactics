import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manager = await readFile(new URL('../js/multiplayer/MultiplayerManager.js', import.meta.url), 'utf8');
const stage = await readFile(new URL('../js/systems/StageManager.js', import.meta.url), 'utf8');
const saveManager = await readFile(new URL('../js/systems/SaveManager.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

test('멀티 HUD는 현재 라운드 제출 준비 인원을 표시한다', () => {
    assert.match(manager, /const submitted = alivePlayers\.filter\(player => player\.roundKey === roundKey\)\.length/);
    assert.match(manager, /제출 \$\{submitted\}\/\$\{alivePlayers\.length\}/);
});

test('대기실은 수동 시작하고 배치 단계만 서버 공용 마감시간 뒤 자동 진행한다', () => {
    assert.doesNotMatch(manager, /lobbyDeadline|scheduleLobbyCountdown/);
    assert.match(manager, /room\?\.planningClock/);
    assert.match(manager, /schedulePlanningCountdown\(\)/);
    assert.match(manager, /stageManager\?\.handleBattleStart\(\)/);
    assert.match(manager, /자동 전투 \$\{seconds\}초/);
    assert.match(manager, /scheduleRoundAdvance\(seconds = 5\)/);
    assert.match(manager, /modalManager\?\.closeResultModal\(\)/);
    assert.match(stage, /autoDeployBench\(app\.state\.board, app\.state\.bench, maxCapacity\)/);
    assert.match(stage, /multiplayerManager\?\.scheduleRoundAdvance\(\)/);
});

test('정찰은 인증된 scout API와 6x4 최근 보드 UI를 사용한다', () => {
    assert.match(manager, /request\('scout',[\s\S]*roundKey: getRoundKey/);
    assert.match(html, /id="multi-scout-board"[^>]+6열 4행/);
    assert.match(css, /grid-template-columns: repeat\(6, 1fr\)/);
});

test('탈락자는 관전으로 전환되고 상점과 전투 조작이 잠긴다', () => {
    assert.match(manager, /Number\(self\?\.hp\) <= 0\) this\.enterSpectatorMode\(\)/);
    assert.match(manager, /\['btn-start-battle', 'btn-reroll', 'btn-buy-exp', 'btn-lock-shop'\]/);
    assert.match(stage, /multiplayerManager\?\.isSpectating/);
});

test('감정 표현 6개는 서버 허용 키로 WebSocket에 전송된다', () => {
    for (const emote of ['hello', 'nice', 'wow', 'oops', 'cheer', 'gg']) {
        assert.match(html, new RegExp(`data-multi-emote="${emote}"`));
    }
    assert.match(manager, /socket\.send\(JSON\.stringify\(\{ type: 'emote', emote \}\)\)/);
    assert.match(manager, /message\.type === 'emote'/);
});

test('새로고침은 leave 대신 세션 상태를 저장하고 room API로 복원한다', () => {
    assert.match(manager, /sessionStorage\?\.setItem\(MULTIPLAYER_SESSION_KEY/);
    assert.match(manager, /serializeState\(this\.app\.state\)/);
    assert.match(manager, /request\('room', \{ method: 'GET', authenticated: true \}\)/);
    assert.doesNotMatch(manager, /sendBeacon/);
    assert.match(saveManager, /multiplayerManager\?\.credentials/);
});

test('종료 후 방장은 같은 자격증명으로 재대결하고 나갈 수 있다', () => {
    assert.match(manager, /request\('rematch', \{ authenticated: true \}\)/);
    assert.match(html, /id="btn-multi-hud-rematch"/);
    assert.match(html, /id="btn-multi-hud-leave"/);
});
