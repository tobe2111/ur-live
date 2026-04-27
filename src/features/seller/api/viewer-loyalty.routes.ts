/**
 * Viewer Loyalty API — Phase 2-3
 *
 * 마운트: /api/seller/viewers
 *
 * Endpoints:
 *   GET /:user_id/loyalty?seller_id=X  — 특정 시청자의 셀러별 충성도 통계
 *
 * 통계 산정:
 *   visits   — 해당 셀러 라이브에 시청 기록 (live_views 또는 live_chat 기반)
 *   payments — 해당 셀러에게 결제 완료 횟수 (orders.payment_status='approved')
 *   spent    — 누적 결제 + 후원 금액
 *
 * 멱등 + graceful degradation. 테이블 없으면 0 반환.
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import type { Env } from '@/worker/types/env';

type SellerCtx = {
  Bindings: Env;
  Variables: { seller: { id: number; email: string } };
};

const app = new Hono<SellerCtx>();

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

app.use('*', requireSeller);

// GET /:user_id/loyalty — 특정 시청자의 본 셀러에 대한 충성도 통계
app.get('/:user_id/loyalty', async (c) => {
  const seller = c.get('seller');
  const userId = Number(c.req.param('user_id'));
  if (!Number.isFinite(userId) || userId <= 0) {
    return c.json({ success: false, error: 'invalid user_id' }, 400);
  }

  let visits = 0;
  let payments = 0;
  let totalSpent = 0;

  // visits — live_chat 또는 live_views 기반
  try {
    const r = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT ls.id) AS cnt
      FROM live_chat lc
      JOIN live_streams ls ON ls.id = lc.live_stream_id
      WHERE lc.user_id = ? AND ls.seller_id = ?
    `).bind(userId, seller.id).first<{ cnt: number }>().catch(() => null);
    visits = r?.cnt ?? 0;
  } catch { /* table missing — skip */ }

  // payments + spent
  try {
    const r = await c.env.DB.prepare(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS spent
      FROM orders
      WHERE user_id = ? AND seller_id = ? AND payment_status = 'approved'
    `).bind(userId, seller.id).first<{ cnt: number; spent: number }>().catch(() => null);
    payments = r?.cnt ?? 0;
    totalSpent = r?.spent ?? 0;
  } catch { /* skip */ }

  // donations 도 매출에 합산
  try {
    const d = await c.env.DB.prepare(`
      SELECT COALESCE(SUM(deal_amount), 0) AS donated
      FROM donations
      WHERE user_id = ? AND seller_id = ? AND payment_status = 'approved'
    `).bind(userId, seller.id).first<{ donated: number }>().catch(() => null);
    totalSpent += d?.donated ?? 0;
  } catch { /* skip */ }

  return c.json({
    success: true,
    data: {
      user_id: userId,
      seller_id: seller.id,
      visits,
      payments,
      total_spent: totalSpent,
    },
  });
});

export { app as viewerLoyaltyRoutes };
