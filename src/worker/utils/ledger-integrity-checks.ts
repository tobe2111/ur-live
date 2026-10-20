/**
 * 🔎 2026-08-01 (대표 "점검할 거 있나" → 원장 불일치 4건을 실제로 파려다 막힌 자리)
 *
 * `ledger-integrity-check` cron 은 매일 불일치를 **감지**하지만, **누가 어긋났는지는 아무 데도 안 남긴다** —
 * 상세(`sample`)는 `logError` 로 콘솔(Cloudflare 로그)에만 가고 DB 에는 요약 문자열만 저장된다.
 * 그 결과 `/admin/errors` 에는 `Ledger mismatch (4): user_points_balance_mismatch: 4` 만 몇 주째 쌓였고
 * **아무도 손을 댈 수 없었다**(어떤 유저인지 모르니 조사 자체가 시작이 안 된다).
 * 오늘 고친 `user_agent` 누락과 **같은 클래스** — 탐지는 되는데 행동에 필요한 데이터가 없다.
 *
 * 그래서 검사 SQL 을 여기로 모아 **cron 과 조회 API 가 같은 쿼리**를 쓰게 한다.
 * 두 벌로 두면 반드시 갈라진다(이 레포가 반복해 겪은 일이다 — `is_hidden`/`is_visible` 이 그랬다).
 *
 * ⚠️ 읽기 전용이다. 여기서 고치지 않는다 — 잔액 교정은 머니 경로라 사람이 판단해야 한다.
 */

/** 잔액을 **깎는** 레거시 타입 — 그 시절 `amount` 에 부호가 없어 여기서 붙여 준다. */
const LEGACY_SPEND_TYPES = "('donate','cash_withdraw','use','spend','deduct')"

/**
 * `point_transactions` 의 부호 있는 합.
 *
 * ## 이 표에는 **규약이 두 개** 섞여 있다 (2026-08-31 라이브 실측으로 확정)
 *
 * | | `amount` | `points_amount` | 부호 |
 * |---|---|---|---|
 * | **레거시**(~2026-06) | 충전은 **원화 결제액**, 그 외는 크기 | 딜 수량 | 없음(전부 양수) |
 * | **모던**(`point-ledger.ts`, 2026-06-12~) | **부호 있는 딜 델타** | 안 씀(NULL) | 있음 |
 *
 * ⇒ 두 규약의 **판별자는 `points_amount` 가 채워져 있는가**다. 모던 기록자는 그 컬럼을 아예 안 쓴다
 *   (`point-ledger.ts` 의 INSERT 컬럼 목록에 없다).
 *
 * ⚠️ **`IS NOT NULL` 로 가르면 안 된다** (2026-08-31 라이브 스키마 실측으로 잡은 함정):
 *   라이브 컬럼은 `points_amount INTEGER NOT NULL DEFAULT 0` 이다. 즉 모던 행은 NULL 이 아니라
 *   **0** 으로 저장된다 ⇒ `IS NOT NULL` 은 모던 행까지 레거시로 몰아 `points_amount`(0)로 세고
 *   **적립·차감이 통째로 사라진다.** 지금은 모던 행이 라이브에 0건이라 안 드러나지만, 원장 쓰기가
 *   되살아나는 순간(옛 CHECK 제약 제거 — `point-ledger-unlock.ts`) 전 유저가 불일치로 잡힌다.
 *   그래서 `COALESCE(...) != 0` 으로 가른다.
 *
 * ## 왜 다시 고치나 (2026-08-31 — 대표 "이거 무슨 에러야?")
 *
 * 2026-07-27 판은 *"기록 SSOT 는 `amount`"* 라는 한쪽 사실만 보고 **`amount` 를 우선**했다.
 * 그런데 그때 라이브에 있던 행은 **전부 레거시**였다(실측: 18행 전부 `points_amount` 보유,
 * 음수 `amount` 0건). 그래서 실제로는:
 *   · 충전 8건에서 `amount`(10,000원) ≠ 딜(8,500) → **건당 1,500 부풀림**
 *   · 후원·공구사용(`donate`)이 **차감인데 양수**라 빼야 할 것을 더함 → 부호가 뒤집힘
 * 결과가 유저 3 의 `−82,480` 이었다. 숫자를 믿을 수 없으니 **매일 뜨는 알림이 아무 뜻도 없었다.**
 *
 * ⚠️ 두 판 모두 *"기록자 코드를 읽고"* 정한 것이다. 갈린 지점은 **데이터를 안 봤다는 것** —
 *   모던 기록자는 맞게 읽었지만 그 기록자가 만든 행이 라이브에 **아직 한 줄도 없었다.**
 *   ⇒ 규약을 정할 때는 코드와 데이터를 **둘 다** 본다.
 */
export const SIGNED_POINT_SUM = `SUM(CASE
  WHEN COALESCE(pt.points_amount, 0) != 0 THEN
    CASE WHEN pt.type IN ${LEGACY_SPEND_TYPES} THEN -pt.points_amount ELSE pt.points_amount END
  ELSE COALESCE(pt.amount, 0) END)`

/** `user_points.balance` ↔ `SUM(point_transactions)` 불일치 유저. */
export const BALANCE_MISMATCH_SQL = `
  SELECT up.user_id, up.balance, COALESCE(${SIGNED_POINT_SUM}, 0) AS computed,
         up.balance - COALESCE(${SIGNED_POINT_SUM}, 0) AS diff
    FROM user_points up
    LEFT JOIN point_transactions pt ON pt.user_id = up.user_id
   GROUP BY up.user_id, up.balance
  HAVING balance != computed`

export interface BalanceMismatchRow {
  user_id: string
  balance: number
  computed: number
  diff: number
}

/** 불일치 유저 목록 — `diff` 절대값이 큰 순. 조사·보고용(교정하지 않는다). */
export async function findBalanceMismatches(
  DB: D1Database,
  limit = 50,
): Promise<{ total: number; rows: BalanceMismatchRow[] }> {
  const [cnt, r] = await Promise.all([
    DB.prepare(`SELECT COUNT(*) AS n FROM (${BALANCE_MISMATCH_SQL})`)
      .first<{ n: number }>().catch(() => null),
    DB.prepare(`${BALANCE_MISMATCH_SQL} ORDER BY ABS(up.balance - COALESCE(${SIGNED_POINT_SUM}, 0)) DESC LIMIT ?`)
      .bind(Math.min(Math.max(1, limit), 200))
      .all<BalanceMismatchRow>().catch(() => ({ results: [] as BalanceMismatchRow[] })),
  ])
  const rows = r.results ?? []
  return { total: Number(cnt?.n ?? rows.length), rows }
}

/**
 * 불일치 한 건이 **어떤 종류인지** 한 줄 소견. 판정이 아니라 다음에 볼 곳을 가리킨다.
 *
 * 실무상 대부분은 셋 중 하나다:
 *   · 거래 기록 없이 잔액만 있음(시드·수동 지급·마이그레이션 잔재)
 *   · 거래는 있는데 잔액이 덜/더 반영(중간 크래시)
 *   · 거래가 잔액보다 많음(차감이 잔액에 반영 안 됨 = 플랫폼 손해 방향)
 */
export function classifyMismatch(row: BalanceMismatchRow): string {
  const { balance, computed, diff } = row
  if (computed === 0 && balance !== 0) return '거래 기록 0 · 잔액만 있음 — 시드/수동 지급/마이그레이션 잔재 가능'
  if (diff > 0) return `잔액이 거래합보다 ${diff} 많음 — 차감이 원장에 안 남았거나 적립이 이중 반영`
  return `잔액이 거래합보다 ${-diff} 적음 — 적립이 잔액에 안 반영(사용자 손해 방향)`
}
