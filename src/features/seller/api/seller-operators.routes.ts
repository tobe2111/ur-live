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
import { resolveTokenActorUserId, liveAgencySeatStoreId } from '@/worker/utils/store-seat-guard'
import { agencySeatOf } from '@/worker/utils/agency-product-scope'
import { agencySummary } from '../../agency-console/api/agency-store-today'
import { notifyUser } from '@/lib/notifications'
import { getOrIssueOwnerClaimCode, formatStoreCode } from '@/worker/utils/store-codes'
import { readBrokerTerms } from '@/worker/utils/broker-share'
import { isSeatableStoreStatus } from '@/shared/seller-status'
import { shippingOrderSql } from '@/shared/db/shipping-order-sql'
import { allInChunks } from '@/worker/utils/d1-in-chunks'
import {
  MAX_OPERABLE_STORES,
  listOperableStores,
  canOperateStore,
  isStoreOwner,
  grantOperator,
  revokeOperator,
  listStoreOperators,
  resolveStoreOwnerUserId,
} from '../../../worker/utils/seller-operators'
import { registerAgencyLinkRoutes } from './seller-agency-link.routes' // 🏢 2026-10-11 에이전시에 맡기기·끊기
import { registerKakaoBotLinkRoutes } from './seller-kakao-bot.routes' // 💬 2026-10-10 카카오톡으로 매장 관리(연결 코드·연결 목록)
import { registerStoreNotificationRoutes } from './seller-store-notifications' // 🔔 2026-10-12 내 매장들의 판매 알림(마이·콘솔)
import { registerProductCopyRoutes } from './seller-product-copy.routes' // 🏬 2026-10-17
import { registerBrandRoutes } from './seller-brands.routes' // 🏷️ 2026-10-17 브랜드로 묶기

/** 🏬 마이 요약에 담는 매장 수 상한 — 바인딩이 아니라 응답 크기 기준(조각으로 나눠 돈다). 목록과 같은 값이어야 한다. */
const MAX_SUMMARY_STORES = MAX_OPERABLE_STORES

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
  // 🔐 2026-10-10: 좌석 토큰이면 **그 좌석의 사람**(살아 있을 때만) — 매장 주인 id 로 되짚지 않는다.
  //   종전엔 운영자 좌석 토큰도 주인 id 로 바뀌어, 쿠키 없이 보내면 운영자가 주인으로 둔갑했다.
  return resolveTokenActorUserId(c.env.DB, c.req.header('Authorization'), c.env.JWT_SECRET)
}

/**
 * 🏢 2026-10-11 — 앉을 수 있는 매장 목록의 **주체**. 소비자 사람이면 그 사람의 목록, 에이전시 직원 좌석이면
 *   **맡은 그 매장 하나**(operator). 에이전시 직원은 소비자 사람이 없어서 사람 기준 목록이 비고, 401 을 내면
 *   셀러 화면의 공용 인터셉터가 로그아웃시킨다 — 그래서 여기서 좌석 하나로 답한다.
 */
async function resolveStoreScope(c: Ctx): Promise<{ userId: number | null; agencyId?: number | null; stores: Awaited<ReturnType<typeof listOperableStores>> } | null> {
  const agencyStore = await liveAgencySeatStoreId(c.env.DB, c.req.header('Authorization'), c.env.JWT_SECRET).catch(() => null)
  const agencyId = agencyStore ? (await agencySeatOf(c.req.header('Authorization'), c.env.JWT_SECRET))?.agencyId ?? null : null
  if (agencyStore && agencyId) {
    const r = await c.env.DB.prepare(
      'SELECT id AS seller_id, business_name, name, status, username, address FROM sellers WHERE id = ? LIMIT 1',
    ).bind(agencyStore).first<{ seller_id: number; business_name: string | null; name: string | null; status: string | null; username: string | null; address: string | null }>()
    return { userId: null, agencyId, stores: r ? [{ ...r, role: 'operator' as const, source: 'grant' as const }] : [] }
  }
  const userId = await resolveActorUserId(c)
  if (!userId) return null
  return { userId, stores: await listOperableStores(c.env.DB, userId) }
}

// ── GET /my-stores ────────────────────────────────────────────────────────
app.get('/my-stores', async (c) => {
  try {
    const scope = await resolveStoreScope(c)
    if (!scope) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const { userId, stores } = scope
    /**
     * 🔑 2026-09-19 (대표 확정 플로우 3번): 내가 **운영자**로만 앉아 있고 아직 주인이 없는 매장은
     *   사장님 승계 코드를 함께 준다 — 목록 화면이 "이 코드를 사장님께 주세요" 를 그린다.
     *   주인이 생기면 코드는 안 내려간다(그때부턴 줄 사람이 없다). fail-soft: 코드가 안 나와도 목록은 온다.
     */
    const enriched = await Promise.all(stores.map(async (s) => {
      // 에이전시 좌석(userId 없음)엔 승계 코드를 내지 않는다 — 코드는 매장을 데려온 사람의 몫이다.
      if (s.role !== 'operator' || userId == null) return { ...s, has_owner: true, owner_claim_code: null as string | null }
      const ownerId = await resolveStoreOwnerUserId(c.env.DB, s.seller_id).catch(() => undefined)
      if (ownerId != null) return { ...s, has_owner: true, owner_claim_code: null as string | null }
      const code = await getOrIssueOwnerClaimCode(c.env.DB, s.seller_id, userId).catch(() => null)
      return { ...s, has_owner: false, owner_claim_code: code ? formatStoreCode(code.code) : null }
    }))
    return c.json({ success: true, data: enriched })
  } catch (err) {
    return safeError(c, err, '매장 목록을 불러오지 못했습니다', '[seller-operators]')
  }
})

// ── GET /my-stores/summary — 🧮 B2 "합계 + 매장별" (2026-09-15 대표 확정) ──────────────
//   사람 기준: 앉을 수 있는 매장(active|approved) 전부의 **오늘**(KST) 매출·주문·처리 대기를 한 번에.
//   읽기 전용 집계. 권한은 listOperableStores 가 이미 판정한 좌석 집합 안에서만 센다(좌석 토큰 발급과 같은 근거).
//   ⚠️ 판정 규칙은 `/dashboard/stats`(seller-settlements.routes)와 **같아야** 한다 — PAID/DONE · DATE(created_at,'+9 hours').
//   처리 대기 = 결제됐는데 아직 확인 전인 **배송 주문**(클라 `order-stage.needsSellerConfirm` 과 같은 규칙), 최근 30일.
app.get('/my-stores/summary', async (c) => {
  try {
    const scope = await resolveStoreScope(c)
    if (!scope) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    // 🏬 2026-10-17 프랜차이즈: 종전 `.slice(0, 20)` — 지점이 20곳을 넘는 브랜드는 나머지가 **조용히 빠졌다**.
    //   이유는 바인딩 한도(100)였다 → 잘라 두지 않고 `allInChunks` 로 나눠 돌린다(병렬, 조각당 90).
    const stores = scope.stores
      .filter(s => isSeatableStoreStatus(s.status))
      .slice(0, MAX_SUMMARY_STORES)
    const currentSellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (stores.length === 0) {
      return c.json({ success: true, data: { stores: [], totals: { today_revenue: 0, today_orders: 0, pending: 0 }, current_seller_id: currentSellerId ?? null } })
    }
    if (scope.agencyId) return c.json({ success: true, data: await agencySummary(c.env.DB, stores, scope.agencyId, currentSellerId ?? null) }) // 🤝 자기 이용권 숫자만
    const ids = stores.map(s => s.seller_id)
    const todayKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    const [todayRows, pendingRows, activeRows, certRows, lifeRows, imgRows] = await Promise.all([
      allInChunks(ids, (chunk, marks) => c.env.DB.prepare(
        `SELECT seller_id, COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS rev
           FROM orders
          WHERE seller_id IN (${marks}) AND status IN ('PAID','DONE') AND DATE(created_at, '+9 hours') = ?
          GROUP BY seller_id`
      ).bind(...chunk, todayKst).all<{ seller_id: number; n: number; rev: number }>().then(r => r.results || [])),
      allInChunks(ids, (chunk, marks) => c.env.DB.prepare(
        // 🧭 2026-10-07: **배송 주문만** — 이용권·교환권은 [주문 확인] 할 일이 없어 영원히 여기 쌓였다
        //   (클라 `order-stage.ts` 와 같은 규칙, SQL 짝 `shipping-order-sql.ts`).
        `SELECT o.seller_id, COUNT(*) AS n
           FROM orders o
          WHERE o.seller_id IN (${marks}) AND o.status IN ('PAID','DONE','PAY_COMPLETE') AND o.created_at >= datetime('now', '-30 days')
            AND ${shippingOrderSql('o')}
          GROUP BY o.seller_id`
      ).bind(...chunk).all<{ seller_id: number; n: number }>().then(r => r.results || [])),
      /**
       * ⚡ 2026-10-01 — **판매 중 개수**(대표 *"내 가게 이 부분이 가장 늦게 떠"*).
       *   마이 첫 화면의 `판매 중 N개` 한 줄을 그리려고 화면이 `/api/seller/products` 로
       *   **상품 목록 전체**를 따로 받고 있었다. 숫자 하나면 되는 일이다 → 같은 병렬 묶음에 집계 하나.
       *   ⚠️ 판정 기준은 셀러 대시보드 목록과 같게 `is_active = 1` + 삭제 제외.
       */
      allInChunks(ids, (chunk, marks) => c.env.DB.prepare(
        `SELECT seller_id, COUNT(*) AS n
           FROM products
          WHERE seller_id IN (${marks}) AND is_active = 1 AND COALESCE(status, '') != 'DELETED'
          GROUP BY seller_id`
      ).bind(...chunk).all<{ seller_id: number; n: number }>().then(r => r.results || [])),
      /**
       * 🪪 2026-10-12 — **등록증 심사 상태**. 매장은 대기인데 등록증만 반려된 경우를 마이가 "승인 대기 중" 이라고
       *   말하지 않게. 같은 병렬 묶음이라 왕복 0.
       *   ⚠️ 별도 쿼리로 둔다 — 매장 목록 쿼리(`listOperableStores`)에 섞으면 컬럼이 없는 옛 스키마에서 **목록 전체가 빈다**.
       */
      allInChunks(ids, (chunk, marks) => c.env.DB.prepare(
        `SELECT id AS seller_id, business_registration_status AS cert FROM sellers WHERE id IN (${marks})`
      ).bind(...chunk).all<{ seller_id: number; cert: string | null }>().then(r => r.results || [])),
      /**
       * 🏠 2026-10-26 대표 *"참여권은 사장님 마이에서 갯수·차감 내역을 볼 수 있나"* — 생활 견적 업체면 참여권 잔액.
       *   생활 업체가 아니면 행이 없다(→ null, 마이가 줄을 안 그린다). 테이블이 아직 없는 DB 면 빈 배열(줄 없음).
       */
      allInChunks(ids, (chunk, marks) => c.env.DB.prepare(
        `SELECT p.seller_id, COALESCE(b.balance, 0) AS n
           FROM home_service_pros p LEFT JOIN home_service_credit_balance b ON b.seller_id = p.seller_id
          WHERE p.seller_id IN (${marks})`
      ).bind(...chunk).all<{ seller_id: number; n: number }>().then(r => r.results || [])).catch(() => [] as { seller_id: number; n: number }[]),
      /**
       * 🖼️ 2026-10-31 (대표 확정 9번 **B안** — 마이 '내 가게' 머리줄에 가게 사진 · 이름 · 가게 보기).
       *   사진 = 가게 프로필, 없으면 판매 중 상품 첫 사진(빈 회색보다 그 가게를 알아보게 한다).
       *   별도 쿼리 + fail-soft — 사진이 안 와도 요약은 온다(머리줄이 이니셜로 그린다).
       */
      allInChunks(ids, (chunk, marks) => c.env.DB.prepare(
        `SELECT s.id AS seller_id, s.profile_image AS img,
                (SELECT p.image_url FROM products p
                  WHERE p.seller_id = s.id AND p.is_active = 1 AND COALESCE(p.status, '') != 'DELETED'
                  ORDER BY p.id LIMIT 1) AS pimg
           FROM sellers s WHERE s.id IN (${marks})`
      ).bind(...chunk).all<{ seller_id: number; img: string | null; pimg: string | null }>().then(r => r.results || [])).catch(() => [] as { seller_id: number; img: string | null; pimg: string | null }[]),
    ])
    const today = { results: todayRows }, pending = { results: pendingRows }, active = { results: activeRows }, cert = { results: certRows }
    const tMap = new Map((today.results || []).map(r => [Number(r.seller_id), r]))
    const pMap = new Map((pending.results || []).map(r => [Number(r.seller_id), Number(r.n) || 0]))
    const aMap = new Map((active.results || []).map(r => [Number(r.seller_id), Number(r.n) || 0]))
    const cMap = new Map((cert.results || []).map(r => [Number(r.seller_id), r.cert ?? null]))
    const lMap = new Map(lifeRows.map(r => [Number(r.seller_id), Number(r.n) || 0]))
    const iMap = new Map(imgRows.map(r => [Number(r.seller_id), r.img || r.pimg || null]))
    const rows = stores.map(s => {
      const t = tMap.get(s.seller_id)
      return {
        seller_id: s.seller_id,
        name: s.business_name || s.name || `매장 #${s.seller_id}`,
        role: s.role,
        // 🥕 2026-09-25: 당근 모델 배너를 마이 판매 섹션이 직접 그린다 — 승인 대기·반려도 좌석이
        //   열리므로(isSeatableStoreStatus) 화면이 그 사실을 말해야 한다. 추가 쿼리 0(이미 읽은 행).
        status: s.status || null,
        cert_status: cMap.get(s.seller_id) ?? null,
        today_revenue: Number(t?.rev) || 0,
        today_orders: Number(t?.n) || 0,
        pending: pMap.get(s.seller_id) || 0,
        // ⚡ 첫 화면의 `판매 중 N개` — 이것 때문에 상품 목록을 통째로 받던 2단 요청을 없앴다.
        active_products: aMap.get(s.seller_id) || 0,
        // 🏠 생활 견적 참여권 — 생활 업체가 아니면 null(마이가 줄을 안 그린다)
        life_credits: lMap.has(s.seller_id) ? lMap.get(s.seller_id)! : null,
        // 🖼️ B안 머리줄 — 가게 사진과 손님이 보는 가게 주소(`/s/:username`)
        image: iMap.get(s.seller_id) ?? null,
        username: s.username ?? null,
      }
    })
    const totals = rows.reduce((a, r) => ({ today_revenue: a.today_revenue + r.today_revenue, today_orders: a.today_orders + r.today_orders, pending: a.pending + r.pending }), { today_revenue: 0, today_orders: 0, pending: 0 })
    return c.json({ success: true, data: { stores: rows, totals, current_seller_id: currentSellerId ?? null } })
  } catch (err) {
    return safeError(c, err, '매장 요약을 불러오지 못했습니다', '[seller-operators]')
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
    // 🥕 2026-09-20 (대표 — 승인 대기가 두 번이라 느리다 → "준비는 지금, 노출·정산은 승인 뒤"):
    //   종전엔 `active|approved` 만 좌석을 열어 중개사가 등록한 매장은 **승인 전엔 아무것도 못 했다**
    //   (이용권 등록·협업 코드 발급 전부 대기). 09-16 이 셀러 계정에 적용한 당근 규칙을 매장 좌석에도
    //   같게 — 대기·반려는 들여보내고 배너가 알린다. ⚠️ 정지(`suspended`)는 계속 막는다.
    //   승인 전 매장이 못 하는 것은 각 기능이 정한다: 메인 노출 = `approvedSellerProductSql`,
    //   **정산 = `payouts-generate` 의 `isPayoutEligibleSellerStatus`** — 돈은 사람이 등록증을 본 뒤에만
    //   나간다. 그래서 좌석을 열어도 09-16 사기 방어는 그대로다. 판정 SSOT: `shared/seller-status.ts`.
    if (!isSeatableStoreStatus(seller.status)) {
      return c.json({ success: false, error: '이용이 정지된 매장입니다' }, 403)
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
    /**
     * 🔑 2026-09-09: **역할을 토큰에 함께 싣는다.**
     *
     * 🩸 그 전엔 `operator_user_id` 유무 하나로 소유자를 판정했는데(`store-actor.ts`),
     *   `/store/new` 는 설계상 `linked_user_id` 를 비워 두므로 **직접(direct) 등록한 진짜 사장님도
     *   `source:'grant'`** 로 들어온다. 그래서 `role` 이 `'owner'` 인데도 운영자로 오판됐고,
     *   소유자 전용 게이트가 전부 닫혔다 — 특히 **정산 계좌를 못 넣어 돈을 아예 못 받는다.**
     *   (라이브에 직접 등록 매장이 아직 0이라 안 터졌을 뿐, 다음 첫 사장님이 바로 밟는다.)
     *
     * ⚠️ `operator_user_id` 는 **그대로 둔다** — 그건 소유 판정이 아니라 *시트 분리*용이고,
     *   빼면 운영자가 들어갈 때 사장님이 튕긴다(위 주석의 사고).
     */
    if (access.role) payload.store_role = access.role
    // 🪑 2026-10-10: 이 좌석이 **누구에게** 발급됐는지 — link 출처(소유자 본인)도 포함해 항상 싣는다.
    //   `store-seat-guard` 가 매 요청 (매장, 이 사람)의 지금 권한을 다시 본다. 이게 없으면 회수·이전
    //   뒤에도 토큰이 30일 동안 살아 있다. ⚠️ 시트 키(`deriveDashboardSeat`)는 이 claim 을 안 본다.
    payload.seat_user_id = userId

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

// ── GET /operating-summary — 내가 운영하는 매장 요약 ──────────────────────
/**
 * 🏪 2026-09-04 (대표 확정 "운영 매장 요약 대시보드") — 중개사가 **매장에 청구할 근거**를 보는 화면.
 *
 * ## 왜 필요한가
 * 중개사 보수는 유어딜이 주지 않는다. 매장 몫(95%)에서 매장과 직접 정한다. 그러면 "얼마를 받을지"를
 * 정할 근거가 필요한데, 지금은 매장을 하나씩 전환해 들어가 보는 수밖에 없었다.
 *
 * ## 🔴 정직하게 보여줄 것 — 이건 "내 성과"가 아니다
 * 운영자별 매출 귀속은 추적하지 않는다. 그래서 **매장의 총액**을 주되, 위임받은 매장은
 * `revenue_since_grant`(운영 시작 이후)를 함께 준다 — 그 구간이 그나마 방어 가능한 청구 근거다.
 * 화면은 이 차이를 **문장으로** 밝혀야 한다. "내가 만든 매출"이라고 쓰면 거짓말이 된다.
 *
 * 스코프: `listOperableStores` 가 이미 이 유저가 운영 가능한 매장으로 좁힌다(남의 매장 안 샌다).
 */
app.get('/operating-summary', async (c) => {
  try {
    const userId = await resolveActorUserId(c)
    if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

    const stores = await listOperableStores(c.env.DB, userId)
    if (stores.length === 0) return c.json({ success: true, data: [] })

    // 위임 매장의 운영 시작일 — 청구 구간의 시작점.
    const grants = new Map<number, string>()
    try {
      const g = await c.env.DB.prepare(
        `SELECT seller_id, granted_at FROM seller_operators
          WHERE user_id = ? AND revoked_at IS NULL`
      ).bind(userId).all<{ seller_id: number; granted_at: string | null }>()
      for (const r of g.results || []) if (r.granted_at) grants.set(r.seller_id, r.granted_at)
    } catch { /* 테이블 없으면 구간 없이 총액만 */ }

    const out = []
    for (const st of stores) {
      const since = grants.get(st.seller_id) || null
      // ⚠️ 확정된 주문만 센다 — PENDING 을 매출로 보여주면 청구 근거가 부풀려진다.
      const PAID = "status IN ('PAID','DONE','PREPARING','SHIPPING','DELIVERED')"
      const agg = await c.env.DB.prepare(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS revenue
           FROM orders WHERE seller_id = ? AND ${PAID}`
      ).bind(st.seller_id).first<{ orders: number; revenue: number }>().catch(() => null)
      const sinceAgg = since
        ? await c.env.DB.prepare(
            `SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS revenue
               FROM orders WHERE seller_id = ? AND ${PAID} AND created_at >= ?`
          ).bind(st.seller_id, since).first<{ orders: number; revenue: number }>().catch(() => null)
        : null
      const prods = await c.env.DB.prepare(
        'SELECT COUNT(*) AS n FROM products WHERE seller_id = ? AND is_active = 1'
      ).bind(st.seller_id).first<{ n: number }>().catch(() => null)

      out.push({
        seller_id: st.seller_id,
        business_name: st.business_name || st.name,
        username: st.username,
        status: st.status,
        role: st.role,
        source: st.source,
        granted_at: since,
        products_active: Number(prods?.n) || 0,
        orders_total: Number(agg?.orders) || 0,
        revenue_total: Number(agg?.revenue) || 0,
        orders_since_grant: sinceAgg ? Number(sinceAgg.orders) || 0 : null,
        revenue_since_grant: sinceAgg ? Number(sinceAgg.revenue) || 0 : null,
      })
      /**
       * 🤝 2026-09-19 (대표 확정 플로우 10번): 매장에 붙은 **인플루언서별** 성과와 **내 중개사 몫**.
       *   - 인플루언서: 활성·대기 딜 + 그 사람 귀속 적립(`influencer_attributions`, 중개사 몫 행은 제외).
       *     적립은 매장 부담(딜 %)이라 "매장이 인플루언서에게 낸 돈" 이 곧 이 숫자다.
       *   - 중개사 몫: `source='broker_share'` 행 중 **내 것**만. 게이트 OFF 면 0 이고 화면이 그 사실을 말한다.
       */
      const deals = await c.env.DB.prepare(
        `SELECT d.id, d.influencer_id, d.commission_pct, d.status, d.proposed_by, d.created_at,
                u.name AS influencer_name, u.handle AS influencer_handle,
                (SELECT COUNT(*) FROM influencer_attributions a WHERE a.seller_id = d.seller_id AND a.influencer_id = d.influencer_id AND COALESCE(a.source,'') != 'broker_share' AND a.status != 'clawed_back') AS orders_count,
                (SELECT COALESCE(SUM(a.commission_amount),0) FROM influencer_attributions a WHERE a.seller_id = d.seller_id AND a.influencer_id = d.influencer_id AND COALESCE(a.source,'') != 'broker_share' AND a.status != 'clawed_back') AS commission_total
           FROM seller_influencer_deals d LEFT JOIN users u ON CAST(u.id AS TEXT) = d.influencer_id
          WHERE d.seller_id = ? AND d.status IN ('active','proposed')
          ORDER BY commission_total DESC, d.created_at DESC LIMIT 50`
      ).bind(st.seller_id).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
      const brokerTerms = await readBrokerTerms(c.env.DB, st.seller_id).catch(() => ({ brokerUserId: null, sharePct: 0, influencerCapPct: null }))
      const myShare = await c.env.DB.prepare(
        `SELECT COALESCE(SUM(CASE WHEN status IN ('pending') THEN commission_amount ELSE 0 END),0) AS pending_krw,
                COALESCE(SUM(CASE WHEN status IN ('available','paid') THEN commission_amount ELSE 0 END),0) AS confirmed_krw
           FROM influencer_attributions WHERE seller_id = ? AND influencer_id = ? AND source = 'broker_share'`
      ).bind(st.seller_id, String(userId)).first<{ pending_krw: number; confirmed_krw: number }>().catch(() => null)

      Object.assign(out[out.length - 1], {
        influencers: (deals.results || []).map((d) => ({
          deal_id: Number(d.id), influencer_id: String(d.influencer_id),
          name: (d.influencer_name as string | null) || null, handle: (d.influencer_handle as string | null) || null,
          commission_pct: Number(d.commission_pct) || 0, status: String(d.status), proposed_by: String(d.proposed_by),
          orders_count: Number(d.orders_count) || 0, commission_total: Number(d.commission_total) || 0,
        })),
        broker_share_pct: brokerTerms.brokerUserId === userId ? brokerTerms.sharePct : 0,
        influencer_pct_cap: brokerTerms.influencerCapPct,
        my_broker_share: { pending_krw: Number(myShare?.pending_krw) || 0, confirmed_krw: Number(myShare?.confirmed_krw) || 0 },
      })
    }
    // 위임 매장을 위로 — 이 화면을 여는 이유가 그쪽이다.
    out.sort((a, b) => (a.source === b.source ? b.revenue_total - a.revenue_total : a.source === 'grant' ? -1 : 1))
    return c.json({ success: true, data: out })
  } catch (err) {
    return safeError(c, err, '운영 매장 요약을 불러오지 못했습니다', '[seller-operators]')
  }
})

registerKakaoBotLinkRoutes(app)
registerStoreNotificationRoutes(app, resolveStoreScope)
registerProductCopyRoutes(app, resolveActorUserId) // 🏬 2026-10-17 이용권을 다른 지점에 복사(프랜차이즈)
registerBrandRoutes(app, resolveActorUserId) // 🏷️ 2026-10-17 브랜드로 묶기(보여 주기용 — 정산·권한은 지점 그대로)
registerAgencyLinkRoutes(app, requireOwnerOfCurrentStore)

export { app as sellerOperatorsRoutes }
