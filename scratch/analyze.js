import path from 'path';
import fs from 'fs';

async function run() {
    const dataPath = path.join(process.cwd(), 'js', 'data.js');
    const data = await import('file://' + dataPath.replace(/\\/g, '/'));
    
    const units = data.UNIT_POOL;
    
    let out = '';
    units.forEach(u => {
        const sub = Array.isArray(u.subject) ? u.subject.join(',') : u.subject;
        out += `[${u.tier}코] ${u.name} - ${sub} / ${u.club}\n`;
    });
    
    fs.writeFileSync('scratch/units_dump.txt', out);
}
run();
