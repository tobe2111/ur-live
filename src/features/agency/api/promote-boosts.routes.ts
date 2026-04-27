/**
 * Promote to Live Coupons — 노출 부스팅 쿠폰
 *
 * 마운트:
 *   /api/agency/promote-boosts          — 에이전시: 발급/관리 (coupon 권한)
 *   /api/seller/promote-boosts          — 셀러: 받은 쿠폰 사용
 *
 * 흐름:
 *   1) 에이전시가 셀러에게 등급별 (bronze/silver/gold) 쿠폰 발급
 *   2) 쿠폰은 30일 내 사용 가능
 *   3) 셀러가 라이브 시작 시 쿠폰 활성화 → boost_ends_at 까지 메인 피드 부스팅
 *   4) 메인 피드 정렬 시 active 부스팅 라이브 가중치 부여 (별도 PR 에서 통합)
 *
 * 마이그레이션 0232 미적용 시 graceful skip.
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import { parseSessionCookie } from '@/worker/utils/session';
import type { Env } from '@/worker/types/env';
import { requireAgencyPermission } from './agency-role-guard';

type AgencyCtx = { Bindings: Env; Variables: { agency: { id: number; email?: string } } };
type SellerCtx = { Bindings: Env; Variables: { seller: { id: number; email: string } } };

const agencyApp = new Hono<AgencyCtx>();
const sellerApp = new Hono<SellerCtx>();

function getBearerToken(h?: string | null): string | null {
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function verifyAgencyToken(secret: string, token: string): Promise<{ id: number; email: string } | null> {
  if (!token) return null;
  try {
    const payload = await verify(token, secret, 'HS256') as Record<string, unknown>;
    if (payload.type !== 'agency' || !payload.sub) return null;
    return { id: Number(payload.sub), email: String(payload.email) };
  } catch { return null; }
}

const requireAgency = async (c: any, next: Next) => {
  let payload = await verifyAgencyToken(c.env.JWT_SECRET, getBearerToken(c.req.header('Authorization')) ?? '');
  if (!payload) {
    try {
      const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['agency']);
      if (sess && sess.userId) payload = { id: Number(sess.userId), email: sess.email || '' };
    } catch { /* */ }
  }
  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401);
  c.set('agency', payload);
  return next();
};

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

agencyApp.use('*', requireAgency);
sellerApp.use('*', requireSeller);

const TIER_DURATION: Record<string, number> = {
  bronze: 12,
  silver: 24,
  gold: 48,
};

async function ensureTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS promote_boost_coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      tier TEXT NOT NULL DEFAULT 'silver',
      duration_hours INTEGER NOT NULL,
      status TEXT DEFAULT 'unused',
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      used_live_id INTEGER,
      boost_ends_at DATETIME,
      note TEXT
    )
  `).run().catch(() => {});
}

// ─── 에이전시: 발급/조회 ────────────────────────────────

// POST / — 발급 (coupon 권한)
agencyApp.post('/', requireAgencyPermission('coupon'), async (c) => {
  const agency = c.get('agency');
  const body = await c.req.json<{
    seller_id: number; tier: 'bronze' | 'silver' | 'gold'; note?: string;
  }>().catch(() => ({} as any));

  if (!body.seller_id || !TIER_DURATION[body.tier]) {
    return c.json({ success: false, error: 'seller_id + tier (bronze/silver/gold) 필수' }, 400);
  }

  // 본 에이전시 소속 셀러인지 확인
  const ms = await c.env.DB.prepare(
    `SELECT 1 FROM agency_sellers WHERE agency_id = ? AND seller_id = ?`
  ).bind(agency.id, body.seller_id).first().catch(() => null);
  if (!ms) return c.json({ success: false, error: '본 에이전시 소속 셀러가 아닙니다.' }, 403);

  await ensureTable(c.env.DB);

  const durationHours = TIER_DURATION[body.tier];
  const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString(); // 30일 만료

  const r = await c.env.DB.prepare(`
    INSERT INTO promote_boost_coupons
      (agency_id, seller_id, tier, duration_hours, expires_at, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(agency.id, body.seller_id, body.tier, durationHours, expiresAt, (body.note || '').slice(0, 200)).run();

  // 셀러 알림
  await c.env.DB.prepare(`
    INSERT INTO dashboard_notifications (user_type, user_id, type, title, message, link, created_at)
    VALUES ('seller', ?, 'promote_boost_received', ?, ?, '/seller', datetime('now'))
  `).bind(
    String(body.seller_id),
    `🚀 노출 부스팅 쿠폰 도착 (${body.tier.toUpperCase()})`,
    `라이브 시작 시 ${durationHours}시간 동안 메인 피드 상단 노출! 30일 내 사용하세요.`,
  ).run().catch(() => {});

  return c.json({ success: true, data: { id: r.meta.last_row_id, tier: body.tier, duration_hours: durationHours, expires_at: expiresAt } });
});

// GET / — 본 에이전시 발급 내역
agencyApp.get('/', async (c) => {
  const agency = c.get('agency');
  await ensureTable(c.env.DB);

  const rows = await c.env.DB.prepare(`
    SELECT pb.*, s.business_name AS seller_name
    FROM promote_boost_coupons pb
    LEFT JOIN sellers s ON s.id = pb.seller_id
    WHERE pb.agency_id = ?
    ORDER BY pb.issued_at DESC
    LIMIT 200
  `).bind(agency.id).all().catch(() => ({ results: [] as any[] }));

  return c.json({ success: true, data: rows.results || [] });
});

// ─── 셀러: 받은 쿠폰 + 활성화 ────────────────────────

// GET / — 본인 쿠폰 (사용 가능 + 활성)
sellerApp.get('/', async (c) => {
  const seller = c.get('seller');
  await ensureTable(c.env.DB);

  const rows = await c.env.DB.prepare(`
    SELECT pb.*, a.name AS agency_name
    FROM promote_boost_coupons pb
    LEFT JOIN agencies a ON a.id = pb.agency_id
    WHERE pb.seller_id = ?
    ORDER BY pb.issued_at DESC
    LIMIT 100
  `).bind(seller.id).all().catch(() => ({ results: [] as any[] }));

  return c.json({ success: true, data: rows.results || [] });
});

// POST /:id/activate — 라이브에 부스팅 활성화
sellerApp.post('/:id/activate', async (c) => {
  const seller = c.get('seller');
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ live_id: number }>().catch(() => ({} as any));

  if (!body.live_id) return c.json({ success: false, error: 'live_id 필수' }, 400);

  // 쿠폰 검증
  const coupon = await c.env.DB.prepare(`
    SELECT id, seller_id, duration_hours, status, expires_at
    FROM promote_boost_coupons WHERE id = ?
  `).bind(id).first<{ id: number; seller_id: number; duration_hours: number; status: string; expires_at: string }>()
    .catch(() => null);

  if (!coupon) return c.json({ success: false, error: 'not found' }, 404);
  if (coupon.seller_id !== seller.id) return c.json({ success: false, error: '본인 쿠폰이 아님' }, 403);
  if (coupon.status !== 'unused') return c.json({ success: false, error: '이미 사용/만료됨' }, 409);
  if (new Date(coupon.expires_at) < new Date()) {
    await c.env.DB.prepare(`UPDATE promote_boost_coupons SET status = 'expired' WHERE id = ?`).bind(id).run().catch(() => {});
    return c.json({ success: false, error: '쿠폰 만료됨' }, 410);
  }

  // 라이브 본인 소유 확인 + active 인지
  const ls = await c.env.DB.prepare(
    `SELECT seller_id, status FROM live_streams WHERE id = ?`
  ).bind(body.live_id).first<{ seller_id: number; status: string }>().catch(() => null);
  if (!ls) return c.json({ success: false, error: 'live not found' }, 404);
  if (Number(ls.seller_id) !== seller.id) return c.json({ success: false, error: 'not your live' }, 403);

  // 활성화 — 라이브 시작 시각 기준 duration_hours 후까지 부스팅
  const boostEndsAt = new Date(Date.now() + coupon.duration_hours * 3600_000).toISOString();

  await c.env.DB.prepare(`
    UPDATE promote_boost_coupons
    SET status = 'active', used_at = datetime('now'), used_live_id = ?, boost_ends_at = ?
    WHERE id = ?
  `).bind(body.live_id, boostEndsAt, id).run();

  return c.json({ success: true, data: { boost_ends_at: boostEndsAt, duration_hours: coupon.duration_hours } });
});

/**
 * 메인 피드에서 active 부스팅 라이브 ID 목록 조회 (정렬 가중치용).
 * 메인 피드 코드가 호출 — 별도 PR 에서 통합.
 */
export async function getActiveBoostedLiveIds(DB: D1Database): Promise<number[]> {
  try {
    const r = await DB.prepare(`
      SELECT used_live_id FROM promote_boost_coupons
      WHERE status = 'active' AND boost_ends_at > datetime('now')
        AND used_live_id IS NOT NULL
    `).all<{ used_live_id: number }>().catch(() => ({ results: [] as any[] }));
    return (r.results || []).map(r => r.used_live_id).filter(Boolean);
  } catch {
    return [];
  }
}

export {
  agencyApp as promoteBoostsAgencyRoutes,
  sellerApp as promoteBoostsSellerRoutes,
};
