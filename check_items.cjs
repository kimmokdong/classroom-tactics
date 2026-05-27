const fs = require('fs');
const battleEngine = fs.readFileSync('js/battleEngine.js', 'utf8');
const mainJs = fs.readFileSync('js/main.js', 'utf8');

const items = [
  'giantSlayer', 'gunbladeHeal', 'shojin', 'edgeOfNight', 'bloodthirsterShield', 
  'steraks', 'skillCrit', 'rfc', 'guinsoo', 'statikk', 'titans', 'runaans', 
  'zzrot', 'lastWhisper', 'rabadon', 'archangel', 'locket', 'ionic', 'morello', 
  'blueBuff', 'protectorsVow', 'chalice', 'redemption', 'hoj', 'bramble', 
  'gargoyle', 'sunfire', 'shroud', 'dclaw', 'zephyr', 'qss', 'warmog', 
  'guardbreaker', 'thievesGloves'
];

items.forEach(item => {
  const inBattle = battleEngine.includes(item);
  const inMain = mainJs.includes(item);
  console.log(`${item} : ${inBattle || inMain ? 'YES' : 'NO'}`);
});
