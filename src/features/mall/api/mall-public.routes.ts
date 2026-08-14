/**
 * 🏬 운영자 몰 — **소비자 공개 API** (세션 ③-a, O2·C2)
 *
 * `urdeal.kr/{슬러그}` 화면이 읽는 것. **비로그인 전제**(대표 UX 기준: 카톡 인앱에서 바로 열린다).
 *
 * - `GET /api/mall/:slug`           — 몰 존재·브랜딩 (`consumer_path=1` 인 몰만)
 * - `GET /api/mall/:slug/products`  — 그 몰의 진행 중 공구
 *
 * ## 🔴 이 파일이 지키는 것
 * ① **몰 스코프** — `mall_id` 일치 상품만. 본진(1)·타 몰 상품은 **한 건도 안 나간다.**
 * ② **수수료 비노출**〔대표 정책 확정〕— promo%·소개비 같은 **운영자/인플루언서용 숫자를 절대 안 싣는다.**
 *    `gb-marketplace`(인플루언서 뷰)와 응답 모양이 다른 이유가 이것이다. 재사용하지 않고 따로 쓴 이유이기도 하다.
 * ③ **fail-closed** — 몰이 없거나 `consumer_path=0` 이면 **404**. 조용히 본진을 보여주지 않는다.
 *
 * ⚠️ 잠금 파일(`group-buy-public`) 미변경 — 별도 라우트다(`gb-marketplace` 와 같은 방침).
 */
import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'
import { lookupConsumerMall, mallForOrderNumber } from '../../../worker/utils/mall-consumer'
import { requireAuth } from '../../../worker/middleware/auth'
import type { AuthVariables } from '../../../worker/middleware/auth.middleware'
import { getGbSession, getGbSessions } from '../../../worker/utils/gb-session-store'
import { resolveGbPricing } from '../../../shared/gb-session'
import { intParam } from '../../../shared/pagination'
import { resolveMallBranding } from '../../../shared/mall/branding'
import { parsePickup, isEmptyPickup } from '../../../shared/pickup'
import { getSupplyMeta } from '../../../worker/utils/product-supply-meta'

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

/** 몰 확정 — 없으면 null(호출부가 404). */
async function resolve(c: { env: Env; req: { param: (k: string) => string } }) {
  return lookupConsumerMall(c.env.DB, c.req.param('slug'))
}

/**
 * ── GET /of-order/:orderNumber — **이 주문은 어느 가게 것인가** (2026-08-12) ──────────────
 *
 * 결제 완료 화면이 세션 흔적 대신 쓰는 **서버 신호**. 흔적은 두 방향 모두 틀릴 수 있다:
 * 새 탭·복귀면 몰 손님인데 흔적이 없고, 구경만 하고 본진 상품을 산 손님에겐 흔적이 남는다.
 * 주문 자체를 보면 둘 다 정확해진다.
 *
 * 🔴 **정적 경로라 `/:slug` 보다 앞에 등록**한다(Hono 는 등록 순서대로 매칭).
 * 🔴 `requireAuth` + `orders.user_id` 대조 — 주문번호만 알면 남의 주문 가게를 알 수 있게 두지 않는다.
 *   비로그인·남의 주문·모르는 주문은 전부 `mall: null`(200) — 호출부가 세션 흔적으로 폴백한다.
 */
app.get('/of-order/:orderNumber', requireAuth(), async (c) => {
  try {
    const uid = Number(c.get('user')?.id)
    const mall = await mallForOrderNumber(c.env.DB, String(c.req.param('orderNumber') || '').slice(0, 120), uid)
    return c.json({ success: true, mall })
  } catch {
    // 실패도 `mall: null` — 화면은 "가게 없음"이 아니라 "서버가 모른다"로 읽고 흔적으로 폴백한다.
    return c.json({ success: true, mall: null })
  }
})

// ── GET /:slug — 몰 존재·브랜딩 ────────────────────────────────────────────────
app.get('/:slug', async (c) => {
  try {
    const mall = await resolve(c)
    if (!mall) return c.json({ success: false, error: '몰을 찾을 수 없습니다', code: 'MALL_NOT_FOUND' }, 404)
    const b = resolveMallBranding({
      name: String(mall.brand_name || mall.name || ''),   // 브랜드명이 있으면 그것이 표시명
      color: mall.brand_color,
      logoUrl: mall.logo_url,
    })
    // 📣 2026-08-09 과업①(상인회 SaaS) — 몰별 GA4/네이버 확인/고지문 + 공지(팝업·배너) 동봉.
    //   lookupConsumerMall 캐시 행에는 없는 컬럼이라 별도 1회 조회. 컬럼/테이블 미적용 환경은
    //   fail-soft(null/빈배열) — 기존 응답 필드는 byte-불변, additive 만.
    const extra = await c.env.DB.prepare(
      'SELECT ga_id, naver_verification, privacy_md FROM wholesale_malls WHERE id = ?',
    ).bind(Number(mall.id)).first<{ ga_id: string | null; naver_verification: string | null; privacy_md: string | null }>().catch(() => null)
    const notices = await c.env.DB.prepare(
      `SELECT id, type, title, body, link_url FROM mall_notices
        WHERE mall_id = ? AND COALESCE(active, 1) = 1
          AND (starts_at IS NULL OR starts_at <= datetime('now'))
          AND (ends_at IS NULL OR ends_at >= datetime('now'))
        ORDER BY id DESC LIMIT 10`,
    ).bind(Number(mall.id)).all<{ id: number; type: string; title: string; body: string | null; link_url: string | null }>()
      .catch(() => ({ results: [] as never[] }))
    // 익명 응답이라 엣지에 짧게 캐시해도 안전(몰 브랜딩은 자주 안 바뀐다).
    c.header('Cache-Control', 'public, max-age=60')
    c.header('CDN-Cache-Control', 'public, max-age=300')
    return c.json({
      success: true,
      mall: {
        id: mall.id, slug: mall.slug, ...b,
        ga_id: extra?.ga_id ?? null,
        naver_verification: extra?.naver_verification ?? null,
        privacy_md: extra?.privacy_md ?? null,
        notices: notices.results ?? [],
      },
    })
  } catch {
    return c.json({ success: false, error: '몰 정보를 불러오지 못했습니다' }, 500)
  }
})

// ── GET /:slug/products — 그 몰의 진행 중 공구 ─────────────────────────────────
app.get('/:slug/products', async (c) => {
  try {
    const mall = await resolve(c)
    if (!mall) return c.json({ success: false, error: '몰을 찾을 수 없습니다', code: 'MALL_NOT_FOUND' }, 404)

    const db = c.env.DB
    const limit = Math.min(100, Math.max(1, intParam(c.req.query('limit'), 50)))
    const nowMs = Date.now()

    // 🔴 몰 스코프가 **쿼리에** 있다. 애플리케이션에서 거르면 한 번만 빠뜨려도 타 몰 상품이 샌다.
    //
    // 🔧 2026-08-11 — **200개 절단 수정.** 그전엔 `LIMIT 200` 으로 먼저 자르고 JS 에서 공구만 남겼다.
    //   상품이 200개를 넘는 몰에서는 **id 가 낮은(오래된) 상품의 진행 중 공구가 목록에서 사라졌다**
    //   — "옛 상품으로 다시 공구를 연다"는 흔한 운영 패턴에서 조용히 안 보인다.
    //   ⇒ 공구 후보를 **SQL 에서** 좁힌다(`gb_mode ∈ live|scheduled`). 최종 판정은 아래
    //     `resolveGbPricing`(마감·시작시각까지 본다)이 그대로 하므로 **의미는 안 바뀌고**,
    //     자르는 대상만 "전체 상품"에서 "공구 상품"으로 바뀐다.
    //   ⚠️ 메타 테이블이 없는 env 는 조회가 throw → 빈 목록(fail-soft). 그런 env 엔 몰도 없다.
    const prodRows = await db.prepare(
      `SELECT p.id, p.name, p.price, p.original_price, p.image_url, p.category, p.stock
         FROM products p
        WHERE COALESCE(p.mall_id, 1) = ?
          AND p.is_active = 1
          AND NOT EXISTS (SELECT 1 FROM sellers s WHERE s.id = p.seller_id AND s.is_active = 0)
          AND EXISTS (SELECT 1 FROM product_supply_meta m
                       WHERE m.product_id = p.id AND m.key = 'gb_mode' AND m.value IN ('live', 'scheduled'))
        ORDER BY p.id DESC
        LIMIT ?`
    // ⚠️ `limit` 딱 맞게 가져오면 안 된다 — 아래 `resolveGbPricing` 이 **마감 지난 것**을 걸러내
    //   화면에 `limit` 보다 적게 남는다(모드는 live 인데 마감만 지난 상품이 쌓이는 몰에서 실제로 생긴다).
    //   여유분을 받아 필터 후 자른다.
    ).bind(Number(mall.id), Math.min(300, limit * 3)).all<{
      id: number; name: string; price: number; original_price: number | null
      image_url: string | null; category: string; stock: number | null
    }>().catch(() => ({ results: [] as never[] }))

    const rows = prodRows.results || []
    if (rows.length === 0) return c.json({ success: true, data: [] })

    const ids = rows.map((r) => Number(r.id))
    const sessions = await getGbSessions(db, ids)
    // 📦 세션 ④-a — 픽업 정보(픽업일·보관구분). 카드에서 **언제 받는지**가 보여야 문의가 안 쏟아진다.
    //   같은 사이드테이블이라 왕복이 한 번 더 늘지 않는다(gb 세션과 별개 조회지만 둘 다 배치).
    const metaMap = await getSupplyMeta(db, ids).catch(() => null)
    const items = rows
      .map((p) => {
        const s = sessions.get(Number(p.id))
        if (!s) return null
        const pr = resolveGbPricing(s, Number(p.price), p.original_price, nowMs)
        if (!pr.gbActive) return null
        return {
          product_id: p.id,
          name: p.name,
          image_url: p.image_url,
          category: p.category,
          list_price: pr.listPrice,
          gb_price: pr.effectivePrice,
          discount_pct: pr.discountPct,
          // 🔴 대표 UX 기준 ③ — 소비자 화면은 **신뢰 + 마감·잔여**를 강조한다. 그 둘을 응답에 싣는다.
          deadline: s.deadline ?? null,
          stock: p.stock == null ? null : Number(p.stock),
          // 📦 픽업 — 비어 있으면 **키 자체를 null** 로 내려 화면이 빈 껍데기를 안 그리게 한다.
          pickup: (() => { const pk = parsePickup(metaMap?.get(Number(p.id)) ?? null); return isEmptyPickup(pk) ? null : pk })(),   // ⚠️ SSOT 는 products.stock (stock_quantity 아님 — schema-refs 가드)
          // ⚠️ promo_pct · per_unit_commission 은 **의도적으로 없다**(소비자에게 수수료 비노출 — 대표 확정).
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .slice(0, limit)

    c.header('Cache-Control', 'public, max-age=30')
    c.header('CDN-Cache-Control', 'public, max-age=120')
    return c.json({ success: true, data: items })
  } catch {
    return c.json({ success: false, error: '상품을 불러오지 못했습니다' }, 500)
  }
})

// ── GET /:slug/products/:id — 그 몰의 상품 **하나** ────────────────────────────
/**
 * 🔴 왜 본진 `/api/products/:id` 를 안 쓰는가 〔대표 지시 2026-08-11 "철저히 분리"〕
 *
 * 본진 상세는 **공구가를 모른다.** `resolveGbPricing` 을 안 부르고 `current_price` 도 안 싣는다
 * (grep 0건) — 그래서 몰 카드가 7,000원인 상품이 본진 상세에선 **10,000원(상시가)** 으로 보였다.
 * 손님이 살지 말지 정하는 바로 그 화면에서 가격이 올라간다.
 *
 * 여기서는 **목록과 같은 함수로 같은 값**을 낸다(`resolveGbPricing`). 두 화면이 같은 계산을
 * 쓰는 것이 요점이라, 값을 복사하지 않고 함수를 공유한다.
 *
 * ① **몰 스코프가 쿼리에** — 타 몰·본진 상품은 여기로 한 건도 안 나간다(목록과 같은 방침).
 * ② **수수료 비노출** — promo%·소개비를 안 싣는다(목록과 같은 정책).
 * ③ **공구가 아니면 404** — 몰 상품이어도 공구 세션이 죽어 있으면 이 화면은 존재하지 않는다.
 *    ⚠️ `gbActive` 판정도 목록과 **같은 함수**다. 여기만 느슨하면 목록에 없는 상품이 상세로 열린다.
 *
 * ⚠️ `SELECT *` 금지(D1 컬럼 한도) — 명시 목록만. 상세에 필요한 것만 고른다.
 */
app.get('/:slug/products/:id', async (c) => {
  try {
    const mall = await resolve(c)
    if (!mall) return c.json({ success: false, error: '몰을 찾을 수 없습니다', code: 'MALL_NOT_FOUND' }, 404)

    const id = intParam(c.req.param('id'), 0)
    if (!id) return c.json({ success: false, error: '잘못된 상품 ID', code: 'BAD_ID' }, 400)

    const p = await c.env.DB.prepare(
      `SELECT p.id, p.name, p.price, p.original_price, p.image_url, p.detail_images,
              p.description, p.category, p.stock, p.seller_id
         FROM products p
        WHERE p.id = ?
          AND COALESCE(p.mall_id, 1) = ?
          AND p.is_active = 1
          AND NOT EXISTS (SELECT 1 FROM sellers s WHERE s.id = p.seller_id AND s.is_active = 0)`
    ).bind(id, Number(mall.id)).first<{
      id: number; name: string; price: number; original_price: number | null
      image_url: string | null; detail_images: string | null; description: string | null
      category: string; stock: number | null; seller_id: number | null
    }>().catch(() => null)
    // 없는 상품과 **남의 몰 상품을 같은 404** 로 — 존재 여부를 흘리지 않는다(seller-gb 와 같은 방침).
    if (!p) return c.json({ success: false, error: '상품을 찾을 수 없습니다', code: 'PRODUCT_NOT_FOUND' }, 404)

    const session = await getGbSession(c.env.DB, id).catch(() => null)
    const pricing = session ? resolveGbPricing(session, Number(p.price), p.original_price, Date.now()) : null
    if (!session || !pricing?.gbActive) {
      return c.json({ success: false, error: '진행 중인 공동구매가 아닙니다', code: 'GB_INACTIVE' }, 404)
    }

    const metaMap = await getSupplyMeta(c.env.DB, [id]).catch(() => null)
    const pk = parsePickup(metaMap?.get(id) ?? null)

    // detail_images 는 JSON 문자열로 저장된다 — 깨져 있으면 조용히 빈 배열(상세가 죽지 않게).
    let detailImages: string[] = []
    try {
      const arr = p.detail_images ? JSON.parse(p.detail_images) : null
      if (Array.isArray(arr)) detailImages = arr.filter((x): x is string => typeof x === 'string')
    } catch { /* 깨진 JSON — 이미지 없이 진행 */ }

    c.header('Cache-Control', 'public, max-age=30')
    c.header('CDN-Cache-Control', 'public, max-age=120')
    return c.json({
      success: true,
      // 🖼️ 몰 이름을 함께 싣는다 — 워커 SSR 이 **이 응답 하나로** 카톡 카드를 만든다
      //   (몰을 따로 또 조회하면 상세 SSR 이 self-fetch 를 두 번 하게 된다).
      mall: { id: Number(mall.id), name: String(mall.brand_name || mall.name || ''), slug: String(mall.slug) },
      data: {
        product_id: p.id,
        name: p.name,
        description: p.description,
        image_url: p.image_url,
        detail_images: detailImages,
        category: p.category,
        seller_id: p.seller_id,
        list_price: pricing.listPrice,
        gb_price: pricing.effectivePrice,
        discount_pct: pricing.discountPct,
        deadline: session.deadline ?? null,
        stock: p.stock == null ? null : Number(p.stock),
        pickup: isEmptyPickup(pk) ? null : pk,
        // ⚠️ promo_pct · per_unit_commission 은 **의도적으로 없다**(소비자 수수료 비노출 — 목록과 동일).
      },
    })
  } catch {
    return c.json({ success: false, error: '상품을 불러오지 못했습니다' }, 500)
  }
})

export { app as mallPublicRoutes }
