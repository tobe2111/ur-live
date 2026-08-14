/**
 * 🎟️ **운영자가 직접 공구를 연다** — 셀러용 공구 설정 (세션 ③-b, O5)
 *
 * `gb-cockpit`(공구 조종석)은 **어드민 전용**(`requireAdmin`)이라, 운영자가 자기 상품의
 * **공구가·마감을 스스로 못 정한다.** 3분 등록 폼을 만들어도 그 다음 칸이 막혀 있으면 소용없다.
 *
 * ## 🔴 이 파일이 지키는 것
 * ① **소유권** — `products.seller_id === 인증된 셀러` 인 상품만. 남의 상품 공구를 못 건드린다(IDOR).
 * ② **검증 SSOT 재사용** — `validateGbSession`(shared/gb-session) 그대로. 어드민 조종석과 **같은 규칙**이라
 *    경로에 따라 통과 기준이 갈리지 않는다. 특히 **공구가 < 상시가** 강제 — 가격을 올리는 방향은 막힌다.
 * ③ **저장도 SSOT** — `saveGbSession`(product_supply_meta upsert). 새 저장 경로를 만들지 않는다.
 *
 * ⚠️ **머니 무접촉**: 이 파일은 값 저장뿐이고 결제/정산/커미션 로직을 건드리지 않는다.
 *   🔴 **2026-08-11 정정** — 여기 오래 적혀 있던 *"적용은 `gb_engine_enabled` 게이트 뒤"* 는 **사실이 아니었다.**
 *   저장한 공구가는 `order.routes` 에서 **게이트 없이 곧바로 청구 단가**가 된다(2026-07-29 배선).
 *   되돌릴 손잡이는 별도 킬스위치 `platform_settings.gb_pricing_enabled`(기본 ON, `'false'` 로 끔) 다.
 */
import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../../../worker/types/env'
import { intParam } from '../../../shared/pagination'
import { getGbSession, saveGbSession } from '../../../worker/utils/gb-session-store'
import { validateGbSession, resolveGbStatus, type GbSession, type GbMode } from '../../../shared/gb-session'
import { parsePickup, pickupToMeta, validatePickup, type PickupInfo } from '../../../shared/pickup'
import { getSupplyMeta, setSupplyMeta } from '../../../worker/utils/product-supply-meta'
import { safeError } from '../../../worker/utils/safe-error'
import { rateLimit } from '../../../worker/middleware/rate-limit'
import { isMallSlugCandidate } from '../../../shared/mall/resolve'
import { ensureMallApplications, pendingApplication } from '../../../worker/utils/mall-applications'

const app = new Hono<{ Bindings: Env }>()
const MODES: readonly GbMode[] = ['off', 'scheduled', 'live', 'ended']

/**
 * 인증 + **활성 셀러** 확인. 정지·반려된 셀러의 토큰은 여전히 서명이 유효하므로
 * DB status 를 함께 본다(`seller-orders.routes` 의 `getActiveSellerId` 와 같은 방침).
 */
async function activeSellerId(DB: D1Database, auth: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!auth || !auth.startsWith('Bearer ')) return null
  let raw: string | number | undefined
  try {
    const payload = await verify(auth.substring(7), jwtSecret, 'HS256') as JWTPayload & { seller_id?: number | string }
    raw = payload.seller_id
  } catch { return null }
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) return null
  const row = await DB.prepare(
    "SELECT id FROM sellers WHERE id = ? AND status IN ('approved', 'active') AND is_active = 1"
  ).bind(id).first<{ id: number }>().catch(() => null)
  return row ? id : null
}

/**
 * 🔴 **소유권 확인** — 이 상품이 그 셀러의 것인가.
 * `WHERE id = ? AND seller_id = ?` 로 **쿼리에서** 거른다. 조회 후 애플리케이션에서 비교하면
 * 한 번만 빠뜨려도 남의 상품이 통과한다.
 */
async function ownedProduct(DB: D1Database, productId: number, sellerId: number) {
  return DB.prepare('SELECT id, price FROM products WHERE id = ? AND seller_id = ? AND is_active = 1')
    .bind(productId, sellerId).first<{ id: number; price: number }>().catch(() => null)
}

// ── 🔴 정적 경로는 `/:id` **앞에** 둔다 ───────────────────────────────────────
//   Hono 는 **등록 순서대로** 매칭한다(실측: `/:id` 를 먼저 걸면 `/support-contact` 가
//   `id='support-contact'` 로 삼켜진다 → `intParam` 이 0 → 400). React Router 처럼
//   "더 구체적인 경로가 이긴다" 가 **아니다.** 아래 두 라우트가 여기 있는 이유다.

// ── GET /mall — 내 가게(운영자 몰) 주소 ───────────────────────────────────────
/**
 * 🏪 2026-08-12: 운영자가 **자기 링크를 몰랐다.** 상품을 올려도 `urdeal.kr/{슬러그}` 가 어디에도
 * 안 보여 카톡에 뿌릴 수가 없었다(운영자 화면 전체에 `mall_slug` 참조 0건이었다).
 * 그리고 몰 연결이 안 된 셀러의 상품은 **조용히 본진 몰(id 1)으로** 들어간다
 * (`mallIdForSeller` 기본값) — 운영자는 등록했는데 자기 가게에 안 뜨고, 왜인지 알 방법도 없었다.
 * ⇒ 연결됐으면 슬러그를, 아니면 `linked:false` 를 돌려준다. **모르는 채로 두지 않는다.**
 */
app.get('/mall', async (c) => {
  try {
    const sellerId = await activeSellerId(c.env.DB, c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const row = await c.env.DB.prepare(
      `SELECT m.slug AS slug, COALESCE(NULLIF(TRIM(m.brand_name), ''), m.name) AS name
         FROM sellers s JOIN wholesale_malls m ON m.id = s.mall_id
        WHERE s.id = ? AND COALESCE(m.consumer_path, 0) = 1 AND COALESCE(m.active, 1) = 1`,
    ).bind(sellerId).first<{ slug: string; name: string }>().catch(() => null)
    // 🔴 본진 몰(id 1)·미연결·도매몰은 전부 `linked:false` — 소비자 경로로 열리는 몰만 "내 가게"다.
    const pending = row?.slug ? null : await pendingApplication(c.env.DB, sellerId)
    return c.json({
      success: true, linked: !!row?.slug, slug: row?.slug ?? null, name: row?.name ?? null,
      pending: pending ? { slug: pending.slug, name: pending.name, created_at: pending.created_at } : null,
    })
  } catch (err) {
    return safeError(c, err, '가게 정보를 불러오지 못했습니다', '[seller-gb]')
  }
})

// ── GET /mall/slug-check — 주소가 쓸 수 있는가 ────────────────────────────────
/**
 * 🏪 2026-08-12: 신청 폼이 **제출해야만** 결과를 알려 줬다. 슬러그는 `urdeal.kr/{슬러그}` 라는
 * 영구 주소라 운영자가 가장 신경 쓰는 값인데, 예약어인지 남이 썼는지를 **찍어 보고 알아야** 했다.
 *
 * 🔴 판정은 신청·승인과 **같은 SSOT**(`isMallSlugCandidate` + 슬러그 선점 조회)를 쓴다.
 *   여기만 따로 판정하면 "여기선 된다는데 제출하면 안 되는" 주소가 생긴다 — 그게 더 나쁘다.
 * ⚠️ 이 응답은 **예약**이 아니다. 확인과 제출 사이에 남이 가져갈 수 있고, 그래서 승인 시점에
 *   한 번 더 본다(`wholesale-malls-admin` 의 재검증).
 */
app.get('/mall/slug-check', rateLimit({ action: 'seller-mall-slug-check', max: 60, windowSec: 60 }), async (c) => {
  try {
    const sellerId = await activeSellerId(c.env.DB, c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const slug = String(c.req.query('slug') ?? '').trim().toLowerCase().slice(0, 40)
    if (!isMallSlugCandidate(slug)) {
      return c.json({ success: true, available: false, reason: '영문 소문자·숫자·하이픈 3~30자, 예약된 주소는 쓸 수 없어요' })
    }
    const taken = await c.env.DB.prepare('SELECT 1 AS hit FROM wholesale_malls WHERE slug = ?')
      .bind(slug).first().catch(() => null)
    return c.json(taken
      ? { success: true, available: false, reason: '이미 사용 중인 주소예요' }
      : { success: true, available: true, reason: null })
  } catch (err) {
    return safeError(c, err, '주소를 확인하지 못했습니다', '[seller-gb]')
  }
})

// ── POST /mall/apply — 가게 개설 신청 ─────────────────────────────────────────
/**
 * 🏪 2026-08-12 최소안: 운영자가 **신청**하고 어드민이 **승인만** 한다.
 * 🔴 신청은 **아무것도 만들지 않는다** — 슬러그는 `urdeal.kr/{슬러그}` 라는 영구 주소이고,
 *   예약어와 충돌하면 소비자 라우트가 통째로 죽는다. 사람이 한 번 보는 단계를 남긴다.
 */
app.post('/mall/apply', rateLimit({ action: 'seller-mall-apply', max: 5, windowSec: 3600 }), async (c) => {
  try {
    const sellerId = await activeSellerId(c.env.DB, c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)
    await ensureMallApplications(c.env.DB)

    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
    const slug = String(b.slug ?? '').trim().toLowerCase()
    const name = String(b.name ?? '').trim().slice(0, 60)
    // 🔴 예약어·문법은 소비자 라우트와 **같은 SSOT** 로 본다. 여기서 갈리면 승인 시점에야 터진다.
    if (!isMallSlugCandidate(slug)) {
      return c.json({ success: false, error: '주소는 영문 소문자·숫자·하이픈 3~30자여야 하고, 예약된 주소는 쓸 수 없습니다' }, 400)
    }
    if (!name) return c.json({ success: false, error: '가게 이름을 입력해주세요' }, 400)

    // 이미 연결된 셀러는 신청 불가 — 가게가 둘이 되면 상품이 어디로 갈지 모호해진다.
    const linked = await c.env.DB.prepare(
      'SELECT 1 AS hit FROM sellers s JOIN wholesale_malls m ON m.id = s.mall_id WHERE s.id = ? AND COALESCE(m.consumer_path, 0) = 1',
    ).bind(sellerId).first().catch(() => null)
    if (linked) return c.json({ success: false, error: '이미 가게가 열려 있습니다' }, 409)

    // 슬러그 선점 확인(친절한 메시지 — 최종 판정은 승인 시점에 한 번 더 한다).
    const taken = await c.env.DB.prepare('SELECT 1 AS hit FROM wholesale_malls WHERE slug = ?').bind(slug).first().catch(() => null)
    if (taken) return c.json({ success: false, error: '이미 사용 중인 주소입니다' }, 409)

    // partial UNIQUE(seller_id WHERE status='pending')가 동시 신청을 막는다 — 실패는 곧 "이미 대기 중".
    const ins = await c.env.DB.prepare(
      "INSERT INTO mall_applications (seller_id, slug, name, status) VALUES (?, ?, ?, 'pending')",
    ).bind(sellerId, slug, name).run().catch(() => null)
    if (!ins?.meta?.last_row_id) return c.json({ success: false, error: '이미 심사 중인 신청이 있습니다' }, 409)
    return c.json({ success: true, id: Number(ins.meta.last_row_id) })
  } catch (err) {
    return safeError(c, err, '신청 처리 중 오류가 발생했습니다', '[seller-gb]')
  }
})

app.get('/support-contact', async (c) => {
  try {
    const sellerId = await activeSellerId(c.env.DB, c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const row = await c.env.DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'operator_support_contact'"
    ).first<{ value: string }>().catch(() => null)
    const contact = String(row?.value ?? '').trim().slice(0, 200)
    return c.json({ success: true, contact: contact || null })
  } catch (err) {
    return safeError(c, err, '문의처를 불러오지 못했습니다', '[seller-gb]')
  }
})

// ── GET /:id — 내 상품의 현재 공구 설정 ────────────────────────────────────────
app.get('/:id', async (c) => {
  try {
    const sellerId = await activeSellerId(c.env.DB, c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const id = intParam(c.req.param('id'), 0)
    if (!id) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
    const p = await ownedProduct(c.env.DB, id, sellerId)
    // 남의 상품과 없는 상품을 **같은 404** 로 — 존재 여부를 흘리지 않는다.
    if (!p) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
    const gb = await getGbSession(c.env.DB, id)
    // 📦 세션 ④-a — 픽업 정보 동봉(같은 화면에서 함께 편집한다).
    // ⚠️ `getSupplyMeta` 는 **id 배열 → Map** 이다(단건 조회 함수가 아니다 — 시그니처를 보고 맞췄다).
    const metaMap = await getSupplyMeta(c.env.DB, [id]).catch(() => null)
    const pickup = parsePickup(metaMap?.get(id) ?? null)
    return c.json({ success: true, gb, pickup, gb_effective_status: resolveGbStatus(gb, Date.now()) })
  } catch (err) {
    return safeError(c, err, '공구 설정을 불러오지 못했습니다', '[seller-gb]')
  }
})

// ── PUT /:id — 내 상품의 공구 설정 저장 ────────────────────────────────────────
app.put('/:id', async (c) => {
  try {
    const sellerId = await activeSellerId(c.env.DB, c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const id = intParam(c.req.param('id'), 0)
    if (!id) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
    const p = await ownedProduct(c.env.DB, id, sellerId)
    if (!p) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
    const rawMode = String(b.mode || 'off')
    const mode: GbMode = MODES.includes(rawMode as GbMode) ? (rawMode as GbMode) : 'off'
    const numOrNull = (v: unknown): number | null => {
      if (v == null || v === '') return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    const session: GbSession = {
      mode,
      startAt: typeof b.startAt === 'string' && b.startAt ? b.startAt : null,
      deadline: typeof b.deadline === 'string' && b.deadline ? b.deadline : null,
      target: numOrNull(b.target),
      price: numOrNull(b.price),
      promoPct: numOrNull(b.promoPct),
      linkOnly: b.linkOnly === true || b.linkOnly === '1' || b.linkOnly === 1,
    }

    // 🔴 검증은 어드민 조종석과 **완전히 같은 함수**다 — 경로에 따라 기준이 갈리면
    //   셀러 경로로만 통과하는 값이 생긴다(공구가 > 상시가 같은 것).
    const v = validateGbSession(session, Number(p.price))
    if (!v.ok) return c.json({ success: false, error: v.error || '설정값을 확인해주세요' }, 400)

    // 📦 세션 ④-a — 픽업 정보. **머니 무접촉**(값 저장만). 미수령 환불 분기는 ④-b.
    //   🔴 픽업일은 **공구 마감 이후**여야 한다 — 안 끝난 공구를 받으러 오라는 말이 되기 때문.
    //      그래서 방금 검증된 `session.deadline` 을 기준으로 넘긴다(둘을 따로 저장하면 어긋난다).
    const pickup: PickupInfo = {
      date: typeof b.pickupDate === 'string' && b.pickupDate ? b.pickupDate : null,
      place: typeof b.pickupPlace === 'string' && b.pickupPlace ? b.pickupPlace.slice(0, 200) : null,
      storage: b.storage === 'cold' || b.storage === 'room' ? b.storage : null,
    }
    const pv = validatePickup(pickup, session.deadline)
    if (!pv.ok) return c.json({ success: false, error: pv.error }, 400)

    await saveGbSession(c.env.DB, id, session)
    await setSupplyMeta(c.env.DB, id, pickupToMeta(pickup)).catch(() => { /* 픽업 저장 실패가 공구를 막지 않는다 */ })
    return c.json({ success: true, gb: session, pickup, gb_effective_status: resolveGbStatus(session, Date.now()) })
  } catch (err) {
    return safeError(c, err, '공구 설정 저장에 실패했습니다', '[seller-gb]')
  }
})

/**
 * ── GET /support-contact — ☎️ 운영자 문의처 (체크리스트 O9 · X8 확정 ⓒ) ──────────────
 *
 * 대표 확정은 *"파일럿은 대표 연락처"* 인데 **표시할 곳이 없어** O9 가 🔴 로 남아 있었다.
 * 🔴 값은 코드가 아니라 `platform_settings.operator_support_contact` 에 있다 —
 *   개인정보이고, 운영자가 늘면 **카톡 채널로 값만 바꿔** 승격한다(코드 변경 0).
 * 미설정이면 `null` → 화면이 **아무것도 안 그린다**(빈 껍데기 금지).
 *
 * ⚠️ 셀러 인증 뒤에 둔다 — 연락처가 공개 크롤에 노출되면 스팸 표적이 된다.
 */

export { app as sellerGbRoutes }
