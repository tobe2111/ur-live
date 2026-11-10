/**
 * 🖼️ 검색 결과 첫 줄 썸네일 preload (2026-11-10).
 *
 * 라이브 실측(폰 4G · CPU 4배, 시드 배포 뒤): `/search?q=돈가스` LCP **2.6~2.8s** — 요소가 첫 줄 썸네일(`IMG.w-[88px]`).
 * 시드로 줄은 마운트 즉시 그려지는데 사진은 그때서야 출발했다. 시드를 이미 들고 있으니 첫 몇 장을 응답 헤더로 미리 당긴다
 * (유어쇼츠 `urshorts-seed.ts` 와 같은 방법).
 *
 * 지킬 것 둘:
 *   ① 주소 = 줄이 그리는 `<img src>` — 같은 함수(`cfImage`) · 같은 옵션(`ROW_THUMB_OPTS`).
 *   ② 고르는 줄 = 화면이 그리는 줄 — `SearchPage` 의 범위 필터(교환권 범위는 `deal_only=1` 만 · 그 외는 이용권만)를 그대로 따른다.
 *      다른 줄의 사진을 당기면 쓰지도 않을 것을 받는다.
 * 같은 출처 경로(`/…`)만 싣는다(`appendLcpLink` 규칙) — 바깥 주소는 건너뛴다.
 */
import { cfImage } from '../../utils/cf-image'
import { ROW_THUMB_OPTS } from '../../shared/row-thumb'
import { isVoucherCategory } from '../../shared/constants/voucher-categories'
import type { SearchScope } from '../../shared/search-page'

export const SEARCH_THUMB_PRELOAD_COUNT = 4

type Row = { image_url?: string | null; deal_only?: number | string | null; category?: string | null }

/** `SearchPage.getSortedAndFilteredProducts` 의 범위 판정과 같다(가격 범위는 0~100만 기본이라 영향 없음). */
export function searchRowVisible(p: Row, scope: SearchScope): boolean {
  if (scope === 'exchange') return Number(p.deal_only) === 1
  if (Number(p.deal_only) === 1) return false
  if (p.category && !isVoucherCategory(p.category)) return false
  return true
}

export function searchThumbPreloadHrefs(ssrPayload: string | null | undefined, scope: SearchScope, n = SEARCH_THUMB_PRELOAD_COUNT): string[] {
  try {
    if (!ssrPayload) return []
    const parsed = JSON.parse(ssrPayload) as { data?: Row[] }
    if (!Array.isArray(parsed?.data)) return []
    return parsed.data.filter((p) => searchRowVisible(p, scope)).slice(0, n)
      .map((p) => p.image_url || '')
      .filter(Boolean)
      .map((src) => cfImage(src, ROW_THUMB_OPTS))
      .filter((u) => !!u && u.startsWith('/') && !u.startsWith('//'))
  } catch { return [] }
}
