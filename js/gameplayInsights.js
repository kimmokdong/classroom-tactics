const clampNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function getStreakBonus(count) {
    const streak = Math.max(0, Math.floor(clampNumber(count)));
    if (streak >= 6) return 3;
    if (streak >= 5) return 2;
    if (streak >= 2) return 1;
    return 0;
}

export function getIncomePreview(state, { maxInterest = 5, isPve = false } = {}) {
    const gold = Math.max(0, Math.floor(clampNumber(state?.gold)));
    const cap = maxInterest === Infinity ? Number.MAX_SAFE_INTEGER : Math.max(0, clampNumber(maxInterest));
    const winStreak = Math.max(0, Math.floor(clampNumber(state?.winStreak)));
    const lossStreak = Math.max(0, Math.floor(clampNumber(state?.lossStreak)));
    const snackBonus = state?.snackShop ? 1 : 0;
    const honorBonus = state?.honorStudent ? 1 : 0;
    const lossInterest = Math.min(cap, Math.floor(gold / 10));
    // 승리 보너스 1G가 먼저 들어온 뒤 이자를 계산하는 실제 정산 순서를 따른다.
    const winInterest = Math.min(cap, Math.floor((gold + (isPve ? 0 : 1)) / 10));
    const nextWinStreak = winStreak + 1;
    const nextLossStreak = lossStreak + 1;

    return {
        currentInterest: lossInterest,
        winInterest,
        lossInterest,
        currentStreakBonus: getStreakBonus(Math.max(winStreak, lossStreak)),
        winStreak,
        lossStreak,
        nextWinStreak,
        nextLossStreak,
        winStreakBonus: getStreakBonus(isPve ? Math.max(winStreak, lossStreak) : nextWinStreak),
        lossStreakBonus: getStreakBonus(isPve ? Math.max(winStreak, lossStreak) : nextLossStreak),
        winTotal: 5 + (isPve ? 0 : 1) + winInterest + getStreakBonus(isPve ? Math.max(winStreak, lossStreak) : nextWinStreak) + snackBonus + honorBonus,
        lossTotal: 5 + lossInterest + getStreakBonus(isPve ? Math.max(winStreak, lossStreak) : nextLossStreak) + snackBonus,
        isPve
    };
}

const topStat = (stats, key) => Object.values(stats || {})
    .filter(stat => stat?.team === 'player')
    .map(stat => ({ name: stat.name || '이름 없는 학생', value: Math.round(clampNumber(stat[key])) }))
    .sort((a, b) => b.value - a.value)[0] || null;

export function buildBattleSummary(logs = [], stats = {}) {
    const playerDeaths = logs.filter(log => log?.type === 'die' && log.team === 'player');
    const playerSkills = logs.filter(log => log?.type === 'skill' && log.team === 'player');
    const castCounts = new Map();
    playerSkills.forEach(log => {
        const name = log.unitName || '이름 없는 학생';
        castCounts.set(name, (castCounts.get(name) || 0) + 1);
    });
    const topCaster = [...castCounts.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))[0] || null;
    const firstDeath = playerDeaths[0]
        ? { name: playerDeaths[0].unitName || '이름 없는 학생', seconds: Math.round(clampNumber(playerDeaths[0].tick)) / 10 }
        : null;
    const damage = topStat(stats, 'damage');
    const tank = topStat(stats, 'tank');
    const heal = topStat(stats, 'heal');

    let observation = '끝까지 살아남은 배치와 주력 유닛을 다음 전투에도 유지해 보세요.';
    if (firstDeath && firstDeath.seconds <= 8) {
        observation = `${firstDeath.name}이(가) ${firstDeath.seconds.toFixed(1)}초에 먼저 쓰러졌습니다. 앞줄 위치나 방어 아이템을 점검해 보세요.`;
    } else if (playerSkills.length === 0) {
        observation = '아군이 스킬을 한 번도 쓰지 못했습니다. 마나·생존·사거리 배치를 점검해 보세요.';
    } else if (damage?.value > 0) {
        observation = `${damage.name}이(가) 가장 많은 피해를 냈습니다. 이 유닛이 안전하게 공격할 배치를 만들어 보세요.`;
    }

    return {
        damage,
        tank,
        heal,
        firstDeath,
        skillCasts: playerSkills.length,
        topCaster,
        observation
    };
}

const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const statLine = (icon, label, stat) => stat
    ? `<span>${icon} ${label} <strong>${escapeHtml(stat.name)}</strong> ${stat.value}</span>`
    : `<span>${icon} ${label} 기록 없음</span>`;

export function formatBattleSummaryHtml(summary) {
    if (!summary) return '';
    const firstDeath = summary.firstDeath
        ? `첫 이탈 <strong>${escapeHtml(summary.firstDeath.name)}</strong> ${summary.firstDeath.seconds.toFixed(1)}초`
        : '아군 전원 전투 종료까지 생존';
    const casts = summary.topCaster
        ? `스킬 ${summary.skillCasts}회 · 최다 <strong>${escapeHtml(summary.topCaster.name)}</strong> ${summary.topCaster.value}회`
        : '스킬 사용 0회';
    return `<section class="battle-insight-card">
        <strong class="battle-insight-card__title">📝 전투 복기</strong>
        <div class="battle-insight-card__stats">
            ${statLine('⚔️', '피해', summary.damage)}
            ${statLine('🛡️', '버팀', summary.tank)}
            ${statLine('💚', '회복', summary.heal)}
            <span>⏱️ ${firstDeath}</span>
            <span>✨ ${casts}</span>
        </div>
        <p>${escapeHtml(summary.observation)}</p>
    </section>`;
}

export function getLikelyTargetIndex(playerBoardIndex, enemyBoard = []) {
    const source = Math.max(0, Math.min(23, Math.floor(clampNumber(playerBoardIndex)))) + 24;
    let best = null;
    let bestDistance = Infinity;
    enemyBoard.forEach((unit, index) => {
        if (!unit) return;
        const distance = getGridDistance(source, index);
        if (distance < bestDistance) {
            best = index;
            bestDistance = distance;
        }
    });
    return best;
}

export function getGridDistance(firstIndex, secondIndex) {
    const dx = Math.abs((firstIndex % 8) - (secondIndex % 8));
    const dy = Math.abs(Math.floor(firstIndex / 8) - Math.floor(secondIndex / 8));
    return Math.max(dx, dy);
}

export function getIncomingThreatCount(playerBoardIndex, playerBoard = [], enemyBoard = []) {
    const selected = playerBoardIndex + 24;
    return enemyBoard.reduce((count, enemy, enemyIndex) => {
        if (!enemy) return count;
        const target = playerBoard
            .map((unit, index) => unit ? index + 24 : null)
            .filter(index => index !== null)
            .sort((a, b) => getGridDistance(enemyIndex, a) - getGridDistance(enemyIndex, b) || a - b)[0];
        return count + (target === selected ? 1 : 0);
    }, 0);
}

export function getThreatAreaIndices(centerIndex, radius = 0) {
    if (!Number.isInteger(centerIndex) || centerIndex < 0 || centerIndex >= 24) return [];
    const safeRadius = Math.max(0, Math.floor(clampNumber(radius)));
    const cx = centerIndex % 8;
    const cy = Math.floor(centerIndex / 8);
    const result = [];
    for (let index = 0; index < 24; index++) {
        const x = index % 8;
        const y = Math.floor(index / 8);
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= safeRadius) result.push(index);
    }
    return result;
}

export function getNextContextTip(state, synergyData, synergyDefinitions, seenIds = []) {
    const seen = new Set(Array.isArray(seenIds) ? seenIds : []);
    const battles = state?.recentBattleResults || [];
    const candidates = [];

    if (battles.some(result => result?.result === 'enemy')) {
        candidates.push({ id: 'first-loss', text: '방금 패배는 좋은 정보예요. 전투 통계의 「전투 복기」에서 첫 이탈 유닛과 피해 1위를 확인해 배치를 바꿔 보세요.' });
    }
    if ((state?.augments?.length || 0) > 0) {
        candidates.push({ id: 'first-augment', text: '생기부 특기사항은 덱의 방향을 크게 바꿉니다. 왼쪽 패널에서 현재 효과를 다시 확인할 수 있어요.' });
    }

    const oneStarCounts = new Map();
    [...(state?.board || []), ...(state?.bench || [])].filter(Boolean).forEach(unit => {
        if ((unit.star || 1) !== 1) return;
        oneStarCounts.set(unit.id, (oneStarCounts.get(unit.id) || 0) + 1);
    });
    const pairId = [...oneStarCounts.entries()].find(([, count]) => count === 2)?.[0];
    if (pairId) {
        const unit = [...(state?.board || []), ...(state?.bench || [])].find(candidate => candidate?.id === pairId);
        candidates.push({ id: 'two-copies', text: `${unit?.name || '같은 학생'} 1명만 더 모으면 자동으로 2성이 됩니다. 상점 잠금도 활용해 보세요.` });
    }

    for (const category of ['subjects', 'clubs']) {
        const counts = synergyData?.[category] || {};
        const definitions = synergyDefinitions?.[category] || {};
        for (const [name, count] of Object.entries(counts)) {
            if (count <= 0 || !definitions[name]) continue;
            const nextLevel = Object.keys(definitions[name].levels || {})
                .map(Number)
                .sort((a, b) => a - b)
                .find(level => level > count);
            if (nextLevel - count === 1) {
                candidates.push({ id: 'one-short-synergy', text: `${name} 학생 1명만 더 배치하면 ${nextLevel}${name} 효과가 활성화됩니다.` });
                break;
            }
        }
        if (candidates.some(candidate => candidate.id === 'one-short-synergy')) break;
    }

    if (battles.length > 0 && clampNumber(state?.gold) >= 10) {
        candidates.push({ id: 'interest', text: '10골드마다 이자가 1골드씩 붙습니다. 하단의 승리·패배 예상 수입을 보고 쓸 돈과 모을 돈을 정해 보세요.' });
    }
    const hasItem = (state?.inventory || []).some(Boolean);
    const equipTarget = (state?.board || []).find(unit => unit && (unit.items?.length || 0) < 3);
    if (battles.length > 0 && hasItem && equipTarget) {
        candidates.push({ id: 'unequipped-item', text: `아이템을 ${equipTarget.name || '학생'}에게 장착할 수 있습니다. 학생 한 명은 아이템을 최대 3개까지 장착해요.` });
    }

    return candidates.find(candidate => !seen.has(candidate.id)) || null;
}
