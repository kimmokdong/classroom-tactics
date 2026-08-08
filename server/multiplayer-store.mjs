import pg from 'pg';

const { Pool } = pg;
const TABLE = 'multiplayer_store';
const clone = value => value == null ? null : structuredClone(value);

export class MemoryMultiplayerStore {
    constructor(seed = new Map()) {
        this.kind = 'memory';
        this.values = seed;
    }

    async get(key) {
        return clone(this.values.get(key));
    }

    async setJSON(key, value) {
        this.values.set(key, clone(value));
    }

    async delete(key) {
        this.values.delete(key);
    }

    list({ prefix = '', paginate = false } = {}) {
        return paginate ? this.pages(prefix) : this.page(prefix);
    }

    async page(prefix) {
        return {
            blobs: [...this.values.keys()]
                .filter(key => key.startsWith(prefix))
                .sort()
                .map(key => ({ key }))
        };
    }

    async *pages(prefix) {
        yield await this.page(prefix);
    }

    async ping() {
        return true;
    }

    async close() {}
}

export class PostgresMultiplayerStore {
    constructor(connectionString, { pool } = {}) {
        this.kind = 'postgres';
        this.pool = pool || new Pool({ connectionString });
        this.ready = this.pool.query(`
            CREATE TABLE IF NOT EXISTS ${TABLE} (
                key TEXT PRIMARY KEY,
                value JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
    }

    async get(key) {
        await this.ready;
        const result = await this.pool.query(`SELECT value FROM ${TABLE} WHERE key = $1`, [key]);
        return result.rows[0]?.value ?? null;
    }

    async setJSON(key, value) {
        await this.ready;
        await this.pool.query(`
            INSERT INTO ${TABLE} (key, value, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `, [key, JSON.stringify(value)]);
    }

    async delete(key) {
        await this.ready;
        await this.pool.query(`DELETE FROM ${TABLE} WHERE key = $1`, [key]);
    }

    list({ prefix = '', paginate = false } = {}) {
        return paginate ? this.pages(prefix) : this.page(prefix);
    }

    async page(prefix, after = '', limit = 1000) {
        await this.ready;
        const result = await this.pool.query(`
            SELECT key FROM ${TABLE}
            WHERE key LIKE $1 AND key > $2
            ORDER BY key
            LIMIT $3
        `, [`${prefix}%`, after, limit]);
        return { blobs: result.rows.map(row => ({ key: row.key })) };
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
        await this.ready;
        await this.pool.query('SELECT 1');
        return true;
    }

    async close() {
        await this.pool.end();
    }
}

export async function createMultiplayerStore({ connectionString = process.env.DATABASE_URL, pool } = {}) {
    if (!connectionString && !pool) {
        // ponytail: 로컬 개발은 메모리 저장소로 충분하며, 운영에서는 DATABASE_URL로 Postgres를 사용한다.
        return new MemoryMultiplayerStore();
    }
    const store = new PostgresMultiplayerStore(connectionString, { pool });
    await store.ready;
    return store;
}
