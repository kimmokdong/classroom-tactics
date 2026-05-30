import { eventBus } from './EventBus.js';

export function createInitialState() {
    return {
        gold: 10,
        hp: 100,
        level: 1,
        exp: 0,
        stage: [1, 1], // [World, Round]
        board: Array(24).fill(null), // 3x8 Player
        enemyBoard: Array(24).fill(null), // 3x8 Enemy
        bench: Array(10).fill(null),
        shop: Array(5).fill(null),
        inventory: Array(12).fill(null), // 아이템 인벤토리
        augments: [],
        globalBuffs: { teamHp: 0, teamAdAp: 0, teamDef: 0, critChance: 0, dmgAmp: 0, dmgReduc: 0, vamp: 0, startShield: 0, tickHealPct: 0, asMult: 0, startMana: 0, rangeBuff: 0, distAmp: 0 },
        freeRerolls: 0,
        shopLocked: false, // 상점 잠금 상태
        highEndShopping: false,
        freeMeals: false,
        richFoundation: false,
        invincibleRounds: 0,
        lateLeave: false,
        honorStudent: false,
        snackShop: false,
        winStreak: 0,
        lossStreak: 0,
        sharedPool: createSharedPool()
    };
}

function createSharedPool() {
    return {}; // We will initialize this in main.js to avoid circular dependencies
}
