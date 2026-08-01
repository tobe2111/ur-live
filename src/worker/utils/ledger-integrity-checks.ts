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

/**
 * `point_transactions` 의 부호 있는 합.
 *
 * ⚠️ 2026-07-27 에 한 번 크게 틀렸던 자리다(오탐만 내고 있었다):
 *   ① 기록 SSOT 는 `amount` 에 쓰는데 검사는 `points_amount` 를 읽었다 → 잔액 있는 유저 전부 불일치
 *   ② 타입 화이트리스트가 4종뿐이라 나머지를 0 처리
 *   ③ `amount` 는 이미 부호가 있는데 donate 에 −를 또 붙임
 * 지금은 전 타입을 부호 그대로 합산하고, 레거시 행(`amount` 없이 `points_amount` 만 있는 구 코드 산출물)만
 * 구 규약(절대값 + 타입으로 부호 결정)으로 폴백한다.
 */
export const SIGNED_POINT_SUM = `SUM(CASE
  WHEN COALESCE(pt.amount, 0) != 0 THEN pt.amount
  WHEN pt.type IN ('donate','cash_withdraw','use','spend','deduct') THEN -COALESCE(pt.points_amount, 0)
  ELSE COALESCE(pt.points_amount, 0) END)`

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
