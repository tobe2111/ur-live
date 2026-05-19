/**
 * Interest/Watchlist Alerts API
 *
 * POST   /api/interest/add      - Add interest (restaurant, product, or group_buy)
 * DELETE /api/interest/:id      - Remove interest
 * GET    /api/interest/my       - List user's interests
 * GET    /api/interest/check    - Check if user has interest in specific item
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
const interestRoutes = new Hono<{ Bindings: Env }>();

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// ── Ensure table ───────────────────────────────────────────────

async function ensureTable(DB: D1Database) {
  if (_done_ensureTable) return
  _done_ensureTable = true
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS user_interests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        restaurant_name TEXT,
        product_id INTEGER,
        type TEXT DEFAULT 'restaurant' CHECK(type IN ('restaurant','product','group_buy')),
        notified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
  } catch { /* already exists */ }
}

// ── POST /api/interest/add — Add interest ──────────────────────

interestRoutes.post('/add', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const body = await c.req.json<{
    restaurant_name?: string;
    product_id?: number;
    type?: 'restaurant' | 'product' | 'group_buy';
  }>();

  const type = body.type || 'restaurant';
  const restaurantName = body.restaurant_name || null;
  const productId = body.product_id || null;

  // Validate: at least one identifier must be present
  if (!restaurantName && !productId) {
    return c.json({ success: false, error: 'restaurant_name or product_id is required' }, 400);
  }

  // Validate type-specific fields
  if (type === 'restaurant' && !restaurantName) {
    return c.json({ success: false, error: 'restaurant_name is required for restaurant type' }, 400);
  }
  if ((type === 'product' || type === 'group_buy') && !productId) {
    return c.json({ success: false, error: 'product_id is required for product/group_buy type' }, 400);
  }

  const userId = String(user.id);

  // Check for duplicate
  let existing;
  if (restaurantName) {
    existing = await DB.prepare(
      'SELECT id FROM user_interests WHERE user_id = ? AND restaurant_name = ? AND type = ?'
    ).bind(userId, restaurantName, type).first();
  } else if (productId) {
    existing = await DB.prepare(
      'SELECT id FROM user_interests WHERE user_id = ? AND product_id = ? AND type = ?'
    ).bind(userId, productId, type).first();
  }

  if (existing) {
    return c.json({ success: false, error: 'Interest already exists' }, 409);
  }

  const result = await DB.prepare(
    `INSERT INTO user_interests (user_id, restaurant_name, product_id, type)
     VALUES (?, ?, ?, ?)`
  ).bind(userId, restaurantName, productId, type).run();

  return c.json({
    success: true,
    data: {
      id: result.meta.last_row_id,
      user_id: userId,
      restaurant_name: restaurantName,
      product_id: productId,
      type,
    },
    message: 'Interest added successfully',
  }, 201);
});

// ── DELETE /api/interest/:id — Remove interest ─────────────────

interestRoutes.delete('/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const interestId = c.req.param('id');
  const userId = String(user.id);

  // Verify ownership
  const existing = await DB.prepare(
    'SELECT id FROM user_interests WHERE id = ? AND user_id = ?'
  ).bind(interestId, userId).first();

  if (!existing) {
    return c.json({ success: false, error: 'Interest not found' }, 404);
  }

  await DB.prepare('DELETE FROM user_interests WHERE id = ? AND user_id = ?')
    .bind(interestId, userId).run();

  return c.json({ success: true, message: 'Interest removed successfully' });
});

// ── POST /api/interest/remove — Remove by product_id + type ────

interestRoutes.post('/remove', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const body = await c.req.json<{
    product_id?: number;
    restaurant_name?: string;
    type?: 'restaurant' | 'product' | 'group_buy' | 'meal_voucher';
  }>();

  const userId = String(user.id);
  const productId = body.product_id ?? null;
  const restaurantName = body.restaurant_name ?? null;
  const type = body.type === 'meal_voucher' ? 'product' : (body.type || 'product');

  if (!productId && !restaurantName) {
    return c.json({ success: false, error: 'product_id or restaurant_name required' }, 400);
  }

  if (productId) {
    await DB.prepare(
      'DELETE FROM user_interests WHERE user_id = ? AND product_id = ? AND type = ?'
    ).bind(userId, productId, type).run();
  } else if (restaurantName) {
    await DB.prepare(
      'DELETE FROM user_interests WHERE user_id = ? AND restaurant_name = ? AND type = ?'
    ).bind(userId, restaurantName, type).run();
  }

  return c.json({ success: true, message: 'Interest removed' });
});

// ── GET /api/interest/my — List user's interests ───────────────

interestRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const userId = String(user.id);

  const { results } = await DB.prepare(
    `SELECT id, user_id, restaurant_name, product_id, type, notified, created_at
     FROM user_interests
     WHERE user_id = ?
     ORDER BY created_at DESC`
  ).bind(userId).all();

  return c.json({ success: true, data: results ?? [] });
});

// ── GET /api/interest/check — Check if user has interest ───────

interestRoutes.get('/check', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const userId = String(user.id);
  const restaurantName = c.req.query('restaurant_name');
  const productId = c.req.query('product_id');

  if (!restaurantName && !productId) {
    return c.json({ success: false, error: 'restaurant_name or product_id query parameter is required' }, 400);
  }

  let record;
  if (restaurantName) {
    record = await DB.prepare(
      'SELECT id, type, created_at FROM user_interests WHERE user_id = ? AND restaurant_name = ?'
    ).bind(userId, restaurantName).first();
  } else if (productId) {
    record = await DB.prepare(
      'SELECT id, type, created_at FROM user_interests WHERE user_id = ? AND product_id = ?'
    ).bind(userId, parseInt(productId, 10)).first();
  }

  return c.json({
    success: true,
    data: {
      has_interest: !!record,
      interest: record || null,
    },
  });
});

export { interestRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureTable = false
