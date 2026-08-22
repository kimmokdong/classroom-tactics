import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

test('노트북과 가로형 태블릿은 게임 본체만 단계별로 축소한다', () => {
  assert.match(css, /min-width:\s*1401px[\s\S]*?#app\s*\{[^}]*zoom:\s*0\.85/);
  assert.match(css, /min-width:\s*1101px[\s\S]*?#app\s*\{[^}]*zoom:\s*0\.75/);
  assert.match(css, /min-width:\s*901px[\s\S]*?#app\s*\{[^}]*zoom:\s*0\.6/);
  assert.doesNotMatch(css, /\.title-screen[^\{]*\{[^}]*zoom:/);
});

test('1536×864 노트북은 높이 조건으로 75%까지 축소한다', () => {
  assert.match(css, /@media \(min-width:\s*1101px\) and \(max-height:\s*900px\)\s*\{\s*#app\s*\{[^}]*width:\s*133\.334%;[^}]*height:\s*calc\(100vh \/ 0\.75\);[^}]*zoom:\s*0\.75/);
});

test('1366×768 노트북은 70%로 더 축소하고 세로형 태블릿은 제외한다', () => {
  assert.match(css, /@media \(min-width:\s*1101px\) and \(max-height:\s*800px\)\s*\{\s*#app\s*\{[^}]*width:\s*142\.858%;[^}]*height:\s*calc\(100vh \/ 0\.7\);[^}]*zoom:\s*0\.7/);
  assert.match(css, /@media \(max-width:\s*900px\)\s*\{[\s\S]*?#game-main\s*\{\s*flex-direction:\s*column/);
});
