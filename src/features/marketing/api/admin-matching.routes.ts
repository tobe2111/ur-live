/**
 * 🤝 2026-07-14 인플루언서↔업체 성과기반 매칭 — **어드민 전용 내부 운영 도구**.
 *   유어애즈(/ads) 인플루언서 발굴 패널 옆에 붙지만 **플랫폼 어드민 인증(requireAdmin) 잠금** —
 *   직영 에이전시(운영자)가 "이 업종·상권에서 실제 전환이 높았던 인플루언서"를 판단하는 화면.
 *   매장·인플루언서 공개 뷰는 데이터·법무 충분해지면(나중). /api/admin/matching/*.
 *
 *   읽기 전용 집계(matching.ts) — inflow_clicks·voucher_visits·orders. 데이터 희소해도 작동(n<5 억제,
 *   테이블 없으면 빈 결과). 머니 무접촉(정산은 matching-settlement.ts 별도·게이트).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { isVoucherCategory } from '@/shared/constants/voucher-categories'
import { rankInfluencersForStore, getInfluencerMetrics } from './matching'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

/** 업종 파라미터 — 알려진 voucher 카테고리만(그 외 무필터). */
function cleanCategory(v: string | undefined): string | null {
  const s = (v || '').trim()
  return s && isVoucherCategory(s) ? s : null
}
/** 상권(구) 코드 — 숫자 5자리만. */
function cleanRegion(v: string | undefined): string | null {
  const s = (v || '').trim()
  return /^\d{5}$/.test(s) ? s : null
}

// GET /api/admin/matching/influencers?category=&region=&limit= — 성과기반 인플루언서 랭킹(어드민 판단용)
app.get('/influencers', async (c) => {
  const category = cleanCategory(c.req.query('category'))
  const region = cleanRegion(c.req.query('region'))
  const limit = Math.max(1, Math.min(50, Number(c.req.query('limit')) || 20))
  const candidates = await rankInfluencersForStore(c.env.DB, { category, regionPrefix: region, limit })
  return c.json({ success: true, candidates, context: { category, region } })
})

// GET /api/admin/matching/influencers/:id — 인플루언서 성과 상세(업종/상권 분해)
app.get('/influencers/:id', async (c) => {
  const influencerId = String(c.req.param('id') || '')
  if (!/^\d{1,12}$/.test(influencerId)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const metrics = await getInfluencerMetrics(c.env.DB, influencerId)
  return c.json({ success: true, metrics })
})

export { app as adminMatchingRoutes }
