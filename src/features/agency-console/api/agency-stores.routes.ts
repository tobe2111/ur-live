/**
 * 🏢 에이전시가 맡은 매장 — 목록 · 수락 · 거절 · 내려놓기 · 매장 운영 들어가기 (2단계, 2026-10-11)
 *   마운트: app.route('/api/agency-console', agencyStoresRoutes)
 *
 * 대표 결정(`docs/decisions/2026-10-11-agency-model-email-only.md`):
 *   - 매장은 사람이 아니라 **에이전시**에 붙는다. 그래서 그 에이전시의 직원이면 누구나 맡은 매장을 연다.
 *   - 기간은 없다. 사장님이 언제든 끊는다(`/api/seller/agency-link/end`). 끊긴 다음 요청부터 막힌다.
 *
 * ## 🔐 매장에 들어가는 토큰
 * 셀러 대시보드는 `seller_token` 의 매장 id 로 자동 스코프된다. 그래서 여기서 주는 토큰은 기존 셀러
 * 토큰 모양(`type:'seller'`)이되 **`agency_staff_id` · `agency_id` 를 싣는다.** `store-seat-guard` 가
 * 그 claim 을 보고 매 요청 (맡김 active · 직원 active · 에이전시 active · 토큰이 직원 변경 뒤 발급분)을
 * 다시 본다. 역할은 언제나 `operator` 이고, 소비자 사람이 없으므로 **매장 주인으로 되짚는 모든 폴백이
 * 이 토큰을 거절한다**(`resolveTokenActorUserId`·`resolveStoreActor` — 가드 테스트가 고정).
 *
 * ## 💰 돈은 안 움직인다
 * 에이전시 몫·정산 분기는 3단계(머니 경로 — staging 실결제 뒤). 여기는 운영 권한만 연다.
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { sign } from 'hono/jwt'
import { notifyUser } from '@/lib/notifications'
import { isSeatableStoreStatus } from '@/shared/seller-status'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'
import { invalidateStoreSeatCache } from '@/worker/utils/store-seat-guard'
import { ensureAgencyConsoleTables, AGENCY_STORE_INVITE_DAYS, staffStoreAccessSql } from './agency-schema'
import { requireAgencyStaff, newLinkToken, type AgencyStaffContext } from './agency-session'
import { frontendBase } from './agency-auth.routes'
import { registerAgencyStoreRegisterRoute } from './agency-store-register'
import { registerStaffStoreRoutes } from './agency-staff-stores'
import { agencyStoreToday } from './agency-store-today'
import { registerAgencyNotificationRoutes } from './agency-store-notifications'
import { releaseAgencyProducts } from './channel-sales'
import { registerAgencySalesRoute } from './agency-store-sales'
import { registerAgencyPayoutRoutes } from './agency-payout.routes' // 💸 2026-11-01 에이전시 몫 지급(게이트 OFF)

type Bindings = { DB: D1Database; JWT_SECRET: string; FRONTEND_URL?: string }
type Vars = { agencyStaff: AgencyStaffContext }
type Ctx = Context<{ Bindings: Bindings; Variables: Vars }>

export const agencyStoresRoutes = new Hono<{ Bindings: Bindings; Variables: Vars }>()

/** 에이전시 직원이 매장에 들어가는 토큰의 수명 — 직원 토큰(7일)과 같다. 매 요청 DB 로 다시 보므로 길어도 안전하다. */
export const AGENCY_SEAT_TTL_SEC = 7 * 24 * 60 * 60

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

// ── 맡은 매장 목록 (모든 직원) ──────────────────────────────────────────────
agencyStoresRoutes.get('/stores', requireAgencyStaff(), async (c) => {
  try {
    const me = c.get('agencyStaff')
    await ensureAgencyConsoleTables(c.env.DB)
    const { results } = await c.env.DB.prepare(
      `SELECT l.id, l.seller_id, l.status, l.created_at, l.accepted_at,
              s.business_name, s.name AS seller_name, s.username, s.status AS store_status
         FROM agency_store_links l
         JOIN agency_staff me ON me.id = ? AND me.agency_id = l.agency_id
         LEFT JOIN sellers s ON s.id = l.seller_id
        WHERE l.agency_id = ? AND l.status IN ('pending','active')
          AND ${staffStoreAccessSql('me', 'l.seller_id')}
        ORDER BY CASE l.status WHEN 'pending' THEN 0 ELSE 1 END, l.id DESC
        LIMIT 200`,
    ).bind(me.staffId, me.agencyId).all<{
      id: number; seller_id: number; status: string; created_at: string; accepted_at: string | null
      business_name: string | null; seller_name: string | null; username: string | null; store_status: string | null
    }>()
    // 🔢 판 머리의 오늘 숫자 — 운영 중인 매장만 센다(맡김 요청 단계는 아직 우리 매장이 아니다).
    const today = await agencyStoreToday(c.env.DB, (results || []).filter((r) => r.status === 'active').map((r) => r.seller_id), me.agencyId)
    return c.json({
      success: true,
      stores: (results || []).map((r) => ({
        today: r.status === 'active' ? today.get(r.seller_id) ?? null : null,
        linkId: r.id,
        sellerId: r.seller_id,
        status: r.status === 'active' ? 'active' : 'pending',
        name: r.business_name || r.seller_name || r.username || `매장 ${r.seller_id}`,
        storeStatus: r.store_status,
        requestedAt: r.created_at,
        acceptedAt: r.accepted_at,
      })),
      canManage: me.role === 'admin',
    })
  } catch (err) {
    return safeError(c, err, '맡은 매장을 불러오지 못했어요', '[agency-console:stores]')
  }
})

/** 관리자만 — 맡김 요청을 받거나·거절하거나·내려놓는다. 대상 행은 **반드시 우리 에이전시 것**. */
async function decide(
  c: Ctx,
  from: 'pending' | 'active',
  to: 'active' | 'declined' | 'ended',
) {
  const me = c.get('agencyStaff')
  const linkId = posInt(c.req.param('linkId'))
  if (!linkId) return c.json({ success: false, error: '잘못된 요청이에요.' }, 400)
  const DB = c.env.DB
  const row = await DB.prepare(
    'SELECT id, seller_id, requested_by_user_id FROM agency_store_links WHERE id = ? AND agency_id = ? AND status = ? LIMIT 1',
  ).bind(linkId, me.agencyId, from).first<{ id: number; seller_id: number; requested_by_user_id: number | null }>()
  if (!row) return c.json({ success: false, error: '이미 처리된 요청이에요.' }, 409)
  const set = to === 'active'
    ? "status = 'active', accepted_at = datetime('now'), decided_by_staff_id = ?"
    : to === 'declined'
      ? "status = 'declined', ended_at = datetime('now'), decided_by_staff_id = ?"
      : "status = 'ended', ended_at = datetime('now'), ended_by = 'agency', ended_by_id = ?"
  // CAS — 같은 요청을 두 직원이 동시에 눌러도 한 번만 바뀐다.
  const r = await DB.prepare(
    `UPDATE agency_store_links SET ${set}, updated_at = datetime('now') WHERE id = ? AND agency_id = ? AND status = ?`,
  ).bind(me.staffId, linkId, me.agencyId, from).run()
  if ((r.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '이미 처리된 요청이에요.' }, 409)
  // 📊 내려놓으면 우리 이용권은 사장님께 돌아간다 — 그동안의 판매는 맡은 기간 기록에 남아 우리 성과로 계속 보인다.
  if (to === 'ended') { await releaseAgencyProducts(DB, row.seller_id, me.agencyId); invalidateStoreSeatCache(DB, row.seller_id) }
  return { row }
}

async function agencyName(DB: D1Database, agencyId: number): Promise<string> {
  const a = await DB.prepare('SELECT name FROM agency_accounts WHERE id = ? LIMIT 1').bind(agencyId).first<{ name: string }>()
  return a?.name || '에이전시'
}

agencyStoresRoutes.post('/stores/:linkId/accept', cors(), requireAgencyStaff({ adminOnly: true }), async (c) => {
  try {
    const d = await decide(c, 'pending', 'active')
    if (d instanceof Response) return d
    const name = await agencyName(c.env.DB, c.get('agencyStaff').agencyId)
    if (d.row.requested_by_user_id) {
      await notifyUser(c.env.DB, String(d.row.requested_by_user_id), 'agency_link_accepted',
        '에이전시가 매장 운영을 맡았어요', `${name} 에이전시가 운영을 시작합니다. 언제든 셀러 화면에서 끊을 수 있어요.`,
        '/seller/operators').catch(() => {})
    }
    return c.json({ success: true, message: '매장을 맡았어요.' })
  } catch (err) {
    return safeError(c, err, '처리 중 오류가 발생했어요', '[agency-console:accept]')
  }
})

agencyStoresRoutes.post('/stores/:linkId/decline', cors(), requireAgencyStaff({ adminOnly: true }), async (c) => {
  try {
    const d = await decide(c, 'pending', 'declined')
    if (d instanceof Response) return d
    const name = await agencyName(c.env.DB, c.get('agencyStaff').agencyId)
    if (d.row.requested_by_user_id) {
      await notifyUser(c.env.DB, String(d.row.requested_by_user_id), 'agency_link_declined',
        '에이전시가 맡김 요청을 거절했어요', `${name} 에이전시가 이번 요청을 받지 않았어요.`, '/seller/operators').catch(() => {})
    }
    return c.json({ success: true, message: '요청을 거절했어요.' })
  } catch (err) {
    return safeError(c, err, '처리 중 오류가 발생했어요', '[agency-console:decline]')
  }
})

agencyStoresRoutes.post('/stores/:linkId/release', cors(), requireAgencyStaff({ adminOnly: true }), async (c) => {
  try {
    const d = await decide(c, 'active', 'ended')
    if (d instanceof Response) return d
    const name = await agencyName(c.env.DB, c.get('agencyStaff').agencyId)
    if (d.row.requested_by_user_id) {
      await notifyUser(c.env.DB, String(d.row.requested_by_user_id), 'agency_link_released',
        '에이전시가 매장 운영을 내려놓았어요', `${name} 에이전시가 더 이상 이 매장을 운영하지 않아요.`, '/seller/operators').catch(() => {})
    }
    return c.json({ success: true, message: '매장 운영을 내려놓았어요.' })
  } catch (err) {
    return safeError(c, err, '처리 중 오류가 발생했어요', '[agency-console:release]')
  }
})

// ── 매장 운영 들어가기 (모든 직원) — 셀러 대시보드용 좌석 토큰 ─────────────────────
agencyStoresRoutes.post('/stores/:sellerId/seat', cors(), requireAgencyStaff(),
  rateLimit({ action: 'agency_store_seat', max: 30, windowSec: 300 }), async (c) => {
    try {
      const me = c.get('agencyStaff')
      const sellerId = posInt(c.req.param('sellerId'))
      if (!sellerId) return c.json({ success: false, error: '잘못된 매장이에요.' }, 400)
      const DB = c.env.DB
      // 🔐 유일한 방어선 — 경로의 sellerId 는 '요청'일 뿐, 우리 에이전시에 active 로 맡겨진 매장인지 본다.
      const link = await DB.prepare(
        "SELECT id FROM agency_store_links WHERE seller_id = ? AND agency_id = ? AND status = 'active' LIMIT 1",
      ).bind(sellerId, me.agencyId).first<{ id: number }>()
      if (!link) return c.json({ success: false, error: '우리 에이전시가 맡은 매장이 아니에요.' }, 403)
      // 👥 직원 배정 — 매 요청 판정(`liveAgencySeat`)과 같은 문장이다. 여기서 막아야 들어가자마자 401 로 튕기지 않는다.
      const allowed = await DB.prepare(
        `SELECT 1 AS ok FROM agency_staff s WHERE s.id = ? AND s.agency_id = ? AND ${staffStoreAccessSql('s', '?')} LIMIT 1`,
      ).bind(me.staffId, me.agencyId, sellerId).first<{ ok: number }>()
      if (!allowed) return c.json({ success: false, code: 'STORE_NOT_ASSIGNED', error: '관리자가 이 매장을 배정하지 않았어요.' }, 403)
      const seller = await DB.prepare(
        'SELECT id, email, name, status, seller_type, is_distributor, business_name, username FROM sellers WHERE id = ? LIMIT 1',
      ).bind(sellerId).first<{
        id: number; email: string | null; name: string | null; status: string
        seller_type: string | null; is_distributor: number | null; business_name: string | null; username: string | null
      }>()
      if (!seller) return c.json({ success: false, error: '매장을 찾을 수 없어요.' }, 404)
      if (!isSeatableStoreStatus(seller.status)) return c.json({ success: false, error: '이용이 정지된 매장이에요.' }, 403)

      const iat = Math.floor(Date.now() / 1000)
      const token = await sign({
        sub: String(seller.id),
        seller_id: seller.id,
        email: seller.email || '',
        name: seller.name || '',
        type: 'seller',
        seller_type: seller.seller_type || 'influencer',
        is_distributor: seller.is_distributor ? 1 : 0,
        store_role: 'operator',
        agency_staff_id: me.staffId,
        agency_id: me.agencyId,
        iat,
        exp: iat + AGENCY_SEAT_TTL_SEC,
      }, c.env.JWT_SECRET)
      return c.json({
        success: true,
        data: {
          seller_token: token,
          seller: {
            id: seller.id, username: seller.username, status: seller.status,
            business_name: seller.business_name, is_distributor: seller.is_distributor ? 1 : 0,
          },
          agency_name: await agencyName(DB, me.agencyId),
        },
      })
    } catch (err) {
      return safeError(c, err, '매장에 들어가지 못했어요', '[agency-console:seat]')
    }
  })

// ── 🔗 매장 초대 링크 (관리자) — 에이전시가 사장님께 카톡으로 보내는 링크 ─────────────────
//   링크를 만든 것 자체가 에이전시의 수락이다 → 사장님이 [맡기기] 를 누르면 요청 단계 없이 바로 운영 시작.
//   에이전시당 살아 있는 링크는 하나 — 새로 만들면 옛 링크는 그 순간 끊긴다(잘못 퍼진 링크를 거둘 방법).
export function storeInviteUrl(env: { FRONTEND_URL?: string }, token: string): string {
  return `${frontendBase(env)}/store/agency/${token}`
}

// 🔗 2026-10-31 대표 *"모두 진행해줘"* — 읽기는 **직원도** 한다. 매장에 찾아가는 사람은 대개 직원이다.
//   만들기·끊기는 관리자만(링크가 에이전시당 하나라 직원이 새로 만들면 다른 직원이 보낸 링크가 죽는다).
agencyStoresRoutes.get('/store-invite', requireAgencyStaff(), async (c) => {
  try {
    const me = c.get('agencyStaff')
    await ensureAgencyConsoleTables(c.env.DB)
    const row = await c.env.DB.prepare(
      `SELECT token, expires_at, use_count FROM agency_store_invites
        WHERE agency_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')
        ORDER BY id DESC LIMIT 1`,
    ).bind(me.agencyId).first<{ token: string; expires_at: string; use_count: number }>()
    const ag = await c.env.DB.prepare('SELECT name FROM agency_accounts WHERE id = ? LIMIT 1')
      .bind(me.agencyId).first<{ name: string | null }>().catch(() => null)
    return c.json({
      success: true,
      agencyName: ag?.name || '',
      invite: row ? { url: storeInviteUrl(c.env, row.token), expiresAt: row.expires_at, useCount: row.use_count } : null,
    })
  } catch (err) {
    return safeError(c, err, '초대 링크를 불러오지 못했어요', '[agency-console:store-invite]')
  }
})

agencyStoresRoutes.post('/store-invite', cors(), requireAgencyStaff({ adminOnly: true }),
  rateLimit({ action: 'agency_store_invite', max: 20, windowSec: 3600 }), async (c) => {
    try {
      const me = c.get('agencyStaff')
      const DB = c.env.DB
      await ensureAgencyConsoleTables(DB)
      const token = newLinkToken()
      await DB.batch([
        DB.prepare("UPDATE agency_store_invites SET revoked_at = datetime('now') WHERE agency_id = ? AND revoked_at IS NULL").bind(me.agencyId),
        DB.prepare(
          `INSERT INTO agency_store_invites (agency_id, token, created_by_staff_id, expires_at)
           VALUES (?, ?, ?, datetime('now', '+${AGENCY_STORE_INVITE_DAYS} days'))`,
        ).bind(me.agencyId, token, me.staffId),
      ])
      return c.json({ success: true, invite: { url: storeInviteUrl(c.env, token), useCount: 0 }, message: '새 초대 링크를 만들었어요. 예전 링크는 이제 쓸 수 없어요.' })
    } catch (err) {
      return safeError(c, err, '초대 링크를 만들지 못했어요', '[agency-console:store-invite]')
    }
  })

agencyStoresRoutes.post('/store-invite/revoke', cors(), requireAgencyStaff({ adminOnly: true }), async (c) => {
  try {
    const me = c.get('agencyStaff')
    await ensureAgencyConsoleTables(c.env.DB)
    await c.env.DB.prepare("UPDATE agency_store_invites SET revoked_at = datetime('now') WHERE agency_id = ? AND revoked_at IS NULL")
      .bind(me.agencyId).run()
    return c.json({ success: true, message: '초대 링크를 끊었어요.' })
  } catch (err) {
    return safeError(c, err, '처리 중 오류가 발생했어요', '[agency-console:store-invite]')
  }
})

// 🏢 매장 대신 등록(2026-10-11 대표 "모두 다 하자") — POST /stores/register. 본문은 형제 파일.
registerAgencyStoreRegisterRoute(agencyStoresRoutes)
// 👥 직원별 매장 배정 — GET/PUT /staff/:id/stores. 본문은 형제 파일.
registerStaffStoreRoutes(agencyStoresRoutes)
// 🔔 맡은 매장들의 판매 알림(2026-10-12) — GET /notifications · POST /notifications/read. 본문은 형제 파일.
registerAgencyNotificationRoutes(agencyStoresRoutes)
// 📊 우리 이용권 판매 내역·통계(2026-10-24) — GET /stores/:sellerId/sales. 본문은 형제 파일.
registerAgencySalesRoute(agencyStoresRoutes)
registerAgencyPayoutRoutes(agencyStoresRoutes)
