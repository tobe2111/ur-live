/**
 * Seller-side Transfer Response — TD-016 CRITICAL fix
 *
 * 마운트: /api/seller/transfers
 *
 * 🛡️ 2026-04-30 TD-016 CRITICAL: 기존 /api/agency/transfers/:id/seller-approve
 *   는 from_agency 가 셀러 동의를 대행하는 위험 endpoint 였음 (agency 가
 *   셀러 행세 가능). 이 라우터는 셀러 본인 토큰으로만 응답 가능.
 *
 * Endpoints:
 *   GET /              — 본인 셀러에게 들어온 이전 요청 목록
 *   POST /:id/respond  — 셀러 본인 동의/거부 → agency_sellers 매핑 변경
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import { parseSessionCookie } from '../../../worker/utils/session';
import { swallow } from '../../../worker/utils/swallow';
import { rateLimit } from '../../../worker/middleware/rate-limit';
import type { Env } from '../../../worker/types/env';

type SellerCtx = {
  Bindings: Env;
  Variables: { seller: { id: number; email?: string } };
};

const app = new Hono<SellerCtx>();

function getBearerToken(h?: string | null): string | null {
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

const requireSeller = async (c: any, next: Next) => {
  let sellerId: number | null = null;
  let email: string | undefined;

  // Bearer
  const tok = getBearerToken(c.req.header('Authorization')) ?? '';
  if (tok) {
    try {
      const payload = await verify(tok, c.env.JWT_SECRET, 'HS256') as Record<string, unknown>;
      if (payload.type === 'seller' && payload.sub) {
        sellerId = Number(payload.sub);
        email = payload.email ? String(payload.email) : undefined;
      }
    } catch { /* fall through to cookie */ }
  }

  // Session cookie fallback (seller scope)
  if (!sellerId) {
    try {
      const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['seller']);
      if (sess && sess.userId) {
        sellerId = Number(sess.userId);
        email = sess.email || undefined;
      }
    } catch { /* */ }
  }

  if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다.' }, 401);
  c.set('seller', { id: sellerId, email });
  return next();
};

app.use('*', requireSeller);

// GET / — 본인 셀러 ID 매칭 transfer 신청 목록
app.get('/', async (c) => {
  const seller = c.get('seller');

  const rows = await c.env.DB.prepare(`
    SELECT t.*,
      sa.name AS from_agency_name,
      sb.name AS to_agency_name
    FROM seller_transfer_requests t
    LEFT JOIN agencies sa ON sa.id = t.from_agency_id
    LEFT JOIN agencies sb ON sb.id = t.to_agency_id
    WHERE t.seller_id = ?
    ORDER BY t.created_at DESC
    LIMIT 100
  `).bind(seller.id).all().catch(() => ({ results: [] as any[] }));

  return c.json({ success: true, data: rows.results || [] });
});

// POST /:id/respond — 셀러 본인 동의/거부 → 매핑 변경
app.post('/:id/respond', rateLimit({ action: 'seller_transfer_respond', max: 20, windowSec: 300 }), async (c) => {
  const seller = c.get('seller');
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ approved: boolean; reason?: string }>().catch(() => ({} as any));

  if (typeof body.approved !== 'boolean') {
    return c.json({ success: false, error: 'approved (boolean) required' }, 400);
  }

  const t = await c.env.DB.prepare(
    `SELECT * FROM seller_transfer_requests WHERE id = ?`
  ).bind(id).first<{
    id: number; seller_id: number; from_agency_id: number; to_agency_id: number; status: string;
  }>().catch(() => null);

  if (!t) return c.json({ success: false, error: 'not found' }, 404);
  // 🛡️ IDOR 방지 — 본인의 transfer 만 응답 가능
  if (Number(t.seller_id) !== Number(seller.id)) {
    return c.json({ success: false, error: '본인의 이전 요청이 아닙니다.' }, 403);
  }
  if (t.status !== 'accepted_by_to') {
    return c.json({ success: false, error: '받는 에이전시 수락 후에만 응답 가능합니다.' }, 409);
  }

  if (!body.approved) {
    await c.env.DB.prepare(`
      UPDATE seller_transfer_requests
      SET status = 'rejected', seller_response = 'reject',
          seller_response_at = datetime('now'),
          rejection_reason = ?
      WHERE id = ?
    `).bind((body.reason || '셀러 거부').slice(0, 500), id).run();

    // 양 에이전시에 거부 알림
    await c.env.DB.prepare(`
      INSERT INTO agency_notifications (agency_id, type, title, message)
      VALUES (?, 'seller_transfer_rejected', ?, ?), (?, 'seller_transfer_rejected', ?, ?)
    `).bind(
      t.from_agency_id, '셀러가 이전을 거부함', `셀러 #${t.seller_id} 가 이전을 거부했습니다.`,
      t.to_agency_id, '셀러가 이전을 거부함', `셀러 #${t.seller_id} 가 이전을 거부했습니다.`,
    ).run().catch(swallow('seller:api:transfer-respond'));

    return c.json({ success: true, data: { status: 'rejected' } });
  }

  // 승인 → 매핑 변경 (batch)
  await c.env.DB.batch([
    c.env.DB.prepare(
      `DELETE FROM agency_sellers WHERE agency_id = ? AND seller_id = ?`
    ).bind(t.from_agency_id, t.seller_id),
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO agency_sellers (agency_id, seller_id) VALUES (?, ?)`
    ).bind(t.to_agency_id, t.seller_id),
    c.env.DB.prepare(`
      UPDATE seller_transfer_requests
      SET status = 'completed', seller_response = 'approve',
          seller_response_at = datetime('now'),
          completed_at = datetime('now')
      WHERE id = ?
    `).bind(id),
  ]);

  // 양 에이전시 알림
  await c.env.DB.prepare(`
    INSERT INTO agency_notifications (agency_id, type, title, message)
    VALUES (?, 'seller_transferred_out', ?, ?), (?, 'seller_transferred_in', ?, ?)
  `).bind(
    t.from_agency_id, '셀러 이전 완료', `셀러 #${t.seller_id} 가 다른 에이전시로 이전됐습니다.`,
    t.to_agency_id, '셀러 영입 완료', `셀러 #${t.seller_id} 가 본 에이전시에 합류했습니다.`,
  ).run().catch(swallow('seller:api:transfer-respond'));

  return c.json({ success: true, data: { status: 'completed' } });
});

export { app as sellerTransferRespondRoutes };
