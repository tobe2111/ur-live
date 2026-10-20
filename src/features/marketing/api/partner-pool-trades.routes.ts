/**
 * 🎛️ 파트너(업체) 풀 — **업종 단위 수집 제어** 라우트 (2026-08-02 대표 "페이지에서 직접 설정").
 *
 *   `partner-pool.routes.ts` 에 얹지 않고 분리한 이유: 그 파일이 598줄로 600 캡에 붙어 있다.
 *   억지로 넣으면 캡을 넘고, 캡을 올리면 god 파일 래칫의 의미가 사라진다.
 *   (인증은 마운트하는 쪽의 `requireAdmin()` 이 `'*'` 로 이미 걸어 준다 — 여기서 다시 걸지 않는다.)
 *
 *   왜 키워드가 아니라 업종인지는 `company-trades.ts` 헤더 참조(실측 4,546키워드 ↔ 32업종).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { listCompanyTrades, setCompanyTradeActive } from './company-trades'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

const app = new Hono<{ Bindings: Env }>()

// GET /api/admin/partner-pool/keyword-trades — 업종별 집계(키워드 수·활성 수·누적 수확).
app.get('/', async (c) => c.json({ success: true, trades: await listCompanyTrades(adsLeadsDb(c.env)) }))

// PATCH /api/admin/partner-pool/keyword-trades { trade, active } — 그 업종의 전 지역 키워드 일괄 on/off.
//   ⚠️ 마지막 활성 업종은 거부한다(`LAST_ACTIVE_TRADE`) — 전부 끄면 수집이 **에러 없이** 멈추고
//   하트비트는 초록으로 남는다. 조용히 무시하지 않고 사유를 응답으로 돌려준다.
app.patch('/', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { trade?: string; active?: boolean }
  const r = await setCompanyTradeActive(adsLeadsDb(c.env), b.trade || '', b.active === true)
  return c.json(r.ok ? { success: true, changed: r.changed } : { success: false, error: r.error }, r.ok ? 200 : 400)
})

export default app
