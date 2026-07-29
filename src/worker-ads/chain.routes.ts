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
import { isHardConfigFailure } from '@/features/marketing/api/public-data-diag'

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

/**
 * 🔁 인허가(매장 후보) 수집 self-chain (2026-07-29) — **유어딜 이용권의 공급 DB 가 0 인 원인**.
 *
 *   실측: `store_prospects` 24,160 건 중 **학원이 24,038(99.5%)**, 인허가 레인의 `total_saved` 는 **0**.
 *   즉 유어딜이 실제로 파는 네 업종(일반음식점·휴게음식점·미용업·숙박업)이 **한 건도 없다.**
 *
 *   원인은 산수다: `mode=collect` 는 **하루 1회**인데 업종이 16개고 업종당 최대 6페이지다. 한 인보케이션
 *   예산(40~60)으로는 1~2 업종밖에 못 훑는다 → 그날의 나머지 업종은 `pending` 으로 남고, 다음 날은 또
 *   새 날이 큐에 추가된다 → 밀린 날이 `MAX_PENDING_DAYS`(14)를 넘으면 **버려진다**(영구 누락).
 *   ⇒ 커서(업종 인덱스)는 이미 정확히 구현돼 있다. 부족한 건 **인보케이션 횟수**뿐이다.
 *
 *   중단 조건: ① 남은 날 없음(`pending_days=0`) ② 깊이 상한 ③ **하드 설정 실패**(404·활용신청 등 —
 *   재시도로 안 낫는 실패에 체인을 돌리면 그냥 낭비다. 오늘 만든 `isHardConfigFailure` 재사용).
 *   ⚠️ '수확 0' 은 중단 사유가 **아니다** — 예산이 끊겨 0인 경우가 바로 체인이 필요한 상황이다.
 */
chainRoutes.post('/__ads/collect-localdata-chain', async (c) => {
  const depth = Math.max(0, parseInt(c.req.query('depth') || '0', 10) || 0)
  const maxDepth = Math.min(24, Math.max(1, parseInt((c.env as { ADS_LOCALDATA_CHAIN?: string }).ADS_LOCALDATA_CHAIN || '', 10) || 6))
  let stats: Awaited<ReturnType<typeof import('@/features/marketing/api/localdata-collect').runLocalDataCollect>> | null = null
  try {
    const { runLocalDataCollect } = await import('@/features/marketing/api/localdata-collect')
    stats = await runLocalDataCollect(c.env)
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
  const done = !stats || !stats.pending_days || depth + 1 >= maxDepth || isHardConfigFailure(stats.diag?.error)
  let chained = false
  if (!done && c.env.SELF?.fetch && c.executionCtx?.waitUntil) {
    chained = true
    c.executionCtx.waitUntil(c.env.SELF.fetch(new Request(`https://ur-ads/__ads/collect-localdata-chain?depth=${depth + 1}`, { method: 'POST' })).then(() => undefined).catch(() => undefined))
  }
  return c.json({ ok: true, stats, chained, depth })
})

export default chainRoutes
