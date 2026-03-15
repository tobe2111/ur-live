/**
 * Product Repository
 * 데이터 접근 계층 - DB 쿼리만 담당
 */
export class ProductRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * 상품 ID로 조회
     */
    async findById(id) {
        const result = await this.db.prepare(`
      SELECT * FROM products WHERE id = ? AND status != 'deleted'
    `).bind(id).first();
        return result || null;
    }
    /**
     * 필터 조건으로 상품 목록 조회
     */
    async findAll(filter, offset = 0, limit = 20) {
        let query = `SELECT * FROM products WHERE status != 'deleted'`;
        const params = [];
        if (filter.sellerId) {
            query += ` AND seller_id = ?`;
            params.push(filter.sellerId);
        }
        if (filter.category) {
            query += ` AND category = ?`;
            params.push(filter.category);
        }
        if (filter.status) {
            query += ` AND status = ?`;
            params.push(filter.status);
        }
        if (filter.minPrice !== undefined) {
            query += ` AND price >= ?`;
            params.push(filter.minPrice);
        }
        if (filter.maxPrice !== undefined) {
            query += ` AND price <= ?`;
            params.push(filter.maxPrice);
        }
        if (filter.search) {
            query += ` AND (name LIKE ? OR description LIKE ?)`;
            params.push(`%${filter.search}%`, `%${filter.search}%`);
        }
        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        const result = await this.db.prepare(query).bind(...params).all();
        return result.results || [];
    }
    /**
     * 전체 개수 조회 (페이지네이션용)
     */
    async count(filter) {
        let query = `SELECT COUNT(*) as count FROM products WHERE status != 'deleted'`;
        const params = [];
        if (filter.sellerId) {
            query += ` AND seller_id = ?`;
            params.push(filter.sellerId);
        }
        if (filter.category) {
            query += ` AND category = ?`;
            params.push(filter.category);
        }
        if (filter.status) {
            query += ` AND status = ?`;
            params.push(filter.status);
        }
        if (filter.search) {
            query += ` AND (name LIKE ? OR description LIKE ?)`;
            params.push(`%${filter.search}%`, `%${filter.search}%`);
        }
        const result = await this.db.prepare(query).bind(...params).first();
        return result?.count || 0;
    }
    /**
     * 상품 생성
     */
    async create(data) {
        const imagesJson = data.images ? JSON.stringify(data.images) : null;
        const result = await this.db.prepare(`
      INSERT INTO products (
        seller_id, name, description, price, stock_quantity, 
        category, images, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
    `).bind(data.seller_id, data.name, data.description || null, data.price, data.stock_quantity, data.category || null, imagesJson).run();
        const productId = result.meta.last_row_id;
        const product = await this.findById(productId);
        if (!product) {
            throw new Error('Failed to create product');
        }
        return product;
    }
    /**
     * 상품 업데이트
     */
    async update(id, data) {
        const updates = [];
        const params = [];
        if (data.name !== undefined) {
            updates.push('name = ?');
            params.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.price !== undefined) {
            updates.push('price = ?');
            params.push(data.price);
        }
        if (data.stock_quantity !== undefined) {
            updates.push('stock_quantity = ?');
            params.push(data.stock_quantity);
        }
        if (data.category !== undefined) {
            updates.push('category = ?');
            params.push(data.category);
        }
        if (data.images !== undefined) {
            updates.push('images = ?');
            params.push(JSON.stringify(data.images));
        }
        if (data.status !== undefined) {
            updates.push('status = ?');
            params.push(data.status);
        }
        if (updates.length === 0) {
            throw new Error('No fields to update');
        }
        updates.push('updated_at = datetime(\'now\')');
        params.push(id);
        await this.db.prepare(`
      UPDATE products SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();
        const product = await this.findById(id);
        if (!product) {
            throw new Error('Product not found after update');
        }
        return product;
    }
    /**
     * 상품 삭제 (소프트 삭제)
     */
    async delete(id) {
        await this.db.prepare(`
      UPDATE products SET status = 'deleted', updated_at = datetime('now') WHERE id = ?
    `).bind(id).run();
    }
    /**
     * Full-Text Search (FTS5) - 고성능 검색
     */
    async searchByText(query, filter, offset = 0, limit = 20) {
        // FTS5 쿼리 구성
        let ftsQuery = `
      SELECT p.* 
      FROM products p
      JOIN products_fts fts ON p.id = fts.product_id
      WHERE products_fts MATCH ?
      AND p.status != 'deleted'
    `;
        const params = [query];
        // 추가 필터 적용
        if (filter.sellerId) {
            ftsQuery += ` AND p.seller_id = ?`;
            params.push(filter.sellerId);
        }
        if (filter.category) {
            ftsQuery += ` AND p.category = ?`;
            params.push(filter.category);
        }
        if (filter.status) {
            ftsQuery += ` AND p.status = ?`;
            params.push(filter.status);
        }
        if (filter.minPrice !== undefined) {
            ftsQuery += ` AND p.price >= ?`;
            params.push(filter.minPrice);
        }
        if (filter.maxPrice !== undefined) {
            ftsQuery += ` AND p.price <= ?`;
            params.push(filter.maxPrice);
        }
        // 관련도 순으로 정렬 (BM25 알고리즘)
        ftsQuery += ` ORDER BY bm25(products_fts) LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        try {
            const result = await this.db.prepare(ftsQuery).bind(...params).all();
            return result.results || [];
        }
        catch (error) {
            // FTS 테이블이 없으면 기존 LIKE 검색으로 폴백
            console.warn('[ProductRepository] FTS search failed, falling back to LIKE search:', error);
            return this.findAll({ ...filter, search: query }, offset, limit);
        }
    }
    /**
     * 검색 통계 기록
     */
    async logSearch(userId, searchQuery, resultsCount) {
        try {
            await this.db.prepare(`
        INSERT INTO search_logs (user_id, search_query, results_count, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).bind(userId, searchQuery, resultsCount).run();
        }
        catch (error) {
            console.error('[ProductRepository] Failed to log search:', error);
        }
    }
    /**
     * 인기 검색어 조회
     */
    async getPopularSearches(limit = 10, days = 7) {
        try {
            const result = await this.db.prepare(`
        SELECT 
          search_query as query,
          COUNT(*) as count
        FROM search_logs
        WHERE created_at > datetime('now', '-' || ? || ' days')
        GROUP BY search_query
        ORDER BY count DESC
        LIMIT ?
      `).bind(days, limit).all();
            return result.results || [];
        }
        catch (error) {
            console.error('[ProductRepository] Failed to get popular searches:', error);
            return [];
        }
    }
}
