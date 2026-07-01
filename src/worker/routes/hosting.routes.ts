/**
 * 🛡️ 2026-05-25 (migration 0280): 호스팅 API — Phase 3.
 *
 * 누구나 어드민 카탈로그 voucher 상품의 공구를 본인 이름으로 모집.
 * 호스트 = host_user_id, 친구가 invite_code 로 참여 → 호스트 인센티브 적립.
 *
 * 엔드포인트:
 *   GET  /api/hosting/catalog                 — 어드민 voucher 카탈로그 (host 가능)
 *   POST /api/hosting/me                      — 호스팅 시작 (1탭)
 *   GET  /api/hosting/me                      — 본인 호스팅 목록 + 통계
 *   GET  /api/hosting/me/:id                  — 호스팅 상세 + 참여자
 *   PATCH /api/hosting/me/:id/cancel          — 호스팅 취소
 *   GET  /api/hosting/g/:invite_code          — 초대 링크 진입 (public)
 *
 * 영구 룰:
 *   - 알리아스 @/ 금지 → 상대경로
 *   - safeError + requireUserType
 *   - invite_code = SHA256 hex 앞 8자 (CURATOR_DEFAULTS.INVITE_CODE_LEN)
 *   - UNIQUE(host_user_id, product_id) — 같은 공구 중복 호스팅 X
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requireAuth } from '../middleware/auth'
import { safeError } from '../utils/safe-error'
import { HOSTING_DEFAULTS } from '../../shared/constants/policy'
import { intParam } from '@/shared/pagination'

const hostingRoutes = new Hono<{ Bindings: Env }>()

function getAuthUserId(c: any): number | null {
  // 🛡️ 2026-05-25 fix: auth middleware 는 c.set('user', { id, ... }) 패턴
  const user = c.get?.('user')
  const raw = user?.id ?? c.get?.('userId') ?? c.get?.('userIdNumber')
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * 🛡️ 2026-05-25: hosting 관련 테이블 보장 — D1 migration 미적용 환경 대응.
 *   첫 호출 시 lazy CREATE. idempotent (IF NOT EXISTS).
 * 🏁 2026-06-11 (응답 경로 부수효과 전수조사): 모듈 메모이즈 추가 — 매 요청 DDL 3왕복이
 *   user-facing /catalog, /me 응답에 끼던 것 제거. 성공 시에만 플래그 set (curator 패턴) —
 *   실패하면 다음 요청이 재시도. 콜드 1회 동작은 기존과 동일.
 */
let _hostingTablesReady = false
async function ensureHostingTables(DB: D1Database): Promise<void> {
  if (_hostingTablesReady) return
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS group_buy_hosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      host_user_id INTEGER NOT NULL,
      invite_code TEXT NOT NULL,
      target_quantity INTEGER NOT NULL DEFAULT 5,
      current_quantity INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      deadline_at DATETIME,
      note TEXT,
      total_earnings INTEGER NOT NULL DEFAULT 0,
      achieved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(host_user_id, product_id)
    )`).run()
    await DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_gbh_invite_code ON group_buy_hosts(invite_code)`).run().catch(() => null)
    await DB.prepare(`CREATE TABLE IF NOT EXISTS group_buy_host_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 1,
      earnings INTEGER NOT NULL DEFAULT 0,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(host_id, user_id)
    )`).run().catch(() => null)
    _hostingTablesReady = true // 성공 시에만 — 실패하면 다음 요청 재시도
  } catch { /* graceful */ }
}

async function generateInviteCode(DB: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    // 8자 hex
    const bytes = new Uint8Array(HOSTING_DEFAULTS.INVITE_CODE_LEN / 2)
    crypto.getRandomValues(bytes)
    const code = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const exists = await DB.prepare('SELECT 1 FROM group_buy_hosts WHERE invite_code = ? LIMIT 1')
      .bind(code).first().catch(() => null)
    if (!exists) return code
  }
  // fallback
  return Date.now().toString(36).slice(-HOSTING_DEFAULTS.INVITE_CODE_LEN)
}

// ============================================================
// GET /api/hosting/catalog (requireUser)
// 어드민 voucher 카탈로그 — 호스팅 가능한 상품 목록.
// ============================================================
hostingRoutes.get('/catalog', requireAuth(), async (c) => {
  try {
    const limit = Math.max(10, Math.min(100, intParam(c.req.query('limit'), 30)))
    const category = String(c.req.query('category') || '').trim()
    const userId = getAuthUserId(c)

    // 🛡️ 2026-05-25: 테이블 lazy CREATE (D1 migration 미적용 환경 graceful)
    await ensureHostingTables(c.env.DB)

    // voucher 카테고리만 (`marketing.routes.ts:698` 의 validCats 와 일치)
    const validCats = ['meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher']
    const catFilter = validCats.includes(category) ? ' AND p.category = ?' : ''
    const params: any[] = []
    if (catFilter) params.push(category)
    params.push(limit)

    // 🛡️ subquery 가 fail 해도 catalog 자체는 응답 — graceful 2-step.
    const { results } = await c.env.DB.prepare(
      `SELECT p.id, p.name, p.price, p.original_price, p.category, p.image_url, p.thumbnail,
              p.group_buy_target, p.group_buy_current, p.group_buy_status,
              p.restaurant_name,
              (SELECT id FROM group_buy_hosts WHERE host_user_id = ? AND product_id = p.id LIMIT 1) AS my_host_id
       FROM products p
       WHERE p.is_active = 1
         AND p.category LIKE '%_voucher'
         ${catFilter}
       ORDER BY p.created_at DESC
       LIMIT ?`,
    ).bind(userId, ...params).all().catch(async () => {
      // subquery 실패 fallback — my_host_id 없이 응답
      return await c.env.DB.prepare(
        `SELECT p.id, p.name, p.price, p.original_price, p.category, p.image_url, p.thumbnail,
                p.group_buy_target, p.group_buy_current, p.group_buy_status, p.restaurant_name,
                NULL AS my_host_id
         FROM products p
         WHERE p.is_active = 1 AND p.category LIKE '%_voucher' ${catFilter}
         ORDER BY p.created_at DESC LIMIT ?`,
      ).bind(...params).all()
    })

    return c.json({ success: true, catalog: results ?? [] })
  } catch (err) {
    return safeError(c, err, '카탈로그 조회 중 오류가 발생했습니다', '[hosting:catalog]')
  }
})

// ============================================================
// POST /api/hosting/me (requireUser) — 호스팅 시작 (1탭)
// Body: { product_id, target_quantity?, note?, deadline_at? }
// ============================================================
hostingRoutes.post('/me', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    await ensureHostingTables(c.env.DB)

    const body = await c.req.json<{ product_id?: number; target_quantity?: number; note?: string; deadline_at?: string }>().catch(() => ({} as any))
    const productId = Number(body.product_id)
    if (!Number.isFinite(productId) || productId <= 0) {
      return c.json({ success: false, error: '상품 ID 가 잘못되었습니다' }, 400)
    }
    const target = Math.max(
      HOSTING_DEFAULTS.MIN_TARGET,
      Math.min(HOSTING_DEFAULTS.MAX_TARGET, Number(body.target_quantity) || 5),
    )
    const note = body.note ? String(body.note).slice(0, HOSTING_DEFAULTS.NOTE_MAX_LEN) : null

    const DB = c.env.DB

    // 상품 + voucher 카테고리 검증
    const product = await DB.prepare(
      `SELECT id, name, category, is_active FROM products WHERE id = ? LIMIT 1`,
    ).bind(productId).first<{ id: number; name: string; category: string; is_active: number }>()
    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
    if (!product.is_active) return c.json({ success: false, error: '비활성 상품은 호스팅 불가' }, 400)
    if (!product.category?.endsWith('_voucher')) {
      return c.json({ success: false, error: 'voucher 카테고리만 호스팅 가능합니다' }, 400)
    }

    // active 호스팅 개수 상한
    const activeCount = await DB.prepare(
      `SELECT COUNT(*) AS cnt FROM group_buy_hosts WHERE host_user_id = ? AND status = 'active'`,
    ).bind(userId).first<{ cnt: number }>()
    if ((activeCount?.cnt ?? 0) >= HOSTING_DEFAULTS.MAX_ACTIVE_HOSTINGS) {
      return c.json({
        success: false,
        error: `동시 활성 호스팅은 최대 ${HOSTING_DEFAULTS.MAX_ACTIVE_HOSTINGS}개입니다`,
      }, 400)
    }

    const inviteCode = await generateInviteCode(DB)
    const deadline = body.deadline_at && /^\d{4}-\d{2}-\d{2}/.test(body.deadline_at)
      ? body.deadline_at
      : new Date(Date.now() + HOSTING_DEFAULTS.DEFAULT_DEADLINE_DAYS * 86400_000).toISOString()

    try {
      const result = await DB.prepare(
        `INSERT INTO group_buy_hosts (product_id, host_user_id, invite_code, target_quantity, note, deadline_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(productId, userId, inviteCode, target, note, deadline).run()

      return c.json({
        success: true,
        host: {
          id: result.meta.last_row_id,
          product_id: productId,
          host_user_id: userId,
          invite_code: inviteCode,
          target_quantity: target,
          deadline_at: deadline,
          note,
          status: 'active',
        },
        invite_url: `/g/${inviteCode}`,
      })
    } catch (e: any) {
      if (String(e?.message || e).includes('UNIQUE')) {
        return c.json({ success: false, error: '이미 호스팅 중인 상품입니다', code: 'ALREADY_HOSTING' }, 409)
      }
      throw e
    }
  } catch (err) {
    return safeError(c, err, '호스팅 시작 중 오류가 발생했습니다', '[hosting:start]')
  }
})

// ============================================================
// GET /api/hosting/me (requireUser) — 본인 호스팅 목록 + 통계
// ============================================================
hostingRoutes.get('/me', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)

    const { results: hosts } = await c.env.DB.prepare(
      `SELECT gbh.id, gbh.product_id, gbh.invite_code, gbh.target_quantity, gbh.current_quantity,
              gbh.status, gbh.deadline_at, gbh.note, gbh.total_earnings, gbh.created_at,
              p.name AS product_name, p.image_url, p.thumbnail, p.price, p.category
       FROM group_buy_hosts gbh
       JOIN products p ON p.id = gbh.product_id
       WHERE gbh.host_user_id = ?
       ORDER BY gbh.created_at DESC
       LIMIT 100`,
    ).bind(userId).all()

    const summary = await c.env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status='achieved' THEN 1 ELSE 0 END) AS achieved,
              SUM(total_earnings) AS total_earnings
       FROM group_buy_hosts WHERE host_user_id = ?`,
    ).bind(userId).first<{ total: number; active: number; achieved: number; total_earnings: number }>()

    return c.json({
      success: true,
      hosts: hosts ?? [],
      summary: summary ?? { total: 0, active: 0, achieved: 0, total_earnings: 0 },
    })
  } catch (err) {
    return safeError(c, err, '호스팅 목록 조회 중 오류가 발생했습니다', '[hosting:me-list]')
  }
})

// ============================================================
// GET /api/hosting/me/:id (requireUser) — 본인 호스팅 상세 + 참여자
// ============================================================
hostingRoutes.get('/me/:id', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const hostId = Number(c.req.param('id'))
    if (!Number.isFinite(hostId)) return c.json({ success: false, error: 'invalid' }, 400)

    const host = await c.env.DB.prepare(
      `SELECT gbh.*, p.name AS product_name, p.image_url, p.thumbnail, p.price, p.category
       FROM group_buy_hosts gbh
       JOIN products p ON p.id = gbh.product_id
       WHERE gbh.id = ? AND gbh.host_user_id = ? LIMIT 1`,
    ).bind(hostId, userId).first<any>()
    if (!host) return c.json({ success: false, error: '호스팅을 찾을 수 없습니다' }, 404)

    const { results: participants } = await c.env.DB.prepare(
      `SELECT gbhp.id, gbhp.user_id, gbhp.quantity, gbhp.earnings, gbhp.joined_at,
              u.name AS user_name, u.profile_image, u.handle
       FROM group_buy_host_participants gbhp
       JOIN users u ON u.id = gbhp.user_id
       WHERE gbhp.host_id = ?
       ORDER BY gbhp.joined_at DESC
       LIMIT 100`,
    ).bind(hostId).all().catch(() => ({ results: [] as any[] }))

    return c.json({ success: true, host, participants: participants ?? [] })
  } catch (err) {
    return safeError(c, err, '호스팅 상세 조회 중 오류가 발생했습니다', '[hosting:detail]')
  }
})

// ============================================================
// PATCH /api/hosting/me/:id/cancel (requireUser)
// ============================================================
hostingRoutes.patch('/me/:id/cancel', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const hostId = Number(c.req.param('id'))
    if (!Number.isFinite(hostId)) return c.json({ success: false, error: 'invalid' }, 400)

    const result = await c.env.DB.prepare(
      `UPDATE group_buy_hosts SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND host_user_id = ? AND status = 'active'`,
    ).bind(hostId, userId).run()

    if (!result.meta.changes) {
      return c.json({ success: false, error: '취소 가능한 호스팅이 없습니다' }, 404)
    }
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '호스팅 취소 중 오류가 발생했습니다', '[hosting:cancel]')
  }
})

// ============================================================
// GET /api/hosting/g/:invite_code (public) — 초대 링크 진입
// 친구가 보는 view — 호스트 정보 + 상품 + 참여 CTA
// ============================================================
hostingRoutes.get('/g/:invite_code', async (c) => {
  try {
    const code = String(c.req.param('invite_code') || '').toLowerCase().trim()
    if (!code || !/^[a-f0-9]{6,16}$/.test(code)) {
      return c.json({ success: false, error: '잘못된 초대 코드' }, 400)
    }

    const host = await c.env.DB.prepare(
      `SELECT gbh.id, gbh.product_id, gbh.host_user_id, gbh.invite_code, gbh.target_quantity,
              gbh.current_quantity, gbh.status, gbh.deadline_at, gbh.note,
              p.name AS product_name, p.image_url, p.thumbnail, p.price, p.original_price, p.category,
              u.handle AS host_handle, u.name AS host_name, u.profile_image AS host_profile
       FROM group_buy_hosts gbh
       JOIN products p ON p.id = gbh.product_id
       JOIN users u ON u.id = gbh.host_user_id
       WHERE gbh.invite_code = ? LIMIT 1`,
    ).bind(code).first<any>()

    if (!host) return c.json({ success: false, error: '초대 코드를 찾을 수 없습니다' }, 404)

    return c.json({ success: true, host })
  } catch (err) {
    return safeError(c, err, '초대 정보 조회 중 오류가 발생했습니다', '[hosting:invite]')
  }
})

export { hostingRoutes }
