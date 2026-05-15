/**
 * 🛡️ 2026-05-15 (PRISM 따라잡기): 셀러 자체 promo 코드 발급.
 *
 * 셀러가 본인 단골에게만 적용되는 할인 코드 발급.
 *
 * Endpoints:
 *   - POST /api/promo/create              셀러: 코드 생성 (5자 + discount_pct + 조건)
 *   - GET  /api/promo/seller/list         셀러: 본인 발급 코드 + 사용 통계
 *   - DELETE /api/promo/:id               셀러: 코드 비활성화
 *   - POST /api/promo/redeem              유저: 코드 입력 → 할인 적용 (group-buy join 시 호출)
 *   - GET  /api/promo/preview/:code       유저: 코드 정보 미리보기 (적용 가능 여부)
 *
 * Conditions:
 *   - audience: 'all' | 'followers_only' | 'new_users_only'
 *   - max_uses: per-code 사용 횟수 제한
 *   - per_user_limit: 1 유저당 최대 사용 횟수
 *   - expires_at: 만료일
 */

import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { auditLog } from '@/worker/middleware/audit-log'
import type { Env } from '@/worker/types/env'

const promoRoutes = new Hono<{ Bindings: Env }>()

async function ensurePromoTables(DB: D1Database): Promise<void> {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        code TEXT UNIQUE NOT NULL,
        discount_pct INTEGER NOT NULL,
        audience TEXT DEFAULT 'all',         -- all / followers_only / new_users_only
        max_uses INTEGER DEFAULT 0,           -- 0 = unlimited
        per_user_limit INTEGER DEFAULT 1,
        used_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        expires_at DATETIME,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_promo_codes_seller ON promo_codes(seller_id, created_at DESC)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code)`).run()
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS promo_redemptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        promo_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        order_number TEXT,
        product_id INTEGER,
        discount_amount INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(promo_id, user_id, order_number)
      )
    `).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_promo_redemp_user ON promo_redemptions(user_id)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_promo_redemp_promo ON promo_redemptions(promo_id)`).run()
  } catch { /* exists */ }
}

// ── POST /create — 셀러: 코드 생성 ──
promoRoutes.post('/create',
  rateLimit({ action: 'promo_create', max: 20, windowSec: 3600 }),
  requireAuth(),
  auditLog('promo.create'),
  async (c) => {
    const user = getCurrentUser(c)
    const userAsAny = user as unknown as { id?: number | string; type?: string }
    if (!user || userAsAny.type !== 'seller') {
      return c.json({ success: false, error: '셀러만 가능' }, 403)
    }
    const sellerId = Number(userAsAny.id)

    let body: {
      code?: string; discount_pct?: number; audience?: 'all' | 'followers_only' | 'new_users_only'
      max_uses?: number; per_user_limit?: number; expires_at?: string; description?: string
    }
    try { body = await c.req.json() } catch { return c.json({ success: false, error: 'JSON 형식 오류' }, 400) }

    // 검증
    const code = (body.code || '').toString().trim().toUpperCase()
    if (!/^[A-Z0-9]{4,20}$/.test(code)) {
      return c.json({ success: false, error: '코드는 영문대문자 + 숫자 4-20자' }, 400)
    }
    const discount = Number(body.discount_pct)
    if (!Number.isFinite(discount) || !Number.isInteger(discount) || discount < 1 || discount > 99) {
      return c.json({ success: false, error: '할인율은 1-99 사이 정수' }, 400)
    }
    const audience = body.audience || 'all'
    if (!['all', 'followers_only', 'new_users_only'].includes(audience)) {
      return c.json({ success: false, error: '잘못된 audience' }, 400)
    }
    const maxUses = Math.max(0, Math.min(100000, Number(body.max_uses) || 0))
    const perUserLimit = Math.max(1, Math.min(100, Number(body.per_user_limit) || 1))
    const description = (body.description || '').toString().slice(0, 200)
    const expiresAt = body.expires_at && /^\d{4}-\d{2}-\d{2}/.test(body.expires_at) ? body.expires_at : null

    const { DB } = c.env
    await ensurePromoTables(DB)

    // 중복 코드 차단
    const existing = await DB.prepare('SELECT id FROM promo_codes WHERE code = ?').bind(code).first()
    if (existing) return c.json({ success: false, error: '이미 사용 중인 코드입니다' }, 409)

    try {
      const result = await DB.prepare(`
        INSERT INTO promo_codes (seller_id, code, discount_pct, audience, max_uses, per_user_limit, expires_at, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(sellerId, code, discount, audience, maxUses, perUserLimit, expiresAt, description || null).run()
      return c.json({
        success: true,
        data: { id: result.meta?.last_row_id, code, discount_pct: discount, audience, max_uses: maxUses, per_user_limit: perUserLimit, expires_at: expiresAt }
      })
    } catch (err) {
      console.error('[promo create]', err)
      return c.json({ success: false, error: '생성 실패' }, 500)
    }
  }
)

// ── GET /seller/list — 셀러 본인 코드 + 사용 통계 ──
promoRoutes.get('/seller/list', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  const userAsAny = user as unknown as { id?: number | string; type?: string }
  if (!user || userAsAny.type !== 'seller') {
    return c.json({ success: false, error: '셀러만 가능' }, 403)
  }
  const sellerId = Number(userAsAny.id)

  const { DB } = c.env
  await ensurePromoTables(DB)

  try {
    const { results } = await DB.prepare(`
      SELECT pc.*,
        (SELECT COUNT(*) FROM promo_redemptions WHERE promo_id = pc.id) AS redemption_count
      FROM promo_codes pc
      WHERE pc.seller_id = ?
      ORDER BY pc.created_at DESC
      LIMIT 100
    `).bind(sellerId).all()
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    console.error('[promo seller list]', err)
    return c.json({ success: false, error: '조회 실패' }, 500)
  }
})

// ── DELETE /:id — 코드 비활성화 ──
promoRoutes.delete('/:id', requireAuth(), auditLog('promo.delete'), async (c) => {
  const user = getCurrentUser(c)
  const userAsAny = user as unknown as { id?: number | string; type?: string }
  if (!user || userAsAny.type !== 'seller') {
    return c.json({ success: false, error: '셀러만 가능' }, 403)
  }
  const sellerId = Number(userAsAny.id)
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 id' }, 400)

  const { DB } = c.env
  try {
    const result = await DB.prepare(
      'UPDATE promo_codes SET is_active = 0 WHERE id = ? AND seller_id = ?'
    ).bind(id, sellerId).run()
    if (!result.meta?.changes) return c.json({ success: false, error: '본인 코드 아님' }, 404)
    return c.json({ success: true })
  } catch (err) {
    console.error('[promo delete]', err)
    return c.json({ success: false, error: '비활성화 실패' }, 500)
  }
})

// ── GET /preview/:code — 코드 미리보기 (적용 가능 여부) ──
promoRoutes.get('/preview/:code', async (c) => {
  const code = c.req.param('code').toUpperCase()
  if (!/^[A-Z0-9]{4,20}$/.test(code)) {
    return c.json({ success: false, error: '잘못된 코드 형식' }, 400)
  }

  const { DB } = c.env
  await ensurePromoTables(DB)

  try {
    const promo = await DB.prepare(`
      SELECT pc.*, s.name AS seller_name
      FROM promo_codes pc
      LEFT JOIN sellers s ON s.id = pc.seller_id
      WHERE pc.code = ? AND pc.is_active = 1
    `).bind(code).first<{
      id: number; seller_id: number; code: string; discount_pct: number; audience: string;
      max_uses: number; per_user_limit: number; used_count: number; expires_at: string | null;
      description: string | null; seller_name: string | null
    }>()

    if (!promo) return c.json({ success: false, error: '코드 없음 또는 비활성' }, 404)
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return c.json({ success: false, error: '만료된 코드' }, 410)
    }
    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
      return c.json({ success: false, error: '사용 한도 도달' }, 410)
    }

    return c.json({
      success: true,
      data: {
        code: promo.code,
        seller_id: promo.seller_id,
        seller_name: promo.seller_name,
        discount_pct: promo.discount_pct,
        audience: promo.audience,
        description: promo.description,
        expires_at: promo.expires_at,
        remaining_uses: promo.max_uses > 0 ? promo.max_uses - promo.used_count : null,
      },
    })
  } catch (err) {
    console.error('[promo preview]', err)
    return c.json({ success: false, error: '조회 실패' }, 500)
  }
})

// ── POST /redeem — 유저: 코드 적용 가능 여부 검증 (실제 적용은 group-buy /join 에서) ──
// 🛡️ 호출 시점: 사용자가 공구 참여 화면에서 promo 코드 입력 → 클라이언트 사전 검증.
//   실제 차감 / used_count 증가는 group-buy /join 안에서 처리되어야 race 방어.
//   여기서는 "지금 이 user 가 이 code 사용 가능한가" 만 응답.
promoRoutes.post('/redeem',
  rateLimit({ action: 'promo_redeem', max: 20, windowSec: 300 }),
  requireAuth(),
  async (c) => {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const userId = String(user.id)

    let body: { code?: string; product_id?: number }
    try { body = await c.req.json() } catch { return c.json({ success: false, error: 'JSON 형식 오류' }, 400) }
    const code = (body.code || '').toString().trim().toUpperCase()
    if (!/^[A-Z0-9]{4,20}$/.test(code)) {
      return c.json({ success: false, error: '잘못된 코드' }, 400)
    }

    const { DB } = c.env
    await ensurePromoTables(DB)

    const promo = await DB.prepare(`
      SELECT * FROM promo_codes WHERE code = ? AND is_active = 1
    `).bind(code).first<{
      id: number; seller_id: number; code: string; discount_pct: number; audience: string;
      max_uses: number; per_user_limit: number; used_count: number; expires_at: string | null
    }>()
    if (!promo) return c.json({ success: false, error: '코드 없음' }, 404)
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return c.json({ success: false, error: '만료됨' }, 410)
    }
    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
      return c.json({ success: false, error: '사용 한도 도달' }, 410)
    }

    // audience 검증
    if (promo.audience === 'followers_only') {
      const isFollower = await DB.prepare(
        `SELECT 1 FROM seller_follows WHERE seller_id = ? AND user_id = ?`
      ).bind(promo.seller_id, userId).first().catch(() => null)
      if (!isFollower) return c.json({ success: false, error: '단골만 사용 가능. 단골 등록 후 다시 시도하세요.', code: 'FOLLOWERS_ONLY' }, 403)
    } else if (promo.audience === 'new_users_only') {
      const hasOrder = await DB.prepare(
        `SELECT 1 FROM orders WHERE user_id = ? AND seller_id = ? AND status = 'PAID' LIMIT 1`
      ).bind(userId, promo.seller_id).first().catch(() => null)
      if (hasOrder) return c.json({ success: false, error: '신규 고객 전용 코드입니다', code: 'NEW_USERS_ONLY' }, 403)
    }

    // per-user-limit 검증
    const userRedemptions = await DB.prepare(
      `SELECT COUNT(*) AS cnt FROM promo_redemptions WHERE promo_id = ? AND user_id = ?`
    ).bind(promo.id, userId).first<{ cnt: number }>().catch(() => ({ cnt: 0 } as { cnt: number }))
    if ((userRedemptions?.cnt ?? 0) >= promo.per_user_limit) {
      return c.json({ success: false, error: `1인당 ${promo.per_user_limit}회 한도 도달`, code: 'LIMIT_REACHED' }, 410)
    }

    return c.json({
      success: true,
      data: {
        promo_id: promo.id,
        code: promo.code,
        seller_id: promo.seller_id,
        discount_pct: promo.discount_pct,
        message: `${promo.discount_pct}% 할인 적용 가능`,
      },
    })
  }
)

export { promoRoutes }
