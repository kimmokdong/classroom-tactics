import { SkillPreviewer } from '../js/ui/SkillPreviewer.js';

// Mock browser globals
global.requestAnimationFrame = (callback) => {
    return setTimeout(() => callback(performance.now()), 16);
};
global.cancelAnimationFrame = (id) => {
    clearTimeout(id);
};

// Mock Canvas 2D Context
class MockCanvasContext {
    constructor() {
        this.fillStyle = '';
        this.strokeStyle = '';
        this.lineWidth = 0;
        this.font = '';
        this.textAlign = '';
        this.textBaseline = '';
        this.globalAlpha = 1.0;
        this.shadowColor = '';
        this.shadowBlur = 0;
    }
    fillRect() {}
    strokeRect() {}
    beginPath() {}
    moveTo() {}
    lineTo() {}
    stroke() {}
    fill() {}
    arc() {}
    ellipse() {}
    translate() {}
    rotate() {}
    scale() {}
    save() {}
    restore() {}
    fillText() {}
    roundRect() {}
    closePath() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    createRadialGradient() {
        return {
            addColorStop() {}
        };
    }
    createLinearGradient() {
        return {
            addColorStop() {}
        };
    }
    setLineDash() {}
}

const mockCanvas = {
    width: 640,
    height: 340,
    getContext() {
        return new MockCanvasContext();
    }
};

const mockUnit = {
    id: 'u4_4',
    name: '논술의 신',
    icon: '✍️',
    stats: {
        hp: 900,
        mana: 0,
        maxMana: 80,
        ad: 90,
        ap: 100,
        armor: 40,
        mr: 30,
        as: 0.8,
        range: 1
    },
    skill: {
        name: '필살의 논리',
        desc: '단일 대상 강력한 마법 피해',
        type: 'single_damage',
        vfx: 'slam_yellow',
        apRatio: [8.0, 12.0, 20.0]
    }
};

console.log("Starting SkillPreviewer simulation for u4_3...");
const previewer = new SkillPreviewer();

try {
    previewer.start(mockCanvas, mockUnit);
    
    // Simulate multiple frames synchronously by calling update/draw directly
    for (let frame = 0; frame < 500; frame++) {
        previewer.update(0.016);
        previewer.draw();
    }
    console.log("u4_3 simulation finished without errors!");
    // Wait a bit to see if background ticks crash
    setTimeout(() => {
        previewer.stop();
        process.exit(0);
    }, 1000);
} catch (error) {
    console.error("CRITICAL ERROR during simulation:", error);
    process.exit(1);
}
