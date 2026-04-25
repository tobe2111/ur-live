/**
 * Database Query Helpers
 * 
 * Provides common database operations and query builders
 * Simplifies D1 database interactions with type safety
 * 
 * Created: 2026-03-09
 * Purpose: Backend refactoring - DRY database operations
 */

import { logError } from './logger';

/**
 * Query result type
 */
export interface QueryResult<T = unknown> {
  results: T[];
  success: boolean;
  meta?: {
    duration?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

/**
 * Single row result type
 */
export interface SingleRowResult<T = unknown> {
  result: T | null;
  success: boolean;
}

/**
 * Database helper class
 */
export class DatabaseHelper {
  constructor(private db: D1Database) {}

  /**
   * Execute a SELECT query and return all results
   */
  async query<T = unknown>(
    sql: string,
    ...params: unknown[]
  ): Promise<T[]> {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).all<T>();
      return result.results || [];
    } catch (error) {
      logError('db.query.error', { error: (error as Error)?.message });
      throw new Error(`Database query failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute a SELECT query and return first result
   */
  async queryFirst<T = unknown>(
    sql: string,
    ...params: unknown[]
  ): Promise<T | null> {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).first<T>();
      return result;
    } catch (error) {
      logError('db.queryFirst.error', { error: (error as Error)?.message });
      throw new Error(`Database query failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute a SELECT query and return one result (throws if not found)
   */
  async queryOne<T = unknown>(
    sql: string,
    ...params: unknown[]
  ): Promise<T> {
    const result = await this.queryFirst<T>(sql, ...params);
    
    if (!result) {
      throw new Error('Record not found');
    }
    
    return result;
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE query
   */
  async execute(
    sql: string,
    ...params: unknown[]
  ): Promise<D1Result> {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).run();
      return result;
    } catch (error) {
      logError('db.execute.error', { error: (error as Error)?.message });
      throw new Error(`Database execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute multiple queries in a batch
   */
  async batch(
    queries: Array<{ sql: string; params?: unknown[] }>
  ): Promise<D1Result[]> {
    try {
      const statements = queries.map(q => {
        const stmt = this.db.prepare(q.sql);
        return q.params ? stmt.bind(...q.params) : stmt;
      });
      
      const results = await this.db.batch(statements);
      return results;
    } catch (error) {
      logError('db.batch.error', { error: (error as Error)?.message });
      throw new Error(`Database batch failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a record exists
   */
  async exists(
    table: string,
    where: Record<string, unknown>
  ): Promise<boolean> {
    const conditions = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(where);
    
    const sql = `SELECT 1 FROM ${table} WHERE ${conditions} LIMIT 1`;
    const result = await this.queryFirst(sql, ...values);
    
    return result !== null;
  }

  /**
   * Count records
   */
  async count(
    table: string,
    where?: Record<string, unknown>
  ): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const values: unknown[] = [];
    
    if (where && Object.keys(where).length > 0) {
      const conditions = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
      values.push(...Object.values(where));
      sql += ` WHERE ${conditions}`;
    }
    
    const result = await this.queryFirst<{ count: number }>(sql, ...values);
    return result?.count || 0;
  }

  /**
   * Find one record by ID
   */
  async findById<T = unknown>(
    table: string,
    id: number | string,
    idColumn: string = 'id'
  ): Promise<T | null> {
    const sql = `SELECT * FROM ${table} WHERE ${idColumn} = ? LIMIT 1`;
    return this.queryFirst<T>(sql, id);
  }

  /**
   * Find one record by conditions
   */
  async findOne<T = unknown>(
    table: string,
    where: Record<string, unknown>
  ): Promise<T | null> {
    const conditions = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(where);
    
    const sql = `SELECT * FROM ${table} WHERE ${conditions} LIMIT 1`;
    return this.queryFirst<T>(sql, ...values);
  }

  /**
   * Find all records with optional conditions
   */
  async findAll<T = unknown>(
    table: string,
    where?: Record<string, unknown>,
    options?: {
      orderBy?: string;
      order?: 'ASC' | 'DESC';
      limit?: number;
      offset?: number;
    }
  ): Promise<T[]> {
    let sql = `SELECT * FROM ${table}`;
    const values: unknown[] = [];
    
    if (where && Object.keys(where).length > 0) {
      const conditions = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
      values.push(...Object.values(where));
      sql += ` WHERE ${conditions}`;
    }
    
    if (options?.orderBy) {
      // 🛡️ 2026-04-22: SQL injection 방어 — orderBy 는 column 이름/콤마/공백/방향만 허용.
      // 호출측이 실수로 user input 을 orderBy 에 넘기면 `'1; DROP TABLE'` 같은 문자열 차단.
      const safeOrderBy = String(options.orderBy);
      if (!/^[a-zA-Z0-9_,\s]+(\s+(ASC|DESC))?(\s*,\s*[a-zA-Z0-9_]+(\s+(ASC|DESC))?)*$/i.test(safeOrderBy)) {
        throw new Error('Invalid orderBy clause');
      }
      const dir = options.order === 'DESC' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${safeOrderBy} ${dir}`;
    }

    if (options?.limit) {
      // limit/offset 도 정수 강제 (문자열 주입 차단)
      const safeLimit = Math.max(1, Math.min(10000, Math.floor(Number(options.limit) || 0)));
      sql += ` LIMIT ${safeLimit}`;

      if (options?.offset) {
        const safeOffset = Math.max(0, Math.floor(Number(options.offset) || 0));
        sql += ` OFFSET ${safeOffset}`;
      }
    }

    return this.query<T>(sql, ...values);
  }

  /**
   * Insert a record
   */
  async insert(
    table: string,
    data: Record<string, unknown>
  ): Promise<D1Result> {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);
    
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    return this.execute(sql, ...values);
  }

  /**
   * Update a record
   */
  async update(
    table: string,
    data: Record<string, unknown>,
    where: Record<string, unknown>
  ): Promise<D1Result> {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const values = [...Object.values(data), ...Object.values(where)];
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    return this.execute(sql, ...values);
  }

  /**
   * Delete a record
   */
  async delete(
    table: string,
    where: Record<string, unknown>
  ): Promise<D1Result> {
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(where);
    
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    return this.execute(sql, ...values);
  }

  /**
   * Paginated query
   */
  async paginate<T = unknown>(
    table: string,
    page: number = 1,
    pageSize: number = 10,
    where?: Record<string, unknown>,
    orderBy?: string,
    order: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{
    data: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    // Get total count
    const total = await this.count(table, where);
    
    // Get paginated data
    const offset = (page - 1) * pageSize;
    const data = await this.findAll<T>(table, where, {
      orderBy,
      order,
      limit: pageSize,
      offset,
    });
    
    return {
      data,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Transaction helper - execute multiple operations atomically
   * Note: D1 doesn't support true transactions yet, so this uses batch
   */
  async transaction<T>(
    operations: (db: DatabaseHelper) => Promise<T>
  ): Promise<T> {
    try {
      return await operations(this);
    } catch (error) {
      logError('db.transaction.error', { error: (error as Error)?.message });
      throw error;
    }
  }

  /**
   * Soft delete - marks record as deleted instead of removing
   */
  async softDelete(
    table: string,
    where: Record<string, unknown>,
    deletedAtColumn: string = 'deleted_at'
  ): Promise<D1Result> {
    return this.update(table, {
      [deletedAtColumn]: new Date().toISOString(),
    }, where);
  }

  /**
   * Upsert - insert or update if exists
   * Note: D1 supports INSERT OR REPLACE syntax
   */
  async upsert(
    table: string,
    data: Record<string, unknown>,
    conflictColumns: string[]
  ): Promise<D1Result> {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);
    
    const sql = `
      INSERT INTO ${table} (${columns.join(', ')}) 
      VALUES (${placeholders})
      ON CONFLICT(${conflictColumns.join(', ')}) 
      DO UPDATE SET ${columns.map(col => `${col} = excluded.${col}`).join(', ')}
    `;
    
    return this.execute(sql, ...values);
  }
}

/**
 * Create a database helper instance
 */
export function createDbHelper(db: D1Database): DatabaseHelper {
  return new DatabaseHelper(db);
}

/**
 * Query builder for complex queries
 */
export class QueryBuilder {
  private selectClause: string = '*';
  private fromClause: string = '';
  private whereConditions: string[] = [];
  private whereParams: unknown[] = [];
  private orderByClause: string = '';
  private limitValue?: number;
  private offsetValue?: number;
  private joinClauses: string[] = [];

  select(columns: string | string[]): this {
    this.selectClause = Array.isArray(columns) ? columns.join(', ') : columns;
    return this;
  }

  from(table: string): this {
    this.fromClause = table;
    return this;
  }

  where(condition: string, ...params: unknown[]): this {
    this.whereConditions.push(condition);
    this.whereParams.push(...params);
    return this;
  }

  join(table: string, on: string): this {
    this.joinClauses.push(`JOIN ${table} ON ${on}`);
    return this;
  }

  leftJoin(table: string, on: string): this {
    this.joinClauses.push(`LEFT JOIN ${table} ON ${on}`);
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByClause = `ORDER BY ${column} ${direction}`;
    return this;
  }

  limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  offset(offset: number): this {
    this.offsetValue = offset;
    return this;
  }

  build(): { sql: string; params: unknown[] } {
    let sql = `SELECT ${this.selectClause} FROM ${this.fromClause}`;
    
    if (this.joinClauses.length > 0) {
      sql += ' ' + this.joinClauses.join(' ');
    }
    
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ' + this.whereConditions.join(' AND ');
    }
    
    if (this.orderByClause) {
      sql += ' ' + this.orderByClause;
    }
    
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }
    
    return { sql, params: this.whereParams };
  }

  async execute<T>(db: D1Database): Promise<T[]> {
    const { sql, params } = this.build();
    const helper = new DatabaseHelper(db);
    return helper.query<T>(sql, ...params);
  }
}

// ─── 호환성 헬퍼 ──────────────────────────────────────────────────────────────
/**
 * executeQuery - feature 모듈 호환 함수
 * DatabaseHelper.query()의 간편 래퍼.
 * SELECT → results 배열 반환
 * INSERT/UPDATE/DELETE → D1Result 반환
 */
export async function executeQuery<T = unknown>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const helper = new DatabaseHelper(db);
  return helper.query<T>(sql, ...params);
}

/**
 * executeRun - INSERT/UPDATE/DELETE 실행용 (D1Result 반환)
 */
export async function executeRun(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<D1Result> {
  const helper = new DatabaseHelper(db);
  return helper.execute(sql, ...params);
}

/**
 * queryFirst - 단일 행 조회
 */
export async function queryFirst<T = unknown>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const helper = new DatabaseHelper(db);
  return helper.queryFirst<T>(sql, ...params);
}
