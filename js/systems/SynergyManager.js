import { SYNERGIES, UNIT_POOL } from '../data.js';
import { formatStat } from '../core/constants.js';

export class SynergyManager {
    constructor(gameApp) {
        this.app = gameApp;
    }

    getSynergyData(boardArray) {
        const uniqueUnits = [];
        const seenIds = new Set();

        boardArray.forEach(unit => {
            if (unit && !seenIds.has(unit.id)) {
                uniqueUnits.push(unit);
                seenIds.add(unit.id);
            }
        });

        const counts = { subjects: {}, clubs: {} };
        uniqueUnits.forEach(u => {
            counts.subjects[u.subject] = (counts.subjects[u.subject] || 0) + 1;
            counts.clubs[u.club] = (counts.clubs[u.club] || 0) + 1;
        });

        return counts;
    }

    calculateSynergy() {
        const counts = this.getSynergyData(this.app.state.board);
        this.renderSynergyUI(counts);
    }

    getActiveSynergyLevel(count, levelsArr, exactMatch = false) {
        if (exactMatch) {
            return levelsArr.includes(String(count)) ? count : 0;
        }
        let maxLvl = 0;
        levelsArr.forEach(lvl => {
            if (count >= Number(lvl)) maxLvl = Number(lvl);
        });
        return maxLvl;
    }

    applySynergyStats(originalBoard, activeSynergies, isEnemy = false) {
        const buffedBoard = originalBoard.map(u => {
            if (!u) return null;
            const newU = JSON.parse(JSON.stringify(u));
            newU.combat = { shield: 0, vamp: 0, dmgAmp: 0, critChance: 0.10, critDmg: 1.5, dmgReduc: 0 };
            if (newU.permGrowth) {
                newU.stats.ad += newU.permGrowth.ad || 0;
                newU.stats.as += newU.permGrowth.as || 0;
                newU.stats.ap += newU.permGrowth.ap || 0;
                newU.stats.hp += newU.permGrowth.hp || 0;
            }
            return newU;
        });

        const getLevelData = (type, name, count) => {
            const synData = SYNERGIES[type][name];
            if (!synData) return null;
            if (synData.exactMatch) {
                return synData.levels[count] ? synData.levels[count] : null;
            }
            let activeLvl = 0;
            for (let lvl of Object.keys(synData.levels).map(Number).sort((a, b) => a - b)) {
                if (count >= lvl) activeLvl = lvl;
            }
            return activeLvl > 0 ? synData.levels[activeLvl] : null;
        };

        let teamAp = 0, teamHp = 0, teamDef = 0;

        for (let [subj, count] of Object.entries(activeSynergies.subjects)) {
            const eff = getLevelData('subjects', subj, count);
            if (!eff) continue;

            if (subj === '국어') teamAp += eff.teamAp || 0;
            if (subj === '체육') teamHp += eff.teamHp || 0;
            if (subj === '도덕') teamDef += eff.teamDef || 0;
        }

        const g = this.app.state.globalBuffs;
        const playerHp = this.app.state.hp;
        const isSpartan = g.spartanTraining && playerHp <= 30 && !isEnemy;
        const isDuty = g.dutyResponsibility && originalBoard.filter(u => u).length <= 3 && !isEnemy;

        buffedBoard.forEach(u => {
            if (!u) return;

            u.stats.ap += teamAp;
            u.stats.hp += teamHp;
            u.stats.armor += teamDef;
            u.stats.mr += teamDef;
            if (u.stats.maxMana > 0) u.stats.maxMana = Math.max(10, u.stats.maxMana);

            if (!isEnemy) {
                u.stats.hp += g.teamHp;
                u.stats.ad += g.teamAdAp;
                u.stats.ap += g.teamAdAp;
                u.stats.armor += g.teamDef;
                u.stats.mr += g.teamDef;
                u.combat.critChance += g.critChance;
                u.combat.dmgAmp += g.dmgAmp;
                u.combat.vamp += g.vamp;
                u.combat.shield += g.startShield;
                u.combat.tickHealPct = g.tickHealPct;
                u.stats.as *= (1 + g.asMult);
                u.combat.startMana = g.startMana;
                u.stats.range += g.rangeBuff;
                u.combat.distAmp = (u.combat.distAmp || 0) + g.distAmp;

                if (isSpartan) { u.combat.dmgReduc += 0.3; u.combat.vamp += 0.3; }
                if (isDuty) { u.combat.dmgReduc += 0.15; }
            } else {
                if (g.enforcerAura) {
                    u.stats.maxHp = Math.round(u.stats.maxHp * 0.85);
                    u.stats.hp = u.stats.maxHp;
                }
            }

            const subjEff = getLevelData('subjects', u.subject, activeSynergies.subjects[u.subject]);
            if (subjEff) {
                if (u.subject === '국어') u.stats.ap += subjEff.selfAp || 0;
                if (u.subject === '수학') { u.combat.critChance += subjEff.critChance; u.combat.critDmg += subjEff.critDmg; }
                if (u.subject === '과학') {
                    u.combat.dmgAmp = (u.combat.dmgAmp || 0) + (subjEff.dmgAmp || 0);
                    if (subjEff.skillCrit) u.combat.skillCrit = true;
                    if (subjEff.critChance) u.combat.critChance = (u.combat.critChance || 0) + subjEff.critChance;
                }
                if (u.subject === '사회') {
                    if (subjEff.shield) u.combat.shield += subjEff.shield;
                    if (subjEff.allStats) {
                        const mult = 1 + subjEff.allStats;
                        u.stats.hp *= mult;
                        u.stats.ad *= mult;
                        u.stats.ap *= mult;
                        u.stats.armor *= mult;
                        u.stats.mr *= mult;
                    }
                }
                if (u.subject === '영어') {
                    if (subjEff.manaReduc) u.stats.maxMana = Math.max(10, Math.floor(u.stats.maxMana * (1 - subjEff.manaReduc)));
                }
                if (u.subject === '체육') { u.stats.hp += (subjEff.teamHp || 0) * ((subjEff.selfHpMult || 1) - 1); }
                if (u.subject === '음악') { u.combat.isFirelight = true; u.combat.tickHeal = subjEff.tickHeal; u.combat.bonusMagicDmg = subjEff.bonusMagicDmg; }
                if (subjEff.teamManaRegen) u.combat.teamManaRegen = (u.combat.teamManaRegen || 0) + subjEff.teamManaRegen;
                if (u.subject === '미술' && subjEff.artManaRegen) { u.combat.artManaRegen = (u.combat.artManaRegen || 0) + subjEff.artManaRegen; }
                if (u.subject === '도덕') { u.stats.armor += (subjEff.teamDef || 0) * ((subjEff.selfDefMult || 1) - 1); u.stats.mr += (subjEff.teamDef || 0) * ((subjEff.selfDefMult || 1) - 1); }
            }

            const clubEff = getLevelData('clubs', u.club, activeSynergies.clubs[u.club]);
            if (clubEff) {
                if (u.club === '선도부') { u.combat.shield += u.stats.hp * clubEff.startShieldPct; u.combat.dmgAmp += clubEff.dmgAmp; }
                if (u.club === '방송부') { u.combat.isSniper = true; u.combat.distAmp = clubEff.distAmp; u.stats.range += (clubEff.rangeBuff || 0); }
                if (u.club === '육상부') { u.combat.isQuickstriker = true; u.combat.maxAsBuff = clubEff.maxAsBuff; }
                if (u.club === '보건부') { u.combat.isWatcher = true; u.combat.dmgReduc += clubEff.dmgReduc; }
                if (u.club === '급식부') { u.combat.isDominator = true; u.combat.shield += clubEff.startShield; u.combat.stackAdApPct = clubEff.stackAdApPct; if (clubEff.vampBuff) u.combat.vamp = (u.combat.vamp || 0) + clubEff.vampBuff; }
                if (u.club === '장난꾸러기') { u.stats.ad *= (1 + clubEff.adBuff); }
            }

            if (u.items && u.items.length > 0) {
                let itemAdPct = 0;
                let itemApPct = 0;
                u.combat.itemEffects = u.combat.itemEffects || {};

                let actualItems = [...u.items];
                if (actualItems.includes("comb_crit_crit") && u.thievesItems) {
                    actualItems = ["comb_crit_crit", ...u.thievesItems];
                    u.items = actualItems;
                }

                actualItems.forEach(itemId => {
                    const itemDef = this.app.ITEMS.find(i => i.id === itemId);
                    if (!itemDef) return;

                    const st = itemDef.stats;
                    if (st.ad) u.stats.ad += st.ad;
                    if (st.adPct) itemAdPct += st.adPct;
                    if (st.ap) u.stats.ap += st.ap;
                    if (st.apPct) itemApPct += st.apPct;
                    if (st.as) u.stats.as *= (1 + st.as);
                    if (st.mana) u.combat.startMana = (u.combat.startMana || 0) + st.mana;
                    if (st.armor) u.stats.armor += st.armor;
                    if (st.mr) u.stats.mr += st.mr;
                    if (st.maxHp) u.stats.hp += st.maxHp;
                    if (st.critChance) u.combat.critChance += st.critChance;
                    if (st.dodge) u.combat.dodge = (u.combat.dodge || 0) + st.dodge;
                    if (st.vamp) u.combat.vamp += st.vamp;

                    if (itemDef.effect) {
                        u.combat.itemEffects[itemDef.effect] = true;
                    }
                });

                if (itemAdPct > 0) u.stats.ad *= (1 + itemAdPct);
                if (itemApPct > 0) u.stats.ap *= (1 + itemApPct);

                if (u.combat.itemEffects.skillCrit) u.combat.critDmg += 0.10;
                if (u.combat.itemEffects.hoj) {
                    if (Math.random() < 0.5) {
                        u.combat.dmgAmp += 0.30;
                        u.combat.vamp += 0.15;
                    } else {
                        u.combat.dmgAmp += 0.15;
                        u.combat.vamp += 0.30;
                    }
                }
            }

            u.stats.maxHp = u.stats.hp;
            if (u.combat.startMana) u.stats.mana = Math.min(u.stats.maxMana, u.stats.mana + u.combat.startMana);
        });

        return buffedBoard;
    }

    getSynergyTierAndSteps(count, synData) {
        let rank = 0; 
        const levels = Object.keys(synData.levels).map(Number).sort((a,b)=>a-b);
        let activeLevel = 0;

        if (synData.exactMatch) {
            if (levels.includes(count)) {
                activeLevel = count;
                const idx = levels.indexOf(count);
                if (levels.length === 2 && idx === 1) rank = 3;
                else rank = idx + 1;
            }
        } else {
            for (let i = 0; i < levels.length; i++) {
                if (count >= levels[i]) {
                    activeLevel = levels[i];
                    if (levels.length === 2 && i === 1) rank = 3;
                    else rank = i + 1;
                }
            }
        }
        
        const stepStrs = levels.map(lvl => {
            if (lvl === activeLevel) return `<span style="color:#e11d48; font-weight:900; font-size:1.1em;">${lvl}</span>`;
            if (lvl < activeLevel) return `<span style="color:#64748b; font-weight:bold;">${lvl}</span>`;
            return `<span style="color:#cbd5e1;">${lvl}</span>`;
        }).join(' <span style="color:#94a3b8; font-size:10px; margin: 0 2px;">></span> ');

        return { rank, activeLevel, stepStrs, levels };
    }

    getSynergyStyleByRank(rank) {
        switch (rank) {
            case 0: return { bg: '#e2e8f0', border: '#cbd5e1' }; 
            case 1: return { bg: '#bcaaa4', border: '#8d6e63' }; 
            case 2: return { bg: '#94a3b8', border: '#475569' }; 
            case 3: return { bg: '#facc15', border: '#ca8a04' }; 
            default: return { bg: '#22d3ee', border: '#0891b2' }; 
        }
    }

    getSynergyIcon(name) {
        const icons = {
            '국어': 'images/icon_01_korean.png',
            '수학': 'images/icon_02_math.png',
            '사회': 'images/icon_03_social.png',
            '과학': 'images/icon_04_science.png',
            '영어': 'images/icon_05_english.png',
            '체육': 'images/icon_06_pe.png',
            '음악': 'images/icon_07_music.png',
            '미술': 'images/icon_08_art.png',
            '도덕': 'images/icon_09_ethics.png',
            '선도부': 'images/icon_10_discipline.png',
            '방송부': 'images/icon_11_broadcasting.png',
            '육상부': 'images/icon_12_track.png',
            '보건부': 'images/icon_13_health.png',
            '급식부': 'images/icon_14_cafeteria.png',
            '장난꾸러기': 'images/icon_15_trickster.png'
        };
        const src = icons[name];
        if (src) {
            return `<img src="${src}" style="width: 28px; height: 28px; object-fit: contain; transform: scale(1.15);" alt="${name}">`;
        }
        return '✨';
    }

    renderSynergyUI(counts) {
        const listEl = document.getElementById('synergy-list');
        listEl.innerHTML = '';
        listEl.style.padding = '8px';
        listEl.style.background = 'rgba(255, 255, 255, 0.4)';
        listEl.style.borderRadius = '8px';

        const generateTooltip = (synData, type, name) => {
            let html = `<strong style="color:var(--primary-color);">${synData.name} 시너지 효과</strong><br><br>`;
            for (const [lvl, effects] of Object.entries(synData.levels)) {
                html += `<div style="margin-bottom: 5px;"><strong>[${lvl} 유닛]</strong> `;
                let effStrs = [];
                for (const [k, v] of Object.entries(effects)) {
                    effStrs.push(formatStat(k, v));
                }
                html += effStrs.join(', ') + `</div>`;
            }

            const seenIds = new Set();
            this.app.state.board.forEach(u => {
                if (u) seenIds.add(u.id);
            });

            const allMatches = UNIT_POOL.filter(u => u[type] === name);
            if (allMatches.length > 0) {
                html += `<div style="margin-top:10px; padding-top:12px; border-top:1px dashed #ccc; display:flex; gap:8px; flex-wrap:wrap;">`;
                allMatches.forEach(u => {
                    const tColor = `var(--tier${u.tier})`;
                    const isPlaced = seenIds.has(u.id);
                    const opacity = isPlaced ? '1' : '0.4';
                    const border = isPlaced ? `2px solid ${tColor}` : `2px dashed #999`;
                    const bg = isPlaced ? '#fff' : '#e2e8f0';
                    const shadow = isPlaced ? `box-shadow: 0 0 10px ${tColor}; transform: scale(1.1); z-index:2;` : '';
                    html += `<div style="width:34px; height:34px; border-radius:6px; border:${border}; display:flex; justify-content:center; align-items:center; font-size:22px; background:${bg}; opacity:${opacity}; ${shadow} transition:all 0.2s;" title="${u.name} (${u.tier}G)">${u.icon}</div>`;
                });
                html += `</div>`;
            }
            return html;
        };

        const activeSyns = [];

        for (const [subj, count] of Object.entries(counts.subjects)) {
            if (count > 0 && SYNERGIES.subjects[subj]) activeSyns.push({ name: subj, count, type: 'subject', data: SYNERGIES.subjects[subj] });
        }
        for (const [club, count] of Object.entries(counts.clubs)) {
            if (count > 0 && SYNERGIES.clubs[club]) activeSyns.push({ name: club, count, type: 'club', data: SYNERGIES.clubs[club] });
        }

        activeSyns.forEach(syn => {
            const info = this.getSynergyTierAndSteps(syn.count, syn.data);
            syn.rank = info.rank;
            syn.stepStrs = info.stepStrs;
        });

        activeSyns.sort((a, b) => {
            if (b.rank !== a.rank) return b.rank - a.rank;
            return b.count - a.count;
        });

        activeSyns.forEach(syn => {
            const style = this.getSynergyStyleByRank(syn.rank);
            const icon = this.getSynergyIcon(syn.name);
            
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.marginBottom = '6px';
            li.style.padding = '4px';
            li.style.background = 'rgba(255, 255, 255, 0.7)';
            li.style.borderRadius = '6px';
            li.style.cursor = 'help';
            li.style.transition = 'background 0.2s, box-shadow 0.2s';
            li.style.listStyle = 'none';
            li.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            li.onmouseenter = () => { li.style.background = 'rgba(255, 255, 255, 0.9)'; li.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)'; };
            li.onmouseleave = () => { li.style.background = 'rgba(255, 255, 255, 0.7)'; li.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; };

            li.innerHTML = `
                <div style="
                    width: 40px; height: 44px; 
                    background: ${style.border}; 
                    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
                    display: flex; justify-content: center; align-items: center;
                    margin-right: -4px; z-index: 2;
                ">
                    <div style="
                        width: 34px; height: 38px;
                        background: ${syn.rank === 0 ? '#f8f9fa' : style.bg};
                        clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
                        display: flex; justify-content: center; align-items: center;
                        font-size: 14px;
                    ">${icon}</div>
                </div>
                <div style="
                    width: 24px; height: 26px;
                    background: #f1f5f9; color: #334155;
                    display: flex; justify-content: center; align-items: center;
                    font-weight: bold; font-size: 13px;
                    border-top-right-radius: 4px; border-bottom-right-radius: 4px;
                    border: 1px solid #cbd5e1; border-left: none;
                    margin-right: 8px;
                ">${syn.count}</div>
                <div style="display: flex; flex-direction: column; justify-content: center;">
                    <div style="color: ${syn.rank > 0 ? '#1e293b' : '#94a3b8'}; font-weight: bold; font-size: 0.9rem; line-height: 1.1;">${syn.name}</div>
                    <div style="font-size: 0.7rem; line-height: 1.1; margin-top:2px;">${syn.stepStrs}</div>
                </div>
            `;

            li.onmouseover = (e) => {
                const tooltip = document.getElementById('tooltip');
                tooltip.style.display = 'block';
                tooltip.style.left = (e.pageX + 20) + 'px';
                tooltip.style.top = (e.pageY - 20) + 'px';
                tooltip.innerHTML = generateTooltip(syn.data, syn.type, syn.name);
            };
            li.onmouseout = () => {
                document.getElementById('tooltip').style.display = 'none';
            };

            listEl.appendChild(li);
        });
    }
}
