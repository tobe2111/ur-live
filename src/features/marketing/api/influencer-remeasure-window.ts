/**
 * 🔁 **재측정 주기** — "이미 잰 것을 언제 다시 재는가" 정책 (2026-09-03).
 *
 * ## 왜 생겼나 — 쓰기의 85%가 새 수집이 아니라 **다시 재기**였다
 * 유료 전환 뒤 축별 실측(09-03, 증설 반영 후 5시간):
 * ```
 *   D1 읽은 행  월 135억 / 포함분 250억 = 54%   ✅ 널널
 *   D1 쓴 행    월 9,900만 / 포함분 5,000만 = 198%  ❌ 2배 초과 → 월 약 $49 추가
 * ```
 * 그 쓰기가 어디서 오는지 5시간 내역:
 * ```
 *   성과 재측정 32,512건   ← 신규 수집(3,819)의 8.5배
 *   새 리드      3,819건
 *   매장 후보    1,784건
 *   합계 38,115 작업  →  실제 "쓴 행" 647,167  (인덱스 13개 때문에 ~17배 증폭)
 * ```
 * 원인은 선택 쿼리에 **신선도 조건이 아예 없었다**는 것이다 — `ORDER BY perf_checked_at ASC LIMIT 30`
 * 이 전부라, 항상 가장 오래된 것부터 집어 **전체 18만 건을 1.2일마다 한 바퀴** 다시 쟀다.
 * 블로거의 구독자 수·최근 조회수는 하루 만에 의미 있게 안 바뀐다.
 *
 * ## 왜 SQL 조건이 아니라 코드 필터인가 (중요)
 * SQL 에 `AND (perf_checked_at IS NULL OR perf_checked_at < …)` 를 넣으면, **큐가 비었을 때**
 * (= 목표 상태) SQLite 가 조건에 맞는 30건을 찾으려고 그 (account_id, platform) 구간의 인덱스를
 * 끝까지 훑는다 — 읽기가 그때부터 매 회차 15만 행이다. 읽기는 지금 여유 축이지만 **일부러 늘릴 이유가 없다.**
 *
 * 대신 정렬이 이미 보장하는 사실을 쓴다: `perf_checked_at ASC` 라 **맨 앞이 신선하면 그 뒤는 전부 신선하다.**
 * ⇒ 오늘과 **똑같은 쿼리**로 30건을 읽고 코드에서 거른다. 읽기 비용 0 증가, 결과는 SQL 조건과 동일.
 *
 * ## 안 줄이는 것 — 처음 재는 것
 * `perf_checked_at IS NULL`(한 번도 안 잰 리드)은 **항상 통과**한다. 그게 이메일을 만드는 작업이기 때문이다
 * (실측: 측정된 리드 이메일 보유 22.8% vs 미측정 1.3% — 17배). 남은 미측정 백로그는 9,477건뿐이다.
 * 측정에 실패해 스탬프가 안 찍힌 행도 계속 통과한다(오늘과 같은 동작 — 재시도가 막히지 않는다).
 *
 * 🔻 롤백: `ADS_REMEASURE_AFTER_DAYS=0` (재배포 없이 전부 통과 = 종전 동작) 또는 이 상수를 0 으로.
 */

/** 기본 재측정 주기(일). 30일이면 리드 DB 의 활동 신호로 충분하다 — 매일 다시 재는 건 낭비다. */
export const REMEASURE_AFTER_DAYS = 30

/** env 로 재배포 없이 조정(0 = 끔 = 전부 재측정 = 종전 동작, 상한 365). */
export function remeasureAfterDays(env?: unknown): number {
  const raw = (env as { ADS_REMEASURE_AFTER_DAYS?: string } | undefined)?.ADS_REMEASURE_AFTER_DAYS
  // ⚠️ 빈 문자열을 먼저 걸러야 한다 — `Number('')` 은 NaN 이 아니라 **0** 이고, 0 은 이 정책에서 "끔"이다.
  //   즉 env 를 안 걸면 기능이 통째로 꺼진 채 배포된다(에러 0, 로그 0). 시험이 실제로 이걸 잡았다.
  const raw0 = String(raw ?? '').trim()
  if (raw0 === '') return REMEASURE_AFTER_DAYS
  const n = Math.floor(Number(raw0))
  if (!Number.isFinite(n) || n < 0) return REMEASURE_AFTER_DAYS
  return Math.min(365, n)
}

/**
 * 이 행을 지금 (다시) 재야 하는가.
 *
 * ⚠️ **모르면 잰다**(fail-open) — 스탬프가 없거나(`null`) 못 읽는 형식이면 통과시킨다.
 *   반대로 하면(모르면 건너뛴다) 파싱이 어긋나는 순간 측정이 통째로 멎고, 그건 에러 없이 조용하다.
 */
export function isRemeasureDue(perfCheckedAt: string | null | undefined, nowMs: number, days: number): boolean {
  if (!(days > 0)) return true                    // 끔 = 종전 동작
  if (!perfCheckedAt) return true                 // 한 번도 안 잼 → 최우선
  // D1 은 `'YYYY-MM-DD HH:MM:SS'`(UTC, Z 없음)로 준다 — 그대로 Date 에 넣으면 로컬로 오해석된다.
  const t = Date.parse(String(perfCheckedAt).replace(' ', 'T') + (String(perfCheckedAt).endsWith('Z') ? '' : 'Z'))
  if (!Number.isFinite(t)) return true            // 형식 미상 → 잰다
  return nowMs - t >= days * 86400_000
}

/** 뽑아 온 행들에서 '지금 잴 것'만 남긴다. 정렬이 오래된 순이라 앞에서 잘리는 모양이 된다. */
export function dueForRemeasure<T extends { perf_checked_at?: string | null }>(
  rows: readonly T[], env?: unknown, nowMs = Date.now(),
): T[] {
  const days = remeasureAfterDays(env)
  if (!(days > 0)) return [...rows]
  return rows.filter(r => isRemeasureDue(r.perf_checked_at, nowMs, days))
}
