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
 * **하루 한 번**(cron `0 19 * * *` = 04시 KST) 12~16개 레인에 거짓 `blocked:*` 를 쏘아, 미해결
 * `cron_failures` **1,331건**(critical 11 · error 621 · warning 699)이 쌓였고 어드민이 보여 주는
 * **최신 100건의 81%가 `blocked:*`** 였다. 그 창에 **error 는 0건**이라, 진짜 error 621건과
 * critical 5건이 화면에 도달하지 못했다.
 * ⇒ **거짓 경보는 침묵보다 나쁘다** — 침묵은 아무것도 안 가리지만 소음은 진짜를 가린다.
 *
 * 🩸 **2026-10-15 후속 — 첫 판의 조사 방법이 틀려 3건을 놓쳤다.** 위 "12개" 는 하트비트를 **한 장
 * 스냅샷**으로 떠서 센 값인데, **시각 페이싱 레인은 자기 시각에만 그 표식을 낸다**(홀수시만 ·
 * 4시간마다 · rescan 시각 제외) ⇒ 스냅샷에 안 잡힌다. 권위 있는 출처는 *경보가 실제로 무엇에
 * 울렸나* 인 `cron_failures` 였고, 10-15 04시 배치 **15건**을 전수로 읽으니 셋이 더 있었다:
 *
 * ```
 *   ads:scan-notices      skipped=off_hour      ← 4시간마다만 (lane-alarm-runners:507)
 *   ads:maintenance       skipped=rescan_hour   ← rescan 시각엔 비켜 준다 (:127)
 *   ads:collect-company   skipped=even_hour     ← 홀수시만 (:241)
 * ```
 *
 * 즉 첫 판 그대로면 15 → **3** 이지 0 이 아니었다. ⇒ 셋을 허용목록에 더하고, **같은 실수가
 * 세 번째로 나지 않게** 아래 `BLOCKING_SKIP_REASONS` 로 *분류 전수*를 고정한다 — 러너의
 * `skipped:` 리터럴이 healthy·blocking 둘 중 어디에도 없으면 가드가 빨간불을 낸다.
 * 🧭 **교훈**: 주기가 있는 계를 스냅샷으로 조사하지 말 것 — 이 레포가 세 번 밟은 자리다.
 *
 * ## 규칙 (값으로 판정)
 *
 * | 값 모양 | 뜻 | blocked? |
 * |---|---|---|
 * | 숫자 (`6` · `309` · `27`) | **카운터** — N건 건너뜀 = 할 일이 없었다 | ❌ |
 * | falsy (`false` · `0` · `none` · `null` · 빈 문자열 리터럴) | 명시적 "안 건너뛰었다" | ❌ |
 * | `HEALTHY_SKIP_REASONS` (`min_interval`·`even_hour`·`off_hour`·`rescan_hour`) | 레인 페이싱 — 내 차례/내 시각이 아니다 | ❌ |
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

/**
 * 레인이 **건강하게** 쉬는 이유 = **페이싱**("내 차례/내 시각이 아니다"). 넓힐 때는 여기에 한 줄.
 *
 * 🔑 경계는 *페이싱 ↔ 꺼짐* 이다. 페이싱은 다음 차례에 알아서 돌므로 사람이 할 일이 없고,
 * 꺼짐(`gate_off`·`disabled`)은 **사람이 켜야** 도는 것이라 2026-08-31 감시가 잡으려던 바로 그
 * 신호다 ⇒ 아래 `BLOCKING_SKIP_REASONS` 에 둔다. 새 이유를 더할 때 이 질문만 하면 된다:
 * **"내일 저절로 돌까?"** 돌면 여기, 안 돌면 저기.
 */
export const HEALTHY_SKIP_REASONS: ReadonlySet<string> = new Set([
  // `worker-ads/lane-alarm.ts` — 최소 간격이 안 찼다(= 최근에 돌았다). 고장이 아니다.
  'min_interval',
  // ↓ 2026-10-15 후속. 전부 `lane-alarm-runners.ts` 의 의도적 시각 페이싱이고, 그 자리 주석이
  //   "외부 호출량 의도를 보존한다" 처럼 **왜 비켜 주는지**를 적어 뒀다.
  'even_hour',    // :241 collect-company — 홀수시만(짝수시 storeinfo 와 외부 호출량 분리)
  'off_hour',     // :507 scan-notices    — 4시간마다만
  'rescan_hour',  // :127 maintenance     — rescan 레인에 그 시각을 비켜 준다
])

/**
 * **일부러 blocked 로 두는** 이유 — "꺼져 있어서 못 했다". 판정에는 쓰이지 않는다(기본값이 이미
 * blocked 다). 가드가 *러너의 `skipped:` 리터럴 전수가 둘 중 하나로 분류돼 있는가* 를 묻는 데 쓴다.
 *
 * 🔴 **여기 있는 값을 `HEALTHY_SKIP_REASONS` 로 옮기지 말 것** — 2026-08-31 사고(바인딩이 없어
 * 이미지 이관이 넉 달간 `migrated=0` 을 성실히 반환한 것)가 정확히 이 모양이다. 게이트가 꺼진 것은
 * 설정일 수 있지만, **사람이 알아야** 하는 설정이다.
 */
export const BLOCKING_SKIP_REASONS: ReadonlySet<string> = new Set([
  'gate_off',   // env 게이트가 'true' 가 아니다
  'disabled',   // env 가 명시적으로 끔
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
