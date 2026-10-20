/**
 * 🗓️ **요금 달력 — UTC 하나로 통일** (2026-10-06 분리).
 *
 * Cloudflare 의 두 경계가 전부 UTC 다: 일일 한도 리셋(= 09:00 KST)과 **월 포함분** 리셋.
 * 그래서 예산 코드는 **KST 를 쓰면 안 된다** — 하루가 9시간 어긋나면 "오늘 얼마 썼나"가 틀린다.
 *
 * ⚠️ 이 파일은 **아무것도 import 하지 않는다.** 예산 역산(`read-budget.ts`)과 계정 실측
 *   (`account-usage.ts`)이 둘 다 이 달력을 쓰는데 한쪽에 두면 순환 import 가 된다.
 * ⚠️ `src/utils/date.ts`(KST SSOT)와는 **다른 축**이다 — 그쪽은 *사람에게 보여 줄* 시각이고
 *   이쪽은 *요금 경계*다. 섞으면 9시간 틀린다(CLAUDE.md 의 UTC/KST 방어선과 같은 함정).
 */

/** Cloudflare 가 일일 한도를 되돌리는 경계 = UTC 자정. */
export function utcDay(nowMs: number): string { return new Date(nowMs).toISOString().slice(0, 10) }

/** UTC 월 키(`2026-10`) — 요금 경계와 같은 달력. */
export function utcMonth(nowMs: number): string { return new Date(nowMs).toISOString().slice(0, 7) }

/** 이번 달 총 일수(UTC). */
export function utcDaysInMonth(nowMs: number): number {
  const d = new Date(nowMs)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
}

/** UTC 기준 이번 달 남은 일수(오늘 포함). 요금 경계가 UTC 월이라 그 달력을 쓴다. */
export function utcDaysLeftInMonth(nowMs: number): number {
  return Math.max(1, utcDaysInMonth(nowMs) - new Date(nowMs).getUTCDate() + 1)
}

/**
 * 이번 달에 **실제로 지난** 날수(소수). 1일 00:00 UTC → 0, 2일 12:00 → 1.5.
 *
 * ⚠️ 날짜를 정수로 세면 안 된다 — "오늘"을 꽉 찬 하루로 세면 분모가 커져 **일당 속도가 과소평가**되고,
 *   그러면 유어딜 예약분이 작아져 유어애즈가 그 몫을 먹는다(= 안전하지 않은 방향).
 */
export function utcMonthElapsedDays(nowMs: number): number {
  const d = new Date(nowMs)
  return Math.max(0, (nowMs - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)) / 86_400_000)
}
