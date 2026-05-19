/**
 * Restaurant Settlement API
 *
 * Tracks payouts to restaurants when meal vouchers are used.
 * Admin endpoints: calculate, list, complete, fail, stats
 * Seller endpoint: view own settlements
 *
 * Admin routes are mounted under adminApp (already has requireAdmin middleware).
 * Seller route is mounted on the main app with requireAuth.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { executeQuery, executeRun, queryFirst } from '@/worker/utils/database';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
// ── Table setup ────────────────────────────────────────────────────────────

async function ensureSettlementTables(DB: D1Database) {
  if (_done_ensureSettlementTables) return
  _done_ensureSettlementTables = true
  await executeRun(DB, `
    CREATE TABLE IF NOT EXISTS restaurant_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      restaurant_name TEXT NOT NULL,
      product_id INTEGER,
      period_start TEXT,
      period_end TEXT,
      total_vouchers_used INTEGER DEFAULT 0,
      total_revenue INTEGER DEFAULT 0,
      commission_rate REAL DEFAULT 15.0,
      commission_amount INTEGER DEFAULT 0,
      settlement_amount INTEGER DEFAULT 0,
      bank_account TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
      settled_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add settlement_id column to vouchers if missing
  try {
    await executeRun(DB, `ALTER TABLE vouchers ADD COLUMN settlement_id INTEGER`);
  } catch {
    // column already exists — safe to ignore
  }
}

// ── Admin routes (mounted under adminApp, which already enforces requireAdmin) ──

const restaurantSettlementRoutes = new Hono<{ Bindings: Env }>();

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// ── POST /calculate — Batch-calculate settlements for all unsettled used vouchers ──

restaurantSettlementRoutes.post('/calculate', async (c) => {
  const DB = c.env.DB;
  await ensureSettlementTables(DB);

  try {
    let bodyRaw: Record<string, unknown> = {};
    try {
      bodyRaw = await c.req.json();
    } catch {
      // no body — use defaults
    }

    const commissionRate = typeof bodyRaw.commission_rate === 'number' ? bodyRaw.commission_rate : 15.0;
    const periodStart = typeof bodyRaw.period_start === 'string' ? bodyRaw.period_start : null;
    const periodEnd = typeof bodyRaw.period_end === 'string' ? bodyRaw.period_end : null;

    // Find all used vouchers that have NOT been assigned to a settlement yet.
    // Group by seller_id + product_id.
    const groups = await executeQuery<{
      seller_id: number;
      product_id: number;
      restaurant_name: string;
      voucher_count: number;
      total_revenue: number;
    }>(DB, `
      SELECT
        p.seller_id,
        v.product_id,
        COALESCE(p.restaurant_name, p.name) AS restaurant_name,
        COUNT(v.id) AS voucher_count,
        SUM(p.price) AS total_revenue
      FROM vouchers v
      JOIN products p ON v.product_id = p.id
      WHERE v.status = 'used'
        AND v.settlement_id IS NULL
      GROUP BY p.seller_id, v.product_id
    `);

    if (groups.length === 0) {
      return c.json({ success: true, data: { created: 0 }, message: 'No unsettled vouchers found' });
    }

    let created = 0;

    for (const g of groups) {
      const commissionAmount = Math.round(g.total_revenue * commissionRate / 100);
      const settlementAmount = g.total_revenue - commissionAmount;

      // Look up bank_account from sellers table (best effort)
      const seller = await queryFirst<{ bank_account?: string }>(
        DB,
        'SELECT bank_account FROM sellers WHERE id = ?',
        [g.seller_id],
      );

      // Create settlement record
      const result = await executeRun(DB, `
        INSERT INTO restaurant_settlements
          (seller_id, restaurant_name, product_id, period_start, period_end,
           total_vouchers_used, total_revenue, commission_rate, commission_amount,
           settlement_amount, bank_account, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `, [
        g.seller_id,
        g.restaurant_name,
        g.product_id,
        periodStart,
        periodEnd,
        g.voucher_count,
        g.total_revenue,
        commissionRate,
        commissionAmount,
        settlementAmount,
        seller?.bank_account ?? null,
      ]);

      const settlementId = result.meta?.last_row_id;

      // Mark processed vouchers with the settlement_id
      if (settlementId) {
        await executeRun(DB, `
          UPDATE vouchers
          SET settlement_id = ?
          WHERE status = 'used'
            AND settlement_id IS NULL
            AND product_id = ?
        `, [settlementId, g.product_id]);
      }

      created++;
    }

    return c.json({
      success: true,
      data: { created },
      message: `${created} settlement(s) created`,
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /list — Paginated list of restaurant settlements ──

restaurantSettlementRoutes.get('/list', async (c) => {
  const DB = c.env.DB;
  await ensureSettlementTables(DB);

  try {
    const status = c.req.query('status') || null;
    const sellerId = c.req.query('seller_id') || null;
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      conditions.push('rs.status = ?');
      params.push(status);
    }
    if (sellerId) {
      conditions.push('rs.seller_id = ?');
      params.push(parseInt(sellerId, 10));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count
    const countRow = await queryFirst<{ cnt: number }>(
      DB,
      `SELECT COUNT(*) AS cnt FROM restaurant_settlements rs ${whereClause}`,
      params,
    );
    const total = countRow?.cnt ?? 0;

    // Data
    const rows = await executeQuery(DB, `
      SELECT rs.*, s.name AS seller_name
      FROM restaurant_settlements rs
      LEFT JOIN sellers s ON rs.seller_id = s.id
      ${whereClause}
      ORDER BY rs.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return c.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── PATCH /:id/complete — Mark settlement as completed (paid) ──

restaurantSettlementRoutes.patch('/:id/complete', async (c) => {
  const DB = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  try {
    const existing = await queryFirst<{ id: number; status: string }>(
      DB,
      'SELECT id, status FROM restaurant_settlements WHERE id = ?',
      [id],
    );

    if (!existing) {
      return c.json({ success: false, error: 'Settlement not found' }, 404);
    }
    if (existing.status === 'completed') {
      return c.json({ success: false, error: 'Settlement already completed' }, 400);
    }

    await executeRun(DB, `
      UPDATE restaurant_settlements
      SET status = 'completed', settled_at = datetime('now')
      WHERE id = ?
    `, [id]);

    return c.json({ success: true, data: { id, status: 'completed' } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── PATCH /:id/fail — Mark settlement as failed ──

restaurantSettlementRoutes.patch('/:id/fail', async (c) => {
  const DB = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  try {
    const existing = await queryFirst<{ id: number; status: string }>(
      DB,
      'SELECT id, status FROM restaurant_settlements WHERE id = ?',
      [id],
    );

    if (!existing) {
      return c.json({ success: false, error: 'Settlement not found' }, 404);
    }
    if (existing.status === 'completed') {
      return c.json({ success: false, error: 'Cannot fail a completed settlement' }, 400);
    }

    await executeRun(DB, `
      UPDATE restaurant_settlements
      SET status = 'failed'
      WHERE id = ?
    `, [id]);

    return c.json({ success: true, data: { id, status: 'failed' } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /stats — Settlement overview stats ──

restaurantSettlementRoutes.get('/stats', async (c) => {
  const DB = c.env.DB;
  await ensureSettlementTables(DB);

  try {
    const stats = await queryFirst<{
      total_pending: number;
      total_pending_amount: number;
      total_completed: number;
      total_completed_amount: number;
      total_failed: number;
      total_all: number;
      total_amount: number;
    }>(DB, `
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS total_pending,
        SUM(CASE WHEN status = 'pending' THEN settlement_amount ELSE 0 END) AS total_pending_amount,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS total_completed,
        SUM(CASE WHEN status = 'completed' THEN settlement_amount ELSE 0 END) AS total_completed_amount,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS total_failed,
        COUNT(*) AS total_all,
        SUM(settlement_amount) AS total_amount
      FROM restaurant_settlements
    `);

    return c.json({
      success: true,
      data: {
        total_pending: stats?.total_pending ?? 0,
        total_pending_amount: stats?.total_pending_amount ?? 0,
        total_completed: stats?.total_completed ?? 0,
        total_completed_amount: stats?.total_completed_amount ?? 0,
        total_failed: stats?.total_failed ?? 0,
        total_all: stats?.total_all ?? 0,
        total_amount: stats?.total_amount ?? 0,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── Seller-facing route (separate Hono app, uses requireAuth) ──

const sellerSettlementRoutes = new Hono<{ Bindings: Env }>();

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// GET /api/seller/restaurant-settlements — Seller views their own settlements
sellerSettlementRoutes.get('/', requireAuth(), async (c) => {
  const DB = c.env.DB;
  await ensureSettlementTables(DB);

  const user = getCurrentUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  try {
    // Resolve seller_id: user.id might be a Firebase UID string, so look up sellers table
    let sellerId: number | null = null;

    if (user.type === 'seller') {
      sellerId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
    } else {
      // Try to find a seller linked to this user
      const seller = await queryFirst<{ id: number }>(
        DB,
        'SELECT id FROM sellers WHERE id = ?',
        [String(user.id)],
      );
      if (seller) sellerId = seller.id;
    }

    if (!sellerId) {
      return c.json({ success: false, error: 'Seller account not found' }, 403);
    }

    const status = c.req.query('status') || null;
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['rs.seller_id = ?'];
    const params: unknown[] = [sellerId];

    if (status) {
      conditions.push('rs.status = ?');
      params.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRow = await queryFirst<{ cnt: number }>(
      DB,
      `SELECT COUNT(*) AS cnt FROM restaurant_settlements rs ${whereClause}`,
      params,
    );
    const total = countRow?.cnt ?? 0;

    const rows = await executeQuery(DB, `
      SELECT rs.*
      FROM restaurant_settlements rs
      ${whereClause}
      ORDER BY rs.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return c.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

export { restaurantSettlementRoutes, sellerSettlementRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureSettlementTables = false
