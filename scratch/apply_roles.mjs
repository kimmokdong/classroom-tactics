import fs from 'fs';

const roleMapping = {
  // 1코스트
  '복도 지킴이': { position: '퓨어 탱커', role: ['tank'] },
  '칠판닦이 당번': { position: '공격형 탱커', role: ['tank', 'dealer'] },
  '찰흙 조각가': { position: '주문력 탱커', role: ['tank'] },
  '과학탐구원': { position: '물리 전사', role: ['dealer'] },
  '수학 짝꿍': { position: '물리 원딜', role: ['dealer'] },
  '달리기 선수': { position: '물리 암살자', role: ['dealer'] },
  '지리덕후': { position: '공격력 마법사', role: ['dealer'] },
  '영단어 암기왕': { position: '공격력 마법사', role: ['dealer'] },
  '국어부장': { position: '주문력 마법사', role: ['dealer'] },
  '리코더 요정': { position: '주문력 힐러', role: ['support'] },

  // 2코스트
  '바른생활 사나이': { position: '공격형 탱커', role: ['tank'] },
  '체육부장': { position: '물리 전사', role: ['dealer', 'tank'] },
  '골목대장': { position: '물리 전사', role: ['dealer', 'tank'] },
  '수학천재': { position: '물리 원딜', role: ['dealer'] },
  '과학실험부장': { position: '주문력 마법사', role: ['dealer'] },
  '역사 매니아': { position: '체력비례 전문가', role: ['dealer'] },
  '팝송 매니아': { position: '마나제어 전문가', role: ['dealer'] },
  '칠판 낙서꾼': { position: '디버프 전문가', role: ['support', 'dealer'] },
  '문학소녀': { position: '주문력 인챈터', role: ['support'] },
  '합창단 에이스': { position: '주문력 인챈터', role: ['support'] },
  '급식 당번': { position: '주문력 힐러', role: ['support'] },
  '진로진학 멘토': { position: '주문력 인챈터', role: ['support', 'dealer'] },

  // 3코스트
  '올림피아드 금상': { position: '공격력 마법사', role: ['dealer'] },
  '육상부 에이스': { position: '하이브리드 원딜', role: ['dealer'] },
  '사회탐구 1타': { position: '주문력 암살자', role: ['dealer'] },
  '발명품 매니아': { position: '주문력 마법사', role: ['dealer'] },
  '시조 읊는 선비': { position: '주문력 마법사', role: ['dealer', 'support'] },
  '해외 보따리상': { position: '처형 전문가', role: ['dealer'] },
  '영어 프리토커': { position: '마나제어 전문가', role: ['dealer', 'support'] },
  '수채화 장인': { position: '마나제어 전문가', role: ['dealer', 'support'] },
  '오케스트라 단장': { position: '주문력 인챈터', role: ['support'] },
  '양호실 도우미': { position: '주문력 인챈터', role: ['support', 'tank'] },
  '미술 치료사': { position: '주문력 인챈터', role: ['support'] },
  '또래 상담 에이스': { position: '주문력 인챈터', role: ['support', 'tank'] },

  // 4코스트
  '전교 체육부장': { position: '퓨어 탱커', role: ['tank'] },
  '논술의 신': { position: '물리 암살자', role: ['dealer'] },
  '수능 만점자': { position: '물리 원딜', role: ['dealer'] },
  '미친 과학자': { position: '주문력 마법사', role: ['dealer'] },
  '천재 퀀트': { position: '주문력 마법사', role: ['dealer'] },
  '전교 학생회장': { position: '주문력 인챈터', role: ['support', 'tank'] },
  '천재 피아니스트': { position: '주문력 인챈터', role: ['support', 'dealer'] },
  '나이팅게일': { position: '주문력 힐러', role: ['support'] },

  // 5코스트
  '외고 전학생': { position: '하이브리드 원딜', role: ['dealer'] },
  '수석 연구원': { position: '디버프 전문가', role: ['support', 'dealer'] },
  '교장 선생님': { position: '디버프 전문가', role: ['support', 'tank'] },
  '피카소의 재림': { position: '주문력 인챈터', role: ['support'] },
  '기부 천사': { position: '서포터', role: ['support'] }
};

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetPath = path.join(__dirname, '../js/data.js');

let content = fs.readFileSync(targetPath, 'utf-8');

for (const [unitName, data] of Object.entries(roleMapping)) {
    const roleStr = JSON.stringify(data.role).replace(/"/g, "'");
    const injection = ` position: '${data.position}', role: ${roleStr},`;
    const regex = new RegExp(`name:\\s*['"]${unitName}['"]\\s*,`);
    if (regex.test(content)) {
        content = content.replace(regex, `name: '${unitName}',${injection}`);
    } else {
        console.log("Could not find unit:", unitName);
    }
}

fs.writeFileSync(targetPath, content);
console.log("data.js updated with roles.");
