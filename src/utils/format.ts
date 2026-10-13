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

/**
 * UTC 로 저장된 타임스탬프("YYYY-MM-DD HH:MM:SS")를 **한국시간(KST, +9h)** 짧은 표기("MM-DD HH:MM")로.
 *   서버 통계는 `new Date().toISOString()`(UTC)로 저장 → 화면에선 KST 로 보여줘야 한국 대표에게 맞음.
 *   브라우저 타임존에 의존하지 않도록 +9h 를 직접 더해 UTC getter 로 포맷(결정적).
 */
export function kstShort(utc: unknown): string {
  const s = String(utc || '').trim()
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T') + (/[zZ]|[+\-]\d\d:?\d\d$/.test(s) ? '' : 'Z'))
  if (isNaN(d.getTime())) return s.slice(5, 16)
  const k = new Date(d.getTime() + 9 * 3600 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`
}

// ⚡ 2026-10-12 포매터를 로캘마다 **한 번만** 만든다. `n.toLocaleString(locale)` 은 부를 때마다 숫자 포매터를
//   새로 짓는다 — 홈 첫 렌더(카드 가격·정가·할인)에서 이 함수 자체 시간만 74ms(CPU 4배 재생)였다.
//   기본 옵션이 같으므로 출력은 toLocaleString 과 동일하다(테스트가 대조).
const NUMBER_FORMATS = new Map<string, Intl.NumberFormat>()
function numberFormat(locale: string): Intl.NumberFormat {
  let f = NUMBER_FORMATS.get(locale)
  if (!f) { f = new Intl.NumberFormat(locale); NUMBER_FORMATS.set(locale, f) }
  return f
}

// ⚡ 2026-10-13 정수는 포매터 없이 쉼표만 찍는다. 위 캐시로 *반복* 비용은 없앴지만 첫 생성 한 번
//   (`new Intl.NumberFormat('ko-KR')` — 로캘 데이터 적재)이 홈 첫 카드 가격을 그리는 바로 그 렌더에서
//   65ms(CPU 4배 재생)였다. 가격·수량은 거의 전부 정수이고, ko-KR 정수 표기는 세 자리 쉼표·하이픈 부호뿐이라
//   Intl 과 같은 문자열이 나온다(테스트가 Intl 과 대조). 소수·-0·안전범위 밖·다른 로캘은 종전대로 Intl.
function groupInt(n: number): string {
  const s = String(Math.abs(n))
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ','
    out += s[i]
  }
  return n < 0 ? '-' + out : out
}

export function formatNumber(value: unknown, locale: string = 'ko-KR'): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0'
  if (locale === 'ko-KR' && Number.isSafeInteger(n) && !Object.is(n, -0)) return groupInt(n)
  return numberFormat(locale).format(n)
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
  return numberFormat('ko-KR').format(n)
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
