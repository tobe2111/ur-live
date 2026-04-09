/**
 * 타임딜 룰렛 API
 *
 * POST /api/timedeal/create          - 타임딜 생성 (셀러)
 * GET  /api/timedeal/stream/:streamId - 현재 활성 타임딜
 * POST /api/timedeal/:id/claim       - 타임딜 클레임 (시청자)
 * GET  /api/timedeal/:id             - 타임딜 상세
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';

const timedealRoutes = new Hono<{ Bindings: Env }>();

timedealRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

async function ensureTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS time_deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        original_price INTEGER NOT NULL,
        deal_price INTEGER NOT NULL,
        discount_percent INTEGER NOT NULL,
        max_claims INTEGER NOT NULL DEFAULT 10,
        claimed_count INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER NOT NULL DEFAULT 30,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'sold_out')),
        triggered_at DATETIME DEFAULT (datetime('now')),
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch {}
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS time_deal_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deal_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now')),
        UNIQUE(deal_id, user_id)
      )
    `).run();
  } catch {}
}

// POST /api/timedeal/create — 셀러가 타임딜 트리거
timedealRoutes.post('/create', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const { stream_id, product_id, discount_percent, max_claims, duration_seconds } = await c.req.json<{
    stream_id: number; product_id: number; discount_percent: number;
    max_claims?: number; duration_seconds?: number;
  }>();

  if (!stream_id || !product_id || !discount_percent) return c.json({ success: false, error: '필수 항목 누락' }, 400);

  const product = await DB.prepare('SELECT name, price, seller_id FROM products WHERE id = ?').bind(product_id).first<any>();
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

  const dur = duration_seconds || 30;
  const expiresAt = new Date(Date.now() + dur * 1000).toISOString();
  const dealPrice = Math.round(product.price * (100 - discount_percent) / 100);

  const result = await DB.prepare(`
    INSERT INTO time_deals (stream_id, seller_id, product_id, product_name, original_price, deal_price, discount_percent, max_claims, duration_seconds, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(stream_id, product.seller_id, product_id, product.name, product.price, dealPrice, discount_percent, max_claims || 10, dur, expiresAt).run();

  return c.json({ success: true, data: { id: result.meta.last_row_id, deal_price: dealPrice, expires_at: expiresAt } }, 201);
});

// GET /api/timedeal/stream/:streamId — 현재 활성 타임딜
timedealRoutes.get('/stream/:streamId', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const streamId = c.req.param('streamId');
  const deal = await DB.prepare(
    "SELECT * FROM time_deals WHERE stream_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
  ).bind(streamId).first<any>();

  if (!deal) return c.json({ success: true, data: null });

  if (new Date(deal.expires_at) < new Date() || deal.claimed_count >= deal.max_claims) {
    const newStatus = deal.claimed_count >= deal.max_claims ? 'sold_out' : 'ended';
    await DB.prepare("UPDATE time_deals SET status = ? WHERE id = ?").bind(newStatus, deal.id).run();
    deal.status = newStatus;
  }

  return c.json({ success: true, data: deal });
});

// POST /api/timedeal/:id/claim — 타임딜 클레임
timedealRoutes.post('/:id/claim', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const dealId = Number(c.req.param('id'));
  const deal = await DB.prepare("SELECT * FROM time_deals WHERE id = ? AND status = 'active'").bind(dealId).first<any>();

  if (!deal) return c.json({ success: false, error: '타임딜이 종료되었습니다' }, 404);
  if (new Date(deal.expires_at) < new Date()) {
    await DB.prepare("UPDATE time_deals SET status = 'ended' WHERE id = ?").bind(dealId).run();
    return c.json({ success: false, error: '시간이 초과되었습니다' }, 400);
  }
  if (deal.claimed_count >= deal.max_claims) {
    await DB.prepare("UPDATE time_deals SET status = 'sold_out' WHERE id = ?").bind(dealId).run();
    return c.json({ success: false, error: '수량이 소진되었습니다' }, 400);
  }

  // 중복 체크
  const existing = await DB.prepare('SELECT id FROM time_deal_claims WHERE deal_id = ? AND user_id = ?')
    .bind(dealId, user.id).first();
  if (existing) return c.json({ success: false, error: '이미 참여하셨습니다' }, 409);

  await DB.prepare('INSERT INTO time_deal_claims (deal_id, user_id) VALUES (?, ?)').bind(dealId, user.id).run();
  await DB.prepare('UPDATE time_deals SET claimed_count = claimed_count + 1 WHERE id = ?').bind(dealId).run();

  return c.json({ success: true, data: { deal_price: deal.deal_price, product_id: deal.product_id } });
});

// GET /api/timedeal/:id
timedealRoutes.get('/:id', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);
  const deal = await DB.prepare('SELECT * FROM time_deals WHERE id = ?').bind(c.req.param('id')).first<any>();
  if (!deal) return c.json({ success: false, error: '타임딜을 찾을 수 없습니다' }, 404);
  return c.json({ success: true, data: deal });
});

export { timedealRoutes };
