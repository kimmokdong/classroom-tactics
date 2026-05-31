/**
 * FxSystem - 파티클 이펙트 생성(spawnFx) 시스템
 * BattleRenderer에서 분리된 파티클 초기화 로직
 */
export class FxSystem {
    constructor(renderer) {
        this.renderer = renderer;
    }

    get particles() { return this.renderer.particles; }
    get ctx() { return this.renderer.ctx; }
    get fxCanvas() { return this.renderer.fxCanvas; }

    getCellCenter(idx) { return this.renderer.getCellCenter(idx); }

    spawnFx(type, x, y, options = {}) {
        const TAU = Math.PI * 2;
        const R = (a, b) => Math.random() * (b - a) + a;
        const RI = (a, b) => Math.floor(R(a, b));
        
        const lowTierIds = [
            'u1_1','u1_2','u1_3','u1_4','u1_5','u1_6','u1_7','u1_8','u1_9','u1_10',
            'u2_1','u2_2','u2_3','u2_4','u2_5','u2_6','u2_7','u2_8','u2_9','u2_10','u2_11','u2_12',
            'u3_1','u3_2','u3_3','u3_4','u3_5','u3_6','u3_7','u3_8','u3_9','u3_10','u3_11','u3_12'
        ];
        if (lowTierIds.includes(type)) {
            const targets = options.targets || [];
            switch(type) {
                case 'u1_1':
                    this.particles.push({ type: 'low_aoe_ring', x: x, y: y, r: 0, maxR: 80, life: 2.0, maxLife: 2.0, color: '#ffaa44' });
                    targets.forEach(tIdx => {
                        const t = this.getCellCenter(tIdx);
                        this.particles.push({ type: 'low_aoe_ring', x: t.x, y: t.y, r: 0, maxR: 32, life: 2.0, maxLife: 2.0, color: '#ff8844' });
                    });
                    this.particles.push({ type: 'low_self_buff', x: x, y: y, r: 0, maxR: 28, life: 2.2, maxLife: 2.2, color: '#aaddff' });
                    break;
                case 'u1_2':
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        setTimeout(() => {
                            this.particles.push({ type: 'low_taunt', x: t.x, y: t.y, life: 2.5, maxLife: 2.5 });
                        }, 800);
                    }
                    break;
                case 'u1_3':
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_projectile', x: x, y: y, tx: t.x, ty: t.y, t: 0, life: 2.5, maxLife: 2.5, color: '#88ccff', size: 4 });
                        }, i * 400);
                    });
                    break;
                case 'u1_4':
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        this.particles.push({ type: 'low_projectile', x: x, y: y, tx: t.x, ty: t.y, t: 0, life: 2.5, maxLife: 2.5, color: '#cc66ff', size: 4, hitType: 'low_debuff' });
                    }
                    break;
                case 'u1_5':
                    this.particles.push({ type: 'low_passive', x: x, y: y, life: 3.0, maxLife: 3.0, text: '⚔️↑' });
                    this.particles.push({ type: 'low_self_buff', x: x, y: y, r: 0, maxR: 28, life: 2.2, maxLife: 2.2, color: '#ffdd88' });
                    break;
                case 'u1_6':
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        this.particles.push({ type: 'low_hit', x: t.x, y: t.y, t: 0, life: 2.0, maxLife: 2.0, color: '#ff9944' });
                    }
                    break;
                case 'u1_7':
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        this.particles.push({ type: 'low_projectile', x: x, y: y, tx: t.x, ty: t.y, t: 0, life: 2.5, maxLife: 2.5, color: '#ff6644', size: 4, hitType: 'low_hit' });
                        setTimeout(() => {
                            this.particles.push({ type: 'low_lifesteal', x: t.x, y: t.y, tx: x, ty: y, t: 0, life: 2.5, maxLife: 2.5 });
                        }, 800);
                    }
                    break;
                case 'u1_8':
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_heal', x: t.x, y: t.y, count: 8, life: 2.5, maxLife: 2.5 });
                        }, i * 450);
                    });
                    break;
                case 'u1_9':
                    this.particles.push({ type: 'low_shield', x: x, y: y, life: 2.5, maxLife: 2.5, color: '#cc9944' });
                    break;
                case 'u1_10':
                    this.particles.push({ type: 'low_self_buff', x: x, y: y, r: 0, maxR: 28, life: 2.2, maxLife: 2.2, color: '#4488ff' });
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_taunt', x: t.x, y: t.y, life: 2.5, maxLife: 2.5 });
                        }, i * 300);
                    });
                    break;
                case 'u2_1':
                    if (targets.length > 0) {
                        const centerTarget = this.getCellCenter(targets[0]);
                        this.particles.push({ type: 'low_aoe_ring', x: centerTarget.x, y: centerTarget.y, r: 0, maxR: 90, life: 2.2, maxLife: 2.2, color: '#aa66ff' });
                        targets.forEach((tIdx, i) => {
                            setTimeout(() => {
                                const t = this.getCellCenter(tIdx);
                                this.particles.push({ type: 'low_magic_hit', x: t.x, y: t.y, life: 2.0, maxLife: 2.0, color: '#aa66ff' });
                            }, i * 200 + 400);
                        });
                    }
                    break;
                case 'u2_2':
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        setTimeout(() => {
                            this.particles.push({ type: 'low_taunt', x: t.x, y: t.y, life: 2.5, maxLife: 2.5 });
                        }, 800);
                    }
                    break;
                case 'u2_3':
                    this.particles.push({ type: 'low_self_buff', x: x, y: y, r: 0, maxR: 50, life: 2.2, maxLife: 2.2, color: '#ffcc44' });
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_debuff', x: t.x, y: t.y, count: 6, life: 2.5, maxLife: 2.5, color: '#cc44ff' });
                        }, i * 300 + 400);
                    });
                    break;
                case 'u2_4':
                    if (targets.length > 0) {
                        const pts = [{x: x, y: y}, ...targets.map(tIdx => this.getCellCenter(tIdx))];
                        this.particles.push({ type: 'low_bounce', pts: pts, seg: 0, t: 0, life: 4.5, maxLife: 4.5, color: '#88aaff' });
                    }
                    break;
                case 'u2_5':
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        this.particles.push({ type: 'low_projectile', x: x, y: y, tx: t.x, ty: t.y, t: 0, life: 2.5, maxLife: 2.5, color: '#ff44aa', size: 5, hitType: 'low_magic_hit' });
                    }
                    break;
                case 'u2_6':
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_projectile', x: x, y: y, tx: t.x, ty: t.y, t: 0, life: 2.5, maxLife: 2.5, color: '#ff88cc', size: 4, hitType: 'low_debuff' });
                        }, i * 400);
                    });
                    break;
                case 'u2_7':
                    // 급식 당번 전체 힐 국소 이펙트: 시전자 위치에서 작은 링(maxR: 60)만 발생
                    this.particles.push({ type: 'low_aoe_ring', x: x, y: y, r: 0, maxR: 60, life: 2.2, maxLife: 2.2, color: '#2ecc71' });
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_heal', x: t.x, y: t.y, count: 6, life: 2.5, maxLife: 2.5 });
                        }, i * 200 + 400);
                    });
                    break;
                case 'u2_8':
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        setTimeout(() => {
                            this.particles.push({ type: 'low_aoe_ring', x: t.x, y: t.y, r: 0, maxR: 30, life: 2.0, maxLife: 2.0, color: '#ff6622' });
                            this.particles.push({ type: 'low_passive', x: x, y: y, life: 3.0, maxLife: 3.0, text: '⚔️↑' });
                        }, 200);
                    }
                    break;
                case 'u2_9':
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_shield', x: t.x, y: t.y, life: 2.5, maxLife: 2.5, color: '#88ccff' });
                        }, i * 450);
                    });
                    break;
                case 'u2_10':
                    this.particles.push({ type: 'low_aoe_ring', x: x, y: y, r: 0, maxR: 50, life: 2.2, maxLife: 2.2, color: '#cc44ff' });
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_debuff', x: t.x, y: t.y, count: 8, life: 2.5, maxLife: 2.5, color: '#cc44ff' });
                        }, i * 300 + 400);
                    });
                    break;
                case 'u3_1':
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        setTimeout(() => {
                            this.particles.push({ type: 'low_aoe_ring', x: t.x, y: t.y, r: 0, maxR: 20, life: 2.0, maxLife: 2.0, color: '#ffdd44' });
                        }, 200);
                    }
                    break;
                case 'u3_2':
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_heal', x: t.x, y: t.y, count: 10, life: 2.5, maxLife: 2.5 });
                            this.particles.push({ type: 'low_shield', x: t.x, y: t.y, life: 2.5, maxLife: 2.5, color: '#88ffcc' });
                        }, i * 450);
                    });
                    break;
                case 'u3_3':
                    this.particles.push({ type: 'low_self_buff', x: x, y: y, r: 0, maxR: 35, life: 2.2, maxLife: 2.2, color: '#ffaa22' });
                    this.particles.push({ type: 'low_passive', x: x, y: y, life: 3.0, maxLife: 3.0, text: '⚡↑' });
                    break;
                case 'u3_4':
                    if (targets.length > 0) {
                        const centerTarget = this.getCellCenter(targets[0]);
                        this.particles.push({ type: 'low_projectile', x: x, y: y, tx: centerTarget.x, ty: centerTarget.y, t: 0, life: 2.5, maxLife: 2.5, color: '#ff8833', size: 5, hitType: 'low_hit' });
                        setTimeout(() => {
                            this.particles.push({ type: 'low_aoe_ring', x: centerTarget.x, y: centerTarget.y, r: 0, maxR: 90, life: 2.2, maxLife: 2.2, color: '#ff8833' });
                        }, 800);
                    }
                    break;
                case 'u3_5':
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        this.particles.push({ type: 'low_projectile', x: x, y: y, tx: t.x, ty: t.y, t: 0, life: 2.5, maxLife: 2.5, color: '#aa66ff', size: 6, hitType: 'low_magic_hit' });
                    }
                    break;
                case 'u3_6':
                    if (targets.length > 0) {
                        const pts = [{x: x, y: y}, ...targets.map(tIdx => this.getCellCenter(tIdx))];
                        this.particles.push({ type: 'low_bounce', pts: pts, seg: 0, t: 0, life: 4.5, maxLife: 4.5, color: '#66ddaa' });
                        targets.forEach((tIdx, i) => {
                            setTimeout(() => {
                                const t = this.getCellCenter(tIdx);
                                this.particles.push({ type: 'low_passive', x: t.x, y: t.y, life: 3.0, maxLife: 3.0, text: '💚↓' });
                            }, i * 500 + 600);
                        });
                    }
                    break;
                case 'u3_7':
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        this.particles.push({ type: 'low_projectile', x: x, y: y, tx: t.x, ty: t.y, t: 0, life: 2.5, maxLife: 2.5, color: '#4488ff', size: 5, hitType: 'low_magic_hit' });
                        setTimeout(() => {
                            this.particles.push({ type: 'low_mana_burn', x: t.x, y: t.y, life: 2.5, maxLife: 2.5 });
                        }, 800);
                    }
                    break;
                case 'u3_8':
                    // 오케스트라 단장 전체 힐 국소 이펙트: 시전자 위치에서 작은 링(maxR: 60)만 발생
                    this.particles.push({ type: 'low_aoe_ring', x: x, y: y, r: 0, maxR: 60, life: 2.2, maxLife: 2.2, color: '#9b59b6' });
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_heal', x: t.x, y: t.y, count: 8, life: 2.5, maxLife: 2.5 });
                            this.particles.push({ type: 'low_mana_buff', x: t.x, y: t.y, life: 2.5, maxLife: 2.5 });
                        }, i * 200 + 400);
                    });
                    break;
                case 'u3_9':
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_magic_hit', x: t.x, y: t.y, life: 2.0, maxLife: 2.0, color: '#ff88aa' });
                            this.particles.push({ type: 'low_debuff', x: t.x, y: t.y, count: 6, life: 2.5, maxLife: 2.5, color: '#ff88aa' });
                        }, i * 400);
                    });
                    break;
                case 'u2_11':
                    // 진로진학 멘토 (단일 힐 + 단일 딜)
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]); // 적군 딜 타겟 (SkillEngine이 1개만 보냄)
                        this.particles.push({ type: 'low_heal', x: x, y: y, count: 5, life: 2.5, maxLife: 2.5 });
                        setTimeout(() => {
                            this.particles.push({ type: 'low_projectile', x: x, y: y, tx: t.x, ty: t.y, t: 0, life: 2.5, maxLife: 2.5, color: '#ffffff', size: 5, hitType: 'low_magic_hit' });
                        }, 200);
                    }
                    break;
                case 'u2_12':
                    // 칠판 낙서꾼 (광역 딜 디버프)
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        this.particles.push({ type: 'low_projectile', x: x, y: y, tx: t.x, ty: t.y, t: 0, life: 1.5, maxLife: 1.5, color: '#ff33cc', size: 6, hitType: 'u2_12_boom', targets: targets });
                    }
                    break;
                case 'u3_10':
                    // 미술 치료사 (단일 실드/디버프해제)
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        this.particles.push({ type: 'low_shield', x: t.x, y: t.y, life: 2.5, maxLife: 2.5, color: '#99ffaa' });
                        this.particles.push({ type: 'low_heal', x: t.x, y: t.y, count: 4, life: 2.5, maxLife: 2.5 });
                    }
                    break;
                case 'u3_11':
                    // 또래 상담 에이스 (범위 실드 CC면역)
                    this.particles.push({ type: 'low_aoe_ring', x: x, y: y, r: 0, maxR: 110, life: 2.2, maxLife: 2.2, color: '#ccffff' });
                    targets.forEach((tIdx, i) => {
                        setTimeout(() => {
                            const t = this.getCellCenter(tIdx);
                            this.particles.push({ type: 'low_shield', x: t.x, y: t.y, life: 2.5, maxLife: 2.5, color: '#ccffff' });
                            // CC면역 텍스트
                            this.particles.push({ type: 'low_passive', x: t.x, y: t.y - 40, text: 'CC 면역!', life: 2.0, maxLife: 2.0, color: '#88ffff' });
                        }, i * 150 + 200);
                    });
                    break;
                case 'u3_12':
                    // 해외 보따리상 (단일 딜, 처형)
                    if (targets.length > 0) {
                        const t = this.getCellCenter(targets[0]);
                        this.particles.push({ type: 'low_projectile', x: x, y: y, tx: t.x, ty: t.y, t: 0, life: 2.5, maxLife: 2.5, color: '#ffdd22', size: 7, hitType: 'low_hit' });
                        setTimeout(() => {
                            this.particles.push({ type: 'low_aoe_ring', x: t.x, y: t.y, r: 0, maxR: 40, life: 2.0, maxLife: 2.0, color: '#ffdd22' });
                            this.particles.push({ type: 'gold_gain', x: t.x, y: t.y - 30, life: 2.0, maxLife: 2.0 });
                        }, 800);
                    }
                    break;
            }
            return;
        }
        
        if (type === 'school_beaker') {
            this.particles.push({
                type: 'school_beaker_proj',
                x: x,
                y: y,
                startX: x,
                startY: y,
                tx: options.targetX !== undefined ? options.targetX : x,
                ty: options.targetY !== undefined ? options.targetY : y,
                t: 0,
                rot: 0,
                done: false,
                life: 1.0,
                maxLife: 1.0
            });
            return;
        } else if (type === 'school_beaker_splash') {
            const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
            dirs.forEach(([dx,dy]) => {
                for (let i = 0; i < 18; i++) {
                    this.particles.push({ type: 'school_beaker_puddle', x, y, tx: x + dx*(i+1)*9, ty: y + dy*(i+1)*9, t: 0, maxT: i*0.06+0.1, life: 3.5, maxLife: 3.5, r: R(6,14) });
                }
            });
            for (let i = 0; i < 40; i++) {
                const a = R(0, TAU), spd = R(2,8);
                this.particles.push({ type: 'school_beaker_part', x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd-R(1,4), life: R(0.8,2.0), maxLife: 2.0, size: R(2,6) });
            }
            return;
        } else if (type === 'school_slam') {
            for (let i = 0; i < 10; i++) {
                const a = R(0, TAU), len = R(30, 80);
                const pts = [[x, y]];
                let cx = x, cy = y, ca = a;
                for (let j = 0; j < 8; j++) {
                    ca += R(-0.4, 0.4);
                    cx += Math.cos(ca)*(len/8); cy += Math.sin(ca)*(len/8);
                    pts.push([cx, cy]);
                }
                this.particles.push({ type: 'school_slam_crack', pts, life: 2.5, maxLife: 2.5, progress: 0 });
            }
            for (let i = 0; i < 60; i++) {
                const a = R(0, TAU), spd = R(1, 7);
                this.particles.push({ type: 'school_slam_dust', x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd-R(1,5), life: R(0.8, 2.0), maxLife: 2.0, size: R(3,10), hue: R(30,60) });
            }
            this.particles.push({ type: 'school_slam_char', x, y, phase: 'jump', jumpT: 0, life: 2.2, maxLife: 2.2 });
            return;
        } else if (type === 'school_pen') {
            const tx = options.targetX !== undefined ? options.targetX : x;
            const ty = options.targetY !== undefined ? options.targetY : y;
            
            // 타겟 발밑에 회전하는 서예 마법진 생성
            this.particles.push({
                type: 'school_pen_circle',
                x: tx,
                y: ty,
                rot: 0,
                life: 0.6,
                maxLife: 0.6,
                targetY: ty
            });
            
            // 350ms 후 하늘 높은 곳에서 거대한 붓펜이 떨어지도록 딜레이 소환
            setTimeout(() => {
                if (this.renderer && (this.renderer.canvas || this.renderer.fxCanvas) && this.particles) {
                    this.particles.push({
                        type: 'school_pen_proj',
                        x: tx,
                        y: ty - 300,
                        targetY: ty,
                        vy: 8,
                        done: false,
                        rot: -0.4,
                        life: 1.5,
                        maxLife: 1.5
                    });
                }
            }, 350);
            return;
        } else if (type === 'school_pen_splash') {
            // 강렬한 화면 흔들림 및 플래시 작동
            this.particles.push({ type: 'school_principal_shake', power: 15, life: 0.6, maxLife: 0.6 });
            if (this.renderer) {
                this.renderer.screenFlash = 0.55;
            }
            
            // 붓글씨 파열 마크 생성
            this.particles.push({ type: 'school_pen_mark', x, y, progress: 0, life: 3.5, maxLife: 3.5 });
            
            // 황금빛 및 붉은색 충격파 고리 생성
            this.particles.push({ type: 'low_aoe_ring', x, y, r: 0, maxR: 120, life: 1.0, maxLife: 1.0, color: '#ff2233' });
            this.particles.push({ type: 'low_aoe_ring', x, y, r: 0, maxR: 70, life: 0.7, maxLife: 0.7, color: '#ffaa44' });

            // 잉크 및 불꽃 파티클 대량 분사
            for (let i = 0; i < 45; i++) {
                const a = R(0, TAU);
                const spd = R(3, 10);
                this.particles.push({
                    type: 'school_pen_ink',
                    x,
                    y,
                    vx: Math.cos(a) * spd,
                    vy: Math.sin(a) * spd - R(2, 6),
                    life: R(1.0, 2.5),
                    maxLife: 2.5,
                    size: R(3, 9)
                });
            }
            for (let i = 0; i < 20; i++) {
                const a = R(0, TAU);
                const spd = R(2, 6);
                this.particles.push({
                    type: 'school_beaker_part',
                    x,
                    y,
                    vx: Math.cos(a) * spd,
                    vy: Math.sin(a) * spd - R(1, 4),
                    life: R(0.5, 1.5),
                    maxLife: 1.5,
                    size: R(2, 4),
                    color: '#ffdd00'
                });
            }
            return;
        } else if (type === 'school_shield') {
            for (let i = 0; i < 6; i++) {
                this.particles.push({ type: 'school_shield_wave', x, y, r: 0, maxR: 200, life: 2.0, maxLife: 2.0, delay: i*0.15 });
            }
            this.particles.push({ type: 'school_shield_char', x, y, life: 2.0, maxLife: 2.0 });
            if (options.targets) {
                options.targets.forEach(tIdx => {
                    const tCenter = this.getCellCenter(tIdx);
                    this.particles.push({ type: 'school_shield_hex', x: tCenter.x, y: tCenter.y, r: 0, maxR: 22, life: 3.5, maxLife: 3.5, delay: 0.8, sparkles: Array.from({length:8}, (_,i) => ({a: i/8*TAU, r: 0, life: 1})) });
                });
            }
            return;
        } else if (type === 'school_heal') {
            this.particles.push({ type: 'school_heal_wing', life: 2.5, maxLife: 2.5, wingAlpha: 0.7, wingPhase: 0, crossAlpha: 0.8 });
            if (options.targets) {
                const W = this.fxCanvas.width || 800, H = this.fxCanvas.height || 600;
                for (let i = 0; i < 80; i++) {
                    const a = R(0, TAU), r = R(10, W*0.45);
                    const tCenter = this.getCellCenter(options.targets[RI(0, options.targets.length)]);
                    this.particles.push({ type: 'school_heal_firefly', x: W*0.5+Math.cos(a)*r, y: H*0.5+Math.sin(a)*r, tx: tCenter.x, ty: tCenter.y, t: 0, speed: R(0.002, 0.008), life: R(2,5), maxLife: 5, size: R(2,5), hue: R(100,160), phase: R(0,TAU) });
                }
            }
            return;
        } else if (type === 'school_donation') {
            // 기부천사 액티브 글로벌 스킬: 거대한 천사의 날개와 황금/흰색 파티클 샤워
            this.particles.push({ type: 'school_heal_wing', life: 3.5, maxLife: 3.5, wingAlpha: 1.0, wingPhase: 0, crossAlpha: 1.0 });
            if (this.renderer) this.renderer.screenFlash = 0.6;
            const W = this.fxCanvas.width || 800, H = this.fxCanvas.height || 600;
            
            // 거대한 빛 링 확산
            this.particles.push({ type: 'low_aoe_ring', x: W/2, y: H/2, r: 0, maxR: W, life: 3.5, maxLife: 3.5, color: '#ffffaa' });
            this.particles.push({ type: 'donation_global_circle', x: W/2, y: H/2, maxR: W * 0.7, life: 3.5, maxLife: 3.5 });
            
            // 깃털 파티클
            for (let i = 0; i < 40; i++) {
                this.particles.push({ 
                    type: 'golden_feather', 
                    x: W/2 + R(-100, 100), 
                    y: H/2 + R(-100, 100), 
                    vx: R(-3, 3), vy: R(1, 4), 
                    rot: R(0, TAU), 
                    life: R(2, 4), maxLife: 4 
                });
            }

            // 무작위 글로벌 빛기둥 빔 (타겟 유무 관계없이 맵 전역에 꽂힘)
            for (let i = 0; i < 12; i++) {
                const rx = R(50, W - 50);
                const ry = R(50, H - 50);
                this.particles.push({ type: 'donation_beam', x: rx, y: ry, life: 1.5, maxLife: 1.5, delay: R(0.1, 1.2) });
            }

            if (options.targets && options.targets.length > 0) {
                options.targets.forEach((tIdx, idx) => {
                    const t = this.getCellCenter(tIdx);
                    // 타겟마다 빛 기둥 꽂힘
                    this.particles.push({ type: 'donation_beam', x: t.x, y: t.y, life: 1.5, maxLife: 1.5, delay: R(0, 0.4) });
                    this.particles.push({ type: 'holy_heal', x: t.x, y: t.y, life: 2.0 });
                    // 타겟 주변 반짝임
                    for (let i=0; i<8; i++) {
                        this.particles.push({ type: 'school_heal_firefly', x: t.x + R(-40,40), y: t.y + R(-40,40), tx: t.x, ty: t.y, t: 0, speed: 0, life: R(2.0,3.5), maxLife: 3.5, size: R(4,8), hue: 50, phase: R(0,TAU) });
                    }
                });
            }
            return;
        } else if (type === 'school_quant') {
            if (this.renderer) this.renderer.screenFlash = 0.5;
            
            if (options.targets) {
                options.targets.forEach((tIdx) => {
                    const t = this.getCellCenter(tIdx);
                    // 타겟 중심에 축소된 차트 이펙트 스폰
                    this.particles.push({ type: 'quant_chart', x: t.x, y: t.y, life: 2.5, maxLife: 2.5 });
                    
                    this.particles.push({ type: 'low_hit', x: t.x, y: t.y, life: 1.0, color: '#ff3333' });
                    // 빨간 기둥 폭발 (주식 하락 타격)
                    for(let i=0; i<15; i++) {
                        const a = R(0, TAU), s = R(2, 8);
                        this.particles.push({ type: 'aug_heal_bomb_spark', x: t.x, y: t.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: R(0.5, 1.2), maxLife: 1.2, size: R(3,6), hue: 0 }); // Red
                    }
                });
            }
            return;
        } else if (type === 'school_piano') {
            const H = this.fxCanvas.height || 600;
            for (let i = 0; i < 5; i++) {
                this.particles.push({ type: 'school_piano_staff', y: H*0.3+i*12, progress: 0, life: 2.5, maxLife: 2.5, delay: i*0.08 });
            }
            const noteSyms = ['♩', '♪', '♫', '♬'];
            if (options.targets) {
                for (let i = 0; i < 12; i++) {
                    const tCenter = this.getCellCenter(options.targets[RI(0, options.targets.length)]);
                    this.particles.push({ type: 'school_piano_note', x, y, tx: tCenter.x, ty: tCenter.y, t: 0, speed: R(0.005, 0.01), sym: noteSyms[RI(0,4)], isEnemy: true, life: 2, maxLife: 2, delay: i*0.1, size: R(14,20) });
                }
            }
            return;
        } else if (type === 'school_math') {
            const formulas = ['∫dx','∑n','π²','E=mc²','∂/∂x','lim→','√2','∞','01010','11001'];
            for (let i = 0; i < 10; i++) {
                this.particles.push({ type: 'school_math_orbit', text: formulas[i], angle: (i/10)*TAU, orbitR: R(45,70), speed: R(0.008,0.02)*(Math.random()>0.5?1:-1), cx: x, cy: y, life: 5, maxLife: 5, size: R(9,13), alpha: 0 });
            }
            this.particles.push({ type: 'school_math_aura', x, y, alpha: 1, r: 0, eyeGlow: 1, life: 5, maxLife: 5 });
            return;
        } else if (type === 'school_principal') {
            const H = this.fxCanvas.height || 600, W = this.fxCanvas.width || 800;
            this.particles.push({ type: 'school_principal_text', x: W*0.5, y: -60, vy: 0, life: 3.5, maxLife: 3.5, landed: false });
            return;
        } else if (type === 'school_principal_splash') {
            const H = this.fxCanvas.height || 600, W = this.fxCanvas.width || 800;
            this.particles.push({ type: 'school_principal_shake', power: 12, life: 2.0, maxLife: 2.0 });
            for (let i = 0; i < 60; i++) {
                const a = R(0, TAU), spd = R(1,6);
                this.particles.push({ type: 'school_principal_fog', x: W*0.5+R(-80,80), y: H*0.55+R(-20,20), vx: Math.cos(a)*spd*0.3, vy: Math.sin(a)*spd*0.3-R(0,1), life: R(2.0,4.0), maxLife: 4.0, size: R(15,40), alpha: R(0.2,0.5) });
            }
            for (let i = 0; i < 50; i++) {
                const a = R(0, TAU), spd = R(2,8);
                this.particles.push({ type: 'school_principal_star', x: R(0,W), y: R(H*0.3,H*0.8), vx: Math.cos(a)*spd, vy: Math.sin(a)*spd-R(1,4), life: R(1.0,2.0), maxLife: 2.0, size: R(8,14) });
            }
            return;
        } else if (type === 'school_picasso') {
            const H = this.fxCanvas.height || 600, W = this.fxCanvas.width || 800;
            const colors = ['#ff3333','#3366ff','#ffdd00','#33cc33','#ff66cc','#ff8800'];
            const color = colors[RI(0, colors.length)];
            this.particles.push({ type: 'school_picasso_brush', x: -20, y: H*0.5+R(-20,20), progress: 0, life: 2.5, maxLife: 2.5, color, width: R(18,30), wave: R(0.05,0.12), amp: R(10,25) });
            for (let i = 0; i < 20; i++) {
                const c = colors[RI(0, colors.length)];
                const px = R(20, W-20), py = R(20, H-20);
                const drops = [];
                for(let j = 0; j < 6; j++) {
                    const a = R(0, TAU), d = R(5,25);
                    drops.push({x: px+Math.cos(a)*d, y: py+Math.sin(a)*d, r: R(2,7), life: 2.5, maxLife: 2.5, color: c});
                }
                this.particles.push({ type: 'school_picasso_splatter', x: px, y: py, r: 0, maxR: R(8,22), life: 2.5, maxLife: 2.5, color: c, delay: R(0.4,1.2), drops });
            }
            return;
        } else if (type === 'school_blackhole') {
            const tx = options.targetX !== undefined && options.targetX !== null ? options.targetX : x;
            const ty = options.targetY !== undefined && options.targetY !== null ? options.targetY : y;
            const debris = [];
            const TAU = Math.PI * 2;
            const R = (a, b) => Math.random() * (b - a) + a;
            for(let i=0; i<120; i++) {
                const a = R(0, TAU), dist = R(40, 200);
                debris.push({
                    x: tx + Math.cos(a)*dist, y: ty + Math.sin(a)*dist,
                    angle: a, dist, orbitSpd: R(0.015, 0.05) * (Math.random()>0.5?1:-1),
                    inSpd: R(0.4, 1.2), life: 3.5, maxLife: 3.5,
                    size: R(2, 6), hue: R(240, 310)
                });
            }
            this.particles.push({ type: 'school_blackhole', x: tx, y: ty, r: 0, maxR: 120, phase: 0, life: 3.5, maxLife: 3.5, debris, nova: null, exploded: false });
            return;
        } else if (type === 'school_foreign') {
            const TAU = Math.PI * 2;
            const R = (a, b) => Math.random() * (b - a) + a;
            const auraParticles = [];
            for(let i=0; i<80; i++) {
                const a = R(0, TAU), spd = R(2, 8);
                auraParticles.push({
                    x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
                    life: R(0.8, 2.5), maxLife: 2.5,
                    size: R(3, 10), hue: R(40, 60), burst: true
                });
            }
            const projectiles = [];
            let delay = 0;
            if (options.targets) {
                options.targets.forEach(tIdx => {
                    const t = this.getCellCenter(tIdx);
                    if (!t) return;
                    for(let k=0; k<3; k++) {
                        projectiles.push({
                            x, y, tx: t.x + R(-10, 10), ty: t.y + R(-10, 10),
                            t: 0, speed: 0.015, size: R(12, 20), trail: [], startDelay: delay
                        });
                        delay += 0.36;
                    }
                });
            }
            this.particles.push({ type: 'school_foreign', x, y, life: 5.5, maxLife: 5.5, auraPower: 0, auraParticles, projectiles, impacts: [], time: 0 });
            return;
        }

        // [미술 시너지] 색채의 캔버스 장판 이펙트
        if (type === 'art_canvas') {
            this.particles.push({
                type: 'art_canvas',
                x: x,
                y: y,
                radius: 0,
                maxRadius: options.maxRadius || 84,
                life: options.life || 5.0,
                maxLife: options.maxLife || 5.0
            });
            return;
        }

        if (type === 'aug_heal_bomb') {
            const xVal = x, yVal = y;
            for (let i = 0; i < 2; i++) {
                this.particles.push({
                    type: 'aug_heal_bomb_wave',
                    x: xVal, y: yVal, r: 10, maxR: 70 + i * 20,
                    life: 1.0, maxLife: 1.0, speed: 0.05 - i * 0.01
                });
            }
            for (let i = 0; i < 35; i++) {
                const angle = R(0, TAU);
                const speed = R(2.0, 7.0);
                this.particles.push({
                    type: 'aug_heal_bomb_spark',
                    x: xVal, y: yVal,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - R(0.5, 2.0),
                    life: R(0.6, 1.0), maxLife: 1.0,
                    size: R(3, 7), hue: R(110, 145)
                });
            }
            for (let i = 0; i < 10; i++) {
                const angle = R(0, TAU);
                const speed = R(1.5, 4.0);
                this.particles.push({
                    type: 'aug_heal_bomb_cross',
                    x: xVal, y: yVal,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - R(0, 1.2),
                    life: R(0.8, 1.3), maxLife: 1.3,
                    size: R(6, 10), rot: R(0, Math.PI), rotSpd: R(-0.05, 0.05)
                });
            }
            return;
        } else if (type === 'aug_mass_silence') {
            this.screenFlash = 0.5;
            this.particles.push({
                type: 'aug_mass_silence_noise',
                life: 0.4, maxLife: 0.4
            });
            const targets = options.targets || [];
            targets.forEach((tIdx, idx) => {
                setTimeout(() => {
                    const tPos = this.getCellCenter(tIdx);
                    if (!tPos) return;
                    this.particles.push({
                        type: 'aug_mass_silence_x',
                        x: tPos.x, y: tPos.y - 15,
                        life: 1.0, maxLife: 1.0, scale: 2.0,
                        sparks: Array.from({ length: 8 }, () => ({
                            a: R(0, Math.PI * 2),
                            spd: R(1.2, 3.5),
                            l: R(0.5, 1.0)
                        }))
                    });
                }, idx * 150);
            });
            return;
        } else if (type === 'aug_spirit_transfer') {
            const sx = x, sy = y;
            const tx = options.targetX, ty = options.targetY;
            if (tx === null || ty === null) return;
            
            this.particles.push({
                type: 'aug_spirit_transfer_meteor',
                x: sx, y: sy, tx: tx, ty: ty,
                t: 0, trail: [], life: 1.0, maxLife: 1.0, size: 12,
                targetHit: false
            });
            for (let i = 0; i < 15; i++) {
                const a = R(0, TAU);
                const spd = R(1, 3);
                this.particles.push({
                    type: 'aug_spirit_transfer_spark',
                    x: sx, y: sy,
                    vx: Math.cos(a) * spd,
                    vy: Math.sin(a) * spd - R(0, 1.0),
                    life: R(0.5, 0.8), maxLife: 0.8
                });
            }
            return;
        } else if (type === 'aug_thorn_reflect') {
            const sx = x, sy = y;
            const tx = options.targetX, ty = options.targetY;
            if (tx === null || ty === null) return;
            
            this.particles.push({
                type: 'aug_thorn_reflect_shield',
                x: sx, y: sy, life: 0.6, maxLife: 0.6, r: 25
            });
            const angleToAttacker = Math.atan2(ty - sy, tx - sx);
            for (let i = 0; i < 3; i++) {
                const spread = (i - 1) * 0.2;
                const a = angleToAttacker + spread;
                this.particles.push({
                    type: 'aug_thorn_reflect_spike',
                    x: sx + Math.cos(a) * 15,
                    y: sy + Math.sin(a) * 15,
                    vx: Math.cos(a) * 7.5,
                    vy: Math.sin(a) * 7.5,
                    angle: a,
                    life: 1.0, maxLife: 1.0,
                    length: R(14, 20), width: R(3, 5),
                    targetX: tx, targetY: ty,
                    done: false
                });
            }
            return;
        } else if (type === 'donation_items_buff') {
            // 전투 시작 시 기부천사 패시브 아이템 부여 이펙트 (이모지 배제, 상하좌우 아군에게 2D 벡터 투사체 발사)
            // SkillPreviewer에는 entities가 있고, BattleRenderer에서는 options.allyPositions로 전달받음
            const rawEntities = (this.renderer && this.renderer.entities) ? this.renderer.entities : [];
            let allyCoords = rawEntities.filter(e => !e.isEnemy && !e.isCaster).map(e => ({ x: e.x, y: e.y }));
            
            // BattleRenderer에서 전달한 아군 좌표 (인게임 환경)
            if (allyCoords.length === 0 && options.allyPositions && options.allyPositions.length > 0) {
                allyCoords = options.allyPositions;
            }
            
            // 시전자 주변(자신)에도 가벼운 황금 반짝임과 오라 형성
            for (let i = 0; i < 12; i++) {
                const a = R(0, TAU), spd = R(1.5, 4.0);
                this.particles.push({
                    type: 'aug_heal_bomb_spark',
                    x: x, y: y - 20,
                    vx: Math.cos(a) * spd,
                    vy: Math.sin(a) * spd - R(0.5, 2.0),
                    life: R(0.8, 1.6), maxLife: 1.6,
                    size: R(4, 9), hue: 50 // 황금빛
                });
            }
            this.particles.push({ type: 'low_shield', x: x, y: y, life: 2.0, maxLife: 2.0, color: '#ffea00' });

            const itemTypes = ['gift', 'sword', 'shield', 'stat'];
            allyCoords.forEach((ally, index) => {
                setTimeout(() => {
                    if (!this.renderer || !(this.renderer.canvas || this.renderer.fxCanvas) || !this.particles) return;
                    
                    // 아군 머리 위 허공에서 아이템이 뚝 떨어지는 연출
                    this.particles.push({
                        type: 'donation_item_projectile',
                        x: ally.x,
                        y: ally.y - 150, // 150px 위에서 시작
                        startX: ally.x,
                        startY: ally.y - 150,
                        tx: ally.x,
                        ty: ally.y - 15,
                        t: 0,
                        life: 1.0,
                        maxLife: 1.0,
                        icon: itemTypes[index % 4], // gift, sword, shield, stat (2D 벡터 드로잉 매핑)
                        trail: []
                    });
                }, index * 160);
            });
            return;
        } else if (type === 'donation_item_projectile') {
            // 외부에서 직접 1개의 기부 아이템을 떨어뜨리라고 명령할 때
            this.particles.push({
                type: 'donation_item_projectile',
                x: x,
                y: y,
                startX: x,
                startY: y,
                tx: options.tx || x,
                ty: options.ty || (y + 135),
                t: 0,
                life: 1.0,
                maxLife: 1.0,
                icon: options.icon || 'gift',
                trail: []
            });
            return;
        } else if (type === 'donation_confetti_burst') {
            // 아군에게 기부 아이템 닿았을 때 오색찬란한 생일 폭죽 효과 (이모지 없음)
            const colors = ['#ffa502', '#ff4757', '#2ed573', '#1e90ff', '#ff6b81', '#78e08f', '#eccc68', '#a855f7'];
            const confettiParts = [];
            for (let i = 0; i < 26; i++) {
                const angle = R(0, TAU);
                const speed = R(3.0, 7.5);
                confettiParts.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - R(1.5, 4.5),
                    color: colors[RI(0, colors.length)],
                    size: R(3.5, 8),
                    rot: R(0, TAU),
                    rotSpd: R(-0.2, 0.2),
                    life: R(1.2, 2.0),
                    maxLife: 2.0
                });
            }
            
            // 생일 폭죽 파티클
            this.particles.push({
                type: 'donation_confetti',
                x: x,
                y: y,
                parts: confettiParts,
                life: 2.0,
                maxLife: 2.0
            });
            
            // 아군 머리 위 'DONATION!' 텍스트 (가독성을 위해 아주 진한 검정색으로 변경)
            this.particles.push({ type: 'low_passive', x: x, y: y - 40, text: 'DONATION!', life: 2.2, maxLife: 2.2, color: '#000000' });
            this.particles.push({ type: 'low_shield', x: x, y: y, life: 2.2, maxLife: 2.2, color: '#ffea00' });
            return;
        } else if (type === 'u2_12_boom') {
            // 칠판 낙서꾼의 밀집 광역 침묵 폭발 (이모지 완전 제거)
            this.particles.push({ type: 'low_aoe_ring', x: x, y: y, r: 0, maxR: 90, life: 1.5, maxLife: 1.5, color: '#ff33cc' });
            
            const targets = options.targets || [];
            if (targets.length > 0) {
                targets.forEach(tIdx => {
                    const t = this.getCellCenter(tIdx);
                    if (!t) return;
                    this.particles.push({ type: 'low_debuff', x: t.x, y: t.y, count: 4, life: 1.5, maxLife: 1.5, color: '#ff33cc' });
                    this.particles.push({ type: 'low_passive', x: t.x, y: t.y - 45, text: 'SILENCE!', life: 2.2, maxLife: 2.2, color: '#ff33cc' });
                });
            } else {
                for (let i = 0; i < 10; i++) {
                    this.particles.push({ type: 'low_debuff', x: x + R(-40, 40), y: y + R(-40, 40), count: 2, life: 1.5, maxLife: 1.5, color: '#ff33cc' });
                }
                this.particles.push({ type: 'low_passive', x: x, y: y - 45, text: 'SILENCE!', life: 2.2, maxLife: 2.2, color: '#ff33cc' });
            }
            return;
        } else if (type === 'changche_1_hit') {
            // 창체 1 무장해제/침묵 이펙트
            const tx = x, ty = y;
            this.particles.push({ type: 'low_debuff', x: tx, y: ty, count: 6, life: 1.5, maxLife: 1.5, color: '#333333' });
            this.particles.push({ type: 'aug_mass_silence_noise', life: 0.3, maxLife: 0.3 }); // 찌그러짐
            return;
        } else if (type === 'changche_3_buff') {
            // 창체 3 진로탐색 스탯 증가 이펙트
            const tx = x, ty = y;
            this.particles.push({ type: 'low_self_buff', x: tx, y: ty, r: 0, maxR: 35, life: 1.5, maxLife: 1.5, color: '#aaeeff' });
            return;
        }

        this.particles.push({
            type: type,
            x: x, y: y,
            vx: options.vx || 0, vy: options.vy || 0,
            targetX: options.targetX !== undefined ? options.targetX : null,
            targetY: options.targetY !== undefined ? options.targetY : null,
            life: options.life || 0.5,
            maxLife: options.life || 0.5,
            size: options.size || 20,
            color: options.color || '#fff',
            angle: options.angle || 0,
            history: [{x:x, y:y}]
        });
    }
}
