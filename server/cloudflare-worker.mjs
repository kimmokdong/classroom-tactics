import { createMultiplayerHandler } from './multiplayer-handler.mjs';
import { CloudflareRoomStore } from './cloudflare-room-store.mjs';
import { D1MultiplayerStore } from './d1-multiplayer-store.mjs';
import {
    MULTIPLAYER_EMOTE_COOLDOWN_MS,
    MULTIPLAYER_EMOTES,
    sanitizeRoomCode
} from '../js/multiplayer/core.js';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INTERNAL_ROOM_CODE_HEADER = 'x-classroom-room-code';
const allowedEmotes = new Set(MULTIPLAYER_EMOTES);
const jsonHeaders = { accept: 'application/json', 'content-type': 'application/json' };

const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

function createRoomCode() {
    const random = new Uint8Array(6);
    crypto.getRandomValues(random);
    return [...random].map(value => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('');
}

function getAction(url) {
    return url.pathname.split('/').filter(Boolean).at(-1) || '';
}

async function getRoomCode(request) {
    const url = new URL(request.url);
    const queryCode = sanitizeRoomCode(url.searchParams.get('code'));
    if (queryCode) return queryCode;
    if (['GET', 'HEAD'].includes(request.method)) return '';
    try {
        const body = await request.clone().json();
        return sanitizeRoomCode(body?.code);
    } catch {
        return '';
    }
}

function roomStub(env, code) {
    return env.ROOMS.getByName(code);
}

async function forwardCreate(request, env) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = createRoomCode();
        const headers = new Headers(request.headers);
        headers.set(INTERNAL_ROOM_CODE_HEADER, code);
        const response = await roomStub(env, code).fetch(new Request(request.clone(), { headers }));
        if (response.status !== 503) return response;
    }
    return json({ ok: false, error: '방 코드를 만들지 못했습니다. 다시 시도해 주세요.' }, 503);
}

async function forwardApi(request, env) {
    const url = new URL(request.url);
    const action = getAction(url);
    if (action === 'create' && request.method === 'POST') return forwardCreate(request, env);

    if (action === 'stats' && request.method === 'GET') {
        const store = new D1MultiplayerStore(env.MATCHES);
        const handler = createMultiplayerHandler({ getStoreImpl: () => store });
        return handler(request, { params: { action } });
    }

    const code = await getRoomCode(request);
    if (!code) return json({ ok: false, error: '방 코드가 필요합니다.' }, 400);
    return roomStub(env, code).fetch(request);
}

async function handleRequest(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
        const store = new D1MultiplayerStore(env.MATCHES);
        await store.ping();
        return json({ ok: true, realtime: true, storage: 'durable-object+d1' });
    }
    if (url.pathname === '/ws') {
        if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
            return json({ ok: false, error: 'WebSocket 연결이 필요합니다.' }, 426);
        }
        const code = sanitizeRoomCode(url.searchParams.get('code'));
        if (!code) return json({ ok: false, error: '방 코드가 필요합니다.' }, 400);
        return roomStub(env, code).fetch(request);
    }
    if (url.pathname.startsWith('/api/multiplayer/')) return forwardApi(request, env);
    return env.ASSETS.fetch(request);
}

export default {
    async fetch(request, env) {
        try {
            return await handleRequest(request, env);
        } catch (error) {
            console.error('cloudflare_worker_request_failed', {
                path: new URL(request.url).pathname,
                message: error instanceof Error ? error.message : String(error)
            });
            return json({ ok: false, error: '서버 처리 중 오류가 발생했습니다.' }, 500);
        }
    }
};

export class RoomSession {
    constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env;
        this.store = new CloudflareRoomStore(ctx.storage, env.MATCHES);
    }

    createHandler(roomCode) {
        return createMultiplayerHandler({
            getStoreImpl: () => this.store,
            ...(roomCode ? { createRoomCodeImpl: () => roomCode } : {})
        });
    }

    broadcast(message) {
        const payload = JSON.stringify(message);
        for (const socket of this.ctx.getWebSockets()) {
            const attachment = socket.deserializeAttachment();
            if (!attachment?.authenticated) continue;
            try { socket.send(payload); } catch { /* 닫히는 중인 연결은 다음 이벤트에서 정리된다. */ }
        }
    }

    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/ws' && request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);
            server.serializeAttachment({ authenticated: false, connectedAt: Date.now() });
            this.ctx.acceptWebSocket(server);
            return new Response(null, { status: 101, webSocket: client });
        }

        const action = getAction(url);
        const fixedRoomCode = sanitizeRoomCode(request.headers.get(INTERNAL_ROOM_CODE_HEADER));
        const response = await this.createHandler(fixedRoomCode)(request, { params: { action } });
        if (response.ok && !['GET', 'HEAD'].includes(request.method)) {
            this.broadcast({ type: 'room:changed', action });
        }
        return response;
    }

    async authenticateSocket(socket, message) {
        const query = new URLSearchParams({
            code: String(message.code || ''),
            playerId: String(message.playerId || ''),
            token: String(message.token || '')
        });
        const response = await this.createHandler()(new Request(
            `https://room.internal/api/multiplayer/room?${query}`,
            { method: 'GET', headers: jsonHeaders }
        ), { params: { action: 'room' } });
        const data = await response.json();
        if (!response.ok || !data.ok) {
            socket.close(4001, 'authentication failed');
            return;
        }
        const player = data.room.players.find(entry => entry.id === data.room.selfId);
        socket.serializeAttachment({
            authenticated: true,
            code: data.room.code,
            playerId: data.room.selfId,
            token: String(message.token || ''),
            nickname: player?.nickname || '',
            lastEmoteAt: 0
        });
        socket.send(JSON.stringify({ type: 'authenticated', room: data.room }));
    }

    async webSocketMessage(socket, rawMessage) {
        let message;
        try { message = JSON.parse(String(rawMessage)); } catch { return; }
        const attachment = socket.deserializeAttachment() || {};
        if (!attachment.authenticated) {
            if (message.type !== 'authenticate') {
                socket.close(4001, 'authentication required');
                return;
            }
            await this.authenticateSocket(socket, message);
            return;
        }
        if (message.type !== 'emote' || !allowedEmotes.has(message.emote)) return;

        const now = Date.now();
        if (now - Number(attachment.lastEmoteAt || 0) < MULTIPLAYER_EMOTE_COOLDOWN_MS) {
            socket.send(JSON.stringify({ type: 'emote:rejected', reason: 'rate_limited' }));
            return;
        }
        socket.serializeAttachment({ ...attachment, lastEmoteAt: now });
        this.broadcast({
            type: 'emote',
            playerId: attachment.playerId,
            nickname: attachment.nickname,
            emote: message.emote,
            sentAt: now
        });
    }

    async reportDisconnect(socket) {
        const attachment = socket.deserializeAttachment();
        if (!attachment?.authenticated) return;
        const hasReplacement = this.ctx.getWebSockets().some(entry => {
            if (entry === socket) return false;
            const candidate = entry.deserializeAttachment();
            return candidate?.authenticated && candidate.playerId === attachment.playerId;
        });
        if (hasReplacement) return;

        const response = await this.createHandler()(new Request(
            'https://room.internal/api/multiplayer/disconnect',
            {
                method: 'POST',
                headers: jsonHeaders,
                body: JSON.stringify({
                    code: attachment.code,
                    playerId: attachment.playerId,
                    token: attachment.token
                })
            }
        ), { params: { action: 'disconnect' } });
        if (response.ok) this.broadcast({ type: 'room:changed', action: 'disconnect' });
    }

    async webSocketClose(socket, code, reason) {
        await this.reportDisconnect(socket);
        try { socket.close(code, reason); } catch { /* 이미 닫힌 연결 */ }
    }

    async webSocketError(socket, error) {
        console.warn('room_websocket_error', {
            message: error instanceof Error ? error.message : String(error)
        });
        await this.reportDisconnect(socket);
    }
}
