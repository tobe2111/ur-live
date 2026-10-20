/**
 * 📊 **인플루언서 풀 조회 라우트** — 누적 통계 + 일자별 타임라인(KST).
 *
 * 본문은 `pool-timeline.ts`(SSOT — 두 풀의 컬럼 차이와 KST 보정을 그 파일이 책임진다).
 * 여기 있는 이유는 순수 위생이다: `admin-ads-influencers.routes.ts` 가 600줄 캡을 넘었다.
 *
 * ⚠️ 업체(B2B) 풀의 같은 엔드포인트는 `partner-pool.routes.ts` 에 있다 — 라우터가 다르기 때문이고,
 *   **집계 로직은 두 곳이 같은 SSOT 를 부른다**(따로 짜면 반드시 갈라진다).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { getPoolTimeline, resolveDays } from './pool-timeline'
import { buildInfluencerPoolStats } from './influencer-pool-stats'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

const app = new Hono<{ Bindings: Env }>()

// GET /api/admin/ads/influencer-pool/timeline?days=30 — **며칠에 얼마나 수집됐나**.
//   누적 총계만으로는 "언제 멈췄나"를 못 본다 — 라이브 판정에서 매번 하트비트를 손으로 뒤지던 자리다.
app.get('/influencer-pool/timeline', async (c) =>
  c.json({ success: true, timeline: await getPoolTimeline(adsLeadsDb(c.env), 'influencer', resolveDays(c.req.query('days'))) }))

// GET /api/admin/ads/influencer-pool/stats — 누적/최근 실행 통계 + 플랫폼별 카운트
//   집계 본문은 `influencer-pool-stats.ts`(SSOT) — 이 라우트는 인증/응답만.
app.get('/influencer-pool/stats', async (c) => c.json({ success: true, ...await buildInfluencerPoolStats(c.env) }))

export { app as poolReadRoutes }
