/**
 * 멀티 통화 포맷팅
 * - 한국: KRW (원)
 * - 글로벌: USD ($), JPY (¥), CNY (¥)
 */
import { isKorea } from '@/shared/config/region'
import { formatNumber } from '@/utils/format'

type CurrencyCode = 'KRW' | 'USD' | 'JPY' | 'CNY' | 'EUR'

const RATES: Record<CurrencyCode, number> = {
  KRW: 1,
  USD: 0.00074,  // 1 KRW ≈ 0.00074 USD
  JPY: 0.11,     // 1 KRW ≈ 0.11 JPY
  CNY: 0.0053,   // 1 KRW ≈ 0.0053 CNY
  EUR: 0.00068,  // 1 KRW ≈ 0.00068 EUR
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

export function formatPrice(krwAmount: number, currency?: CurrencyCode): string {
  const cur = currency || getCurrency()
  if (cur === 'KRW') return `${formatNumber(krwAmount)}원`

  const converted = krwAmount * RATES[cur]
  const symbol = SYMBOLS[cur]

  if (cur === 'JPY') return `${symbol}${Math.round(converted)}`
  return `${symbol}${converted.toFixed(2)}`
}

export function formatPriceWithOriginal(krwAmount: number): string {
  const cur = getCurrency()
  if (cur === 'KRW') return `${formatNumber(krwAmount)}원`

  const converted = krwAmount * RATES[cur]
  const symbol = SYMBOLS[cur]
  const formatted = cur === 'JPY' ? `${symbol}${Math.round(converted)}` : `${symbol}${converted.toFixed(2)}`
  return `${formatted} (${formatNumber(krwAmount)}원)`
}
