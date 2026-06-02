const fs = require('fs');

let content = fs.readFileSync('./js/data.js', 'utf8');

const archetypes = {
    'AS 캐리': ['수학천재', '육상부 에이스', '수능 만점자', '외고 전학생'],
    'AD 캐스터': ['달리기 선수', '영단어 암기왕', '발명품 매니아', '올림피아드 금상', '천재 퀀트', '피카소의 재림'],
    '브루저': ['과학탐구원', '수학 짝꿍', '지리덕후', '찰흙 조각가', '칠판닦이 당번', '골목대장', '역사 매니아', '체육부장', '전교 체육부장'],
    'AP 캐리': ['국어부장', '과학실험부장', '사회탐구 1타', '시조 읊는 선비', '해외 보따리상', '논술의 신', '미친 과학자', '수석 연구원'],
    '딜 서폿': ['칠판 낙서꾼', '팝송 매니아', '수채화 장인', '영어 프리토커', '천재 피아니스트'],
    '인챈터 서폿': ['리코더 요정', '급식 당번', '문학소녀', '진로진학 멘토', '합창단 에이스', '미술 치료사', '오케스트라 단장', '나이팅게일', '기부 천사'],
    '퓨어 탱커': ['복도 지킴이', '공익광고 모델', '교장 선생님'],
    '탱 서폿': ['바른생활 사나이', '또래 상담 에이스', '양호실 도우미', '전교 학생회장']
};

let nameToArchetype = {};
for (const [arch, units] of Object.entries(archetypes)) {
    for (const unit of units) {
        nameToArchetype[unit] = arch;
    }
}

content = content.replace(/name: '([^']+)', position: '([^']+)'/g, (match, name, position) => {
    const arch = nameToArchetype[name];
    if (!arch) {
        console.log('Missing archetype for: ' + name);
        return match;
    }
    return match + `, archetype: '${arch}'`;
});

const itemPoolsCode = `
export const ITEM_POOLS = {
    'AS 캐리': ['comb_as_as', 'comb_ad_as', 'comb_as_ap', 'comb_as_mr', 'comb_as_crit', 'comb_hp_crit'],
    'AD 캐스터': ['comb_ad_ad', 'comb_ad_crit', 'comb_ad_mana', 'comb_mana_mana', 'comb_mana_crit'],
    '브루저': ['comb_ad_mr', 'comb_as_armor', 'comb_ad_hp', 'comb_ad_armor', 'comb_hp_crit'],
    'AP 캐리': ['comb_ap_ap', 'comb_ap_crit', 'comb_ap_mana', 'comb_mana_mana', 'comb_ad_ap'],
    '딜 서폿': ['comb_ap_hp', 'comb_as_mana', 'comb_armor_crit', 'comb_mana_mana', 'comb_ad_mana', 'comb_ap_ap', 'comb_ap_mana'],
    '인챈터 서폿': ['comb_ad_mana', 'comb_mana_mr', 'comb_ap_mana', 'comb_as_mana', 'comb_armor_crit'],
    '퓨어 탱커': ['comb_hp_hp', 'comb_armor_armor', 'comb_mr_mr', 'comb_armor_mr', 'comb_armor_hp'],
    '탱 서폿': ['comb_mana_armor', 'comb_as_hp', 'comb_mr_hp', 'comb_armor_hp', 'comb_ap_mr', 'comb_mana_hp', 'comb_ap_armor', 'comb_hp_hp']
};
`;

fs.writeFileSync('./js/data.js', content + '\n' + itemPoolsCode);
console.log('Successfully updated js/data.js');
