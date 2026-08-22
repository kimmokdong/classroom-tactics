import { D1MultiplayerStore } from './d1-multiplayer-store.mjs';

const isMatchKey = key => String(key).startsWith('matches/');

export class CloudflareRoomStore {
    constructor(storage, matchesDatabase) {
        if (!storage?.get || !storage?.put || !storage?.list) {
            throw new TypeError('Durable Object 저장소가 필요합니다.');
        }
        this.kind = 'durable-object+d1';
        this.storage = storage;
        this.matches = new D1MultiplayerStore(matchesDatabase);
    }

    async get(key) {
        if (isMatchKey(key)) return this.matches.get(key);
        return await this.storage.get(String(key)) ?? null;
    }

    async setJSON(key, value) {
        if (isMatchKey(key)) return this.matches.setJSON(key, value);
        await this.storage.put(String(key), value);
    }

    async delete(key) {
        if (isMatchKey(key)) return this.matches.delete(key);
        await this.storage.delete(String(key));
    }

    list({ prefix = '', paginate = false } = {}) {
        if (isMatchKey(prefix)) return this.matches.list({ prefix, paginate });
        return paginate ? this.pages(prefix) : this.page(prefix);
    }

    async page(prefix) {
        const entries = await this.storage.list({ prefix: String(prefix), limit: 1000 });
        return { blobs: [...entries.keys()].sort().map(key => ({ key })) };
    }

    async *pages(prefix) {
        yield await this.page(prefix);
    }

    async ping() {
        return this.matches.ping();
    }

    async close() {}
}
