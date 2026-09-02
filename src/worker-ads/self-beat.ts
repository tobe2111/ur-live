/**
 * 🫀 **레인이 자기 하트비트를 쓴다** — 관측을 *호출자*에서 *관측 대상*으로 옮긴다 (2026-07-29).
 *
 * ## 무엇이 잘못돼 있었나 (라이브 실측)
 * 하트비트는 지금까지 **부모 cron 이** 썼다 — `await env.SELF.fetch(레인)` 이 **응답을 받은 뒤에**.
 * 그런데 서비스 바인딩 피호출자는 호출자보다 오래 살 수 없고(#874), 부모의 수명은 느린 레인의
 * 작업 시간보다 짧다. 그래서 이런 일이 벌어졌다:
 *
 * ```
 *   reclassify : 자기 스탬프 16:01:09 (= 일을 끝냈다)  ↔  하트비트 13:01 (3시간 전)
 *   collect-commerce : 자기 스탬프 14:00 · 하트비트 **아예 없음**
 * ```
 *
 * 즉 **일을 끝낸 레인의 기록이 사라진다.** 그리고 그 모습은 화면에서 *멈춘 레인*과 구분되지 않는다 —
 * 이 레포가 반복해서 만난 실패("부재는 침묵과 다르게 생겼다")가 관측 계층 자체에서 재현된 것이다.
 *
 * ## 처방
 * 레인 자신이 **응답하기 직전에** 자기 하트비트를 쓴다. 부모의 쓰기는 그대로 두는데(폴백),
 * 같은 키에 쓰므로 마지막 것이 남을 뿐 충돌하지 않는다. 의미가 이렇게 바뀐다:
 *
 * | 기록 | 이전 의미 | 지금 의미 |
 * |---|---|---|
 * | 있음 | 부모가 응답을 받았다 | **레인이 일을 끝냈다** |
 * | 없음 | 안 돌았다 *또는* 부모가 먼저 죽었다(구분 불가) | 끝내지 못했다(진실) |
 *
 * ## 왜 이름·주기를 부모가 넘기나
 * 레인은 **자기 주기를 모른다**(일 1회인지 매시간인지는 부모의 시각 게이트가 안다). 주기를 모른 채
 * 쓰면 기본값(매시간)이 박혀 일 1회 레인이 **정상인데도 stale 경보**를 낸다 — 그건 #882 가 방금 고친 버그다.
 * 그래서 부모가 `_beat`(고정 이름)와 `_gap`(기대 간격)을 쿼리로 넘긴다.
 * ⚠️ 이름을 경로에서 유추하지 **않는다**: 옛 이름이 남아 stale watch 가 영원히 우는 사고(`sweep-kakao-phone`)
 *   때문에 이름은 부모가 고정해 넘긴 값만 쓴다.
 *
 * ## 한계 (과신 금지)
 * - 레인이 **중간에 죽으면** 여전히 기록이 없다. 그건 옳다 — 끝내지 못한 것이 사실이니까.
 * - 부모가 살아 있으면 쓰기가 두 번 일어난다(부모+자기). 같은 키라 결과는 같고, 비용은 레인 쪽
 *   인보케이션의 D1 쓰기 1회다.
 */
import type { Env } from '@/worker/types/env'
import { readEnvMeter } from '@/worker/utils/d1-read-meter'

/** 부모가 넘기는 쿼리 파라미터 이름 — 양쪽이 같은 상수를 쓰게(오타가 조용히 관측을 끈다). */
export const BEAT_PARAM = '_beat'
export const GAP_PARAM = '_gap'

/** `kick` 이 만드는 URL — 이름·주기를 레인에게 함께 넘긴다. */
export function laneUrl(path: string, beat: string, gap?: number): string {
  const sep = path.includes('?') ? '&' : '?'
  const g = Number.isFinite(gap) && (gap as number) > 0 ? `&${GAP_PARAM}=${Math.round(gap as number)}` : ''
  return `https://ur-ads${path}${sep}${BEAT_PARAM}=${encodeURIComponent(beat)}${g}`
}

/** 쿼리에서 이름·주기를 읽는다. 이름이 없으면 **아무것도 하지 않는다**(부모가 안 넘긴 호출 = 수동 트리거). */
export function readBeatParams(url: string): { beat: string; gap?: number } | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  const beat = u.searchParams.get(BEAT_PARAM)
  if (!beat) return null
  const raw = parseInt(u.searchParams.get(GAP_PARAM) || '', 10)
  return { beat, gap: Number.isFinite(raw) && raw > 0 ? raw : undefined }
}

/**
 * 레인 응답 직전에 자기 하트비트를 남긴다. **절대 던지지 않는다**(관측이 작업을 막으면 안 된다).
 * @param ok 핸들러가 정상 종료했는가(예외 없이 응답에 도달했는가)
 */
export async function writeSelfBeat(env: Env, beat: string, ok: boolean, ms: number, gap?: number, err?: unknown): Promise<void> {
  try {
    const { recordCronBeat } = await import('@/worker/utils/cron-heartbeat')
    // ⚠️ cronExpr 은 넘기지 않는다 — 레인은 자기를 부른 cron 식을 모르고, 넘겨봐야 매시간으로 오인된다.
    //   주기는 부모가 넘긴 `gap`(maxGapMin)만 신뢰한다(그게 이 파라미터가 생긴 이유다).
    // 📏 이 인보케이션(=이 레인 1회)이 읽은 D1 행 수를 함께 싣는다(엔트리가 env 를 계량 래퍼로 감싼다).
    await recordCronBeat(env, `ads:${beat}`, ok, ms, undefined, ok ? undefined : failNote(err), gap, readEnvMeter(env))
  } catch { /* 관측 실패는 삼킨다 */ }
}

/**
 * 🔎 **실패 사유를 자식이 남긴다** — 부모는 구조적으로 볼 수 없기 때문이다 (2026-07-31 라이브 장애).
 *
 *   07-31 06:15 실측: ads 레인 **15개**가 매시간 `err=Error` 로 실패하는데, 같은 레인을 수동 트리거로
 *   직접 부르면 **완벽히 정상**이었다(`tried 19 · spent 44/45 · 13.1s`). 즉 고장은 레인 본문이 아니라
 *   부모의 kick ↔ 자식 인보케이션 사이인데, **왜 죽었는지는 어디에도 없었다**:
 *     · `kick` 은 `SELF.fetch` 의 status 를 안 본다 → 자식이 500 을 주면 `ok:true` 로 기록된다.
 *       즉 `ok:false` 는 **fetch 자체가 거부**된 것 = 자식이 죽은 것이고, 그 메시지는 자식과 함께 사라진다.
 *     · 부모가 남기는 `cronErrorCode` 는 **부모가 본** 에러만 본다 → 전부 `err=Error` 로 뭉개진다
 *       (그래서 "한도인가 아닌가"조차 구분되지 않는다 — 그 구분이 처방을 정하는 값인데도).
 *   기존 코드는 여기에 `{ err: 'LANE_ERROR' }` 상수를 넣고 있었다. 부모의 `err=Error` 와 **정확히 같은
 *   양의 정보**, 즉 0 이다.
 *
 *   ⚠️ **못 잡는 것**: 인보케이션이 통째로 강제 종료되면 이 코드는 실행되지 않는다.
 *     그 경우 기록이 **없다**는 사실 자체가 신호다 — "핸들러가 던졌다"(기록 있음)와 갈린다.
 *   ⚠️ 핸들러가 스스로 잡아 5xx 를 **반환**한 경우도 err 가 없다 → 상태코드만 남는다(본문은 안 읽는다,
 *     읽으면 응답 스트림을 소비한다).
 */
function failNote(err: unknown): Record<string, unknown> {
  if (err === undefined) return { err: 'STATUS_5XX' } // 던지지 않고 5xx 를 반환한 경우
  const e = err as { name?: string; message?: string } | null
  const msg = String(e?.message || err || '')
  return { err: e?.name || 'Error', ...(msg ? { detail: msg.slice(0, 160) } : {}) }
}

/**
 * 🫀 `/__ads/*` 미들웨어 — 레인이 **자기** 하트비트를 쓴다. 부모가 `_beat`/`_gap` 을 넘긴 호출에서만 동작한다
 *   (수동 트리거는 파라미터가 없어 무영향 — 그 비대칭이 2026-08-01 장애 진단의 결정적 단서였다).
 *
 * ⏳ **beat 쓰기를 응답 경로에 두지 않는다.** 처음엔 `finally` 에서 `await` 했는데, 그 한 줄이 자식의 수명을
 *   핸들러 종료 **이후로** 늘렸다. 피호출자는 호출자보다 오래 못 산다(#874) — 부모는 ~20개 레인의
 *   `SELF.fetch` 를 동시에 붙잡고 있어 수명 가장자리가 얇고, 거기 있던 느린 레인이 D1 쓰기 1회만큼 넘어가
 *   죽는다. 죽으면 이 `finally` 도 실행되지 않아 **기록조차 안 남는다** — 관측 코드가 관측 대상을 죽이고
 *   자기 기록까지 지우는 형태다.
 *
 * ⚠️ 이 인과는 **정황이다**(반증 재료 있음: 11.5초에 실패를 기록한 레인도 있었다). 원인 규명은 `detail`
 *   관측에 맡기고, 여기서는 어느 쪽이든 옳은 것만 한다 — **관측은 응답을 느리게 만들면 안 된다.**
 * ⚠️ 트레이드오프: `waitUntil` 도 인보케이션 종료 시 취소될 수 있어 일부 beat 를 놓칠 수 있다. 다만 지금
 *   그 레인들은 beat 를 **아예 못 남기고** 있으므로 나빠질 여지가 없다.
 */
export function selfBeatMiddleware() {
  return async (c: BeatCtx, next: () => Promise<void>): Promise<void> => {
    const t0 = Date.now()
    const p = readBeatParams(c.req.url)
    if (!p) return next()
    let ok = true
    let thrown: unknown
    try { await next() } catch (err) { ok = false; thrown = err; throw err } finally {
      const beat = writeSelfBeat(c.env, p.beat, ok && (c.res?.status ?? 500) < 500, Date.now() - t0, p.gap, thrown)
      try { c.executionCtx.waitUntil(beat) } catch { await beat } // executionCtx 없으면(테스트 등) 종전대로
    }
  }
}

/** 미들웨어가 실제로 쓰는 것만 — Hono Context 전체 타입을 끌어오지 않는다(이 파일은 워커 엔트리와 독립이다). */
interface BeatCtx {
  req: { url: string }
  env: Env
  res?: { status?: number }
  executionCtx: { waitUntil(p: Promise<unknown>): void }
}
