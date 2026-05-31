/**
 * FxRenderer - 파티클 Canvas 2D 드로잉 시스템
 * BattleRenderer.animate() 내부의 파티클 타입별 렌더링 로직
 */
export class FxRenderer {
    constructor(fxSystem) {
        this.fxSystem = fxSystem;
    }

    /**
     * 단일 파티클을 Canvas에 그리기
     * @param {Object} p - 파티클 객체
     * @param {CanvasRenderingContext2D} ctx - Canvas 컨텍스트
     * @param {HTMLCanvasElement} fxCanvas - Canvas 요소 (크기 참조용)
     */
    renderParticle(p, ctx, fxCanvas) {
        const TAU = Math.PI * 2;
        const R = (a, b) => Math.random() * (b - a) + a;
        const lerp = (a, b, t) => a + (b - a) * t;

        if (p.type === 'low_aoe_ring') {
            const pct = 1 - p.life / p.maxLife;
            const r = p.r + (p.maxR - p.r) * pct;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = p.color || '#ff6633';
            ctx.lineWidth = (1 - pct) * 4 + 1;
            ctx.stroke();

            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, (p.color || '#ff6633') + '22');
            g.addColorStop(1, (p.color || '#ff6633') + '00');
            ctx.fillStyle = g;
            ctx.fill();
        } else if (p.type === 'low_self_buff') {
            const pct = 1 - p.life / p.maxLife;
            const r = p.r + (p.maxR - p.r) * pct;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = p.color || '#ffcc00';
            ctx.lineWidth = (1 - pct) * 3 + 1;
            ctx.stroke();
        } else if (p.type === 'low_dash') {
            p.t = Math.min(p.t + 0.02, 1);
            const cx = p.x + (p.tx - p.x) * p.t;
            const cy = p.y + (p.ty - p.y) * p.t;
            p.trail.push({ x: cx, y: cy });
            if (p.trail.length > 6) p.trail.shift();

            p.trail.forEach((pt, i) => {
                const alpha = (i / p.trail.length) * (p.life / p.maxLife);
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 4 * (i / p.trail.length), 0, Math.PI * 2);
                ctx.fillStyle = p.color + Math.floor(alpha * 200).toString(16).padStart(2, '0');
                ctx.fill();
            });
            if (p.t >= 1 && !p.done) {
                p.done = true;
                p.life = 0; // complete immediately on landing
                this.fxSystem.spawnFx('low_hit', p.tx, p.ty, { color: p.color, life: 1.5 });
            }
        } else if (p.type === 'low_hit') {
            const pct = 1 - p.life / p.maxLife;
            const r = 28 * pct;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = (1 - pct) * 2 + 0.5;
            ctx.stroke();

            if (!p.sparks) {
                p.sparks = Array.from({ length: 8 }, () => {
                    const a = Math.random() * Math.PI * 2;
                    const s = Math.random() * 3 + 1;
                    return { x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, l: Math.random() * 0.5 + 0.5 };
                });
            }
            p.sparks.forEach(s => {
                s.x += s.vx; s.y += s.vy; s.vy += 0.03; s.l -= 0.006;
                if (s.l > 0) {
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, 2 * s.l, 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    ctx.fill();
                }
            });
        } else if (p.type === 'low_magic_hit') {
            const pct = 1 - p.life / p.maxLife;
            const r = 24 * pct;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            for (let i = 0; i < 6; i++) {
                const a = i / 6 * Math.PI * 2 + pct * 2;
                const px = p.x + Math.cos(a) * (r * 0.8);
                const py = p.y + Math.sin(a) * (r * 0.8);
                ctx.beginPath();
                ctx.arc(px, py, 2 * (p.life / p.maxLife), 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            }
        } else if (p.type === 'low_projectile') {
            p.t = Math.min(p.t + 0.012, 1);
            const cx = p.x + (p.tx - p.x) * p.t;
            const cy = p.y + (p.ty - p.y) * p.t;
            ctx.beginPath();
            ctx.arc(cx, cy, p.size || 4, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, p.size || 4);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(1, p.color);
            ctx.fillStyle = g;
            ctx.fill();

            if (p.t >= 1) {
                p.life = 0;
                this.fxSystem.spawnFx(p.hitType || 'low_magic_hit', p.tx, p.ty, { color: p.color, life: 1.5, targets: p.targets });
            }
        } else if (p.type === 'low_bounce') {
            if (p.seg >= p.pts.length - 1) {
                p.life = 0;
            } else {
                p.t = Math.min(p.t + 0.015, 1);
                const sx = p.pts[p.seg].x;
                const sy = p.pts[p.seg].y;
                const ex = p.pts[p.seg + 1].x;
                const ey = p.pts[p.seg + 1].y;
                const cx = sx + (ex - sx) * p.t;
                const cy = sy + (ey - sy) * p.t;

                ctx.beginPath();
                ctx.arc(cx, cy, 4, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(cx, cy, 2, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();

                if (p.t >= 1) {
                    this.fxSystem.spawnFx('low_magic_hit', ex, ey, { color: p.color, life: 1.5 });
                    p.seg++;
                    p.t = 0;
                }
                p.life = 1.0; // keep alive
            }
        } else if (p.type === 'low_heal') {
            if (!p.particles) {
                p.particles = Array.from({ length: p.count || 8 }, () => ({
                    x: p.x + (Math.random() * 30 - 15),
                    y: p.y + (Math.random() * 20 - 5),
                    vy: -(Math.random() * 0.5 + 0.2),
                    l: Math.random() * 0.5 + 0.5,
                    size: Math.random() * 3 + 1.5
                }));
            }
            p.particles.forEach(pt => {
                pt.y += pt.vy;
                pt.l -= 0.003;
                if (pt.l > 0) {
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, pt.size * pt.l, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(46, 204, 113, ${pt.l})`;
                    ctx.fill();
                }
            });
        } else if (p.type === 'low_shield') {
            const pct = 1 - p.life / p.maxLife;
            const r = Math.min(22, 12 + 10 * pct);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = i / 6 * Math.PI * 2 - Math.PI / 6;
                const px = p.x + Math.cos(a) * r;
                const py = p.y + Math.sin(a) * r;
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.strokeStyle = p.color;
            ctx.lineWidth = (1 - pct) * 2 + 0.5;
            ctx.stroke();
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, p.color + '44');
            g.addColorStop(1, p.color + '00');
            ctx.fillStyle = g;
            ctx.fill();
        } else if (p.type === 'low_taunt') {
            const pct = 1 - p.life / p.maxLife;
            const r = Math.min(25, 10 + 15 * pct);
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 60, 60, ${p.life / p.maxLife * 0.7})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.font = `bold ${Math.floor(14 * (p.life / p.maxLife) + 4)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = `rgba(255, 80, 80, ${p.life / p.maxLife})`;
        } else if (p.type === 'low_passive') {
            p.y -= 0.25;
            ctx.save();
            // 글씨가 너무 빨리 투명해져서 회색으로 보이는 것을 방지 (끝날 때만 살짝 투명)
            ctx.globalAlpha = Math.min(1.0, (p.life / p.maxLife) * 2.0); 
            ctx.font = '900 15px sans-serif'; // 아주 두껍게 (900)
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 텍스트 외곽선 (흰색 100% 불투명, 두께 3) - 배경과 완벽히 분리
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.strokeText(p.text || '↑', p.x, p.y);
            
            // 텍스트 본체
            ctx.fillStyle = p.color || '#000000';
            ctx.fillText(p.text || '↑', p.x, p.y);
            
            ctx.restore();
        } else if (p.type === 'low_debuff') {
            if (!p.particles) {
                p.particles = Array.from({ length: p.count || 8 }, () => ({
                    x: p.x + (Math.random() * 30 - 15),
                    y: p.y - (Math.random() * 15 + 5),
                    vy: (Math.random() * 0.3 + 0.15),
                    l: Math.random() * 0.5 + 0.5,
                    size: Math.random() * 2.5 + 1.5
                }));
            }
            p.particles.forEach(pt => {
                pt.y += pt.vy;
                pt.l -= 0.005;
                if (pt.l > 0) {
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, pt.size * pt.l, 0, Math.PI * 2);
                    ctx.fillStyle = p.color || '#cc44ff';
                    ctx.fill();
                }
            });
        } else if (p.type === 'low_lifesteal') {
            p.t = Math.min(p.t + 0.01, 1);
            const cx = p.x + (p.tx - p.x) * p.t;
            const cy = p.y + (p.ty - p.y) * p.t;
            ctx.beginPath();
            ctx.arc(cx, cy, 4 * (1 - p.t * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 60, 60, ${1 - p.t * 0.3})`;
            ctx.fill();
        } else if (p.type === 'low_mana_burn') {
            if (!p.particles) {
                p.particles = Array.from({ length: 12 }, () => {
                    const a = Math.random() * Math.PI * 2;
                    const s = Math.random() * 1.5 + 0.5;
                    return {
                        x: p.x + (Math.random() * 10 - 5),
                        y: p.y + (Math.random() * 10 - 5),
                        vx: Math.cos(a) * s,
                        vy: Math.sin(a) * s - 1,
                        l: Math.random() * 0.5 + 0.4,
                        size: Math.random() * 3 + 1.5
                    };
                });
            }
            p.particles.forEach(pt => {
                pt.x += pt.vx; pt.y += pt.vy; pt.vy -= 0.008; pt.l -= 0.005;
                if (pt.l > 0) {
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, pt.size * pt.l, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(60, 120, 255, ${pt.l})`;
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, pt.size * pt.l * 0.4, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(180, 220, 255, ${pt.l})`;
                    ctx.fill();
                }
            });
        } else if (p.type === 'low_mana_buff') {
            if (!p.particles) {
                p.particles = Array.from({ length: 6 }, () => ({
                    x: p.x + (Math.random() * 20 - 10),
                    y: p.y + (Math.random() * 10 - 5),
                    vy: -(Math.random() * 0.4 + 0.15),
                    l: Math.random() * 0.5 + 0.5,
                    size: Math.random() * 3 + 1.5
                }));
            }
            p.particles.forEach(pt => {
                pt.y += pt.vy;
                pt.l -= 0.003;
                if (pt.l > 0) {
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, pt.size * pt.l, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(80, 160, 255, ${pt.l})`;
                    ctx.fill();
                }
            });
        } else if (p.type === 'single_hit') {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle || 0);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 4 * (p.life / p.maxLife);
            ctx.beginPath();
            ctx.moveTo(-p.size, -p.size);
            ctx.lineTo(p.size, p.size);
            ctx.moveTo(p.size, -p.size);
            ctx.lineTo(-p.size, p.size);
            ctx.stroke();
        } else if (p.type === 'projectile') {
            p.x += p.vx;
            p.y += p.vy;

            if (p.targetX !== null && p.targetY !== null) {
                const distSq = Math.pow(p.targetX - p.x, 2) + Math.pow(p.targetY - p.y, 2);
                if (distSq < Math.pow(Math.max(Math.abs(p.vx), Math.abs(p.vy)) + p.size, 2)) {
                    p.life = 0;
                    if (p.isGlobalNuke) {
                        this.fxSystem.renderer.screenFlash = 0.5;
                        this.fxSystem.spawnFx('aoe_ripple', p.targetX, p.targetY, { life: 0.8, color: p.color, size: 150 });
                        this.fxSystem.spawnFx('single_hit', p.targetX, p.targetY, { life: 0.5, color: '#ffffff', size: 60 });
                    }
                }
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();

            // Add a small glow effect
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / p.maxLife * 0.3;
            ctx.fill();
        } else if (p.type === 'aoe_ripple') {
            const radius = p.size * (1 - p.life / p.maxLife);
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 4;
            ctx.stroke();
        } else if (p.type === 'heal_particle') {
            p.y -= 1;
            ctx.fillStyle = p.color;
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('+', p.x, p.y);
        } else if (p.type === 'beam') {
            // Outer glow
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.targetX, p.targetY);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Inner bright core
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.targetX, p.targetY);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = p.size * 0.3;
            ctx.stroke();
        } else if (p.type === 'lightning') {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            const steps = 4;
            for (let j = 1; j < steps; j++) {
                const tx = p.x + (p.targetX - p.x) * (j / steps) + (Math.random() * 20 - 10);
                const ty = p.y + (p.targetY - p.y) * (j / steps) + (Math.random() * 20 - 10);
                ctx.lineTo(tx, ty);
            }
            ctx.lineTo(p.targetX, p.targetY);
            ctx.strokeStyle = p.color || '#3498db';
            ctx.lineWidth = 3;
            ctx.stroke();
        } else if (p.type === 'bramble') {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.life * 10);
            ctx.beginPath();
            for (let j = 0; j < 8; j++) {
                ctx.moveTo(0, 0);
                ctx.lineTo(p.size * (Math.random() * 0.5 + 0.5), 0);
                ctx.rotate(Math.PI / 4);
            }
            ctx.strokeStyle = p.color || '#e74c3c';
            ctx.lineWidth = 3;
            ctx.stroke();
        } else if (p.type === 'beaker') {
            p.x += p.vx;
            p.y += p.vy;
            if (p.targetX !== null && p.targetY !== null) {
                const distSq = Math.pow(p.targetX - p.x, 2) + Math.pow(p.targetY - p.y, 2);
                if (distSq < Math.pow(Math.max(Math.abs(p.vx), Math.abs(p.vy)) + p.size, 2)) {
                    p.life = 0;
                    this.fxSystem.spawnFx('beaker_splash', p.targetX, p.targetY, { life: 1.0 });
                }
            }
            ctx.translate(p.x, p.y);
            ctx.rotate(p.life * 15);
            ctx.fillStyle = 'rgba(46, 204, 113, 0.8)';
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(-p.size / 2, -p.size * 1.5, p.size, p.size);
        } else if (p.type === 'beaker_splash') {
            ctx.translate(p.x, p.y);
            const alpha = Math.max(0, p.life / p.maxLife);
            const w = fxCanvas.width || 800;
            const h = fxCanvas.height || 600;

            // Thick filled + shape spanning the whole board
            ctx.fillStyle = `rgba(39, 174, 96, ${0.8 * alpha})`;
            // vertical (from top edge of canvas to bottom edge)
            ctx.fillRect(-50, -p.y, 100, h);
            // horizontal (from left edge of canvas to right edge)
            ctx.fillRect(-p.x, -50, w, 100);
        } else if (p.type === 'ground_slam') {
            const radius = p.size * (1 - Math.pow(p.life / p.maxLife, 2));
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 10 * (p.life / p.maxLife);
            ctx.stroke();

            // Cracks
            ctx.translate(p.x, p.y);
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                ctx.moveTo(0, 0);
                ctx.lineTo(radius * 0.8, 0);
                ctx.rotate(Math.PI * 2 / 5);
            }
            ctx.strokeStyle = '#8e44ad';
            ctx.lineWidth = 3;
            ctx.stroke();
        } else if (p.type === 'judge_pen') {
            const scale = p.life / p.maxLife;
            ctx.translate(p.x, p.y - 100 * scale); // falls down
            if (scale < 0.2) ctx.translate(Math.random() * 10 - 5, Math.random() * 10 - 5);
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 15;
            ctx.beginPath();
            ctx.moveTo(-30, -30);
            ctx.lineTo(30, 30);
            ctx.moveTo(30, -30);
            ctx.lineTo(-30, 30);
            ctx.stroke();
        } else if (p.type === 'mega_shield') {
            const radius = 200 * (1 - p.life / p.maxLife);
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.8)';
            ctx.lineWidth = 20 * (p.life / p.maxLife);
            ctx.stroke();
        } else if (p.type === 'shield_buff') {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 40, Math.PI, Math.PI * 2);
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.9)';
            ctx.lineWidth = 5;
            ctx.stroke();
        } else if (p.type === 'holy_heal') {
            ctx.translate(p.x, p.y);
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.7)';
            ctx.lineWidth = 40;
            ctx.beginPath();
            ctx.moveTo(0, -150); ctx.lineTo(0, 150);
            ctx.moveTo(-150, 0); ctx.lineTo(150, 0);
            ctx.stroke();
        } else if (p.type === 'heal_sparkle') {
            ctx.translate(p.x, p.y - (1 - p.life / p.maxLife) * 30);
            ctx.strokeStyle = `rgba(46, 204, 113, ${Math.max(0, p.life / p.maxLife)})`;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(0, -20); ctx.lineTo(0, 20);
            ctx.moveTo(-20, 0); ctx.lineTo(20, 0);
            ctx.stroke();
        } else if (p.type === 'piano_wave') {
            const radius = 300 * (1 - p.life / p.maxLife);
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(155, 89, 182, 0.5)';
            ctx.lineWidth = 15;
            ctx.stroke();

            ctx.translate(p.x + radius * Math.cos(p.life * 10), p.y + radius * Math.sin(p.life * 10));
            ctx.fillStyle = '#8e44ad';
            ctx.beginPath();
            ctx.arc(0, 5, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(4, -15, 3, 20);
        } else if (p.type === 'data_aura') {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.life * 5);
            ctx.font = 'bold 30px monospace';
            ctx.fillStyle = '#2ecc71';
            for (let i = 0; i < 8; i++) {
                ctx.fillText(Math.random() > 0.5 ? '1' : '0', 60, 0);
                ctx.rotate(Math.PI / 4);
            }
        } else if (p.type === 'silence_drop') {
            const scale = Math.pow(p.life / p.maxLife, 3);
            ctx.translate(p.x, p.y - 300 * scale);
            ctx.scale(1 + scale * 2, 1 + scale * 2);
            ctx.font = 'bold 80px sans-serif';
            ctx.fillStyle = '#34495e';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('조용!', 0, 0);

            if (scale < 0.05 && !p.shook) {
                p.shook = true;
                this.fxSystem.renderer.screenFlash = 0.5;
            }
        } else if (p.type === 'donation_item_projectile') {
            // 기부천사 패시브 투사체: 포물선 이동 + 꼬리 잔상 + 2D 벡터 아이콘 드로잉
            p.t = Math.min(p.t + 0.02, 1);
            
            // 포물선 궤적 계산
            const cx = p.startX + (p.tx - p.startX) * p.t;
            const cy = p.startY + (p.ty - p.startY) * p.t - Math.sin(p.t * Math.PI) * 45;
            
            // 꼬리 잔상 흔적(trail)
            p.trail.push({ x: cx, y: cy });
            if (p.trail.length > 5) p.trail.shift();
            
            p.trail.forEach((pt, idx) => {
                const alpha = (idx / p.trail.length) * 0.75;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 4.5 * (idx / p.trail.length), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 220, 80, ${alpha})`;
                ctx.fill();
            });
            
            // 회전 회오리 골든 입자 방출 효과
            if (Math.random() > 0.45) {
                this.fxSystem.particles.push({
                    type: 'aug_heal_bomb_spark',
                    x: cx, y: cy,
                    vx: R(-1.2, 1.2), vy: R(-1.2, 1.2),
                    life: R(0.4, 0.9), maxLife: 0.9,
                    size: R(3, 5.5), hue: 50
                });
            }
            
            // 2D 벡터 그래픽 드로잉
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(p.t * Math.PI * 3.8); // 팽이 회전
            
            if (p.icon === 'gift') {
                // 황금 리본 선물 상자
                ctx.strokeStyle = '#ffe066';
                ctx.fillStyle = '#ffaa00';
                ctx.lineWidth = 1.8;
                ctx.fillRect(-7, -4, 14, 11);
                ctx.strokeRect(-7, -4, 14, 11);
                
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(-8.5, -7, 17, 3);
                ctx.strokeRect(-8.5, -7, 17, 3);
                
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.1;
                ctx.beginPath();
                ctx.moveTo(0, -7); ctx.lineTo(0, 7);
                ctx.moveTo(-8.5, 1.5); ctx.lineTo(8.5, 1.5);
                ctx.stroke();
                
                ctx.strokeStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(-3.5, -9.5, 2.5, 0, Math.PI * 2);
                ctx.arc(3.5, -9.5, 2.5, 0, Math.PI * 2);
                ctx.stroke();
            } else if (p.icon === 'sword') {
                // 골든 소드
                ctx.strokeStyle = '#ffe066';
                ctx.fillStyle = '#ffffff';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(0, -11);
                ctx.lineTo(2.5, -3);
                ctx.lineTo(1.2, 5);
                ctx.lineTo(-1.2, 5);
                ctx.lineTo(-2.5, -3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                ctx.strokeStyle = '#d4af37';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.moveTo(-5.5, 5);
                ctx.lineTo(5.5, 5);
                ctx.stroke();
                
                ctx.strokeStyle = '#a0522d';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(0, 5);
                ctx.lineTo(0, 11);
                ctx.stroke();
            } else if (p.icon === 'shield') {
                // 골든 실드
                ctx.strokeStyle = '#ffe066';
                ctx.fillStyle = '#ffb300';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(0, -9);
                ctx.lineTo(7.5, -5);
                ctx.quadraticCurveTo(6.5, 4, 0, 9.5);
                ctx.quadraticCurveTo(-6.5, 4, -7.5, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, -1, 2.2, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.icon === 'stat') {
                // 황금 번개
                ctx.strokeStyle = '#ffe066';
                ctx.fillStyle = '#fff600';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(0, -10.5);
                ctx.lineTo(5.5, -3);
                ctx.lineTo(1.2, -3);
                ctx.lineTo(3.5, 10.5);
                ctx.lineTo(-4.5, 1.5);
                ctx.lineTo(-0.8, 1.5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
            
            if (p.t >= 1) {
                p.life = 0;
                this.fxSystem.spawnFx('donation_confetti_burst', p.tx, p.ty, { color: '#ffea00' });
            }
        } else if (p.type === 'donation_confetti') {
            // 생일 폭죽 효과: 다채로운 컨페티(종이가루) 흩날림 렌더링
            p.parts.forEach(pt => {
                pt.x += pt.vx;
                pt.y += pt.vy;
                pt.vy += 0.085; // 중력 가속도
                pt.rot += pt.rotSpd;
                pt.life -= 0.016;
                
                if (pt.life > 0) {
                    const alpha = Math.max(0, pt.life / pt.maxLife);
                    ctx.save();
                    ctx.translate(pt.x, pt.y);
                    ctx.rotate(pt.rot);
                    ctx.fillStyle = pt.color;
                    ctx.globalAlpha = alpha;
                    
                    // 회전하는 사각형 종이가루 렌더링
                    ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.65);
                    ctx.restore();
                }
            });
        } else if (p.type === 'donation_global_circle') {
            // 기부천사 액티브 맵 전체 광역 다중 금빛 링 마법진
            const pct = 1 - p.life / p.maxLife;
            const r = (p.maxR || 350) * Math.sin(pct * Math.PI / 2);
            const alpha = Math.sin(pct * Math.PI) * 0.7;
            
            ctx.save();
            ctx.strokeStyle = `rgba(255, 235, 120, ${alpha})`;
            ctx.lineWidth = 3.5;
            ctx.shadowColor = '#ffeaa0';
            ctx.shadowBlur = 18;
            
            // 바깥 원
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.stroke();
            
            // 안쪽 원
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 0.76, 0, Math.PI * 2);
            ctx.stroke();
            
            // 회전 점선 원
            ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.65})`;
            ctx.setLineDash([9, 13]);
            ctx.lineWidth = 2.0;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(pct * 2.2);
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            
            ctx.restore();
        } else if (p.type === 'paint_swipe') {
            const w = fxCanvas.width || 800;
            const h = fxCanvas.height || 600;
            const progress = 1 - (p.life / p.maxLife);

            ctx.beginPath();
            ctx.moveTo(-50, h * 0.6);

            // Draw a dynamic bezier curve that sweeps across the screen
            const currentX = -50 + (w + 100) * progress;
            const controlX = currentX / 2;
            const controlY = h * 0.2 + Math.sin(progress * Math.PI) * 200;
            const currentY = h * 0.4 - Math.cos(progress * Math.PI) * 100;

            ctx.quadraticCurveTo(controlX, controlY, currentX, currentY);
            ctx.strokeStyle = `hsla(${(progress * 360 + 120) % 360}, 80%, 60%, ${p.life / p.maxLife})`;
            ctx.lineWidth = 80;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Add some dripping/splatter effects along the stroke
            if (Math.random() > 0.6) {
                this.fxSystem.spawnFx('paint_splatter', currentX, currentY, { life: 0.5 });
            }
        } else if (p.type === 'paint_splatter') {
            if (!p.colorSet) { p.colorSet = `hsl(${Math.random() * 360}, 100%, 50%)`; p.r = Math.random() * Math.PI * 2; }
            ctx.translate(p.x, p.y);
            ctx.rotate(p.r);
            ctx.fillStyle = p.colorSet;
            ctx.beginPath();
            ctx.ellipse(0, 0, 20 + 10 * Math.random(), 10 + 5 * Math.random(), 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'school_blackhole') {
            const TAU = Math.PI * 2;
            const lerp = (a, b, t) => a + (b - a) * t;
            const lifeSpent = p.maxLife - p.life;

            // 블랙홀
            if (p.life > 0.5 && !p.nova) {
                p.r = Math.min(p.r + 0.35, p.maxR);
                p.phase += 0.02;
                const t = (p.life - 0.5) / 3.0;

                // 왜곡 링
                for (let i = 5; i >= 0; i--) {
                    const rr = p.r * (0.4 + i * 0.12);
                    const hue = lerp(280, 200, i / 5);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU);
                    ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${t * (0.5 - i * 0.07)})`;
                    ctx.lineWidth = (5 - i) * 1.2;
                    ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
                    ctx.shadowBlur = 12;
                    ctx.stroke();
                    ctx.restore();
                }
                // 회전 아크
                for (let i = 0; i < 3; i++) {
                    const arcA = p.phase * (1 + i * 0.4) + i * TAU / 3;
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.translate(p.x, p.y);
                    ctx.rotate(arcA);
                    ctx.beginPath(); ctx.arc(0, 0, p.r * 0.65, -0.9, 0.9);
                    ctx.strokeStyle = `hsla(${270 + i * 30}, 100%, 70%, ${t * 0.7})`;
                    ctx.lineWidth = 2.5;
                    ctx.shadowBlur = 8;
                    ctx.stroke();
                    ctx.restore();
                }
                // 코어
                const cg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 0.4);
                cg.addColorStop(0, 'rgba(0,0,0,1)');
                cg.addColorStop(1, 'rgba(30,0,60,0)');
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.4, 0, TAU);
                ctx.fillStyle = cg;
                ctx.fill();
            }

            // 폭발 (Nova) 발생 조건
            if (p.life <= 0.5 && !p.nova) {
                p.nova = { r: 0, life: 2.0, maxLife: 2.0 };
                this.fxSystem.renderer.screenFlash = 0.8;
                // 기존 debris 폭발 모드로 변경
                p.debris.forEach(d => {
                    const a = Math.random() * TAU, spd = Math.random() * 9 + 3;
                    d.dist = 0; d.exploding = true;
                    d.vx = Math.cos(a) * spd; d.vy = Math.sin(a) * spd;
                    d.life = Math.random() * 1.0 + 0.8; d.maxLife = 1.8;
                });
            }

            // Nova 렌더링
            if (p.nova) {
                p.nova.r = lerp(p.nova.r, 130, 0.12);
                p.nova.life -= 0.006;
                const t = Math.max(0, p.nova.life / p.nova.maxLife);
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const ng = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.nova.r);
                ng.addColorStop(0, `rgba(255,255,200,${t * 0.9})`);
                ng.addColorStop(0.3, `rgba(200,100,255,${t * 0.6})`);
                ng.addColorStop(0.7, `rgba(80,0,160,${t * 0.3})`);
                ng.addColorStop(1, `rgba(0,0,0,0)`);
                ctx.beginPath(); ctx.arc(p.x, p.y, p.nova.r, 0, TAU);
                ctx.fillStyle = ng; ctx.fill();
                ctx.restore();
            }

            // 파편 (Debris)
            for (const d of p.debris) {
                if (d.exploding) {
                    d.x += d.vx; d.y += d.vy; d.vy += 0.1; d.life -= 0.006;
                    const t = Math.max(0, d.life / d.maxLife);
                    if (t > 0) {
                        ctx.beginPath(); ctx.arc(d.x, d.y, d.size * t, 0, TAU);
                        ctx.fillStyle = `hsla(${d.hue}, 100%, 70%, ${t})`; ctx.fill();
                    }
                } else {
                    d.angle += d.orbitSpd; d.dist = Math.max(0, d.dist - d.inSpd);
                    d.x = p.x + Math.cos(d.angle) * d.dist;
                    d.y = p.y + Math.sin(d.angle) * d.dist;
                    d.life -= 0.005;
                    const t = Math.max(0, d.life / d.maxLife);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.beginPath(); ctx.arc(d.x, d.y, d.size * (d.dist / 90), 0, TAU);
                    ctx.fillStyle = `hsla(${d.hue}, 100%, 70%, ${t * (d.dist / 90)})`; ctx.fill();
                    ctx.restore();
                }
            }
        } else if (p.type === 'school_foreign') {
            const TAU = Math.PI * 2;
            const lerp = (a, b, t) => a + (b - a) * t;
            p.time += 0.02;
            const active = p.life > 1.0;
            if (active) p.auraPower = Math.min(p.auraPower + 0.015, 1);
            else p.auraPower = Math.max(p.auraPower - 0.008, 0);

            // 오라 글로우 레이어
            if (p.auraPower > 0) {
                for (let i = 4; i >= 0; i--) {
                    const r = 30 + i * 12 + Math.sin(p.time + i) * 5;
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.beginPath(); ctx.arc(p.x, p.y, r * p.auraPower, 0, TAU);
                    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * p.auraPower);
                    g.addColorStop(0, `rgba(255,240,100,${p.auraPower * (0.4 - i * 0.07)})`);
                    g.addColorStop(1, 'rgba(255,180,0,0)');
                    ctx.fillStyle = g; ctx.fill();
                    ctx.restore();
                }
                if (Math.random() < 0.5 && active) {
                    const a = Math.random() * TAU, r = Math.random() * 20 + 15;
                    p.auraParticles.push({
                        x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r,
                        vx: Math.cos(a) * (Math.random() * 1.5 + 0.5), vy: -(Math.random() * 2.5 + 0.5),
                        life: Math.random() * 0.5 + 0.3, maxLife: 0.8,
                        size: Math.random() * 4 + 2, hue: Math.random() * 25 + 40, burst: false
                    });
                }
            }
            // 오라 파티클
            for (let i = p.auraParticles.length - 1; i >= 0; i--) {
                const ap = p.auraParticles[i];
                ap.x += ap.vx; ap.y += ap.vy;
                if (!ap.burst) ap.vy -= 0.05;
                ap.life -= 0.006;
                if (ap.life <= 0) { p.auraParticles.splice(i, 1); continue; }
                const t = ap.life / ap.maxLife;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.beginPath(); ctx.arc(ap.x, ap.y, ap.size * t, 0, TAU);
                ctx.fillStyle = `hsla(${ap.hue}, 100%, 70%, ${t})`; ctx.fill();
                ctx.restore();
            }

            // 투사체 발사 타이머 확인
            const lifeSpent = p.maxLife - p.life;

            for (const proj of p.projectiles) {
                if (lifeSpent >= proj.startDelay && proj.t < 2) {
                    proj.t += proj.speed;
                    const x = lerp(proj.x, proj.tx, Math.min(proj.t, 1));
                    const y = lerp(proj.y, proj.ty, Math.min(proj.t, 1));
                    proj.trail.push({ x, y });
                    if (proj.trail.length > 12) proj.trail.shift();

                    if (proj.t >= 1 && proj.t < 2) {
                        p.impacts.push({ x: proj.tx, y: proj.ty, r: 0, life: 0.6, maxLife: 0.6 });
                        proj.t = 2; // 발사 완료 처리
                        continue;
                    }

                    // 궤적
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    for (let j = 0; j < proj.trail.length - 1; j++) {
                        const tt = j / proj.trail.length;
                        ctx.beginPath();
                        ctx.moveTo(proj.trail[j].x, proj.trail[j].y);
                        ctx.lineTo(proj.trail[j + 1].x, proj.trail[j + 1].y);
                        ctx.strokeStyle = `rgba(255,220,50,${tt * 0.7})`;
                        ctx.lineWidth = proj.size * tt * 0.5;
                        ctx.stroke();
                    }
                    ctx.restore();

                    // 투사체 본체
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const pg = ctx.createRadialGradient(x, y, 0, x, y, proj.size * 0.7);
                    pg.addColorStop(0, 'rgba(255,255,200,1)');
                    pg.addColorStop(0.4, 'rgba(255,200,50,0.8)');
                    pg.addColorStop(1, 'rgba(255,100,0,0)');
                    ctx.beginPath(); ctx.arc(x, y, proj.size * 0.7, 0, TAU);
                    ctx.fillStyle = pg; ctx.fill();
                    ctx.restore();
                }
            }

            // 타격 이펙트
            for (let i = p.impacts.length - 1; i >= 0; i--) {
                const im = p.impacts[i];
                im.r = lerp(im.r, 40, 0.2);
                im.life -= 0.006;
                if (im.life <= 0) { p.impacts.splice(i, 1); continue; }
                const t = im.life / im.maxLife;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const ig = ctx.createRadialGradient(im.x, im.y, 0, im.x, im.y, im.r);
                ig.addColorStop(0, `rgba(255,255,200,${t})`);
                ig.addColorStop(0.4, `rgba(255,180,0,${t * 0.7})`);
                ig.addColorStop(1, 'rgba(255,80,0,0)');
                ctx.beginPath(); ctx.arc(im.x, im.y, im.r, 0, TAU);
                ctx.fillStyle = ig; ctx.fill();
                ctx.restore();
            }
        } else if (p.type === 'school_beaker_proj') {
            ctx.save();
            p.t = Math.min(p.t + 0.02, 1);

            const x = lerp(p.startX, p.tx, p.t);
            const arc = -Math.sin(p.t * Math.PI) * 100; // parabolic arc height 100
            const y = lerp(p.startY, p.ty, p.t) + arc;

            p.x = x;
            p.y = y;

            if (p.t >= 1 && !p.done) {
                p.done = true;
                p.life = 0; // die
                this.fxSystem.spawnFx('school_beaker_splash', p.tx, p.ty);
            }

            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot += 0.15);
            
            ctx.beginPath();
            ctx.moveTo(-8, 12); ctx.lineTo(8, 12);
            ctx.lineTo(4, -8); ctx.lineTo(-4, -8);
            ctx.closePath();
            ctx.fillStyle = '#4caf50'; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            ctx.restore();
        } else if (p.type === 'school_beaker_puddle') {
            p.t += 0.016; // Increment transition timer
            if (p.t >= p.maxT) {
                const t = p.life / p.maxLife;
                const scale = Math.min((p.t - p.maxT) * 4, 1); // Expand quickly once delayed time passes
                const currentR = p.r * scale;

                ctx.save();
                // Draw outer glowing puddle (toxic green)
                ctx.beginPath();
                ctx.arc(p.tx, p.ty, currentR, 0, Math.PI * 2);
                const gradOuter = ctx.createRadialGradient(p.tx, p.ty, 0, p.tx, p.ty, currentR);
                gradOuter.addColorStop(0, `rgba(46, 204, 113, ${t * 0.6})`);
                gradOuter.addColorStop(0.8, `rgba(39, 174, 96, ${t * 0.4})`);
                gradOuter.addColorStop(1, `rgba(39, 174, 96, 0)`);
                ctx.fillStyle = gradOuter;
                ctx.fill();

                // Draw inner hotter core (neon yellow-green)
                ctx.beginPath();
                ctx.arc(p.tx, p.ty, currentR * 0.4, 0, Math.PI * 2);
                const gradInner = ctx.createRadialGradient(p.tx, p.ty, 0, p.tx, p.ty, currentR * 0.4);
                gradInner.addColorStop(0, `rgba(180, 255, 80, ${t * 0.8})`);
                gradInner.addColorStop(1, `rgba(46, 204, 113, 0)`);
                ctx.fillStyle = gradInner;
                ctx.fill();

                // Add micro-bubbling details occasionally
                if (Math.random() < 0.05 && t > 0.3) {
                    ctx.beginPath();
                    ctx.arc(p.tx + R(-p.r * 0.3, p.r * 0.3), p.ty + R(-p.r * 0.3, p.r * 0.3), R(1, 3), 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${t * 0.6})`;
                    ctx.fill();
                }
                ctx.restore();
            }
        } else if (p.type === 'school_beaker_part') {
            p.x += p.vx * 0.4; p.y += p.vy * 0.4; p.vy += 0.04;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(39, 174, 96, ${p.life / p.maxLife})`;
            ctx.fill();
        } else if (p.type === 'school_slam_crack') {
            p.progress = Math.min(p.progress + 0.02, 1);
            const t = p.life / p.maxLife;
            const end = Math.floor(p.progress * (p.pts.length - 1));
            ctx.beginPath(); ctx.moveTo(p.pts[0][0], p.pts[0][1]);
            for (let j = 1; j <= end; j++) ctx.lineTo(p.pts[j][0], p.pts[j][1]);
            ctx.strokeStyle = `rgba(255, 200, 80, ${t * 0.9})`;
            ctx.lineWidth = 2.5; ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 8;
            ctx.stroke(); ctx.shadowBlur = 0;
            ctx.strokeStyle = `rgba(255, 255, 180, ${t * 0.5})`;
            ctx.lineWidth = 1; ctx.stroke();
        } else if (p.type === 'school_slam_dust') {
            p.x += p.vx * 0.4; p.y += p.vy * 0.4; p.vy += 0.04;
            const t = p.life / p.maxLife;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 60%, 60%, ${t * 0.5})`; ctx.fill();
        } else if (p.type === 'school_slam_char') {
            if (p.phase === 'jump') {
                p.jumpT += 0.03;
                if (p.jumpT >= 1) p.phase = 'slam';
            }
            const jArc = p.phase === 'jump' ? -Math.sin(p.jumpT * Math.PI) * 50 : 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y + jArc - 10, 15, 0, Math.PI * 2); // Body
            ctx.arc(p.x, p.y + jArc - 30, 10, 0, Math.PI * 2); // Head
            ctx.fillStyle = '#6d4c41'; ctx.fill();
            
            if (p.phase === 'slam') {
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    ctx.lineTo(p.x + Math.cos(i * Math.PI / 4) * (i % 2 === 0 ? 30 : 15), p.y + 10 + Math.sin(i * Math.PI / 4) * (i % 2 === 0 ? 30 : 15));
                }
                ctx.closePath();
                ctx.fillStyle = '#ff5722'; ctx.fill();
            }
        } else if (p.type === 'school_pen_circle') {
            const t = 1 - p.life / p.maxLife;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(1.5, 0.7); // Perspective flat circle

            // Outer glowing circle
            ctx.beginPath();
            ctx.arc(0, 0, 45 * t, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 50, 50, ${(1 - t) * 0.8})`;
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ff2233';
            ctx.shadowBlur = 15;
            ctx.stroke();

            // Inner rotating runic circle with dashes
            ctx.beginPath();
            ctx.arc(0, 0, 35 * t, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 170, 50, ${(1 - t) * 0.6})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 8]);
            ctx.rotate(t * Math.PI * 2); // Rotate with progress
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw some rotating calligraphic text/runes
            ctx.fillStyle = `rgba(255, 220, 50, ${(1 - t) * 0.9})`;
            ctx.font = 'bold 12px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const runes = ['文', '筆', '書', '論', '理'];
            for (let j = 0; j < 5; j++) {
                ctx.save();
                ctx.rotate((j / 5) * Math.PI * 2);
                ctx.beginPath();
                ctx.moveTo(0, -35 * t - 5);
                ctx.lineTo(-5, -35 * t + 5);
                ctx.lineTo(5, -35 * t + 5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();
        } else if (p.type === 'school_pen_proj') {
            p.vy += 1.8; p.y += p.vy; // Accelerating fall
            if (p.y >= p.targetY) {
                p.life = 0;
                this.fxSystem.spawnFx('school_pen_splash', p.x, p.targetY);
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(Math.PI * 0.75); // Rotate so it points downwards

            // Draw energy trail
            const gradTrail = ctx.createLinearGradient(0, 0, 0, -80);
            gradTrail.addColorStop(0, 'rgba(255, 50, 50, 0.4)');
            gradTrail.addColorStop(1, 'rgba(255, 200, 50, 0)');
            ctx.fillStyle = gradTrail;
            ctx.fillRect(-15, -80, 30, 80);

            // Draw giant calligraphy pen (fountain pen / brush)
            // Glow effect
            ctx.shadowColor = '#ff2233';
            ctx.shadowBlur = 20;
            
            ctx.beginPath();
            ctx.moveTo(0, 30);
            ctx.lineTo(-15, -10);
            ctx.lineTo(-5, -30);
            ctx.lineTo(5, -30);
            ctx.lineTo(15, -10);
            ctx.closePath();
            ctx.fillStyle = '#ffd700'; // Gold
            ctx.fill();

            // Inner bright core
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(0, 25);
            ctx.lineTo(-8, -10);
            ctx.lineTo(8, -10);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        } else if (p.type === 'school_pen_mark') {
            p.progress = Math.min(p.progress + 0.025, 1);
            const t = p.life / p.maxLife;
            const s = 65 * p.progress; // Larger size (was 40)

            ctx.save();
            // Draw a heavy calligraphic "理" (Logic) character in the center
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `bold ${Math.floor(75 * p.progress)}px 'Georgia', serif`;

            // Outer burning glow for character
            ctx.fillStyle = `rgba(255, 30, 30, ${t * 0.15})`;
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 20 * p.progress;
            
            ctx.beginPath();
            ctx.moveTo(p.x - 25 * p.progress, p.y - 25 * p.progress);
            ctx.lineTo(p.x + 25 * p.progress, p.y + 25 * p.progress);
            ctx.moveTo(p.x + 25 * p.progress, p.y - 25 * p.progress);
            ctx.lineTo(p.x - 25 * p.progress, p.y + 25 * p.progress);
            ctx.moveTo(p.x, p.y - 35 * p.progress);
            ctx.lineTo(p.x, p.y + 35 * p.progress);
            ctx.moveTo(p.x - 35 * p.progress, p.y);
            ctx.lineTo(p.x + 35 * p.progress, p.y);
            
            ctx.lineWidth = 12 * p.progress;
            ctx.strokeStyle = `rgba(255, 30, 30, ${t * 0.15})`;
            ctx.stroke();

            // Inner calligraphic brush style character
            ctx.shadowBlur = 0;
            ctx.lineWidth = 7 * p.progress;
            ctx.strokeStyle = `rgba(15, 15, 25, ${t * 0.85})`; // Dark ink color
            ctx.stroke();

            // Draw massive crossed slash marks
            ctx.strokeStyle = `rgba(255, 40, 40, ${t})`;
            ctx.lineWidth = 6 * (1 - p.progress * 0.3);
            ctx.lineCap = 'round';
            ctx.shadowColor = '#ff0033';
            ctx.shadowBlur = 15;

            // Slash 1: Top-Left to Bottom-Right
            ctx.beginPath();
            ctx.moveTo(p.x - s, p.y - s);
            ctx.lineTo(p.x + s, p.y + s);
            ctx.stroke();

            // Slash 2: Top-Right to Bottom-Left
            ctx.beginPath();
            ctx.moveTo(p.x + s, p.y - s);
            ctx.lineTo(p.x - s, p.y + s);
            ctx.stroke();

            // Ground fractures (cracks radiating outwards)
            if (p.progress > 0.4) {
                ctx.strokeStyle = `rgba(255, 120, 0, ${t * 0.5})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let j = 0; j < 6; j++) {
                    const angle = (j / 6) * Math.PI * 2 + 0.5;
                    ctx.moveTo(p.x, p.y);
                    const midX = p.x + Math.cos(angle) * s * 0.8;
                    const midY = p.y + Math.sin(angle) * s * 0.8;
                    ctx.lineTo(midX, midY);
                    ctx.lineTo(midX + Math.cos(angle + 0.3) * s * 0.4, midY + Math.sin(angle + 0.3) * s * 0.4);
                }
                ctx.stroke();
            }
            ctx.restore();
        } else if (p.type === 'school_pen_ink') {
            p.x += p.vx * 0.4; p.y += p.vy * 0.4; p.vy += 0.08;
            const t = p.life / p.maxLife;

            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);

            // Alternating ink colors: mostly black/indigo ink, some red ink
            if (p.size % 2 === 0) {
                ctx.fillStyle = `rgba(20, 20, 35, ${t})`; // deep dark ink
            } else {
                ctx.fillStyle = `rgba(220, 30, 30, ${t})`; // hot red ink
            }
            ctx.fill();

            // Add a small splash trail
            if (p.life > p.maxLife * 0.5) {
                ctx.beginPath();
                ctx.arc(p.x - p.vx * 0.5, p.y - p.vy * 0.5, p.size * t * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        } else if (p.type === 'school_shield_wave') {
            if (p.delay > 0) { p.delay -= 0.016; p.life += 0.016; } else {
                p.r += (p.maxR - p.r) * 0.04;
                const t = p.life / p.maxLife;
                ctx.globalCompositeOperation = 'lighter';
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 215, 0, ${t * 0.5})`;
                ctx.lineWidth = (1 - p.r / p.maxR) * 5 + 1;
                ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12; ctx.stroke();
            }
        } else if (p.type === 'school_shield_char') {
            ctx.beginPath();
            ctx.moveTo(p.x - 10, p.y);
            ctx.lineTo(p.x + 10, p.y - 10);
            ctx.lineTo(p.x + 10, p.y + 10);
            ctx.closePath();
            ctx.fillStyle = '#ccc'; ctx.fill();
            ctx.fillRect(p.x - 15, p.y - 5, 5, 10);
        } else if (p.type === 'school_shield_hex') {
            if (p.delay > 0) { p.delay -= 0.016; p.life += 0.016; } else {
                p.r = Math.min(p.r + 0.6, p.maxR);
                const t = p.life / p.maxLife;
                ctx.globalAlpha = t;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = i / 6 * Math.PI * 2 - Math.PI / 6;
                    const px = p.x + Math.cos(a) * p.r, py = p.y + Math.sin(a) * p.r;
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.strokeStyle = `rgba(255, 215, 0, ${t * 0.9})`; ctx.lineWidth = 2.5;
                ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 14; ctx.stroke();
                const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
                g.addColorStop(0, `rgba(255, 215, 0, ${t * 0.15})`); g.addColorStop(1, 'rgba(255, 215, 0, 0)');
                ctx.fillStyle = g; ctx.fill();
                p.sparkles.forEach(sp => {
                    sp.r = p.r + Math.sin(Date.now() * 0.003 + sp.a) * 4;
                    const sx = p.x + Math.cos(sp.a + Date.now() * 0.001) * sp.r;
                    const sy = p.y + Math.sin(sp.a + Date.now() * 0.001) * sp.r;
                    ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 180, ${t * 0.8})`; ctx.fill();
                });
            }
        } else if (p.type === 'school_heal_wing') {
            p.wingPhase += 0.012;
            p.wingAlpha = Math.max(0, p.wingAlpha - 0.002);
            p.crossAlpha = Math.max(0, p.crossAlpha - 0.003);
            const W = fxCanvas.width || 800, H = fxCanvas.height || 600;
            const alpha = p.wingAlpha + Math.sin(p.wingPhase) * 0.05;
            if (alpha > 0) {
                ctx.globalAlpha = alpha * 0.18;
                ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.4);
                ctx.bezierCurveTo(W * 0.2, H * 0.1, W * 0.0, H * 0.5, W * 0.1, H * 0.75);
                ctx.bezierCurveTo(W * 0.25, H * 0.85, W * 0.45, H * 0.6, W * 0.5, H * 0.5);
                ctx.fillStyle = '#ffffff'; ctx.fill();
                ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.4);
                ctx.bezierCurveTo(W * 0.8, H * 0.1, W * 1.0, H * 0.5, W * 0.9, H * 0.75);
                ctx.bezierCurveTo(W * 0.75, H * 0.85, W * 0.55, H * 0.6, W * 0.5, H * 0.5);
                ctx.fill();
            }
            if (p.crossAlpha > 0) {
                ctx.globalAlpha = p.crossAlpha * 0.3;
                ctx.strokeStyle = '#aaffcc'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.2); ctx.lineTo(W * 0.5, H * 0.8); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(W * 0.15, H * 0.5); ctx.lineTo(W * 0.85, H * 0.5); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.moveTo(W * 0.5 - 15, H * 0.45 - 10);
            ctx.quadraticCurveTo(W * 0.5, H * 0.45, W * 0.5 + 15, H * 0.45 - 10);
            ctx.quadraticCurveTo(W * 0.5 + 5, H * 0.45 + 5, W * 0.5, H * 0.45 + 10);
            ctx.quadraticCurveTo(W * 0.5 - 5, H * 0.45 + 5, W * 0.5 - 15, H * 0.45 - 10);
            ctx.fillStyle = '#fff'; ctx.fill();
        } else if (p.type === 'school_heal_firefly') {
            p.t += p.speed;
            const px = p.x + (p.tx - p.x) * Math.min(p.t, 1);
            const py = p.y + (p.ty - p.y) * Math.min(p.t, 1) + Math.sin(p.t * 10 + p.phase) * 8;
            const t = p.life / p.maxLife;
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2);
            g.addColorStop(0, `hsla(${p.hue}, 100%, 90%, ${t})`); g.addColorStop(1, `hsla(${p.hue}, 100%, 60%, 0)`);
            ctx.beginPath(); ctx.arc(px, py, p.size * 2, 0, Math.PI * 2);
            ctx.fillStyle = g; ctx.fill();
        } else if (p.type === 'golden_feather') {
            // 황금빛 깃털 — 부드러운 낙하 및 좌우 흔들림
            p.x += p.vx + Math.sin(p.life * 3) * 0.8;
            p.y += p.vy;
            p.rot += 0.02;
            const t = p.life / p.maxLife;
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = t * 0.85;
            ctx.globalCompositeOperation = 'lighter';
            
            // 깃털 외곽 (골든)
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.quadraticCurveTo(8, -4, 5, 8);
            ctx.quadraticCurveTo(1, 12, 0, 12);
            ctx.quadraticCurveTo(-1, 12, -5, 8);
            ctx.quadraticCurveTo(-8, -4, 0, -12);
            ctx.closePath();
            
            const fg = ctx.createLinearGradient(0, -12, 0, 12);
            fg.addColorStop(0, '#fff8dc');
            fg.addColorStop(0.4, '#ffd700');
            fg.addColorStop(1, '#ffaa00');
            ctx.fillStyle = fg;
            ctx.fill();
            
            // 깃털 가운데 줄기
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(0, -10);
            ctx.lineTo(0, 10);
            ctx.stroke();
            
            ctx.restore();
        } else if (p.type === 'donation_beam') {
            // 빛기둥 — 하늘에서 내리꽂히는 신성한 금빛 빔
            if (p.delay && p.delay > 0) {
                p.delay -= 0.016;
                p.life += 0.016;
            } else {
                const t = p.life / p.maxLife;
                const beamH = 250;
                const beamW = 20 + t * 15;
                
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                
                // 메인 광선 그라디언트 (위에서 아래로)
                const bg = ctx.createLinearGradient(p.x, p.y - beamH, p.x, p.y + 15);
                bg.addColorStop(0, `rgba(255, 245, 200, 0)`);
                bg.addColorStop(0.3, `rgba(255, 235, 130, ${t * 0.5})`);
                bg.addColorStop(0.7, `rgba(255, 215, 0, ${t * 0.7})`);
                bg.addColorStop(1, `rgba(255, 255, 255, ${t * 0.9})`);
                
                ctx.fillStyle = bg;
                ctx.fillRect(p.x - beamW / 2, p.y - beamH, beamW, beamH + 15);
                
                // 밝은 코어 라인
                const coreW = beamW * 0.3;
                const cg = ctx.createLinearGradient(p.x, p.y - beamH, p.x, p.y + 15);
                cg.addColorStop(0, `rgba(255, 255, 255, 0)`);
                cg.addColorStop(0.5, `rgba(255, 255, 255, ${t * 0.6})`);
                cg.addColorStop(1, `rgba(255, 255, 255, ${t * 0.9})`);
                ctx.fillStyle = cg;
                ctx.fillRect(p.x - coreW / 2, p.y - beamH, coreW, beamH + 15);
                
                // 바닥 착지 빛 번짐
                const impactG = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 35);
                impactG.addColorStop(0, `rgba(255, 235, 150, ${t * 0.8})`);
                impactG.addColorStop(1, `rgba(255, 215, 0, 0)`);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 35, 0, Math.PI * 2);
                ctx.fillStyle = impactG;
                ctx.fill();
                
                ctx.restore();
            }
        } else if (p.type === 'donation_global_circle') {
            // 사랑의 바자회: 바닥에 깔리는 거대하고 화려한 마법진 (파스텔 톤 섞기)
            const t = p.life / p.maxLife; // 1 -> 0
            const W = fxCanvas.width || 800;
            const currentR = p.maxR * (1 - Math.pow(t, 3)); // 점점 커짐
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((1 - t) * Math.PI); // 천천히 회전
            
            // 페이드 인 / 아웃 부드럽게
            ctx.globalAlpha = Math.sin(t * Math.PI) * 0.9; 
            // lighter 모드를 빼서 각 색상(파스텔톤)이 하얗게 타버리지 않고 고유의 색을 유지하도록 함
            
            ctx.lineWidth = 4;
            
            // 다채로운 그라디언트 링
            const grad = ctx.createLinearGradient(-currentR, -currentR, currentR, currentR);
            grad.addColorStop(0, '#ffd700');   // 골드
            grad.addColorStop(0.5, '#ff69b4'); // 핫핑크
            grad.addColorStop(1, '#00ffff');   // 시안
            
            ctx.strokeStyle = grad;
            
            // 바깥쪽 큰 원
            ctx.beginPath();
            ctx.arc(0, 0, currentR, 0, Math.PI * 2);
            ctx.stroke();
            
            // 안쪽 기하학 무늬 (8각 별)
            ctx.beginPath();
            for (let i = 0; i <= 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const r = i % 2 === 0 ? currentR * 0.95 : currentR * 0.5;
                if (i === 0) {
                    ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
                } else {
                    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                }
            }
            ctx.closePath();
            ctx.stroke(); // 채우기 제거
            
            // 더 안쪽 원 2개 (겹쳐서 화려하게)
            ctx.beginPath();
            ctx.arc(0, 0, currentR * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 105, 180, 0.8)'; // 핫핑크 계열
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(0, 0, currentR * 0.3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)'; // 시안 계열
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.restore();
        } else if (p.type === 'donation_item_projectile') {
            // 패시브 스킬: 기부천사 -> 아군에게 날아가는 아이템 투사체
            p.t += 0.025; // 수직 하강이므로 비행 속도 약간 더 빠르게
            if (p.t >= 1) {
                p.life = 0;
                // 도달 시 폭죽 파티클 스폰
                this.fxSystem.spawnFx('donation_confetti_burst', p.tx, p.ty);
            }
            // 가속도 적용 (중력처럼)
            const easeT = p.t * p.t;
            
            const px = p.startX + (p.tx - p.startX) * easeT;
            const py = p.startY + (p.ty - p.startY) * easeT; // 포물선 곡선(Math.sin) 제거하고 직선 자유낙하
            
            // 궤적 트레일 저장
            p.trail.push({x: px, y: py});
            if (p.trail.length > 8) p.trail.shift();
            
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            
            // 궤적 그리기 (오색 궤적)
            if (p.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for(let i=1; i<p.trail.length; i++) {
                    ctx.lineTo(p.trail[i].x, p.trail[i].y);
                }
                const trailGrad = ctx.createLinearGradient(p.trail[0].x, p.trail[0].y, px, py);
                trailGrad.addColorStop(0, 'rgba(255,255,255,0)');
                trailGrad.addColorStop(1, '#ff69b4'); // 핫핑크 트레일
                ctx.strokeStyle = trailGrad;
                ctx.lineWidth = 5;
                ctx.globalAlpha = 0.8;
                ctx.stroke();
            }
            
            // 투사체 아이콘 드로잉
            ctx.translate(px, py);
            ctx.rotate(p.t * Math.PI * 6); // 떨어지면서 빙글빙글 더 빠르게 돔
            ctx.globalAlpha = 1.0;
            
            // 후광 (오로라 빛)
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(0,0,0, 0,0,18);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.4, '#00ffff'); // 시안색 후광
            g.addColorStop(1, 'rgba(0,255,255,0)');
            ctx.fillStyle = g;
            ctx.fill();
            
            // 모양 그리기
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            if (p.icon === 'gift') {
                ctx.fillRect(-8, -8, 16, 16);
                ctx.fillStyle = '#ff3333';
                ctx.fillRect(-2, -8, 4, 16);
                ctx.fillRect(-8, -2, 16, 4);
            } else if (p.icon === 'sword') {
                ctx.moveTo(0, -12); ctx.lineTo(5, -5); ctx.lineTo(3, 10); ctx.lineTo(-3, 10); ctx.lineTo(-5, -5);
                ctx.fill();
            } else if (p.icon === 'shield') {
                ctx.moveTo(-7, -9); ctx.lineTo(7, -9); ctx.lineTo(7, 3); ctx.lineTo(0, 12); ctx.lineTo(-7, 3);
                ctx.fill();
            } else { // stat (번개 모양)
                ctx.moveTo(3, -9); ctx.lineTo(-7, 3); ctx.lineTo(-1, 3); ctx.lineTo(-3, 12); ctx.lineTo(7, -3); ctx.lineTo(1, -3);
                ctx.fill();
            }
            
            ctx.restore();
        } else if (p.type === 'donation_confetti') {
            // 폭죽 조각
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3; // 중력 강화
            if (p.rotSpeed === undefined) p.rotSpeed = (Math.random() - 0.5) * 0.4;
            p.rot += p.rotSpeed;
            
            const t = p.life / p.maxLife;
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = t;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 5;
            ctx.shadowColor = p.color; // 네온 글로우 추가
            ctx.fillRect(-p.size, -p.size/2, p.size * 2, p.size); // 조금 더 길쭉한 색종이 모양
            ctx.restore();
        } else if (p.type === 'quant_chart') {
            // 천재퀀트 "주식 떡상" 타겟 전용 미니 차트 이펙트
            const t = p.life / p.maxLife; // 1 -> 0
            const progress = 1 - t; // 0 -> 1
            
            // 타겟 1칸 정도의 크기 설정
            const chartW = 140;
            const chartH = 160;
            
            ctx.save();
            ctx.translate(p.x, p.y - 20); // 타겟의 살짝 위쪽을 중심으로
            ctx.globalAlpha = Math.sin(t * Math.PI) * 0.9;
            ctx.globalCompositeOperation = 'lighter';
            
            // 배경 그리드 (더 밝고 선명한 네온 그린)
            ctx.strokeStyle = 'rgba(0, 255, 100, 0.7)'; 
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            // 가로선
            for(let i=0; i<=5; i++) {
                const yPos = -chartH/2 + i * (chartH / 5);
                ctx.moveTo(-chartW/2, yPos);
                ctx.lineTo(chartW/2, yPos);
            }
            // 세로선
            for(let i=0; i<=6; i++) {
                const xPos = -chartW/2 + i * (chartW / 6);
                ctx.moveTo(xPos, -chartH/2);
                ctx.lineTo(xPos, chartH/2);
            }
            ctx.stroke();
            
            // 양봉 캔들스틱 배경 효과 (상승하는 주식 막대바)
            if (progress > 0.3) {
                for (let i=0; i<3; i++) {
                    const cx = -chartW * 0.3 + i * (chartW * 0.3);
                    const ch = (chartH * 0.4) * progress * (1 + i*0.2);
                    const cy = chartH/2 - 10 - ch;
                    
                    ctx.fillStyle = 'rgba(255, 50, 50, 0.4)'; // 반투명 빨간 양봉
                    ctx.fillRect(cx - 10, cy, 20, ch);
                    // 꼬리
                    ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - 15);
                    ctx.lineTo(cx, cy + ch + 15);
                    ctx.stroke();
                }
            }
            
            // 우상향 떡상 상승선 (강렬한 빨간선)
            const startX = -chartW/2 + 10;
            const startY = chartH/2 - 10;
            const endX = chartW/2 - 10;
            const endY = -chartH/2 + 10;
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            // 지그재그 경로 그리기
            let tempX = startX;
            let tempY = startY;
            for(let i=0.05; i<=progress; i+=0.05) {
                const nextX = startX + (endX - startX) * i;
                // 우상향 베이스에 흔들리는 진폭 적용
                const nextY = startY + (endY - startY) * i - Math.sin(i*Math.PI*6)*15 - Math.random()*8;
                ctx.lineTo(nextX, nextY);
                tempX = nextX; tempY = nextY;
            }
            
            ctx.strokeStyle = '#ff0033'; // 강렬한 레드
            ctx.lineWidth = 6;
            ctx.lineJoin = 'round';
            ctx.stroke();
            
            // 선 안쪽에 밝은 코어 그려서 빛나는 느낌
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 차트 끝부분 미니 화살표
            if (progress > 0.05) {
                ctx.translate(tempX, tempY);
                ctx.rotate(-Math.PI/4.5); // 화살표 각도
                ctx.beginPath();
                ctx.moveTo(0, -15); ctx.lineTo(15, 15); ctx.lineTo(-15, 15);
                ctx.fillStyle = '#ff0033';
                ctx.fill();
                // 화살표 속 코어
                ctx.beginPath();
                ctx.moveTo(0, -8); ctx.lineTo(8, 10); ctx.lineTo(-8, 10);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }
            
            ctx.restore();
        } else if (p.type === 'school_piano_staff') {
            if (p.delay > 0) { p.delay -= 0.016; p.life += 0.016; } else {
                p.progress = Math.min(p.progress + 0.012, 1);
                const t = p.life / p.maxLife;
                const W = fxCanvas.width || 800;
                ctx.globalAlpha = t * 0.4;
                ctx.strokeStyle = '#ccaaff'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(0, p.y);
                for (let x = 0; x <= W * p.progress; x += 4) ctx.lineTo(x, p.y + Math.sin(x * 0.1) * 3);
                ctx.stroke();
            }
        } else if (p.type === 'school_piano_note') {
            if (p.delay > 0) { p.delay -= 0.016; p.life += 0.016; } else {
                p.t += p.speed;
                if (p.t >= 1) { p.life = 0; this.fxSystem.particles.push({ type: 'school_piano_hit', x: p.tx, y: p.ty, life: 0.6, maxLife: 0.6, isEnemy: p.isEnemy }); }
                const px = p.x + (p.tx - p.x) * p.t;
                const py = p.y + (p.ty - p.y) * p.t + Math.sin(p.t * Math.PI) * -20;
                const t = p.life / p.maxLife;
                ctx.font = `${p.size}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.globalAlpha = t; ctx.fillText(p.sym, px, py);
            }
        } else if (p.type === 'school_piano_hit') {
            const t = p.life / p.maxLife;
            const r = 30 * (1 - t);
            ctx.globalCompositeOperation = 'lighter';
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            if (p.isEnemy) { g.addColorStop(0, `rgba(255, 80, 80, ${t})`); g.addColorStop(1, 'rgba(255, 0, 0, 0)'); }
            else { g.addColorStop(0, `rgba(80, 150, 255, ${t})`); g.addColorStop(1, 'rgba(0, 80, 255, 0)'); }
            ctx.fillStyle = g; ctx.fill();
        } else if (p.type === 'school_math_orbit') {
            p.angle += p.speed; p.alpha = Math.min(p.alpha + 0.016, 1);
            const t = p.life / p.maxLife;
            const px = p.cx + Math.cos(p.angle) * p.orbitR;
            const py = p.cy + Math.sin(p.angle) * p.orbitR * 0.5;
            ctx.font = `bold ${p.size}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = `rgba(${p.life > 2 ? '180,255,180' : '255,255,100'}, ${t * p.alpha})`;
            ctx.shadowColor = '#88ff88'; ctx.shadowBlur = 8;
            ctx.fillText(p.text, px, py);
        } else if (p.type === 'school_math_aura') {
            p.alpha = Math.max(0, p.alpha - 0.002); p.r = Math.min(p.r + 0.4, 60); p.eyeGlow = Math.max(0, p.eyeGlow - 0.003);
            if (p.alpha > 0) {
                for (let i = 3; i >= 0; i--) {
                    const r = Math.max(0, p.r * (0.5 + i * 0.15) + Math.sin(Date.now() * 0.003) * 5);
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(255, 220, 0, ${p.alpha * (0.5 - i * 0.1)})`;
                    ctx.lineWidth = 3 - i * 0.5; ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 15;
                    ctx.stroke();
                }
                if (Math.random() < 0.4) {
                    const a = Math.random() * Math.PI * 2, r = p.r * (Math.random() * 0.3 + 0.8);
                    ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, Math.random() * 2 + 1, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 100, ${p.alpha * 0.8})`; ctx.fill();
                }
            }
            if (p.eyeGlow > 0) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.beginPath(); ctx.arc(p.x - 4, p.y - 4, 4 + p.eyeGlow * 6, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 50, 50, ${p.eyeGlow * 0.6})`; ctx.fill();
                ctx.beginPath(); ctx.arc(p.x + 4, p.y - 4, 4 + p.eyeGlow * 6, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 50, 50, ${p.eyeGlow * 0.6})`; ctx.fill();
            }
        } else if (p.type === 'school_principal_text') {
            if (!p.landed) {
                p.vy += 1.2; p.y += p.vy;
            }
            const H = fxCanvas.height || 600;
            if (!p.landed && p.y >= H * 0.42) {
                p.landed = true;
                p.y = H * 0.42;
                p.vy = 0;
                this.fxSystem.spawnFx('school_principal_splash', 0, 0);
            }
            const t = p.life / p.maxLife;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 20;
            ctx.font = `bold ${Math.floor(14 + 8 * Math.min(p.y / H, 1))}px 'Malgun Gothic',sans-serif`;
            ctx.fillStyle = `rgba(255, 80, 30, ${t})`;
            ctx.fillText('조용히 해라!', p.x, p.y);
            ctx.beginPath();
            ctx.moveTo(p.x - 12, p.y + 30);
            ctx.lineTo(p.x + 12, p.y + 18);
            ctx.lineTo(p.x + 12, p.y + 42);
            ctx.closePath();
            ctx.fillStyle = '#ccc'; ctx.fill();
            ctx.fillRect(p.x - 18, p.y + 25, 6, 10);
        } else if (p.type === 'school_principal_shake') {
            p.power *= 0.88;
            ctx.translate(Math.random() * p.power * 2 - p.power, Math.random() * p.power * 2 - p.power);
        } else if (p.type === 'school_principal_fog') {
            p.x += p.vx; p.y += p.vy;
            const t = p.life / p.maxLife;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(150, 150, 180, ${t * p.alpha})`; ctx.fill();
        } else if (p.type === 'school_principal_star') {
            p.x += p.vx * 0.4; p.y += p.vy * 0.4; p.vy += 0.04;
            const t = p.life / p.maxLife;
            ctx.globalAlpha = t; 
            ctx.beginPath();
            for (let k = 0; k < 5; k++) {
                ctx.lineTo(p.x + Math.cos(k * Math.PI * 0.8) * p.size * 0.5, p.y + Math.sin(k * Math.PI * 0.8) * p.size * 0.5);
            }
            ctx.closePath();
            ctx.fillStyle = '#ffeb3b'; ctx.fill();
        } else if (p.type === 'school_picasso_brush') {
            const W = fxCanvas.width || 800;
            p.progress += 0.008;
            const currentX = -50 + (W + 100) * p.progress;
            ctx.beginPath(); ctx.moveTo(-50, p.y);
            for (let x = -50; x <= currentX; x += 10) {
                ctx.lineTo(x, p.y + Math.sin(x * p.wave) * p.amp);
            }
            ctx.strokeStyle = `hsla(${p.progress * 360}, 80%, 60%, ${p.life / p.maxLife})`;
            ctx.lineWidth = p.width; ctx.lineCap = 'round'; ctx.stroke();
        } else if (p.type === 'school_picasso_splatter') {
            if (p.delay > 0) { p.delay -= 0.016; p.life += 0.016; } else {
                p.r += (p.maxR - p.r) * 0.06;
                const t = p.life / p.maxLife;
                ctx.globalAlpha = t;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color; ctx.fill();
                p.drops.forEach(d => {
                    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        } else if (p.type === 'aug_heal_bomb_wave') {
            p.r = lerp(p.r, p.maxR, 0.12);
            const t = p.life / p.maxLife;
            ctx.save();
            ctx.strokeStyle = `hsla(140, 100%, 40%, ${t})`; // 진한 초록색, 투명도 증가
            ctx.lineWidth = 4.0 * t + 1.5; // 더 굵게
            ctx.shadowColor = '#1e824c'; // 짙은 초록색 그림자
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else if (p.type === 'aug_heal_bomb_cross') {
            p.x += p.vx; p.y += p.vy; p.vy += 0.08;
            p.rot += p.rotSpd;
            const t = p.life / p.maxLife;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.strokeStyle = `rgba(0, 200, 80, ${t})`; // 흰 배경에 돋보이게 채도 증가
            ctx.lineWidth = 3.5 * t;
            ctx.shadowColor = '#00a651';
            ctx.shadowBlur = 12;
            const hs = p.size * 0.5 * t;
            ctx.beginPath();
            ctx.moveTo(-hs, 0); ctx.lineTo(hs, 0);
            ctx.moveTo(0, -hs); ctx.lineTo(0, hs);
            ctx.stroke();
            ctx.restore();
        } else if (p.type === 'aug_heal_bomb_spark') {
            p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.98;
            const t = p.life / p.maxLife;
            ctx.save();
            // 흰 배경에서 묻힐 수 있으므로 lighter 속성 제거 및 색상 조정
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * t * 2.5);
            grad.addColorStop(0, `hsla(130, 100%, 50%, ${t})`);
            grad.addColorStop(0.4, `hsla(140, 100%, 30%, ${t * 0.9})`);
            grad.addColorStop(1, `hsla(140, 100%, 20%, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * t * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (p.type === 'aug_mass_silence_noise') {
            const t = p.life / p.maxLife;
            ctx.save();
            ctx.fillStyle = `rgba(255, 56, 96, ${t * 0.15})`;
            ctx.fillRect(0, 0, fxCanvas.width, fxCanvas.height);
            ctx.strokeStyle = `rgba(255, 255, 255, ${t * 0.4})`;
            for (let j = 0; j < 4; j++) {
                const h = R(2, 6);
                const y = R(0, fxCanvas.height - h);
                ctx.lineWidth = h;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(fxCanvas.width, y);
                ctx.stroke();
            }
            ctx.restore();
        } else if (p.type === 'aug_mass_silence_x') {
            if (p.scale > 1.0) p.scale -= 0.15;
            const t = p.life / p.maxLife;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.strokeStyle = `rgba(255, 56, 96, ${t})`;
            ctx.shadowColor = '#ff3860';
            ctx.shadowBlur = 15 * t + 5;
            ctx.lineWidth = 5 * t * (1 / p.scale) + 1;
            const size = 16 * p.scale * t;

            if (Math.random() > 0.6) {
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
                ctx.beginPath();
                ctx.moveTo(-size + 2, -size); ctx.lineTo(size + 2, size);
                ctx.moveTo(size + 2, -size); ctx.lineTo(-size + 2, size);
                ctx.stroke();
                ctx.strokeStyle = `rgba(255, 56, 96, ${t})`;
            }
            ctx.beginPath();
            ctx.moveTo(-size, -size); ctx.lineTo(size, size);
            ctx.moveTo(size, -size); ctx.lineTo(-size, size);
            ctx.stroke();
            ctx.restore();
            p.sparks.forEach(s => {
                s.l -= 0.015;
                if (s.l > 0) {
                    const sx = p.x + Math.cos(s.a) * (15 + (1 - s.l) * 35 * s.spd);
                    const sy = p.y + Math.sin(s.a) * (15 + (1 - s.l) * 35 * s.spd);
                    ctx.fillStyle = `rgba(255, 80, 120, ${s.l})`;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 2 * s.l, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        } else if (p.type === 'aug_spirit_transfer_spark') {
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.02;
            const t = p.life / p.maxLife;
            ctx.fillStyle = `rgba(255, 221, 87, ${t})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5 * t, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'aug_spirit_transfer_meteor') {
            p.t += 0.035;
            const cpX = (p.x + p.tx) / 2;
            const cpY = Math.min(p.y, p.ty) - 60;

            const u = 1 - p.t;
            const tt = p.t * p.t;
            const uu = u * u;
            const cx = uu * p.x + 2 * u * p.t * cpX + tt * p.tx;
            const cy = uu * p.y + 2 * u * p.t * cpY + tt * p.ty;

            p.trail.push({ x: cx, y: cy });
            if (p.trail.length > 8) p.trail.shift();
            p.trail.forEach((pt, j) => {
                const alpha = (j / p.trail.length) * 0.7 * (p.life / p.maxLife);
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(255, 221, 87, ${alpha})`;
                ctx.shadowColor = '#ffdd57';
                ctx.shadowBlur = j;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, p.size * (j / p.trail.length) * 0.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
            ctx.save();
            ctx.shadowColor = '#ffdd57';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx, cy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            if (p.t >= 1) {
                p.life = 0;
                for (let k = 0; k < 15; k++) {
                    const angle = R(0, TAU);
                    const spd = R(1.5, 6.0);
                    this.fxSystem.particles.push({
                        type: 'aug_spirit_transfer_impact',
                        x: p.tx, y: p.ty,
                        vx: Math.cos(angle) * spd,
                        vy: Math.sin(angle) * spd - R(0, 1.5),
                        life: R(0.5, 1.0), maxLife: 1.0,
                        size: R(2.0, 5.0)
                    });
                }
            }
        } else if (p.type === 'aug_spirit_transfer_impact') {
            p.x += p.vx; p.y += p.vy;
            const t = p.life / p.maxLife;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.shadowColor = '#ffdd57';
            ctx.shadowBlur = 8;
            ctx.fillStyle = `rgba(255, 221, 87, ${t})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (p.type === 'aug_thorn_reflect_shield') {
            p.r = lerp(p.r, 45, 0.15);
            const t = p.life / p.maxLife;
            ctx.save();
            ctx.strokeStyle = `rgba(32, 156, 238, ${t * 0.8})`;
            ctx.lineWidth = 3.0 * t;
            ctx.shadowColor = '#209cee';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
                const a = (k / 6) * Math.PI * 2 - Math.PI / 6;
                const px = p.x + Math.cos(a) * p.r;
                const py = p.y + Math.sin(a) * p.r;
                k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        } else if (p.type === 'aug_thorn_reflect_spike') {
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.02;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            const grad = ctx.createLinearGradient(0, 0, p.length, 0);
            const alpha = p.life / p.maxLife;
            grad.addColorStop(0, `rgba(200, 240, 255, ${alpha})`);
            grad.addColorStop(0.3, `rgba(32, 156, 238, ${alpha * 0.9})`);
            grad.addColorStop(1, `rgba(20, 80, 220, 0)`);
            ctx.beginPath();
            ctx.moveTo(0, -p.width / 2);
            ctx.lineTo(p.length, 0);
            ctx.lineTo(0, p.width / 2);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
            ctx.lineWidth = 1.0;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p.length * 0.7, 0); ctx.stroke();
            ctx.restore();
            const d = Math.hypot(p.x - p.targetX, p.y - p.targetY);
            if (d < 25 && !p.done) {
                p.done = true;
                p.life = 0;
                for (let k = 0; k < 6; k++) {
                    const a = p.angle + Math.PI + R(-0.8, 0.8);
                    const spd = R(1.5, 4.0);
                    this.fxSystem.particles.push({
                        type: 'aug_thorn_reflect_spark',
                        x: p.targetX, y: p.targetY,
                        vx: Math.cos(a) * spd,
                        vy: Math.sin(a) * spd - R(0, 1.0),
                        life: R(0.4, 0.7)
                    });
                }
            }
        } else if (p.type === 'aug_thorn_reflect_spark') {
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.03;
            const t = p.life;
            if (t > 0) {
                ctx.fillStyle = `rgba(32, 200, 255, ${t})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.0 * t, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (p.type === 'mana_steal_proj' || p.type === 'aug_spirit_transfer') {
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.03;
            if (p.life > 0) {
                ctx.fillStyle = p.color || (p.type === 'aug_spirit_transfer' ? '#f1c40f' : '#9b59b6');
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size || 6, 0, Math.PI * 2);
                ctx.fill();
                this.fxSystem.particles.push({
                    type: 'particle', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.2, color: ctx.fillStyle, size: (p.size || 6) * 0.8
                });
            }
        } else if (p.type === 'satiety_aura') {
            p.radius = (p.radius || 10) + 2;
            p.life -= 0.02;
            if (p.life > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(243, 156, 18, ${Math.min(1, p.life)})`;
                ctx.lineWidth = 4;
                ctx.stroke();
                ctx.restore();
            }
        } else if (p.type === 'banana') {
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.03;
            if (p.life > 0) {
                ctx.font = '20px Arial';
                ctx.fillText('🍌', p.x, p.y);
            }
        } else if (p.type === 'triangle_ruler_proj') {
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.05;
            if (p.life > 0) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(Date.now() / 100);
                ctx.font = '20px Arial';
                ctx.fillText('📐', -10, 10);
                ctx.restore();
            }
        } else if (p.type === 'art_canvas') {
            p.radius = p.radius + (p.maxRadius - p.radius) * 0.12;
            if (p.radius < 2) return; // 반지름이 너무 작으면 스킵
            const wave = Math.sin(Date.now() / 200 + p.life * 5) * 5;
            const lifePct = Math.max(0, Math.min(1, p.life / p.maxLife));
            const fadeOut = lifePct < 0.2 ? lifePct / 0.2 : 1; // 마지막 20%에서 페이드아웃
            const alpha = fadeOut;

            ctx.save();
            ctx.globalAlpha = 1; // globalAlpha 무력화 (자체 알파 사용)

            // 외곽 테두리 링
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.lineWidth = 12 + wave;
            ctx.strokeStyle = `hsla(${(Date.now() / 15) % 360}, 90%, 65%, ${alpha * 0.85})`;
            ctx.stroke();

            // 두번째 안쪽 링
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 0.75, 0, Math.PI * 2);
            ctx.lineWidth = 3;
            ctx.strokeStyle = `hsla(${(Date.now() / 15 + 60) % 360}, 90%, 75%, ${alpha * 0.5})`;
            ctx.stroke();

            // 내부 그라데이션 채우기
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
            grad.addColorStop(0, `hsla(${(Date.now() / 15 + 120) % 360}, 70%, 70%, ${alpha * 0.25})`);
            grad.addColorStop(0.6, `hsla(${(Date.now() / 15 + 60) % 360}, 80%, 60%, ${alpha * 0.12})`);
            grad.addColorStop(1, `hsla(${(Date.now() / 15) % 360}, 90%, 55%, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            // 물감 튀기는(Splatter) 파티클 간헐적 생성
            if (Math.random() < 0.12 && p.life > 0.5) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.random() * p.radius;
                this.fxSystem.spawnFx('paint_splatter', p.x + Math.cos(a)*r, p.y + Math.sin(a)*r, { life: 0.5 });
            }
            ctx.restore();
        } else if (p.type === 'satiety_aura') {
            const count = p.count || 1;
            const r = 20 + count * 5;
            const alpha = Math.max(0, p.life / 0.8);
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * (1 - alpha) + r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(243, 156, 18, ${alpha})`;
            ctx.lineWidth = 2 + count;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 1.5 * (1 - alpha) + r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(241, 196, 15, ${alpha * 0.5})`;
            ctx.lineWidth = 1 + count * 0.5;
            ctx.stroke();
        } else if (p.type === 'mana_steal_proj') {
            p.t = Math.min((p.t || 0) + 0.02, 1);
            p.x += p.vx; p.y += p.vy;
            
            if (p.targetX !== undefined && p.targetY !== undefined) {
                const distSq = Math.pow(p.targetX - p.x, 2) + Math.pow(p.targetY - p.y, 2);
                if (distSq < Math.pow(Math.max(Math.abs(p.vx), Math.abs(p.vy)) + p.size, 2)) {
                    p.life = 0;
                    this.fxSystem.spawnFx('mana_burn_fx', p.targetX, p.targetY, { life: 0.5 });
                }
            }
            ctx.fillStyle = '#3498db'; // 파란색/보라색 마나 구슬
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            
            // 꼬리 이펙트
            this.fxSystem.particles.push({ type: 'low_lifesteal', x: p.x, y: p.y, tx: p.x - p.vx*2, ty: p.y - p.vy*2, t: 0, life: 0.2 });
        } else if (p.type === 'banana_proj') {
            p.t = Math.min((p.t || 0) + 0.02, 1);
            p.x += p.vx; p.y += p.vy;
            p.rotation = (p.rotation || 0) + 0.3;
            
            if (p.targetX !== undefined && p.targetY !== undefined) {
                const distSq = Math.pow(p.targetX - p.x, 2) + Math.pow(p.targetY - p.y, 2);
                if (distSq < Math.pow(Math.max(Math.abs(p.vx), Math.abs(p.vy)) + p.size, 2)) {
                    p.life = 0; // die
                }
            }
            
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0.2*Math.PI, 0.8*Math.PI);
            ctx.arc(0, -p.size/2, p.size*1.2, 0.8*Math.PI, 0.2*Math.PI, true);
            ctx.fill();
        } else if (p.type === 'fire_red_proj') {
            p.t = Math.min((p.t || 0) + 0.02, 1);
            p.x += p.vx; p.y += p.vy;
            
            if (p.targetX !== undefined && p.targetY !== undefined) {
                const distSq = Math.pow(p.targetX - p.x, 2) + Math.pow(p.targetY - p.y, 2);
                if (distSq < Math.pow(Math.max(Math.abs(p.vx), Math.abs(p.vy)) + p.size, 2)) {
                    p.life = 0;
                    this.fxSystem.spawnFx('aoe_ripple', p.targetX, p.targetY, { life: 0.5, color: '#e74c3c', size: 30 });
                    for(let i=0; i<8; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const s = Math.random() * 3 + 1;
                        this.fxSystem.particles.push({ type: 'low_hit', x: p.targetX, y: p.targetY, vx: Math.cos(a)*s, vy: Math.sin(a)*s, color: '#e74c3c', life: 0.5, maxLife: 0.5 });
                    }
                }
            }
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'mana_burn_fx') {
            if (!p.particles) {
                p.particles = Array.from({ length: 6 }, () => ({
                    x: p.x + (Math.random() * 20 - 10),
                    y: p.y + (Math.random() * 10 - 5),
                    vy: -(Math.random() * 2 + 1),
                    vx: (Math.random() * 1 - 0.5),
                    l: Math.random() * 0.5 + 0.3,
                    size: Math.random() * 3 + 2
                }));
            }
            p.particles.forEach(pt => {
                pt.x += pt.vx; pt.y += pt.vy;
                pt.l -= 0.01;
                if (pt.l > 0) {
                    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * pt.l, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(155, 89, 182, ${pt.l})`; ctx.fill();
                }
            });
        } else if (p.type === 'donation_beam') {
            // 위에서부터 타겟으로 떨어지는 거대한 황금/빛 기둥
            const t = p.life / p.maxLife; // 1 -> 0
            if (p.delay > 0) {
                p.delay -= 0.016;
            } else {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const height = 400 * Math.sin(t * Math.PI); // 위아래로 쭉 뻗는 길이
                const width = 40 * Math.sin(t * Math.PI);
                const grad = ctx.createLinearGradient(p.x - width, 0, p.x + width, 0);
                grad.addColorStop(0, 'rgba(255,255,150,0)');
                grad.addColorStop(0.5, `rgba(255,255,255,${t})`);
                grad.addColorStop(1, 'rgba(255,255,150,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(p.x - width, p.y - height, width * 2, height);
                // 중심부 기둥
                ctx.fillStyle = `rgba(255,255,200,${t * 0.8})`;
                ctx.fillRect(p.x - width * 0.3, p.y - height, width * 0.6, height);
                ctx.restore();
            }
        } else if (p.type === 'golden_feather') {
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.02; // 중력
            p.rot += 0.05;
            p.vx *= 0.98; // 공기 저항
            const t = p.life / p.maxLife;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(t, t);
            ctx.fillStyle = `rgba(255, 215, 0, ${t})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, 4, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (p.type === 'quant_chart') {
            const t = 1 - (p.life / p.maxLife); // 0 -> 1
            ctx.save();
            ctx.translate(p.x - 100, p.y + 50);
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            
            const points = [
                {x: 20, y: -10}, {x: 40, y: 10}, {x: 60, y: -30}, 
                {x: 80, y: -10}, {x: 100, y: -60}, {x: 120, y: -40},
                {x: 140, y: -100}, {x: 160, y: -80}, {x: 200, y: -250}
            ];
            
            const currentPoints = Math.max(1, Math.floor(t * points.length));
            for(let i=0; i<currentPoints; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();

            // 주식 떡상 텍스트
            if (t > 0.3) {
                ctx.fillStyle = `rgba(46, 204, 113, ${Math.min(1, t * 2)})`;
                ctx.font = 'bold 30px sans-serif';
                ctx.fillText('📈 주식 떡상!', 100, -100 - (t * 50));
            }
            ctx.restore();
        } else if (p.type === 'gold_gain') {
            const t = p.life / p.maxLife;
            p.y -= 1; // 위로 떠오름
            ctx.save();
            ctx.translate(p.x, p.y);
            
            // 동전
            ctx.beginPath();
            ctx.arc(0, 0, 15 * t, 0, Math.PI * 2);
            ctx.fillStyle = '#f1c40f';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#d35400';
            ctx.stroke();

            // +1G 텍스트
            ctx.fillStyle = `rgba(255, 255, 255, ${t})`;
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+1G', 0, 0);
            ctx.restore();
        }

        ctx.restore();
    }
}
