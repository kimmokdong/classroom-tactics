import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from './js/data.js';

function getActiveLevel(count, synergyData) {
    if (!synergyData) return 0;
    let levels = Object.keys(synergyData.levels).map(Number).sort((a,b)=>a-b);
    let active = 0;
    if (synergyData.exactMatch) {
        if (levels.includes(count)) active = count;
    } else {
        levels.forEach(l => { if (count >= l) active = l; });
    }
    return active;
}

function evaluateDeck(unitIds) {
    let deck = unitIds.map(id => UNIT_POOL.find(u => u.id === id));
    let counts = { subjects: {}, clubs: {} };
    deck.forEach(u => {
        let subs = Array.isArray(u.subject) ? u.subject : [u.subject];
        let clubs = Array.isArray(u.club) ? u.club : [u.club];
        subs.forEach(s => counts.subjects[s] = (counts.subjects[s] || 0) + 1);
        clubs.forEach(c => counts.clubs[c] = (counts.clubs[c] || 0) + 1);
    });

    let activeLevels = [];
    let waste = 0;
    let totalScore = 0;
    
    for (let s in counts.subjects) {
        let count = counts.subjects[s];
        let lvl = getActiveLevel(count, SYNERGIES.subjects[s]);
        if (lvl > 0) {
            activeLevels.push(`${s}(${lvl})`);
            totalScore += lvl * 2; // Arbitrary score weight
        }
        waste += (count - lvl);
    }
    for (let c in counts.clubs) {
        let count = counts.clubs[c];
        let lvl = getActiveLevel(count, SYNERGIES.clubs[c]);
        if (lvl > 0) {
            activeLevels.push(`${c}(${lvl})`);
            totalScore += lvl * 2;
        }
        waste += (count - lvl);
    }
    
    return { activeLevels, waste, totalScore, counts, units: deck };
}

function getCombinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    
    let head = arr[0];
    let tail = arr.slice(1);
    
    let withHead = getCombinations(tail, k - 1).map(c => [head, ...c]);
    let withoutHead = getCombinations(tail, k);
    
    return withHead.concat(withoutHead);
}

const cores = [
    { name: '도덕선도 코어', req: { '도덕': 4, '선도부': 4 } },
    { name: '방송부 코어', req: { '방송부': 5 } },
    { name: '육상부 코어', req: { '육상부': 4 } },
    { name: '급식부 코어', req: { '급식부': 5 } },
    { name: '장난꾸러기 코어', req: { '장난꾸러기': 4 } },
    { name: '보건부 코어', req: { '보건부': 4 } },
    { name: '문과 코어', req: { '국어': 4, '사회': 4 } },
    { name: '이과 코어', req: { '수학': 4, '과학': 4 } },
    { name: '자본주의 코어 (영어+경제부)', req: { '영어': 4, '경제부': 2 } },
    { name: '예체능 코어 (음악+미술+체육)', req: { '음악': 2, '미술': 2, '체육': 2 } },
    { name: '창의융합 코어 (창체)', req: { '창체': 2 } },
    { name: '순수 7방송 코어 (단일 7시너지)', req: { '방송부': 7 } },
    { name: '순수 7급식 코어 (단일 7시너지)', req: { '급식부': 7 } },
    { name: '순수 6도덕 코어 (단일 6시너지)', req: { '도덕': 6 } },
    { name: '순수 6선도부 코어 (단일 6시너지)', req: { '선도부': 6 } },
    { name: '순수 6육상부 코어 (단일 6시너지)', req: { '육상부': 6 } },
    { name: '순수 6보건부 코어 (단일 6시너지)', req: { '보건부': 6 } },
    { name: '순수 6장난꾸러기 코어 (단일 6시너지)', req: { '장난꾸러기': 6 } }
];

function generateMarkdown() {
    let md = `# 🏆 완벽 시너지 조합 백과사전 (Lv.7 ~ Lv.10)\n\n`;
    md += `선생님의 요청에 따라, 시너지 낭비(Waste)를 최소화하고 톱니바퀴처럼 예쁘게 맞물리는 최적화 덱을 7레벨부터 10레벨까지 방대하게 구축했습니다.\n\n`;

    let allUnits = UNIT_POOL.map(u => u.id);
    
    cores.forEach(core => {
        md += `## 🎯 ${core.name}\n`;
        
        // Find best decks for 7, 8, 9, 10
        for (let level = 7; level <= 10; level++) {
            let reqKeys = Object.keys(core.req);
            let candidateUnits = UNIT_POOL.filter(u => {
                if (level === 7 && u.tier === 5) return false;
                let subs = Array.isArray(u.subject) ? u.subject : [u.subject];
                let clubs = Array.isArray(u.club) ? u.club : [u.club];
                let hasReq = reqKeys.some(r => subs.includes(r) || clubs.includes(r));
                return hasReq;
            }).map(u => u.id);
            
            // If candidate pool is too small, add some strong 4/5 costs
            let filler = UNIT_POOL.filter(u => {
                if (level === 7 && u.tier === 5) return false;
                return u.tier >= 4;
            }).map(u => u.id);
            let pool = Array.from(new Set([...candidateUnits, ...filler]));
            
            // Random search for 50000 iterations to find the best deck
            let bestDeck = null;
            let bestScore = -999;
            let minWaste = 999;
            
            for (let i = 0; i < 50000; i++) {
                // random sample
                let shuffled = pool.sort(() => 0.5 - Math.random());
                let sample = shuffled.slice(0, level);
                let res = evaluateDeck(sample);
                
                // We want to maximize totalScore, minimize waste
                let score = res.totalScore - (res.waste * 3);
                
                // Ensure the core requirement is heavily met
                let reqMet = true;
                reqKeys.forEach(r => {
                    let c = (res.counts.subjects[r] || 0) + (res.counts.clubs[r] || 0);
                    if (c < core.req[r]) reqMet = false;
                });
                
                if (level >= 8) {
                    let tier1Count = res.units.filter(u => u.tier === 1).length;
                    if (tier1Count >= 3) reqMet = false;
                }
                
                // Assign roles to check core tiers
                let sortedUnits = [...res.units].sort((a,b) => b.tier - a.tier);
                let mainTank = sortedUnits.find(u => u.role.includes('tank'));
                if (!mainTank) mainTank = sortedUnits.find(u => u.stats.range === 1) || sortedUnits[0];

                let dealers = sortedUnits.filter(u => u.role.includes('dealer') && u.id !== mainTank.id);
                let mainDealer = dealers[0];
                if (!mainDealer) mainDealer = sortedUnits.find(u => u.id !== mainTank.id) || sortedUnits[0];

                let subDealer = sortedUnits.find(u => u.id !== mainTank.id && u.id !== mainDealer.id && (u.role.includes('dealer') || u.role.includes('support')));
                if (!subDealer) subDealer = sortedUnits.find(u => u.id !== mainTank.id && u.id !== mainDealer.id) || sortedUnits[0];

                let coreTiers = [mainTank.tier, mainDealer.tier, subDealer.tier];
                let minCoreTier = Math.min(...coreTiers);
                
                let tier4Count = res.units.filter(u => u.tier === 4).length;
                let tier5Count = res.units.filter(u => u.tier === 5).length;

                if (level === 7) {
                    let has7Synergy = Object.values(res.counts.subjects).some(c => c >= 7) || Object.values(res.counts.clubs).some(c => c >= 7);
                    let has6MaxSynergy = (res.counts.subjects['도덕'] || 0) >= 6 || (res.counts.clubs['선도부'] || 0) >= 6 || (res.counts.clubs['육상부'] || 0) >= 6 || (res.counts.clubs['보건부'] || 0) >= 6 || (res.counts.clubs['장난꾸러기'] || 0) >= 6;
                    
                    if (has7Synergy || has6MaxSynergy) {
                        // 단일 6~7 최고 시너지 덱: 5코스트는 원천 금지 (상징/증강 의존 덱이므로)
                        let tier5Count = res.units.filter(u => u.tier === 5).length;
                        if (tier5Count > 0) reqMet = false;
                    } else {
                        // 일반 7렙 덱: 4코스트는 최대 1개, 메인 캐리 최소 2명은 3코 이상, 어떤 캐리도 1코스트 불가
                        if (tier4Count > 1) reqMet = false;
                        if (coreTiers.filter(t => t >= 3).length < 2) reqMet = false;
                        if (minCoreTier < 2) reqMet = false; 
                    }
                }
                if (level === 8) {
                    // 8렙: 5코 최대 1개, 메인 캐리 최소 2명은 4코 이상, 어떤 캐리도 1,2코 불가
                    if (tier5Count > 1) reqMet = false;
                    if (coreTiers.filter(t => t === 4).length < 2) reqMet = false;
                    if (minCoreTier < 3) reqMet = false;
                }
                if (level === 9) {
                    // 9렙: 메인 캐리 최소 2명은 4코 이상, 어떤 캐리도 1,2코 불가
                    if (coreTiers.filter(t => t >= 4).length < 2) reqMet = false;
                    if (minCoreTier < 3) reqMet = false;
                }
                if (level === 10) {
                    // 10렙: 시너지 충 방지. 핵심 캐리 3인방은 무조건 '모두' 4코 이상이어야 함
                    if (coreTiers.filter(t => t >= 4).length < 3) reqMet = false;
                }
                
                if (reqMet && score > bestScore) {
                    bestScore = score;
                    minWaste = res.waste;
                    bestDeck = res;
                }
            }
            
            if (bestDeck) {
                let sortedUnits = [...bestDeck.units].sort((a,b) => b.tier - a.tier);
                let mainTank = sortedUnits.find(u => u.role.includes('tank'));
                if (!mainTank) mainTank = sortedUnits.find(u => u.stats.range === 1) || sortedUnits[0];

                let dealers = sortedUnits.filter(u => u.role.includes('dealer') && u.id !== mainTank.id);
                let mainDealer = dealers[0];
                if (!mainDealer) mainDealer = sortedUnits.find(u => u.id !== mainTank.id) || sortedUnits[0];

                let subDealer = sortedUnits.find(u => u.id !== mainTank.id && u.id !== mainDealer.id && (u.role.includes('dealer') || u.role.includes('support')));
                if (!subDealer) subDealer = sortedUnits.find(u => u.id !== mainTank.id && u.id !== mainDealer.id) || sortedUnits[0];

                let unitNames = bestDeck.units.map(u => `${u.name}(${u.tier}코)`).join(', ');
                md += `### 🏅 [Lv.${level}] ${bestDeck.activeLevels.join(', ')}\n`;
                md += `- **출전 유닛**: ${unitNames}\n`;
                md += `- **시너지 낭비**: ${minWaste} 포인트\n`;
                md += `- 🛡️ **메인 탱커**: ${mainTank.name} (${mainTank.tier}코)\n`;
                md += `- ⚔️ **메인 딜러**: ${mainDealer.name} (${mainDealer.tier}코)\n`;
                md += `- 🪄 **서브 딜러**: ${subDealer.name} (${subDealer.tier}코)\n\n`;
            }
        }
        md += `---\n\n`;
    });
    
    fs.writeFileSync('standard_decks_expanded.md', md);
    console.log('Markdown generated to standard_decks_expanded.md');
}

generateMarkdown();
