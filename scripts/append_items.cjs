const fs = require('fs');
const artifact = fs.readFileSync('C:\\Users\\hyunseung\\.gemini\\antigravity-ide\\brain\\5f292bd6-e0f9-4fdf-bdcd-3d09941f1092\\item_mechanics_review.md', 'utf8');

// Strip the # title from the artifact to blend it better
const lines = artifact.split('\n').slice(2).join('\n');

const contentToAppend = `\n---\n\n## 8. 🎒 완성 아이템 시스템 및 효과 메커니즘\n\n` + lines;

fs.appendFileSync('게임정보.md', contentToAppend, 'utf8');
console.log('Appended items to 게임정보.md');
