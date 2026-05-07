/**
 * 🛡️ 2026-04-29: SellerLiveBroadcastPage 의 localStorage helper 분리 (TD-006).
 *
 * 송출 도구 마지막 선택, 최근 상품, 마지막 방송 값, 템플릿 — 모두 localStorage 영속.
 * SSR / storage 차단 환경 (incognito strict mode) 안전 처리 (try-catch).
 */

export type StreamMethod = 'youtube' | 'youtube-webcam' | 'obs' | 'prism' | 'quick'

export interface BroadcastTemplate {
  name: string
  title: string
  description: string
  privacy: 'public' | 'unlisted' | 'private'
  productIds: number[]
}

const METHOD_STORAGE_KEY = 'seller_live_last_method'
const RECENT_PRODUCTS_KEY = 'seller_live_recent_products'
const LAST_BROADCAST_KEY = 'seller_live_last_broadcast'
const TEMPLATES_KEY = 'seller_live_templates'

export function getLastUsedMethod(): StreamMethod {
  try {
    const v = localStorage.getItem(METHOD_STORAGE_KEY)
    // 🛡️ 2026-05-07: 'quick' 옵션 메뉴에서 제거 → legacy 값은 'obs' 로 매핑 (OBS 자동 연결 = Quick 동작)
    if (v === 'quick') return 'obs'
    if (v === 'youtube' || v === 'youtube-webcam' || v === 'obs' || v === 'prism') return v
  } catch { /* SSR or blocked */ }
  if (typeof window !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent)) return 'prism'
  return 'obs'
}

export function rememberMethod(m: StreamMethod): void {
  try { localStorage.setItem(METHOD_STORAGE_KEY, m) } catch { /* ignore */ }
}

export function getRecentProducts(): number[] {
  try {
    const v = localStorage.getItem(RECENT_PRODUCTS_KEY)
    return v ? JSON.parse(v) : []
  } catch { return [] }
}

export function rememberRecentProducts(ids: number[]): void {
  try { localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(ids.slice(0, 20))) } catch { /* ignore */ }
}

export function getLastBroadcast(): { description?: string; thumbnailUrl?: string; privacy?: 'public' | 'unlisted' | 'private' } {
  try {
    const v = localStorage.getItem(LAST_BROADCAST_KEY)
    return v ? JSON.parse(v) : {}
  } catch { return {} }
}

export function rememberLastBroadcast(data: { description: string; thumbnailUrl: string; privacy: 'public' | 'unlisted' | 'private' }): void {
  try { localStorage.setItem(LAST_BROADCAST_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

export function getTemplates(): BroadcastTemplate[] {
  try {
    const v = localStorage.getItem(TEMPLATES_KEY)
    return v ? JSON.parse(v) : []
  } catch { return [] }
}

export function saveTemplates(templates: BroadcastTemplate[]): void {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.slice(0, 10))) } catch { /* ignore */ }
}
