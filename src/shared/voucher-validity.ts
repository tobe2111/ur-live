/**
 * ⏳ 이용권 유효기간 상한 — 구매(발급)일로부터 12개월 (2026-11-17 대표 승인 *"응 다 해줘"*).
 *
 * 토스페이먼츠 PG 심사가 *"응모 및 당첨 후 결제 이후 이용권의 유효기간을 12개월 이내로 명시"* 를 요구했다.
 * 2026-08-22 정책(*"미설정 = 무기한"*)을 이 상한으로 대체한다:
 *   - 매장이 기한을 안 정했으면 → 발급일 + 12개월
 *   - 매장이 정한 날짜가 발급일 + 12개월보다 뒤면 → 12개월로 줄인다
 *   - 매장이 더 짧게 정했으면 → 그 값 그대로(문자열도 그대로 — 기존 동작 무변경)
 * 기한이 지나도록 안 쓴 이용권은 기존 자동 환불(만료 환불 cron)이 그대로 전액 돌려준다.
 *
 * 발급하는 모든 곳(즉시 구매 딜·카드, 장바구니, 체험단, 숙소 이용권)이 이 파일 하나를 쓴다.
 * 화면 문구도 `VOUCHER_VALIDITY_LABEL` 하나를 쓴다.
 */
export const VOUCHER_MAX_VALID_MONTHS = 12

/** 화면에 적는 문구(상세 이용 안내 · 응모 안내 · 환불정책). */
export const VOUCHER_VALIDITY_LABEL = `구매일로부터 ${VOUCHER_MAX_VALID_MONTHS}개월`

/** D1 `datetime('now')` 와 같은 모양(UTC, 'YYYY-MM-DD HH:MM:SS') — 만료 비교가 문자열 비교로 된다. */
function toD1(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

/** 발급 시각 기준 상한(발급일 + 12개월). */
export function voucherExpiryCap(now: Date = new Date()): string {
  const d = new Date(now.getTime())
  d.setUTCMonth(d.getUTCMonth() + VOUCHER_MAX_VALID_MONTHS)
  return toD1(d)
}

/**
 * 발급할 이용권의 `expires_at`. 매장 기한(`voucher_expiry` — 'YYYY-MM-DD' 또는 날짜시각)이 상한 안이면 그대로,
 * 없거나 상한 밖이면 상한. **절대 null 을 돌려주지 않는다**(무기한 이용권이 다시 생기지 않게).
 */
export function resolveVoucherExpiresAt(productExpiry: string | null | undefined, now: Date = new Date()): string {
  const cap = voucherExpiryCap(now)
  const raw = typeof productExpiry === 'string' ? productExpiry.trim() : ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && raw.slice(0, 10) <= cap.slice(0, 10)) {
    const v = dateOnlyToKstEndOfDay(raw)
    return v === raw || v <= cap ? v : cap // 상한 날짜와 같은 날이면 12개월을 넘기지 않게 상한 시각에서 멈춘다
  }
  return cap
}

/**
 * 📅 2026-11-18 (대표 승인 "기한 마지막 날 9시 만료 고치기"): 매장 입력칸이 날짜만(`type="date"`) 받아 `'2026-12-31'` 이
 * 그대로 저장됐고, 비교가 `expires_at < datetime('now')`(UTC 문자열)라 **12/31 00:00 UTC = 한국 오전 9시**에 이미 만료였다.
 * 손님은 "12/31까지" 로 안내받는다 ⇒ 날짜만이면 **그날 한국시간 23:59:59 = 같은 날 14:59:59 UTC** 로 적는다.
 * 시각까지 적힌 값은 그대로 둔다.
 */
export function dateOnlyToKstEndOfDay(raw: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw} 14:59:59` : raw
}

/** SQL 판(이미 발급된 행 고치기) — 날짜만 적힌 `expires_at` 을 그날 한국 자정 직전으로. 몇 번 돌려도 같다. */
export const VOUCHER_DATE_ONLY_EXPIRY_FIX_SQL =
  "UPDATE vouchers SET expires_at = expires_at || ' 14:59:59' WHERE length(expires_at) = 10 AND expires_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND status = 'unused'"

/** 숙소 이용권처럼 '며칠' 로 정하는 레일 — 일수를 상한(365일) 안으로. 0·빈 값이면 상한. */
export function capValidityDays(days: number | null | undefined): number {
  const n = Number(days)
  const max = 365
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : max
}
