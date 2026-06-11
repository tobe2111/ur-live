import type { CatalogItem } from './types'

// 🏭 2026-06-10: SSR 주입 데이터 1회 읽기 (모듈 캐시 — initialData/placeholderData 양쪽 공유).
let _ssrWholesale: CatalogItem[] | null | undefined
export function readSsrWholesale(): CatalogItem[] | null {
  if (_ssrWholesale !== undefined) return _ssrWholesale
  _ssrWholesale = null
  if (typeof document !== 'undefined') {
    const el = document.getElementById('__SSR_INITIAL_WHOLESALE__')
    if (el?.textContent) {
      try {
        const parsed = JSON.parse(el.textContent) as { success?: boolean; items?: CatalogItem[] }
        if (parsed?.success && Array.isArray(parsed.items)) _ssrWholesale = parsed.items as CatalogItem[]
      } catch { /* 손상 — fetch 로 진행 */ }
      el.remove()
    }
  }
  return _ssrWholesale
}
