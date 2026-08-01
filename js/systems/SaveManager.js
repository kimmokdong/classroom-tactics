import { createInitialState } from '../core/GameState.js';
import { AUGMENTS } from '../data.js';
import { deserializeAugments, serializeAugments } from './AugmentManager.js';
import { isValidItemId } from '../battle/combatPreparation.js';

export const SAVE_KEY = 'classroom-tactics-save';
export const SAVE_VERSION = 3;
export const SAVE_PHASES = Object.freeze({
    BATTLE_FINISHED: 'BATTLE_FINISHED',
    REWARD_PENDING: 'REWARD_PENDING',
    REWARD_SELECTED: 'REWARD_SELECTED',
    REWARD_APPLIED: 'REWARD_APPLIED',
    NEXT_ROUND_READY: 'NEXT_ROUND_READY'
});

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUnit = value => value === null || isObject(value);

function normalizePersistedUnit(value) {
    if (!isObject(value)) return null;
    const unit = { ...value };
    unit.items = Array.isArray(value.items) ? value.items.filter(itemId => isValidItemId(itemId)).slice(0, 3) : [];
    if (Array.isArray(value.thievesItems)) {
        unit.thievesItems = value.thievesItems.filter(itemId => isValidItemId(itemId)).slice(0, 2);
    }
    return unit;
}

function normalizeOpponentLobby(raw) {
    if (!isObject(raw) || !Array.isArray(raw.opponents) || raw.opponents.length !== 7) return null;
    const opponents = raw.opponents.map(opponent => {
        const profile = opponent?.profile;
        const validProfile = isObject(profile)
            && typeof profile.id === 'string'
            && typeof profile.strategy === 'string'
            && typeof profile.strengthTier === 'string'
            && ['economySkill', 'pivotSkill', 'positioningSkill', 'riskTolerance'].every(key => Number.isFinite(profile[key]));
        if (!isObject(opponent) || !validProfile || typeof opponent.id !== 'string'
            || !Array.isArray(opponent.board) || !Array.isArray(opponent.bench)) return null;
        return {
            ...opponent,
            level: Number.isFinite(opponent.level) ? Math.max(1, Math.min(10, opponent.level)) : 1,
            xp: Number.isFinite(opponent.xp) ? Math.max(0, opponent.xp) : 0,
            gold: Number.isFinite(opponent.gold) ? Math.max(0, opponent.gold) : 0,
            health: Number.isFinite(opponent.health) ? Math.max(1, opponent.health) : 100,
            board: Array.from({ length: 24 }, (_, index) => normalizePersistedUnit(opponent.board[index])),
            bench: opponent.bench.map(normalizePersistedUnit).filter(Boolean).slice(0, 10),
            items: Array.isArray(opponent.items) ? opponent.items.filter(itemId => isValidItemId(itemId)) : [],
            history: Array.isArray(opponent.history) ? opponent.history.filter(isObject).slice(-12) : []
        };
    });
    if (opponents.some(opponent => opponent === null)) return null;
    return {
        ...raw,
        version: Number.isFinite(raw.version) ? raw.version : 1,
        lastProcessedRound: Number.isFinite(raw.lastProcessedRound) ? Math.max(0, raw.lastProcessedRound) : 0,
        currentRound: Number.isFinite(raw.currentRound) ? Math.max(0, raw.currentRound) : 0,
        currentOpponentId: typeof raw.currentOpponentId === 'string' ? raw.currentOpponentId : null,
        recentOpponentIds: Array.isArray(raw.recentOpponentIds) ? raw.recentOpponentIds.filter(id => typeof id === 'string').slice(-2) : [],
        playerAdjustment: Number.isFinite(raw.playerAdjustment) ? Math.max(-0.05, Math.min(0.05, raw.playerAdjustment)) : 0,
        opponents
    };
}

export class SaveManager {
    constructor(app, storage = globalThis.localStorage) {
        this.app = app;
        this.storage = storage;
        this.metadata = this.createMetadata(app.state);
        this.transactionSnapshot = null;
        this.autoSaveTimer = null;
        this.beforeUnloadHandler = null;
    }

    createMetadata(state) {
        return {
            saveVersion: SAVE_VERSION,
            runId: state.runId,
            runSeed: state.runSeed,
            savedAt: 0,
            currentPhase: SAVE_PHASES.NEXT_ROUND_READY,
            appliedTransactionIds: []
        };
    }

    serializeState(state) {
        const serialized = JSON.parse(JSON.stringify(state, (key, value) => {
            if (key === 'dpsStats' || key === 'combat' || key === 'buffs' || typeof value === 'function') return undefined;
            return value;
        }));
        serialized.augments = serializeAugments(state.augments);
        return serialized;
    }

    save(currentPhase = this.metadata.currentPhase) {
        if (!this.storage) return false;
        try {
            this.metadata = {
                ...this.metadata,
                saveVersion: SAVE_VERSION,
                runId: this.app.state.runId,
                runSeed: this.app.state.runSeed,
                savedAt: Date.now(),
                currentPhase
            };
            this.storage.setItem(SAVE_KEY, JSON.stringify({ metadata: this.metadata, state: this.serializeState(this.app.state) }));
            return true;
        } catch (error) {
            console.warn('게임 저장 실패:', error);
            return false;
        }
    }

    load() {
        if (!this.storage) return null;
        const raw = this.storage.getItem(SAVE_KEY);
        if (!raw) return null;
        try {
            const migrated = this.migrate(JSON.parse(raw));
            if (!migrated) throw new Error('지원하지 않는 저장 데이터');
            this.app.state = migrated.state;
            this.metadata = migrated.metadata;

            if (this.metadata.pendingTransactionId) {
                delete this.metadata.pendingTransactionId;
                this.metadata.currentPhase = SAVE_PHASES.BATTLE_FINISHED;
                this.save(SAVE_PHASES.BATTLE_FINISHED);
            }
            return this.app.state;
        } catch (error) {
            console.warn('저장 데이터 복원 실패, 새 게임으로 시작합니다:', error);
            this.storage.removeItem(SAVE_KEY);
            return null;
        }
    }

    migrate(parsed) {
        if (!isObject(parsed)) return null;
        const envelope = isObject(parsed.state) ? parsed : { state: parsed, metadata: {} };
        const version = Number(envelope.metadata?.saveVersion || 1);
        if (version > SAVE_VERSION) return null;
        const state = this.normalizeState(envelope.state);
        const applied = Array.isArray(envelope.metadata?.appliedTransactionIds)
            ? envelope.metadata.appliedTransactionIds.filter(id => typeof id === 'string').slice(-100)
            : [];
        const metadata = {
            ...this.createMetadata(state),
            ...envelope.metadata,
            saveVersion: SAVE_VERSION,
            runId: state.runId,
            runSeed: state.runSeed,
            appliedTransactionIds: applied
        };
        return { state, metadata };
    }

    normalizeState(raw) {
        const base = createInitialState();
        if (!isObject(raw)) return base;
        const state = { ...base };

        for (const [key, defaultValue] of Object.entries(base)) {
            const value = raw[key];
            if (typeof defaultValue === 'number' && Number.isFinite(value)) state[key] = value;
            else if (typeof defaultValue === 'boolean' && typeof value === 'boolean') state[key] = value;
            else if (typeof defaultValue === 'string' && typeof value === 'string') state[key] = value;
        }
        if (typeof raw.runSeed === 'string' || Number.isFinite(raw.runSeed)) state.runSeed = raw.runSeed;
        if (Array.isArray(raw.stage) && raw.stage.length === 2 && raw.stage.every(Number.isFinite)) state.stage = [...raw.stage];

        for (const [key, length] of [['board', 24], ['enemyBoard', 24], ['bench', 10], ['shop', 5]]) {
            if (Array.isArray(raw[key])) state[key] = Array.from({ length }, (_, index) => normalizePersistedUnit(raw[key][index]));
        }
        state.opponentLobby = normalizeOpponentLobby(raw.opponentLobby);
        if (Array.isArray(raw.recentBattleResults)) {
            state.recentBattleResults = raw.recentBattleResults.filter(entry => isObject(entry)
                && Number.isFinite(entry.round)
                && ['player', 'enemy', 'draw'].includes(entry.result)).slice(-8);
        }
        if (Array.isArray(raw.inventory)) state.inventory = Array.from({ length: 12 }, (_, index) => isValidItemId(raw.inventory[index]) ? raw.inventory[index] : null);
        if (Array.isArray(raw.pendingRewards)) {
            state.pendingRewards = raw.pendingRewards.flatMap(reward => {
                if (!isObject(reward)) return [];
                if (reward.type === 'item' && isValidItemId(reward.itemId)) return [reward];
                if (reward.type === 'unit') {
                    const unit = normalizePersistedUnit(reward.unit);
                    return unit ? [{ ...reward, unit }] : [];
                }
                return [];
            });
        }

        if (isObject(raw.globalBuffs)) {
            state.globalBuffs = { ...base.globalBuffs };
            for (const [key, value] of Object.entries(raw.globalBuffs)) {
                if (Number.isFinite(value) || typeof value === 'boolean') state.globalBuffs[key] = value;
            }
        }
        if (isObject(raw.sharedPool)) {
            state.sharedPool = Object.fromEntries(Object.entries(raw.sharedPool).filter(([, value]) => Number.isFinite(value) && value >= 0));
        }

        const augmentIds = Array.isArray(raw.augments)
            ? raw.augments.map(augment => typeof augment === 'string' ? augment : augment?.id).filter(Boolean)
            : [];
        state.augments = deserializeAugments(augmentIds, AUGMENTS);
        return state;
    }

    beginTransaction(id) {
        if (!id || this.metadata.appliedTransactionIds.includes(id) || this.metadata.pendingTransactionId) return false;
        const previousPhase = this.metadata.currentPhase;
        this.transactionSnapshot = structuredClone(this.app.state);
        this.metadata.pendingTransactionId = id;
        if (this.save(SAVE_PHASES.REWARD_PENDING)) return true;
        delete this.metadata.pendingTransactionId;
        this.metadata.currentPhase = previousPhase;
        this.transactionSnapshot = null;
        return false;
    }

    commitTransaction(id, phase = SAVE_PHASES.NEXT_ROUND_READY) {
        if (this.metadata.pendingTransactionId !== id) return false;
        const previousMetadata = { ...this.metadata };
        this.metadata.appliedTransactionIds = [...this.metadata.appliedTransactionIds, id].slice(-100);
        delete this.metadata.pendingTransactionId;
        if (this.save(phase)) {
            this.transactionSnapshot = null;
            return true;
        }
        this.app.state = this.transactionSnapshot;
        this.transactionSnapshot = null;
        this.metadata = { ...previousMetadata, currentPhase: SAVE_PHASES.BATTLE_FINISHED };
        delete this.metadata.pendingTransactionId;
        return false;
    }

    runTransaction(id, apply, phase = SAVE_PHASES.NEXT_ROUND_READY) {
        if (!this.beginTransaction(id)) return false;
        try {
            apply();
            return this.commitTransaction(id, phase);
        } catch (error) {
            this.app.state = this.transactionSnapshot;
            this.transactionSnapshot = null;
            delete this.metadata.pendingTransactionId;
            this.save(SAVE_PHASES.BATTLE_FINISHED);
            throw error;
        }
    }

    startAutoSave(intervalMs = 5000) {
        if (!this.storage || this.autoSaveTimer !== null) return;
        const saveIfSafe = () => {
            if (!this.app.isBattlePhase && !this.metadata.pendingTransactionId) this.save();
        };
        this.autoSaveTimer = setInterval(saveIfSafe, intervalMs);
        this.beforeUnloadHandler = saveIfSafe;
        globalThis.window?.addEventListener('beforeunload', this.beforeUnloadHandler);
    }

    destroy() {
        if (this.autoSaveTimer !== null) clearInterval(this.autoSaveTimer);
        if (this.beforeUnloadHandler) globalThis.window?.removeEventListener('beforeunload', this.beforeUnloadHandler);
        this.autoSaveTimer = null;
        this.beforeUnloadHandler = null;
    }

    clear() {
        this.storage?.removeItem(SAVE_KEY);
    }
}
