const fs = require('fs');

const lvl8 = JSON.parse(fs.readFileSync('./js/meta_decks.json', 'utf-8'));
const lvl9 = JSON.parse(fs.readFileSync('./js/meta_decks_lvl9.json', 'utf-8'));

function getDeckComposition(decks, name) {
    const deck = decks.find(d => d.name === name);
    if (!deck) return "Not found";
    return deck.units.join(', ') + ' (Value: ' + deck.goldValue + 'G)';
}

console.log("=== 급격히 하락한 덱 (8L 강세) ===");
console.log("장난꾸러기6_미술2 (8L):", getDeckComposition(lvl8, "장난꾸러기6_미술2"));
console.log("장난꾸러기6_미술2 (9L):", getDeckComposition(lvl9, "장난꾸러기6_미술2"));
console.log("수학4_방송부5 (8L):", getDeckComposition(lvl8, "수학4_방송부5"));
console.log("수학4_방송부5 (9L):", getDeckComposition(lvl9, "수학4_방송부5"));

console.log("\n=== 급격히 상승한 덱 (9L 강세) ===");
console.log("수학4_선도부4 (8L):", getDeckComposition(lvl8, "수학4_선도부4"));
console.log("수학4_선도부4 (9L):", getDeckComposition(lvl9, "수학4_선도부4"));
console.log("도덕6_보건부2 (8L):", getDeckComposition(lvl8, "도덕6_보건부2"));
console.log("도덕6_보건부2 (9L):", getDeckComposition(lvl9, "도덕6_보건부2"));
