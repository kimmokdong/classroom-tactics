import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';

import { createMultiplayerHandler } from './multiplayer-handler.mjs';
import { createMultiplayerStore } from './multiplayer-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const jsonHeaders = { accept: 'application/json', 'content-type': 'application/json' };

function requestFromExpress(req) {
    const init = { method: req.method, headers: jsonHeaders };
    if (!['GET', 'HEAD'].includes(req.method)) init.body = JSON.stringify(req.body || {});
    return new Request(`http://render.local${req.originalUrl}`, init);
}

export async function createRenderServer({ store, staticRoot, logger = console } = {}) {
    const multiplayerStore = store || await createMultiplayerStore();
    const handler = createMultiplayerHandler({ getStoreImpl: () => multiplayerStore });
    const app = express();
    const server = createServer(app);
    const socketsByRoom = new Map();

    app.disable('x-powered-by');
    app.use(express.json({ limit: '256kb' }));

    const broadcast = (code, message) => {
        for (const socket of socketsByRoom.get(code) || []) {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
        }
    };

    app.get('/health', async (_req, res) => {
        try {
            await multiplayerStore.ping();
            res.json({ ok: true, realtime: true, storage: multiplayerStore.kind });
        } catch (error) {
            logger.error('health check failed', error);
            res.status(503).json({ ok: false });
        }
    });

    app.all('/api/multiplayer/:action', async (req, res) => {
        try {
            const response = await handler(requestFromExpress(req), { params: req.params });
            const text = await response.text();
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.status(response.status).send(text);

            if (response.ok && req.method !== 'GET') {
                const data = JSON.parse(text || '{}');
                const code = data.room?.code || req.body?.code;
                if (code) broadcast(code, { type: 'room:changed', action: req.params.action });
            }
        } catch (error) {
            logger.error('multiplayer route failed', error);
            if (!res.headersSent) res.status(500).json({ ok: false, error: '멀티플레이 서버 처리 중 오류가 발생했습니다.' });
        }
    });

    const resolvedStaticRoot = staticRoot === undefined ? path.join(root, 'dist') : staticRoot;
    if (resolvedStaticRoot && existsSync(resolvedStaticRoot)) app.use(express.static(resolvedStaticRoot));

    const wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', socket => {
        socket.isAlive = true;
        const authTimer = setTimeout(() => socket.close(4001, 'authentication timeout'), 5000);

        socket.on('pong', () => { socket.isAlive = true; });
        socket.once('message', async raw => {
            try {
                const message = JSON.parse(String(raw));
                if (message.type !== 'authenticate') throw new Error('authentication required');
                const query = new URLSearchParams({
                    code: String(message.code || ''),
                    playerId: String(message.playerId || ''),
                    token: String(message.token || '')
                });
                const response = await handler(new Request(`http://render.local/api/multiplayer/room?${query}`, {
                    method: 'GET', headers: jsonHeaders
                }), { params: { action: 'room' } });
                const data = await response.json();
                if (!response.ok || !data.ok) throw new Error('authentication failed');

                clearTimeout(authTimer);
                socket.roomCode = data.room.code;
                const roomSockets = socketsByRoom.get(socket.roomCode) || new Set();
                roomSockets.add(socket);
                socketsByRoom.set(socket.roomCode, roomSockets);
                socket.send(JSON.stringify({ type: 'authenticated', room: data.room }));
            } catch {
                clearTimeout(authTimer);
                socket.close(4001, 'authentication failed');
            }
        });

        socket.on('close', () => {
            clearTimeout(authTimer);
            const roomSockets = socketsByRoom.get(socket.roomCode);
            roomSockets?.delete(socket);
            if (roomSockets?.size === 0) socketsByRoom.delete(socket.roomCode);
        });
        socket.on('error', error => logger.warn('websocket error', error.message));
    });

    const heartbeat = setInterval(() => {
        for (const socket of wss.clients) {
            if (!socket.isAlive) {
                socket.terminate();
                continue;
            }
            socket.isAlive = false;
            socket.ping();
        }
    }, 30000);
    heartbeat.unref();

    return {
        app,
        server,
        store: multiplayerStore,
        listen(port = 0, host = '127.0.0.1') {
            return new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen(port, host, () => resolve(server.address()));
            });
        },
        async close() {
            clearInterval(heartbeat);
            for (const socket of wss.clients) socket.terminate();
            await new Promise(resolve => wss.close(resolve));
            if (server.listening) await new Promise(resolve => server.close(resolve));
            await multiplayerStore.close();
        }
    };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
    const runtime = await createRenderServer();
    const port = Number(process.env.PORT) || 10000;
    await runtime.listen(port, '0.0.0.0');
    console.log(`교실 택틱스 실시간 서버가 ${port}번 포트에서 시작되었습니다.`);
}
