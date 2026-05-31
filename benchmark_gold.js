import { execSync } from 'child_process';
import fs from 'fs';

const GOLDS = [220, 240, 260, 280, 300];
const RESULTS = [];

console.log("🚀 골드 예산 밸런스 벤치마크 테스트 시작...");

for (const gold of GOLDS) {
    console.log(`\n⏳ [예산: ${gold}G] 배틀로얄 토너먼트 실행 중... (약 10~20초 소요)`);
    try {
        // 환경 변수에 TOTAL_GOLD를 주입하여 동기적으로 실행
        execSync(`node run_simulation.js`, { 
            env: { ...process.env, TOTAL_GOLD: gold.toString() },
            stdio: 'pipe' 
        });
        
        const reportFile = `report_${gold}G.txt`;
        const content = fs.readFileSync(reportFile, 'utf8');
        
        // 정규식을 통해 "덱 타입" 파싱 (예: | 🥇 | 6L | -> 6L 추출)
        const lines = content.split('\n');
        let counts = { '6L': 0, '7L': 0, '8L': 0, '9L': 0 };
        let validDecksFound = 0;
        
        for (let line of lines) {
            if (line.includes('|') && !line.includes('덱 타입') && !line.includes(':---:')) {
                const columns = line.split('|').map(s => s.trim());
                if (columns.length >= 4) {
                    const deckType = columns[2];
                    if (counts[deckType] !== undefined) {
                        counts[deckType]++;
                        validDecksFound++;
                    }
                }
            }
            if (validDecksFound >= 20) break; // 상위 20개까지만 분석
        }

        // 분산(Variance) 계산 - 평균 5개(총 20개 / 4개 타입)
        const mean = 20 / 4; 
        let variance = 0;
        for (let type in counts) {
            variance += Math.pow(counts[type] - mean, 2);
        }
        variance = variance / 4;

        RESULTS.push({ gold, counts, variance });
        console.log(`✅ [${gold}G] 분석 완료! -> 6L:${counts['6L']} / 7L:${counts['7L']} / 8L:${counts['8L']} / 9L:${counts['9L']} (분산: ${variance})`);
        
    } catch (err) {
        console.error(`❌ [${gold}G] 시뮬레이션 중 오류 발생:`, err.message);
    }
}

// 가장 분산이 작은(가장 고르게 분포한) 골드를 최적해로 선정
RESULTS.sort((a, b) => a.variance - b.variance);
const bestGold = RESULTS[0].gold;

console.log("\n=============================================");
console.log(`🏆 [결론] 황금 밸런스 추천 예산: ${bestGold} 골드 (분산 최저: ${RESULTS[0].variance})`);
console.log("=============================================\n");

// 마크다운 리포트 생성
let md = `# 🏆 골드 예산(220~300G) 밸런스 벤치마크 결과\n\n`;
md += `각 예산별 배틀로얄 토너먼트(400개 봇)를 거쳐 살아남은 **상위 20개 최적해 덱**의 분포 비율입니다.\n`;
md += `가장 특정 레벨 덱이 독점하지 않고 고르게(황금 비율) 섞인 예산을 최적해로 도출했습니다.\n\n`;

md += `| 예산 (Gold) | 6L 덱 점유 | 7L 덱 점유 | 8L 덱 점유 | 9L 덱 점유 | 밸런스 불균형도(Variance) |\n`;
md += `|:---:|:---:|:---:|:---:|:---:|:---:|\n`;

for (const r of RESULTS.sort((a,b) => a.gold - b.gold)) {
    let mark = r.gold === bestGold ? " 🥇(최적)" : "";
    md += `| **${r.gold}G${mark}** | ${r.counts['6L']}개 (${(r.counts['6L']/20*100).toFixed(0)}%) | ${r.counts['7L']}개 (${(r.counts['7L']/20*100).toFixed(0)}%) | ${r.counts['8L']}개 (${(r.counts['8L']/20*100).toFixed(0)}%) | ${r.counts['9L']}개 (${(r.counts['9L']/20*100).toFixed(0)}%) | ${r.variance} |\n`;
}

md += `\n> [!TIP]\n> **추천 예산**: **${bestGold} 골드**를 적용하면 저코스트 3성작 덱과 고코스트 밸류 덱이 가장 균형 있게 맞붙습니다.\n`;

fs.writeFileSync('C:\\Users\\hyunseung\\.gemini\\antigravity-ide\\brain\\4a492ba8-e57a-4f37-b9b3-5d4bfb1cd6b6\\benchmark_report.md', md);
console.log("✅ benchmark_report.md 아티팩트 생성 완료!");
