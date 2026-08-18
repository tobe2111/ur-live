/**
 * 🔁 **레인 주기 자가조율** — "잘 돌고 아직 줄 게 남았으면 더 자주, 삐끗하면 즉시 물러난다" (2026-08-18).
 *
 * ## 왜 (라이브 실측 — B2B 수집이 무너진 모양)
 * ```
 * 업체 일별   08-11 13,409  →  08-17 4,223  →  08-18 ~3,500 페이스     (−70%)
 * 소스 구성   commerce 가 95%+ — 사실상 이 레인 하나가 B2B 전부다
 * 회차당 수확  ~990 으로 **완전히 안정**(고갈 아님)
 * 회차 수     08-15 11회 · 08-16 9회 · 08-17 **4회**                    ← 무너진 건 이쪽
 * 신규율      saved 982 / found 1,000 = **98%**                         ← 소스는 아직 한참 남았다
 * ```
 * 즉 **수확이 준 게 아니라 회차가 안 돌았다.** 그리고 소스는 98% 가 새것이라 고갈과 거리가 멀다.
 *
 * ## 왜 상수를 그냥 올리지 않는가
 * 회차당 건수(`MAX_RECORDS_PER_RUN`)는 **CPU 사망을 겪고 내려잡은 값**이다 — 그 파일 헤더가
 * *"수확을 되찾으려면 마감선을 올릴 게 아니라 레코드당 CPU 를 줄여야 한다"* 고 못 박고 있다.
 * 남은 손잡이는 **주기**뿐인데, 공공 API 의 일일 한도를 우리는 **모른다**(CLAUDE.md: 미조사).
 * 고정값으로 2h→1h 를 박으면, 한도가 있을 경우 **가장 큰 B2B 소스를 통째로 깨뜨린다.**
 *
 * ⇒ 그래서 고정값이 아니라 **제어 루프**다: 깨끗하게 돌고 신규율이 높을 때만 조인다.
 *   한 번이라도 삐끗하면 기본 주기로 되돌아가고, 다시 조이려면 처음부터 안정 회차를 쌓아야 한다.
 *   한도에 부딪히면 그 자체가 오류로 나타나 **스스로 물러난다**(우리가 한도를 몰라도 된다).
 *
 * ⚠️ **비대칭은 의도다** — 조이는 데는 증거가 많이 필요하고(연속 6회), 푸는 데는 한 번이면 된다.
 *   반대로 하면 나쁜 상태에 오래 머문다.
 */
import type { LaneRunEntry } from './lane-run-history'

/** 조이기 전에 필요한 **연속 무사고 회차**. 2시간 간격이면 12시간치 증거다. */
export const TIGHTEN_CLEAN_RUNS = 6
/** 신규율 하한 — 이 아래면 소스가 마르는 중이라 더 자주 가도 중복만 는다. */
export const TIGHTEN_MIN_NOVELTY = 0.5
/** 아무리 조여도 이 아래로는 안 간다(시간당 1회라는 별도 상한과 함께 이중 안전). */
export const MIN_INTERVAL_HOURS = 1

/**
 * 🛑 **실패 재시도의 상한.** 실패한 회차는 슬롯을 안 먹지만(=다음 시간이 곧바로 재시도),
 *   그게 무한이면 **영구 장애 소스를 하루 24번 계속 두드린다.**
 *   `nextWakeAt` 의 `failStreak` 백오프는 회차를 쓴 뒤엔 다음 정시로 잡아 이 경로에 안 걸리므로,
 *   여기서 따로 끊어야 한다. 3회 = 세 시간 연속 실패 — 일시적 장애로 보기 어려운 지점.
 * ⚠️ 접는 것은 *재시도*뿐이다. 레인은 기본 주기로 계속 돌고, 회복하면 다음 성공 회차에서
 *   스스로 정상으로 돌아온다(영구 차단이 아니다).
 */
export const RETRY_MAX_FAIL_STREAK = 3

/**
 * 연속 무사고 회차 수 — 앞(최신)에서부터 오류 없는 회차를 센다.
 * ⚠️ **저장 0 은 사고가 아니다** — 이미 다 아는 소스(예: 소진된 storeinfo)는 정상적으로 0을 낸다.
 *   그건 신규율 게이트가 따로 잡는다. 여기서 0을 사고로 세면 두 신호가 섞인다.
 */
export function cleanStreak(history: readonly LaneRunEntry[]): number {
  let n = 0
  for (const r of history) { if (!r || !r.ok) break; n++ }
  return n
}

/**
 * 최근 회차들의 신규율(saved/found). 근거가 없으면 `null` — **모르면 조이지 않는다.**
 */
export function recentNovelty(history: readonly LaneRunEntry[], take = TIGHTEN_CLEAN_RUNS): number | null {
  let f = 0, n = 0
  for (const r of history.slice(0, take)) {
    if (!r || typeof r.f !== 'number' || r.f <= 0 || typeof r.n !== 'number') continue
    f += r.f; n += r.n
  }
  return f > 0 ? n / f : null
}

/**
 * 이 레인이 지금 써야 할 최소 간격(시간).
 *
 * @param base 설정된 기본 간격. `0`(간격 게이트 없음)이면 **조율 대상이 아니다** — 그런 레인은
 *   애초에 이 손잡이를 쓰지 않으므로 건드리면 의미가 바뀐다.
 */
export function adaptiveIntervalHours(base: number, history: readonly LaneRunEntry[]): number {
  if (!Number.isFinite(base) || base <= MIN_INTERVAL_HOURS) return base
  if (cleanStreak(history) < TIGHTEN_CLEAN_RUNS) return base
  const nov = recentNovelty(history)
  if (nov == null || nov < TIGHTEN_MIN_NOVELTY) return base
  // ⚠️ `ceil` 이다 — `floor` 면 base 3 이 1 이 되어 **3배**가 된다. 외부 호출이 두 배를 넘지
  //   않는다는 보장은 테스트가 아니라 **여기서** 나와야 한다(테스트는 그걸 확인만 한다).
  return Math.max(MIN_INTERVAL_HOURS, Math.ceil(base / 2))
}
