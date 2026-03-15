// ============================================================
// Seller Repository
// ============================================================
import { QueryBuilder } from './query-builder';
export class SellerRepository {
    qb;
    constructor(db) {
        this.qb = new QueryBuilder(db);
    }
    async findById(id) {
        return this.qb.queryOne(`SELECT id, user_id, name, slug, description, logo_url, email, phone,
              base_shipping_fee, free_shipping_threshold,
              country, currency, timezone, status, is_verified,
              created_at, updated_at
       FROM sellers WHERE id = ? AND status = 'ACTIVE'`, [id]);
    }
    async findBySlug(slug) {
        return this.qb.queryOne(`SELECT id, user_id, name, slug, description, logo_url, email, phone,
              base_shipping_fee, free_shipping_threshold,
              country, currency, timezone, status, is_verified,
              created_at, updated_at
       FROM sellers WHERE slug = ? AND status = 'ACTIVE'`, [slug]);
    }
    async findByIds(ids) {
        if (ids.length === 0)
            return [];
        const placeholders = ids.map(() => '?').join(', ');
        return this.qb.queryMany(`SELECT id, name, slug, email, base_shipping_fee, free_shipping_threshold,
              country, currency, status, is_verified
       FROM sellers 
       WHERE id IN (${placeholders}) AND status = 'ACTIVE'`, ids);
    }
    async findMany(params) {
        const { country, page = 1, limit = 20 } = params;
        const offset = (page - 1) * limit;
        const conditions = ["status = 'ACTIVE'", "is_verified = 1"];
        const queryParams = [];
        if (country) {
            conditions.push('country = ?');
            queryParams.push(country);
        }
        const where = `WHERE ${conditions.join(' AND ')}`;
        const countRow = await this.qb.queryOne(`SELECT COUNT(*) as count FROM sellers ${where}`, queryParams);
        const sellers = await this.qb.queryMany(`SELECT id, name, slug, description, logo_url, email,
              base_shipping_fee, free_shipping_threshold,
              country, currency, status, is_verified, created_at
       FROM sellers ${where}
       ORDER BY name LIMIT ? OFFSET ?`, [...queryParams, limit, offset]);
        return { sellers, total: countRow?.count ?? 0 };
    }
}
