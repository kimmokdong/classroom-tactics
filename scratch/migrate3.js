import fs from 'fs';

const file = 'c:\\Users\\hyunseung\\Desktop\\classroom-tactics\\run_simulation.js';
let content = fs.readFileSync(file, 'utf8');

// I will replace the main() function.
// The GA logic currently:
// Let's create a custom function to run GA for a specific type.

const replacement = `
function runGAForType(type, popSize, generations) {
    let population = [];
    for(let i=0; i<popSize; i++) {
        let d = generateRandomDeck(type);
        assignItems(d, type);
        population.push({ deck: d, wins: 0, matches: 0, type });
    }
    
    for(let g=0; g<generations; g++) {
        population.forEach(p => { p.wins = 0; p.matches = 0; });
        for(let i=0; i<population.length; i++) {
            for(let m=0; m<BATTLES_PER_EVAL; m++) {
                let j = Math.floor(Math.random() * population.length);
                if(i === j) continue;
                if(fight(population[i].deck, population[j].deck)) {
                    population[i].wins++;
                } else {
                    population[j].wins++;
                }
                population[i].matches++;
                population[j].matches++;
            }
        }
        population.sort((a,b) => b.wins - a.wins);
        
        let newPop = [];
        let elites = population.slice(0, Math.floor(popSize * 0.2));
        newPop.push(...elites.map(e => ({ deck: JSON.parse(JSON.stringify(e.deck)), wins: 0, matches: 0, type })));
        
        while(newPop.length < popSize) {
            let p1 = elites[Math.floor(Math.random() * elites.length)].deck;
            let p2 = elites[Math.floor(Math.random() * elites.length)].deck;
            let child = [];
            
            p1.forEach(u => { if(Math.random() < 0.5) child.push(Object.assign({}, u)); });
            p2.forEach(u => { 
                if(child.length < (type==='6L'?6:type==='7L'?7:type==='8L'?8:9) && !child.find(c => c.id === u.id)) {
                    child.push(Object.assign({}, u));
                }
            });
            
            if(Math.random() < MUTATION_RATE) {
                if(child.length > 0) {
                    child.splice(Math.floor(Math.random() * child.length), 1);
                    let pool = UNIT_POOL.filter(u => !child.find(c => c.id === u.id));
                    if(pool.length > 0) {
                        let nu = Object.assign({}, pool[Math.floor(Math.random() * pool.length)]);
                        nu.star = 2;
                        child.push(nu);
                    }
                }
            }
            
            while(child.length < (type==='6L'?6:type==='7L'?7:type==='8L'?8:9)) {
                let pool = UNIT_POOL.filter(u => !child.find(c => c.id === u.id));
                let nu = Object.assign({}, pool[Math.floor(Math.random() * pool.length)]);
                nu.star = 2;
                child.push(nu);
            }
            
            assignItems(child, type);
            newPop.push({ deck: child, wins: 0, matches: 0, type });
        }
        population = newPop;
    }
    
    population.forEach(p => { p.wins = 0; p.matches = 0; });
    for(let i=0; i<population.length; i++) {
        for(let j=i+1; j<population.length; j++) {
            if(fight(population[i].deck, population[j].deck)) {
                population[i].wins++;
            } else {
                population[j].wins++;
            }
            population[i].matches++;
            population[j].matches++;
        }
    }
    population.sort((a,b) => b.wins - a.wins);
    
    // reset stats
    let top10 = population.slice(0, 10);
    top10.forEach(p => { p.wins = 0; p.matches = 0; });
    return top10;
}

function getUnitByName(name, star=2) {
    let base = UNIT_POOL.find(u => u.name === name);
    if (!base) return null;
    let u = JSON.parse(JSON.stringify(base));
    u.star = star;
    return u;
}

function buildCustomDeck(type, unitNames) {
    let deck = unitNames.map(n => getUnitByName(n, 2)).filter(u => u !== null);
    assignItems(deck, type);
    return { deck, wins: 0, matches: 0, type };
}

function main() {
    console.log("Generating top 10 decks for each level via GA...");
    let pop6L = runGAForType('6L', POP_SIZE, GENERATIONS);
    let pop7L = runGAForType('7L', POP_SIZE, GENERATIONS);
    let pop8L = runGAForType('8L', POP_SIZE, GENERATIONS);
    let pop9L = runGAForType('9L', POP_SIZE, GENERATIONS);
    
    let results = [...pop6L, ...pop7L, ...pop8L, ...pop9L];
    
    console.log("Adding 5 custom optimized decks...");
    let custom1 = buildCustomDeck('6L', ['과학탐구원', '칠판 낙서꾼', '골목대장', '발명품 매니아', '미친 과학자', '천재 퀀트']);
    let custom2 = buildCustomDeck('7L', ['찰흙 조각가', '골목대장', '발명품 매니아', '미술 치료사', '양호실 도우미', '수채화 장인', '피카소의 재림']);
    let custom3 = buildCustomDeck('8L', ['달리기 선수', '과학탐구원', '체육부장', '바른생활 사나이', '수학천재', '올림피아드 금상', '육상부 에이스', '전교 체육부장']);
    let custom4 = buildCustomDeck('8L', ['복도 지킴이', '국어부장', '문학소녀', '양호실 도우미', '시조 읊는 선비', '전교 학생회장', '나이팅게일', '교장 선생님']);
    let custom5 = buildCustomDeck('9L', ['복도 지킴이', '국어부장', '문학소녀', '양호실 도우미', '시조 읊는 선비', '전교 학생회장', '나이팅게일', '교장 선생님', '수석 연구원']);
    
    results.push(custom1, custom2, custom3, custom4, custom5);
    
    console.log(\`Starting Round Robin Tournament for \${results.length} decks (2 matches each)...\`);
    for(let i=0; i<results.length; i++) {
        for(let j=i+1; j<results.length; j++) {
            for(let m=0; m<2; m++) {
                if (fight(results[i].deck, results[j].deck)) {
                    results[i].wins++;
                } else {
                    results[j].wins++;
                }
                results[i].matches++;
                results[j].matches++;
            }
        }
    }
    
    results.sort((a,b) => b.wins - a.wins);
    
    let report = '';
    let synergyMeta = {};
    let synergyLevelMeta = {};
    let unitMeta = {};
    let roleMeta = { tank: {}, dealer: {}, subAce: {} };
    // 레벨별 통계 수집
    let levelStats = { '6L': { count: 0, wins: [] }, '7L': { count: 0, wins: [] }, '8L': { count: 0, wins: [] }, '9L': { count: 0, wins: [] } };
    
    // --- 순위 통계 섹션 ---
    let rankSection = \`# 📊 시뮬레이션 리포트 분석\\n> \${TOTAL_GOLD}골드 / \${new Date().toLocaleDateString('ko-KR')} 기준\\n\\n---\\n\\n\`;
    rankSection += \`## 🏆 최종 순위 통계 (Top 45)\\n\\n\`;
    rankSection += \`| 순위 | 덱 타입 | 덱 명칭 | 승률 | 🛡️ 메인 탱커 | ⚔️ 메인 딜러 | 🪄 서브 에이스 |\\n\`;
    rankSection += \`|---|---|---|---|---|---|---|\\n\`;
    
    for(let i=0; i<results.length; i++) {
        let r = results[i];
        let winrate = ((r.wins / r.matches) * 100).toFixed(1);
        let dname = getDeckName(r.deck);
        
        let tanks = [], dpss = [];
        r.deck.forEach(u => {
            if(u.items && u.items.length > 0) {
                if(u.items.includes('gargoyle')) tanks.push(u);
                else dpss.push(u);
            }
        });
        
        const unitDesc = (u) => u ? \`\${u.name}(\${u.tier}코, \${u.star}성)\` : '-';
        let typeStr = r.type;
        if (i >= 40 && [custom1, custom2, custom3, custom4, custom5].includes(r)) {
            typeStr = \`**\${r.type}(유저)**\`;
        }
        rankSection += \`| **\${i+1}위** | \${typeStr} | **\${dname}** | \${winrate}% | \${unitDesc(tanks[0])} | \${unitDesc(dpss[0])} | \${unitDesc(dpss[1])} |\\n\`;
        
        // 메타 데이터 수집
        levelStats[r.type].count++;
        levelStats[r.type].wins.push(parseFloat(winrate));
        
        if (tanks[0]) roleMeta.tank[tanks[0].name] = (roleMeta.tank[tanks[0].name]||0) + 1;
        if (dpss[0]) roleMeta.dealer[dpss[0].name] = (roleMeta.dealer[dpss[0].name]||0) + 1;
        if (dpss[1]) roleMeta.subAce[dpss[1].name] = (roleMeta.subAce[dpss[1].name]||0) + 1;

        let counts = synergyManager.getSynergyData(r.deck);
        const getActive = (count, synData) => {
            if (!synData) return 0;
            let levels = Object.keys(synData.levels).map(Number).sort((a,b)=>a-b);
            let activeLvl = 0;
            if (synData.exactMatch) { if (levels.includes(count)) activeLvl = count; }
            else { levels.forEach(l => { if (count >= l) activeLvl = l; }); }
            return activeLvl;
        };
        for(let s in counts.subjects) {
            let lvl = getActive(counts.subjects[s], SYNERGIES.subjects[s]);
            if (lvl > 0) {
                synergyMeta[s] = (synergyMeta[s]||0) + 1;
                synergyLevelMeta[\`\${s}\${lvl}\`] = (synergyLevelMeta[\`\${s}\${lvl}\`]||0) + 1;
            }
        }
        for(let c in counts.clubs) {
            let lvl = getActive(counts.clubs[c], SYNERGIES.clubs[c]);
            if (lvl > 0) {
                synergyMeta[c] = (synergyMeta[c]||0) + 1;
                synergyLevelMeta[\`\${c}\${lvl}\`] = (synergyLevelMeta[\`\${c}\${lvl}\`]||0) + 1;
            }
        }
        
        r.deck.forEach(u => {
            if (!unitMeta[u.name]) unitMeta[u.name] = { total: 0, carry: 0, tier: u.tier };
            unitMeta[u.name].total++;
            if(u.items && u.items.length > 0) unitMeta[u.name].carry++;
        });
    }
    
    // 미등장 유닛도 0으로 채우기
    UNIT_POOL.forEach(u => {
        if (!unitMeta[u.name]) unitMeta[u.name] = { total: 0, carry: 0, tier: u.tier };
    });
    
    // --- 1. 전체 개요 섹션 ---
    let allWinrates = results.map(r => ((r.wins / r.matches) * 100));
    let minWR = Math.min(...allWinrates).toFixed(1);
    let maxWR = Math.max(...allWinrates).toFixed(1);
    
    report += rankSection;
    report += \`---\\n\\n\`;
    report += \`## 1. 전체 개요\\n\\n\`;
    report += \`| 항목 | 내용 |\\n|------|------|\\n\`;
    report += \`| 총 덱 수 | \${results.length}개 |\\n\`;
    report += \`| 골드 예산 | \${TOTAL_GOLD}골드 |\\n\`;
    report += \`| 승률 범위 | \${minWR}% ~ \${maxWR}% |\\n\`;
    report += \`| 1위 승률 | \${maxWR}% |\\n\\n\`;
    
    // --- 2. 레벨별 분포 섹션 ---
    report += \`---\\n\\n\`;
    report += \`## 2. 레벨(덱 타입)별 분포\\n\\n\`;
    report += \`| 레벨 | 덱 수 | 비율 | 승률 범위 | 평가 |\\n\`;
    report += \`|------|-------|------|-----------|------|\\n\`;
    
    for (let lvl of ['6L', '7L', '8L', '9L']) {
        let st = levelStats[lvl];
        let pct = ((st.count / results.length) * 100).toFixed(0);
        let wrRange = '없음';
        let grade = '⚫ 미등장';
        if (st.wins.length > 0) {
            let lo = Math.min(...st.wins).toFixed(1);
            let hi = Math.max(...st.wins).toFixed(1);
            wrRange = \`\${lo}%~\${hi}%\`;
            if (st.count >= 8 && st.count <= 12) grade = '🟢 적절';
            else if (st.count >= 5) grade = '🟡 약간 치우침';
            else if (st.count > 0) grade = '🔴 부족';
        }
        let label = lvl === '6L' ? '6렙 리롤' : lvl === '7L' ? '7렙 리롤' : lvl === '8L' ? '8렙 밸류' : '9렙 밸류';
        report += \`| **\${lvl}** (\${label}) | \${st.count}개 | \${pct}% | \${wrRange} | \${grade} |\\n\`;
    }
    report += \`\\n\`;
    
    // --- 3. 시너지 분석 섹션 ---
    report += \`---\\n\\n\`;
    report += \`## 3. 시너지 분석\\n\\n\`;
    
    // 교과(Subject) 시너지
    report += \`### 📌 교과(Subject) 시너지 등장 횟수\\n\\n\`;
    report += \`| 시너지 | 등장 횟수 | 시너지 | 등장 횟수 |\\n\`;
    report += \`|---|---|---|---|\\n\`;
    let subKeys = Object.keys(SYNERGIES.subjects);
    for(let i=0; i<subKeys.length; i+=2) {
        let s1 = subKeys[i];
        let c1 = synergyMeta[s1] || 0;
        let s2 = subKeys[i+1];
        let c2 = s2 ? (synergyMeta[s2] || 0) : '-';
        report += \`| **\${s1}** | \${c1} | **\${s2||''}** | \${c2} |\\n\`;
    }
    report += \`\\n\`;
    
    // 동아리(Club) 시너지
    report += \`### 📌 동아리(Club) 시너지 등장 횟수\\n\\n\`;
    report += \`| 시너지 | 등장 횟수 | 시너지 | 등장 횟수 |\\n\`;
    report += \`|---|---|---|---|\\n\`;
    let clubKeys = Object.keys(SYNERGIES.clubs);
    for(let i=0; i<clubKeys.length; i+=2) {
        let s1 = clubKeys[i];
        let c1 = synergyMeta[s1] || 0;
        let s2 = clubKeys[i+1];
        let c2 = s2 ? (synergyMeta[s2] || 0) : '-';
        report += \`| **\${s1}** | \${c1} | **\${s2||''}** | \${c2} |\\n\`;
    }
    report += \`\\n\`;
    
    // --- 4. 핵심 기물(유닛) 분석 섹션 ---
    report += \`---\\n\\n\`;
    report += \`## 4. 핵심 기물(유닛) 분석\\n\\n\`;
    
    const getTopN = (obj, n) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0, n);
    
    report += \`### 🛡️ 메인 탱커 채용률\\n\`;
    report += \`| 순위 | 유닛 명칭 | 채용 횟수 |\\n|---|---|---|\\n\`;
    getTopN(roleMeta.tank, 5).forEach(([k,v], idx) => report += \`| \${idx+1}위 | **\${k}** | \${v}회 |\\n\`);
    report += \`\\n\`;
    
    report += \`### ⚔️ 메인 딜러 채용률\\n\`;
    report += \`| 순위 | 유닛 명칭 | 채용 횟수 |\\n|---|---|---|\\n\`;
    getTopN(roleMeta.dealer, 5).forEach(([k,v], idx) => report += \`| \${idx+1}위 | **\${k}** | \${v}회 |\\n\`);
    report += \`\\n\`;
    
    report += \`### 🪄 서브 에이스 채용률\\n\`;
    report += \`| 순위 | 유닛 명칭 | 채용 횟수 |\\n|---|---|---|\\n\`;
    getTopN(roleMeta.subAce, 5).forEach(([k,v], idx) => report += \`| \${idx+1}위 | **\${k}** | \${v}회 |\\n\`);
    report += \`\\n\`;
    
    // --- 5. 주요 발견 사항 섹션 ---
    report += \`---\\n\\n\`;
    report += \`## 5. 주요 발견 사항\\n\\n\`;
    
    report += \`### ✅ 긍정적 변화\\n\`;
    // 골고루 채용되는 코어 유닛
    let wellUsed = Object.entries(unitMeta).filter(([,v]) => v.carry >= 3).length;
    if (wellUsed > 10) report += \`- 다양한 핵심 기물 활용: 총 \${wellUsed}개의 기물이 3회 이상 캐리로 활약했습니다.\\n\`;
    else report += \`- 없음\\n\`;
    report += \`\\n\`;
    
    report += \`### ⚠️ 문제점\\n\`;
    let allSyns = [...Object.keys(SYNERGIES.subjects), ...Object.keys(SYNERGIES.clubs)];
    let deadSyns = allSyns.filter(s => (synergyMeta[s] || 0) === 0);
    if (deadSyns.length > 0) report += \`- **멸종 시너지**: \${deadSyns.join(', ')} (0회 등장)\\n\`;
    
    // 과도한 시너지 감지
    let overSyns = Object.entries(synergyMeta).filter(([,v]) => v >= 18).map(([k,v]) => \`\${k}(\${v}회)\`);
    if (overSyns.length > 0) report += \`- **과도한 시너지 쏠림**: \${overSyns.join(', ')}\\n\`;
    
    // 단일 유닛 독점 감지
    let dominantUnits = [...getTopN(roleMeta.tank, 1), ...getTopN(roleMeta.dealer, 1)].filter(([,cnt]) => cnt >= 12);
    dominantUnits.forEach(([name, cnt]) => {
        report += \`- **\${name} 독점** (\${cnt}/45 덱에서 채용)\\n\`;
    });
    
    // 미사용 유닛 감지
    let unusedUnits = Object.entries(unitMeta).filter(([,v]) => v.total === 0).map(([k]) => k);
    if (unusedUnits.length > 0) {
        report += \`- **미사용 유닛 (\${unusedUnits.length}개)**: \${unusedUnits.slice(0, 8).join(', ')}\${unusedUnits.length > 8 ? \` 외 \${unusedUnits.length - 8}개\` : ''}\\n\`;
    }
    report += \`\\n\`;
    
    // --- 6. 밸런스 패치 제안 섹션 ---
    report += \`---\\n\\n\`;
    report += \`## 6. 밸런스 패치 제안\\n\\n\`;
    
    report += \`### 🔧 수치 조정 제안\\n\\n\`;
    report += \`| 대상 | 조치 | 근거 |\\n\`;
    report += \`|------|------|------|\\n\`;
    
    // 버프 대상 (멸종 시너지)
    deadSyns.forEach(s => {
        report += \`| **\${s} 시너지 (전구간)** | 📈 버프 필요 | 45위 내 0회 등장, 완전 멸종 |\\n\`;
    });
    
    // 너프 대상 (과도한 시너지 특정 구간)
    Object.entries(synergyLevelMeta).filter(([,v]) => v >= 12).forEach(([k, v]) => {
        let synName = k.replace(/[0-9]+$/, '');
        let lvl = k.replace(/[^0-9]/g, '');
        report += \`| **\${synName} \${lvl}단계** | 📉 특정구간 너프 | \${v}회로 해당 단계 쏠림 과도 |\\n\`;
    });
    
    // 버프 대상 (미사용 유닛 중 주요 기물)
    let lowUsageUnits = Object.entries(unitMeta).filter(([,v]) => v.total <= 1 && v.tier >= 3).map(([k, v]) => k);
    lowUsageUnits.slice(0, 5).forEach(name => {
        report += \`| **\${name}** | 📈 스탯/스킬 버프 | \${unitMeta[name].tier}코스트인데 채용 \${unitMeta[name].total}회 |\\n\`;
    });
    report += \`\\n\`;
    
    // --- 7. 종합 평가 섹션 ---
    report += \`---\\n\\n\`;
    report += \`## 7. 종합 평가\\n\\n\`;
    
    let healthScore = 0;
    // 레벨 분포 점수 (최대 25점)
    let levelVariance = Object.values(levelStats).map(s => Math.abs(s.count - 11)); // average ~11
    let lvlScore = Math.max(0, 25 - levelVariance.reduce((a,b) => a+b, 0));
    healthScore += lvlScore;
    
    // 시너지 다양성 점수 (최대 25점)
    let activeSyns = allSyns.filter(s => (synergyMeta[s] || 0) > 0).length;
    let synScore = Math.round((activeSyns / allSyns.length) * 25);
    healthScore += synScore;
    
    // 승률 분포 점수 (최대 25점)
    let wrSpread = parseFloat(maxWR) - parseFloat(minWR);
    let wrScore = wrSpread < 30 ? 25 : wrSpread < 50 ? 18 : wrSpread < 70 ? 10 : 5;
    healthScore += wrScore;
    
    // 유닛 다양성 점수 (최대 25점)
    let usedUnits = Object.entries(unitMeta).filter(([,v]) => v.total > 0).length;
    let unitScore = Math.round((usedUnits / UNIT_POOL.length) * 25);
    healthScore += unitScore;
    
    let healthGrade = healthScore >= 80 ? 'S' : healthScore >= 65 ? 'A' : healthScore >= 50 ? 'B' : healthScore >= 35 ? 'C' : 'D';
    let gradeEmoji = { S: '🏆', A: '🟢', B: '🟡', C: '🟠', D: '🔴' }[healthGrade];
    
    report += \`| 평가 항목 | 점수 | 기준 |\\n\`;
    report += \`|-----------|------|------|\\n\`;
    report += \`| 레벨 분포 균등성 | \${lvlScore}/25 | 6L~9L 각 10~12개가 이상적 |\\n\`;
    report += \`| 시너지 다양성 | \${synScore}/25 | \${activeSyns}/\${allSyns.length}개 시너지 활성화 |\\n\`;
    report += \`| 승률 분포 | \${wrScore}/25 | 1위~45위 승률 편차 \${wrSpread.toFixed(1)}% |\\n\`;
    report += \`| 유닛 다양성 | \${unitScore}/25 | \${usedUnits}/\${UNIT_POOL.length}개 유닛 사용됨 |\\n\`;
    report += \`| **종합 건강도** | **\${healthScore}/100 (\${healthGrade}등급)** | \${gradeEmoji} |\\n\`;
    report += \`\\n\`;
    
    function parseReportText(content) {
        let lines = content.split('\\n');
        let decks = {}; // name -> rank
        let top10Synergies = [];
        let top10Units = [];
        for (let line of lines) {
            if (line.includes('| **') && line.includes('위** |')) {
                let cols = line.split('|').map(s => s.trim());
                if (cols.length >= 7) {
                    let rankStr = cols[1];
                    let rank = parseInt(rankStr.replace(/\\D/g, ''));
                    let deckName = cols[3].replace(/\\*/g, '');
                    let tank = cols[5] ? cols[5].split('(')[0].trim() : '-';
                    let dealer = cols[6] ? cols[6].split('(')[0].trim() : '-';
                    let sub = cols[7] ? cols[7].split('(')[0].trim() : '-';
                    
                    decks[deckName] = rank;
                    if (rank <= 10) {
                        let syns = deckName.split('_').map(s => s.replace(/\\d+/g, ''));
                        top10Synergies.push(...syns);
                        if (tank && tank !== '-') top10Units.push(tank);
                        if (dealer && dealer !== '-') top10Units.push(dealer);
                        if (sub && sub !== '-') top10Units.push(sub);
                    }
                }
            }
        }
        return { decks, top10Synergies, top10Units };
    }

    let targetFile = 'report_1.txt';
    let files = ['report_1.txt', 'report_2.txt', 'report_3.txt'];
    let existingFiles = files.filter(f => fs.existsSync(f));
    let prev1File = null;
    let prev2File = null;

    if (existingFiles.length > 0) {
        let sortedFiles = existingFiles.map(f => {
            return { file: f, mtime: fs.statSync(f).mtimeMs };
        }).sort((a, b) => b.mtime - a.mtime);

        if (sortedFiles.length === 1) {
            targetFile = 'report_2.txt';
            prev1File = sortedFiles[0].file;
        } else if (sortedFiles.length === 2) {
            targetFile = 'report_3.txt';
            prev1File = sortedFiles[0].file;
            prev2File = sortedFiles[1].file;
        } else {
            targetFile = sortedFiles[2].file;
            prev1File = sortedFiles[0].file;
            prev2File = sortedFiles[1].file;
        }
    }

    let comparisonReport = '';
    let p1Data = null, p2Data = null;

    if (prev1File) {
        p1Data = parseReportText(fs.readFileSync(prev1File, 'utf-8'));
    }
    if (prev2File) {
        p2Data = parseReportText(fs.readFileSync(prev2File, 'utf-8'));
    }

    if (p1Data && p2Data) {
        let currData = parseReportText(rankSection);
        
        let allSyns = [...currData.top10Synergies, ...p1Data.top10Synergies, ...p2Data.top10Synergies];
        let allUnits = [...currData.top10Units, ...p1Data.top10Units, ...p2Data.top10Units];
        
        let synCounts = {};
        allSyns.forEach(s => synCounts[s] = (synCounts[s] || 0) + 1);
        let unitCounts = {};
        allUnits.forEach(u => unitCounts[u] = (unitCounts[u] || 0) + 1);
        
        let opSyns = Object.entries(synCounts).sort((a,b)=>b[1]-a[1]).slice(0, 5);
        let opUnits = Object.entries(unitCounts).sort((a,b)=>b[1]-a[1]).slice(0, 5);
        
        comparisonReport += \`\\n---\\n\\n## 🔍 3연속 교차 검증 OP 추출 (Top 10 기준)\\n\\n\`;
        comparisonReport += \`> 최근 3번의 시뮬레이션 중 상위 10위권 덱에서 공통적으로 자주 기용된 핵심 요소입니다.\\n\\n\`;
        
        comparisonReport += \`### 🚨 요주의 시너지 TOP 5\\n\`;
        comparisonReport += \`| 순위 | 시너지 명칭 | 3연속 Top10 등장 횟수 |\\n\`;
        comparisonReport += \`|---|---|---|\\n\`;
        opSyns.forEach((s, idx) => comparisonReport += \`| **\${idx+1}위** | **\${s[0]}** | \${s[1]}회 |\\n\`);
        
        comparisonReport += \`\\n### 🚨 요주의 핵심 유닛 TOP 5\\n\`;
        comparisonReport += \`| 순위 | 유닛 명칭 | 3연속 Top10 기용 횟수 |\\n\`;
        comparisonReport += \`|---|---|---|\\n\`;
        opUnits.forEach((u, idx) => comparisonReport += \`| **\${idx+1}위** | **\${u[0]}** | \${u[1]}회 |\\n\`);
        
        comparisonReport += \`\\n\`;
    }

    comparisonReport += \`\\n---\\n\\n## 🔄 교차 검증 순위 비교 (전체 순위)\\n\\n\`;
    comparisonReport += \`| 현재 순위 | 덱 명칭 | 1회 전 순위 | 2회 전 순위 |\\n\`;
    comparisonReport += \`|---|---|---|---|\\n\`;
    
    for (let i = 0; i < results.length; i++) {
        let deckName = getDeckName(results[i].deck);
        let currentRank = i + 1;
        let r1Str = p1Data && p1Data.decks[deckName] ? \`\${p1Data.decks[deckName]}위\` : '-';
        let r2Str = p2Data && p2Data.decks[deckName] ? \`\${p2Data.decks[deckName]}위\` : '-';
        comparisonReport += \`| **\${currentRank}위** | **\${deckName}** | \${r1Str} | \${r2Str} |\\n\`;
    }
    comparisonReport += \`\\n\`;

    report += comparisonReport;

    let timestamp = new Date().toLocaleString('ko-KR');
    
    // Add prefix
    let prefix = \`> [골드 예산] / [날짜] 기준
> 🕒 **리포트 제출 시간**: \${timestamp}

---

\`;
    
    report = prefix + report;

    fs.writeFileSync(targetFile, report);
    console.log(\`Simulation complete! Report saved to \${targetFile}.\`);
    console.log(report.substring(0, 1500) + "\\n... (생략)");
}

`;

let startIdx = content.indexOf('function main() {');
if(startIdx !== -1) {
    content = content.substring(0, startIdx) + replacement;
    fs.writeFileSync('c:\\Users\\hyunseung\\Desktop\\classroom-tactics\\scratch\\migrate.js', content);
}
