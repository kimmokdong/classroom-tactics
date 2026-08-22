const TABLE = 'multiplayer_store';

function normalizeLimit(limit) {
    return Math.min(1000, Math.max(1, Math.floor(Number(limit) || 1000)));
}

export class D1MultiplayerStore {
    constructor(database) {
        if (!database?.prepare) throw new TypeError('D1 데이터베이스 바인딩이 필요합니다.');
        this.kind = 'd1';
        this.database = database;
    }

    async get(key) {
        const row = await this.database
            .prepare(`SELECT value FROM ${TABLE} WHERE key = ?1`)
            .bind(String(key))
            .first();
        if (!row) return null;
        try {
            return JSON.parse(row.value);
        } catch {
            return null;
        }
    }

    async setJSON(key, value) {
        await this.database.prepare(`
            INSERT INTO ${TABLE} (key, value, updated_at)
            VALUES (?1, ?2, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
        `).bind(String(key), JSON.stringify(value)).run();
    }

    async delete(key) {
        await this.database
            .prepare(`DELETE FROM ${TABLE} WHERE key = ?1`)
            .bind(String(key))
            .run();
    }

    list({ prefix = '', paginate = false } = {}) {
        return paginate ? this.pages(prefix) : this.page(prefix);
    }

    async page(prefix, after = '', limit = 1000) {
        const normalizedPrefix = String(prefix);
        const result = await this.database.prepare(`
            SELECT key FROM ${TABLE}
            WHERE substr(key, 1, ?1) = ?2 AND key > ?3
            ORDER BY key
            LIMIT ?4
        `).bind(
            normalizedPrefix.length,
            normalizedPrefix,
            String(after),
            normalizeLimit(limit)
        ).all();
        return { blobs: (result.results || []).map(row => ({ key: row.key })) };
    }

    async *pages(prefix) {
        let after = '';
        while (true) {
            const page = await this.page(prefix, after);
            yield page;
            if (page.blobs.length < 1000) break;
            after = page.blobs.at(-1).key;
        }
    }

    async ping() {
        const row = await this.database.prepare('SELECT 1 AS ok').first();
        return Number(row?.ok) === 1;
    }

    async close() {}
}
