// ============================================================
// Seller Routes
// GET /api/sellers
// GET /api/sellers/:id
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { QueryBuilder } from '../repositories/query-builder';
import type { AuthVariables } from '../middleware/auth.middleware';
import type { Seller } from '../../shared/types';

const sellersRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/sellers
sellersRouter.get('/', async (c) => {
  try {
    const qb = new QueryBuilder(c.env.DB);
    const { page = '1', limit = '20', country } = c.req.query();
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ["status = 'ACTIVE'", "is_verified = 1"];
    const params: unknown[] = [];
    if (country) {
      conditions.push('country = ?');
      params.push(country);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const countRow = await qb.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM sellers ${where}`,
      params
    );

    const rows = await qb.queryMany<Record<string, unknown>>(
      `SELECT id, name, slug, description, logo_url, email,
              base_shipping_fee, free_shipping_threshold,
              country, currency, status, is_verified, created_at
       FROM sellers ${where}
       ORDER BY name
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    return c.json({
      success: true,
      data: {
        items: rows,
        total: countRow?.count ?? 0,
        page: pageNum,
        limit: limitNum,
        has_next: pageNum * limitNum < (countRow?.count ?? 0),
      },
    });
  } catch (err) {
    console.error('[SELLERS] List error:', err);
    return c.json({ success: false, error: 'Failed to fetch sellers' }, 500);
  }
});

// GET /api/sellers/:id
sellersRouter.get('/:id', async (c) => {
  try {
    const qb = new QueryBuilder(c.env.DB);
    const sellerId = c.req.param('id');

    const seller = await qb.queryOne<Seller>(
      `SELECT id, name, slug, description, logo_url, email, phone,
              base_shipping_fee, free_shipping_threshold,
              country, currency, timezone, status, is_verified,
              created_at, updated_at
       FROM sellers WHERE id = ? AND status = 'ACTIVE'`,
      [sellerId]
    );

    if (!seller) {
      return c.json({ success: false, error: 'Seller not found' }, 404);
    }

    return c.json({ success: true, data: seller });
  } catch (err) {
    console.error('[SELLERS] Detail error:', err);
    return c.json({ success: false, error: 'Failed to fetch seller' }, 500);
  }
});

export { sellersRouter };
