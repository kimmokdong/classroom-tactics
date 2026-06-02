import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UNIT_POOL } from './js/data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. standard_decks.md 파싱
function parseStandardDecks(markdownPath) {
    if (!fs.existsSync(markdownPath)) return [];
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
                        name: unitData.name,
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

// 2. 시뮬레이션 결과 파싱
function parseSimulationReport(reportPath) {
    if (!fs.existsSync(reportPath)) return {};
    const content = fs.readFileSync(reportPath, 'utf8');
    const lines = content.split('\n');
    const data = {};
    let currentMode = '';
    
    for (const line of lines) {
        if (line.includes('## 🥇 Lv.')) currentMode = line;
        else if (line.includes('## 🏆 무제한급')) currentMode = '무제한급';
        
        if (currentMode === '무제한급' && line.includes('| 🏆')) {
            const parts = line.split('|').map(s => s.trim());
            if (parts.length >= 5) {
                const winRateStr = parts[2].replace(/\*/g, '').replace('%', '');
                const winRate = parseFloat(winRateStr);
                const deckName = parts[3];
                data[deckName] = winRate;
            }
        }
    }
    return data;
}

// 3. 메인 실행
function buildPveData() {
    const metaDecks = parseStandardDecks(path.join(__dirname, 'standard_decks.md'));
    const earlyDecks = parseStandardDecks(path.join(__dirname, 'early_decks.md'));
    const winRates = parseSimulationReport(path.join(__dirname, 'simulation_report_v3_new_items.md'));

    // 승률 주입 (메타 덱만)
    for (const deck of metaDecks) {
        if (winRates[deck.fullName] !== undefined) {
            deck.winRate = winRates[deck.fullName];
        } else {
            deck.winRate = 0; // fallback
        }
    }

    // 승률 기준 오름차순 정렬 (약한 덱 -> 강한 덱)
    metaDecks.sort((a, b) => a.winRate - b.winRate);

    // MMR 부여 (0 ~ 3000)
    for (let i = 0; i < metaDecks.length; i++) {
        metaDecks[i].mmr = Math.round(i * (3000 / Math.max(1, metaDecks.length - 1)));
    }

    // 초기 덱(early)은 별도 배열로 관리, MMR은 무작위 변동성을 위해 부여하지 않음 (레벨 필터링만 사용)
    const pveData = {
        metaDecks: metaDecks,
        earlyDecks: earlyDecks
    };

    fs.writeFileSync(path.join(__dirname, 'pve_ladder.json'), JSON.stringify(pveData, null, 2), 'utf8');
    console.log(`✅ pve_ladder.json 빌드 완료! (메타 덱 ${metaDecks.length}종 MMR 적용 / 초반 미니 덱 ${earlyDecks.length}종 통합)`);
}

buildPveData();
