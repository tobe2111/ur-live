/**
 * 🔁 유어애즈 self-chain 진입점 모음 — `src/worker-ads/index.ts` 에서 분리 (2026-07-29).
 *
 *   왜 한 모듈인가: 두 엔드포인트는 성격이 정확히 같다 — **인보케이션당 서브리퀘스트 천장 때문에
 *   한 번에 다 못 하는 일**을, SELF kick(= 새 인보케이션 = 새 예산)으로 이어 돌린다.
 *   크론은 시간당 1회지만 체인은 그 안에서 여러 라운드를 돈다.
 *
 *   ⚠️ 체인의 유일한 위험은 **진전 없는 라운드의 반복**이다(한도 즉시 도달·대상 소진).
 *   그래서 두 곳 모두 [진전 없음 → 중단] + [깊이 상한] 을 반드시 갖는다. 하나라도 빠지면
 *   외부 쿼터만 태우고 아무것도 안 남는 루프가 된다.
 *
 *   ⚠️ 경로는 `/__ads/*` — 메인 프록시는 `/api/ads/*`·`/l/*` 만 위임하므로 외부 도달 불가.
 *   호출자는 메인 어드민(서비스바인딩)·크론(SELF)·자기 자신뿐이다.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

export const chainRoutes = new Hono<{ Bindings: Env }>()

// 🔁 인플루언서 수집 self-chain — YT 예산 버스트용. 한 인보케이션이 1회 수집 후, 예산이 남고 SELF 바인딩이 있으면
//   다음 인보케이션(fresh 서브리퀘스트 예산)을 waitUntil 로 던지고 즉시 반환 → 오케스트레이터 시간제한 없이
//   하루 예산(기본 100회)을 백그라운드에서 끝까지 소진. 가드: depth 40 상한 + 예산소진/쿼터초과/진전없음 시 중단.
//   SELF 미바인딩이면 chained=false 로 1회만 실행(메인 오케스트레이터가 시간예산 내 폴백). 메인 어드민/자기자신만 호출.
chainRoutes.post('/__ads/collect-chain', async (c) => {
  const depth = Math.max(0, parseInt(c.req.query('depth') || '0', 10) || 0)
  const pv = parseInt(c.req.query('pu') || '-1', 10); const prevUsed = Number.isFinite(pv) ? pv : -1
  let stats: import('@/features/marketing/api/influencer-auto-collect').AutoCollectStats | null = null
  try {
    const { runInfluencerAutoCollect } = await import('@/features/marketing/api/influencer-auto-collect')
    stats = await runInfluencerAutoCollect(c.env)
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
  const yb = stats?.yt_budget
  const used = yb && typeof yb.used === 'number' ? yb.used : -1
  const total = yb && typeof yb.total === 'number' ? yb.total : 0
  const done = !!stats?.youtube_quota_hit || !yb || used >= total || used <= prevUsed || depth >= 40 // 소진/쿼터/진전없음/깊이 상한
  let chained = false
  if (!done && c.env.SELF?.fetch && c.executionCtx?.waitUntil) {
    chained = true
    c.executionCtx.waitUntil(c.env.SELF.fetch(new Request(`https://ur-ads/__ads/collect-chain?depth=${depth + 1}&pu=${used}`, { method: 'POST' })).then(() => undefined).catch(() => undefined))
  }
  return c.json({ ok: true, stats, chained })
})

/**
 * 🔁 카카오 전화 스윕 self-chain (2026-07-29) — **처리량이 진짜 병목이라서** 필요하다.
 *
 *   산수: 연락처 없는 리드가 **145,809** 건인데 한 인보케이션이 도는 건 ~55 건이고 크론은 시간당 1회다
 *   → 전부 훑는 데 **110일**. 인보케이션당 서브리퀘스트가 천장이라 한 번에 더 하는 건 불가능하지만,
 *   SELF kick 은 **새 인보케이션 = 새 예산**이다(위 인플루언서 체인이 같은 이유로 이미 존재).
 *
 *   중단 조건(헛돌기 방지): ① 대상 소진(done) ② **진전 없음(tried=0)** ③ 깊이 상한.
 *   ⚠️ 기본 깊이를 6 으로 낮게 잡은 이유: 카카오 로컬 쿼터는 10만/일로 알려져 있지만 **우리 실소비를
 *      아직 측정한 적이 없다**. 스윕 stats 의 `day_lookups`(KST 일 단위, 어드민 상태줄에 노출)로 실제
 *      소비를 본 뒤 `ADS_KAKAO_SWEEP_CHAIN` 으로 올린다. 추측으로 먼저 올리면 같은 키를 쓰는 보강
 *      레인까지 쿼터를 잃는다 — 이 세션에서 반복 확인한 실패 방식이다(문서 수치 > 실측).
 */
chainRoutes.post('/__ads/sweep-kakao-chain', async (c) => {
  const depth = Math.max(0, parseInt(c.req.query('depth') || '0', 10) || 0)
  const maxDepth = Math.min(24, Math.max(1, parseInt((c.env as { ADS_KAKAO_SWEEP_CHAIN?: string }).ADS_KAKAO_SWEEP_CHAIN || '', 10) || 6))
  let stats: Awaited<ReturnType<typeof import('@/features/marketing/api/company-collect').runKakaoPhoneSweep>> | null = null
  try {
    const { runKakaoPhoneSweep } = await import('@/features/marketing/api/company-collect')
    stats = await runKakaoPhoneSweep(c.env)
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
  const done = !stats || stats.done || !stats.tried || depth + 1 >= maxDepth
  let chained = false
  if (!done && c.env.SELF?.fetch && c.executionCtx?.waitUntil) {
    chained = true
    c.executionCtx.waitUntil(c.env.SELF.fetch(new Request(`https://ur-ads/__ads/sweep-kakao-chain?depth=${depth + 1}`, { method: 'POST' })).then(() => undefined).catch(() => undefined))
  }
  return c.json({ ok: true, stats, chained, depth })
})

export default chainRoutes
