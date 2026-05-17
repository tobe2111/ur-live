/**
 * 🛡️ 2026-04-30: 안전한 숫자 포매팅 헬퍼
 *
 * 문제: `value.toLocaleString()` 직접 호출 시 value 가 null/undefined 면
 *   "Cannot read properties of null (reading 'toLocaleString')" crash 발생.
 *   `(value || 0).toLocaleString()` 가드도 비-number (string/object) 입력 시 실패 가능.
 *
 * 해결: 모든 input 을 Number() 로 변환 (null → 0, undefined → 0, NaN → 0, "5" → 5).
 *
 * 사용:
 *   formatNumber(product.price)        // → "1,234"
 *   formatNumber(null)                  // → "0"
 *   formatNumber(undefined)             // → "0"
 *   formatNumber("5000")                // → "5,000"
 *   formatPrice(product.price)          // → "1,234원"
 */

export function formatNumber(value: unknown, locale: string = 'ko-KR'): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale)
}

/** 가격 포매팅 — '1,234원' 형식 */
export function formatPrice(value: unknown, locale: string = 'ko-KR'): string {
  return `${formatNumber(value, locale)}원`
}

/** 한국 통화 약식 (만/억) — 큰 숫자 압축 표시용 */
export function formatPriceShort(value: unknown): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`
  return n.toLocaleString('ko-KR')
}

/**
 * 🛡️ 2026-05-17: 산술 연산용 안전 숫자 변환.
 *   `a * b` 를 직접 하면 한 쪽이 null/undefined 일 때 NaN 전파 → 화면에 ₩NaN 노출.
 *   safeNum(value) 로 항상 finite number 보장.
 *
 *   safeNum(null)         // → 0
 *   safeNum(undefined)    // → 0
 *   safeNum(NaN)          // → 0
 *   safeNum("3.5")        // → 3.5
 *   safeNum(7)            // → 7
 */
export function safeNum(value: unknown, fallback = 0): number {
  const n = Number(value ?? fallback)
  return Number.isFinite(n) ? n : fallback
}

/** ₩1,234 — 셀러/어드민 대시보드에서 자주 쓰이는 ₩ 접두 포매팅 */
export function formatWon(value: unknown): string {
  return `₩${formatNumber(value)}`
}
