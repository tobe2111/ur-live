// ============================================================
// Seller Repository
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';
import { QueryBuilder } from './query-builder';
import type { Seller } from '../../shared/types';

export class SellerRepository {
  private qb: QueryBuilder;

  constructor(db: D1Database) {
    this.qb = new QueryBuilder(db);
  }

  async findById(id: string): Promise<Seller | null> {
    return this.qb.queryOne<Seller>(
      `SELECT id, user_id, name, slug, description, logo_url, email, phone,
              base_shipping_fee, free_shipping_threshold,
              country, currency, timezone, status, is_verified,
              created_at, updated_at
       FROM sellers WHERE id = ? AND status = 'ACTIVE'`,
      [id]
    );
  }

  async findBySlug(slug: string): Promise<Seller | null> {
    return this.qb.queryOne<Seller>(
      `SELECT id, user_id, name, slug, description, logo_url, email, phone,
              base_shipping_fee, free_shipping_threshold,
              country, currency, timezone, status, is_verified,
              created_at, updated_at
       FROM sellers WHERE slug = ? AND status = 'ACTIVE'`,
      [slug]
    );
  }

  async findByIds(ids: string[]): Promise<Seller[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    return this.qb.queryMany<Seller>(
      `SELECT id, name, slug, email, base_shipping_fee, free_shipping_threshold,
              country, currency, status, is_verified
       FROM sellers 
       WHERE id IN (${placeholders}) AND status = 'ACTIVE'`,
      ids
    );
  }

  async findMany(params: {
    country?: string;
    page?: number;
    limit?: number;
  }): Promise<{ sellers: Seller[]; total: number }> {
    const { country, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;
    const conditions: string[] = ["status = 'ACTIVE'", "is_verified = 1"];
    const queryParams: unknown[] = [];

    if (country) {
      conditions.push('country = ?');
      queryParams.push(country);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const countRow = await this.qb.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM sellers ${where}`,
      queryParams
    );

    const sellers = await this.qb.queryMany<Seller>(
      `SELECT id, name, slug, description, logo_url, email,
              base_shipping_fee, free_shipping_threshold,
              country, currency, status, is_verified, created_at
       FROM sellers ${where}
       ORDER BY name LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    return { sellers, total: countRow?.count ?? 0 };
  }
}
