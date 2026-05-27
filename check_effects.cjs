const fs = require('fs');
const code = fs.readFileSync('js/items.js', 'utf8');
const regex = /id: "(comb_[^"]+)", name: "([^"]+)"[^}]+?effect: "([^"]+)"/g;
let match;
const effects = [];
while((match = regex.exec(code)) !== null) {
    effects.push({ id: match[1], name: match[2], effect: match[3] });
}
console.log(JSON.stringify(effects, null, 2));
