/**
 * 🛠️ 유어애즈 인플루언서 풀 — **실행(ops)** 엔드포인트: 수집 버스트 · 전체 정비 · 시트 동기화.
 *   admin-ads-influencers.routes.ts 에서 분리(파일크기 상한 준수). 같은 /api/admin/ads 마운트라 경로 불변.
 *
 *   공통 성질: 셋 다 **실제 작업은 ur-ads 워커에 위임**한다(서비스바인딩 env.ADS). 이유는 두 가지 —
 *     ① 수집/정비 코드를 메인 번들에 넣지 않는다 ② 각 단계가 fresh 인보케이션(서브리퀘스트·CPU 예산)을 받는다.
 *   길게 도는 것(버스트·정비)은 waitUntil 로 던지고 즉시 응답 → **브라우저가 페이지를 떠나도 서버는 계속 돈다.**
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { isCollectRunning, isMaintainRunning } from './collect-lease' // ⚠️ 수집 엔진(influencer-auto-collect) import 금지 — 메인 번들 경량 유지

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// (2026-07-23 전수조사: 구 단발 수집 /influencer-pool/collect 엔드포인트 제거 — UI 는 collect-burst 만 호출,
//  유지되던 두 번째 트리거 경로가 lease 도입 후에도 표면만 넓혀 삭제. 필요 시 collect-burst 가 완전 상위 호환.)

// POST /api/admin/ads/influencer-pool/collect-burst — 🔥 오늘 YT 검색 예산 즉시 소진(버스트)
//   대표 "YT 검색 예산 최대한 바로 다 쓰는 방향". 배경: YT 무료 상한 = 하루 10k units = 검색 100회.
//   워커 한 실행은 30s·서브리퀘스트 한도라 100회를 한 번에 못 쏨(2026-07-20 'Too many subrequests' 사고).
//   병렬 실행은 공유 카운터(ads_yt_search_used)/커서를 경합해 중복 발굴로 쿼터 낭비 → **순차만 안전**.
//   ⇒ 백그라운드에서 수집 런을 연달아(각각 fresh ur-ads 인보케이션 = fresh 예산) 돌려 예산 소진까지 태움.
//   시간/횟수/진전 가드로 워커 과부하·무한루프 차단. 한 클릭에 다 못 태우면 카운터가 영속이라 재클릭/시간당 cron 이 이어받음.
type BurstStats = { youtube_quota_hit?: boolean; yt_budget?: { used?: number; total?: number } }
app.post('/influencer-pool/collect-burst', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  // 🔒 이미 돌고 있으면 시작하지 않고 그대로 알린다 — 예전엔 lease 가 조용히 막는데 UI 는 "시작했어요" 라고
  //   거짓 성공을 띄웠다(페이지 이탈 후 재진입 시 흔한 경로). 경합 방지는 여전히 lease 가 담당.
  if (await isCollectRunning(c.env.DB).catch(() => false)) return c.json({ success: true, busy: true, started: false })
  const burn = async () => {
    const startedAt = Date.now()
    let prevUsed = -1
    let reason = 'loop_cap' // 🔎 종료 사유 기록(전수조사 — "시작했어요" 이후 블랙박스이던 것 가시화)
    for (let i = 0; i < 40; i++) {
      if (Date.now() - startedAt > 220_000) { reason = 'time_cap'; break } // ⏱️ 시간 예산 — 남은 건 재클릭/cron 이 이어받음
      let body: { chained?: boolean; stats?: BurstStats } | null = null
      try {
        // self-chain 엔드포인트 — ads 에 SELF 바인딩이 있으면 chained=true 로 백그라운드 자가전파(메인 루프 종료).
        const r = await ads.fetch(new Request(`https://ur-ads/__ads/collect-chain?depth=${i}&pu=${prevUsed}`, { method: 'POST' }))
        body = (await r.json().catch(() => null)) as { chained?: boolean; stats?: BurstStats } | null
      } catch { reason = 'fetch_error'; break }
      if (!body) { reason = 'bad_response'; break }
      if (body.chained) { reason = 'chained'; break }          // ads(SELF)가 백그라운드로 자가전파 — 중복발화 방지
      const stats = body.stats
      if (!stats) { reason = 'no_stats'; break }
      if (stats.youtube_quota_hit) { reason = 'quota_hit'; break } // 구글이 초과 선언 — 오늘 끝
      const yb = stats.yt_budget
      if (!yb || typeof yb.used !== 'number' || typeof yb.total !== 'number') { reason = 'busy_or_no_budget'; break } // lease busy 포함
      if (yb.used >= yb.total) { reason = 'budget_done'; break }   // 오늘 예산(기본 100회) 소진 — 완료
      if (yb.used <= prevUsed) { reason = 'no_progress'; break }   // 진전 없음(YT 키워드 소진/YT 불가)
      prevUsed = yb.used
    }
    await c.env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_burst_last', JSON.stringify({ at: new Date().toISOString(), reason, lastUsed: prevUsed })).run().catch(() => null)
  }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(burn()); return c.json({ success: true, started: true }) }
  await burn().catch(() => null) // 폴백(waitUntil 미지원): 동기 소진
  return c.json({ success: true, started: false })
})

// POST /api/admin/ads/influencer-pool/maintain-all — 🧰 전체 정비 원클릭
//   개별 정비 버튼 7개를 사람이 순서 지켜 누르는 건 재현이 어렵고 순서가 틀리면 낭비다(예: 병합으로 사라질 행에
//   점수를 먼저 매김). 순서는 이미 야간 cron 이 정답을 갖고 있으므로 **그 SSOT 를 그대로 재사용**한다 —
//   새 파이프라인을 만들지 않는 게 핵심(둘이 갈라지면 "밤엔 되는데 버튼은 안 되는" 클래스가 생긴다).
//     ① runNightlyMaintenance = 중복병합 → 연락처 재추출 → 재분류 → 품질점수 (로컬 D1 만, 외부 API 0)
//     ② runNightlyRescan      = 카테고리 재보정 → 라이브 재조회 → 네이버 스윕 (**YouTube 쿼터 소비**)
//   ⚠️ ②는 수집과 **같은 하루 YT 예산**을 쓴다 → 수집 진행 중이면 ②를 건너뛴다(신규 발굴이 우선).
//   ur-ads 에 위임하는 이유: 각 단계가 fresh 인보케이션(서브리퀘스트 예산)을 받아야 중간에 안 잘린다.
app.post('/influencer-pool/maintain-all', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 야간 cron 만 동작' }, 503)
  // 🔒 이미 정비가 돌고 있으면 새로 시작하지 않는다 — 버튼이 waitUntil 이라 즉시 다시 활성화되므로
  //   연타하면 파이프라인이 겹쳐 병합 레이스 + YouTube 쿼터 중복 소모가 난다(진짜 가드는 파이프라인 내부 lease).
  if (await isMaintainRunning(c.env.DB).catch(() => false)) return c.json({ success: true, busy: true, started: false })
  const collecting = await isCollectRunning(c.env.DB).catch(() => false)
  const hop = async (path: string) => {
    try {
      const r = await ads.fetch(new Request(`https://ur-ads${path}`, { method: 'POST' }))
      const j = await r.json().catch(() => null) as { ok?: boolean } | null
      return j?.ok === true
    } catch { return false }
  }
  const runAll = async () => {
    const out: Record<string, unknown> = { at: new Date().toISOString(), skipped_rescan: collecting }
    out.maintenance = await hop('/__ads/maintenance')
    if (!collecting) out.rescan = await hop('/__ads/maintenance-rescan') // YT 쿼터 경합 회피
    await c.env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_maintain_all_last', JSON.stringify(out).slice(0, 1000)).run().catch(() => null)
  }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(runAll()); return c.json({ success: true, started: true, skipped_rescan: collecting }) }
  await runAll().catch(() => null) // 폴백(waitUntil 미지원): 동기
  return c.json({ success: true, started: false, skipped_rescan: collecting })
})

// POST /api/admin/ads/influencer-pool/sheets-sync — 📊 구글시트 수동 동기화(ur-ads 위임, 동기 응답).
//   시트 미러는 수초 내라 결과(행수/에러)를 그대로 전달 — 설정 안내가 사용자에게 보여야 함.
app.post('/influencer-pool/sheets-sync', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정' }, 503)
  try {
    const r = await ads.fetch(new Request('https://ur-ads/__ads/sheets-sync', { method: 'POST' }))
    const j = await r.json().catch(() => null) as { ok?: boolean; rows?: number; error?: string } | null
    if (j?.ok) return c.json({ success: true, rows: j.rows || 0 })
    return c.json({ success: false, error: j?.error || '동기화 실패' }, 400)
  } catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

export { app as adminAdsPoolOpsRoutes }
