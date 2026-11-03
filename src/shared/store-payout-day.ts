/**
 * 📅 매장 정산 요일 SSOT — 워커(`worker/utils/settlement-schedule.ts`)와 화면(정산 시트)이 같은 값을 쓴다.
 * 대표 결정(2026-06-23): 월~일 사용분 → **차주 목요일**. 2026-11-03 대표 *"매장들은 주 정산"* 재확인.
 * 정산 요일을 바꾸려면 **이 상수 + 테스트만** 고친다(화면 "다음 정산일" 도 따라 바뀐다).
 *   주(월~일, KST)의 그 주 일요일로부터 '며칠 뒤'에 정산하는가: 화=2 · 수=3 · 목=4(현행) · 금=5 …
 */
export const SETTLE_DAYS_AFTER_WEEK_SUNDAY = 4

const KST_MS = 9 * 60 * 60 * 1000
/**
 * 📅 다음 매장 정산일(KST, 'YYYY-MM-DD') — 화면이 "다음 정산일 11월 6일(목)" 을 그릴 때 쓴다(2026-11-03 대표
 * *"여기 아직 업데이트 안되어있네"*). 위 상수에서 요일을 뽑으므로 정산 요일을 바꾸면 화면도 같이 바뀐다.
 * cron 이 그날 03:00 KST 에 돌므로 **그날 03:00 전이면 오늘**, 지났으면 다음 주 같은 요일.
 */
export function nextWeeklySettlementDateKst(nowMs: number): string {
  const payDow = SETTLE_DAYS_AFTER_WEEK_SUNDAY % 7 // 일=0 기준 — 4 = 목요일
  const kst = new Date(nowMs + KST_MS)
  let add = (payDow - kst.getUTCDay() + 7) % 7
  if (add === 0 && kst.getUTCHours() >= 3) add = 7
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + add))
  return d.toISOString().slice(0, 10)
}
