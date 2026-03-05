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
      SELECT * FROM products WHERE id = ? AND status != 'deleted'
    `).bind(id).first<Product>();
    
    return result || null;
  }
  
  /**
   * 필터 조건으로 상품 목록 조회
   */
  async findAll(filter: ProductFilter, offset: number = 0, limit: number = 20): Promise<Product[]> {
    let query = `SELECT * FROM products WHERE status != 'deleted'`;
    const params: any[] = [];
    
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
    
    const result = await this.db.prepare(query).bind(...params).all<Product>();
    return result.results || [];
  }
  
  /**
   * 전체 개수 조회 (페이지네이션용)
   */
  async count(filter: ProductFilter): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM products WHERE status != 'deleted'`;
    const params: any[] = [];
    
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
        seller_id, name, description, price, stock_quantity, 
        category, images, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
    `).bind(
      data.seller_id,
      data.name,
      data.description || null,
      data.price,
      data.stock_quantity,
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
  async delete(id: number): Promise<void> {
    await this.db.prepare(`
      UPDATE products SET status = 'deleted', updated_at = datetime('now') WHERE id = ?
    `).bind(id).run();
  }
}
