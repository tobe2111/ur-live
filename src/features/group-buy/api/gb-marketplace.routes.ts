/**
 * 🎟️ 공구 마켓플레이스 (인플루언서 뷰) — 2026-07-06 공구 엔진 §4
 *   현재 promo 걸린 공구(live) 목록을 인플루언서가 탐색. promo% 높은 순 정렬 + 카테고리/지역 필터.
 *   각 딜에 per-unit 예상 소개비(공구가 × promo%). 담기는 기존 핀(/api/curator/me/pins) 재사용(클라).
 *   ⚠️ 게이트: platform_settings.gb_engine_enabled==='true' 일 때만 목록 반환(그 외 빈 목록).
 *   잠금 파일(group-buy-public) 미변경 — 별도 라우트.
 */
import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'
import { getGbSessions } from '../../../worker/utils/gb-session-store'
import { resolveGbPricing } from '../../../shared/gb-session'
import { isVoucherCategory } from '../../../shared/constants/voucher-categories'
import { intParam } from '../../../shared/pagination'

const app = new Hono<{ Bindings: Env }>()

async function gbEngineOn(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT value FROM platform_settings WHERE key = 'gb_engine_enabled'")
    .first<{ value: string }>().catch(() => null)
  return row?.value === 'true'
}

// GET /api/gb-marketplace — 진행 중 공구 목록(promo 순)
app.get('/', async (c) => {
  try {
    const db = c.env.DB
    if (!(await gbEngineOn(db))) return c.json({ success: true, data: [], gb_engine: false })

    const category = c.req.query('category') || ''
    const region = c.req.query('region') || ''
    const limit = Math.min(100, Math.max(1, intParam(c.req.query('limit'), 50)))
    const nowMs = Date.now()

    // 1) live/scheduled gb 세션을 가진 product_id 수집(사이드테이블).
    const idRows = await db.prepare(
      "SELECT DISTINCT product_id FROM product_supply_meta WHERE key = 'gb_mode' AND value IN ('live','scheduled')"
    ).all<{ product_id: number }>().catch(() => ({ results: [] as Array<{ product_id: number }> }))
    const ids = (idRows.results || []).map(r => Number(r.product_id)).filter(n => Number.isFinite(n) && n > 0)
    if (ids.length === 0) return c.json({ success: true, data: [], gb_engine: true })

    // 2) 상품 로드(활성 + 정지셀러 제외). 명시 컬럼만.
    const ph = ids.map(() => '?').join(',')
    const prodRows = await db.prepare(
      `SELECT p.id, p.name, p.price, p.original_price, p.image_url, p.category, p.seller_id,
              p.restaurant_name, p.region_si, p.region_gu
       FROM products p
       WHERE p.id IN (${ph}) AND p.is_active = 1
         AND NOT EXISTS (SELECT 1 FROM sellers s WHERE s.id = p.seller_id AND s.is_active = 0)`
    ).bind(...ids).all<{
      id: number; name: string; price: number; original_price: number | null; image_url: string | null
      category: string; seller_id: number | null; restaurant_name: string | null; region_si: string | null; region_gu: string | null
    }>().catch(() => ({ results: [] as any[] }))

    // 3) gb 세션 일괄 로드 + live 필터 + 실효가/promo 산출.
    const sessions = await getGbSessions(db, ids)
    const items = (prodRows.results || [])
      .filter(p => isVoucherCategory(p.category))
      .map(p => {
        const s = sessions.get(Number(p.id))
        if (!s) return null
        const pr = resolveGbPricing(s, Number(p.price), p.original_price, nowMs)
        if (!pr.gbActive || pr.promoPct <= 0) return null // 진행 중 + promo 있는 것만
        const perUnitCommission = Math.round(pr.effectivePrice * pr.promoPct / 100)
        return {
          product_id: p.id, name: p.name, image_url: p.image_url, category: p.category,
          region_si: p.region_si, region_gu: p.region_gu, restaurant_name: p.restaurant_name,
          list_price: pr.listPrice, gb_price: pr.effectivePrice, discount_pct: pr.discountPct,
          promo_pct: pr.promoPct, deadline: s.deadline ?? null, target: s.target ?? null,
          per_unit_commission: perUnitCommission, link_only: pr.linkOnly,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .filter(x => !category || x.category === category)
      .filter(x => !region || (x.region_si || '').includes(region) || (x.region_gu || '').includes(region))
      .sort((a, b) => b.promo_pct - a.promo_pct || b.discount_pct - a.discount_pct)
      .slice(0, limit)

    return c.json({ success: true, data: items, gb_engine: true })
  } catch {
    return c.json({ success: false, error: '공구 목록을 불러오지 못했습니다' }, 500)
  }
})

export { app as gbMarketplaceRoutes }
