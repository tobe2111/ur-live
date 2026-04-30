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
