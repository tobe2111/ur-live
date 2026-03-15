// ============================================================
// D1 Query Builder - Type-safe query helper
// ============================================================

import type { D1Database, D1Result } from '@cloudflare/workers-types';

export class QueryBuilder {
  constructor(private db: D1Database) {}

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const result = await stmt.bind(...params).first<T>();
    return result ?? null;
  }

  async queryMany<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const result: D1Result<T> = await stmt.bind(...params).all<T>();
    return result.results;
  }

  async execute(sql: string, params: unknown[] = []): Promise<D1Result> {
    const stmt = this.db.prepare(sql);
    return stmt.bind(...params).run();
  }

  async batch(statements: { sql: string; params?: unknown[] }[]): Promise<D1Result[]> {
    const stmts = statements.map(({ sql, params = [] }) =>
      this.db.prepare(sql).bind(...params)
    );
    return this.db.batch(stmts);
  }

  /**
   * Execute with transaction-like batch
   * D1 does not support real transactions via HTTP, but batch is atomic
   */
  async transaction(fn: (qb: QueryBuilder) => Promise<{ sql: string; params?: unknown[] }[]>): Promise<D1Result[]> {
    const statements = await fn(this);
    return this.batch(statements);
  }
}
