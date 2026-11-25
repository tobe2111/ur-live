/**
 * 💰 주간 정산 최소 금액 + 월말 상한 (2026-11-25 대표 *"고치면 좋은 점 두가지도 해줘. 매장의 경우에는 정산을 해줘야"*)
 *
 * 1. **최소 금액은 어드민이 정한다** — `platform_settings.payout_min_krw`(기본 1만 원 = 종전 상수
 *    `REFUND_POLICY.COMMISSION_MIN_WITHDRAWAL`). 받을 돈이 그 아래면 그 주는 건너뛰고 쌓아 둔다(사라지지 않는다).
 * 2. **한 달을 넘겨 기다리게 하지 않는다** — 그달 **마지막 목요일** 정산 회차에는 금액과 상관없이(1원 이상) 보낸다.
 *    종전엔 판매가 아주 적은 매장이 최소 금액을 못 채우면 몇 달이고 못 받았다.
 *
 * 순수 함수뿐 — 주간 정산 cron(`payouts-generate`)과 사장님 안내 문구가 같은 판정을 쓴다.
 */

export const PAYOUT_MIN_KEY = 'payout_min_krw'
export const DEFAULT_PAYOUT_MIN_KRW = 10_000

const KST_MS = 9 * 3600_000
const DAY_MS = 86_400_000

/** 설정값 → 최소 금액(원). 비었거나 이상값이면 기본 1만 원. 0 이면 최소 없음(1원 이상). 순수. */
export function resolvePayoutMin(raw: unknown): number {
  const s = String(raw ?? '').trim()
  if (s === '') return DEFAULT_PAYOUT_MIN_KRW
  const n = Math.floor(Number(s))
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return DEFAULT_PAYOUT_MIN_KRW
  return n
}

/** 이 시각 기준으로 이번 회차의 정산 목요일(KST 'YYYY-MM-DD'). 오늘이 목요일이면 오늘. 순수. */
export function upcomingPayoutThursday(nowMs: number): string {
  const k = new Date(nowMs + KST_MS)
  const add = (4 - k.getUTCDay() + 7) % 7 // 목 = 4
  return new Date(k.getTime() + add * DAY_MS).toISOString().slice(0, 10)
}

/** 그 목요일이 그달의 마지막 목요일인가(다음 목요일이 다음 달). 순수. */
export function isLastThursdayOfMonth(thursdayYmd: string): boolean {
  const t = Date.parse(`${thursdayYmd}T00:00:00Z`)
  if (!Number.isFinite(t)) return false
  return new Date(t + 7 * DAY_MS).toISOString().slice(5, 7) !== thursdayYmd.slice(5, 7)
}

/** 이번 회차에 적용할 최소 금액 — 월말 회차면 1원(남은 돈 전부), 아니면 설정값. 순수. */
export function effectivePayoutMin(min: number, nowMs: number): { min: number; monthEnd: boolean; thursday: string } {
  const thursday = upcomingPayoutThursday(nowMs)
  const monthEnd = isLastThursdayOfMonth(thursday)
  return { min: monthEnd ? 1 : Math.max(1, min), monthEnd, thursday }
}

/** 사람이 읽는 안내 — "1만 원 이상이면 매주 목요일, 그 아래는 그달 마지막 목요일". 순수. */
export function payoutMinLabel(min: number): string {
  if (min <= 1) return '매주 목요일'
  const won = min % 10_000 === 0 ? `${min / 10_000}만 원` : `${min.toLocaleString('ko-KR')}원`
  return `${won} 이상이면 매주 목요일, 그보다 적으면 그달 마지막 목요일`
}
