/**
 * 🕙 정산 유보 기간 — **토스가 우리에게 주기 전에 우리가 먼저 주지 않는다** (2026-09-21 대표 확정)
 *
 * 대표: *"정산은 우리도 그럼 영업일 기준 7일 이렇게 하는게 좋을까?"* → *"Q2는 10일로 하자"*
 * → 단위 확인 결과 **영업일 10일** 확정(2026-09-23 대표 *"영업일 10일이야"*).
 *
 * ## 무엇을 막나
 * 이 파일이 생기기 전 `payouts-generate` 의 집계에는 **날짜 조건이 한 줄도 없었다.** 원장에 붙는
 * 순간 다음 월요일 배치에 잡힌다. 그런데 토스는 카드 대금을 **5영업일 뒤**에 준다:
 *
 * ```
 * 일  손님 결제 + 당일 사용 → 원장에 매장 몫 적립
 * 월  payout 생성 → 승인 → 이체            ← 우리 돈이 나간다
 * 금  토스가 우리에게 입금                   ← 4~5일 뒤
 * ```
 *
 * 거래가 0이고 최소출금액이 10,000원이라 아직 안 터졌을 뿐, 매장이 늘면 상시 발생한다.
 *
 * ## 대표가 정한 건 **영업일 10일**인데 코드는 왜 역일 14인가
 * 레포에 **공휴일 테이블이 없다.** 영업일을 그대로 세려면 한국 공휴일을 관리해야 하는데 설·추석은 음력이라
 * 매년 바뀌고 대체공휴일도 붙는다. 틀리면 **정산이 조용히 하루씩 어긋난다** — 에러가 안 나는 클래스다.
 * 그래서 **역일 14일**로 근사한다: 꼬박 2주면 주말이 4일이라 그 안의 평일이 정확히 10일이다.
 *
 * ⚠️ **근사의 방향을 알고 쓸 것.** 2주 안에 공휴일이 끼면 그 구간의 영업일은 10일보다 *적다*(설·추석이면
 * 7~8일). 즉 오차는 언제나 "영업일 10일보다 조금 이른 지급" 쪽이지 늦는 쪽이 아니다. 그래도 토스의
 * 5영업일보다는 배 이상 뒤라 이 절의 목적("토스가 주기 전에 우리가 먼저 주지 않는다")은 유지된다.
 * 명절 구간까지 엄밀히 덮고 싶으면 `platform_settings.payout_hold_days` 를 한시적으로 올리면 된다.
 *
 * ## 기준일은 결제일이 아니라 **적립일(= 이용권 사용일)**
 * 이용권은 사놓고 나중에 쓴다. 결제일 기준은 `orders` 조인이 필요하고 사용 전에 익을 여지도 생긴다.
 * **적립일은 항상 결제일보다 뒤**라서, 적립일 기준이 결제일 기준보다 자동으로 더 보수적이고 구현은 한 줄이다.
 *
 * ## 🔴 credit 에만 건다 — debit 은 즉시 반영한다
 * 환불 역전(`debit`)까지 미루면, 환불이 났는데 그 차감이 2주 뒤에 반영된다 ⇒ **과다지급**.
 * 유보의 목적은 "덜 주기"가 아니라 "먼저 주지 않기"다. 빼는 것은 항상 즉시다.
 *
 * ## 🔴 설정을 못 읽으면 유보를 **유지**한다(fail-closed)
 * `payout-use-gate.ts` 는 반대로 fail-open 인데, 그건 "얼림은 알아채기 어렵다"는 이유였다.
 * 여기는 다르다 — 유보는 영구 정지가 아니라 2주이고, 실패 방향의 손실이 비대칭이다:
 * **늦게 주는 실패는 회복되지만, 먼저 준 돈은 못 돌려받는다.**
 */
import type { D1Database } from '@cloudflare/workers-types'

/** 대표 확정값 — **영업일 10일**을 역일로 근사한 값(위 주석 참조). 조정은 `platform_settings.payout_hold_days`. */
export const DEFAULT_PAYOUT_HOLD_DAYS = 14

export interface PayoutHold {
  /** credit 집계의 WHERE 에 이어 붙일 SQL 조각. 유보 0이면 빈 문자열. */
  sql: string
  /** 실제 적용된 유보일(역일). */
  days: number
  /** 유보가 걸려 있는가 — 로그·진단용. */
  enabled: boolean
}

/**
 * 유보 WHERE 조각을 만든다(순수).
 *
 * ⚠️ **바인딩 파라미터를 쓰지 않는다.** `datetime(x, '-' || ? || ' days')` 로 넘기면 D1 에서 modifier 가
 *   문자열 결합으로 만들어져 타입에 따라 조용히 NULL 이 되는 길이 생긴다(NULL modifier → 비교 거짓 →
 *   **전부 유보 → 정산이 영영 안 나감**). 값은 `platform_settings` 숫자이고 사용자 입력이 아니라,
 *   정수 클램프가 유일한 방어면 충분하다 — `payout-use-gate.ts` 와 같은 판단.
 *
 * ⚠️ `Number(days) || DEFAULT` 로 쓰지 말 것 — **0 이 falsy** 라 "유보 없음"이 조용히 기본값으로 바뀐다
 *   (CLAUDE.md 가 경고하는 그 함정, `payout-use-gate.ts` 가 실제로 밟았다).
 */
export function buildPayoutHoldSql(days: number = DEFAULT_PAYOUT_HOLD_DAYS): PayoutHold {
  const raw = Number(days)
  const d = Number.isFinite(raw)
    ? Math.max(0, Math.min(365, Math.floor(raw)))
    : DEFAULT_PAYOUT_HOLD_DAYS
  if (d === 0) return { sql: '', days: 0, enabled: false }
  return { sql: `AND created_at <= datetime('now', '-${d} days')`, days: d, enabled: true }
}

/**
 * `platform_settings.payout_hold_days` 를 읽어 유보를 만든다.
 * 조회 실패·미설정은 **기본값 유지**(fail-closed — 위 주석 참조).
 */
export async function resolvePayoutHold(DB: D1Database): Promise<PayoutHold> {
  let days = DEFAULT_PAYOUT_HOLD_DAYS
  try {
    const row = await DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'payout_hold_days'",
    ).first<{ value: string }>()
    if (row) {
      const v = Number(row.value)
      // 0 도 유효한 값이다(유보 해제) — `>= 0` 이지 `> 0` 이 아니다.
      if (Number.isFinite(v) && v >= 0) days = v
    }
  } catch {
    // 설정을 못 읽었다고 유보를 푸는 것은 "먼저 주는" 쪽 실패다 → 기본값을 유지한다.
  }
  return buildPayoutHoldSql(days)
}
