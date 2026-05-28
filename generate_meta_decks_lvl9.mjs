import fs from 'fs';
import { UNIT_POOL, SYNERGIES } from './js/data.js';

// 생성할 메타 덱 아키타입 정의 (주 시너지, 부 시너지)
const ARCHETYPES = [
    { name: '국어4_보건부4', primary: { name: '국어', target: 4 }, secondary: { name: '보건부', target: 4 } },
    { name: '국어4_육상부4', primary: { name: '국어', target: 4 }, secondary: { name: '육상부', target: 4 } },
    { name: '수학4_방송부5', primary: { name: '수학', target: 4 }, secondary: { name: '방송부', target: 5 } },
    { name: '수학4_선도부4', primary: { name: '수학', target: 4 }, secondary: { name: '선도부', target: 4 } },
    { name: '사회4_방송부3', primary: { name: '사회', target: 4 }, secondary: { name: '방송부', target: 3 } },
    { name: '사회4_보건부4', primary: { name: '사회', target: 4 }, secondary: { name: '보건부', target: 4 } },
    { name: '과학4_장난4', primary: { name: '과학', target: 4 }, secondary: { name: '장난꾸러기', target: 4 } },
    { name: '과학4_육상부4', primary: { name: '과학', target: 4 }, secondary: { name: '육상부', target: 4 } },
    { name: '영어4_급식부5', primary: { name: '영어', target: 4 }, secondary: { name: '급식부', target: 5 } },
    { name: '영어4_방송부3', primary: { name: '영어', target: 4 }, secondary: { name: '방송부', target: 3 } },
    { name: '체육4_선도부4', primary: { name: '체육', target: 4 }, secondary: { name: '선도부', target: 4 } },
    { name: '체육4_보건부4', primary: { name: '체육', target: 4 }, secondary: { name: '보건부', target: 4 } },
    { name: '음악4_도덕4', primary: { name: '음악', target: 4 }, secondary: { name: '도덕', target: 4 } },
    { name: '음악4_급식부5', primary: { name: '음악', target: 4 }, secondary: { name: '급식부', target: 5 } },
    { name: '미술4_선도부4', primary: { name: '미술', target: 4 }, secondary: { name: '선도부', target: 4 } },
    { name: '미술4_장난4', primary: { name: '미술', target: 4 }, secondary: { name: '장난꾸러기', target: 4 } },
    { name: '도덕6_보건부2', primary: { name: '도덕', target: 6 }, secondary: { name: '보건부', target: 2 } },
    { name: '도덕6_급식부3', primary: { name: '도덕', target: 6 }, secondary: { name: '급식부', target: 3 } },
    { name: '선도부6_체육2', primary: { name: '선도부', target: 6 }, secondary: { name: '체육', target: 2 } },
    { name: '선도부6_수학2', primary: { name: '선도부', target: 6 }, secondary: { name: '수학', target: 2 } },
    { name: '방송부7', primary: { name: '방송부', target: 7 }, secondary: null },
    { name: '육상부6_체육2', primary: { name: '육상부', target: 6 }, secondary: { name: '체육', target: 2 } },
    { name: '육상부6_과학2', primary: { name: '육상부', target: 6 }, secondary: { name: '과학', target: 2 } },
    { name: '보건부6_도덕2', primary: { name: '보건부', target: 6 }, secondary: { name: '도덕', target: 2 } },
    { name: '보건부6_음악2', primary: { name: '보건부', target: 6 }, secondary: { name: '음악', target: 2 } },
    { name: '급식부7', primary: { name: '급식부', target: 7 }, secondary: null },
    { name: '장난꾸러기6_미술2', primary: { name: '장난꾸러기', target: 6 }, secondary: { name: '미술', target: 2 } },
    { name: '장난꾸러기6_과학2', primary: { name: '장난꾸러기', target: 6 }, secondary: { name: '과학', target: 2 } },
    { name: '국어2_방송부5', primary: { name: '국어', target: 2 }, secondary: { name: '방송부', target: 5 } },
    { name: '체육2_급식부5', primary: { name: '체육', target: 2 }, secondary: { name: '급식부', target: 5 } }
];

const BOARD_SIZE = 9; // 9레벨 종결 덱 기준

function getUnitsForSynergy(synergyName) {
    return UNIT_POOL.filter(u => u.subject === synergyName || u.club === synergyName);
}

function generateDecks() {
    const decks = [];

    for (let arch of ARCHETYPES) {
        let deckUnits = [];
        const addedUnitIds = new Set();

        const addUnits = (synergy, targetCount) => {
            if (!synergy) return;
            const available = getUnitsForSynergy(synergy.name)
                .filter(u => !addedUnitIds.has(u.id))
                .sort((a, b) => b.tier - a.tier); // 고코스트 우선
            
            for (let i = 0; i < targetCount && i < available.length; i++) {
                if (deckUnits.length < BOARD_SIZE) {
                    deckUnits.push(available[i]);
                    addedUnitIds.add(available[i].id);
                }
            }
        };

        // 1. 주 시너지 유닛 추가
        addUnits(arch.primary, arch.primary.target);
        
        // 2. 부 시너지 유닛 추가
        if (arch.secondary) {
            addUnits(arch.secondary, arch.secondary.target);
        }

        // 3. 남는 자리 고코스트 스마트 필 채우기
        if (deckUnits.length < BOARD_SIZE) {
            const remaining = UNIT_POOL
                .filter(u => !addedUnitIds.has(u.id))
                .sort((a, b) => b.tier - a.tier);
            
            for (let u of remaining) {
                if (deckUnits.length < BOARD_SIZE) {
                    deckUnits.push(u);
                    addedUnitIds.add(u.id);
                } else {
                    break;
                }
            }
        }

        // 4. 유닛 형태 변환 (스타, 아이템, 배치 인덱스 부여)
        // 전방(0~7), 후방(24~31) 배치 로직
        let frontIdx = 0;
        let backIdx = 16;
        const formattedUnits = deckUnits.map(u => {
            let gridIdx = 0;
            if (u.stats.range <= 1) {
                gridIdx = frontIdx++;
                if (frontIdx > 7) frontIdx = 8; // fallback
            } else {
                gridIdx = backIdx++;
                if (backIdx > 23) backIdx = 8; // fallback
            }

            return {
                id: u.id,
                star: 2, // 기본 2성
                items: [], // 노템 기준
                gridIndex: gridIdx
            };
        });

        decks.push({
            id: arch.name,
            name: arch.name,
            units: formattedUnits
        });
    }

    fs.writeFileSync('./js/meta_decks_lvl9.json', JSON.stringify(decks, null, 2));
    console.log(`✅ 성공적으로 ${decks.length}개의 메타 덱을 js/meta_decks_lvl9.json에 저장했습니다.`);
}

generateDecks();
