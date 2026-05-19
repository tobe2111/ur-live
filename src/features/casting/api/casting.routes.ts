/**
 * Casting Marketplace Routes — Phase 3-6
 *
 * 광고주 ↔ 셀러 캐스팅 마켓플레이스.
 *
 * 마운트:
 *   /api/admin/advertisers     — 어드민: 광고주 관리
 *   /api/admin/castings        — 어드민: 캐스팅 요청 검토
 *   /api/seller/castings       — 셀러: 받은 캐스팅 신청 + 응답
 *
 * 흐름:
 *   1) 광고주 가입 (셀프 또는 어드민 등록)
 *   2) 어드민이 광고주 active 상태로 승인
 *   3) (어드민 또는 광고주가) 캐스팅 신청 생성 → status='admin_review'
 *   4) 어드민 검토 → status='sent_to_seller'
 *   5) 셀러 수락/거절
 *   6) 수락 → 외부 거래 진행 (결제는 별도) → 어드민이 수동 'completed'
 *
 * 마이그레이션 0230 미적용 시 graceful skip.
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import type { Env } from '@/worker/types/env';
import { requireAdmin } from '@/worker/middleware/auth';

import { swallow } from '@/worker/utils/swallow';
type SellerCtx = {
  Bindings: Env;
  Variables: { seller: { id: number; email: string } };
};

const adminAdvertiserApp = new Hono<{ Bindings: Env }>();
const adminCastingApp = new Hono<{ Bindings: Env }>();
const sellerCastingApp = new Hono<SellerCtx>();

adminAdvertiserApp.use('*', requireAdmin());
adminCastingApp.use('*', requireAdmin());

function getBearerToken(h?: string | null): string | null {
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

const requireSeller = async (c: any, next: Next) => {
  const token = getBearerToken(c.req.header('Authorization')) ?? '';
  if (!token) return c.json({ success: false, error: 'unauth' }, 401);
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as Record<string, unknown>;
    if (payload.type !== 'seller' || !payload.sub) return c.json({ success: false, error: 'unauth' }, 401);
    c.set('seller', { id: Number(payload.sub), email: String(payload.email) });
    return next();
  } catch {
    return c.json({ success: false, error: 'unauth' }, 401);
  }
};

sellerCastingApp.use('*', requireSeller);

async function ensureTables(DB: D1Database) {
  if (_done_ensureTables) return
  _done_ensureTables = true
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS advertisers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      contact_name TEXT,
      phone TEXT,
      business_number TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(swallow('casting:api:casting'));
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS casting_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      advertiser_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      campaign_title TEXT NOT NULL,
      campaign_brief TEXT,
      product_category TEXT,
      proposed_fee INTEGER NOT NULL,
      expected_revenue INTEGER,
      proposed_live_date DATE,
      status TEXT DEFAULT 'pending',
      admin_review_at DATETIME,
      seller_response_at DATETIME,
      seller_response TEXT,
      rejection_reason TEXT,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(swallow('casting:api:casting'));
}

// ─── Admin: Advertisers ───────────────────────────────────────────

adminAdvertiserApp.get('/', async (c) => {
  await ensureTables(c.env.DB);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM advertisers ORDER BY created_at DESC LIMIT 200`
  ).all().catch(() => ({ results: [] as any[] }));
  return c.json({ success: true, data: rows.results || [] });
});

adminAdvertiserApp.post('/', async (c) => {
  await ensureTables(c.env.DB);
  const body = await c.req.json<{
    name: string; email: string; contact_name?: string; phone?: string; business_number?: string;
  }>().catch(() => ({} as any));
  if (!body.name || !body.email) return c.json({ success: false, error: 'name/email required' }, 400);

  const r = await c.env.DB.prepare(`
    INSERT INTO advertisers (name, email, contact_name, phone, business_number, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).bind(body.name, body.email, body.contact_name || null, body.phone || null, body.business_number || null).run();

  return c.json({ success: true, data: { id: r.meta.last_row_id } });
});

adminAdvertiserApp.patch('/:id/status', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ status: 'active' | 'suspended' }>().catch(() => ({} as any));
  if (!['active', 'suspended'].includes(body.status)) return c.json({ success: false, error: 'invalid status' }, 400);
  await c.env.DB.prepare(`UPDATE advertisers SET status = ? WHERE id = ?`)
    .bind(body.status, id).run().catch(swallow('casting:api:casting'));
  return c.json({ success: true });
});

// ─── Admin: Casting Requests ──────────────────────────────────────

adminCastingApp.get('/', async (c) => {
  await ensureTables(c.env.DB);
  const rows = await c.env.DB.prepare(`
    SELECT cr.*, a.name AS advertiser_name, s.business_name AS seller_name
    FROM casting_requests cr
    LEFT JOIN advertisers a ON a.id = cr.advertiser_id
    LEFT JOIN sellers s ON s.id = cr.seller_id
    ORDER BY cr.created_at DESC LIMIT 200
  `).all().catch(() => ({ results: [] as any[] }));
  return c.json({ success: true, data: rows.results || [] });
});

adminCastingApp.post('/', async (c) => {
  await ensureTables(c.env.DB);
  const body = await c.req.json<{
    advertiser_id: number; seller_id: number; campaign_title: string;
    campaign_brief?: string; product_category?: string;
    proposed_fee: number; expected_revenue?: number; proposed_live_date?: string;
  }>().catch(() => ({} as any));

  if (!body.advertiser_id || !body.seller_id || !body.campaign_title || !body.proposed_fee) {
    return c.json({ success: false, error: 'missing fields' }, 400);
  }

  const r = await c.env.DB.prepare(`
    INSERT INTO casting_requests
      (advertiser_id, seller_id, campaign_title, campaign_brief, product_category,
       proposed_fee, expected_revenue, proposed_live_date, status, admin_review_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sent_to_seller', datetime('now'))
  `).bind(
    body.advertiser_id, body.seller_id, body.campaign_title.slice(0, 200),
    (body.campaign_brief || '').slice(0, 2000),
    body.product_category || null,
    body.proposed_fee,
    body.expected_revenue || null,
    body.proposed_live_date || null,
  ).run();

  return c.json({ success: true, data: { id: r.meta.last_row_id } });
});

adminCastingApp.patch('/:id/complete', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare(`
    UPDATE casting_requests
    SET status = 'completed', completed_at = datetime('now')
    WHERE id = ? AND status = 'accepted'
  `).bind(id).run().catch(swallow('casting:api:casting'));
  return c.json({ success: true });
});

// ─── Seller: 받은 캐스팅 + 응답 ───────────────────────────────────

sellerCastingApp.get('/', async (c) => {
  const seller = c.get('seller');
  await ensureTables(c.env.DB);
  const rows = await c.env.DB.prepare(`
    SELECT cr.*, a.name AS advertiser_name
    FROM casting_requests cr
    LEFT JOIN advertisers a ON a.id = cr.advertiser_id
    WHERE cr.seller_id = ?
    ORDER BY cr.created_at DESC
  `).bind(seller.id).all().catch(() => ({ results: [] as any[] }));
  return c.json({ success: true, data: rows.results || [] });
});

sellerCastingApp.post('/:id/respond', async (c) => {
  const seller = c.get('seller');
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ response: 'accept' | 'reject'; reason?: string }>().catch(() => ({} as any));

  if (body.response !== 'accept' && body.response !== 'reject') {
    return c.json({ success: false, error: 'response must be accept|reject' }, 400);
  }

  const r = await c.env.DB.prepare(`
    UPDATE casting_requests
    SET status = ?, seller_response = ?, seller_response_at = datetime('now'),
        rejection_reason = ?
    WHERE id = ? AND seller_id = ? AND status = 'sent_to_seller'
  `).bind(
    body.response === 'accept' ? 'accepted' : 'rejected',
    body.response,
    body.response === 'reject' ? (body.reason || '') : null,
    id, seller.id
  ).run().catch(() => null);

  if (!r || (r.meta as any).changes === 0) {
    return c.json({ success: false, error: '이미 응답됐거나 본인 캐스팅이 아닙니다.' }, 409);
  }

  return c.json({ success: true });
});

export {
  adminAdvertiserApp as adminAdvertiserRoutes,
  adminCastingApp as adminCastingRoutes,
  sellerCastingApp as sellerCastingRoutes,
};


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureTables = false
