import type { StreamMethod, BroadcastTemplate } from '@/components/seller/broadcast/broadcast-types'

// ── 송출 도구 마지막 선택 기억 ──────────────────────────────────
const METHOD_STORAGE_KEY = 'seller_live_last_method'
export function getLastUsedMethod(): StreamMethod {
  try {
    const v = localStorage.getItem(METHOD_STORAGE_KEY)
    if (v === 'youtube' || v === 'obs' || v === 'prism' || v === 'quick') return v
  } catch { /* SSR or blocked */ }
  if (typeof window !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent)) return 'prism'
  return 'obs'
}
export function rememberMethod(m: StreamMethod) {
  try { localStorage.setItem(METHOD_STORAGE_KEY, m) } catch { /* ignore */ }
}

// ── 최근 사용 상품 / 마지막 방송 값 prefill ─────────────────────
export const RECENT_PRODUCTS_KEY = 'seller_live_recent_products'
export const LAST_BROADCAST_KEY = 'seller_live_last_broadcast'
export const TEMPLATES_KEY = 'seller_live_templates'

export function getRecentProducts(): number[] {
  try {
    const v = localStorage.getItem(RECENT_PRODUCTS_KEY)
    return v ? JSON.parse(v) : []
  } catch { return [] }
}
export function rememberRecentProducts(ids: number[]) {
  try { localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(ids.slice(0, 20))) } catch { /* ignore */ }
}
export function getLastBroadcast(): { description?: string; thumbnailUrl?: string; privacy?: 'public' | 'unlisted' | 'private' } {
  try {
    const v = localStorage.getItem(LAST_BROADCAST_KEY)
    return v ? JSON.parse(v) : {}
  } catch { return {} }
}
export function rememberLastBroadcast(data: { description: string; thumbnailUrl: string; privacy: 'public' | 'unlisted' | 'private' }) {
  try { localStorage.setItem(LAST_BROADCAST_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}
export function getTemplates(): BroadcastTemplate[] {
  try {
    const v = localStorage.getItem(TEMPLATES_KEY)
    return v ? JSON.parse(v) : []
  } catch { return [] }
}
export function saveTemplates(templates: BroadcastTemplate[]) {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.slice(0, 10))) } catch { /* ignore */ }
}
