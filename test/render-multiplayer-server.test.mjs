import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { WebSocket } from 'ws';

import { createRenderServer } from '../server/index.mjs';
import { MemoryMultiplayerStore } from '../server/multiplayer-store.mjs';

async function api(baseUrl, action, body, method = 'POST') {
    const response = await fetch(`${baseUrl}/api/multiplayer/${action}`, {
        method,
        headers: { 'content-type': 'application/json' },
        ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) })
    });
    const data = await response.json();
    assert.equal(data.ok, true, data.error);
    return data;
}

function waitForMessage(socket, predicate, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('WebSocket 메시지 대기 시간 초과')), timeoutMs);
        const onMessage = raw => {
            const message = JSON.parse(String(raw));
            if (!predicate(message)) return;
            clearTimeout(timer);
            socket.off('message', onMessage);
            resolve(message);
        };
        socket.on('message', onMessage);
    });
}

async function connectPlayer(wsUrl, credentials) {
    const socket = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
    });
    const authenticated = waitForMessage(socket, message => message.type === 'authenticated');
    socket.send(JSON.stringify({ type: 'authenticate', ...credentials }));
    await authenticated;
    return socket;
}

test('Render 서버는 방 변경과 상대 보드 제출을 WebSocket으로 즉시 알린다', async t => {
    const runtime = await createRenderServer({
        store: new MemoryMultiplayerStore(),
        staticRoot: null,
        logger: { error() {}, warn() {} }
    });
    const address = await runtime.listen();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const wsUrl = `ws://127.0.0.1:${address.port}/ws`;
    const sockets = [];
    t.after(async () => {
        for (const socket of sockets) socket.terminate();
        await runtime.close();
    });

    const health = await fetch(`${baseUrl}/health`).then(response => response.json());
    assert.deepEqual(health, { ok: true, realtime: true, storage: 'memory' });

    const host = await api(baseUrl, 'create', { nickname: '방장학생' });
    assert.equal(host.room.players[0].placement, null);
    const guest = await api(baseUrl, 'join', { nickname: '참가학생', code: host.room.code });
    const hostCredentials = { code: host.room.code, playerId: host.room.selfId, token: host.token };
    const guestCredentials = { code: guest.room.code, playerId: guest.room.selfId, token: guest.token };
    const hostSocket = await connectPlayer(wsUrl, hostCredentials);
    sockets.push(hostSocket);

    const readyNotice = waitForMessage(hostSocket, message => message.type === 'room:changed' && message.action === 'ready');
    await api(baseUrl, 'ready', { ...guestCredentials, ready: true });
    await readyNotice;

    await api(baseUrl, 'start', hostCredentials);
    const hostWaiting = await api(baseUrl, 'round', {
        ...hostCredentials, stage: [1, 1], hp: 100, gold: 10, board: [], globalBuffs: {}, augments: []
    });
    assert.equal(hostWaiting.waiting, true);

    const roundNotice = waitForMessage(hostSocket, message => message.type === 'room:changed' && message.action === 'round');
    await api(baseUrl, 'round', {
        ...guestCredentials, stage: [1, 1], hp: 100, gold: 10, board: [], globalBuffs: {}, augments: []
    });
    await roundNotice;

    const matched = await api(baseUrl, 'round', {
        ...hostCredentials, stage: [1, 1], hp: 100, gold: 10, board: [], globalBuffs: {}, augments: []
    });
    assert.equal(matched.opponent.id, guest.room.selfId);
});

test('Render Blueprint는 Git 자동 배포와 Postgres 연결을 선언한다', () => {
    const blueprint = fs.readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.match(blueprint, /autoDeployTrigger:\s*commit/);
    assert.match(blueprint, /property:\s*connectionString/);
    assert.equal(packageJson.scripts.start, 'node server/index.mjs');
    assert.ok(packageJson.dependencies.ws);
    assert.ok(packageJson.dependencies.pg);
});
