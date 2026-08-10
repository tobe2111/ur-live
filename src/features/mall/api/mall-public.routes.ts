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
import { lookupConsumerMall } from '../../../worker/utils/mall-consumer'
import { getGbSessions } from '../../../worker/utils/gb-session-store'
import { resolveGbPricing } from '../../../shared/gb-session'
import { intParam } from '../../../shared/pagination'
import { resolveMallBranding } from '../../../shared/mall/branding'
import { parsePickup, isEmptyPickup } from '../../../shared/pickup'
import { getSupplyMeta } from '../../../worker/utils/product-supply-meta'

const app = new Hono<{ Bindings: Env }>()

/** 몰 확정 — 없으면 null(호출부가 404). */
async function resolve(c: { env: Env; req: { param: (k: string) => string } }) {
  return lookupConsumerMall(c.env.DB, c.req.param('slug'))
}

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
    const prodRows = await db.prepare(
      `SELECT p.id, p.name, p.price, p.original_price, p.image_url, p.category, p.stock
         FROM products p
        WHERE COALESCE(p.mall_id, 1) = ?
          AND p.is_active = 1
          AND NOT EXISTS (SELECT 1 FROM sellers s WHERE s.id = p.seller_id AND s.is_active = 0)
        ORDER BY p.id DESC
        LIMIT 200`
    ).bind(Number(mall.id)).all<{
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

export { app as mallPublicRoutes }
