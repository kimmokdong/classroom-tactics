import { createUnitInstance } from '../battle/combatPreparation.js';
import { isPveStage } from '../pveRounds.js';
import {
    buildBoardSnapshot,
    calculateBoardCost,
    getRoundKey,
    sanitizeNickname,
    sanitizeRoomCode
} from './core.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const MULTIPLAYER_SESSION_KEY = 'classroom-tactics-multiplayer-session';
const MULTIPLAYER_EMOTES = Object.freeze({
    hello: '👋', nice: '👍', wow: '😮', oops: '😅', cheer: '🔥', gg: '👏'
});
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

export class MultiplayerManager {
    constructor(app) {
        this.app = app;
        this.credentials = null;
        this.room = null;
        this.isActive = false;
        this.isFinished = false;
        this.isSpectating = false;
        this.preparedRound = null;
        this.battleClock = null;
        this.currentOpponent = null;
        this.opponentContext = null;
        this.pollTimer = null;
        this.pollBusy = false;
        this.socket = null;
        this.reconnectTimer = null;
        this.realtimeWaiters = new Set();
        this.isLeaving = false;
        this.syncPromise = null;
        this.stats = null;
        this.statsView = 'units';
        this.enterGame = null;
        this.unloadHandler = null;
        this.scoutSnapshots = [];
        this.selectedScoutId = null;
        this.scoutRefreshAt = 0;
        this.pendingRestoredState = null;
    }

    bindTitle({ multiButton, enterGame, setTitleStatus }) {
        this.enterGame = enterGame;
        this.setTitleStatus = setTitleStatus;
        this.bindPanelEvents();
        multiButton?.addEventListener('click', () => this.openPanel('play'));
        if (!this.unloadHandler) {
            this.unloadHandler = () => this.persistSession();
            window.addEventListener('beforeunload', this.unloadHandler);
        }
        this.restoreSession();
    }

    bindPanelEvents() {
        this.panel = document.getElementById('multiplayer-panel');
        if (!this.panel || this.panel.dataset.bound === 'true') return;
        this.panel.dataset.bound = 'true';
        const nickname = document.getElementById('multi-nickname');
        if (nickname) nickname.value = globalThis.localStorage?.getItem('classroom-tactics-nickname') || '';

        document.getElementById('btn-multi-close')?.addEventListener('click', () => this.closePanel());
        document.getElementById('btn-multi-create')?.addEventListener('click', () => this.createRoom());
        document.getElementById('btn-multi-join')?.addEventListener('click', () => this.joinRoom());
        document.getElementById('btn-multi-ready')?.addEventListener('click', () => this.toggleReady());
        document.getElementById('btn-multi-start')?.addEventListener('click', () => this.startGame());
        document.getElementById('btn-multi-copy')?.addEventListener('click', () => this.copyRoomCode());
        document.getElementById('btn-multi-leave')?.addEventListener('click', () => this.leaveMultiplayer());
        document.getElementById('btn-multi-hud-stats')?.addEventListener('click', () => this.openPanel('stats'));
        document.getElementById('btn-multi-hud-result')?.addEventListener('click', () => this.showFinalResult());
        document.getElementById('btn-multi-scout')?.addEventListener('click', () => this.openScout());
        document.getElementById('btn-multi-scout-close')?.addEventListener('click', () => this.closeScout());
        document.getElementById('btn-multi-emote')?.addEventListener('click', () => this.toggleEmotes());
        document.getElementById('btn-multi-rematch')?.addEventListener('click', () => this.rematch());
        document.getElementById('btn-multi-hud-rematch')?.addEventListener('click', () => this.rematch());
        document.getElementById('btn-multi-hud-leave')?.addEventListener('click', () => this.leaveMultiplayer());
        document.querySelectorAll('[data-multi-emote]').forEach(button => {
            button.addEventListener('click', () => this.sendEmote(button.dataset.multiEmote));
        });
        document.addEventListener('click', event => {
            if (!this.isSpectating || !event.target.closest('#shop-slots .shop-card')) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);

        this.panel.querySelectorAll('[data-multi-tab]').forEach(button => {
            button.addEventListener('click', () => {
                this.showPanelView(button.dataset.multiTab);
                if (button.dataset.multiTab === 'stats') this.loadStats();
            });
        });
        this.panel.querySelectorAll('[data-stats-view]').forEach(button => {
            button.addEventListener('click', () => {
                this.statsView = button.dataset.statsView;
                this.renderStats();
            });
        });
        document.getElementById('multi-room-code')?.addEventListener('input', event => {
            event.target.value = sanitizeRoomCode(event.target.value);
        });
    }

    openPanel(view = 'play') {
        if (!this.panel) this.bindPanelEvents();
        if (!this.panel) return;
        this.panel.hidden = false;
        this.showPanelView(view);
        if (view === 'stats') this.loadStats();
        setTimeout(() => document.getElementById(view === 'stats' ? 'btn-multi-close' : 'multi-nickname')?.focus(), 0);
    }

    closePanel() {
        if (this.panel) this.panel.hidden = true;
    }

    showPanelView(view) {
        const resolved = view === 'stats' ? 'stats' : (this.credentials ? 'lobby' : 'play');
        this.panel?.querySelectorAll('[data-multi-view]').forEach(element => {
            element.hidden = element.dataset.multiView !== resolved;
        });
        this.panel?.querySelectorAll('[data-multi-tab]').forEach(button => {
            button.classList.toggle('active', button.dataset.multiTab === (resolved === 'stats' ? 'stats' : 'play'));
        });
        if (resolved === 'lobby') this.renderRoom();
    }

    setStatus(message, type = 'info') {
        const element = document.getElementById('multi-status');
        if (element) {
            element.textContent = message;
            element.dataset.type = type;
        }
        this.setTitleStatus?.(message);
    }

    async request(action, { method = 'POST', body = {}, authenticated = false } = {}) {
        const payload = authenticated ? { ...body, ...this.credentials } : body;
        const options = { method, headers: { accept: 'application/json' } };
        let url = `/api/multiplayer/${action}`;
        if (method === 'GET') {
            const params = new URLSearchParams(payload);
            if ([...params].length) url += `?${params}`;
        } else {
            options.headers['content-type'] = 'application/json';
            options.body = JSON.stringify(payload);
        }
        const response = await fetch(url, options);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || '멀티플레이 서버에 연결하지 못했습니다.');
        return data;
    }

    getNickname() {
        const nickname = sanitizeNickname(document.getElementById('multi-nickname')?.value);
        if (nickname) globalThis.localStorage?.setItem('classroom-tactics-nickname', nickname);
        return nickname;
    }

    persistSession() {
        if (!this.credentials || this.isLeaving) return;
        try {
            globalThis.sessionStorage?.setItem(MULTIPLAYER_SESSION_KEY, JSON.stringify({
                credentials: this.credentials,
                isActive: this.isActive,
                state: this.isActive ? this.app.saveManager?.serializeState(this.app.state) : null
            }));
        } catch (error) {
            console.warn('멀티플레이 세션 저장 실패:', error);
        }
    }

    clearSession() {
        globalThis.sessionStorage?.removeItem(MULTIPLAYER_SESSION_KEY);
    }

    async restoreSession() {
        let saved;
        try {
            saved = JSON.parse(globalThis.sessionStorage?.getItem(MULTIPLAYER_SESSION_KEY) || 'null');
        } catch {
            this.clearSession();
            return;
        }
        if (!saved?.credentials?.code || !saved.credentials.playerId || !saved.credentials.token) return;
        this.credentials = saved.credentials;
        this.pendingRestoredState = saved.isActive ? saved.state : null;
        try {
            const data = await this.request('room', { method: 'GET', authenticated: true });
            this.room = data.room;
            this.showPanelView(data.room.status === 'waiting' ? 'lobby' : 'play');
            this.updateRoom(data.room);
            if (data.room.status === 'finished' && saved.isActive) {
                this.isActive = true;
                this.enterGame?.();
                this.renderHud();
            }
            if (data.room.status !== 'playing') this.openPanel('play');
            this.startPolling();
            this.setStatus(`방 ${data.room.code}에 다시 연결했습니다.`, 'success');
        } catch {
            this.credentials = null;
            this.pendingRestoredState = null;
            this.clearSession();
        }
    }

    async createRoom() {
        const nickname = this.getNickname();
        if (nickname.length < 2) return this.setStatus('닉네임을 2자 이상 입력해 주세요.', 'warning');
        this.setStatus('새 교실을 만드는 중입니다…');
        try {
            const data = await this.request('create', { body: { nickname } });
            this.acceptRoom(data);
            this.setStatus('방을 만들었습니다. 코드를 친구에게 알려 주세요.', 'success');
        } catch (error) {
            this.setStatus(this.friendlyNetworkError(error), 'error');
        }
    }

    async joinRoom() {
        const nickname = this.getNickname();
        const code = sanitizeRoomCode(document.getElementById('multi-room-code')?.value);
        if (nickname.length < 2) return this.setStatus('닉네임을 2자 이상 입력해 주세요.', 'warning');
        if (code.length !== 6) return this.setStatus('6자리 방 코드를 입력해 주세요.', 'warning');
        this.setStatus('교실에 입장하는 중입니다…');
        try {
            const data = await this.request('join', { body: { nickname, code } });
            this.acceptRoom(data);
            this.setStatus('입장했습니다. 준비 버튼을 눌러 주세요.', 'success');
        } catch (error) {
            this.setStatus(this.friendlyNetworkError(error), 'error');
        }
    }

    acceptRoom(data) {
        this.isLeaving = false;
        this.credentials = {
            code: data.room.code,
            playerId: data.room.selfId,
            token: data.token || this.credentials?.token
        };
        this.room = data.room;
        this.persistSession();
        this.showPanelView('lobby');
        this.renderRoom();
        this.startPolling();
    }

    startPolling() {
        clearInterval(this.pollTimer);
        this.connectRealtime();
        // WebSocket이 끊긴 상황에서도 방 상태를 복구하는 느린 안전망만 유지한다.
        this.pollTimer = setInterval(() => this.refreshRoom(), 15000);
    }

    connectRealtime() {
        if (!this.credentials || this.isLeaving || typeof WebSocket === 'undefined') return;
        if ([WebSocket.CONNECTING, WebSocket.OPEN].includes(this.socket?.readyState)) return;
        clearTimeout(this.reconnectTimer);

        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${protocol}//${location.host}/ws`);
        this.socket = socket;
        socket.addEventListener('open', () => {
            socket.send(JSON.stringify({ type: 'authenticate', ...this.credentials }));
        });
        socket.addEventListener('message', event => {
            let message;
            try { message = JSON.parse(event.data); } catch { return; }
            if (message.type === 'authenticated' && message.room) this.updateRoom(message.room);
            if (message.type === 'emote') this.showEmote(message.emote, message.nickname || message.playerName);
            if (message.type === 'emote:rejected') this.app.showFeedback?.('감정 표현은 잠시 뒤 다시 보낼 수 있습니다.', 'warning');
            if (message.type === 'room:changed') {
                this.wakeRealtimeWaiters();
                this.refreshRoom();
            }
        });
        socket.addEventListener('close', () => {
            if (this.socket === socket) this.socket = null;
            this.wakeRealtimeWaiters();
            if (this.credentials && !this.isLeaving) {
                this.reconnectTimer = setTimeout(() => this.connectRealtime(), 2000);
            }
        });
    }

    waitForRealtime(timeoutMs = 5000) {
        return new Promise(resolve => {
            let timer;
            const wake = () => {
                clearTimeout(timer);
                this.realtimeWaiters.delete(wake);
                resolve();
            };
            timer = setTimeout(wake, timeoutMs);
            this.realtimeWaiters.add(wake);
        });
    }

    wakeRealtimeWaiters() {
        for (const wake of [...this.realtimeWaiters]) wake();
    }

    stopRealtime() {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.socket?.close();
        this.socket = null;
        this.wakeRealtimeWaiters();
    }

    async refreshRoom() {
        if (!this.credentials || this.pollBusy) return;
        this.pollBusy = true;
        try {
            const data = await this.request('room', { method: 'GET', authenticated: true });
            this.updateRoom(data.room);
        } catch (error) {
            this.setStatus(this.friendlyNetworkError(error), 'error');
        } finally {
            this.pollBusy = false;
        }
    }

    updateRoom(room) {
        if (!room) return;
        this.room = room;
        this.battleClock = room.battleClock || null;
        this.renderRoom();
        this.renderHud();
        if (room.status === 'playing' && !this.isActive) this.activateGame();
        const self = room.players.find(player => player.id === this.credentials?.playerId);
        if (room.status === 'playing' && Number(self?.hp) <= 0) this.enterSpectatorMode();
        if (room.status === 'finished') {
            this.isFinished = true;
            this.setGameControlsDisabled(true);
            const startButton = document.getElementById('btn-start-battle');
            if (startButton) {
                startButton.disabled = true;
                startButton.textContent = '🏁 대전 종료';
            }
        }
        this.persistSession();
    }

    renderRoom() {
        if (!this.room) return;
        const code = document.getElementById('multi-lobby-code');
        if (code) code.textContent = this.room.code;
        const list = document.getElementById('multi-player-list');
        if (list) {
            list.innerHTML = this.room.players.map(player => `
                <li class="multi-player${player.id === this.credentials?.playerId ? ' is-me' : ''}">
                    <span class="multi-player__rank">${player.placement ? `${player.placement}위` : (player.isHost ? '방장' : '학생')}</span>
                    <strong>${escapeHtml(player.nickname)}</strong>
                    <span>${player.connected === false ? '🔌 재연결 대기' : (this.room.status === 'waiting' ? (player.ready ? '✅ 준비' : '⏳ 대기') : `❤️ ${Math.max(0, player.hp)} · ${escapeHtml(player.stage?.join('-') || '1-1')}`)}</span>
                </li>`).join('');
        }
        const self = this.room.players.find(player => player.id === this.credentials?.playerId);
        const readyButton = document.getElementById('btn-multi-ready');
        const startButton = document.getElementById('btn-multi-start');
        const rematchButton = document.getElementById('btn-multi-rematch');
        if (readyButton) {
            readyButton.hidden = self?.isHost || this.room.status !== 'waiting';
            readyButton.textContent = self?.ready ? '준비 취소' : '준비 완료';
        }
        if (startButton) {
            startButton.hidden = !self?.isHost || this.room.status !== 'waiting';
            startButton.disabled = this.room.players.length < this.room.minPlayers || this.room.players.some(player => !player.ready);
        }
        if (rematchButton) rematchButton.hidden = !self?.isHost || this.room.status !== 'finished';
        const count = document.getElementById('multi-player-count');
        if (count) {
            const ready = this.room.players.filter(player => player.ready).length;
            count.textContent = this.room.status === 'waiting'
                ? `${this.room.players.length}/${this.room.maxPlayers} · 준비 ${ready}/${this.room.players.length}`
                : `${this.room.players.length}/${this.room.maxPlayers}`;
        }
    }

    async toggleReady() {
        const self = this.room?.players.find(player => player.id === this.credentials?.playerId);
        if (!self) return;
        try {
            const data = await this.request('ready', { authenticated: true, body: { ready: !self.ready } });
            this.updateRoom(data.room);
        } catch (error) {
            this.setStatus(this.friendlyNetworkError(error), 'error');
        }
    }

    async startGame() {
        this.setStatus('모든 교실을 같은 출발선에 맞추는 중입니다…');
        try {
            const data = await this.request('start', { authenticated: true });
            this.updateRoom(data.room);
        } catch (error) {
            this.setStatus(this.friendlyNetworkError(error), 'error');
        }
    }

    async activateGame() {
        if (this.isActive || !this.room) return;
        this.isActive = true;
        this.isFinished = false;
        this.isSpectating = false;
        this.preparedRound = null;
        this.battleClock = null;
        if (this.pendingRestoredState) {
            this.app.state = this.app.saveManager.normalizeState(this.pendingRestoredState);
            this.app.state.multiplayer = {
                roomId: this.room.id,
                roomCode: this.room.code,
                playerId: this.credentials.playerId
            };
            this.app.saveManager.metadata = this.app.saveManager.createMetadata(this.app.state);
            this.app.clearInteractionSelection?.();
            this.app.spawnEnemyBoard();
            this.app.renderBoard();
            this.app.renderUnits();
            this.app.renderShop();
            this.app.renderInventory();
            this.app.calculateSynergy();
            this.app.updateHeader();
            this.pendingRestoredState = null;
        } else {
            this.app.resetForMultiplayer?.({ room: this.room, playerId: this.credentials.playerId });
        }
        this.closePanel();
        this.enterGame?.();
        this.setGameControlsDisabled(false);
        this.renderHud();
        this.startPolling();
        this.persistSession();
        this.app.showFeedback?.(`멀티플레이 방 ${this.room.code}에 입장했습니다.`, 'success');
    }

    isPveRound() {
        return isPveStage(this.app.state.stage, { includeOpening: true });
    }

    shouldPrepareBattle() {
        return this.isActive && !this.isFinished && !this.isSpectating
            && this.preparedRound !== getRoundKey(this.app.state.stage);
    }

    getBattleClock(roundKey = getRoundKey(this.app.state.stage)) {
        const clock = this.battleClock || this.room?.battleClock;
        return clock?.roundKey === roundKey ? clock : null;
    }

    async waitForBattleStart(roundKey) {
        const clock = this.getBattleClock(roundKey);
        if (!clock) return;
        const startButton = document.getElementById('btn-start-battle');
        while (Date.now() < clock.startedAt) {
            const seconds = Math.max(1, Math.ceil((clock.startedAt - Date.now()) / 1000));
            if (startButton) startButton.textContent = `⚔️ 동시 전투 시작 ${seconds}초`;
            await sleep(Math.min(100, clock.startedAt - Date.now()));
        }
    }

    async waitForBattleEnd(roundKey) {
        const timerContainer = document.getElementById('battle-timer-container');
        const timerText = document.getElementById('battle-timer');
        while (this.isActive) {
            const clock = this.getBattleClock(roundKey);
            if (!clock) break;
            const remaining = clock.deadline - Date.now();
            if (timerContainer) {
                timerContainer.style.display = 'flex';
                timerContainer.style.borderColor = remaining <= 5_000 ? '#e74c3c' : '#3498db';
            }
            if (timerText) {
                timerText.textContent = String(Math.max(0, Math.ceil(remaining / 1000)));
                timerText.style.color = remaining <= 5_000 ? '#ff7675' : '#fff';
            }
            if (remaining <= 0) break;
            await this.waitForRealtime(Math.min(500, remaining));
            await this.refreshRoom();
        }
        if (timerContainer) timerContainer.style.display = 'none';
    }

    battlePayload() {
        return {
            stage: this.app.state.stage,
            hp: this.app.state.hp,
            gold: this.app.state.gold,
            board: buildBoardSnapshot(this.app.state.board),
            globalBuffs: this.app.state.globalBuffs,
            augments: this.app.state.augments.map(augment => augment.id)
        };
    }

    async prepareBattle() {
        if (!this.shouldPrepareBattle()) return true;
        if (this.syncPromise) return this.syncPromise;
        const roundKey = getRoundKey(this.app.state.stage);
        const startButton = document.getElementById('btn-start-battle');
        this.syncPromise = (async () => {
            if (startButton) {
                startButton.disabled = true;
                startButton.textContent = '👥 상대 준비 대기 중…';
            }
            try {
                while (this.isActive && !this.isFinished && getRoundKey(this.app.state.stage) === roundKey) {
                    const data = await this.request('round', { authenticated: true, body: this.battlePayload() });
                    this.updateRoom(data.room);
                    if (data.finished) return false;
                    if (data.ready || data.opponent) {
                        this.battleClock = data.room?.battleClock || null;
                        this.currentOpponent = data.opponent || null;
                        this.opponentContext = data.opponent ? {
                            globalBuffs: data.opponent.globalBuffs || {},
                            playerHp: data.opponent.hp,
                            gold: data.opponent.gold || 0,
                            augments: data.opponent.augments || []
                        } : null;
                        if (data.opponent) this.app.state.enemyBoard = this.hydrateOpponentBoard(data.opponent.board);
                        this.preparedRound = roundKey;
                        this.app.renderUnits();
                        const info = document.getElementById('enemy-info');
                        if (info && data.opponent) info.textContent = `🌐 ${data.opponent.nickname} · ❤️ ${data.opponent.hp} · 보드 ${calculateBoardCost(data.opponent.board)}코스트`;
                        await this.waitForBattleStart(roundKey);
                        this.persistSession();
                        return true;
                    }
                    const alive = this.room?.players.filter(player => Number(player.hp) > 0) || [];
                    const submitted = alive.filter(player => player.roundKey === roundKey).length;
                    this.setStatus(`${roundKey} 라운드 보드 제출 ${submitted}/${alive.length} · 모두 준비되면 곧바로 시작합니다.`);
                    this.renderHud();
                    await this.waitForRealtime();
                }
                return false;
            } catch (error) {
                this.app.showFeedback?.(this.friendlyNetworkError(error), 'warning');
                if (startButton) {
                    startButton.disabled = false;
                    startButton.textContent = '⚔️ 전투 시작';
                }
                return false;
            } finally {
                this.syncPromise = null;
            }
        })();
        return this.syncPromise;
    }

    hydrateOpponentBoard(board) {
        return Array.from({ length: 24 }, (_, index) => {
            const entry = Array.isArray(board) ? board[index] : null;
            const template = this.app.UNIT_POOL.find(unit => unit.id === entry?.unitId);
            if (!template) return null;
            const unit = createUnitInstance(template, {
                star: entry.star,
                itemIds: entry.items,
                teamRole: 'opponent'
            });
            if (entry.permGrowth) unit.permGrowth = { ...entry.permGrowth };
            if (entry.thievesItems) unit.thievesItems = [...entry.thievesItems];
            return unit;
        });
    }

    async reportBattle(winner, endLog) {
        if (!this.isActive) return null;
        const roundKey = getRoundKey(this.app.state.stage);
        const body = { ...this.battlePayload(), winner, survivingEnemies: endLog?.survivingEnemies || 0 };
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const data = await this.request('result', { authenticated: true, body });
                this.updateRoom(data.room);
                await this.waitForBattleEnd(roundKey);
                data.room = this.room || data.room;
                return data;
            } catch (error) {
                if (attempt === 0) await sleep(700);
                else this.app.showFeedback?.('전투 통계 전송에 실패했습니다. 다음 동기화 때 다시 확인합니다.', 'warning');
            }
        }
        return null;
    }

    setGameControlsDisabled(disabled) {
        document.body.classList.toggle('multi-spectating', disabled);
        for (const id of ['btn-start-battle', 'btn-reroll', 'btn-buy-exp', 'btn-lock-shop']) {
            const button = document.getElementById(id);
            if (button) button.disabled = disabled;
        }
        document.querySelectorAll('#shop-slots .shop-card').forEach(card => {
            card.setAttribute('aria-disabled', String(disabled));
            card.tabIndex = disabled ? -1 : 0;
        });
    }

    enterSpectatorMode() {
        if (this.isSpectating || this.room?.status !== 'playing') return;
        this.isSpectating = true;
        this.app.isBattlePhase = false;
        window.isBattlePhase = false;
        this.setGameControlsDisabled(true);
        const startButton = document.getElementById('btn-start-battle');
        if (startButton) startButton.textContent = '👀 관전 중';
        this.openScout();
        this.persistSession();
        this.app.showFeedback?.('탈락했습니다. 참가자들의 최근 제출 보드를 관전할 수 있습니다.', 'warning');
    }

    async openScout() {
        const panel = document.getElementById('multi-scout-panel');
        if (panel) panel.hidden = false;
        await this.loadScout();
    }

    closeScout() {
        const panel = document.getElementById('multi-scout-panel');
        if (panel) panel.hidden = true;
    }

    async loadScout(force = true) {
        if (!this.credentials) return;
        if (!force && Date.now() - this.scoutRefreshAt < 3000) return;
        const status = document.getElementById('multi-scout-status');
        if (status) status.textContent = '최근 제출 보드를 불러오는 중…';
        try {
            const data = await this.request('scout', {
                method: 'GET', authenticated: true,
                body: { roundKey: getRoundKey(this.app.state.stage) }
            });
            const raw = data.candidates || data.scouts || data.players || data.boards
                || [data.candidate, data.recent].filter(Boolean);
            this.scoutSnapshots = (Array.isArray(raw) ? raw : []).map(entry => ({
                ...entry,
                ...(entry.snapshot || {}),
                id: entry.id || entry.playerId || entry.snapshot?.id,
                nickname: entry.nickname || entry.playerName || entry.snapshot?.nickname || '참가자',
                board: entry.board || entry.snapshot?.board || []
            })).filter(entry => entry.id && Array.isArray(entry.board));
            this.scoutRefreshAt = Date.now();
            if (!this.scoutSnapshots.some(entry => entry.id === this.selectedScoutId)) {
                this.selectedScoutId = this.scoutSnapshots.find(entry => Number(entry.hp) > 0)?.id
                    || this.scoutSnapshots[0]?.id || null;
            }
            this.renderScout();
        } catch (error) {
            if (status) status.textContent = this.friendlyNetworkError(error);
        }
    }

    renderScout() {
        const tabs = document.getElementById('multi-scout-candidates');
        const status = document.getElementById('multi-scout-status');
        if (tabs) {
            tabs.innerHTML = this.scoutSnapshots.map((entry, index) => `
                <button type="button" data-scout-index="${index}" class="${entry.id === this.selectedScoutId ? 'active' : ''}">
                    ${entry.actualOpponent ? '🎯 ' : ''}${escapeHtml(entry.nickname)} <small>${Math.max(0, Number(entry.hp) || 0)}HP</small>
                </button>`).join('');
            tabs.querySelectorAll('[data-scout-index]').forEach(button => {
                button.addEventListener('click', () => {
                    this.selectedScoutId = this.scoutSnapshots[Number(button.dataset.scoutIndex)]?.id;
                    this.renderScout();
                });
            });
        }
        const selected = this.scoutSnapshots.find(entry => entry.id === this.selectedScoutId);
        if (status) status.textContent = selected
            ? `${selected.nickname} · ${selected.stage?.join?.('-') || selected.roundKey || '최근'} 제출 · ${Number(selected.boardCost) || 0}코스트`
            : '아직 정찰할 수 있는 제출 보드가 없습니다.';
        const board = document.getElementById('multi-scout-board');
        if (!board) return;
        board.innerHTML = Array.from({ length: 24 }, (_, index) => {
            const snapshot = selected?.board?.[index];
            const unit = this.app.UNIT_POOL.find(candidate => candidate.id === snapshot?.unitId);
            return `<div class="multi-scout-cell${unit ? ' is-filled' : ''}" title="${unit ? escapeHtml(`${unit.name} ${snapshot.star || 1}성`) : ''}">
                ${unit ? `<span>${escapeHtml(unit.icon)}</span><small>${snapshot.star > 1 ? '★'.repeat(snapshot.star) : ''}</small>` : ''}
            </div>`;
        }).join('');
    }

    toggleEmotes() {
        const menu = document.getElementById('multi-emote-menu');
        if (menu) menu.hidden = !menu.hidden;
    }

    sendEmote(emote) {
        if (!MULTIPLAYER_EMOTES[emote]) return;
        if (Date.now() - (this.lastEmoteSentAt || 0) < 1500) return;
        this.lastEmoteSentAt = Date.now();
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'emote', emote }));
        }
        this.showEmote(emote, '나');
        const menu = document.getElementById('multi-emote-menu');
        if (menu) menu.hidden = true;
    }

    showEmote(emote, nickname = '') {
        if (!MULTIPLAYER_EMOTES[emote]) return;
        const bubble = document.getElementById('multi-emote-bubble');
        if (!bubble) return;
        bubble.textContent = `${nickname ? `${nickname} ` : ''}${MULTIPLAYER_EMOTES[emote]}`;
        bubble.hidden = false;
        clearTimeout(this.emoteTimer);
        this.emoteTimer = setTimeout(() => { bubble.hidden = true; }, 1800);
    }

    async rematch() {
        const self = this.room?.players.find(player => player.id === this.credentials?.playerId);
        if (!self?.isHost || this.room?.status !== 'finished') return;
        this.setStatus('같은 방 코드로 재대결을 준비하는 중입니다…');
        try {
            const data = await this.request('rematch', { authenticated: true });
            if (data.token) this.credentials.token = data.token;
            this.room = data.room;
            this.isActive = false;
            this.isFinished = false;
            this.isSpectating = false;
            this.isLeaving = false;
            this.preparedRound = null;
            this.currentOpponent = null;
            this.opponentContext = null;
            this.setGameControlsDisabled(false);
            this.closeScout();
            this.openPanel('play');
            this.renderRoom();
            this.renderHud();
            this.startPolling();
            this.persistSession();
            this.setStatus(`방 ${this.room.code}에서 재대결을 준비합니다.`, 'success');
        } catch (error) {
            this.setStatus(this.friendlyNetworkError(error), 'error');
        }
    }

    showPostGameControls() {
        this.app.isBattlePhase = false;
        window.isBattlePhase = false;
        this.renderHud();
        this.openPanel('play');
    }

    renderHud() {
        const hud = document.getElementById('multiplayer-hud');
        if (!hud) return;
        hud.hidden = !this.isActive;
        if (!this.isActive || !this.room) return;
        const self = this.room.players.find(player => player.id === this.credentials?.playerId);
        const alivePlayers = this.room.players.filter(player => Number(player.hp) > 0);
        const roundKey = getRoundKey(this.app.state.stage);
        const submitted = alivePlayers.filter(player => player.roundKey === roundKey).length;
        const text = document.getElementById('multi-hud-text');
        if (text) text.textContent = this.room.status === 'finished'
            ? `🏁 ${self?.placement || '-'}위 · 최종 보드 ${self?.boardCost || 0}코스트`
            : this.isSpectating
                ? `👀 관전 중 · 생존 ${alivePlayers.length}/${this.room.players.length}`
                : `🌐 ${this.room.code} · 생존 ${alivePlayers.length}/${this.room.players.length} · 제출 ${submitted}/${alivePlayers.length}`;
        const resultButton = document.getElementById('btn-multi-hud-result');
        if (resultButton) resultButton.hidden = this.room.status !== 'finished';
        const rematchButton = document.getElementById('btn-multi-hud-rematch');
        if (rematchButton) rematchButton.hidden = this.room.status !== 'finished' || !self?.isHost;
        const leaveButton = document.getElementById('btn-multi-hud-leave');
        if (leaveButton) leaveButton.hidden = this.room.status !== 'finished';
        const scoutButton = document.getElementById('btn-multi-scout');
        if (scoutButton) scoutButton.hidden = this.room.status !== 'playing';
        if (this.isSpectating) this.loadScout(false);
    }

    showFinalResult() {
        const self = this.room?.players.find(player => player.id === this.credentials?.playerId);
        if (!self) return;
        const medal = self.placement === 1 ? '🏆' : (self.placement <= 3 ? '🏅' : '📋');
        this.app.showResultModal?.(
            `${medal} 멀티플레이 ${self.placement}위`,
            `<strong>${escapeHtml(self.nickname)}</strong> · 최종 보드 비용 <strong>${self.boardCost || 0}코스트</strong><br>이번 결과는 밸런스 통계에 누적되었습니다.`,
            self.placement === 1 ? 'win' : 'loss',
            () => this.showPostGameControls()
        );
    }

    async copyRoomCode() {
        if (!this.room?.code) return;
        try {
            await navigator.clipboard.writeText(this.room.code);
            this.setStatus(`방 코드 ${this.room.code}를 복사했습니다.`, 'success');
        } catch {
            this.setStatus(`방 코드: ${this.room.code}`, 'info');
        }
    }

    async leaveMultiplayer() {
        this.isLeaving = true;
        clearInterval(this.pollTimer);
        this.stopRealtime();
        if (this.credentials) {
            try { await this.request('leave', { authenticated: true }); } catch { /* 새로고침으로 로컬 세션은 종료된다. */ }
        }
        this.clearSession();
        // isActive는 새로고침이 끝날 때까지 유지해 싱글 저장 슬롯을 덮어쓰지 않게 한다.
        location.reload();
    }

    async loadStats() {
        const content = document.getElementById('multi-stats-content');
        if (content) content.innerHTML = '<p class="multi-empty">누적 전적을 불러오는 중입니다…</p>';
        try {
            const data = await this.request('stats', { method: 'GET' });
            this.stats = data.stats;
            this.renderStats();
        } catch (error) {
            if (content) content.innerHTML = `<p class="multi-empty is-error">${escapeHtml(this.friendlyNetworkError(error))}</p>`;
        }
    }

    renderStats() {
        if (!this.stats) return;
        const summary = this.stats.summary;
        const summaryEl = document.getElementById('multi-stats-summary');
        if (summaryEl) summaryEl.innerHTML = [
            ['완료 게임', `${summary.matches}회`],
            ['탑3 확률', `${summary.top3Rate}%`],
            ['1등 확률', `${summary.winRate}%`],
            ['평균 보드 비용', `${summary.avgBoardCost}코스트`]
        ].map(([label, value]) => `<div><small>${label}</small><strong>${value}</strong></div>`).join('');
        const version = document.getElementById('multi-stats-version');
        if (version) version.textContent = `밸런스 ${this.stats.balanceVersion}`;

        this.panel?.querySelectorAll('[data-stats-view]').forEach(button => {
            button.classList.toggle('active', button.dataset.statsView === this.statsView);
        });
        const content = document.getElementById('multi-stats-content');
        if (!content) return;
        const rows = this.stats[this.statsView] || [];
        if (!rows.length) {
            content.innerHTML = '<p class="multi-empty">아직 완료된 멀티플레이 기록이 없습니다.</p>';
            return;
        }
        if (this.statsView === 'boards') {
            content.innerHTML = this.statsTable(['주요 조합', '게임', '탑3', '1등', '평균 순위', '평균 비용'], rows.slice(0, 30).map(row => [
                (row.units || []).map(unit => `${escapeHtml(unit.icon)} ${escapeHtml(unit.name)} ${unit.star || 1}★`).join(' · '),
                row.games, `${row.top3Rate}%`, `${row.winRate}%`, row.avgPlacement, `${row.avgBoardCost}`
            ]));
        } else if (this.statsView === 'synergies') {
            content.innerHTML = this.statsTable(['시너지', '게임', '탑3', '1등', '평균 순위', '평균 비용'], rows.slice(0, 50).map(row => [
                `${row.type === 'subjects' ? '📘' : '🎒'} ${escapeHtml(row.name)} ${row.level}`, row.games,
                `${row.top3Rate}%`, `${row.winRate}%`, row.avgPlacement, row.avgBoardCost
            ]));
        } else if (this.statsView === 'recent') {
            content.innerHTML = this.statsTable(['순위', '플레이어', '최종 보드', '비용', '완료'], rows.map(row => [
                `${row.placement}위`, escapeHtml(row.nickname),
                (row.units || []).map(unit => `${escapeHtml(unit.icon)}${unit.star || 1}★`).join(' '),
                `${row.boardCost}코스트`, new Date(row.completedAt).toLocaleDateString('ko-KR')
            ]));
        } else {
            content.innerHTML = this.statsTable(['유닛', '게임', '탑3', '1등', '평균 순위', '평균 비용'], rows.slice(0, 80).map(row => [
                `${escapeHtml(row.icon)} ${escapeHtml(row.name)} <small>${row.tier}코</small>`, row.games,
                `${row.top3Rate}%`, `${row.winRate}%`, row.avgPlacement, row.avgBoardCost
            ]));
        }
    }

    statsTable(headers, rows) {
        return `<div class="multi-table-wrap"><table class="multi-stats-table"><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    friendlyNetworkError(error) {
        const message = String(error?.message || error || '알 수 없는 오류');
        if (/Unexpected token|Failed to fetch|404|서버에 연결/.test(message)) {
            return '실시간 멀티플레이 서버가 실행 중인 Render 배포 사이트에서 이용할 수 있습니다.';
        }
        return message;
    }
}
