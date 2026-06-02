import fs from 'fs';

const txt = fs.readFileSync('report_1.txt', 'utf8');
const lines = txt.split('\n');

const unitsByCost = {
    '3코': [
        '올림피아드 금상', '양호실 도우미', '육상부 에이스', '발명품 매니아',
        '사회탐구 1타', '시조 읊는 선비', '영어 프리토커', '오케스트라 단장',
        '수채화 장인', '미술 치료사', '또래 상담 에이스', '해외 보따리상'
    ],
    '4코': [
        '전교 체육부장', '수능 만점자', '미친 과학자', '논술의 신',
        '전교 학생회장', '나이팅게일', '천재 피아니스트', '천재 퀀트', '공익광고 모델'
    ],
    '5코': [
        '외고 전학생', '수석 연구원', '피카소의 재림', '교장 선생님', '기부 천사'
    ]
};

const coreCounts = {
    '3코': {},
    '4코': {},
    '5코': {}
};

// 모든 유닛 0으로 초기화
Object.keys(unitsByCost).forEach(cost => {
    unitsByCost[cost].forEach(name => {
        coreCounts[cost][name] = 0;
    });
});

// 파싱 로직
lines.forEach(line => {
    if (line.trim().startsWith('|') && line.includes('★)')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length > 8 && !line.includes('---')) {
            const cores = [parts[5], parts[6], parts[7]]; // 탱, 딜, 서브딜
            
            cores.forEach(core => {
                if (!core) return;
                
                const match = core.match(/([^(]+)\(([345])코/);
                if (match) {
                    const name = match[1].trim();
                    const cost = match[2] + '코';
                    
                    if (coreCounts[cost] && coreCounts[cost][name] !== undefined) {
                        coreCounts[cost][name]++;
                    }
                }
            });
        }
    }
});

// 결과 출력 포맷팅
Object.keys(coreCounts).forEach(cost => {
    console.log(`\n### ${cost}스트 핵심 기물 채용 빈도 (0회 포함)`);
    const sorted = Object.entries(coreCounts[cost])
        .sort((a, b) => b[1] - a[1]); // 내림차순 정렬
    
    sorted.forEach(([name, count], index) => {
        console.log(`${index + 1}. ${name} : ${count}회`);
    });
});
