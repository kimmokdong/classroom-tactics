let gold = 10;
let lossStreak = 0;

function getStreakBonus(count) {
    if (count >= 6) return 3;
    if (count >= 5) return 2;
    if (count >= 2) return 1;
    return 0;
}

for (let i = 1; i <= 20; i++) {
    let interest = Math.floor(gold / 10);
    if (interest > 5) interest = 5;
    
    lossStreak++;
    let streakBonus = getStreakBonus(lossStreak);
    
    let baseGold = 5;
    gold += baseGold + interest + streakBonus;
    
    console.log(`Round ${i} ended. Gold: ${gold}`);
}
