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
export async function writeSelfBeat(env: Env, beat: string, ok: boolean, ms: number, gap?: number): Promise<void> {
  try {
    const { recordCronBeat } = await import('@/worker/utils/cron-heartbeat')
    // ⚠️ cronExpr 은 넘기지 않는다 — 레인은 자기를 부른 cron 식을 모르고, 넘겨봐야 매시간으로 오인된다.
    //   주기는 부모가 넘긴 `gap`(maxGapMin)만 신뢰한다(그게 이 파라미터가 생긴 이유다).
    await recordCronBeat(env, `ads:${beat}`, ok, ms, undefined, ok ? undefined : { err: 'LANE_ERROR' }, gap)
  } catch { /* 관측 실패는 삼킨다 */ }
}
