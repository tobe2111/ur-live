/**
 * 🧱 **하트비트의 `skipped` 를 값까지 읽는다** — "못 했다" 와 "할 게 없었다" 를 가른다 (2026-10-15)
 *
 * ## 왜 (라이브 실측)
 *
 * `cron-stale-watch` 는 2026-08-31 에 *"돌긴 하는데 아무것도 못 하는 것"* 을 잡으려고
 * `skipped` 표식이 붙은 비트를 골랐다. 그 처방은 옳았는데 **키만 보고 값을 안 봤다**:
 *
 * ```
 *   /(^|[\s,{])skipped[=:]/.test(b.result)
 * ```
 *
 * 그 사이 레인들이 같은 이름을 **세 가지 다른 뜻**으로 쓰게 됐다. 하트비트 145개 중 이 표식이
 * 붙은 12개를 전수로 읽으니 **11개가 멀쩡한 레인**이었다:
 *
 * ```
 *   ads:* 9개       skipped=min_interval              ← 최근에 돌아서 쉬는 중(레인 페이싱)
 *   demo-name-heal  healed=0 skipped=309 samples[0]   ← 카운터: 309건은 손댈 게 없었다
 *   __catchup       started=0 skipped=6 deferred=0    ← 카운터: 밀린 게 없었다
 *   group-buy-feed-cache  refreshed=0 skipped=false   ← 명시적 "안 건너뛰었다"
 * ```
 *
 * `__catchup` 의 주석은 심지어 *"started=0 skipped=27 이면 **돌았고 밀린 게 없었다**가 화면에서
 * 읽힌다"* 라고 적어 뒀다 — 그 뜻을 감시 쪽이 정반대로 읽고 있었다.
 *
 * ## 그 오독의 대가 (실측)
 *
 * 12시간마다 11개 레인에 거짓 `blocked:*` 를 쏘아, 미해결 `cron_failures` **1,331건**(critical 11 ·
 * error 621 · warning 699)이 쌓였고 어드민이 보여 주는 **최신 100건의 81%가 `blocked:*`** 였다.
 * 그 창에 **error 는 0건**이라, 진짜 error 621건과 critical 5건이 화면에 도달하지 못했다.
 * ⇒ **거짓 경보는 침묵보다 나쁘다** — 침묵은 아무것도 안 가리지만 소음은 진짜를 가린다.
 *
 * ## 규칙 (값으로 판정)
 *
 * | 값 모양 | 뜻 | blocked? |
 * |---|---|---|
 * | 숫자 (`6` · `309` · `27`) | **카운터** — N건 건너뜀 = 할 일이 없었다 | ❌ |
 * | falsy (`false` · `0` · `none` · `null` · 빈 문자열 리터럴) | 명시적 "안 건너뛰었다" | ❌ |
 * | `HEALTHY_SKIP_REASONS` (`min_interval`) | 레인 페이싱 — 최근에 돌았다 | ❌ |
 * | 그 외 (`true` · `no_binding` 같은 이유 문자열) | **"내 일을 못 했다"** | ✅ |
 *
 * 🔴 **기본값이 `blocked` 인 것은 의도다.** 2026-08-31 이 잡으려던 사고(바인딩이 없어 이미지
 * 이관이 넉 달간 `migrated=0` 을 성실히 반환한 것)는 **이유 문자열**로 나타난다. 모르는 값을
 * 안전한 쪽으로 넘기면 그 사고가 다시 조용해진다 ⇒ 넓히는 것은 **허용목록에 한 줄 추가**로만 한다.
 *
 * ⚠️ **못 하는 것**: 이유 문자열이 *진짜* 막힘인지 판정하지 않는다(글자를 읽을 뿐이다) ·
 *   `skipped` 를 아예 안 싣고 조용히 아무 일도 안 하는 cron(그건 2026-08-31 주석이 적어 둔
 *   원래 한계이고, 관례를 따르는 것이 각 cron 의 몫이다).
 */

/** 레인이 **건강하게** 쉬는 이유. 넓힐 때는 여기에 한 줄 — 판정 기본값을 바꾸지 않는다. */
export const HEALTHY_SKIP_REASONS: ReadonlySet<string> = new Set([
  // `worker-ads/lane-alarm.ts` — 최소 간격이 안 찼다(= 최근에 돌았다). 고장이 아니다.
  'min_interval',
])

/** 값이 "건너뛰지 않았다" 를 뜻하는 글자들. 숫자 `0` 은 아래 카운터 규칙이 먼저 먹는다. */
const FALSY_SKIP_VALUES: ReadonlySet<string> = new Set([
  'false', 'none', 'null', 'undefined', 'no', "''", '""', '없음',
])

export type SkipVerdict =
  | 'none'      // 표식 자체가 없다 — 판정 대상 아님
  | 'healthy'   // 표식은 있는데 "할 게 없었다/쉬는 중" 이다
  | 'blocked'   // "내 일을 못 했다"

/** 하트비트 `result` 에서 `skipped` 표식을 읽는다. 값이 비면(`skipped=` 뒤가 바로 다음 키) 'blocked'. */
export function readSkipMark(result: string | null | undefined): { raw: string | null; verdict: SkipVerdict } {
  const s = String(result ?? '')
  // 키 경계를 유지한다 — `unskipped=` 같은 이름에 걸리지 않게(종전 정규식과 같은 앞머리 조건).
  const m = /(?:^|[\s,{])skipped[=:]\s*([^\s,}]*)/.exec(s)
  if (!m) return { raw: null, verdict: 'none' }

  const raw = (m[1] ?? '').trim()
  // 값이 비었다 — `skipped= deferred=0` 처럼 다음 키가 바로 오면 캡처가 빈 문자열이거나
  // `key=value` 꼴이 잡힌다. 둘 다 "무언가 건너뛴다고 말하면서 무엇인지 안 말한 것" 이라
  // 안전한 쪽(blocked)으로 둔다 — 한 번 울리면 사람이 그 emit 을 고친다.
  if (!raw || /[=:]/.test(raw)) return { raw: raw || null, verdict: 'blocked' }

  // 카운터 — `skipped=309` 는 "309건은 손댈 게 없었다" 다(`__catchup` 주석의 그 뜻).
  if (/^-?\d[\d_,]*$/.test(raw)) return { raw, verdict: 'healthy' }

  const low = raw.toLowerCase()
  if (FALSY_SKIP_VALUES.has(low)) return { raw, verdict: 'healthy' }
  if (HEALTHY_SKIP_REASONS.has(low)) return { raw, verdict: 'healthy' }

  return { raw, verdict: 'blocked' }
}

/** `cron-stale-watch` 가 쓰는 술어 — 이 비트가 "내 일을 못 했다" 고 말하는가. */
export function isBlockedBeat(result: string | null | undefined): boolean {
  return readSkipMark(result).verdict === 'blocked'
}
