import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static admin files
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// 1. GET /api/decks (현재는 standard_decks.md 기준)
app.get('/api/decks', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'standard_decks.md');
        if (!fs.existsSync(filePath)) {
            return res.json({ content: '' });
        }
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ content });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. POST /api/decks
app.post('/api/decks', (req, res) => {
    try {
        const { content } = req.body;
        const filePath = path.join(__dirname, 'standard_decks.md');
        fs.writeFileSync(filePath, content, 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. POST /api/simulate
app.post('/api/simulate', (req, res) => {
    // 백그라운드로 시뮬레이션 실행 (결과는 파일로 남음)
    exec('node run_simulation_v2.js', (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: error.message, stderr });
        }
        res.json({ success: true, output: stdout });
    });
});

// 4. GET /api/reports
app.get('/api/reports', (req, res) => {
    try {
        const files = fs.readdirSync(__dirname);
        const reportFiles = files.filter(f => f.startsWith('simulation_report') && f.endsWith('.md'));
        res.json({ reports: reportFiles });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. POST /api/compare
app.post('/api/compare', (req, res) => {
    const { reportA, reportB } = req.body;
    try {
        const contentA = fs.readFileSync(path.join(__dirname, reportA), 'utf8');
        const contentB = fs.readFileSync(path.join(__dirname, reportB), 'utf8');

        function parseReport(content) {
            const lines = content.split('\n');
            const data = {};
            let currentMode = '';
            for (const line of lines) {
                if (line.includes('## 🥇 Lv.')) currentMode = line;
                else if (line.includes('## 🏆 무제한급')) currentMode = '무제한급';
                
                if (currentMode === '무제한급' && line.includes('| 🏆')) {
                    const parts = line.split('|').map(s => s.trim());
                    if (parts.length >= 5) {
                        const winRateStr = parts[2].replace(/\*/g, '').replace('%', '');
                        const winRate = parseFloat(winRateStr);
                        const deckName = parts[3];
                        data[deckName] = winRate;
                    }
                }
            }
            return data;
        }

        const dataA = parseReport(contentA);
        const dataB = parseReport(contentB);

        const diffs = [];
        for (const deckName in dataB) {
            if (dataA[deckName] !== undefined) {
                const oldVal = dataA[deckName];
                const newVal = dataB[deckName];
                const diff = newVal - oldVal;
                diffs.push({ deckName, oldVal, newVal, diff });
            }
        }
        diffs.sort((a, b) => b.diff - a.diff);
        res.json({ success: true, diffs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Admin Server running on http://localhost:${PORT}/admin`);
});
