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
import { intParam } from '@/shared/pagination'
import { rankInfluencersForStore, getInfluencerMetrics, getMatchingCoverage, categoryLabel } from './matching'
import { callClaude } from './claude-client'

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
  const limit = Math.max(1, Math.min(50, intParam(c.req.query('limit'), 20)))
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

// GET /api/admin/matching/coverage — 데이터 준비도(매칭 신뢰도 한눈에)
app.get('/coverage', async (c) => {
  const coverage = await getMatchingCoverage(c.env.DB)
  return c.json({ success: true, coverage })
})

// POST /api/admin/matching/ai-rationale { category, region } — AI 매칭 근거(집계·가명만 전송)
app.post('/ai-rationale', async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const category = cleanCategory(typeof b.category === 'string' ? b.category : undefined)
  const region = cleanRegion(typeof b.region === 'string' ? b.region : undefined)
  const candidates = await rankInfluencersForStore(c.env.DB, { category, regionPrefix: region, limit: 8 })
  const measured = candidates.filter((x) => x.confidence !== 'cold')
  if (!measured.length) {
    return c.json({ success: true, rationale: '', enough: false, note: '실측 표본이 부족합니다(n<5 억제). 유입→방문 데이터가 쌓이면 AI 근거를 생성합니다.' })
  }
  // ⚠️ 집계·가명만 전송 — user_id/PII 없음(공개 handle·집계 지표만). 개인 식별 불가.
  const lines = measured.map((x, i) =>
    `${i + 1}. ${x.handle ? '@' + x.handle : '인플루언서#' + x.influencerId} · 적합도 ${x.fitScore}/100 · 매장방문 ${x.visits} · 재방문율 ${x.repeatRate}% · 업종전환 ${x.suppressed ? '표본부족' : x.categoryCvr + '%'}`,
  ).join('\n')
  const r = await callClaude(c.env.ANTHROPIC_API_KEY, {
    system: '너는 유어딜 직영 에이전시의 매칭 애널리스트다. 팔로워가 아니라 실제 전환(매장방문·재방문·업종전환)을 근거로, 이 업종·상권에 어떤 인플루언서를 우선 붙일지 3~4줄로 추천한다. 근거는 주어진 집계 지표만 사용(개인정보 추정 금지). 표본이 얇으면 신중하게 표현.',
    user: `업종: ${categoryLabel(category)} / 상권코드: ${region || '전체'}\n실측 후보(집계·가명):\n${lines}\n\n어느 인플루언서를 우선 제안할지와 그 근거를 알려줘.`,
    maxTokens: 700,
  })
  if (!r.ok) {
    const status = r.error === 'NOT_CONFIGURED' ? 503 : 502
    return c.json({ success: false, error: r.error === 'NOT_CONFIGURED' ? 'AI 근거는 ANTHROPIC_API_KEY 설정 후 사용할 수 있습니다.' : r.error }, status)
  }
  return c.json({ success: true, rationale: r.text, enough: true })
})

export { app as adminMatchingRoutes }
