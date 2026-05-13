/**
 * Admin Abuse Detection API (2026-05-05)
 *
 * GET /abuse-detections — 어뷰징 탐지 목록 (필터: severity, pattern, limit)
 * PATCH /abuse-detections/:id/review — 검토 완료 처리
 *
 * GET /ad-slots — 광고 슬롯 현황
 * GET /ad-slots/bids — 입찰 이력
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { requireAdmin } from '@/worker/middleware/auth';
import { swallow } from '@/worker/utils/swallow';

export const adminAbuseRoutes = new Hono<{ Bindings: Env }>();
// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
adminAbuseRoutes.use('*', requireAdmin());

// GET /abuse-detections
adminAbuseRoutes.get('/abuse-detections', async (c) => {
  const DB = c.env.DB;
  const severity = c.req.query('severity');
  const pattern = c.req.query('pattern');
  const limit = Math.min(500, Number(c.req.query('limit') ?? 200));

  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (severity) { conditions.push('severity = ?'); binds.push(severity); }
  if (pattern)  { conditions.push('pattern = ?');  binds.push(pattern); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await DB.prepare(`
    SELECT id, pattern, user_id, ref_type, ref_id, evidence, severity,
           COALESCE(reviewed, 0) AS reviewed, created_at
    FROM abuse_detections
    ${where}
    ORDER BY
      CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      created_at DESC
    LIMIT ?
  `).bind(...binds, limit).all().catch(() => ({ results: [] }));

  return c.json({ detections: rows.results });
});

// PATCH /abuse-detections/:id/review
adminAbuseRoutes.patch('/abuse-detections/:id/review', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  await c.env.DB.prepare(`
    UPDATE abuse_detections SET reviewed = 1 WHERE id = ?
  `).bind(id).run().catch(swallow('admin:abuse:review'));

  return c.json({ ok: true });
});

// GET /ad-slots — 어드민용 슬롯 상태 (public /api/seller/ad-slots 와 별개)
adminAbuseRoutes.get('/ad-slots', async (c) => {
  const DB = c.env.DB;
  const rows = await DB.prepare(`
    SELECT
      s.slot_id, s.display_name, s.description, s.base_price,
      s.current_seller_id, s.current_bid, s.starts_at, s.expires_at, s.is_active,
      sel.business_name AS current_winner_name,
      (SELECT MAX(b2.bid_amount) FROM ad_bids b2 WHERE b2.slot_id = s.slot_id AND b2.status = 'active') AS top_bid,
      (SELECT COUNT(*) FROM ad_bids b3 WHERE b3.slot_id = s.slot_id AND b3.status = 'active') AS bid_count
    FROM ad_slots s
    LEFT JOIN sellers sel ON sel.id = s.current_seller_id
    ORDER BY s.base_price DESC
  `).all().catch(() => ({ results: [] }));

  return c.json({ slots: rows.results });
});

// GET /ad-slots/bids — 전체 입찰 이력
adminAbuseRoutes.get('/ad-slots/bids', async (c) => {
  const DB = c.env.DB;
  const rows = await DB.prepare(`
    SELECT b.id, b.slot_id, b.seller_id, b.bid_amount, b.status, b.payment_status,
           b.created_at, b.start_period, b.end_period,
           s.display_name AS slot_name,
           sel.business_name AS seller_name
    FROM ad_bids b
    JOIN ad_slots s ON s.slot_id = b.slot_id
    JOIN sellers sel ON sel.id = b.seller_id
    ORDER BY b.created_at DESC
    LIMIT 300
  `).all().catch(() => ({ results: [] }));

  return c.json({ bids: rows.results });
});
