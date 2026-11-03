/**
 * 📅 커미션 월 정산일 SSOT — 인플루언서 · 에이전시 (2026-11-03 대표 확정)
 *
 * 대표: *"인플루언서 정산은 월 1회 정해진 날로 묶자"* · *"10일로 할까? 에이전시도 같은 날로 해주고."*
 * 결재: `docs/decisions/2026-11-03-settlement-structure.md`
 *
 * ## 무엇을 정하나
 * 유어딜이 직접 주는 커미션(인플루언서 소개·영입 커미션, 유어딜이 걷는 에이전시 몫)은
 * **매월 10일(KST) 한 번**, 그날까지 확정(성숙)된 금액을 묶어 지급 대기에 올린다.
 * 매장 판매 대금은 이 파일과 무관하다 — 매주 목요일(`worker/utils/settlement-schedule.ts`).
 *
 * ## 왜 10일인가
 * 지난달 마지막 날 결제분도 환불 기간(7일)이 지나 확정되는 날이 다음 달 7일이다. 10일이면
 * 지난달 몫이 전부 익은 뒤이고, 쿠팡파트너스(익익월 15일)보다 한 달 이상 빠르다.
 *
 * ## 값은 어드민 조정
 * `platform_settings.commission_payout_day` (1~28). 29~31 은 없는 달이 있어 받지 않는다.
 * 숫자만 바뀌는 것은 문서 갱신 대상이 아니다(CLAUDE.md 플랫폼 모델 룰).
 *
 * ⚠️ 순수 모듈 — 워커와 화면이 같은 함수를 쓴다(안내 문구의 날짜와 실제 지급일이 갈리지 않게).
 */

export const COMMISSION_PAYOUT_DAY_KEY = 'commission_payout_day'
export const COMMISSION_PAYOUT_DAY_DEFAULT = 10
export const COMMISSION_PAYOUT_DAY_MIN = 1
export const COMMISSION_PAYOUT_DAY_MAX = 28

const KST_MS = 9 * 60 * 60 * 1000

/** 설정값 → 유효한 날(1~28). 비었거나 범위 밖이면 기본 10. */
export function resolveCommissionPayoutDay(raw: unknown): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < COMMISSION_PAYOUT_DAY_MIN || n > COMMISSION_PAYOUT_DAY_MAX) {
    return COMMISSION_PAYOUT_DAY_DEFAULT
  }
  return n
}

/** 이 시각이 KST 로 정산일인가. */
export function isCommissionPayoutDay(nowMs: number, day: number): boolean {
  return new Date(nowMs + KST_MS).getUTCDate() === day
}

/** 이 시각(KST) 기준 다음 정산일 — 오늘이 정산일이면 오늘. 'YYYY-MM-DD'(KST). */
export function nextCommissionPayoutDate(nowMs: number, day: number): string {
  const k = new Date(nowMs + KST_MS)
  let y = k.getUTCFullYear()
  let m = k.getUTCMonth()
  if (k.getUTCDate() > day) {
    m += 1
    if (m > 11) { m = 0; y += 1 }
  }
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 이번 달 정산 회차 키('YYYY-MM', KST) — 같은 달에 두 번 묶지 않게 하는 멱등 키. */
export function commissionPayoutPeriod(nowMs: number): string {
  const k = new Date(nowMs + KST_MS)
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`
}

/** 사람에게 보여 줄 한 줄. 예) "매월 10일" */
export function commissionPayoutDayLabel(day: number = COMMISSION_PAYOUT_DAY_DEFAULT): string {
  return `매월 ${day}일`
}
