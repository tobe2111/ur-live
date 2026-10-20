/**
 * 멀티 통화 포맷팅
 * - 한국: KRW (원)
 * - 글로벌: USD ($), JPY (¥), CNY (¥)
 */
import { isKorea } from '@/shared/config/region'
import { formatNumber } from '@/utils/format'

type CurrencyCode = 'KRW' | 'USD' | 'JPY' | 'CNY' | 'EUR'

// 🛡️ 2026-05-15: fallback (실시간 fetch 실패 시) — 2026-05 기준
let RATES: Record<CurrencyCode, number> = {
  KRW: 1,
  USD: 0.00072,  // 1 KRW ≈ 0.00072 USD
  JPY: 0.108,    // 1 KRW ≈ 0.108 JPY
  CNY: 0.0052,   // 1 KRW ≈ 0.0052 CNY
  EUR: 0.00067,  // 1 KRW ≈ 0.00067 EUR
}

// 🛡️ 2026-05-15: 환율 prefetch — 한국 외 locale 첫 진입 시 1회. localStorage 1h 캐시.
const RATES_CACHE_KEY = 'ur_currency_rates_v1'
const RATES_CACHE_TTL = 60 * 60 * 1000

export async function prefetchRates(): Promise<void> {
  if (isKorea()) return
  try {
    const cached = localStorage.getItem(RATES_CACHE_KEY)
    if (cached) {
      const { rates, expires } = JSON.parse(cached) as { rates: Record<string, number>; expires: number }
      if (Date.now() < expires) {
        RATES = { ...RATES, ...rates } as Record<CurrencyCode, number>
        return
      }
    }
  } catch { /* ignore */ }
  try {
    const res = await fetch('/api/currency/rates', { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return
    const data = await res.json() as { success?: boolean; rates?: Record<string, number> }
    if (data.success && data.rates) {
      RATES = { ...RATES, ...data.rates } as Record<CurrencyCode, number>
      try {
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates: data.rates, expires: Date.now() + RATES_CACHE_TTL }))
      } catch { /* silent */ }
    }
  } catch { /* fallback OK */ }
}

const SYMBOLS: Record<CurrencyCode, string> = {
  KRW: '원',
  USD: '$',
  JPY: '¥',
  CNY: '¥',
  EUR: '€',
}

export function getCurrency(): CurrencyCode {
  if (isKorea()) return 'KRW'
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('ja')) return 'JPY'
  if (lang.startsWith('zh')) return 'CNY'
  if (lang.startsWith('fr') || lang.startsWith('de') || lang.startsWith('es') || lang.startsWith('it')) return 'EUR'
  return 'USD'
}

/**
 * 가격 포매팅 — 후위 호환 + deal_only 인지.
 *
 *   formatPrice(5000)                              // → "5,000원"  (locale 따라 통화 변환)
 *   formatPrice(5000, 'USD')                       // → "$3.60"
 *   formatPrice(240000, { dealOnly: true })        // → "240,000 딜"  (KT Alpha 교환권)
 *   formatPrice(240000, { dealOnly: 1 })           // → "240,000 딜"  (DB 정수 그대로)
 *   formatPrice(5000, { dealOnly: 0, currency: 'JPY' }) // → "¥540"
 *
 * 🛡️ 2026-05-19: deal_only=1 상품은 locale 과 무관하게 항상 '딜' 단위.
 *   딜은 플랫폼 내부 포인트라 통화 변환 무의미.
 */
export function formatPrice(
  krwAmount: number,
  optionsOrCurrency?: CurrencyCode | { dealOnly?: boolean | number; currency?: CurrencyCode },
): string {
  let currency: CurrencyCode | undefined
  let dealOnly: boolean | number | undefined
  if (typeof optionsOrCurrency === 'string') {
    currency = optionsOrCurrency
  } else if (optionsOrCurrency) {
    currency = optionsOrCurrency.currency
    dealOnly = optionsOrCurrency.dealOnly
  }

  if (Number(dealOnly) === 1 || dealOnly === true) {
    return `${formatNumber(krwAmount)} 딜`
  }

  const cur = currency || getCurrency()
  if (cur === 'KRW') return `${formatNumber(krwAmount)}원`

  const converted = krwAmount * RATES[cur]
  const symbol = SYMBOLS[cur]

  if (cur === 'JPY') return `${symbol}${Math.round(converted)}`
  return `${symbol}${converted.toFixed(2)}`
}

export function formatPriceWithOriginal(krwAmount: number, options?: { dealOnly?: boolean | number }): string {
  if (Number(options?.dealOnly) === 1 || options?.dealOnly === true) {
    return `${formatNumber(krwAmount)} 딜`
  }
  const cur = getCurrency()
  if (cur === 'KRW') return `${formatNumber(krwAmount)}원`

  const converted = krwAmount * RATES[cur]
  const symbol = SYMBOLS[cur]
  const formatted = cur === 'JPY' ? `${symbol}${Math.round(converted)}` : `${symbol}${converted.toFixed(2)}`
  return `${formatted} (${formatNumber(krwAmount)}원)`
}
