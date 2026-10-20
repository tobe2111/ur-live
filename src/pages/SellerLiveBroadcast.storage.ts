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
const DRAFT_KEY = 'seller_live_draft_v1'
const PREFLIGHT_CACHE_KEY = 'seller_live_preflight_cache_v1'

export function getLastUsedMethod(): StreamMethod {
  try {
    const v = localStorage.getItem(METHOD_STORAGE_KEY)
    // 🛡️ 2026-05-07: 'quick' 옵션 메뉴에서 제거 → legacy 값은 'obs' 로 매핑 (OBS 자동 연결 = Quick 동작)
    if (v === 'quick') return 'obs'
    // 🛡️ 2026-05-11: youtube-webcam 옵션 복원 (OME 미운영 + OBS 미설치 셀러용).
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

export interface LastBroadcast {
  title?: string
  description?: string
  thumbnailUrl?: string
  privacy?: 'public' | 'unlisted' | 'private'
  productIds?: number[]
}

export function getLastBroadcast(): LastBroadcast {
  try {
    const v = localStorage.getItem(LAST_BROADCAST_KEY)
    return v ? JSON.parse(v) : {}
  } catch { return {} }
}

export function rememberLastBroadcast(data: { title: string; description: string; thumbnailUrl: string; privacy: 'public' | 'unlisted' | 'private'; productIds?: number[] }): void {
  try { localStorage.setItem(LAST_BROADCAST_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

export interface BroadcastDraft {
  title: string
  description: string
  thumbnailUrl: string
  privacy: 'public' | 'unlisted' | 'private'
  selectedProducts: number[]
  isScheduled: boolean
  scheduledDate: string
  scheduledTime: string
  savedAt: number
}

export function getDraft(): BroadcastDraft | null {
  try {
    const v = localStorage.getItem(DRAFT_KEY)
    if (!v) return null
    const d: BroadcastDraft = JSON.parse(v)
    // 임시저장은 24h 유효
    if (Date.now() - d.savedAt > 86_400_000) { localStorage.removeItem(DRAFT_KEY); return null }
    return d
  } catch { return null }
}

export function saveDraft(draft: Omit<BroadcastDraft, 'savedAt'>): void {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() })) } catch { /* ignore */ }
}

export function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
}

export interface PreflightCacheEntry {
  results: Array<{ key: string; label: string; status: 'pass' | 'warn' | 'fail'; detail?: string }>
  savedAt: number
}

export function getPreflightCache(): PreflightCacheEntry | null {
  try {
    const v = localStorage.getItem(PREFLIGHT_CACHE_KEY)
    if (!v) return null
    const d: PreflightCacheEntry = JSON.parse(v)
    // 15분 캐시
    if (Date.now() - d.savedAt > 15 * 60 * 1000) { localStorage.removeItem(PREFLIGHT_CACHE_KEY); return null }
    return d
  } catch { return null }
}

export function savePreflightCache(results: PreflightCacheEntry['results']): void {
  try { localStorage.setItem(PREFLIGHT_CACHE_KEY, JSON.stringify({ results, savedAt: Date.now() })) } catch { /* ignore */ }
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
