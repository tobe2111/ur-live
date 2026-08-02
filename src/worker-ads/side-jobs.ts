/**
 * 🧹 **레인이 아닌 시각-고정 잡무** — `index.ts` 에서 추출 (2026-08-02, 600줄 캡).
 *
 *   자동입찰·팔로업 리마인더·주간 리포트는 **디스패치 예산의 레인이 아니다**(`kick` 을 안 거친다).
 *   그래서 엔트리에 인라인으로 있어도 얻는 게 없고, 스케줄러 본문만 길어진다.
 *   ⚠️ **동작은 byte-동일**하다 — 조건·순서·하트비트 이름·fail-soft 처리 전부 그대로 옮겼다.
 *     자리를 만들려고 뺀 것이지 고치려고 뺀 게 아니다(둘을 한 커밋에 섞으면 회귀를 못 가른다).
 *
 *   ⚠️ 이들은 생 `ctx.waitUntil` 로 부모 CPU 를 직접 쓴다 — 예산 우회 래칫
 *     (`check-ads-dispatch-bypass.mjs`)이 세는 대상이 **아니다**(그 가드는 `scheduled()` 본문만 본다).
 *     무거워지면 `kick` 으로 옮기는 것을 검토할 것.
 */
import type { Env } from '@/worker/types/env'

type BeatFn = (name: string, ok: boolean, ms: number, err?: unknown, maxGapMin?: number) => Promise<void>
type Defer = (p: Promise<unknown>) => void

/** 자동입찰 — 게이트 ON 일 때만(매시간). 기본 OFF = no-op. */
export function runAutobidJob(env: Env, beat: BeatFn, defer: Defer): void {
  if (env.ADS_AUTOBID_ENABLED !== 'true') return
  defer((async () => {
    const t0 = Date.now()
    try {
      const { runAutobidAll } = await import('@/features/marketing/api/autobid')
      await runAutobidAll(env)
      await beat('autobid', true, Date.now() - t0)
    } catch (err) { await beat('autobid', false, Date.now() - t0, err) }
  })())
}

/**
 * 매일 23:00 UTC(=08:00 KST) — 아웃리치 팔로업 리마인더(무응답·회신도착 다이제스트).
 * 0건이면 무발송(no-op) — Discord 스팸 방지. 자동 감지는 웹훅이 실시간 처리, 여기선 요약만.
 */
export function runFollowupJob(env: Env, hourUTC: number, beat: BeatFn, defer: Defer, gapMin: number): void {
  if (hourUTC !== 23) return
  defer((async () => {
    const t0 = Date.now()
    try { const { runFollowupReminder } = await import('@/features/marketing/api/outreach-webhook'); await runFollowupReminder(env) } catch { /* fail-soft */ }
    await beat('followup-reminder', true, Date.now() - t0, undefined, gapMin)
  })())
}

/** 월요일 00:00 UTC — 소셜 초안 + 유어애즈 AI 주간 리포트. 둘 다 개별 fail-soft(하나가 죽어도 다른 하나는 돈다). */
export function runWeeklyJob(env: Env, hourUTC: number, dowUTC: number, beat: BeatFn, defer: Defer, gapMin: number): void {
  if (hourUTC !== 0 || dowUTC !== 1) return
  defer((async () => {
    const t0 = Date.now()
    try { const { handleSocialDraft } = await import('@/worker/cron/social-draft'); await handleSocialDraft(env) } catch { /* fail-soft */ }
    try { const { handleAdsWeeklyReport } = await import('@/features/marketing/api/weekly-report'); await handleAdsWeeklyReport(env) } catch { /* fail-soft */ }
    await beat('weekly-report', true, Date.now() - t0, undefined, gapMin)
  })())
}
