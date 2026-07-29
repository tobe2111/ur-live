/**
 * 🎯 인플루언서 수집·보강 트리거 — `src/worker-ads/index.ts` 에서 분리 (2026-07-29).
 *
 *   분리 이유: `public-data.routes.ts`(2026-07-28)와 같다 — index.ts 가 600줄 래칫에 닿았고,
 *   여러 세션이 계속 라우트를 얹는 자리다. 우회(`[SKIP_SIZE]`) 대신 성격이 하나인 핸들러群을 뗀다.
 *   여기 모인 셋은 전부 *인플루언서 공용 풀*을 채우는 레인의 얇은 위임이고, 로직은
 *   `features/marketing/api/influencer-*.ts` 에 있다.
 *
 *   ⚠️ 경로는 모두 `/__ads/*` — 메인 프록시는 `/api/ads/*` · `/l/*` 만 위임하므로 **외부에서 도달 불가**하고,
 *   호출자는 메인 어드민(서비스바인딩 `env.ADS`)과 크론(SELF)뿐이다. 그래서 게이트 무관(수동=의도).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

export const influencerRoutes = new Hono<{ Bindings: Env }>()

// 🎯 인플루언서 수동 수집 트리거 — 메인 어드민이 env.ADS(서비스바인딩)로만 호출(공개 라우팅 대상 아님:
//   메인 프록시는 /api/ads/* · /l/* 만 위임 → /__ads/* 는 외부에서 도달 불가). 게이트 무관(수동=의도).
influencerRoutes.post('/__ads/collect', async (c) => {
  try {
    const { runInfluencerAutoCollect } = await import('@/features/marketing/api/influencer-auto-collect')
    const stats = await runInfluencerAutoCollect(c.env)
    return c.json({ ok: true, stats })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 🔁 인플루언서 수집 self-chain — YT 예산 버스트용. 한 인보케이션이 1회 수집 후, 예산이 남고 SELF 바인딩이 있으면
//   다음 인보케이션(fresh 서브리퀘스트 예산)을 waitUntil 로 던지고 즉시 반환 → 오케스트레이터 시간제한 없이
//   하루 예산(기본 100회)을 백그라운드에서 끝까지 소진. 가드: depth 40 상한 + 예산소진/쿼터초과/진전없음 시 중단.
//   SELF 미바인딩이면 chained=false 로 1회만 실행(메인 오케스트레이터가 시간예산 내 폴백). 메인 어드민/자기자신만 호출.
influencerRoutes.post('/__ads/collect-chain', async (c) => {
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
  const ytDone = !!stats?.youtube_quota_hit || !yb || used >= total || used <= prevUsed // YT 소진/쿼터/진전없음
  // 🔁 2026-07-29 **최소 라운드 바닥** — 중단조건이 전부 YT 기준이라 일일 예산(90) 소진 후(하루의 대부분)
  //   첫 호출이 즉시 done → 매시간 1라운드로 주저앉았다. 정작 볼륨 주력인 네이버를 막는 건 쿼터가 아니라
  //   인보케이션당 서브리퀘스트 예산이다(실측: 키워드 16개 중 3개 처리 → 210개 한 바퀴 70시간).
  //   ⇒ YT 무관하게 N라운드는 잇는다(라운드 = 새 예산). 커서는 처리분만 전진하므로 중복 0.
  //   busy(lease 보유)면 즉시 중단 — 더 이어도 전부 busy 로 튕긴다. 경위: docs/CURRENT_WORK.md 10차.
  const rounds = Math.min(12, Math.max(1, parseInt((c.env as unknown as { ADS_COLLECT_ROUNDS?: string }).ADS_COLLECT_ROUNDS || '', 10) || 4))
  const done = !!stats?.busy || depth >= 40 || (depth + 1 >= rounds && ytDone)
  let chained = false
  if (!done && c.env.SELF?.fetch && c.executionCtx?.waitUntil) {
    chained = true
    c.executionCtx.waitUntil(c.env.SELF.fetch(new Request(`https://ur-ads/__ads/collect-chain?depth=${depth + 1}&pu=${used}`, { method: 'POST' })).then(() => undefined).catch(() => undefined))
  }
  return c.json({ ok: true, stats, chained })
})

// 📝 인플루언서 풀 보강 1라운드(블로거 활동성·연락처 + 링크인바이오) — 수집과 **분리된 인보케이션**.
//   왜 분리했는지는 `influencer-enrich-lane.ts` 헤더(라이브 실측: 수집에 얹혀 있어 한 건도 못 돌았음).
//   💥 원문 릴레이 — 'FAILED' 로 뭉개면 라운드가 왜 안 도는지 라이브에서 알 길이 없다(파트너풀 레인과 동일).
influencerRoutes.post('/__ads/enrich-influencer', async (c) => {
  try {
    const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
    return c.json({ ok: true, stats: await runInfluencerEnrich(c.env) })
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    return c.json({ ok: false, error: `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }, 500)
  }
})

/**
 * 🔁 보강 self-chain — 라운드를 **오케스트레이터가 아니라 각 라운드가** 잇는다(2026-07-29).
 *
 *   그 전엔 cron 이 `enrich-influencer` 를 6번 직접 불렀다. 라운드마다 부모 인보케이션의 서브리퀘스트를
 *   1개씩 쓰는데, 부모는 다른 레인들과 그 예산을 공유한다 — 이 파일 이웃(시트 미러)이 이미 기록해 둔
 *   실패 양식이 정확히 그것이다: **부모가 예산을 다 쓰면 SELF.fetch 1개조차 못 써서 러너가 시작조차 못 한다.**
 *   그 피해는 waitUntil 목록에서 뒤에 선 레인이 받는다(이 세션 범위 밖의 레인들).
 *   ⇒ 부모 비용을 1로 고정하고 라운드는 여기서 잇는다. 라운드 수(`ADS_INFLUENCER_ENRICH_ROUNDS`)는 불변.
 *
 *   ⏹️ 백로그가 비면 조기 종료한다 — 할 일이 없는데 남은 라운드를 다 도는 것은 순수 낭비다.
 */
influencerRoutes.post('/__ads/enrich-influencer-chain', async (c) => {
  const depth = Math.max(0, parseInt(c.req.query('depth') || '0', 10) || 0)
  let stats: { bio?: number; yt?: number; naver?: { tried?: number } } | null = null
  try {
    const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
    stats = await runInfluencerEnrich(c.env)
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    return c.json({ ok: false, error: `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }, 500)
  }
  const rounds = Math.min(20, Math.max(1, parseInt((c.env as unknown as { ADS_INFLUENCER_ENRICH_ROUNDS?: string }).ADS_INFLUENCER_ENRICH_ROUNDS || '', 10) || 6))
  const didWork = (stats?.bio || 0) + (stats?.yt || 0) + (stats?.naver?.tried || 0) > 0
  const done = !didWork || depth + 1 >= rounds || depth >= 40 // 무대상/라운드 소진/깊이 상한
  let chained = false
  if (!done && c.env.SELF?.fetch && c.executionCtx?.waitUntil) {
    chained = true
    c.executionCtx.waitUntil(c.env.SELF.fetch(new Request(`https://ur-ads/__ads/enrich-influencer-chain?depth=${depth + 1}`, { method: 'POST' })).then(() => undefined).catch(() => undefined))
  }
  return c.json({ ok: true, stats, chained, depth })
})
