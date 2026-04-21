// ============================================================
// Seller Repository
// ============================================================
//
// NOTE: Production `sellers` table has only these columns:
//   id, username, password_hash, name, email, phone, business_name,
//   business_number, status, commission_rate, display_name,
//   profile_image, bio
//
// Legacy schema columns (slug, user_id, logo_url, country, currency,
// timezone, is_verified, description) do NOT exist in production.
// This repo maps production columns → Seller type (using username as
// slug, profile_image as logo_url, bio as description, status='approved'
// as is_verified).

import type { D1Database } from '@cloudflare/workers-types';
import { QueryBuilder } from './query-builder';
import type { Seller } from '../../shared/types';

// Raw row shape as returned by production SELECTs
interface SellerRow {
  id: number | string;
  username: string | null;
  name: string | null;
  display_name?: string | null;
  email: string | null;
  phone: string | null;
  profile_image?: string | null;
  bio?: string | null;
  status: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapSeller(row: SellerRow | null): Seller | null {
  if (!row) return null;
  const slug = row.username ?? String(row.id);
  return {
    id: String(row.id),
    user_id: String(row.id),
    name: String(row.display_name ?? row.name ?? row.username ?? ''),
    slug,
    description: row.bio ? String(row.bio) : undefined,
    logo_url: row.profile_image ? String(row.profile_image) : undefined,
    email: String(row.email ?? ''),
    phone: row.phone ? String(row.phone) : undefined,
    base_shipping_fee: 0,
    free_shipping_threshold: undefined,
    status: (row.status === 'approved' ? 'ACTIVE' : 'PENDING') as Seller['status'],
    is_verified: row.status === 'approved',
    country: 'KR',
    currency: 'KRW',
    timezone: 'Asia/Seoul',
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

const BASE_SELECT = `id, username, name, display_name, email, phone,
       profile_image, bio, status, created_at, updated_at`;

export class SellerRepository {
  private qb: QueryBuilder;

  constructor(db: D1Database) {
    this.qb = new QueryBuilder(db);
  }

  async findById(id: string): Promise<Seller | null> {
    const row = await this.qb.queryOne<SellerRow>(
      `SELECT ${BASE_SELECT}
       FROM sellers WHERE id = ? AND status = 'approved'`,
      [id]
    );
    return mapSeller(row);
  }

  async findBySlug(slug: string): Promise<Seller | null> {
    // Production uses `username` as the URL identifier
    const row = await this.qb.queryOne<SellerRow>(
      `SELECT ${BASE_SELECT}
       FROM sellers WHERE username = ? AND status = 'approved'`,
      [slug]
    );
    return mapSeller(row);
  }

  async findByIds(ids: string[]): Promise<Seller[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await this.qb.queryMany<SellerRow>(
      `SELECT ${BASE_SELECT}
       FROM sellers
       WHERE id IN (${placeholders}) AND status = 'approved'`,
      ids
    );
    return rows.map(r => mapSeller(r)!).filter(Boolean);
  }

  async findMany(params: {
    country?: string;
    page?: number;
    limit?: number;
  }): Promise<{ sellers: Seller[]; total: number }> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;
    // Production has no country column — filter by approved status only
    const where = `WHERE status = 'approved'`;

    const countRow = await this.qb.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM sellers ${where}`,
      []
    );

    const rows = await this.qb.queryMany<SellerRow>(
      `SELECT ${BASE_SELECT}
       FROM sellers ${where}
       ORDER BY name LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return {
      sellers: rows.map(r => mapSeller(r)!).filter(Boolean),
      total: countRow?.count ?? 0,
    };
  }
}
