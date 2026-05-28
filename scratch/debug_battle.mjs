import fs from 'fs';
import { UNIT_POOL } from '../js/data.js';
import { ITEMS } from '../js/items.js';
import { BattleEngine } from '../js/battleEngine.js';
import { SynergyManager } from '../js/systems/SynergyManager.js';

const decks = JSON.parse(fs.readFileSync('./js/meta_decks.json', 'utf-8'));
const deckA = decks.find(d => d.id === '보건부6_도덕2');
const deckB = decks.find(d => d.id === '국어4_육상부4');

const mockApp = {
    state: {
        globalBuffs: { teamHp:0, teamAdAp:0, teamDef:0, critChance:0, dmgAmp:0, vamp:0, startShield:0, tickHealPct:0, asMult:0, startMana:0, rangeBuff:0, distAmp:0 },
        hp: 100,
        inventory: Array(12).fill(null)
    },
    ITEMS: ITEMS
};
const synManager = new SynergyManager(mockApp);

const BIS_ITEMS = {
    AP_CARRY: ['comb_ap_ap', 'comb_ap_crit', 'comb_mana_mana'],
    AD_CARRY: ['comb_ad_ad', 'comb_as_crit', 'comb_ad_mr'],
    AS_CARRY: ['comb_as_as', 'comb_ad_as', 'comb_ad_mr'],
    AD_CRIT: ['comb_ad_ad', 'comb_ad_crit', 'comb_as_crit'],
    TANK: ['comb_hp_hp', 'comb_armor_armor', 'comb_mr_mr']
};

function getHeuristicScores(u) {
    let tankScore = 0;
    let adScore = 0;
    let apScore = 0;
    tankScore += u.stats.hp / 100;
    if (u.stats.range <= 1) tankScore += 5;
    if (u.skill.type.includes('shield') || u.skill.type.includes('taunt') || u.skill.type.includes('heal') || u.skill.type.includes('cc')) tankScore += 10;
    adScore += u.stats.ad / 10;
    if (u.skill.adRatio) adScore += 10;
    apScore += (u.stats.ap || 100) / 20;
    if (u.skill.apRatio) apScore += 10;
    if (u.stats.range >= 2) apScore += 3;
    return { tankScore, adScore, apScore };
}

function instantiateDeckWithItems(deckDef) {
    const board = Array(24).fill(null);
    let unitsData = [];
    for (let uDef of deckDef.units) {
        const baseUnit = UNIT_POOL.find(u => u.id === uDef.id);
        if (baseUnit && uDef.gridIndex >= 0 && uDef.gridIndex < 24) {
            const cloned = JSON.parse(JSON.stringify(baseUnit));
            cloned.stats.hp *= 1.8;
            cloned.stats.maxHp = cloned.stats.hp;
            cloned.currHp = cloned.stats.hp;
            cloned.stats.ad *= 1.5;
            cloned.currMana = cloned.stats.mana || 0;
            cloned.stats.maxMana = cloned.stats.maxMana || cloned.stats.mana || 0;
            cloned.currShield = 0;
            cloned.combat = { shield: 0, vamp: 0, dmgAmp: 0, critChance: 0.10, critDmg: 1.5, dmgReduc: 0, itemEffects: {} };
            cloned.items = [];
            cloned.gridIndex = uDef.gridIndex;
            const scores = getHeuristicScores(baseUnit);
            unitsData.push({ unit: cloned, tier: baseUnit.tier, scores, club: baseUnit.club, subject: baseUnit.subject });
        }
    }
    unitsData.sort((a, b) => (b.scores.tankScore + b.tier * 10) - (a.scores.tankScore + a.tier * 10));
    const mainTank = unitsData[0];
    if (mainTank) { mainTank.unit.items = [...BIS_ITEMS.TANK]; mainTank.isMainTank = true; }
    const carryCandidates = unitsData.filter(u => !u.isMainTank);
    carryCandidates.sort((a, b) => Math.max(b.scores.adScore, b.scores.apScore) + b.tier * 10 - (Math.max(a.scores.adScore, a.scores.apScore) + a.tier * 10));
    const mainCarry = carryCandidates[0];
    if (mainCarry) {
        if (mainCarry.scores.adScore > mainCarry.scores.apScore) {
            if (mainCarry.club === '육상부') mainCarry.unit.items = [...BIS_ITEMS.AS_CARRY];
            else mainCarry.unit.items = [...BIS_ITEMS.AD_CARRY];
        } else {
            mainCarry.unit.items = [...BIS_ITEMS.AP_CARRY];
        }
    }
    unitsData.forEach(ud => { board[ud.unit.gridIndex] = ud.unit; });
    return board;
}

const rawBoardA = instantiateDeckWithItems(deckA);
const synDataA = synManager.getSynergyData(rawBoardA);
const buffedBoardA = synManager.applySynergyStats(rawBoardA, synDataA, false);

const rawBoardB = instantiateDeckWithItems(deckB);
const synDataB = synManager.getSynergyData(rawBoardB);
const buffedBoardB = synManager.applySynergyStats(rawBoardB, synDataB, false);

console.log("보건부 시너지 계산 결과:", synDataA.clubs['보건부']);

const engine = new BattleEngine(JSON.parse(JSON.stringify(buffedBoardA)), JSON.parse(JSON.stringify(buffedBoardB)));
const logs = engine.run();

logs.forEach(log => {
    if (log.type === 'die' || log.type === 'revive' || log.type === 'damage' && log.fxType === 'fire_red') {
        console.log(`[Tick ${log.tick}] ${log.type === 'die' ? '💀 DIE' : log.type === 'revive' ? '✨ REVIVE' : '💥 BURST DMG'} - Target: ${log.target || log.unitId}, Val/Hp: ${log.hp || log.dmg}`);
    }
});
