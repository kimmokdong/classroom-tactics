const fs = require('fs');
const files = [
    'js/systems/AugmentManager.js',
    'js/systems/ItemManager.js',
    'js/systems/ShopManager.js',
    'js/systems/StageManager.js',
    'js/systems/SynergyManager.js',
    'js/systems/UnitManager.js',
    'js/ui/BoardRenderer.js',
    'js/ui/GuideRenderer.js',
    'js/ui/HudRenderer.js',
    'js/ui/ModalManager.js',
    'js/ui/TooltipManager.js',
    'js/battle/DpsTracker.js',
    'js/battle/FxRenderer.js',
    'js/battle/FxSystem.js',
    'js/battle/SkillEngine.js',
    'js/main.js'
];
files.forEach(f => {
    if (fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf8');
        // look for literal backslash followed by backtick
        if (content.includes('\\`')) {
            console.log(f + ' contains escaped backticks!');
            content = content.split('\\`').join('`');
            fs.writeFileSync(f, content, 'utf8');
        }
    }
});
console.log('Done.');
