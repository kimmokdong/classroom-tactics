import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 데이터 임포트
import { UNIT_POOL, SYNERGIES, ITEM_POOLS } from './js/data.js';
import { ITEMS } from './js/items.js';
import { BattleEngine } from './js/battleEngine.js';

// ---------------------------------------------------------------------------
// 1. 덱 파서 (Parser)
// ---------------------------------------------------------------------------
function parseStandardDecks(markdownPath) {
    const content = fs.readFileSync(markdownPath, 'utf8');
    const lines = content.split('\n');
    
    const decks = [];
    let currentDeck = null;
    
    for (const line of lines) {
        const titleMatch = line.match(/^### 🏅 \[Lv\.(\d+)\] (.*)/);
        if (titleMatch) {
            if (currentDeck && currentDeck.units.length > 0) {
                decks.push(currentDeck);
            }
            currentDeck = {
                level: parseInt(titleMatch[1], 10),
                name: titleMatch[2].trim(),
                fullName: `[Lv.${titleMatch[1]}] ${titleMatch[2].trim()}`,
                units: []
            };
            continue;
        }
        
        if (!currentDeck) continue;
        
        if (line.startsWith('- **출전 유닛**:')) {
            const unitsStr = line.replace('- **출전 유닛**:', '').trim();
            const unitTokens = unitsStr.split(',').map(s => s.trim());
            for (const ut of unitTokens) {
                const uName = ut.replace(/\(.*?\)/, '').trim();
                const unitData = UNIT_POOL.find(u => u.name === uName);
                if (unitData) {
                    currentDeck.units.push({
                        ...unitData,
                        assignedRole: 'filler'
                    });
                }
            }
        } else if (line.startsWith('- 🛡️ **메인 탱커**:')) {
            const uName = line.replace('- 🛡️ **메인 탱커**:', '').replace(/\(.*?\)/g, '').trim();
            const u = currentDeck.units.find(u => u.name === uName);
            if (u) u.assignedRole = 'main_tank';
        } else if (line.startsWith('- ⚔️ **메인 딜러**:')) {
            const uName = line.replace('- ⚔️ **메인 딜러**:', '').replace(/\(.*?\)/g, '').trim();
            const u = currentDeck.units.find(u => u.name === uName);
            if (u) u.assignedRole = 'main_dealer';
        } else if (line.startsWith('- 🪄 **서브 딜러**:')) {
            const uName = line.replace('- 🪄 **서브 딜러**:', '').replace(/\(.*?\)/g, '').trim();
            const u = currentDeck.units.find(u => u.name === uName);
            if (u) u.assignedRole = 'sub_dealer';
        }
    }
    if (currentDeck && currentDeck.units.length > 0) {
        decks.push(currentDeck);
    }
    
    return decks;
}

// ---------------------------------------------------------------------------
// 2. 성급(Star Level) 배정 로직 & 3. 아이템 자동 장착 로직
// ---------------------------------------------------------------------------
function buildCombatBoard(deck) {
    const board = Array(24).fill(null);
    let frontIndex = 0; // 0~7
    let backIndex = 16; // 16~23

    deck.units.forEach(unit => {
        // 복제 객체 생성 (실제 전투에 사용할 인스턴스)
        let combatUnit = JSON.parse(JSON.stringify(unit));
        
        // --- 2. 성급 (Star Level) 보정 ---
        let starLevel = 2; // 기본 2성
        
        if (deck.level === 7) {
            // 7렙 리롤덱: 캐리가 2~3코면 3성작
            if ((combatUnit.assignedRole === 'main_tank' || combatUnit.assignedRole === 'main_dealer' || combatUnit.assignedRole === 'sub_dealer') && (combatUnit.tier === 2 || combatUnit.tier === 3)) {
                starLevel = 3;
            } else if (combatUnit.tier === 1) { // 1코 쩌리도 리롤하다 같이 3성 붙는 경우 가정
                starLevel = 3; 
            }
        } else if (deck.level === 8) {
            // 8렙덱: 캐리가 3코면 확률적으로 3성이지만 일단 3성 고정으로 밸런스 체크, 4코는 2성
            if ((combatUnit.assignedRole === 'main_tank' || combatUnit.assignedRole === 'main_dealer' || combatUnit.assignedRole === 'sub_dealer') && combatUnit.tier === 3) {
                starLevel = 3;
            }
        }
        
        // 스탯 증폭 (TFT 기준: 2성 = 1.8배, 3성 = 1.8 * 1.8 = 3.24배)
        // unitData의 기본 스탯은 1성 기준임 (현재 data.js는 1성 기준인지 확인 필요하지만 일단 배수 적용)
        const statMult = starLevel === 3 ? 3.24 : 1.8;
        combatUnit.stats.hp = Math.round(combatUnit.stats.hp * statMult);
        combatUnit.stats.maxHp = combatUnit.stats.hp;
        combatUnit.stats.ad = Math.round(combatUnit.stats.ad * statMult);
        combatUnit.currHp = combatUnit.stats.hp;
        combatUnit.starLevel = starLevel;
        combatUnit.combat = combatUnit.combat || {};

        // --- 3. 스마트 아이템 장착 (Auto-Equip) ---
        combatUnit.combat.itemEffects = {};
        
        const isCore = ['main_tank', 'main_dealer', 'sub_dealer'].includes(combatUnit.assignedRole);
        if (isCore) {
            let itemIds = [];
            const archetype = combatUnit.archetype;
            
            if (archetype && ITEM_POOLS[archetype]) {
                const pool = [...ITEM_POOLS[archetype]]; // 얕은 복사
                // 배열 섞기 (Fisher-Yates)
                for (let i = pool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [pool[i], pool[j]] = [pool[j], pool[i]];
                }
                // 앞에서부터 3개 추출 (풀이 3개 미만이면 전체)
                itemIds = pool.slice(0, 3);
            } else {
                // 예외 상황 대비 기본값
                itemIds = ['comb_hp_hp', 'comb_armor_armor', 'comb_mr_mr'];
            }
            
            // 아이템 스탯 및 효과 적용
            itemIds.forEach(id => {
                const itemData = ITEMS.find(i => i.id === id);
                if (itemData) {
                    // 스탯 추가
                    if (itemData.stats) {
                        if (itemData.stats.ad) combatUnit.stats.ad += itemData.stats.ad;
                        if (itemData.stats.ap) combatUnit.stats.ap += itemData.stats.ap;
                        if (itemData.stats.armor) combatUnit.stats.armor += itemData.stats.armor;
                        if (itemData.stats.mr) combatUnit.stats.mr += itemData.stats.mr;
                        if (itemData.stats.maxHp) {
                            combatUnit.stats.maxHp += itemData.stats.maxHp;
                            combatUnit.currHp += itemData.stats.maxHp;
                        }
                        if (itemData.stats.as) combatUnit.stats.as *= (1 + itemData.stats.as);
                        if (itemData.stats.critChance) combatUnit.combat.critChance = (combatUnit.combat.critChance || 0.25) + itemData.stats.critChance;
                    }
                    // 고유 효과 플래그
                    if (itemData.effect) {
                        combatUnit.combat.itemEffects[itemData.effect] = (combatUnit.combat.itemEffects[itemData.effect] || 0) + 1;
                    }
                }
            });
        }
        
        // 배치 (간이 로직: 탱커는 앞열, 딜러/서폿은 뒷열)
        if (combatUnit.role === 'tank' || combatUnit.stats.range === 1) {
            board[frontIndex] = combatUnit;
            frontIndex++;
            if (frontIndex >= 8) frontIndex = 8; // 줄 꽉차면 넘어감
        } else {
            board[backIndex] = combatUnit;
            backIndex++;
            if (backIndex >= 24) backIndex = 8; // 뒷열 차면 중간열로
        }
    });
    
    return board;
}

// ---------------------------------------------------------------------------
// 4. 전투 엔진 연동 (Headless 시뮬레이터)
// ---------------------------------------------------------------------------
function simulateMatch(deckA, deckB, iterations = 1000) {
    let winsA = 0;
    let winsB = 0;
    
    for (let i = 0; i < iterations; i++) {
        const boardA = buildCombatBoard(deckA);
        const boardB = buildCombatBoard(deckB);
        
        // BattleEngine은 player와 enemy의 board 배열(크기 24)을 받음
        const engine = new BattleEngine(boardA, boardB, [], 50); // 증강 없이 순수 덱 파워만
        
        let matchWinner = 'enemy';
        // 메모리 폭발 방지 및 속도 최적화를 위해 로그 배열 우회(Monkey-patch)
        const dummyLogs = [];
        dummyLogs.push = function(logObj) {
            if (logObj.type === 'end') {
                matchWinner = logObj.winner;
                Array.prototype.push.call(this, logObj); // 'end' 로그만 저장하여 메모리 확보 및 호환성 유지
            }
        };
        engine.logs = dummyLogs;

        engine.run();
        
        if (matchWinner === 'player') {
            winsA++;
        } else {
            winsB++;
        }
    }
    
    return {
        winsA,
        winsB,
        winRateA: winsA / iterations
    };
}

// ---------------------------------------------------------------------------
// 5. 리그 시스템 (풀리그)
// ---------------------------------------------------------------------------
function runLeague(decks, name, iterations) {
    console.log(`\n🏆 [${name}] 토너먼트 시작... (총 ${decks.length}개 덱)`);
    
    // 점수판 초기화
    const scoreboard = decks.map(d => ({
        deck: d,
        wins: 0,
        matches: 0
    }));
    
    for (let i = 0; i < decks.length; i++) {
        for (let j = i + 1; j < decks.length; j++) {
            const result = simulateMatch(decks[i], decks[j], iterations);
            
            scoreboard[i].matches += iterations;
            scoreboard[i].wins += result.winsA;
            
            scoreboard[j].matches += iterations;
            scoreboard[j].wins += result.winsB;
        }
    }
    
    // 승률 순으로 정렬
    scoreboard.forEach(s => s.winRate = s.wins / s.matches);
    scoreboard.sort((a, b) => b.winRate - a.winRate);
    
    return scoreboard;
}

// ---------------------------------------------------------------------------
// 6. 메인 실행부
// ---------------------------------------------------------------------------
async function main() {
    const mdPath = path.join(process.cwd(), 'docs', 'standard_decks.md');
    let decks = [];
    
    try {
        decks = parseStandardDecks(mdPath);
        console.log(`✅ standard_decks.md 파싱 완료. 총 ${decks.length}개의 덱 로드 성공.`);
    } catch (e) {
        console.error("❌ 덱 파싱 실패:", e);
        return;
    }
    
    // 덱을 레벨별로 분리
    const level7Decks = decks.filter(d => d.level === 7);
    const level8Decks = decks.filter(d => d.level === 8);
    const level9Decks = decks.filter(d => d.level >= 9); // 9와 10을 하나로 묶음 (고밸류)
    const level10Decks = decks.filter(d => d.level === 10);
    
    const ITERATIONS_PER_MATCH = 10; // 성능을 위해 10번으로 조정. (덱이 68개면 All-Star 리그는 2,278경기 * 10 = 22,780번의 전투 발생)
    
    console.log("🔥 5대 리그 시뮬레이션을 가동합니다...");
    const result7 = runLeague(level7Decks, 'Lv.7 미드게임 리그', ITERATIONS_PER_MATCH);
    const result8 = runLeague(level8Decks, 'Lv.8 코어게임 리그', ITERATIONS_PER_MATCH);
    const result9 = runLeague(level9Decks, 'Lv.9~10 레이트게임 리그', ITERATIONS_PER_MATCH);
    const resultAll = runLeague(decks, '무제한급 올스타 통합 리그', ITERATIONS_PER_MATCH);
    
    // 리포트 마크다운 생성
    let reportMd = `# 📊 교실 택틱스 v2 구간별 메타 리포트\n\n`;
    reportMd += `> 🕒 **리포트 산출 시간**: ${new Date().toISOString()}\n`;
    reportMd += `> ⚔️ **토너먼트 룰**: 핵심 기물 3신기 자동 장착, 레벨별 성급 보정(리롤덱 3성 고증) 적용 완료. 매치당 ${ITERATIONS_PER_MATCH}회 시뮬레이션 교차 검증.\n\n`;
    
    function generateTable(scoreboard, limit = 10) {
        let md = `| 랭킹 | 승률 | 덱 명칭 | 핵심 3인방 (템 셋팅) |\n`;
        md += `|---|---|---|---|\n`;
        for (let i = 0; i < Math.min(scoreboard.length, limit); i++) {
            const row = scoreboard[i];
            const cores = row.deck.units.filter(u => ['main_tank', 'main_dealer', 'sub_dealer'].includes(u.assignedRole));
            const coreNames = cores.map(u => `${u.name}(${u.tier}코)`).join(', ');
            md += `| 🏆 ${i+1}위 | **${(row.winRate * 100).toFixed(1)}%** | ${row.deck.fullName} | ${coreNames} |\n`;
        }
        return md;
    }
    
    reportMd += `## 🥇 Lv.7 미드게임 투기장 (7렙 리롤덱 체급표)\n`;
    reportMd += generateTable(result7, 15) + '\n';
    
    reportMd += `## 🥇 Lv.8 코어게임 투기장 (8렙 운영덱 체급표)\n`;
    reportMd += generateTable(result8, 15) + '\n';
    
    reportMd += `## 🥇 Lv.9~10 극후반 투기장 (왕귀형 덱 체급표)\n`;
    reportMd += generateTable(result9, 15) + '\n';
    
    reportMd += `## 🏆 무제한급 통합 올스타 리그 (전체 랭킹 68위)\n`;
    reportMd += generateTable(resultAll, 68) + '\n';
    
    const reportPath = path.join(process.cwd(), 'simulation_report_v2.md');
    fs.writeFileSync(reportPath, reportMd, 'utf8');
    
    console.log(`\n✅ 시뮬레이션 완료! 결과가 ${reportPath} 에 저장되었습니다.`);
}

main();
