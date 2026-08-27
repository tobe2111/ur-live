/**
 * 🎟️ 공구 마켓플레이스 (인플루언서 뷰) — 2026-07-06 공구 엔진 §4
 *   현재 promo 걸린 공구(live) 목록을 인플루언서가 탐색. promo% 높은 순 정렬 + 카테고리/지역 필터.
 *   각 딜에 per-unit 예상 소개비(공구가 × promo%). 담기는 기존 핀(/api/curator/me/pins) 재사용(클라).
 *   ⚠️ 게이트: platform_settings.gb_engine_enabled==='true' 일 때만 목록 반환(그 외 빈 목록).
 *   잠금 파일(group-buy-public) 미변경 — 별도 라우트.
 */
import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'
import { requireAuth } from '../../../worker/middleware/auth'
import { getGbSessions } from '../../../worker/utils/gb-session-store'
import { resolveGbPricing, isGbActive } from '../../../shared/gb-session'
import { isVoucherCategory } from '../../../shared/constants/voucher-categories'
import { intParam } from '../../../shared/pagination'

const app = new Hono<{ Bindings: Env }>()

function authUserId(c: { get?: (k: string) => unknown }): number | null {
  const user = c.get?.('user') as { id?: number } | undefined
  const raw = user?.id ?? c.get?.('userId')
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

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

// GET /my-performance — 소개 콘솔: 내가 담은(핀) 진행 중 공구별 실적(판매·확정/예정 소개비)
app.get('/my-performance', requireAuth(), async (c) => {
  try {
    const db = c.env.DB
    if (!(await gbEngineOn(db))) return c.json({ success: true, data: [], gb_engine: false })
    const uid = authUserId(c)
    if (!uid) return c.json({ success: false, error: '로그인 필요' }, 401)
    const nowMs = Date.now()

    // 내 핀 상품
    const pins = await db.prepare('SELECT product_id FROM product_pins WHERE user_id = ?')
      .bind(uid).all<{ product_id: number }>().catch(() => ({ results: [] as Array<{ product_id: number }> }))
    const pinIds = (pins.results || []).map(r => Number(r.product_id)).filter(n => Number.isFinite(n) && n > 0)
    if (pinIds.length === 0) return c.json({ success: true, data: [], gb_engine: true })

    // 그 중 공구 live 인 것만
    const sessions = await getGbSessions(db, pinIds)
    const liveIds = pinIds.filter(id => { const s = sessions.get(id); return s && isGbActive(s, nowMs) })
    if (liveIds.length === 0) return c.json({ success: true, data: [], gb_engine: true })

    const ph = liveIds.map(() => '?').join(',')
    // 상품 정보
    const prods = await db.prepare(`SELECT id, name, image_url, price FROM products WHERE id IN (${ph})`)
      .bind(...liveIds).all<{ id: number; name: string; image_url: string | null; price: number }>()
      .catch(() => ({ results: [] as any[] }))
    // 내 어필리에이트 적립 집계(상품별): 판매 건수 · 확정(granted) · 예정(holding). refunded 제외.
    const earn = await db.prepare(
      `SELECT product_id, COUNT(*) AS sales,
              COALESCE(SUM(CASE WHEN status='granted' THEN commission ELSE 0 END),0) AS confirmed,
              COALESCE(SUM(CASE WHEN COALESCE(status,'pending')='holding' THEN commission ELSE 0 END),0) AS pending_amt
       FROM affiliate_earnings
       WHERE referrer_id = ? AND product_id IN (${ph}) AND COALESCE(status,'pending') != 'refunded'
       GROUP BY product_id`
    ).bind(String(uid), ...liveIds).all<{ product_id: number; sales: number; confirmed: number; pending_amt: number }>()
      .catch(() => ({ results: [] as any[] }))
    const eMap = new Map<number, { sales: number; confirmed: number; pending_amt: number }>()
    for (const r of earn.results || []) eMap.set(Number(r.product_id), { sales: Number(r.sales) || 0, confirmed: Number(r.confirmed) || 0, pending_amt: Number(r.pending_amt) || 0 })

    const data = (prods.results || []).map(p => {
      const s = sessions.get(Number(p.id))!
      const pr = resolveGbPricing(s, Number(p.price), null, nowMs)
      const e = eMap.get(Number(p.id)) || { sales: 0, confirmed: 0, pending_amt: 0 }
      return {
        product_id: p.id, name: p.name, image_url: p.image_url,
        gb_price: pr.effectivePrice, promo_pct: pr.promoPct, deadline: s.deadline ?? null,
        sales: e.sales, confirmed_commission: e.confirmed, pending_commission: e.pending_amt,
      }
    }).sort((a, b) => (b.confirmed_commission + b.pending_commission) - (a.confirmed_commission + a.pending_commission))

    return c.json({ success: true, data, gb_engine: true })
  } catch {
    return c.json({ success: false, error: '실적을 불러오지 못했습니다' }, 500)
  }
})

export { app as gbMarketplaceRoutes }
