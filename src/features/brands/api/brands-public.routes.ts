/**
 * 🏷️ 브랜드 페이지 공개 API (2026-10-17 대표 "응응 다 해줘" — 프랜차이즈를 손님에게 한 브랜드로)
 *
 *   GET /api/brands/:slug              — 브랜드 + 지점(위치 포함) + 지점들의 이용권
 *   GET /api/brands/of-store/:sellerId — 그 지점이 속한 브랜드(이용권 상세의 "다른 지점 보기" 링크)
 *     `?product=` 를 붙이면 그 이용권을 쓸 수 있는 지점 수(`usable_branches`)도 — 2026-10-18 브랜드 전 지점 사용
 *
 * ## 노출 규칙은 메인 피드와 **같은 술어**를 쓴다
 * 승인된 지점만(`approvedSellerProductSql`) · 도매 원본 제외(`consumerVisibleProductSql`) · 본진 몰 범위
 * (`mainScopeFor`) · 판매 중 이용권만. 두 벌이면 브랜드 페이지에서만 승인 전 지점이 보이는 날이 온다.
 *
 * ## "내 주변 지점" 정렬은 화면이 한다
 * 서버는 좌표만 준다(손님 위치를 서버에 보내지 않는다 — 캐시가 사람마다 갈리지 않게).
 *
 * 💰 돈 안 움직임 — 읽기 전용.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { ensureStoreBrands, brandOfStore, normalizeBrandSlug } from '@/worker/utils/store-brands'
import { brandSiblingsOf, isBrandWideEnabled } from '@/worker/utils/brand-wide-redeem'
import { getSellerMeta } from '@/worker/utils/seller-meta'
import { allInChunks } from '@/worker/utils/d1-in-chunks'
import { approvedSellerProductSql, consumerVisibleProductSql } from '@/shared/db/consumer-visible-product'
import { mainScopeFor } from '@/worker/utils/consumer-scope'
import { VOUCHER_CATEGORIES } from '@/shared/constants/voucher-categories'
import { CARD_COLS } from '@/features/sections/api/section-rules'
import { toPublicProductRows } from '@/shared/constants/demo-products'

const app = new Hono<{ Bindings: Env }>()

/** 브랜드 페이지에 싣는 상한 — 지점·이용권. 응답 크기 보호용. */
export const BRAND_MAX_STORES = 300
export const BRAND_MAX_PRODUCTS = 120

app.get('/of-store/:sellerId', async (c) => {
  try {
    const sellerId = Number(c.req.param('sellerId'))
    if (!Number.isFinite(sellerId) || sellerId <= 0) return c.json({ success: true, data: null })
    const b = await brandOfStore(c.env.DB, sellerId).catch(() => null)
    // 지점이 하나뿐인 브랜드는 링크를 걸 이유가 없다 — 화면이 "다른 지점" 을 약속하지 않게.
    if (!b || Number(b.branch_count) <= 1) return c.json({ success: true, data: null })
    // 🏷️ 2026-10-18 `?product=` 가 오면 그 이용권을 실제로 받아 주는 지점 수도 싣는다(사용 순간과 같은 판정).
    //   0 이면 "전 지점 사용" 을 말하지 않는다 — 켜 두었어도 받아 줄 지점이 없으면 약속이 거짓이 된다.
    const productId = Number(c.req.query('product'))
    let usable_branches = 0
    // 🏷️ 3단계 — 받기를 켠 **다른 점주** 지점 수. 소개 링크로 산 이용권은 그 지점들이 받지 않으므로(결재 ②)
    //   같은 주인 지점과 섞어 "어디서나" 로 약속하지 않고 따로 싣는다. 게이트가 꺼져 있으면 0.
    let cross_owner_branches = 0
    if (Number.isFinite(productId) && productId > 0 && await isBrandWideEnabled(c.env.DB, productId).catch(() => false)) {
      const owner = await c.env.DB.prepare('SELECT seller_id FROM products WHERE id = ? LIMIT 1').bind(productId)
        .first<{ seller_id: number | null }>().catch(() => null)
      if (owner?.seller_id && Number(owner.seller_id) === sellerId) {
        const { siblings } = await brandSiblingsOf(c.env.DB, sellerId)
        const n = siblings.filter((s) => s.accepting).length
        cross_owner_branches = siblings.filter((s) => !s.accepting && s.crossOwnerOk).length
        // 판 지점 자신 포함. 같은 주인 지점이 없어도 다른 점주 지점이 받으면 판 지점 1곳은 센다.
        usable_branches = n > 0 || cross_owner_branches > 0 ? n + 1 : 0
      }
    }
    return c.json({ success: true, data: { ...b, usable_branches, cross_owner_branches } })
  } catch (err) {
    return safeError(c, err, '브랜드를 불러오지 못했습니다', '[brands]')
  }
})

app.get('/:slug', async (c) => {
  try {
    const slug = normalizeBrandSlug(c.req.param('slug'))
    if (!slug) return c.json({ success: false, error: '브랜드를 찾을 수 없습니다' }, 404)
    const db = c.env.DB
    await ensureStoreBrands(db)
    const brand = await db.prepare('SELECT id, slug, name FROM store_brands WHERE slug = ? AND deleted_at IS NULL LIMIT 1')
      .bind(slug).first<{ id: number; slug: string; name: string }>()
    if (!brand) return c.json({ success: false, error: '브랜드를 찾을 수 없습니다' }, 404)

    const { results: storeRows } = await db.prepare(
      `SELECT s.id, s.business_name, s.name, s.address, s.username
         FROM store_brand_members m JOIN sellers s ON s.id = m.seller_id
        WHERE m.brand_id = ? AND COALESCE(s.status, '') IN ('approved', 'active')
        ORDER BY s.id LIMIT ${BRAND_MAX_STORES}`,
    ).bind(brand.id).all<{ id: number; business_name: string | null; name: string | null; address: string | null; username: string | null }>()
    const ids = (storeRows || []).map((s) => Number(s.id))
    const meta = ids.length ? await getSellerMeta(db, ids).catch(() => new Map<number, Record<string, string>>()) : new Map<number, Record<string, string>>()
    const stores = (storeRows || []).map((s) => {
      const m = meta.get(Number(s.id)) || {}
      const lat = Number(m.store_lat), lng = Number(m.store_lng)
      return {
        seller_id: Number(s.id),
        name: m.store_name || s.business_name || s.name || '',
        address: m.store_address || s.address || '',
        lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
        lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
      }
    })

    const cats = VOUCHER_CATEGORIES as readonly string[]
    const scope = await mainScopeFor(db, 'products', 'p')
    const rows = await allInChunks(ids, (chunk, marks) => db.prepare(
      `SELECT ${CARD_COLS}, p.seller_id
         FROM products p
        WHERE p.seller_id IN (${marks})
          AND p.category IN (${cats.map(() => '?').join(',')})
          AND p.is_active = 1 AND p.group_buy_status = 'active'
          AND ${consumerVisibleProductSql('p')}
          AND ${approvedSellerProductSql('p')}${scope}
        ORDER BY COALESCE(p.sold_count, 0) DESC, p.id DESC
        LIMIT ${BRAND_MAX_PRODUCTS}`,
    ).bind(...chunk, ...cats).all<Record<string, unknown>>().then((r) => r.results || []), 80)
    const products = toPublicProductRows(rows)
      .sort((a, b) => Number(b.sold_count || 0) - Number(a.sold_count || 0))
      .slice(0, BRAND_MAX_PRODUCTS)

    return c.json({ success: true, data: { brand: { slug: brand.slug, name: brand.name }, stores, products } })
  } catch (err) {
    return safeError(c, err, '브랜드를 불러오지 못했습니다', '[brands]')
  }
})

export const brandsPublicRoutes = app
