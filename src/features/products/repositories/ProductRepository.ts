/**
 * Product Repository
 * 데이터 접근 계층 - DB 쿼리만 담당
 */

import type { Product, ProductFilter, ProductCreateInput, ProductUpdateInput } from '../types';

export class ProductRepository {
  constructor(private db: D1Database) {}
  
  /**
   * 상품 ID로 조회
   */
  async findById(id: number): Promise<Product | null> {
    const result = await this.db.prepare(`
      SELECT * FROM products WHERE id = ? AND is_active = 1
    `).bind(id).first<Product>();
    
    return result || null;
  }
  
  /**
   * 필터 조건으로 상품 목록 조회
   */
  async findAll(filter: ProductFilter, offset: number = 0, limit: number = 20): Promise<Product[]> {
    // 🛡️ 2026-04-22: suspended/inactive seller 상품 숨김 (검색/브라우즈 방어)
    // seller_id NULL (cafe24 등) 은 통과, seller is_active=0 이면 상품 숨김.
    let query = `SELECT * FROM products WHERE is_active = 1
      AND NOT EXISTS (SELECT 1 FROM sellers s WHERE s.id = products.seller_id AND s.is_active = 0)`;
    const params: any[] = [];
    
    if (filter.sellerId) {
      query += ` AND seller_id = ?`;
      params.push(filter.sellerId);
    }
    
    if (filter.brand) {
      query += ` AND brand_name = ?`;
      params.push(filter.brand);
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
      // 🛡️ 2026-04-22: LIKE wildcard escape — %, _ 가 user input 에 있을 때 정확 매칭
      const escaped = String(filter.search).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      query += ` AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')`;
      params.push(`%${escaped}%`, `%${escaped}%`);
    }

    if (filter.productType) {
      query += ` AND product_type = ?`;
      params.push(filter.productType);
    }

    // 정렬: ranking은 "실시간 인기" 가중합 (최근 24h 판매 + 전체 판매 + 평점 + 최신성)
    // COALESCE로 null-safe; id DESC secondary로 pagination tie-break
    let orderBy = 'created_at DESC, id DESC';
    if (filter.sort === 'popular') {
      orderBy = 'COALESCE(sold_count, 0) DESC, COALESCE(view_count, 0) DESC, id DESC';
    } else if (filter.sort === 'price_low') {
      orderBy = 'price ASC, id DESC';
    } else if (filter.sort === 'price_high') {
      orderBy = 'price DESC, id DESC';
    } else if (filter.sort === 'rating') {
      orderBy = 'COALESCE(avg_rating, 0) DESC, COALESCE(review_count, 0) DESC, id DESC';
    } else if (filter.sort === 'ranking') {
      // 실시간 랭킹: 판매량 * 3 + 조회수 * 0.1 + 평점 * 20 + 최신 가중(최근 7일 bonus)
      orderBy = `(
        COALESCE(sold_count, 0) * 3
        + COALESCE(view_count, 0) * 0.1
        + COALESCE(avg_rating, 0) * 20
        + CASE WHEN datetime(created_at) > datetime('now', '-7 days') THEN 50 ELSE 0 END
      ) DESC, id DESC`;
    }

    query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      const result = await this.db.prepare(query).bind(...params).all<Product>();
      return result.results || [];
    } catch (err) {
      // 누락된 컬럼(view_count, avg_rating, review_count, sold_count) 등으로 ranking/popular/rating 정렬 실패 시
      // → 안전한 기본 정렬(created_at DESC)로 자동 폴백. 사용자에게는 500 대신 결과를 반환.
      const errMsg = (err as Error).message || '';
      if (/no such column/i.test(errMsg)) {
        const fallbackQuery = query.replace(/ORDER BY[\s\S]*?LIMIT/, 'ORDER BY created_at DESC, id DESC LIMIT');
        const fallback = await this.db.prepare(fallbackQuery).bind(...params).all<Product>();
        return fallback.results || [];
      }
      throw err;
    }
  }
  
  /**
   * 전체 개수 조회 (페이지네이션용)
   */
  async count(filter: ProductFilter): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM products WHERE is_active = 1
      AND NOT EXISTS (SELECT 1 FROM sellers s WHERE s.id = products.seller_id AND s.is_active = 0)`;
    const params: any[] = [];
    
    if (filter.sellerId) {
      query += ` AND seller_id = ?`;
      params.push(filter.sellerId);
    }
    
    if (filter.brand) {
      query += ` AND brand_name = ?`;
      params.push(filter.brand);
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
      // 🛡️ 2026-04-22: LIKE wildcard escape — %, _ 가 user input 에 있을 때 정확 매칭
      const escaped = String(filter.search).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      query += ` AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')`;
      params.push(`%${escaped}%`, `%${escaped}%`);
    }

    if (filter.productType) {
      query += ` AND product_type = ?`;
      params.push(filter.productType);
    }

    const result = await this.db.prepare(query).bind(...params).first<{ count: number }>();
    return result?.count || 0;
  }
  
  /**
   * 상품 생성
   */
  async create(data: ProductCreateInput): Promise<Product> {
    const imagesJson = data.images ? JSON.stringify(data.images) : null;
    
    const result = await this.db.prepare(`
      INSERT INTO products (
        seller_id, name, description, price, stock,
        category, images, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).bind(
      data.seller_id,
      data.name,
      data.description || null,
      data.price,
      data.stock_quantity ?? data.stock,
      data.category || null,
      imagesJson
    ).run();
    
    const productId = result.meta.last_row_id as number;
    const product = await this.findById(productId);
    
    if (!product) {
      throw new Error('Failed to create product');
    }
    
    return product;
  }
  
  /**
   * 상품 업데이트
   */
  async update(id: number, data: ProductUpdateInput): Promise<Product> {
    const updates: string[] = [];
    const params: any[] = [];
    
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
    
    if (data.stock_quantity !== undefined || data.stock !== undefined) {
      updates.push('stock = ?');
      params.push(data.stock_quantity ?? data.stock);
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
  async delete(id: number): Promise<void> {
    await this.db.prepare(`
      UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?
    `).bind(id).run();
  }
  
  /**
   * Full-Text Search (FTS5) - 고성능 검색
   */
  async searchByText(
    query: string,
    filter: Omit<ProductFilter, 'search'>,
    offset: number = 0,
    limit: number = 20
  ): Promise<Product[]> {
    // FTS5 쿼리 구성
    let ftsQuery = `
      SELECT p.* 
      FROM products p
      JOIN products_fts fts ON p.id = fts.product_id
      WHERE products_fts MATCH ?
      AND p.is_active = 1
    `;
    
    const params: any[] = [query];
    
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
      const result = await this.db.prepare(ftsQuery).bind(...params).all<Product>();
      return result.results || [];
    } catch (error) {
      // FTS 테이블이 없으면 기존 LIKE 검색으로 폴백
      console.warn('[ProductRepository] FTS search failed, falling back to LIKE search:', error);
      return this.findAll({ ...filter, search: query }, offset, limit);
    }
  }
  
  /**
   * 검색 통계 기록
   */
  async logSearch(userId: number | null, searchQuery: string, resultsCount: number): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT INTO search_logs (user_id, search_query, results_count, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).bind(userId, searchQuery, resultsCount).run();
    } catch (error) {
      console.error('[ProductRepository] Failed to log search:', error);
    }
  }
  
  /**
   * 인기 검색어 조회
   */
  async getPopularSearches(limit: number = 10, days: number = 7): Promise<Array<{ query: string; count: number }>> {
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
      `).bind(days, limit).all<{ query: string; count: number }>();
      
      return result.results || [];
    } catch (error) {
      console.error('[ProductRepository] Failed to get popular searches:', error);
      return [];
    }
  }
}
