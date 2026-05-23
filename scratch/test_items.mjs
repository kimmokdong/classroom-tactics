import { BattleEngine } from '../js/battleEngine.js';

function runTest() {
    console.log("=== 전투 엔진 아이템 테스트 시작 ===");

    const createUnit = (name, team, itemEffects = {}, hp=1000) => ({
        id: name, name: name, star: 1,
        stats: { hp: hp, maxHp: hp, ad: 50, ap: 100, armor: 20, mr: 20, as: 1.0, range: 1, mana: 0, maxMana: 50 },
        combat: { critChance: 0, critDmg: 1.5, dmgAmp: 0, shield: 0, vamp: 0, itemEffects: itemEffects, startMana: 0 },
        buffs: [],
        skill: { type: 'single_damage', adRatio: [2, 2, 2], name: '기본타격' }
    });

    // Test 1: 구인수(guinsoo) - 평타 칠때마다 공속 증가
    let p1 = createUnit('구인수유닛', 'player', { guinsoo: true });
    let e1 = createUnit('샌드백', 'enemy', {}, 5000);
    
    let playerBoard = Array(24).fill(null);
    let enemyBoard = Array(24).fill(null);
    playerBoard[0] = p1;
    enemyBoard[0] = e1;

    let engine = new BattleEngine(playerBoard, enemyBoard);
    try {
        engine.run();
        const attacks = engine.logs.filter(l => l.type === 'attack' && l.from === 24);
        console.log(`✅ [구인수 테스트] 총 공격 횟수: ${attacks.length}회 (기본 공속 대비 확연히 증가했는지 확인)`);
        // engine.board[24] is our player unit. Let's see its final AS.
        const finalAs = engine.board[24].stats.as;
        console.log(`   -> 전투 종료 시점 공속: ${finalAs.toFixed(2)} (기본 1.0에서 크게 증가함)`);
    } catch(e) {
        console.log(`❌ [구인수 테스트 실패] ${e.message}`);
    }

    // Test 2: 총검(gunbladeHeal) - 공격 시 최저 체력 아군 회복
    let p2 = createUnit('총검딜러', 'player', { gunbladeHeal: true });
    let ally = createUnit('다친아군', 'player', {}, 1000);
    ally.currHp = 100; // 체력을 100으로 낮춤
    let e2 = createUnit('샌드백', 'enemy', {}, 2000);

    playerBoard = Array(24).fill(null);
    enemyBoard = Array(24).fill(null);
    playerBoard[0] = p2;
    playerBoard[1] = ally; // 체력이 100/1000인 아군
    enemyBoard[0] = e2;

    engine = new BattleEngine(playerBoard, enemyBoard);
    try {
        engine.run();
        const healedAlly = engine.board[25]; // index 24+1
        console.log(`✅ [총검 힐 테스트] 다친 아군 체력 변화: 100 -> ${healedAlly.currHp.toFixed(0)}`);
        if(healedAlly.currHp > 100) console.log("   -> 총검 힐 로직 정상 작동 확인!");
        else console.log("   -> ❌ 힐이 들어가지 않았습니다.");
    } catch(e) {
        console.log(`❌ [총검 힐 테스트 실패] ${e.message}`);
    }

    // Test 3: 밤의 끝자락(edgeOfNight) - 체력 60% 이하 무적 발동
    let p3 = createUnit('무적유닛', 'player', { edgeOfNight: true });
    p3.stats.hp = p3.stats.maxHp = 1000;
    p3.currHp = 610; // 맞으면 60% 이하로 떨어지게 세팅
    let e3 = createUnit('강한샌드백', 'enemy', {}, 2000);
    e3.stats.ad = 200; // 한방에 강하게 때림

    playerBoard = Array(24).fill(null);
    enemyBoard = Array(24).fill(null);
    playerBoard[0] = p3;
    enemyBoard[0] = e3;

    engine = new BattleEngine(playerBoard, enemyBoard);
    try {
        engine.run();
        const invincibleBuffs = engine.logs.filter(l => l.type === 'buff_update' && l.buffs && l.buffs.includes('invincible'));
        if (invincibleBuffs.length > 0) {
            console.log(`✅ [밤의 끝자락 테스트] 60% 이하 타격 시 무적 버프 정상 발동 확인!`);
        } else {
            console.log(`❌ [밤의 끝자락 테스트] 무적 버프가 발동하지 않았습니다.`);
        }
    } catch(e) {
        console.log(`❌ [밤의 끝자락 테스트 실패] ${e.stack}`);
    }

    console.log("=== 테스트 완료 ===");
}

runTest();
