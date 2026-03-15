// ============================================================
// Product Repository
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';
import { QueryBuilder } from './query-builder';
import type { Product, ProductStatus } from '../../shared/types';
import { safeJsonParse } from '../../shared/utils';

export class ProductRepository {
  private qb: QueryBuilder;

  constructor(db: D1Database) {
    this.qb = new QueryBuilder(db);
  }

  async findById(id: string): Promise<Product | null> {
    const row = await this.qb.queryOne<Record<string, unknown>>(
      `SELECT p.*, s.name as seller_name, s.slug as seller_slug
       FROM products p
       LEFT JOIN sellers s ON p.seller_id = s.id
       WHERE p.id = ? AND p.status != 'DELETED'`,
      [id]
    );
    return row ? this.mapProduct(row) : null;
  }

  async findMany(params: {
    seller_id?: string;
    category_id?: string;
    status?: ProductStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ products: Product[]; total: number }> {
    const { seller_id, category_id, status, search, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    const conditions: string[] = ["p.status != 'DELETED'"];
    const queryParams: unknown[] = [];

    if (seller_id) {
      conditions.push('p.seller_id = ?');
      queryParams.push(seller_id);
    }
    if (category_id) {
      conditions.push('p.category_id = ?');
      queryParams.push(category_id);
    }
    if (status) {
      conditions.push('p.status = ?');
      queryParams.push(status);
    }
    if (search) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countRow = await this.qb.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM products p ${where}`,
      queryParams
    );
    const total = countRow?.count ?? 0;

    const rows = await this.qb.queryMany<Record<string, unknown>>(
      `SELECT p.*, s.name as seller_name, s.slug as seller_slug
       FROM products p
       LEFT JOIN sellers s ON p.seller_id = s.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    return { products: rows.map(r => this.mapProduct(r)), total };
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await this.qb.queryMany<Record<string, unknown>>(
      `SELECT p.*, s.name as seller_name, s.slug as seller_slug,
              s.base_shipping_fee, s.free_shipping_threshold
       FROM products p
       LEFT JOIN sellers s ON p.seller_id = s.id
       WHERE p.id IN (${placeholders}) AND p.status = 'ACTIVE'`,
      ids
    );
    return rows.map(r => this.mapProduct(r));
  }

  private mapProduct(row: Record<string, unknown>): Product {
    return {
      id: String(row['id'] ?? ''),
      seller_id: String(row['seller_id'] ?? ''),
      category_id: row['category_id'] ? String(row['category_id']) : undefined,
      name: String(row['name'] ?? ''),
      slug: String(row['slug'] ?? ''),
      description: row['description'] ? String(row['description']) : undefined,
      price: Number(row['price'] ?? 0),
      compare_at_price: row['compare_at_price'] ? Number(row['compare_at_price']) : undefined,
      currency: String(row['currency'] ?? 'KRW'),
      stock_quantity: Number(row['stock_quantity'] ?? 0),
      sku: row['sku'] ? String(row['sku']) : undefined,
      thumbnail_url: row['thumbnail_url'] ? String(row['thumbnail_url']) : undefined,
      images: safeJsonParse(String(row['images'] ?? '[]'), []),
      tags: safeJsonParse(String(row['tags'] ?? '[]'), []),
      status: String(row['status'] ?? 'ACTIVE') as ProductStatus,
      is_digital: Boolean(row['is_digital']),
      view_count: Number(row['view_count'] ?? 0),
      sold_count: Number(row['sold_count'] ?? 0),
      published_at: row['published_at'] ? String(row['published_at']) : undefined,
      created_at: String(row['created_at'] ?? ''),
      updated_at: String(row['updated_at'] ?? ''),
      seller_name: row['seller_name'] ? String(row['seller_name']) : undefined,
      seller_slug: row['seller_slug'] ? String(row['seller_slug']) : undefined,
    };
  }
}
