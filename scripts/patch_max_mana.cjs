const fs = require('fs');

function patchMaxManaColor(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // The max mana span: <span style="color:#6b7280; font-size:0.75rem;">/${unit.stats.maxMana || unit.stats.mana}</span>
    // In sandbox it is <span style="color:#6b7280; font-size:0.75rem;">/<span id="info-max-mana">...
    
    code = code.replace(/<span style="color:#6b7280;(.*? maxMana .*?)>/g, '<span style="color:#1e88e5;$1>');
    code = code.replace(/<span style="color:#6b7280;(.*? max-mana .*?)>/g, '<span style="color:#1e88e5;$1>');
    // Let's do it safely
    code = code.replace(
        /<span style="color:#6b7280; font-size:0\.75rem;">\/\$\{unit\.stats\.maxMana/g,
        '<span style="color:#1e88e5; font-size:0.75rem;">/${unit.stats.maxMana'
    );
    code = code.replace(
        /<span style="color:#6b7280; font-size:0\.75rem;">\/<span id="info-max-mana">/g,
        '<span style="color:#1e88e5; font-size:0.75rem;">/<span id="info-max-mana">'
    );

    // Let's also do maxHP just in case they want it to match
    code = code.replace(
        /<span style="color:#6b7280; font-size:0\.75rem;">\/\$\{unit\.stats\.maxHp/g,
        '<span style="color:#4caf50; font-size:0.75rem;">/${unit.stats.maxHp'
    );
    code = code.replace(
        /<span style="color:#6b7280; font-size:0\.75rem;">\/<span id="info-max-hp">/g,
        '<span style="color:#4caf50; font-size:0.75rem;">/<span id="info-max-hp">'
    );

    fs.writeFileSync(filePath, code, 'utf8');
}

patchMaxManaColor('js/main.js');
patchMaxManaColor('js/sandbox.js');
console.log('Max Mana/HP colors patched.');
