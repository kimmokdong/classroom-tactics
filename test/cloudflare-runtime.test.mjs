import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import worker from '../server/cloudflare-worker.mjs';
import { CloudflareRoomStore } from '../server/cloudflare-room-store.mjs';
import { D1MultiplayerStore } from '../server/d1-multiplayer-store.mjs';
import { createMultiplayerHandler } from '../server/multiplayer-handler.mjs';

class FakeD1Statement {
    constructor(database, sql) {
        this.database = database;
        this.sql = sql.replace(/\s+/g, ' ').trim();
        this.params = [];
    }

    bind(...params) {
        this.params = params;
        return this;
    }

    async first() {
        if (this.sql.startsWith('SELECT 1 AS ok')) return { ok: 1 };
        if (this.sql.startsWith('SELECT value')) {
            const value = this.database.values.get(this.params[0]);
            return value === undefined ? null : { value };
        }
        return null;
    }

    async run() {
        if (this.sql.startsWith('INSERT INTO')) this.database.values.set(this.params[0], this.params[1]);
        if (this.sql.startsWith('DELETE FROM')) this.database.values.delete(this.params[0]);
        return { success: true };
    }

    async all() {
        const [prefixLength, prefix, after, limit] = this.params;
        const results = [...this.database.values.keys()]
            .filter(key => key.slice(0, prefixLength) === prefix && key > after)
            .sort()
            .slice(0, limit)
            .map(key => ({ key }));
        return { success: true, results };
    }
}

class FakeD1 {
    constructor() { this.values = new Map(); }
    prepare(sql) { return new FakeD1Statement(this, sql); }
}

class FakeDurableStorage {
    constructor() { this.values = new Map(); }
    async get(key) { return this.values.get(key); }
    async put(key, value) { this.values.set(key, structuredClone(value)); }
    async delete(key) { this.values.delete(key); }
    async list({ prefix = '' } = {}) {
        return new Map([...this.values].filter(([key]) => key.startsWith(prefix)));
    }
}

async function call(handler, action, body = {}) {
    const response = await handler(new Request(`https://test.local/api/multiplayer/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    }), { params: { action } });
    return { response, data: await response.json() };
}

test('D1 저장소는 JSON 전적을 저장·조회·목록화·삭제한다', async () => {
    const database = new FakeD1();
    const store = new D1MultiplayerStore(database);
    await store.setJSON('matches/room/player2', { placement: 2 });
    await store.setJSON('matches/room/player1', { placement: 1 });

    assert.deepEqual(await store.get('matches/room/player1'), { placement: 1 });
    assert.deepEqual((await store.list({ prefix: 'matches/' })).blobs, [
        { key: 'matches/room/player1' },
        { key: 'matches/room/player2' }
    ]);
    assert.equal(await store.ping(), true);

    await store.delete('matches/room/player2');
    assert.equal(await store.get('matches/room/player2'), null);
});

test('방 상태는 Durable Object에, 완료 경기 전적은 D1에 분리한다', async () => {
    const database = new FakeD1();
    const storage = new FakeDurableStorage();
    const store = new CloudflareRoomStore(storage, database);

    await store.setJSON('rooms/ABC234/meta', { status: 'waiting' });
    await store.setJSON('matches/game/player', { placement: 1 });

    assert.deepEqual(await storage.get('rooms/ABC234/meta'), { status: 'waiting' });
    assert.equal(database.values.has('rooms/ABC234/meta'), false);
    assert.equal(storage.values.has('matches/game/player'), false);
    assert.deepEqual(await store.get('matches/game/player'), { placement: 1 });
});

test('Cloudflare 방 객체가 지정한 코드로 기존 멀티플레이 방을 생성한다', async () => {
    const store = new CloudflareRoomStore(new FakeDurableStorage(), new FakeD1());
    const handler = createMultiplayerHandler({
        getStoreImpl: () => store,
        createRoomCodeImpl: () => 'ABC234'
    });
    const created = await call(handler, 'create', { nickname: '방장' });

    assert.equal(created.response.status, 201);
    assert.equal(created.data.room.code, 'ABC234');
    assert.equal(created.data.room.maxPlayers, 6);
});

test('Worker는 방 생성 요청을 코드별 Durable Object로 전달한다', async () => {
    let routedCode = '';
    let internalCode = '';
    const env = {
        ROOMS: {
            getByName(code) {
                routedCode = code;
                return {
                    async fetch(request) {
                        internalCode = request.headers.get('x-classroom-room-code');
                        return new Response(JSON.stringify({ ok: true, room: { code } }), {
                            status: 201,
                            headers: { 'content-type': 'application/json' }
                        });
                    }
                };
            }
        }
    };
    const response = await worker.fetch(new Request('https://test.local/api/multiplayer/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nickname: '방장' })
    }), env);

    assert.equal(response.status, 201);
    assert.match(routedCode, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(internalCode, routedCode);
});

test('브라우저 WebSocket은 방 코드로 해당 Durable Object에 연결된다', async () => {
    const source = await readFile(new URL('../js/multiplayer/MultiplayerManager.js', import.meta.url), 'utf8');
    assert.match(source, /new WebSocket\(`\$\{protocol\}\/\/\$\{location\.host\}\/ws\?code=\$\{roomCode\}`\)/);
    assert.doesNotMatch(source, /Render 배포 사이트/);
});
