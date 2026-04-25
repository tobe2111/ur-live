/**
 * Admin Coupons Routes — 쿠폰 관리
 *
 * 🛡️ 2026-04-22 배치 138 (TD-006 부분): admin-management.routes.ts (3518줄) 에서 분리.
 * worker/index.ts 에서 adminApp.route('/', adminCouponsRoutes) 으로 마운트 (기존
 * adminManagementRoutes 와 동일 prefix).
 *
 * 엔드포인트:
 * - GET    /coupons
 * - POST   /coupons
 * - DELETE /coupons/:id
 * - POST   /coupons/:id/send-segment — 세그먼트 발송
 *
 * 인증: adminApp 에 이미 requireAdmin() 적용되어 있음.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';

export const adminCouponsRoutes = new Hono<{ Bindings: Env }>();

let _couponsTableEnsured = false
async function ensureCouponsTable(DB: D1Database) {
  if (_couponsTableEnsured) return
  _couponsTableEnsured = true
  try { await DB.prepare(`CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, value INTEGER NOT NULL, min_order_amount INTEGER DEFAULT 0, max_discount INTEGER, total_count INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0, seller_id INTEGER, is_active INTEGER DEFAULT 1, starts_at DATETIME, expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run() } catch {}
}

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

// GET /coupons — 쿠폰 목록
adminCouponsRoutes.get('/coupons', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    await ensureCouponsTable(DB);
    const page = Math.max(1, (parseInt(c.req.query('page') || '1') || 1));
    const limit = Math.min(100, (parseInt(c.req.query('limit') || '50') || 50));
    const offset = (page - 1) * limit;
    const countRow = await DB.prepare('SELECT COUNT(*) AS cnt FROM coupons').first<{ cnt: number }>().catch(() => null);
    const total = countRow?.cnt ?? 0;
    const { results } = await DB.prepare(
      'SELECT id, code, name, type, value, min_order_amount, max_discount, total_count, used_count, seller_id, is_active, starts_at, expires_at, created_at FROM coupons ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(limit, offset).all();
    return c.json({
      success: true,
      data: results ?? [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { return c.json({ success: false, error: safeAdminError(err, c.env) }, 500); }
});

// POST /coupons — 쿠폰 생성
adminCouponsRoutes.post('/coupons', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const body = await c.req.json<{
      code?: string; name?: string; type?: string; value?: number;
      min_order_amount?: number; max_discount?: number; total_count?: number; expires_at?: string
    }>();
    const { code, name, type, value } = body;
    if (!code || !name || !type || value === undefined) return c.json({ success: false, error: '필수 항목 누락' }, 400);

    // 🛡️ 입력 검증 — 타입/길이/범위
    if (typeof code !== 'string' || code.length > 50) return c.json({ success: false, error: 'code 50자 이하' }, 400);
    if (typeof name !== 'string' || name.length > 100) return c.json({ success: false, error: 'name 100자 이하' }, 400);
    if (!['percent', 'fixed'].includes(String(type))) return c.json({ success: false, error: 'type은 percent/fixed' }, 400);
    const valNum = Number(value);
    if (!Number.isFinite(valNum) || valNum < 0 || valNum > 10_000_000) return c.json({ success: false, error: 'value 0~1천만' }, 400);

    const minOrder = Number(body.min_order_amount || 0);
    const maxDisc = body.max_discount == null ? null : Number(body.max_discount);
    const totalCnt = Number(body.total_count || 0);
    if (!Number.isFinite(minOrder) || minOrder < 0) return c.json({ success: false, error: 'min_order_amount 음수 불가' }, 400);
    if (maxDisc !== null && (!Number.isFinite(maxDisc) || maxDisc < 0)) return c.json({ success: false, error: 'max_discount 음수 불가' }, 400);
    if (!Number.isFinite(totalCnt) || totalCnt < 0) return c.json({ success: false, error: 'total_count 음수 불가' }, 400);

    await DB.prepare(`INSERT INTO coupons (code, name, type, value, min_order_amount, max_discount, total_count, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(code, name, type, valNum, minOrder, maxDisc, totalCnt, body.expires_at || null).run();
    return c.json({ success: true, message: '쿠폰이 생성되었습니다' });
  } catch (err) { return c.json({ success: false, error: safeAdminError(err, c.env) }, 500); }
});

// DELETE /coupons/:id — 쿠폰 삭제
adminCouponsRoutes.delete('/coupons/:id', cors(), async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ success: false, error: safeAdminError(err, c.env) }, 500); }
});

// POST /coupons/:id/send-segment — 쿠폰 세그먼트 발송
adminCouponsRoutes.post('/coupons/:id/send-segment', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const couponId = c.req.param('id');
    const { segment } = await c.req.json<{ segment: 'all' | 'vip' | 'new' | 'dormant' | 'active' }>();

    if (!segment || !['all', 'vip', 'new', 'dormant', 'active'].includes(segment)) {
      return c.json({ success: false, error: '유효하지 않은 세그먼트' }, 400);
    }

    const coupon = await DB.prepare('SELECT id, code, name, type, value, min_order_amount, max_discount, total_count, used_count, seller_id, is_active, starts_at, expires_at, created_at FROM coupons WHERE id = ?').bind(couponId).first<Record<string, unknown>>();
    if (!coupon) return c.json({ success: false, error: '쿠폰을 찾을 수 없습니다' }, 404);

    try {
      await DB.prepare(`CREATE TABLE IF NOT EXISTS user_coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        coupon_id INTEGER NOT NULL,
        claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, coupon_id)
      )`).run();
    } catch { /* already exists */ }

    let userQuery = '';
    switch (segment) {
      case 'all':
        userQuery = "SELECT id FROM users";
        break;
      case 'vip':
        userQuery = "SELECT DISTINCT u.id FROM users u INNER JOIN user_tiers ut ON u.id = ut.user_id WHERE ut.tier IN ('gold', 'diamond')";
        break;
      case 'new':
        userQuery = "SELECT id FROM users WHERE created_at > datetime('now', '-7 days')";
        break;
      case 'dormant':
        userQuery = "SELECT u.id FROM users u WHERE u.id NOT IN (SELECT DISTINCT user_id FROM orders WHERE created_at > datetime('now', '-30 days'))";
        break;
      case 'active':
        userQuery = "SELECT DISTINCT user_id as id FROM orders WHERE created_at > datetime('now', '-7 days')";
        break;
    }

    const { results: users } = await DB.prepare(userQuery).all<{ id: string }>();
    if (!users || users.length === 0) {
      return c.json({ success: false, error: '해당 세그먼트에 유저가 없습니다' }, 404);
    }

    let sentCount = 0;
    for (const user of users) {
      try {
        await DB.prepare("INSERT OR IGNORE INTO user_coupons (user_id, coupon_id) VALUES (?, ?)").bind(String(user.id), couponId).run();
        sentCount++;
      } catch { /* duplicate or error — skip */ }
    }

    try {
      await DB.prepare(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        user_type TEXT NOT NULL DEFAULT 'user',
        type TEXT DEFAULT 'coupon',
        title TEXT NOT NULL,
        message TEXT,
        is_read INTEGER DEFAULT 0,
        link TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`).run();
    } catch { /* already exists */ }

    const couponName = coupon.name as string || '쿠폰';
    const segmentLabels: Record<string, string> = {
      all: '전체', vip: 'VIP', new: '신규', dormant: '휴면', active: '활성'
    };

    for (const user of users) {
      try {
        await DB.prepare(
          "INSERT INTO notifications (user_id, user_type, type, title, message, link) VALUES (?, 'user', 'coupon', ?, ?, '/cart')"
        ).bind(
          String(user.id),
          `쿠폰이 도착했어요!`,
          `[${couponName}] 쿠폰이 지급되었습니다. 지금 사용해보세요!`
        ).run();
      } catch { /* skip */ }
    }

    return c.json({
      success: true,
      message: `${segmentLabels[segment]} 유저 ${sentCount}명에게 쿠폰이 발송되었습니다`,
      data: { sent_count: sentCount, segment }
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminCouponsRoutes;
