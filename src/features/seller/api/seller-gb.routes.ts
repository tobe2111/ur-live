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

// ── GET /:id — 내 상품의 현재 공구 설정 ────────────────────────────────────────
/**
 * ⚠️ 2026-09-02: **정적 경로는 `/:id` 보다 먼저 등록해야 한다.** Hono 는 등록 순서로 매칭하므로
 *   `/:id` 가 위에 있으면 `/support-contact` 요청이 id="support-contact" 로 잡혀 `intParam(…,0)` → 0 →
 *   **400 '잘못된 상품 ID'** 가 난다(대표 신고: 셀러 대시보드 콘솔 400). 라우트 중복 가드는 경로 문자열이
 *   달라 이 그림자를 못 잡는다 — 순서로 지킨다(`seller-gb-route-order.test.ts`).
 */
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


export { app as sellerGbRoutes }
