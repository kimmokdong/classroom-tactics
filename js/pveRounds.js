import { createUnitInstance } from './battle/combatPreparation.js';

const monster = (id, name, icon, stats, position, pvePattern = null) => ({
    id,
    name,
    icon,
    position,
    archetype: 'PVE 몬스터',
    role: position.includes('탱커') ? ['tank'] : ['dealer'],
    subject: 'PVE',
    club: '교실 소동',
    tier: 0,
    manaType: '근성',
    stats: { mana: 0, maxMana: 0, ap: 100, range: 1, ...stats },
    skill: null,
    pvePattern,
    isPveMonster: true
});

export const PVE_MONSTERS = Object.freeze({
    chalkDust: monster('pve_chalk_dust', '분필 먼지', '☁️', {
        hp: 110, ad: 6, armor: 0, mr: 0, as: 0.35
    }, '근접 잡몹'),
    runawayEraser: monster('pve_runaway_eraser', '도망친 지우개', '🧽', {
        hp: 260, ad: 22, armor: 10, mr: 10, as: 0.55
    }, '근접 잡몹'),
    testPaper: monster('pve_test_paper', '날아다니는 시험지', '📄', {
        hp: 220, ad: 24, armor: 5, mr: 5, as: 0.60, range: 3
    }, '원거리 잡몹'),
    backpackGolem: monster('pve_backpack_golem', '책가방 골렘', '🎒', {
        hp: 550, ad: 30, armor: 25, mr: 25, as: 0.45
    }, '퓨어 탱커', {
        type: 'front_slam', label: '책가방 강타', firstWarningTick: 10, warningDelay: 12, period: 80, adRatio: 1.5, stunTicks: 5
    }),
    examDrone: monster('pve_exam_drone', '시험 감독 드론', '🛸', {
        hp: 380, ad: 35, armor: 12, mr: 12, as: 0.65, range: 3
    }, '원거리 딜러', {
        type: 'marked_blast', label: '감독 표식', firstWarningTick: 30, warningDelay: 15, period: 90, adRatio: 2, splashRatio: 0.5
    }),
    hallMonitor: monster('pve_hall_monitor', '야간 순찰 로봇', '🤖', {
        hp: 900, ad: 50, armor: 35, mr: 35, as: 0.55
    }, '보스 탱커', {
        type: 'row_silence', label: '야간 순찰', firstWarningTick: 60, warningDelay: 15, period: 100, sealTicks: 20
    })
});

const OPENING_ENCOUNTERS = Object.freeze({
    '1-1': {
        name: '첫 번째 청소 당번',
        description: '어떤 1코스트 1성 유닛도 혼자 정리할 수 있는 입문 전투',
        lineup: [{ monsterId: 'chalkDust', position: 19, stats: { hp: 90, ad: 5 } }]
    },
    '1-2': {
        name: '도망친 지우개',
        description: '두 번째 유닛을 배치하면 여유롭게 정리할 수 있는 준비 전투',
        lineup: [
            { monsterId: 'runawayEraser', position: 18, stats: { hp: 160, ad: 10, armor: 5, mr: 5, as: 0.45 } },
            { monsterId: 'runawayEraser', position: 21, stats: { hp: 160, ad: 10, armor: 5, mr: 5, as: 0.45 } }
        ]
    },
    '1-3': {
        name: '시험지 소동',
        description: '최약체 1코스트 한 명만으로는 버겁지만 정상 배치라면 안전한 준비 전투',
        lineup: [
            { monsterId: 'runawayEraser', position: 18, stats: { hp: 220, ad: 18, armor: 8, mr: 8, as: 0.50 } },
            { monsterId: 'runawayEraser', position: 21, stats: { hp: 220, ad: 18, armor: 8, mr: 8, as: 0.50 } },
            { monsterId: 'testPaper', position: 11, stats: { hp: 190, ad: 16, armor: 5, mr: 5, as: 0.50, range: 3 } }
        ]
    }
});

const EXAM_FORMATIONS = Object.freeze({
    1: ['runawayEraser', 'runawayEraser', 'testPaper'],
    2: ['runawayEraser', 'runawayEraser', 'testPaper', 'backpackGolem'],
    3: ['runawayEraser', 'runawayEraser', 'testPaper', 'testPaper', 'backpackGolem'],
    4: ['runawayEraser', 'runawayEraser', 'testPaper', 'testPaper', 'backpackGolem', 'examDrone'],
    5: ['runawayEraser', 'runawayEraser', 'testPaper', 'testPaper', 'backpackGolem', 'examDrone', 'hallMonitor'],
    6: ['runawayEraser', 'runawayEraser', 'testPaper', 'testPaper', 'backpackGolem', 'examDrone', 'examDrone', 'hallMonitor']
});

const FORMATION_POSITIONS = Object.freeze([17, 22, 8, 15, 19, 10, 13, 20]);
const EXAM_NAMES = Object.freeze({
    1: '교실 대청소',
    2: '쉬는 시간 소동',
    3: '복도 대청소',
    4: '중간고사 경보',
    5: '야간 자율학습',
    6: '졸업 전야 대소동'
});

function normalizeStage(stage) {
    return [
        Math.max(1, Math.floor(Number(stage?.[0]) || 1)),
        Math.min(5, Math.max(1, Math.floor(Number(stage?.[1]) || 1)))
    ];
}

export function isOpeningPveStage(stage) {
    const [world, round] = normalizeStage(stage);
    return world === 1 && round <= 3;
}

export function isPveStage(stage, { includeOpening = false } = {}) {
    const [, round] = normalizeStage(stage);
    return round === 5 || (includeOpening && isOpeningPveStage(stage));
}

function createExamEncounter(world) {
    const formationTier = Math.min(6, Math.max(1, world));
    const lateWorlds = Math.max(0, world - 2);
    const hpScale = 1 + lateWorlds * 0.35;
    const adScale = 1 + lateWorlds * 0.25;
    const defenseBonus = lateWorlds * 5;
    let droneCount = 0;
    const lineup = EXAM_FORMATIONS[formationTier].map((monsterId, index) => {
        const patternOffset = monsterId === 'examDrone' ? droneCount++ * 15 : 0;
        return {
            monsterId,
            position: FORMATION_POSITIONS[index],
            hpScale,
            adScale,
            defenseBonus,
            patternOffset
        };
    });
    const mechanics = [];
    if (lineup.some(entry => entry.monsterId === 'backpackGolem')) mechanics.push('주황 칸 강타는 흩어져 피하기');
    if (lineup.some(entry => entry.monsterId === 'examDrone')) mechanics.push('빨간 표식은 후열 간격 벌리기');
    if (lineup.some(entry => entry.monsterId === 'hallMonitor')) mechanics.push('보라색 줄은 주문 유닛 나눠 배치');
    return {
        name: EXAM_NAMES[formationTier],
        description: mechanics.length ? mechanics.join(' · ') : '정상적인 빌드업은 여유롭게, 부실한 보드는 긴장감 있게',
        mechanics,
        lineup
    };
}

export function getPveEncounter(stage, { includeOpening = false } = {}) {
    const normalized = normalizeStage(stage);
    const key = normalized.join('-');
    if (includeOpening && OPENING_ENCOUNTERS[key]) return OPENING_ENCOUNTERS[key];
    if (normalized[1] === 5) return createExamEncounter(normalized[0]);
    return null;
}

function createMonster(entry, stageKey, index) {
    const template = structuredClone(PVE_MONSTERS[entry.monsterId]);
    if (!template) throw new RangeError(`등록되지 않은 PVE 몬스터: ${entry.monsterId}`);
    const hpScale = entry.hpScale || 1;
    const adScale = entry.adScale || 1;
    const defenseBonus = entry.defenseBonus || 0;
    const stats = { ...template.stats, ...(entry.stats || {}) };
    stats.hp = Math.round(stats.hp * hpScale);
    stats.ad = Math.round(stats.ad * adScale);
    stats.armor = Math.round(stats.armor + defenseBonus);
    stats.mr = Math.round(stats.mr + defenseBonus);
    template.stats = stats;
    if (template.pvePattern) template.pvePattern.offset = entry.patternOffset || 0;
    template.pveStage = stageKey;
    return createUnitInstance(template, {
        teamRole: 'opponent',
        instanceId: `${stageKey}:${template.id}:${index}`
    });
}

export function generatePveBoard(stage, options = {}) {
    const encounter = getPveEncounter(stage, options);
    if (!encounter) return null;
    const stageKey = normalizeStage(stage).join('-');
    const board = Array(24).fill(null);
    encounter.lineup.forEach((entry, index) => {
        board[entry.position] = createMonster(entry, stageKey, index);
    });
    return board;
}

export function getPveRewardPlan(stage, random = Math.random, { includeOpening = false } = {}) {
    if (typeof random !== 'function') throw new TypeError('random은 함수여야 합니다.');
    const [world, round] = normalizeStage(stage);
    if (includeOpening && world === 1 && round <= 3) {
        return { baseItems: 1, combinedItems: 0, componentValue: 1, label: '무작위 기본 아이템 1개' };
    }
    if (round !== 5) return null;
    if (world <= 3 || random() < 0.5) {
        return { baseItems: 2, combinedItems: 0, componentValue: 2, label: '무작위 기본 아이템 2개' };
    }
    return { baseItems: 0, combinedItems: 1, componentValue: 2, label: '무작위 완성 아이템 1개' };
}

export function grantPveReward(app, stage, random = Math.random, options = {}) {
    const reward = getPveRewardPlan(stage, random, options);
    if (!reward) return null;
    for (let index = 0; index < reward.baseItems; index++) app.giveRandomBaseItem();
    for (let index = 0; index < reward.combinedItems; index++) app.giveRandomCombinedItem();
    return reward;
}

export function getNextStage(stage, { skipOpeningRounds = false } = {}) {
    const [world, round] = normalizeStage(stage);
    if (skipOpeningRounds && world === 1 && round === 3) return [2, 1];
    return round === 5 ? [world + 1, 1] : [world, round + 1];
}
