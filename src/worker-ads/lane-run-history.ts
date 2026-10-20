/**
 * 🎞️ **레인 회차 이력** — "안 돌았나, 돌았는데 실패했나"를 구분하기 위한 최소 기록 (2026-08-18).
 *
 * ## 왜 필요한가 (실측)
 * 2026-08-17 에 매장/업체 수집(`collect-commerce`)의 짝수시 4칸 중 3칸이 비는 것을 보고
 * **"알람 유실"이라고 단정**했다. 다음 날 실측이 다른 답을 냈다:
 *
 * ```
 * 00:00 회차   레인 정상 실행(34.9초)   found 0 · saved 0
 *              "등록현황: 네트워크 오류 | 등록상세: 네트워크 오류"   ← 외부 공공 API 실패
 * ```
 *
 * **레인은 돌았고 외부 API 가 답을 안 준 것**이다. 그런데 그걸 *한 건* 밖에 못 봤다 —
 * `ads_lane_alarm_last:{레인}` 은 **마지막 회차 하나만** 남기고 매번 덮어쓰기 때문이다.
 * 나머지 빈 칸이 유실인지 실패인지는 **구조적으로 알 수 없었다.**
 *
 * ⚠️ 그래서 이 모듈은 진단 도구가 아니라 **오진 방지 장치**다. 이 레포는 좁은 관측 창으로
 *   같은 실수를 반복해 왔다(경보 6건 → 원장 3배 · 30시간 → 3주 17배 진폭 · 위 유실/실패).
 *   *"회차별로 무슨 일이 있었나"* 를 남기지 않으면 다음 세션도 같은 추측을 한다.
 *
 * ## 왜 별도 키인가 (`ads_lane_runs:{레인}`)
 * 기존 스탬프에 얹을 수 없다 — 그 값은 `.slice(0, 2000)` 로 잘리고, **이미 두 레인이 잘려
 * 파싱 불가 상태**였다(실측: `collect`·`scan-notices` 가 정확히 2000자 = JSON 중간 절단).
 * 큰 값에 이력을 더하면 이력까지 같이 깨진다. 작고 상한이 확실한 값을 따로 둔다.
 */

/** 한 회차의 요약. 짧을수록 좋다 — 12회차가 D1 한 칸에 들어가야 한다. */
export interface LaneRunEntry {
  /** 실행 시각(ISO, 분까지) — 초는 판정에 안 쓰이고 자리만 먹는다. */
  t: string
  /** 이 회차가 실제로 돌았는가(`skip` 은 기록하지 않는다 — 아래 `summarizeLaneRun` 참조). */
  ok: boolean
  /** 저장 건수(레인마다 이름이 달라 아래에서 흡수). 모르면 `null`. */
  n: number | null
  /** 조회 건수. `n/f` 가 **신규율**이고, 그게 "이 소스가 아직 줄 게 남았나"의 유일한 신호다. */
  f?: number | null
  /** 실패 사유 앞머리. 성공이면 생략. */
  e?: string
}

/** 이력 길이 — 12회차면 2시간 간격 레인의 **하루**를 덮는다(짝수시 12칸과 같은 창). */
export const LANE_RUN_HISTORY_MAX = 12

/** 레인마다 저장 건수 필드 이름이 다르다. 하나로 못 정하니 **읽는 쪽에서** 흡수한다. */
const SAVED_KEYS = ['saved', 'last_saved', 'n', 'count'] as const
const FOUND_KEYS = ['found', 'last_found'] as const

/**
 * 회차 하나를 요약한다.
 *
 * ⚠️ **skip 은 `null` 을 반환한다 — 이력에 남기지 않는다.** 간격 게이트에 걸린 회차까지 넣으면
 *   12칸이 skip 으로 가득 차서 정작 보려던 "돈 회차들"이 밀려난다(이력이 스스로를 지운다).
 */
export function summarizeLaneRun(stats: unknown, error: string | undefined, at: number): LaneRunEntry | null {
  const s = (stats && typeof stats === 'object' ? stats : null) as Record<string, unknown> | null
  if (!error && s && typeof s.skipped === 'string') return null
  let n: number | null = null
  for (const k of SAVED_KEYS) {
    const v = s?.[k]
    if (typeof v === 'number' && Number.isFinite(v)) { n = v; break }
  }
  // 레인이 자기 오류를 통계 안에 담는 경우(`diag.error`)도 실패로 본다 — 예외를 안 던지고
  // found=0 으로 조용히 끝나는 것이 바로 위 실측의 모습이었다.
  const diag = (s?.diag && typeof s.diag === 'object' ? s.diag : null) as Record<string, unknown> | null
  const softErr = typeof diag?.error === 'string' ? diag.error : undefined
  const e = error || softErr
  let f: number | null = null
  for (const k of FOUND_KEYS) {
    const v = s?.[k]
    if (typeof v === 'number' && Number.isFinite(v)) { f = v; break }
  }
  return {
    t: new Date(at).toISOString().slice(0, 16),
    ok: !e,
    n,
    ...(f == null ? {} : { f }),
    ...(e ? { e: e.slice(0, 60) } : {}),
  }
}

/** 앞이 최신. 상한을 넘으면 오래된 것부터 버린다. */
export function appendRunHistory(prev: unknown, entry: LaneRunEntry | null, max = LANE_RUN_HISTORY_MAX): LaneRunEntry[] {
  const list = Array.isArray(prev) ? (prev as LaneRunEntry[]).filter(r => r && typeof r.t === 'string') : []
  if (!entry) return list.slice(0, max)
  return [entry, ...list].slice(0, max)
}

/** 저장용 직렬화. 상한을 넘기면 **자르지 않고 개수를 줄인다**(잘린 JSON 을 만들지 않는다). */
export function serializeRunHistory(list: LaneRunEntry[], budget = 1800): string {
  let out = JSON.stringify(list)
  let n = list.length
  while (out.length > budget && n > 1) { n--; out = JSON.stringify(list.slice(0, n)) }
  return out
}

/** 이력 키 — 스탬프(`ads_lane_alarm_last:`)와 **다른 키**여야 한다(위 docblock). */
export const LANE_RUNS_KEY = 'ads_lane_runs'

/**
 * 스탬프 직렬화 — **잘린 JSON 을 만들지 않는다.**
 *
 * 🩸 기존 코드는 `JSON.stringify(...).slice(0, 2000)` 였고, 라이브에서 **두 레인이 정확히 2000자**로
 *   잘려 파싱 불가 상태였다(2026-08-18 실측 — `collect`·`scan-notices`). `collect` 는 인플루언서
 *   발굴 본체라, 그 스탬프를 읽는 쪽은 전부 조용히 실패하고 있었다.
 *
 * ⚠️ 자르는 대신 **가장 큰 조각(`stats`)을 통째로 뺀다.** 관측값은 "일부가 잘린 것"보다
 *   "없다고 표시된 것"이 낫다 — 전자는 읽는 쪽이 깨지고 후자는 읽는 쪽이 안다.
 */
export function serializeLaneStamp(base: Record<string, unknown>, stats: unknown, budget = 2000): string {
  const full = JSON.stringify({ ...base, stats: stats ?? null })
  if (full.length <= budget) return full
  const trimmed = JSON.stringify({ ...base, stats: null, stats_omitted: true })
  return trimmed.length <= budget ? trimmed : trimmed.slice(0, budget)
}
