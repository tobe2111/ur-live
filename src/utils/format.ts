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

/**
 * 🛡️ 2026-05-19: 상품 가격 단위 자동 — deal_only=1 이면 '딜', 아니면 '원'.
 *   KT Alpha 교환권은 딜로만 결제하므로 '원' 표시는 사용자 혼란 유발.
 *   모든 상품 카드 / 그리드 / 상세 / 메인 페이지가 이 helper 사용.
 *
 *   formatProductPrice({ price: 240000, deal_only: 1 })  // → "240,000 딜"
 *   formatProductPrice({ price: 5000,   deal_only: 0 })  // → "5,000원"
 *   formatProductPrice(5000)                              // → "5,000원" (legacy: number 만 받는 시그니처)
 */
export function formatProductPrice(
  productOrValue: unknown,
  legacyDealOnly?: unknown,
): string {
  // 두 가지 호출 방식 지원:
  //   formatProductPrice(product)         — { price, deal_only } 객체
  //   formatProductPrice(price, deal_only) — 분리된 인자 (기존 호출 호환)
  let price: unknown
  let dealOnly: unknown
  if (productOrValue && typeof productOrValue === 'object' && 'price' in (productOrValue as Record<string, unknown>)) {
    const obj = productOrValue as Record<string, unknown>
    price = obj.price
    dealOnly = obj.deal_only ?? obj.dealOnly
  } else {
    price = productOrValue
    dealOnly = legacyDealOnly
  }
  const isDeal = Number(dealOnly) === 1 || dealOnly === true
  const formatted = formatNumber(price)
  return isDeal ? `${formatted} 딜` : `${formatted}원`
}

/** deal_only 상품의 단위 ('딜' / '원') 만 반환 — 가격과 분리 표시 시. */
export function priceUnitFor(dealOnly: unknown): string {
  return (Number(dealOnly) === 1 || dealOnly === true) ? '딜' : '원'
}
