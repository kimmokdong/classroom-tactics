import { FxSystem } from '../battle/FxSystem.js';
import { FxRenderer } from '../battle/FxRenderer.js';

export class SkillPreviewer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.unit = null;
        this.particles = [];
        this.entities = [];
        this.floatingTexts = []; // 데미지 / 힐 등 라이브 텍스트 배열
        this.fxSystem = null;
        this.fxRenderer = null;
        this.animationFrameId = null;
        this.lastTime = 0;
        this.manaRegenRate = 35; // 초당 마나 재생량
        this.passiveTimer = 0; // 마나가 없는 패시브 유닛의 스킬 시전 주기용 타이머
        this.screenFlash = 0; // 화면 플래시 강도
        this.time = 0; // 회전 이펙트 등을 위한 타이머
        
        // 4~5코스트 유닛 스킬 FxType 매핑 테이블
        this.fxTypeMap = {
            'u4_1': 'school_slam',
            'u4_2': 'school_math',
            'u4_3': 'school_beaker',
            'u4_4': 'school_pen',
            'u4_5': 'school_shield',
            'u4_6': 'school_heal',
            'u4_7': 'school_piano',
            'u5_1': 'school_foreign',
            'u5_2': 'school_blackhole',
            'u5_3': 'school_picasso',
            'u5_4': 'school_principal',
            'u4_8': 'school_quant'
        };
    }

    // FxSystem용 Mock 인터페이스 구현
    get fxCanvas() { return this.canvas; }

    /**
     * 특정 배치 인덱스의 좌표를 반환 (Mock getCellCenter)
     */
    getCellCenter(idx) {
        const entity = this.entities.find(e => e.idx === idx);
        return entity ? { x: entity.x, y: entity.y } : { x: 320, y: 170 };
    }

    /**
     * 스킬 프리뷰 시작
     * @param {HTMLCanvasElement} canvas - 프리뷰 캔버스 엘리먼트
     * @param {Object} unit - 도감에서 선택된 유닛 정보
     */
    start(canvas, unit) {
        this.stop(); // 기존 시뮬레이션 클리어

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.unit = unit;
        this.particles = [];
        this.floatingTexts = [];
        this.screenFlash = 0;
        this.passiveTimer = 0;
        this.time = 0;

        // Fx 시스템 초기화
        this.fxSystem = new FxSystem(this);
        this.fxRenderer = new FxRenderer(this.fxSystem);

        // 엔티티 배치 레이아웃 정의 (가로 640, 세로 340 기준)
        this.setupEntities(unit);

        // 프레임 루프 가동
        this.lastTime = performance.now();
        this.loop = (timestamp) => {
            try {
                const dt = (timestamp - this.lastTime) / 1000;
                this.lastTime = timestamp;
                
                // 너무 큰 dt 방지 (백그라운드 탭 진입 시)
                this.update(Math.min(dt, 0.1));
                this.draw();
            } catch (error) {
                console.error("Error in SkillPreviewer animation loop:", error);
                if (this.ctx && this.canvas) {
                    this.ctx.fillStyle = '#0f1f15';
                    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.font = '14px sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('시뮬레이션 로딩 중...', this.canvas.width / 2, this.canvas.height / 2);
                }
            }
            this.animationFrameId = requestAnimationFrame(this.loop);
        };
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    /**
     * 시뮬레이션 종료
     */
    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.ctx && this.canvas) {
            this.ctx.fillStyle = '#0f1f15';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.canvas = null;
        this.ctx = null;
        this.unit = null;
        this.particles = [];
        this.entities = [];
        this.floatingTexts = [];
        this.fxSystem = null;
        this.fxRenderer = null;
    }

    /**
     * 640x340 해상도에 맞추어 시전자, 아군, 적군의 위치와 마릿수를 동적으로 결정 (비주얼 최적화)
     */
    setupEntities(unit) {
        const skillType = unit.skill.type || '';
        this.entities = [];

        // 1. 시전자 기본 설정 (인덱스 0)
        let casterX = 120;
        let casterY = 170;

        // 스킬 범위 타입에 따라 시전자 최적 위치 설정
        if (unit.id === 'u5_5') {
            casterX = 220;
            casterY = 170;
        } else if (skillType.includes('taunt') || skillType.includes('aoe_damage_buff') || skillType === 'aoe_debuff') {
            // 시전자 주변 범위기이므로 시전자를 중앙에 배치
            casterX = 260;
            casterY = 170;
        }

        const caster = {
            id: 'caster',
            isCaster: true,
            isEnemy: false,
            icon: unit.icon,
            name: unit.name,
            x: casterX,
            y: casterY,
            hp: unit.stats.hp,
            maxHp: unit.stats.hp,
            mana: unit.stats.mana || 0,
            maxMana: unit.stats.maxMana !== undefined ? unit.stats.maxMana : 100,
            idx: 0,
            shakeTime: 0 // 피격/행동 시 흔들림 효과용
        };
        this.entities.push(caster);

        // 2. 스킬 특성에 맞춰 타겟 엔티티 추가 (단일 타겟, 3인 연쇄, 광역, 십자열 등)
        if (unit.id === 'u5_5') {
            // 기부천사 특화 상하좌우 아군 배치 + 적군 배치
            this.entities.push({ id: 'ally_1', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 (상)', x: casterX, y: casterY - 65, hp: 600, maxHp: 800, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'ally_2', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 (하)', x: casterX, y: casterY + 65, hp: 500, maxHp: 800, idx: 2, shakeTime: 0 });
            this.entities.push({ id: 'ally_3', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 (좌)', x: casterX - 65, y: casterY, hp: 550, maxHp: 800, idx: 3, shakeTime: 0 });
            this.entities.push({ id: 'ally_4', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 (우)', x: casterX + 65, y: casterY, hp: 700, maxHp: 800, idx: 4, shakeTime: 0 });
            
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 A', x: 450, y: 110, hp: 1000, maxHp: 1000, idx: 5, shakeTime: 0 });
            this.entities.push({ id: 'dummy_2', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 B', x: 450, y: 230, hp: 1000, maxHp: 1000, idx: 6, shakeTime: 0 });
        }
        else if (skillType === 'passive') {
            // 수학 짝꿍 패시브: 단일 허수아비 1마리
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비', x: 480, y: 170, hp: 1000, maxHp: 1000, idx: 1, shakeTime: 0 });
        }
        else if (skillType === 'single_damage' || skillType === 'single_damage_cc' || skillType === 'single_dot' || skillType === 'true_damage' || skillType === 'mana_burn' || skillType === 'single_damage_buff') {
            // 단일 대상 공격 스킬: 적 허수아비 1마리
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비', x: 480, y: 170, hp: 1000, maxHp: 1000, idx: 1, shakeTime: 0 });
        }
        else if (skillType === 'dash_damage') {
            // 달리기 선수/체육부장 돌진기: 적 허수아비를 가깝게 1명, 멀게 1명 배치 (왕복 돌진용)
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '가까운 적', x: casterX + 50, y: 170, hp: 1000, maxHp: 1000, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'dummy_2', isCaster: false, isEnemy: true, icon: '🎯', name: '먼 적', x: casterX + 350, y: 170, hp: 1000, maxHp: 1000, idx: 2, shakeTime: 0 });
        }
        else if (skillType === 'random_aoe' || skillType === 'random_aoe_debuff') {
            // 3명 무작위 스킬: 적 허수아비 3마리 배치
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 A', x: 360, y: 120, hp: 800, maxHp: 800, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'dummy_2', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 B', x: 450, y: 220, hp: 800, maxHp: 800, idx: 2, shakeTime: 0 });
            this.entities.push({ id: 'dummy_3', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 C', x: 540, y: 130, hp: 800, maxHp: 800, idx: 3, shakeTime: 0 });
        }
        else if (skillType === 'bounce_damage' || skillType === 'bounce_magic') {
            // 연쇄 튕기기 스킬 (본타겟 1 + 튕기기 3 = 총 4회): 적 허수아비 4마리 배치
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 1타', x: 340, y: 120, hp: 800, maxHp: 800, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'dummy_2', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 2타', x: 420, y: 220, hp: 800, maxHp: 800, idx: 2, shakeTime: 0 });
            this.entities.push({ id: 'dummy_3', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 3타', x: 500, y: 130, hp: 800, maxHp: 800, idx: 3, shakeTime: 0 });
            this.entities.push({ id: 'dummy_4', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 4타', x: 580, y: 230, hp: 800, maxHp: 800, idx: 4, shakeTime: 0 });
        }
        else if (skillType === 'cross_magic') {
            // 미친 과학자 십자열 공격: 허수아비 5마리 십자 형태 배치
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 (중앙)', x: 450, y: 170, hp: 1000, maxHp: 1000, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'dummy_2', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 (상)', x: 450, y: 90, hp: 800, maxHp: 800, idx: 2, shakeTime: 0 });
            this.entities.push({ id: 'dummy_3', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 (하)', x: 450, y: 250, hp: 800, maxHp: 800, idx: 3, shakeTime: 0 });
            this.entities.push({ id: 'dummy_4', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 (좌)', x: 370, y: 170, hp: 800, maxHp: 800, idx: 4, shakeTime: 0 });
            this.entities.push({ id: 'dummy_5', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 (우)', x: 530, y: 170, hp: 800, maxHp: 800, idx: 5, shakeTime: 0 });
        }
        else if (skillType.includes('taunt') || skillType === 'aoe_damage_buff' || skillType === 'aoe_debuff' || skillType === 'aoe_damage_cc_shield') {
            // 시전자 주변 1칸 범위기: 시전자 주변을 둘러싸는 형태로 적 배치
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 A', x: 160, y: 170, hp: 900, maxHp: 900, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'dummy_2', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 B', x: 350, y: 110, hp: 900, maxHp: 900, idx: 2, shakeTime: 0 });
            this.entities.push({ id: 'dummy_3', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 C', x: 350, y: 230, hp: 900, maxHp: 900, idx: 3, shakeTime: 0 });
        }
        else if (skillType === 'aoe_magic' || skillType === 'aoe_magic_cluster' || skillType === 'aoe_magic_silence') {
            // 타겟 중심 밀집 광역기: 적 3마리 조밀하게 배치
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 A', x: 400, y: 170, hp: 1000, maxHp: 1000, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'dummy_2', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 B', x: 480, y: 120, hp: 800, maxHp: 800, idx: 2, shakeTime: 0 });
            this.entities.push({ id: 'dummy_3', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 C', x: 480, y: 220, hp: 800, maxHp: 800, idx: 3, shakeTime: 0 });
        }
        else if (skillType === 'aoe_shield_cc_immune') {
            // 또래 상담 에이스: 시전자 주변 아군들 배치
            this.entities.push({ id: 'ally_1', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 A', x: 160, y: 170, hp: 800, maxHp: 800, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'ally_2', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 B', x: 350, y: 110, hp: 800, maxHp: 800, idx: 2, shakeTime: 0 });
            this.entities.push({ id: 'ally_3', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 C', x: 350, y: 230, hp: 800, maxHp: 800, idx: 3, shakeTime: 0 });
        }
        else if (skillType === 'single_damage_stack') {
            // 본 타겟 1명과 뒤에 스플래시 맞을 타겟 2명
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 (본체)', x: 400, y: 170, hp: 1000, maxHp: 1000, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'dummy_2', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 (스플래시)', x: 480, y: 120, hp: 800, maxHp: 800, idx: 2, shakeTime: 0 });
            this.entities.push({ id: 'dummy_3', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 (스플래시)', x: 480, y: 220, hp: 800, maxHp: 800, idx: 3, shakeTime: 0 });
        }
        else if (skillType === 'farthest_magic') {
            // 가장 먼 적 1명 타격 확인용 (가까운 적과 먼 적 배치)
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '가까운 적', x: 280, y: 170, hp: 1000, maxHp: 1000, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'dummy_2', isCaster: false, isEnemy: true, icon: '🎯', name: '가장 먼 적', x: 540, y: 170, hp: 1000, maxHp: 1000, idx: 2, shakeTime: 0 });
        }
        else if (skillType === 'heal' || skillType === 'heal_shield' || skillType === 'ally_shield') {
            // 아군 힐/보호막 (단일): 아군 허수아비 2마리 배치 (체력이 낮은 타겟을 힐하도록 유도)
            this.entities.push({ id: 'ally_1', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 A (체력 낮음)', x: 240, y: 110, hp: 200, maxHp: 800, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'ally_2', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 B', x: 240, y: 230, hp: 800, maxHp: 800, idx: 2, shakeTime: 0 });
        }
        else if (skillType === 'team_heal' || skillType === 'team_heal_buff' || skillType === 'team_buff_shield' || skillType === 'team_heal_plus') {
            // 아군 전체 힐/버프: 아군 허수아비 2마리 배치
            this.entities.push({ id: 'ally_1', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 A', x: 240, y: 100, hp: 400, maxHp: 800, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'ally_2', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 B', x: 240, y: 240, hp: 300, maxHp: 800, idx: 2, shakeTime: 0 });
        }
        else if (skillType === 'team_buff_enemy_debuff' || skillType === 'global_magic_mana' || skillType === 'global_magic_team_buff' || skillType === 'global_heal_shield') {
            // 아군 버프 + 적군 디버프/광역: 아군 2마리 + 적군 2마리 혼합 배치
            this.entities.push({ id: 'ally_1', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 A', x: 240, y: 100, hp: 800, maxHp: 800, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'ally_2', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 B', x: 240, y: 240, hp: 800, maxHp: 800, idx: 2, shakeTime: 0 });
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 A', x: 420, y: 110, hp: 1000, maxHp: 1000, idx: 3, shakeTime: 0 });
            this.entities.push({ id: 'dummy_2', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 B', x: 420, y: 230, hp: 1000, maxHp: 1000, idx: 4, shakeTime: 0 });
        }
        else if (skillType === 'global_magic_debuff' || skillType === 'global_cc_dmg_debuff') {
            // 글로벌 광역 공격/기절: 아군 1마리 + 적 3마리 넓게 배치
            this.entities.push({ id: 'ally_1', isCaster: false, isEnemy: false, icon: '🛡️', name: '아군 A', x: 240, y: 100, hp: 800, maxHp: 800, idx: 1, shakeTime: 0 });
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 A', x: 420, y: 110, hp: 1000, maxHp: 1000, idx: 2, shakeTime: 0 });
            this.entities.push({ id: 'dummy_2', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 B', x: 420, y: 230, hp: 1000, maxHp: 1000, idx: 3, shakeTime: 0 });
            this.entities.push({ id: 'dummy_3', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비 C', x: 520, y: 170, hp: 1000, maxHp: 1000, idx: 4, shakeTime: 0 });
        }
        else if (skillType === 'self_buff' || skillType === 'self_buff_hyper' || skillType === 'self_shield') {
            // 자기 자신 강화형 버프: 자기 강화지만 비교용 적 허수아비 1마리 배치
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비', x: 480, y: 170, hp: 1200, maxHp: 1200, idx: 1, shakeTime: 0 });
        }
        else {
            this.entities.push({ id: 'dummy_1', isCaster: false, isEnemy: true, icon: '🎯', name: '허수아비', x: 480, y: 170, hp: 1000, maxHp: 1000, idx: 1, shakeTime: 0 });
        }

        // 시전자가 근접(사거리 1)인 경우 적들을 당겨서 근접전 연출 (돌진기/십자열/도발 등 제외)
        if (this.unit.stats.range === 1 && !skillType.includes('dash') && skillType !== 'cross_magic' && !skillType.includes('taunt')) {
            this.entities.filter(e => e.isEnemy).forEach((e, idx) => {
                e.x = casterX + 50 + (idx * 40); // 시전자 바로 앞에 일렬로 바짝 붙여 배치
            });
        }

        // 3. 허수아비에게 마나 부여 (마나 소멸/봉인 등 연출용)
        this.entities.forEach(e => {
            if (!e.isCaster) {
                e.mana = 50;
                e.maxMana = 100;
            }
        });
    }

    /**
     * 시뮬레이션 상태 업데이트
     */
    update(dt) {
        this.time += dt;

        // 1. 파티클 업데이트 및 만료 처리
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // 2. 데미지/회복 플로팅 텍스트 업데이트
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y -= dt * 35; // 위로 상승
            t.life -= dt;
            if (t.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }

        // 3. 엔티티 피격 떨림 효과 및 버프 타이머 처리
        this.entities.forEach(entity => {
            if (entity.shakeTime > 0) {
                entity.shakeTime -= dt;
            }
            if (entity.buffs) {
                Object.keys(entity.buffs).forEach(type => {
                    if (entity.buffs[type] > 0) {
                        entity.buffs[type] -= dt;
                        if (entity.buffs[type] <= 0) delete entity.buffs[type];
                    }
                });
            }
        });

        // 4. 화면 플래시 효과 페이드아웃
        if (this.screenFlash > 0) {
            this.screenFlash -= dt * 2.0;
            if (this.screenFlash < 0) this.screenFlash = 0;
        }

        // 5. 마나 충전, 평타 및 패시브 발동
        const caster = this.entities.find(e => e.isCaster);
        if (caster) {
            // 주기적 평타 연출
            this.attackTimer = (this.attackTimer || 0) + dt;
            const attackInterval = 1 / (this.unit.stats.as || 0.6); // 공속 기반 평타 주기
            if (this.attackTimer >= attackInterval) {
                this.attackTimer -= attackInterval;
                caster.shakeTime = 0.15;

                const enemies = this.entities.filter(e => e.isEnemy);
                const closestEnemy = enemies.reduce((prev, curr) => (Math.abs(curr.x - caster.x) < Math.abs(prev.x - caster.x) ? curr : prev), enemies[0]);

                if (closestEnemy) {
                    closestEnemy.shakeTime = 0.1;
                    let basicDmg = Math.floor(this.unit.stats.ad || 20); // 평타 기본 데미지
                    let trueDmg = 0;
                    if (this.unit.id === 'u5_1' && this.unit.skill && this.unit.skill.bonusTrueDmg) {
                        let asVal = this.unit.stats.as || 0;
                        trueDmg = Math.floor(this.unit.skill.bonusTrueDmg[0] + (this.unit.skill.asRatio ? asVal * this.unit.skill.asRatio[0] : 0));
                    }
                    if (this.unit.stats.range === 1) {
                        // 근접: 타격 시 살짝 뒤로 밀림
                        const pushDir = closestEnemy.x > caster.x ? 12 : -12;
                        closestEnemy.x += pushDir;
                        setTimeout(() => { if (this.canvas && closestEnemy) closestEnemy.x -= pushDir; }, 100);
                        this.spawnFloatingText(closestEnemy.x, closestEnemy.y, `-${basicDmg}`, '#ef4444');
                        if (trueDmg > 0) setTimeout(() => { if(this.canvas) this.spawnFloatingText(closestEnemy.x, closestEnemy.y + 15, `-${trueDmg}`, '#94a3b8'); }, 50);
                    } else {
                        // 원거리
                        this.spawnFloatingText(closestEnemy.x, closestEnemy.y, `-${basicDmg}`, '#ef4444');
                        if (trueDmg > 0) setTimeout(() => { if(this.canvas) this.spawnFloatingText(closestEnemy.x, closestEnemy.y + 15, `-${trueDmg}`, '#94a3b8'); }, 50);
                    }

                    // 패시브(마나 0) 스킬 3타 발동 처리
                    if (caster.maxMana === 0 && this.unit.skill.type === 'passive') {
                        this.passiveStacks = (this.passiveStacks || 0) + 1;
                        if (this.passiveStacks >= 3) {
                            this.passiveStacks = 0;
                            setTimeout(() => this.castSkill(caster), 100);
                        }
                    }
                }
            }

            // 마나 충전 (패시브가 아닌 스킬)
            if (caster.maxMana > 0) {
                caster.mana += dt * this.manaRegenRate;
                if (caster.mana >= caster.maxMana) {
                    caster.mana = 0;
                    this.castSkill(caster);
                }
            }
        }
    }

    /**
     * 스킬 발동 연출 시작
     */
    castSkill(caster) {
        const skillType = this.unit.skill.type || '';
        const fxType = this.fxTypeMap[this.unit.id] || this.unit.id;

        // 시전자 가벼운 돌진/시전 애니메이션 흔들림 효과
        caster.shakeTime = 0.2;

        if (this.unit.id === 'u5_2' || this.unit.id === 'u5_4' || this.unit.id === 'u5_5') {
            this.screenFlash = 0.6; 
        }

        // 1. 머리 위에 스킬명 텍스트 팝업 파티클 생성
        this.particles.push({
            type: 'skill_text',
            x: caster.x,
            y: caster.y,
            life: 1.5,
            maxLife: 1.5,
            text: `✨ ${this.unit.skill.name}!`,
            color: '#3b82f6'
        });

        // 2. 대상 목록 필터링
        let isHealSkill = (skillType.includes('heal') || skillType.includes('shield') || skillType.includes('buff')) 
                          && !skillType.includes('debuff') 
                          && !skillType.includes('enemy')
                          && !skillType.includes('damage');
        
        let targets = [];
        let healTargets = []; // 힐/버프를 받을 아군 목록
        let dmgTargets = []; // 데미지/디버프를 받을 적 목록

        const allies = this.entities.filter(e => !e.isEnemy);
        const enemies = this.entities.filter(e => e.isEnemy);

        if (skillType === 'passive') {
            targets = [caster.idx];
            healTargets = targets;
        } 
        else if (skillType.includes('team_buff_enemy_debuff') || skillType.includes('global_magic_mana') || skillType.includes('global_magic_team_buff')) {
            // 복합 스킬: 아군 전체 버프 + 적군 전체 공격/디버프
            healTargets = allies.map(e => e.idx);
            dmgTargets = enemies.map(e => e.idx);
            targets = [...dmgTargets]; // 이펙트 중심 타겟은 주로 적
        }
        else if (skillType.includes('self_buff') || skillType === 'self_shield') {
            // 자가 버프/쉴드
            targets = [caster.idx];
            healTargets = targets;
        }
        else if (isHealSkill) {
            // 아군 대상 힐/버프 스킬
            if (skillType === 'heal' || skillType === 'heal_shield') {
                const lowestHpAlly = allies.reduce((lowest, current) => {
                    return (current.hp / current.maxHp) < (lowest.hp / lowest.maxHp) ? current : lowest;
                }, allies[0]);
                targets = [lowestHpAlly.idx];
            } else if (skillType === 'ally_shield') {
                targets = allies.map(e => e.idx).slice(0, 2);
            } else if (skillType === 'aoe_shield_cc_immune') {
                targets = allies.map(e => e.idx);
            } else {
                targets = allies.map(e => e.idx);
            }
            healTargets = targets;
        } 
        else {
            // 적 대상 공격 스킬
            if (skillType === 'single_damage' || skillType === 'single_damage_cc' || skillType === 'single_dot' || skillType === 'true_damage' || skillType === 'mana_burn' || skillType === 'single_damage_buff') {
                dmgTargets = enemies.length > 0 ? [enemies[0].idx] : [];
            } 
            else if (skillType === 'dash_damage') {
                // 돌진: 현재 시전자 위치에서 가장 먼 적 1명 타겟팅
                if (enemies.length > 0) {
                    const farthest = enemies.reduce((prev, curr) => (Math.abs(curr.x - caster.x) > Math.abs(prev.x - caster.x) ? curr : prev));
                    dmgTargets = [farthest.idx];
                }
            } 
            else if (skillType === 'single_damage_stack') {
                // 본 타겟 + 스플래시
                dmgTargets = enemies.map(e => e.idx);
            }
            else if (skillType === 'farthest_magic') {
                // 가장 먼 적 1명
                if (enemies.length > 0) {
                    const farthest = enemies.reduce((prev, curr) => (curr.x > prev.x ? curr : prev));
                    dmgTargets = [farthest.idx];
                }
            }
            else if (skillType === 'random_aoe' || skillType === 'random_aoe_debuff') {
                dmgTargets = enemies.map(e => e.idx).slice(0, 3);
            } 
            else if (skillType === 'aoe_magic_silence' || skillType === 'aoe_magic' || skillType === 'aoe_magic_cluster') {
                dmgTargets = enemies.map(e => e.idx);
            }
            else if (skillType === 'bounce_damage' || skillType === 'bounce_magic') {
                dmgTargets = enemies.map(e => e.idx).slice(0, 4);
            }
            else {
                dmgTargets = enemies.map(e => e.idx);
            }
            targets = dmgTargets;
        }

        if (skillType === 'single_damage_buff' || skillType === 'aoe_damage_buff' || skillType === 'aoe_damage_cc_shield') {
            healTargets.push(caster.idx);
        }

        if (skillType.includes('dash')) {
            // 현재 위치에서 가장 먼 적 찾기
            const activeEnemies = dmgTargets.map(tIdx => this.entities.find(e => e.idx === tIdx)).filter(e => e);
            if (activeEnemies.length > 0) {
                const farthestTarget = activeEnemies.reduce((prev, curr) => (Math.abs(curr.x - caster.x) > Math.abs(prev.x - caster.x) ? curr : prev));
                setTimeout(() => {
                    if (!this.canvas) return;
                    caster.x = (farthestTarget.x > caster.x) ? farthestTarget.x - 40 : farthestTarget.x + 40;
                    caster.y = farthestTarget.y;
                    caster.shakeTime = 0.2;
                    farthestTarget.shakeTime = 0.3;
                }, 150);
            }
        }

        // 플로팅 텍스트 연출 (아군 힐/버프)
        healTargets.forEach(tIdx => {
            const targetEntity = this.entities.find(e => e.idx === tIdx);
            if (!targetEntity) return;

            setTimeout(() => {
                if (!this.canvas || !targetEntity) return;
                targetEntity.shakeTime = 0.2;
                
                if (skillType.includes('shield')) {
                    setTimeout(() => {
                        if (this.canvas) this.spawnFloatingText(targetEntity.x, targetEntity.y + (skillType.includes('heal') ? 20 : 0), 'SHIELD', '#60a5fa');
                    }, 200);
                }
                
                if (skillType === 'single_damage_buff' || skillType === 'aoe_damage_buff') {
                    // 피해 흡혈 (피 차는 연출)
                    const healAmount = Math.floor(this.unit.stats.ad * 0.5);
                    this.spawnFloatingText(targetEntity.x, targetEntity.y, `+${healAmount}`, '#10b981', true);
                    targetEntity.hp = Math.min(targetEntity.maxHp, targetEntity.hp + healAmount);
                } else if (skillType.includes('buff') || skillType.includes('mana') || skillType === 'passive') {
                    if (skillType.includes('mana')) {
                        const amount = this.unit.skill.teamMana ? this.unit.skill.teamMana[0] : 30;
                        this.spawnFloatingText(targetEntity.x, targetEntity.y, `+${amount} 마나`, '#3b82f6');
                    } else {
                        this.spawnFloatingText(targetEntity.x, targetEntity.y, 'BUFF', '#facc15'); // 노란색
                    }
                } else if (skillType.includes('heal')) {
                    // 일반 힐
                    const healAmount = Math.floor(this.unit.stats.ad * 2.5);
                    this.spawnFloatingText(targetEntity.x, targetEntity.y, `+${healAmount}`, '#10b981', true);
                    targetEntity.hp = Math.min(targetEntity.maxHp, targetEntity.hp + healAmount);
                    setTimeout(() => {
                        if (this.canvas) {
                            if (targetEntity.maxHp === 800) targetEntity.hp = 400;
                            else if (targetEntity.maxHp === 200) targetEntity.hp = 200; // 양호실 도우미 타겟 등
                            else targetEntity.hp = targetEntity.maxHp * 0.5;
                        }
                    }, 2200);
                }
            }, 400);
        });

        // 플로팅 텍스트 연출 (적 타격)
        dmgTargets.forEach((tIdx, i) => {
            const targetEntity = this.entities.find(e => e.idx === tIdx);
            if (!targetEntity) return;

            const delay = skillType.includes('dash') ? 500 : (skillType.includes('bounce') || skillType.includes('random') ? i * 400 + 400 : 400);
            
            if (skillType === 'single_dot') {
                // 도트딜 연출: 1.5초 동안 여러 번 작은 데미지 텍스트 팝업
                for (let j = 0; j < 5; j++) {
                    setTimeout(() => {
                        if (this.canvas && targetEntity) {
                            targetEntity.shakeTime = 0.1;
                            let dotDmg = Math.floor((this.unit.stats.ap || 100) * 0.5);
                            this.spawnFloatingText(targetEntity.x + Math.random()*20 - 10, targetEntity.y + Math.random()*20 - 10, `-${dotDmg}`, '#a855f7');
                        }
                    }, delay + j * 300);
                }
                return;
            }

            if (skillType.includes('taunt')) {
                // 도발: 데미지 없이 도발 텍스트만 표시
                setTimeout(() => {
                    if (this.canvas && targetEntity) {
                        targetEntity.shakeTime = 0.1;
                        this.spawnFloatingText(targetEntity.x, targetEntity.y, '도발!', '#f87171');
                    }
                }, delay);
                return;
            }

            setTimeout(() => {
                if (!this.canvas || !targetEntity) return;
                
                targetEntity.shakeTime = 0.3; // 피격 흔들림
                
                const desc = this.unit.skill.desc || '';
                let isTrue = skillType === 'true_damage' || desc.includes('고정 피해');
                let isMagic = desc.includes('마법 피해') || skillType.includes('magic') || (this.unit.skill.apRatio && !this.unit.skill.adRatio && !desc.includes('물리 피해'));
                let dmgVal = isMagic ? Math.floor((this.unit.stats.ap||100) * 1.5) : Math.floor((this.unit.stats.ad||20) * 2.0);
                
                let dmgColor = '#ef4444';
                let label = `-${dmgVal}`;
                
                if (isTrue) {
                    dmgColor = '#94a3b8'; // 고정 피해 회색
                } else if (isMagic) {
                    dmgColor = '#a855f7'; // 마법 보라
                } else {
                    dmgColor = '#ef4444'; // 물리 빨강
                }

                let hasStun = skillType.includes('stun') || skillType.includes('cc') || desc.includes('기절');
                let hasDebuff = skillType.includes('debuff') || desc.includes('감소');
                let hasAntiHeal = desc.includes('회복 불가');
                let hasSilence = skillType.includes('silence') || desc.includes('침묵');

                targetEntity.buffs = targetEntity.buffs || {};
                if (hasStun) targetEntity.buffs['stun'] = 2.0;
                if (hasDebuff) targetEntity.buffs['debuff'] = 2.0;
                if (hasAntiHeal) targetEntity.buffs['antiHeal'] = 2.0;
                if (hasSilence) targetEntity.buffs['silence'] = 2.0;

                this.spawnFloatingText(targetEntity.x, targetEntity.y, label, dmgColor);
                
                // 마나 감소/봉인 연출
                if (skillType.includes('mana_burn')) {
                    const burnAmount = 50;
                    targetEntity.mana = Math.max(0, targetEntity.mana - burnAmount);
                    setTimeout(() => {
                        if (this.canvas && targetEntity) this.spawnFloatingText(targetEntity.x, targetEntity.y + 20, `-${burnAmount} 마나`, '#3b82f6');
                    }, 300);
                } else if (skillType.includes('manaReducPct') || skillType === 'random_aoe_debuff' || desc.includes('마나 봉인')) {
                    setTimeout(() => {
                        if (this.canvas && targetEntity) this.spawnFloatingText(targetEntity.x, targetEntity.y + 20, '마나 봉인', '#3b82f6');
                    }, 300);
                }
            }, delay);
        });

        // 3. FxSystem 옵션 매핑
        const optionParams = { targets };
        if (targets.length > 0) {
            const firstTarget = this.getCellCenter(targets[0]);
            optionParams.targetX = firstTarget.x;
            optionParams.targetY = firstTarget.y;
        }

        // Fx 이펙트 발동!
        this.fxSystem.spawnFx(fxType, caster.x, caster.y, optionParams);

        // 특별 처리: 기부천사(u5_5)는 스킬 시전 시 패시브 아이템 부여 이펙트도 함께 프리뷰에 보여줌
        if (this.unit.id === 'u5_5') {
            setTimeout(() => {
                this.fxSystem.spawnFx('donation_items_buff', caster.x, caster.y, {});
            }, 300);
        }
    }

    /**
     * 라이브 플로팅 데미지/회복 텍스트 생성
     */
    spawnFloatingText(x, y, text, color, isHeal = false) {
        this.floatingTexts.push({
            x: x + (Math.random() * 20 - 10),
            y: y - 20,
            text,
            color,
            life: 1.2,
            maxLife: 1.2,
            isHeal
        });
    }

    /**
     * 캔버스 렌더링 (전술 칠판 테마로 대폭 고도화)
     */
    draw() {
        if (!this.ctx || !this.canvas) return;

        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        // 1. 전술 칠판(Tactical Chalkboard) 배경 드로잉
        ctx.fillStyle = '#0f1f15'; // 칠판용 짙은 어두운 녹색
        ctx.fillRect(0, 0, W, H);

        // 은은한 그리드선 (분필 눈금선 느낌)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < W; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = 0; y < H; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }

        // 칠판의 가장자리 다크 마진/테두리 데코
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, W - 8, H - 8);

        // 모서리 L자형 조준 마커 (전술 칠판 테마 부스트)
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2.5;
        const corners = [
            { x: 12, y: 12, dx: 15, dy: 15 },
            { x: W-12, y: 12, dx: -15, dy: 15 },
            { x: 12, y: H-12, dx: 15, dy: -15 },
            { x: W-12, y: H-12, dx: -15, dy: -15 }
        ];
        corners.forEach(c => {
            ctx.beginPath();
            ctx.moveTo(c.x + c.dx, c.y);
            ctx.lineTo(c.x, c.y);
            ctx.lineTo(c.x, c.y + c.dy);
            ctx.stroke();
        });

        // 2. 캐릭터 렌더링 (그림자, 타겟 링, 이모지, 체력/마나바)
        this.entities.forEach(entity => {
            // 흔들림 애니메이션 계산
            let shakeX = 0;
            if (entity.shakeTime > 0) {
                shakeX = Math.sin(entity.shakeTime * 60) * 4;
            }

            // 그림자
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(entity.x + shakeX, entity.y + 16, 20, 9, 0, 0, Math.PI * 2);
            ctx.fill();

            // 발밑 전술 타겟 링 연출 (Aesthetic Boost)
            if (entity.isCaster) {
                // 시전자는 발밑에 푸른빛 회전 마법진 링
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
                ctx.lineWidth = 2;
                ctx.save();
                ctx.translate(entity.x + shakeX, entity.y + 8);
                ctx.scale(1.2, 0.6);
                ctx.beginPath();
                ctx.arc(0, 0, 24, 0, Math.PI * 2);
                ctx.stroke();
                
                // 회전하는 디테일 점선 분필선
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
                ctx.setLineDash([4, 6]);
                ctx.rotate(this.time * 2);
                ctx.beginPath();
                ctx.arc(0, 0, 28, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            } else if (entity.isEnemy) {
                // 적군은 빨간색 조준 타겟 링 (가벼운 깜빡임)
                const pulseAlpha = 0.3 + Math.abs(Math.sin(this.time * 6)) * 0.4;
                ctx.strokeStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
                ctx.lineWidth = 2.5;
                ctx.save();
                ctx.translate(entity.x + shakeX, entity.y + 8);
                ctx.scale(1.1, 0.55);
                ctx.beginPath();
                ctx.arc(0, 0, 22, 0, Math.PI * 2);
                ctx.stroke();
                // 십자 눈금 조준선
                ctx.beginPath();
                ctx.moveTo(-30, 0); ctx.lineTo(-15, 0);
                ctx.moveTo(15, 0); ctx.lineTo(30, 0);
                ctx.stroke();
                ctx.restore();
            } else {
                // 아군은 초록빛 따뜻한 원형 링
                ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
                ctx.lineWidth = 2;
                ctx.save();
                ctx.translate(entity.x + shakeX, entity.y + 8);
                ctx.scale(1.1, 0.55);
                ctx.beginPath();
                ctx.arc(0, 0, 22, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // 캐릭터 이모지 (크기 36px로 시인성 대폭 강화!)
            ctx.font = '36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(entity.icon, entity.x + shakeX, entity.y);

            // 이름/역할 텍스트
            ctx.font = 'bold 11px sans-serif';
            ctx.fillStyle = entity.isEnemy ? '#f87171' : (entity.isCaster ? '#60a5fa' : '#34d399');
            ctx.fillText(entity.name, entity.x + shakeX, entity.y - 30);

            // 상태이상 아이콘 (허수아비 우측 상단 고정 표시)
            if (entity.buffs) {
                let buffX = entity.x + shakeX + 16;
                let buffY = entity.y - 20;
                Object.keys(entity.buffs).forEach(type => {
                    if (type === 'silence') {
                        // 이모지 배제: 분필 질감 2D 벡터 그래픽 (붉은 X가 들어간 말풍선)
                        ctx.save();
                        ctx.strokeStyle = '#f87171'; // 붉은 파스텔
                        ctx.fillStyle = '#1c1917'; // 어두운 돌판 색상
                        ctx.lineWidth = 2.0;
                        
                        // 말풍선 메인 타원
                        ctx.beginPath();
                        ctx.ellipse(buffX, buffY - 2, 9, 8, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                        
                        // 말풍선 꼬리
                        ctx.beginPath();
                        ctx.moveTo(buffX - 3, buffY + 4);
                        ctx.lineTo(buffX - 7, buffY + 9);
                        ctx.lineTo(buffX + 1, buffY + 5);
                        ctx.closePath();
                        ctx.fillStyle = '#f87171';
                        ctx.fill();
                        
                        // 말풍선 내부의 흰색 X
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1.6;
                        ctx.beginPath();
                        ctx.moveTo(buffX - 3, buffY - 5);
                        ctx.lineTo(buffX + 3, buffY + 1);
                        ctx.moveTo(buffX + 3, buffY - 5);
                        ctx.lineTo(buffX - 3, buffY + 1);
                        ctx.stroke();
                        
                        ctx.restore();
                        buffX += 22;
                    } else {
                        let icon = '';
                        if (type === 'stun') icon = '💫';
                        else if (type === 'debuff') icon = '📉';
                        else if (type === 'antiHeal') icon = '❤️‍🩹';
                        
                        if (icon) {
                            ctx.font = '16px sans-serif';
                            ctx.fillText(icon, buffX, buffY);
                            buffX += 16; // 여러 개면 옆으로 나열
                        }
                    }
                });
            }

            // 체력/마나바 (플랫 프리미엄 스타일)
            const barW = 44;
            const barH = 5;
            const barX = entity.x + shakeX - barW / 2;
            const barY = entity.y + 26;

            // HP 배경
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 2.5);
            ctx.fill();
            
            // HP 채우기
            const hpPct = Math.max(0, Math.min(1, entity.hp / entity.maxHp));
            ctx.fillStyle = '#10b981'; // 에메랄드 그린
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW * hpPct, barH, 2.5);
            ctx.fill();

            // 마나바 (시전자이면서 마나통이 있는 경우만)
            if (entity.isCaster && entity.maxMana > 0) {
                const manaY = barY + barH + 3;
                // 마나 배경
                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.roundRect(barX, manaY, barW, barH - 1, 2);
                ctx.fill();
                
                // 마나 채우기
                const manaPct = Math.max(0, Math.min(1, entity.mana / entity.maxMana));
                ctx.fillStyle = '#3b82f6'; // 선명한 파란색
                ctx.beginPath();
                ctx.roundRect(barX, manaY, barW * manaPct, barH - 1, 2);
                ctx.fill();
            }
        });

        // 3. FxSystem 파티클 렌더링
        this.particles.forEach(p => {
            if (p.type === 'skill_text') {
                // 스킬명 둥둥 뜨는 텍스트
                const pct = p.life / p.maxLife;
                ctx.save();
                ctx.font = 'bold 16px sans-serif';
                ctx.fillStyle = `rgba(251, 146, 60, ${pct})`; // 주황/황금빛 분필 질감 느낌
                ctx.textAlign = 'center';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 6;
                ctx.fillText(p.text, p.x, p.y - 50 - (1 - pct) * 25);
                ctx.restore();
            } else {
                // 인게임 화려한 FxRenderer 활용
                ctx.save();
                this.fxRenderer.renderParticle(p, ctx, this.canvas);
                ctx.restore();
            }
        });

        // 4. 라이브 데미지/회복 플로팅 텍스트 렌더링
        this.floatingTexts.forEach(t => {
            const pct = t.life / t.maxLife;
            ctx.save();
            ctx.font = t.isHeal ? 'bold 15px sans-serif' : 'italic bold 18px sans-serif';
            ctx.fillStyle = t.color;
            ctx.globalAlpha = pct;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        });

        // 5. 전체 화면 플래시
        if (this.screenFlash > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash * 0.45})`;
            ctx.fillRect(0, 0, W, H);
        }
    }
}

// 싱글톤으로 인스턴스 전송
export const skillPreviewer = new SkillPreviewer();
