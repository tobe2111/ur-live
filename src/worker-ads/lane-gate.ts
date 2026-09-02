/**
 * 🚧 **레인 진입 미들웨어** — 하트비트를 남기고, 정지·예산이면 여기서 세운다 (2026-09-02).
 *
 * ## 왜 이 파일이 생겼나 — 차단기가 걸렸는데 레인이 계속 돌았다
 * 라이브 실측(19:00 KST): 원장은 `used=1,708,128 budget=1,500,000 over=true` 였고 그 정각 회차는
 * 면제 2개만 띄웠다(= cron 게이트는 정상). **그런데 10~25분 뒤에도 레인이 계속 돌았다**:
 * ```
 *   10:15 UTC  collect(rr 85,130) · collect-neis(rw 40,004) · collect-webkr · collect-hira
 *   10:24 UTC  enrich-influencer(rr 194,610) · -3 · -4
 * ```
 * ur-ads 의 cron 은 `0 * * * *` **하나뿐**이다(`wrangler-ads.toml`) — 저건 cron 이 아니다.
 *
 * 원인은 **레인을 띄우는 길이 셋인데 게이트가 둘에만 있었다**는 것이다:
 * ① cron `kick`(있음) ② DO 알람(있음) ③ **자기-체인 `SELF.fetch('/__ads/…')`(없음)**.
 * ③ 은 한 인보케이션의 CPU·서브리퀘스트 천장을 넘기려고 레인이 스스로 다음 회차를 HTTP 로 부르는
 * 길이라(`chain.routes.ts` 등) 부모의 판단을 한 번도 안 거친다. 즉 **차단기는 "새로 시작"만 막고
 * "이미 달리는 체인"은 못 세웠다** — 하루치를 넘긴 뒤에도 체인이 남은 하루를 계속 쓴다.
 *
 * ⚠️ 같은 구멍이 **수동 정지 스위치(`ADS_LANES_PAUSED`)에도 그대로** 있었다. 사고 때 쓰라고 만든
 *    스위치가 사고 때 안 듣는 것이 더 나쁘다.
 *
 * ## 왜 초크포인트인가 (체인 호출부마다 검사하지 않고)
 * 체인 kick 은 여러 파일에 흩어져 있고 **앞으로도 늘어난다**. 호출부마다 검사를 심으면 새로 생긴
 * 하나가 조용히 빠진다 — `check-ads-dispatch-bypass` 를 만들어야 했던 바로 그 이유다.
 * 모든 길은 결국 `/__ads/*` 라우트로 들어오므로, 여기 하나면 ①②③ 과 **아직 없는 ④** 까지 덮는다.
 *
 * ## 계약
 * - 순서: **self-beat 가 먼저** — 막힌 회차도 하트비트를 남겨야 침묵 감시가 '죽음'으로 오인하지 않는다.
 * - 면제 경로(`pauseExempt`)는 통과 — 사람에게 한 약속과 **관측**(멈춘 이유를 보는 창).
 * - 막을 땐 **200 + `skipped`**(5xx 아님). 체인 부모가 실패로 읽고 재시도하면 그게 또 부하다.
 * - 비용: 레인 인보케이션당 원장 DO 조회 **1 서브리퀘스트**. 막힌 회차는 그 한 번으로 끝난다.
 *
 * 🔻 롤백: `mountLaneMiddleware` 에서 게이트 `app.use` 한 줄 제거(게이트 ①② 는 그대로 남는다).
 */
import type { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { selfBeatMiddleware } from './self-beat'
import { laneEntryBlock } from './lane-pause'
import { readBudgetState, budgetBlocked } from './read-budget'

export function mountLaneMiddleware(app: Hono<{ Bindings: Env }>): void {
  // 🫀 레인이 자기 하트비트를 쓴다 — 미들웨어 본체와 근거는 `self-beat.ts`(그 모듈의 관심사다).
  app.use('/__ads/*', selfBeatMiddleware())
  // 🚧 진입 초크포인트 — 판정은 순수 함수(`lane-pause.ts` — 게으름까지 시험이 고정한다). 여기선 배선만.
  app.use('/__ads/*', async (c, next) => {
    const blocked = await laneEntryBlock(
      new URL(c.req.url).pathname,
      c.env,
      async (env) => budgetBlocked(await readBudgetState(env)),
    )
    if (!blocked) return next()
    return c.json({ ok: true, skipped: blocked })
  })
}
