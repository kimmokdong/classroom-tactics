import fs from 'fs';
import { UNIT_POOL } from '../js/data.js';
import { ITEMS } from '../js/items.js';
import { BattleEngine } from '../js/battleEngine.js';
import { generateEnemyBoard } from '../js/enemyAi.js';

function applyItemsToStats(board) {
    const cloned = JSON.parse(JSON.stringify(board));
    const combinedItems = ITEMS.filter(it => it.type === 'combined' && it.effect !== 'thievesGloves');

    for (let i = 0; i < 24; i++) {
        let u = cloned[i];
        if (u) {
            u.currHp = u.stats.hp;
            u.currMana = u.stats.mana || 0;
            u.currShield = 0;
            u.stats.maxHp = u.stats.hp;
            u.stats.maxMana = u.stats.maxMana || u.stats.mana || 0;
            u.combat = { shield: 0, vamp: 0, dmgAmp: 0, critChance: 0.10, critDmg: 1.5, dmgReduc: 0, itemEffects: {} };

            if (u.items) {
                if (u.items.includes('comb_crit_crit')) {
                    const random1 = combinedItems[Math.floor(Math.random() * combinedItems.length)].id;
                    const random2 = combinedItems[Math.floor(Math.random() * combinedItems.length)].id;
                    u.items = ['comb_crit_crit', random1, random2];
                }

                u.items.forEach(itemId => {
                    const itemDef = ITEMS.find(it => it.id === itemId);
                    if (itemDef) {
                        if (itemDef.effect) {
                            u.combat.itemEffects[itemDef.effect] = (u.combat.itemEffects[itemDef.effect] || 0) + 1;
                            if (itemDef.effect === 'rfc') u.stats.range += 1;
                            if (itemDef.effect === 'rabadon') u.stats.ap *= 1.20;
                            if (itemDef.effect === 'blueBuff') u.stats.maxMana = Math.max(10, u.stats.maxMana - 10);
                            if (itemDef.effect === 'deathblade') u.stats.ad += 20;
                            if (itemDef.effect === 'guardbreaker') u.combat.dmgAmp += 0.15;
                            if (itemDef.effect === 'skillCrit') u.combat.critDmg += 0.10;
                            if (itemDef.effect === 'hoj') {
                                u.combat.dmgAmp += 0.15;
                                u.combat.vamp += 0.15;
                            }
                        }
                        if (itemDef.stats) {
                            if (itemDef.stats.hp) { u.stats.maxHp += itemDef.stats.hp; u.currHp += itemDef.stats.hp; }
                            if (itemDef.stats.maxHp) { u.stats.maxHp += itemDef.stats.maxHp; u.currHp += itemDef.stats.maxHp; }
                            if (itemDef.stats.mana) u.currMana += itemDef.stats.mana;
                            if (itemDef.stats.ad) u.stats.ad += itemDef.stats.ad;
                            if (itemDef.stats.ap) u.stats.ap += itemDef.stats.ap;
                            if (itemDef.stats.armor) u.stats.armor += itemDef.stats.armor;
                            if (itemDef.stats.mr) u.stats.mr += itemDef.stats.mr;
                            if (itemDef.stats.critChance) u.combat.critChance = (u.combat.critChance || 0.10) + itemDef.stats.critChance;
                            if (itemDef.stats.vamp) u.combat.vamp = (u.combat.vamp || 0) + itemDef.stats.vamp;
                            if (itemDef.stats.dodge) u.combat.dodge = (u.combat.dodge || 0) + itemDef.stats.dodge;
                        }
                    }
                });
            }
        }
    }
    return cloned;
}

export function runSimulation(playerBoardDef, enemyBoardDef) {
    const pBoard = applyItemsToStats(playerBoardDef);
    const eBoard = applyItemsToStats(enemyBoardDef);

    const engine = new BattleEngine(pBoard, eBoard);
    engine.run();

    let playerHpSum = 0;
    let enemyHpSum = 0;
    let pCount = 0;
    let eCount = 0;
    let pTotalMaxHp = 0;
    let eTotalMaxHp = 0;

    engine.board.forEach(u => {
        if (u) {
            if (u.currHp > 0) {
                if (u.team === 'player') {
                    playerHpSum += u.currHp;
                    pCount++;
                } else if (u.team === 'enemy') {
                    enemyHpSum += u.currHp;
                    eCount++;
                }
            }
            if (u.team === 'player') pTotalMaxHp += u.stats.maxHp;
            else if (u.team === 'enemy') eTotalMaxHp += u.stats.maxHp;
        }
    });

    let winner = 'draw';
    if (pCount > 0 && eCount === 0) winner = 'player';
    else if (eCount > 0 && pCount === 0) winner = 'enemy';

    return {
        winner,
        playerAliveCount: pCount,
        enemyAliveCount: eCount,
        playerHpSum,
        enemyHpSum,
        playerHpPct: (playerHpSum / Math.max(1, pTotalMaxHp)),
        enemyHpPct: (enemyHpSum / Math.max(1, eTotalMaxHp)),
        totalTicks: engine.tick
    };
}

function generateRandomPlayerBoard() {
    const board = Array(24).fill(null);
    const slots = Array.from({ length: 24 }, (_, i) => i).sort(() => Math.random() - 0.5);

    // We allow max 8 units on board (Level 8 representation)
    const numUnits = 7 + Math.floor(Math.random() * 2); // 7 or 8 units
    for (let i = 0; i < numUnits; i++) {
        let base = UNIT_POOL[Math.floor(Math.random() * UNIT_POOL.length)];
        let star = Math.random() < 0.15 ? 3 : (Math.random() < 0.6 ? 2 : 1);
        let u = JSON.parse(JSON.stringify(base));
        u.star = star;
        if (star >= 2) { u.stats.hp = Math.round(u.stats.hp * 1.8); u.stats.ad = Math.round(u.stats.ad * 1.5); u.stats.ap = Math.round(u.stats.ap * 1.5); }
        if (star === 3) {
            u.stats.hp = Math.round(u.stats.hp * 1.8);
            u.stats.ad = Math.round(u.stats.ad * 1.5);
            u.stats.ap = Math.round(u.stats.ap * 1.5);
            if (u.tier <= 3) {
                u.stats.armor += Math.round(50 - (u.tier * 10));
                u.stats.mr += Math.round(50 - (u.tier * 10));
                u.stats.hp += Math.round(500 - (u.tier * 100));
            }
        }
        u.stats.maxHp = u.stats.hp;
        u.items = [];
        const numItems = Math.floor(Math.random() * 4); // 0 to 3 items
        for (let j = 0; j < numItems; j++) {
            u.items.push(ITEMS.filter(it => it.type === 'combined')[Math.floor(Math.random() * 36)].id);
        }
        board[slots[i]] = u;
    }
    return board;
}

function mutateBoard(board) {
    const newBoard = JSON.parse(JSON.stringify(board));

    if (Math.random() < 0.5) {
        let uIdxs = [];
        for (let i = 0; i < 24; i++) if (newBoard[i]) uIdxs.push(i);
        if (uIdxs.length > 0) {
            let from = uIdxs[Math.floor(Math.random() * uIdxs.length)];
            let empties = [];
            for (let i = 0; i < 24; i++) if (!newBoard[i]) empties.push(i);
            if (empties.length > 0) {
                let to = empties[Math.floor(Math.random() * empties.length)];
                newBoard[to] = newBoard[from];
                newBoard[from] = null;
            }
        }
    }
    if (Math.random() < 0.4) {
        let uIdxs = [];
        for (let i = 0; i < 24; i++) if (newBoard[i]) uIdxs.push(i);
        if (uIdxs.length > 0) {
            let from = uIdxs[Math.floor(Math.random() * uIdxs.length)];
            let base = UNIT_POOL[Math.floor(Math.random() * UNIT_POOL.length)];
            let star = newBoard[from].star;
            let n = JSON.parse(JSON.stringify(base));
            n.star = star;
            if (star >= 2) { n.stats.hp = Math.round(n.stats.hp * 1.8); n.stats.ad = Math.round(n.stats.ad * 1.5); n.stats.ap = Math.round(n.stats.ap * 1.5); }
            if (star === 3) {
                n.stats.hp = Math.round(n.stats.hp * 1.8);
                n.stats.ad = Math.round(n.stats.ad * 1.5);
                n.stats.ap = Math.round(n.stats.ap * 1.5);
                if (n.tier <= 3) {
                    n.stats.armor += Math.round(50 - (n.tier * 10));
                    n.stats.mr += Math.round(50 - (n.tier * 10));
                    n.stats.hp += Math.round(500 - (n.tier * 100));
                }
            }
            n.stats.maxHp = n.stats.hp;
            n.items = newBoard[from].items || [];
            newBoard[from] = n;
        }
    }
    if (Math.random() < 0.3) {
        let uIdxs = [];
        for (let i = 0; i < 24; i++) if (newBoard[i]) uIdxs.push(i);
        if (uIdxs.length > 0) {
            let tgt = uIdxs[Math.floor(Math.random() * uIdxs.length)];
            newBoard[tgt].items = [];
            const numItems = Math.floor(Math.random() * 4);
            for (let j = 0; j < numItems; j++) {
                newBoard[tgt].items.push(ITEMS.filter(it => it.type === 'combined')[Math.floor(Math.random() * 36)].id);
            }
        }
    }
    return newBoard;
}

function summarizeBoard(board) {
    let units = [];
    board.forEach(u => {
        if (u) units.push(`★${u.star} ${u.name} [${u.items.map(it => ITEMS.find(item => item.id == it)?.name.substring(0, 3) || '???').join(',')}]`);
    });
    return units.join(' + ');
}

if (process.argv[1] && process.argv[1].includes('simulate_balance.js')) {
    const GENERATIONS = 10;  // 세대수 높을수록 더 정교한 사기덱 탐색
    const POOL_SIZE = 10;
    const MATCHES_PER_EVAL = 50;

    console.log("🎮 밸런스 붕괴(OP) 덱 자동 탐색(Heuristic Agent)을 시작합니다...");

    // ── 시너지 기여도 추적기 ─────────────────────────────────────────────
    // synergy => { totalWins, totalMatches }
    const synergyStats = {};

    function getSynergiesFromBoard(board) {
        const counts = {};
        board.forEach(u => {
            if (!u) return;
            [u.subject, u.club].forEach(syn => {
                if (syn) counts[syn] = (counts[syn] || 0) + 1;
            });
        });
        return counts;
    }

    function trackSynergy(board, wins, totalMatches) {
        const counts = getSynergiesFromBoard(board);
        Object.keys(counts).forEach(syn => {
            if (!synergyStats[syn]) synergyStats[syn] = { totalWins: 0, totalMatches: 0, totalEHP: 0, appearances: 0 };
            synergyStats[syn].totalWins += wins;
            synergyStats[syn].totalMatches += totalMatches;
            synergyStats[syn].appearances += 1;
        });
    }

    let population = [];
    for (let i = 0; i < POOL_SIZE; i++) {
        population.push(generateRandomPlayerBoard());
    }

    let topScores = [];

    for (let gen = 1; gen <= GENERATIONS; gen++) {
        let scores = population.map((board, idx) => {
            let wins = 0;
            let totalEHP = 0;
            for (let i = 0; i < MATCHES_PER_EVAL; i++) {
                const enemyBoard = generateEnemyBoard(7, 5);
                const res = runSimulation(board, enemyBoard);
                if (res.winner === 'player') wins++;
                totalEHP += isNaN(res.playerHpPct) ? 0 : res.playerHpPct;
            }
            // 이 덱의 시너지 기여도 기록
            trackSynergy(board, wins, MATCHES_PER_EVAL);
            return {
                board,
                winRate: wins / MATCHES_PER_EVAL,
                avgEHP: (totalEHP / MATCHES_PER_EVAL) || 0,
                score: (wins / MATCHES_PER_EVAL) * 1000 + (totalEHP / MATCHES_PER_EVAL)
            };
        });

        scores.sort((a, b) => b.score - a.score);
        console.log(`\n🧬 세대 ${gen}/${GENERATIONS} | 1위 승률: ${(scores[0].winRate * 100).toFixed(1)}%`);

        topScores = scores;
        let nextPop = [scores[0].board, scores[1].board]; // Elitism
        for (let i = 2; i < POOL_SIZE; i++) {
            let parent = scores[Math.floor(Math.random() * (POOL_SIZE / 2))].board;
            nextPop.push(mutateBoard(parent));
        }
        population = nextPop;
    }

    // ── 최종 덱 리포트 ─────────────────────────────────────────────────
    console.log("\n════════════════════════════════════════════════");
    console.log("📊 [최종 덱 승률 랭킹 (전체)]");
    console.log("════════════════════════════════════════════════");
    let csvData = 'Rank,WinRate,EHP,Composition\n';
    topScores.forEach((s, i) => {
        const deckText = summarizeBoard(s.board);
        const bar = '█'.repeat(Math.round(s.winRate * 20)).padEnd(20, '░');
        console.log(`  ${String(i + 1).padStart(2)}위 | ${bar} ${(s.winRate * 100).toFixed(1).padStart(5)}% | EHP ${(s.avgEHP * 100).toFixed(1).padStart(5)}% | ${deckText.slice(0, 55)}...`);
        csvData += `${i + 1},${(s.winRate * 100).toFixed(1)}%,${(s.avgEHP * 100).toFixed(1)}%,"${deckText}"\n`;
    });

    // ── 시너지별 평균 승률 리포트 ────────────────────────────────────────
    console.log("\n════════════════════════════════════════════════");
    console.log("🎯 [시너지별 평균 기여 승률 랭킹]");
    console.log("  (해당 시너지를 채용한 덱들의 평균 승률)");
    console.log("════════════════════════════════════════════════");

    const synergyList = Object.entries(synergyStats)
        .map(([name, s]) => ({
            name,
            winRate: s.totalMatches > 0 ? s.totalWins / s.totalMatches : 0,
            appearances: s.appearances
        }))
        .sort((a, b) => b.winRate - a.winRate);

    let synCsv = "Rank,Synergy,WinRate,Appearances\n";
    synergyList.forEach((s, i) => {
        const bar = '█'.repeat(Math.round(s.winRate * 20)).padEnd(20, '░');
        const danger = s.winRate >= 0.7 ? ' 🚨OP' : s.winRate >= 0.5 ? ' ⚠️' : '';
        console.log(`  ${String(i + 1).padStart(2)}위 | ${bar} ${(s.winRate * 100).toFixed(1).padStart(5)}% | 채용 ${String(s.appearances).padStart(3)}회 | ${s.name}${danger}`);
        synCsv += `${i + 1},${s.name},${(s.winRate * 100).toFixed(1)}%,${s.appearances}\n`;
    });

    try {
        if (!fs.existsSync('scratch')) fs.mkdirSync('scratch');
        fs.writeFileSync('scratch/balance_heuristic_results.csv', csvData, 'utf8');
        fs.writeFileSync('scratch/synergy_winrate_report.csv', synCsv, 'utf8');
        console.log("\n💾 결과 저장 완료:");
        console.log("   📄 scratch/balance_heuristic_results.csv  (최종 덱 전체)");
        console.log("   📄 scratch/synergy_winrate_report.csv     (시너지별 승률)");
    } catch (e) {
        console.error("CSV 저장 실패:", e);
    }
}


