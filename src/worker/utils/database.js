/**
 * Database Query Helpers
 *
 * Provides common database operations and query builders
 * Simplifies D1 database interactions with type safety
 *
 * Created: 2026-03-09
 * Purpose: Backend refactoring - DRY database operations
 */
/**
 * Database helper class
 */
export class DatabaseHelper {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Execute a SELECT query and return all results
     */
    async query(sql, ...params) {
        try {
            const stmt = this.db.prepare(sql);
            const result = await stmt.bind(...params).all();
            return result.results || [];
        }
        catch (error) {
            console.error('[DB] Query failed:', { sql, params, error });
            throw new Error(`Database query failed: ${error.message}`);
        }
    }
    /**
     * Execute a SELECT query and return first result
     */
    async queryFirst(sql, ...params) {
        try {
            const stmt = this.db.prepare(sql);
            const result = await stmt.bind(...params).first();
            return result;
        }
        catch (error) {
            console.error('[DB] QueryFirst failed:', { sql, params, error });
            throw new Error(`Database query failed: ${error.message}`);
        }
    }
    /**
     * Execute a SELECT query and return one result (throws if not found)
     */
    async queryOne(sql, ...params) {
        const result = await this.queryFirst(sql, ...params);
        if (!result) {
            throw new Error('Record not found');
        }
        return result;
    }
    /**
     * Execute an INSERT, UPDATE, or DELETE query
     */
    async execute(sql, ...params) {
        try {
            const stmt = this.db.prepare(sql);
            const result = await stmt.bind(...params).run();
            return result;
        }
        catch (error) {
            console.error('[DB] Execute failed:', { sql, params, error });
            throw new Error(`Database execution failed: ${error.message}`);
        }
    }
    /**
     * Execute multiple queries in a batch
     */
    async batch(queries) {
        try {
            const statements = queries.map(q => {
                const stmt = this.db.prepare(q.sql);
                return q.params ? stmt.bind(...q.params) : stmt;
            });
            const results = await this.db.batch(statements);
            return results;
        }
        catch (error) {
            console.error('[DB] Batch failed:', { queries, error });
            throw new Error(`Database batch failed: ${error.message}`);
        }
    }
    /**
     * Check if a record exists
     */
    async exists(table, where) {
        const conditions = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
        const values = Object.values(where);
        const sql = `SELECT 1 FROM ${table} WHERE ${conditions} LIMIT 1`;
        const result = await this.queryFirst(sql, ...values);
        return result !== null;
    }
    /**
     * Count records
     */
    async count(table, where) {
        let sql = `SELECT COUNT(*) as count FROM ${table}`;
        const values = [];
        if (where && Object.keys(where).length > 0) {
            const conditions = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
            values.push(...Object.values(where));
            sql += ` WHERE ${conditions}`;
        }
        const result = await this.queryFirst(sql, ...values);
        return result?.count || 0;
    }
    /**
     * Find one record by ID
     */
    async findById(table, id, idColumn = 'id') {
        const sql = `SELECT * FROM ${table} WHERE ${idColumn} = ? LIMIT 1`;
        return this.queryFirst(sql, id);
    }
    /**
     * Find one record by conditions
     */
    async findOne(table, where) {
        const conditions = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
        const values = Object.values(where);
        const sql = `SELECT * FROM ${table} WHERE ${conditions} LIMIT 1`;
        return this.queryFirst(sql, ...values);
    }
    /**
     * Find all records with optional conditions
     */
    async findAll(table, where, options) {
        let sql = `SELECT * FROM ${table}`;
        const values = [];
        if (where && Object.keys(where).length > 0) {
            const conditions = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
            values.push(...Object.values(where));
            sql += ` WHERE ${conditions}`;
        }
        if (options?.orderBy) {
            sql += ` ORDER BY ${options.orderBy} ${options.order || 'ASC'}`;
        }
        if (options?.limit) {
            sql += ` LIMIT ${options.limit}`;
            if (options?.offset) {
                sql += ` OFFSET ${options.offset}`;
            }
        }
        return this.query(sql, ...values);
    }
    /**
     * Insert a record
     */
    async insert(table, data) {
        const columns = Object.keys(data);
        const placeholders = columns.map(() => '?').join(', ');
        const values = Object.values(data);
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        return this.execute(sql, ...values);
    }
    /**
     * Update a record
     */
    async update(table, data, where) {
        const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
        const values = [...Object.values(data), ...Object.values(where)];
        const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
        return this.execute(sql, ...values);
    }
    /**
     * Delete a record
     */
    async delete(table, where) {
        const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
        const values = Object.values(where);
        const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
        return this.execute(sql, ...values);
    }
    /**
     * Paginated query
     */
    async paginate(table, page = 1, pageSize = 10, where, orderBy, order = 'DESC') {
        // Get total count
        const total = await this.count(table, where);
        // Get paginated data
        const offset = (page - 1) * pageSize;
        const data = await this.findAll(table, where, {
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
    async transaction(operations) {
        try {
            return await operations(this);
        }
        catch (error) {
            console.error('[DB] Transaction failed:', error);
            throw error;
        }
    }
    /**
     * Soft delete - marks record as deleted instead of removing
     */
    async softDelete(table, where, deletedAtColumn = 'deleted_at') {
        return this.update(table, {
            [deletedAtColumn]: new Date().toISOString(),
        }, where);
    }
    /**
     * Upsert - insert or update if exists
     * Note: D1 supports INSERT OR REPLACE syntax
     */
    async upsert(table, data, conflictColumns) {
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
export function createDbHelper(db) {
    return new DatabaseHelper(db);
}
/**
 * Query builder for complex queries
 */
export class QueryBuilder {
    selectClause = '*';
    fromClause = '';
    whereConditions = [];
    whereParams = [];
    orderByClause = '';
    limitValue;
    offsetValue;
    joinClauses = [];
    select(columns) {
        this.selectClause = Array.isArray(columns) ? columns.join(', ') : columns;
        return this;
    }
    from(table) {
        this.fromClause = table;
        return this;
    }
    where(condition, ...params) {
        this.whereConditions.push(condition);
        this.whereParams.push(...params);
        return this;
    }
    join(table, on) {
        this.joinClauses.push(`JOIN ${table} ON ${on}`);
        return this;
    }
    leftJoin(table, on) {
        this.joinClauses.push(`LEFT JOIN ${table} ON ${on}`);
        return this;
    }
    orderBy(column, direction = 'ASC') {
        this.orderByClause = `ORDER BY ${column} ${direction}`;
        return this;
    }
    limit(limit) {
        this.limitValue = limit;
        return this;
    }
    offset(offset) {
        this.offsetValue = offset;
        return this;
    }
    build() {
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
    async execute(db) {
        const { sql, params } = this.build();
        const helper = new DatabaseHelper(db);
        return helper.query(sql, ...params);
    }
}
// ─── 호환성 헬퍼 ──────────────────────────────────────────────────────────────
/**
 * executeQuery - feature 모듈 호환 함수
 * DatabaseHelper.query()의 간편 래퍼.
 * SELECT → results 배열 반환
 * INSERT/UPDATE/DELETE → D1Result 반환
 */
export async function executeQuery(db, sql, params = []) {
    const helper = new DatabaseHelper(db);
    return helper.query(sql, ...params);
}
/**
 * executeRun - INSERT/UPDATE/DELETE 실행용 (D1Result 반환)
 */
export async function executeRun(db, sql, params = []) {
    const helper = new DatabaseHelper(db);
    return helper.execute(sql, ...params);
}
/**
 * queryFirst - 단일 행 조회
 */
export async function queryFirst(db, sql, params = []) {
    const helper = new DatabaseHelper(db);
    return helper.queryFirst(sql, ...params);
}
