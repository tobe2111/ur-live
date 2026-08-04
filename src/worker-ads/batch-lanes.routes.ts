/**
 * 🚦 **부모에서 인라인으로 돌던 무거운 레인들** — 라우트로 승격 (2026-08-02).
 *
 * 생 `ctx.waitUntil(async () => { await import(…); await run(env) })` 은 자식이 아니라
 * **부모 CPU 를 직접 태운다**. 실측:
 * ```
 *   daily-batch          4,107ms   (18:00 UTC — collect-commerce 짝수시와 겹치는 최악 회차)
 *   social-maintenance   2,390ms   (매 회차)
 * ```
 * 그 시간대에 꼬리 레인들이 `Worker exceeded CPU time limit` 로 잘렸다.
 * `kick` 경유로 옮기면 각자 **자기 인보케이션 예산**을 받고, 예산 분산(`dispatch-budget`)에도 잡힌다.
 *
 * ⚠️ 하트비트는 `/__ads/*` self-beat 미들웨어가 쓴다 — 부모 쪽 중복 기록을 넣지 말 것.
 * ⚠️ 다른 우회 레인 5개(autobid·outreach-webhook·weekly-report·social-draft·sheets-mirror)는
 *   아직 인라인이다. 그중 `sheets-mirror` 는 **이미 내부에서 SELF.fetch 로 자식에 위임**하므로
 *   부모 비용이 작다(D1 1읽기 + fetch 1) — 옮길 이유가 약하다. 나머지는 드물게 돌아 실측 비용이
 *   아직 없다. **실측 없이 옮기지 말 것.**
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

const app = new Hono<{ Bindings: Env }>()

const fail = (err: unknown) => {
  const e = err as { name?: string; message?: string } | null
  return { ok: false as const, error: `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }
}

app.post('/__ads/daily-batch', async (c) => {
  try {
    const { runAdsDailyBatch } = await import('./daily-batch') // 5단계 순차(순서에 의미) — 그 파일 헤더 참조
    await runAdsDailyBatch(c.env)
    return c.json({ ok: true })
  } catch (err) { return c.json(fail(err), 500) }
})

// 🔔 레인 침묵 요약 — 유어애즈 채널로 push(하루 1회). 설계·소음 억제는 `silence-digest.ts` 헤더.
app.post('/__ads/silence-digest', async (c) => {
  try {
    const { runAdsSilenceDigest } = await import('./silence-digest')
    return c.json({ ok: true, stats: await runAdsSilenceDigest(c.env) })
  } catch (err) { return c.json(fail(err), 500) }
})

app.post('/__ads/social-maintenance', async (c) => {
  try {
    const { handleSocialMaintenance } = await import('@/worker/cron/social-maintenance')
    await handleSocialMaintenance(c.env)
    return c.json({ ok: true })
  } catch (err) { return c.json(fail(err), 500) }
})

export { app as batchLaneRoutes }
