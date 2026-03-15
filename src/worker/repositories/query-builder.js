// ============================================================
// D1 Query Builder - Type-safe query helper
// ============================================================
export class QueryBuilder {
    db;
    constructor(db) {
        this.db = db;
    }
    async queryOne(sql, params = []) {
        const stmt = this.db.prepare(sql);
        const result = await stmt.bind(...params).first();
        return result ?? null;
    }
    async queryMany(sql, params = []) {
        const stmt = this.db.prepare(sql);
        const result = await stmt.bind(...params).all();
        return result.results;
    }
    async execute(sql, params = []) {
        const stmt = this.db.prepare(sql);
        return stmt.bind(...params).run();
    }
    async batch(statements) {
        const stmts = statements.map(({ sql, params = [] }) => this.db.prepare(sql).bind(...params));
        return this.db.batch(stmts);
    }
    /**
     * Execute with transaction-like batch
     * D1 does not support real transactions via HTTP, but batch is atomic
     */
    async transaction(fn) {
        const statements = await fn(this);
        return this.batch(statements);
    }
}
