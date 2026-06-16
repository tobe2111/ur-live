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
        // 🚑 2026-06-16 (사용자 신고 — 상품 왔다갔다): 빈 배열 SSR 은 '없음'으로 취급.
        //   콜드 isolate/일시 오류로 빈 페이로드가 주입되면 guest 가 initialData(빈) 로 고착 → refetch 안 함.
        //   length>0 일 때만 consume → 빈 SSR 이면 클라가 정상 fetch 로 복구.
        if (parsed?.success && Array.isArray(parsed.items) && parsed.items.length > 0) _ssrWholesale = parsed.items as CatalogItem[]
      } catch { /* 손상 — fetch 로 진행 */ }
      el.remove()
    }
  }
  return _ssrWholesale
}
