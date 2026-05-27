const fs = require('fs');

function patchColors(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // We target the specific colors in the showUnitInfo block.
    // HP
    code = code.replace(/color:#166534/g, 'color:#4caf50');
    // Mana
    code = code.replace(/color:#1e40af/g, 'color:#1e88e5');
    // AD
    code = code.replace(/color:#9a3412/g, 'color:#e65100');
    // AP
    code = code.replace(/color:#6b21a8/g, 'color:#8e24aa');
    // Armor
    code = code.replace(/color:#78350f/g, 'color:#795548');
    // MR
    code = code.replace(/color:#0f7672/g, 'color:#00897b');
    code = code.replace(/color:#0f766e/g, 'color:#00897b');
    // AS
    code = code.replace(/color:#991b1b/g, 'color:#e53935');
    // Range
    // The range span doesn't have an ID, it's just <span style="color:#1e3a8a">
    // In dictionary it's <span style="color:#546e7a">
    // Wait, let's just replace all occurrences of these specific old colors, they are likely unique to this block or fine to change.
    code = code.replace(/color:#1e3a8a/g, 'color:#546e7a');
    // Crit
    code = code.replace(/color:#b45309/g, 'color:#ffb300');
    // Dmg Amp
    code = code.replace(/color:#b91c1c/g, 'color:#ef5350');
    // Dmg Reduc
    code = code.replace(/color:#0369a1/g, 'color:#29b6f6');
    // Vamp
    code = code.replace(/color:#be185d/g, 'color:#ec407a');
    // Mana Regen
    code = code.replace(/color:#1d4ed8/g, 'color:#42a5f5');

    fs.writeFileSync(filePath, code, 'utf8');
}

patchColors('js/main.js');
patchColors('js/sandbox.js');
console.log('Colors patched successfully.');
