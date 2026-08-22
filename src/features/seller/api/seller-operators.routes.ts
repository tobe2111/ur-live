/**
 * 🏪 매장 운영 주체(operator) — 여러 매장 운영 + 운영자 관리
 *   설계 SSOT: `docs/design/store-operator-model.md` (2026-08-19 대표 확정, 2단계)
 *
 * 마운트: `/api/seller`
 *   GET  /my-stores                  — 내가 운영할 수 있는 매장 목록(소유 + 위임)
 *   POST /stores/:sellerId/token     — 🔐 그 매장의 seller_token 발급(= 매장 전환)
 *   GET  /operators                  — 현재 매장의 운영자 목록 (소유자만)
 *   POST /operators                  — 운영자 추가 (소유자만) {handle | email}
 *   POST /operators/:userId/revoke   — 운영자 회수 (소유자만, 조건 없이)
 *
 * ## 🔐 왜 토큰 발급이 유일한 방어선인가
 * 셀러 대시보드의 모든 라우트는 `seller_token` 의 `seller_id`/`sub` 로 **자동 스코프**된다.
 * 즉 다른 매장의 토큰을 받는 순간 그 매장의 주문·정산·상품이 전부 열린다.
 * ⇒ `POST /stores/:sellerId/token` 의 `canOperateStore` 검사가 뚫리면 IDOR 이다.
 *    클라이언트가 보낸 값은 **어떤 것도** 권한 근거로 쓰지 않는다(경로의 sellerId 는 '요청'일 뿐).
 *
 * ## 💰 돈은 안 움직인다
 * 정산 목적지는 `sellers.bank_account` 그대로다. 운영자는 **볼 수 있는 매장**이 늘 뿐,
 * 정산 귀속을 못 바꾼다. 사업자정보·정산계좌 편집은 3단계에서 소유자 전용으로 분리한다.
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import { sign as jwtSign } from 'hono/jwt'
import type { Env } from '@/worker/types/env'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { parseSessionCookie } from '@/worker/utils/session'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { startDashboardSession } from '@/worker/utils/dashboard-session'
import { notifyUser } from '@/lib/notifications'
import {
  listOperableStores,
  canOperateStore,
  isStoreOwner,
  grantOperator,
  revokeOperator,
  listStoreOperators,
} from '../../../worker/utils/seller-operators'

const app = new Hono<{ Bindings: Env }>()

/**
 * 요청자의 **소비자 정체성**(`users.id`)을 확정한다. 이게 권한 판정의 유일한 주체다.
 *
 * 두 경로를 받는다:
 *   ① 소비자 세션 쿠키(카카오) — 가장 곧은 신호
 *   ② seller_token — 이미 어떤 매장의 유효한 토큰을 쥔 사람. 그 매장의 `linked_user_id` 로 되짚는다.
 *      (②가 없으면 이메일/비번으로만 로그인한 겸업 사장님이 매장 전환을 못 한다.)
 *
 * ⚠️ 클라이언트가 보낸 user_id 는 **절대** 신뢰하지 않는다.
 */
type Ctx = Context<{ Bindings: Env }>

async function resolveActorUserId(c: Ctx): Promise<number | null> {
  const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user']).catch(() => null)
  if (sess?.userId != null) {
    const id = Number(sess.userId)
    if (Number.isFinite(id) && id > 0) return id
  }
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (sellerId) {
    const row = await c.env.DB.prepare('SELECT linked_user_id FROM sellers WHERE id = ? LIMIT 1')
      .bind(sellerId).first<{ linked_user_id: number | null }>().catch(() => null)
    const id = Number(row?.linked_user_id)
    if (Number.isFinite(id) && id > 0) return id
  }
  return null
}

// ── GET /my-stores ────────────────────────────────────────────────────────
app.get('/my-stores', async (c) => {
  try {
    const userId = await resolveActorUserId(c)
    if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const stores = await listOperableStores(c.env.DB, userId)
    return c.json({ success: true, data: stores })
  } catch (err) {
    return safeError(c, err, '매장 목록을 불러오지 못했습니다', '[seller-operators]')
  }
})

// ── POST /stores/:sellerId/token — 🔐 매장 전환 (보안 급소) ─────────────────
app.post('/stores/:sellerId/token', rateLimit({ action: 'seller_store_switch', max: 30, windowSec: 300 }), async (c) => {
  try {
    const userId = await resolveActorUserId(c)
    if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

    const sellerId = Number(c.req.param('sellerId'))
    if (!Number.isFinite(sellerId) || sellerId <= 0) {
      return c.json({ success: false, error: '잘못된 매장입니다' }, 400)
    }

    // 🔐 유일한 방어선 — 여기를 통과하면 그 매장 전부가 열린다.
    const access = await canOperateStore(c.env.DB, userId, sellerId)
    if (!access.ok) return c.json({ success: false, error: '이 매장에 대한 권한이 없습니다' }, 403)

    const seller = await c.env.DB.prepare(
      `SELECT id, email, name, status, seller_type, is_distributor, business_name, username
         FROM sellers WHERE id = ? LIMIT 1`
    ).bind(sellerId).first<{
      id: number; email: string; name: string; status: string
      seller_type: string; is_distributor: number; business_name: string | null; username: string | null
    }>().catch(() => null)
    if (!seller) return c.json({ success: false, error: '매장을 찾을 수 없습니다' }, 404)
    // 승인 안 된 매장은 대시보드를 열지 않는다(기존 로그인 규칙과 동일 — 'approved' 는 레거시 활성).
    if (seller.status !== 'active' && seller.status !== 'approved') {
      return c.json({ success: false, error: '승인 대기 중이거나 이용이 정지된 매장입니다' }, 403)
    }

    const iat = Math.floor(Date.now() / 1000)
    const payload: Record<string, unknown> = {
      sub: String(seller.id),
      seller_id: seller.id,
      email: seller.email,
      name: seller.name,
      type: 'seller',
      seller_type: seller.seller_type || 'influencer',
      is_distributor: seller.is_distributor ? 1 : 0,
      iat,
      exp: iat + 30 * 24 * 60 * 60,
    }
    // 🪑 소유자가 아니라 **위임받아 들어가는** 경우에만 별도 시트를 준다.
    //   안 그러면 시트가 ('seller', 매장id) 라 운영자가 들어가는 순간 **사장님이 튕긴다**.
    //   소유자 본인은 기존 시트를 그대로 써야 기존 단일 세션 규칙이 유지된다.
    if (access.source === 'grant') payload.operator_user_id = userId

    const token = await jwtSign(payload, c.env.JWT_SECRET)
    const seat = access.source === 'grant'
      ? { role: 'seller_operator', id: userId }
      : { role: 'seller', id: seller.id }
    await startDashboardSession(c.env.DB, seat.role, seat.id, iat).catch(() => {})

    return c.json({
      success: true,
      data: {
        seller_token: token,
        seller: {
          id: seller.id, username: seller.username, status: seller.status,
          business_name: seller.business_name, is_distributor: seller.is_distributor ? 1 : 0,
        },
        role: access.role,
      },
    })
  } catch (err) {
    return safeError(c, err, '매장 전환 중 오류가 발생했습니다', '[seller-operators]')
  }
})

// ── 아래 3개는 **현재 매장의 소유자**만 ────────────────────────────────────
async function requireOwnerOfCurrentStore(c: Ctx): Promise<{ userId: number; sellerId: number } | Response> {
  const userId = await resolveActorUserId(c)
  if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
  if (!(await isStoreOwner(c.env.DB, userId, sellerId))) {
    // 운영자는 다른 운영자를 부르거나 자를 수 없다 — 권한 확산 방지.
    return c.json({ success: false, error: '매장 소유자만 운영자를 관리할 수 있습니다' }, 403)
  }
  return { userId, sellerId }
}

// ── GET /operators ────────────────────────────────────────────────────────
app.get('/operators', async (c) => {
  try {
    const g = await requireOwnerOfCurrentStore(c)
    if (g instanceof Response) return g
    return c.json({ success: true, data: await listStoreOperators(c.env.DB, g.sellerId) })
  } catch (err) {
    return safeError(c, err, '운영자 목록을 불러오지 못했습니다', '[seller-operators]')
  }
})

// ── POST /operators — 운영자 추가 ──────────────────────────────────────────
app.post('/operators', rateLimit({ action: 'seller_operator_grant', max: 20, windowSec: 3600 }), async (c) => {
  try {
    const g = await requireOwnerOfCurrentStore(c)
    if (g instanceof Response) return g
    const body = await c.req.json<{ handle?: string; email?: string }>().catch(() => ({} as any))
    const handle = typeof body.handle === 'string' ? body.handle.trim().replace(/^@/, '') : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    if (!handle && !email) return c.json({ success: false, error: '핸들 또는 이메일을 입력해주세요' }, 400)
    if (handle.length > 60 || email.length > 255) return c.json({ success: false, error: '입력이 너무 깁니다' }, 400)

    const target = handle
      ? await c.env.DB.prepare('SELECT id, name, handle FROM users WHERE handle = ? LIMIT 1')
          .bind(handle).first<{ id: number; name: string; handle: string }>().catch(() => null)
      : await c.env.DB.prepare('SELECT id, name, handle FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1')
          .bind(email).first<{ id: number; name: string; handle: string }>().catch(() => null)
    if (!target) return c.json({ success: false, error: '해당 사용자를 찾을 수 없습니다. 유어딜 가입 후 다시 시도해주세요' }, 404)
    if (target.id === g.userId) return c.json({ success: false, error: '본인은 이미 이 매장의 소유자입니다' }, 400)

    const r = await grantOperator(c.env.DB, g.sellerId, target.id, g.userId, 'operator')
    if (!r.ok) return c.json({ success: false, error: '운영자 추가에 실패했습니다' }, 500)

    // 초대받은 사람이 모르면 아무 일도 안 일어난다 — 알림은 fail-soft.
    await notifyUser(
      c.env.DB, String(target.id), 'store_operator_granted',
      '매장 운영 권한을 받았어요',
      '셀러 대시보드에서 매장을 전환해 운영할 수 있습니다.',
      '/seller',
    ).catch(() => {})

    return c.json({ success: true, data: { user_id: target.id, name: target.name, handle: target.handle } })
  } catch (err) {
    return safeError(c, err, '운영자 추가 중 오류가 발생했습니다', '[seller-operators]')
  }
})

// ── POST /operators/:userId/revoke — 회수(조건 없이) ────────────────────────
app.post('/operators/:userId/revoke', async (c) => {
  try {
    const g = await requireOwnerOfCurrentStore(c)
    if (g instanceof Response) return g
    const targetId = Number(c.req.param('userId'))
    if (!Number.isFinite(targetId) || targetId <= 0) return c.json({ success: false, error: '잘못된 사용자입니다' }, 400)
    const r = await revokeOperator(c.env.DB, g.sellerId, targetId)
    if (!r.ok) return c.json({ success: false, error: '회수에 실패했습니다' }, 500)
    return c.json({ success: true, data: { revoked: r.changed } })
  } catch (err) {
    return safeError(c, err, '운영자 회수 중 오류가 발생했습니다', '[seller-operators]')
  }
})

export { app as sellerOperatorsRoutes }
