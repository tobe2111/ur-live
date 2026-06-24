/**
 * 🗓️ 2026-06-23 (대표 결정): 주간 정산 정책 — 월~일(KST) 사용분 → **차주 목요일(KST)** 정산.
 *   (이전 '사용 후 7일 롤링' 대체.)
 *
 * `weeklySettlementCutoffUtc(nowMs)` = 정산 대상 상한(UTC, 'YYYY-MM-DD HH:MM:SS').
 *   used_at(UTC) < 이 값이면 정산 대상.
 *   = '정산이 도래한' 가장 최근 주(월~일)의 **일요일 다음날(월) 00:00 KST** 를 UTC 로 환원.
 *
 * 도래 조건: now(KST) ≥ 그 주의 차주 목요일 00:00 KST
 *           ⇔ 대상 일요일(날짜) ≤ (now − 4일)(KST)   [일요일→목요일 = +4일]
 *
 * auto-settlement cron 이 매일 03:00 KST(18:00 UTC) 돌므로, 각 주는 그 차주 목요일
 * 첫 실행(목 03:00 KST)에 정산된다. settlement_id 멱등이라 그 이후 재실행은 skip.
 * **절대 차주 목요일 이전엔 정산 안 함**(이 함수가 상한을 그 주 일요일까지로 제한).
 */
const KST_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function weeklySettlementCutoffUtc(nowMs: number): string {
  // KST 벽시계 컴포넌트를 getUTC* 로 읽기 위해 +9h 시프트.
  const kst = new Date(nowMs + KST_MS)
  const base = new Date(kst.getTime() - 4 * DAY_MS) // now − 4일 (일→목)
  const dow = base.getUTCDay() // 0=일 .. 6=토 (KST 기준 요일)
  // base 날짜 이하의 가장 최근 일요일(자정). Date.UTC 가 음수 일자도 정규화(월 경계 안전).
  const sundayMid = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - dow)
  const mondayMidKstFrame = sundayMid + DAY_MS // 대상 일요일 다음날(월) 00:00 (KST 프레임)
  const utc = new Date(mondayMidKstFrame - KST_MS) // 실제 UTC instant 로 환원
  return utc.toISOString().slice(0, 19).replace('T', ' ')
}
