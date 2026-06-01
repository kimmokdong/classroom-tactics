/**
 * SoundManager.js
 * Web Audio API를 활용하여 게임 내 실시간 합성 효과음(SFX)을 생성하고 재생하는 관리자 클래스입니다.
 * 별도의 MP3/WAV 자원 없이 코드로 오디오를 실시간 합성하여 가볍고 반응성이 좋습니다.
 */
export default class SoundManager {
    constructor(app) {
        this.app = app;
        this.audioCtx = null;
        this.isEnabled = true; // 사운드 켜짐/꺼짐 상태
        this.volume = 0.5; // 마스터 볼륨 (0.0 ~ 1.0)
        
        // BGM 재생 상태
        this.currentBgmType = null;
        this.bgmInterval = null;
        this.bgmTick = 0;
        
        // 연장전 심장 박동 재생 상태
        this.isHeartbeatPlaying = false;
        this.heartbeatTimeout = null;
        this.heartBpm = 80;

        // 사이렌 재생 상태
        this.isSirenPlaying = false;
        this.sirenOsc1 = null;
        this.sirenOsc2 = null;
        this.sirenLFO = null;
        this.sirenGain = null;
        
        // localStorage에서 이전 설정 복구
        const savedSound = localStorage.getItem('game-sound-enabled');
        if (savedSound !== null) {
            this.isEnabled = savedSound === 'true';
        }
        
        const savedVolume = localStorage.getItem('game-sound-volume');
        if (savedVolume !== null) {
            this.volume = parseFloat(savedVolume);
        }
        
        // 오디오 컨텍스트 자동 활성화를 위한 전역 리스너 등록
        this.setupUnlockListener();
    }

    /**
     * 사용자의 첫 터치/클릭 시 브라우저 오디오 컨텍스트 차단을 해제합니다.
     */
    setupUnlockListener() {
        const unlock = () => {
            this.initAudio();
            if (this.audioCtx) {
                if (this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
                // 해제 성공 후 이벤트 제거
                document.removeEventListener('click', unlock);
                document.removeEventListener('keydown', unlock);
                document.removeEventListener('touchstart', unlock);
                console.log("Web Audio API Context Unlocked & Active.");
            }
        };
        document.addEventListener('click', unlock);
        document.addEventListener('keydown', unlock);
        document.addEventListener('touchstart', unlock);
    }

    /**
     * AudioContext를 초기화합니다.
     */
    initAudio() {
        if (!this.audioCtx) {
            try {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn("이 브라우저는 Web Audio API를 지원하지 않습니다.", e);
            }
        }
    }

    /**
     * 사운드 활성화 여부를 토글합니다.
     */
    toggleSound() {
        this.isEnabled = !this.isEnabled;
        localStorage.setItem('game-sound-enabled', this.isEnabled);
        
        if (this.isEnabled) {
            // 켜질 때: 오디오 초기화 후 BGM 재개
            this.initAudio();
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            // 음소거 전에 재생 중이던 BGM 타입이 있으면 다시 재생
            if (this._pausedBgmType) {
                const type = this._pausedBgmType;
                this._pausedBgmType = null;
                this.playBgmSequence(type);
            }
        } else {
            // 꺼질 때: BGM·연장전 사운드 모두 정지
            // 현재 BGM 타입을 기억해 두었다가 다시 켤 때 복구
            this._pausedBgmType = this.currentBgmType;
            this.stopAllBgm();
            this.stopHeartbeat();
            this.stopSiren();
        }
        return this.isEnabled;
    }

    /**
     * 마스터 볼륨을 설정합니다.
     */
    setVolume(vol) {
        this.volume = Math.max(0.0, Math.min(1.0, vol));
        localStorage.setItem('game-sound-volume', this.volume);
    }

    /**
     * 공통 오실레이터(주파수 발진기) 생성 함수
     */
    createOscillator(type, freq, time, duration, vol = 0.1) {
        if (!this.audioCtx) return null;
        
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        
        // 볼륨 및 페이드아웃 효과 (마스터 볼륨 곱하기)
        const targetVol = vol * this.volume;
        gainNode.gain.setValueAtTime(targetVol, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        
        osc.start(time);
        osc.stop(time + duration);
        return osc;
    }

    /**
     * 노이즈(백색소음) 생성 함수 - 물리적 타격감, 마찰음 등에 사용
     */
    createNoise(time, duration, vol = 0.2, filterFreq = 1000) {
        if (!this.audioCtx) return null;

        const bufferSize = this.audioCtx.sampleRate * duration;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        // 로우패스 필터로 소리 성향 조절
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, time);
        
        const gainNode = this.audioCtx.createGain();
        const targetVol = vol * this.volume;
        gainNode.gain.setValueAtTime(targetVol, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        
        noise.start(time);
        return noise;
    }

    stopAllBgm() {
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
        this.currentBgmType = null;
    }

    playBgmSequence(type) {
        if (!this.isEnabled) return;
        this.initAudio();
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        
        if (this.currentBgmType === type) return;
        
        this.stopAllBgm();
        this.currentBgmType = type;
        this.bgmTick = 0;

        if (type === 'prep') {
            const melody = [
                523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 523.25, 659.25,
                587.33, 698.46, 880.00, 1174.66, 880.00, 698.46, 587.33, 698.46
            ];
            
            this.bgmInterval = setInterval(() => {
                if (!this.audioCtx) return;
                const now = this.audioCtx.currentTime;
                const freq = melody[this.bgmTick % melody.length];
                
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                
                gain.gain.setValueAtTime(this.volume * 0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
                
                if (this.bgmTick % 4 === 0) {
                    const baseFreq = this.bgmTick % 8 === 0 ? 130.81 : 146.83;
                    const bOsc = this.audioCtx.createOscillator();
                    const bGain = this.audioCtx.createGain();
                    bOsc.type = 'triangle';
                    bOsc.frequency.setValueAtTime(baseFreq, now);
                    bGain.gain.setValueAtTime(this.volume * 0.14, now);
                    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    bOsc.connect(bGain);
                    bGain.connect(this.audioCtx.destination);
                    bOsc.start(now);
                    bOsc.stop(now + 0.3);
                }
                
                this.bgmTick++;
            }, 140);

        } else if (type === 'battle') {
            const bassPattern = [
                110.00, 110.00, 130.81, 146.83, 110.00, 110.00, 146.83, 164.81,
                98.00, 98.00, 130.81, 110.00, 98.00, 98.00, 110.00, 123.47
            ];

            this.bgmInterval = setInterval(() => {
                if (!this.audioCtx) return;
                const now = this.audioCtx.currentTime;
                
                const baseFreq = bassPattern[this.bgmTick % bassPattern.length];
                const bOsc = this.audioCtx.createOscillator();
                const bFilter = this.audioCtx.createBiquadFilter();
                const bGain = this.audioCtx.createGain();
                
                bOsc.type = 'sawtooth';
                bOsc.frequency.setValueAtTime(baseFreq, now);
                
                bFilter.type = 'lowpass';
                bFilter.frequency.setValueAtTime(320, now);
                
                bGain.gain.setValueAtTime(this.volume * 0.16, now);
                bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                
                bOsc.connect(bFilter);
                bFilter.connect(bGain);
                bGain.connect(this.audioCtx.destination);
                
                bOsc.start(now);
                bOsc.stop(now + 0.15);

                if (this.bgmTick % 2 === 0) {
                    const hGain = this.audioCtx.createGain();
                    const hFilter = this.audioCtx.createBiquadFilter();
                    hFilter.type = 'highpass';
                    hFilter.frequency.setValueAtTime(6000, now);
                    
                    hGain.gain.setValueAtTime(this.volume * 0.02, now);
                    hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                    
                    const hNoise = this.audioCtx.createBufferSource();
                    const bufferSize = this.audioCtx.sampleRate * 0.04;
                    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for(let i=0; i<bufferSize; i++) data[i] = Math.random()*2 - 1;
                    hNoise.buffer = buffer;
                    
                    hNoise.connect(hFilter);
                    hFilter.connect(hGain);
                    hGain.connect(this.audioCtx.destination);
                    hNoise.start(now);
                }
                
                if (this.bgmTick % 8 === 4) {
                    const soundFreq = this.bgmTick % 16 === 12 ? 880.00 : 783.99;
                    const sOsc = this.audioCtx.createOscillator();
                    const sGain = this.audioCtx.createGain();
                    sOsc.type = 'square';
                    sOsc.frequency.setValueAtTime(soundFreq, now);
                    
                    sGain.gain.setValueAtTime(this.volume * 0.02, now);
                    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                    
                    sOsc.connect(sGain);
                    sGain.connect(this.audioCtx.destination);
                    sOsc.start(now);
                    sOsc.stop(now + 0.22);
                }

                this.bgmTick++;
            }, 115);
        }
    }

    playHeartbeatLoop() {
        if (!this.isEnabled) return;
        this.initAudio();
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        
        this.isHeartbeatPlaying = true;
        
        const loop = () => {
            if (!this.isHeartbeatPlaying || !this.audioCtx) return;
            const now = this.audioCtx.currentTime;
            
            const playBeat = (time, volMult = 1.0) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(55, time);
                osc.frequency.exponentialRampToValueAtTime(10, time + 0.15);

                gain.gain.setValueAtTime(this.volume * 0.6 * volMult, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(time);
                osc.stop(time + 0.16);
            };

            playBeat(now, 1.0);
            playBeat(now + 0.14, 0.7);

            const intervalMs = (60 / this.heartBpm) * 1000;
            this.heartbeatTimeout = setTimeout(loop, intervalMs);
        };
        loop();
    }

    stopHeartbeat() {
        this.isHeartbeatPlaying = false;
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    playSiren() {
        if (!this.isEnabled) return;
        this.initAudio();
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();

        if (this.isSirenPlaying) return;
        this.isSirenPlaying = true;
        
        const now = this.audioCtx.currentTime;

        this.sirenOsc1 = this.audioCtx.createOscillator();
        this.sirenOsc2 = this.audioCtx.createOscillator();
        this.sirenLFO = this.audioCtx.createOscillator();
        const lfoGain = this.audioCtx.createGain();
        this.sirenGain = this.audioCtx.createGain();

        this.sirenOsc1.type = 'sawtooth';
        this.sirenOsc2.type = 'sawtooth';
        this.sirenLFO.type = 'sine';

        this.sirenOsc1.frequency.setValueAtTime(450, now);
        this.sirenOsc2.frequency.setValueAtTime(454, now);

        this.sirenLFO.frequency.setValueAtTime(1.2, now);
        lfoGain.gain.setValueAtTime(150, now);

        this.sirenLFO.connect(lfoGain);
        lfoGain.connect(this.sirenOsc1.frequency);
        lfoGain.connect(this.sirenOsc2.frequency);

        this.sirenGain.gain.setValueAtTime(0, now);
        this.sirenGain.gain.linearRampToValueAtTime(this.volume * 0.05, now + 0.3);

        this.sirenOsc1.connect(this.sirenGain);
        this.sirenOsc2.connect(this.sirenGain);
        this.sirenGain.connect(this.audioCtx.destination);

        this.sirenLFO.start(now);
        this.sirenOsc1.start(now);
        this.sirenOsc2.start(now);
    }

    stopSiren() {
        if (!this.isSirenPlaying) return;
        this.isSirenPlaying = false;
        
        if (this.audioCtx && this.sirenGain) {
            const now = this.audioCtx.currentTime;
            this.sirenGain.gain.cancelScheduledValues(now);
            this.sirenGain.gain.setValueAtTime(this.sirenGain.gain.value, now);
            this.sirenGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            
            setTimeout(() => {
                if (this.sirenOsc1) { this.sirenOsc1.stop(); this.sirenOsc1 = null; }
                if (this.sirenOsc2) { this.sirenOsc2.stop(); this.sirenOsc2 = null; }
                if (this.sirenLFO) { this.sirenLFO.stop(); this.sirenLFO = null; }
                this.sirenGain = null;
            }, 350);
        }
    }

    /**
     * 지정된 타입의 SFX를 실시간 합성하여 재생합니다.
     */
    playSFX(type) {
        // 사운드가 꺼져있거나 오디오 지원이 안 되면 무시
        if (!this.isEnabled) return;
        
        this.initAudio();
        if (!this.audioCtx) return;

        // 브라우저 정책으로 suspended 상태이면 resume 시도
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;

        switch (type) {
            case 'ui_click':
                // 짧고 경쾌한 팅 소리
                this.createOscillator('sine', 800, now, 0.05, 0.08);
                break;

            case 'shop_reroll': {
                // 주르르륵 돌아가는 소리 (주파수의 급격한 지수 상승)
                const osc = this.audioCtx.createOscillator();
                const gainNode = this.audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
                
                const targetVol = 0.08 * this.volume;
                gainNode.gain.setValueAtTime(targetVol, now);
                gainNode.gain.linearRampToValueAtTime(0, now + 0.12);
                
                osc.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.12);
                break;
            }

            case 'shop_buy':
                // 코인 짤랑 (금속성 맑은 2음절 화음)
                this.createOscillator('sine', 1200, now, 0.08, 0.04);
                this.createOscillator('sine', 1600, now + 0.04, 0.25, 0.04);
                break;

            case 'shop_sell':
                // 코인 판매 (조금 차분하고 낮은 짤랑 소리)
                this.createOscillator('sine', 1000, now, 0.08, 0.04);
                this.createOscillator('sine', 1400, now + 0.04, 0.2, 0.04);
                break;

            case 'buy_exp':
                // 레벨업 게이지 상승음 (아르페지오 형태의 계단식 스퀘어 파형)
                this.createOscillator('square', 400, now, 0.08, 0.03);
                this.createOscillator('square', 500, now + 0.08, 0.08, 0.03);
                this.createOscillator('square', 600, now + 0.16, 0.25, 0.03);
                break;

            case 'item_equip':
                // 스윽-착 달라붙는 노이즈 스위시 효과음
                this.createNoise(now, 0.15, 0.12, 3000);
                break;

            case 'unit_grab':
                // 가볍게 통 집어올리는 소리 (매우 짧음)
                this.createOscillator('triangle', 180, now, 0.06, 0.15);
                break;

            case 'unit_drop': {
                // 묵직하게 보드에 툭 내려놓는 드럼성 베이스음 + 바닥 마찰 노이즈
                const dropOsc = this.audioCtx.createOscillator();
                const dropGain = this.audioCtx.createGain();
                dropOsc.type = 'sine';
                dropOsc.frequency.setValueAtTime(160, now);
                dropOsc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
                
                const targetVol = 0.5 * this.volume;
                dropGain.gain.setValueAtTime(targetVol, now);
                dropGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                
                dropOsc.connect(dropGain);
                dropGain.connect(this.audioCtx.destination);
                
                dropOsc.start(now);
                dropOsc.stop(now + 0.18);
                
                this.createNoise(now, 0.06, 0.12, 400); // 쿵 소리와 어우러지는 바닥 질감
                break;
            }

            case 'low_hp':
                // 위잉- 경고 사이렌 소리
                this.createOscillator('sawtooth', 550, now, 0.15, 0.06);
                this.createOscillator('sawtooth', 650, now + 0.15, 0.15, 0.06);
                break;

            case 'mana_full':
                // 마나 가득 차서 스킬 발동 직전의 영롱한 챠링~ 벨소리
                this.createOscillator('sine', 1500, now, 0.06, 0.03);
                this.createOscillator('sine', 2000, now + 0.04, 0.06, 0.03);
                this.createOscillator('sine', 2500, now + 0.08, 0.3, 0.03);
                break;

            case 'attack_melee':
                // 주먹이나 둔기로 휘두르는 공기 마찰 스윙음 (로우패스 노이즈)
                this.createNoise(now, 0.1, 0.15, 600);
                break;

            case 'attack_ranged':
                // 화살이나 마법 투사체가 피용- 날아가는 사운드 (지수 하강 삼각파)
                const rOsc = this.audioCtx.createOscillator();
                const rGain = this.audioCtx.createGain();
                rOsc.type = 'triangle';
                rOsc.frequency.setValueAtTime(900, now);
                rOsc.frequency.exponentialRampToValueAtTime(250, now + 0.15);
                
                const rVol = 0.06 * this.volume;
                rGain.gain.setValueAtTime(rVol, now);
                rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                
                rOsc.connect(rGain);
                rGain.connect(this.audioCtx.destination);
                rOsc.start(now);
                rOsc.stop(now + 0.15);
                break;

            case 'unit_damage':
                // 퍽- 하고 맞는 듯한 짧고 묵직한 피격음
                this.createNoise(now, 0.08, 0.1, 300);
                this.createOscillator('sine', 120, now, 0.08, 0.08);
                break;

            case 'shield':
                // 보호막이 생기는 청량하고 둥근 웅- 소리
                const sOsc = this.audioCtx.createOscillator();
                const sGain = this.audioCtx.createGain();
                sOsc.type = 'sine';
                sOsc.frequency.setValueAtTime(220, now);
                sOsc.frequency.exponentialRampToValueAtTime(440, now + 0.25);
                
                const sVol = 0.12 * this.volume;
                sGain.gain.setValueAtTime(sVol, now);
                sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                
                sOsc.connect(sGain);
                sGain.connect(this.audioCtx.destination);
                sOsc.start(now);
                sOsc.stop(now + 0.3);
                break;

            case 'attack_crit': {
                // 파괴적이고 강렬한 금속 파편 타격음
                // 1. 묵직한 타격 베이스
                const kickOsc = this.audioCtx.createOscillator();
                const kickGain = this.audioCtx.createGain();
                kickOsc.type = 'triangle';
                kickOsc.frequency.setValueAtTime(450, now);
                kickOsc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
                
                const kVol = 0.4 * this.volume;
                kickGain.gain.setValueAtTime(kVol, now);
                kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                
                kickOsc.connect(kickGain);
                kickGain.connect(this.audioCtx.destination);
                kickOsc.start(now);
                kickOsc.stop(now + 0.15);

                // 2. 바삭하고 거친 밴드패스 노이즈
                const noiseBuffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.25, this.audioCtx.sampleRate);
                const noiseData = noiseBuffer.getChannelData(0);
                for (let i = 0; i < noiseBuffer.length; i++) {
                    noiseData[i] = Math.random() * 2 - 1;
                }
                const noiseSource = this.audioCtx.createBufferSource();
                noiseSource.buffer = noiseBuffer;
                
                const noiseFilter = this.audioCtx.createBiquadFilter();
                noiseFilter.type = 'bandpass';
                noiseFilter.frequency.setValueAtTime(4000, now);
                noiseFilter.frequency.exponentialRampToValueAtTime(1500, now + 0.2);
                noiseFilter.Q.setValueAtTime(3, now);

                const noiseGain = this.audioCtx.createGain();
                const nVol = 0.3 * this.volume;
                noiseGain.gain.setValueAtTime(nVol, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

                noiseSource.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(this.audioCtx.destination);
                noiseSource.start(now);

                // 3. 날카롭고 쨍그랑하는 고주파 금속성 화음
                this.createOscillator('sine', 3200, now, 0.18, 0.08);
                this.createOscillator('triangle', 3900, now, 0.18, 0.08);
                break;
            }

            case 'skill_impact': {
                // 지진/폭발 질감의 웅장한 광역 타격 스킬 사운드
                // 1. 서브 베이스
                const subOsc = this.audioCtx.createOscillator();
                const subGain = this.audioCtx.createGain();
                subOsc.type = 'sine';
                subOsc.frequency.setValueAtTime(300, now);
                subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.35);
                
                const sVol = 0.5 * this.volume;
                subGain.gain.setValueAtTime(sVol, now);
                subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                
                subOsc.connect(subGain);
                subGain.connect(this.audioCtx.destination);
                subOsc.start(now);
                subOsc.stop(now + 0.5);

                // 2. 디스토션 질감의 미드 스퀘어 파형
                const midOsc = this.audioCtx.createOscillator();
                const midGain = this.audioCtx.createGain();
                midOsc.type = 'square';
                midOsc.frequency.setValueAtTime(120, now);
                midOsc.frequency.linearRampToValueAtTime(30, now + 0.18);
                
                const mVol = 0.12 * this.volume;
                midGain.gain.setValueAtTime(mVol, now);
                midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                
                midOsc.connect(midGain);
                midGain.connect(this.audioCtx.destination);
                midOsc.start(now);
                midOsc.stop(now + 0.2);

                // 3. 로우패스 필터로 다듬은 화염 노이즈 쓸기 효과
                const fireBuffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.6, this.audioCtx.sampleRate);
                const fireData = fireBuffer.getChannelData(0);
                for (let i = 0; i < fireBuffer.length; i++) {
                    fireData[i] = Math.random() * 2 - 1;
                }
                const fireSource = this.audioCtx.createBufferSource();
                fireSource.buffer = fireBuffer;

                const fireFilter = this.audioCtx.createBiquadFilter();
                fireFilter.type = 'lowpass';
                fireFilter.frequency.setValueAtTime(2800, now);
                fireFilter.frequency.exponentialRampToValueAtTime(90, now + 0.5);
                fireFilter.Q.setValueAtTime(2, now);

                const fireGain = this.audioCtx.createGain();
                const fVol = 0.25 * this.volume;
                fireGain.gain.setValueAtTime(fVol, now);
                fireGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

                fireSource.connect(fireFilter);
                fireFilter.connect(fireGain);
                gainNodeMapConnect(fireGain, this.audioCtx.destination);
                fireSource.start(now);
                break;
            }

            case 'unit_death': {
                // 맥없이 흐려지며 사라지는 기물 사망음 (LFO 비브라토가 섞인 쏘투스 파형 + 소멸하는 에코)
                const dOsc1 = this.audioCtx.createOscillator();
                const dOsc2 = this.audioCtx.createOscillator();
                const dGain = this.audioCtx.createGain();
                
                dOsc1.type = 'sawtooth';
                dOsc2.type = 'sawtooth';
                
                // 미세 디튠
                dOsc1.frequency.setValueAtTime(140, now);
                dOsc1.frequency.linearRampToValueAtTime(25, now + 0.5);
                dOsc2.frequency.setValueAtTime(143.5, now);
                dOsc2.frequency.linearRampToValueAtTime(26.5, now + 0.5);

                // LFO 비브라토 (6.5Hz)
                const lfo = this.audioCtx.createOscillator();
                const lfoGain = this.audioCtx.createGain();
                lfo.frequency.setValueAtTime(6.5, now);
                lfoGain.gain.setValueAtTime(9, now);
                
                lfo.connect(lfoGain);
                lfoGain.connect(dOsc1.frequency);
                lfoGain.connect(dOsc2.frequency);

                const targetVol = 0.18 * this.volume;
                dGain.gain.setValueAtTime(targetVol, now);
                dGain.gain.linearRampToValueAtTime(0, now + 0.5);

                dOsc1.connect(dGain);
                dOsc2.connect(dGain);
                dGain.connect(this.audioCtx.destination);

                lfo.start(now);
                dOsc1.start(now);
                dOsc2.start(now);
                
                lfo.stop(now + 0.5);
                dOsc1.stop(now + 0.5);
                dOsc2.stop(now + 0.5);
                break;
            }

            case 'upgrade_2star': {
                // 2성 진화: 산뜻하고 가벼우며 희망찬 C4-E4-G4 3화음 상승 연주
                const playBeep = (freq, start, dur) => {
                    this.createOscillator('sine', freq, start, dur, 0.06);
                };
                playBeep(261.63, now, 0.12); // C4
                playBeep(329.63, now + 0.06, 0.12); // E4
                playBeep(392.00, now + 0.12, 0.25); // G4
                break;
            }

            case 'upgrade_3star': {
                // 3성 진화: 화려하고 웅장한 C5 아르페지오 금속성 사운드 + 웅장한 노이즈 스위시
                const playBrass = (freq, start, duration, vol = 0.08) => {
                    const osc1 = this.audioCtx.createOscillator();
                    const osc2 = this.audioCtx.createOscillator();
                    const gainNode = this.audioCtx.createGain();
                    const filter = this.audioCtx.createBiquadFilter();
                    
                    osc1.type = 'sawtooth';
                    osc2.type = 'sawtooth';
                    
                    osc1.frequency.setValueAtTime(freq, start);
                    osc2.frequency.setValueAtTime(freq + 3.5, start);
                    
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(350, start);
                    filter.frequency.exponentialRampToValueAtTime(2400, start + 0.04);
                    filter.frequency.exponentialRampToValueAtTime(650, start + duration);
                    filter.Q.setValueAtTime(1.5, start);

                    const targetVol = vol * this.volume;
                    gainNode.gain.setValueAtTime(0, start);
                    gainNode.gain.linearRampToValueAtTime(targetVol, start + 0.02);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
                    
                    osc1.connect(filter);
                    osc2.connect(filter);
                    filter.connect(gainNode);
                    gainNode.connect(this.audioCtx.destination);
                    
                    osc1.start(start);
                    osc2.start(start);
                    osc1.stop(start + duration);
                    osc2.stop(start + duration);
                };

                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, idx) => {
                    const noteDelay = idx * 0.07;
                    playBrass(freq, now + noteDelay, 0.35, 0.07);
                    
                    // 160ms 딜레이를 준 에코 효과 추가
                    const echoOsc = this.audioCtx.createOscillator();
                    const echoGain = this.audioCtx.createGain();
                    echoOsc.type = 'sine';
                    echoOsc.frequency.setValueAtTime(freq, now + noteDelay + 0.16);
                    
                    const eVol = 0.02 * this.volume;
                    echoGain.gain.setValueAtTime(0, now + noteDelay + 0.16);
                    echoGain.gain.linearRampToValueAtTime(eVol, now + noteDelay + 0.17);
                    echoGain.gain.exponentialRampToValueAtTime(0.001, now + noteDelay + 0.16 + 0.3);
                    
                    echoOsc.connect(echoGain);
                    echoGain.connect(this.audioCtx.destination);
                    echoOsc.start(now + noteDelay + 0.16);
                    echoOsc.stop(now + noteDelay + 0.16 + 0.3);
                });

                // 마무리 화려한 스위시 윈드 노이즈
                const swishBuffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.8, this.audioCtx.sampleRate);
                const swishData = swishBuffer.getChannelData(0);
                for (let i = 0; i < swishBuffer.length; i++) {
                    swishData[i] = Math.random() * 2 - 1;
                }
                const swishSource = this.audioCtx.createBufferSource();
                swishSource.buffer = swishBuffer;

                const swishFilter = this.audioCtx.createBiquadFilter();
                swishFilter.type = 'bandpass';
                swishFilter.frequency.setValueAtTime(1000, now);
                swishFilter.frequency.exponentialRampToValueAtTime(4500, now + 0.4);
                swishFilter.Q.setValueAtTime(2.5, now);

                const swishGain = this.audioCtx.createGain();
                const swVol = 0.08 * this.volume;
                swishGain.gain.setValueAtTime(0, now);
                swishGain.gain.linearRampToValueAtTime(swVol, now + 0.2);
                swishGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

                swishSource.connect(swishFilter);
                swishFilter.connect(swishGain);
                swishGain.connect(this.audioCtx.destination);
                swishSource.start(now);
                break;
            }

            case 'battle_win': {
                // 전투 승리 팡파레! (풍성한 브라스 질감 C 메이저 선율 + 은빛 방울소리 레이어링)
                const playBrass = (freq, start, duration, vol = 0.08) => {
                    const osc1 = this.audioCtx.createOscillator();
                    const osc2 = this.audioCtx.createOscillator();
                    const gainNode = this.audioCtx.createGain();
                    const filter = this.audioCtx.createBiquadFilter();
                    
                    osc1.type = 'sawtooth';
                    osc2.type = 'sawtooth';
                    
                    osc1.frequency.setValueAtTime(freq, start);
                    osc2.frequency.setValueAtTime(freq + 3.5, start);
                    
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(350, start);
                    filter.frequency.exponentialRampToValueAtTime(2400, start + 0.04);
                    filter.frequency.exponentialRampToValueAtTime(650, start + duration);
                    filter.Q.setValueAtTime(1.5, start);

                    const targetVol = vol * this.volume;
                    gainNode.gain.setValueAtTime(0, start);
                    gainNode.gain.linearRampToValueAtTime(targetVol, start + 0.02);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
                    
                    osc1.connect(filter);
                    osc2.connect(filter);
                    filter.connect(gainNode);
                    gainNode.connect(this.audioCtx.destination);
                    
                    osc1.start(start);
                    osc2.start(start);
                    osc1.stop(start + duration);
                    osc2.stop(start + duration);
                };

                // 승리 멜로디 연주
                playBrass(392.00, now, 0.15); // G4
                playBrass(523.25, now + 0.15, 0.15); // C5
                playBrass(659.25, now + 0.30, 0.12); // E5
                playBrass(783.99, now + 0.42, 0.20); // G5
                playBrass(659.25, now + 0.62, 0.15); // E5
                
                // 마스터 피날레 C 메이저 화음 (C5 + E5 + G5 + C6) 동시 폭발
                const finaleStart = now + 0.77;
                const finaleDuration = 0.8;
                playBrass(523.25, finaleStart, finaleDuration, 0.06); // C5
                playBrass(659.25, finaleStart, finaleDuration, 0.06); // E5
                playBrass(783.99, finaleStart, finaleDuration, 0.06); // G5
                playBrass(1046.50, finaleStart, finaleDuration, 0.05); // C6
                
                // 축하 은방울 코러스 효과
                const bellNotes = [1046.50, 1318.51, 1567.98, 2093.00];
                bellNotes.forEach((freq, idx) => {
                    this.createOscillator('sine', freq, finaleStart + 0.1 + (idx * 0.06), 0.3, 0.02);
                });
                break;
            }

            case 'battle_lose': {
                // 전투 패배: 쓸쓸하게 흘러내리는 하강 단조음(마이너 키)과 빗소리 노이즈 감쇄
                const playMutedSaw = (freq, start, duration, vol = 0.06) => {
                    const osc = this.audioCtx.createOscillator();
                    const gain = this.audioCtx.createGain();
                    const filter = this.audioCtx.createBiquadFilter();
                    
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, start);
                    
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(400, start); // 먹먹한 사운드를 위해 로우패스 400Hz 제한
                    
                    const targetVol = vol * this.volume;
                    gain.gain.setValueAtTime(targetVol, start);
                    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
                    
                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.audioCtx.destination);
                    
                    osc.start(start);
                    osc.stop(start + duration);
                };

                // 쓸쓸한 하강 단조 멜로디
                playMutedSaw(349.23, now, 0.25); // F4
                playMutedSaw(311.13, now + 0.22, 0.25); // Eb4
                playMutedSaw(293.66, now + 0.44, 0.25); // D4
                playMutedSaw(220.00, now + 0.66, 0.6, 0.08); // A3 (낮고 어두운 종결음)

                // 빗소리 같은 쓸쓸한 샤- 노이즈
                this.createNoise(now, 1.2, 0.04, 300);
                break;
            }

            case 'society_exe': {
                // 단두대 처형: 고속 낙하하는 날카로운 금속음 + 처참한 분쇄음 + 공허한 벨소리
                // 1. 단두대 칼날 초고속 낙하
                const slideOsc = this.audioCtx.createOscillator();
                const slideGain = this.audioCtx.createGain();
                const slideFilter = this.audioCtx.createBiquadFilter();
                
                slideOsc.type = 'sawtooth';
                slideOsc.frequency.setValueAtTime(5000, now);
                slideOsc.frequency.exponentialRampToValueAtTime(300, now + 0.14);
                
                slideFilter.type = 'highpass';
                slideFilter.frequency.setValueAtTime(2000, now);
                slideFilter.frequency.linearRampToValueAtTime(700, now + 0.14);

                const sVol = 0.18 * this.volume;
                slideGain.gain.setValueAtTime(sVol, now);
                slideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

                slideOsc.connect(slideFilter);
                slideFilter.connect(slideGain);
                slideGain.connect(this.audioCtx.destination);
                slideOsc.start(now);
                slideOsc.stop(now + 0.15);

                // 2. 처형 임팩트 순간 (110ms 딜레이 후 폭발)
                const hitTime = now + 0.11;
                
                // 2.1 찌그러지고 파괴적인 노이즈 버스트
                const smashBuffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.22, this.audioCtx.sampleRate);
                const smashData = smashBuffer.getChannelData(0);
                for (let i = 0; i < smashBuffer.length; i++) {
                    smashData[i] = Math.random() * 2 - 1;
                }
                const smashSource = this.audioCtx.createBufferSource();
                smashSource.buffer = smashBuffer;

                const smashFilter = this.audioCtx.createBiquadFilter();
                smashFilter.type = 'bandpass';
                smashFilter.frequency.setValueAtTime(1400, hitTime);
                smashFilter.Q.setValueAtTime(4, hitTime);

                const smashGain = this.audioCtx.createGain();
                const smVol = 0.45 * this.volume;
                smashGain.gain.setValueAtTime(0, hitTime);
                smashGain.gain.linearRampToValueAtTime(smVol, hitTime + 0.005);
                smashGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.2);

                smashSource.connect(smashFilter);
                smashFilter.connect(smashGain);
                smashGain.connect(this.audioCtx.destination);
                smashSource.start(hitTime);

                // 2.2 뼈 부딪히는 묵직한 중저음
                const boneOsc = this.audioCtx.createOscillator();
                const boneGain = this.audioCtx.createGain();
                boneOsc.type = 'triangle';
                boneOsc.frequency.setValueAtTime(150, hitTime);
                boneOsc.frequency.exponentialRampToValueAtTime(20, hitTime + 0.25);
                
                const bVol = 0.45 * this.volume;
                boneGain.gain.setValueAtTime(bVol, hitTime);
                boneGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.25);
                
                boneOsc.connect(boneGain);
                boneGain.connect(this.audioCtx.destination);
                boneOsc.start(hitTime);
                boneOsc.stop(hitTime + 0.25);

                // 2.3 차갑고 맑은 마지막 고음 종소리
                this.createOscillator('sine', 2600, hitTime, 0.35, 0.12);
                break;
            }

            case 'health_revive': {
                // 보건부 부활: 천상에서 내려오는 듯한 아름다운 코러스 장조 5화음 + 아르페지오 차임벨 연주
                const reviveDur = 1.3;
                const chord = [440.00, 523.25, 659.25, 987.77, 1318.51]; // Am9 화음
                
                chord.forEach((freq, idx) => {
                    const osc1 = this.audioCtx.createOscillator();
                    const osc2 = this.audioCtx.createOscillator();
                    const gainNode = this.audioCtx.createGain();
                    
                    osc1.type = 'sine';
                    osc2.type = 'sine';
                    
                    osc1.frequency.setValueAtTime(freq, now);
                    osc2.frequency.setValueAtTime(freq + 2.5, now); // 코러스 코팅 디튠
                    
                    // 은은하고 떨리는 3.8Hz 비브라토 LFO
                    const lfo = this.audioCtx.createOscillator();
                    const lfoGain = this.audioCtx.createGain();
                    lfo.frequency.setValueAtTime(3.8, now);
                    lfoGain.gain.setValueAtTime(5, now);
                    
                    lfo.connect(lfoGain);
                    lfoGain.connect(osc1.frequency);
                    lfoGain.connect(osc2.frequency);

                    // 아름답게 점차 커지는 페이드인(Attack 450ms) 볼륨 엔벨로프
                    const cVol = 0.05 * this.volume;
                    gainNode.gain.setValueAtTime(0, now);
                    gainNode.gain.linearRampToValueAtTime(cVol, now + 0.45);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + reviveDur);
                    
                    osc1.connect(gainNode);
                    osc2.connect(gainNode);
                    gainNode.connect(this.audioCtx.destination);
                    
                    lfo.start(now);
                    osc1.start(now);
                    osc2.start(now);
                    
                    lfo.stop(now + reviveDur);
                    osc1.stop(now + reviveDur);
                    osc2.stop(now + reviveDur);
                });

                // 하늘 위로 올라가는 은빛 윈드차임 상승 스윕 (10단계)
                const chimeCount = 10;
                for (let i = 0; i < chimeCount; i++) {
                    const chimeDelay = i * 0.07;
                    const chimeFreq = 1600 + (i * 240); // 1600Hz -> 3760Hz 순차 상승
                    this.createOscillator('sine', chimeFreq, now + chimeDelay, 0.35, 0.015);
                }
                break;
            }

            case 'item_combine': {
                // 아이템 조합: 대장간 망치 타격음 배음 + 고속 변조 나선형 주파수 상승음 + 강철 철컥 결속음
                // 1. 강철 대장간 망치 맑은 복합 금속 타격
                const anvilFrequencies = [600, 1050, 1750, 2400];
                anvilFrequencies.forEach((freq, idx) => {
                    const osc = this.audioCtx.createOscillator();
                    const gain = this.audioCtx.createGain();
                    
                    osc.type = (idx === 0) ? 'triangle' : 'sine';
                    osc.frequency.setValueAtTime(freq, now);
                    
                    const targetVol = 0.08 * this.volume;
                    gain.gain.setValueAtTime(targetVol, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                    
                    osc.connect(gain);
                    gain.connect(this.audioCtx.destination);
                    osc.start(now);
                    osc.stop(now + 0.18);
                });

                // 2. 연금술 나선 에너지 고조 상승음 (LFO 28Hz 링 변조 효과)
                const fusionOsc = this.audioCtx.createOscillator();
                const fusionGain = this.audioCtx.createGain();
                
                fusionOsc.type = 'sine';
                fusionOsc.frequency.setValueAtTime(200, now);
                fusionOsc.frequency.linearRampToValueAtTime(1000, now + 0.28);

                const vibratoLFO = this.audioCtx.createOscillator();
                const vibratoLFOGain = this.audioCtx.createGain();
                vibratoLFO.frequency.setValueAtTime(28, now);
                vibratoLFOGain.gain.setValueAtTime(20, now);

                vibratoLFO.connect(vibratoLFOGain);
                vibratoLFOGain.connect(fusionOsc.frequency);

                const fVol = 0.12 * this.volume;
                fusionGain.gain.setValueAtTime(0, now);
                fusionGain.gain.linearRampToValueAtTime(fVol, now + 0.08);
                fusionGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

                fusionOsc.connect(fusionGain);
                fusionGain.connect(this.audioCtx.destination);
                
                vibratoLFO.start(now);
                fusionOsc.start(now);
                
                vibratoLFO.stop(now + 0.3);
                fusionOsc.stop(now + 0.3);

                // 3. 250ms 시점 철컥 결착 스냅 노이즈
                const snapTime = now + 0.25;
                const snapBuffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.1, this.audioCtx.sampleRate);
                const snapData = snapBuffer.getChannelData(0);
                for (let i = 0; i < snapBuffer.length; i++) {
                    snapData[i] = Math.random() * 2 - 1;
                }
                const snapSource = this.audioCtx.createBufferSource();
                snapSource.buffer = snapBuffer;


                const snapFilter = this.audioCtx.createBiquadFilter();
                snapFilter.type = 'bandpass';
                snapFilter.frequency.setValueAtTime(1800, snapTime);
                snapFilter.Q.setValueAtTime(5, snapTime);

                const snapGain = this.audioCtx.createGain();
                const snVol = 0.22 * this.volume;
                snapGain.gain.setValueAtTime(0, snapTime);
                snapGain.gain.linearRampToValueAtTime(snVol, snapTime + 0.005);
                snapGain.gain.exponentialRampToValueAtTime(0.001, snapTime + 0.08);

                snapSource.connect(snapFilter);
                snapFilter.connect(snapGain);
                snapGain.connect(this.audioCtx.destination);
                snapSource.start(snapTime);
                break;
            }

            case 'synergy_levelup': {
                    // C Major 5도 도약 아르페지오 (0.0s ~ 0.5s)
                    const notes = [659.25, 783.99, 1046.50, 1318.51, 1567.98]; // E5, G5, C6, E6, G6
                    notes.forEach((freq, idx) => {
                        const delay = idx * 0.06;
                        this.createOscillator('sine', freq, now + delay, 0.4, 0.05);
                        // 옥타브 에코 잔향
                        this.createOscillator('sine', freq * 0.5, now + delay + 0.15, 0.25, 0.015);
                    });
                    break;
                }

                    }
    }
}

/**
 * 모듈 외부 크로스페이드 등 연결 헬퍼 함수
 */
function gainNodeMapConnect(source, dest) {
    source.connect(dest);
}
