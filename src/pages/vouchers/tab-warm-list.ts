/**
 * 🎁 교환권 기본 목록 미리받기 — `tab-warm.ts` 가 탭 코드를 받은 뒤 **동적으로** 부른다.
 *   첫 화면 번들에 넣지 않으려고 따로 둔 모듈이다.
 */
import { readListView, saveListView } from '@/lib/list-view-cache'
import { VOUCHERS_DEFAULT_CATEGORY, VOUCHERS_DEFAULT_SEED_PATH } from '@/shared/seo/voucher-facet'

/**
 * 🎁 교환권 탭은 코드가 와 있어도 **상품 목록**을 기다리는 로더가 남는다(로컬 실측 — 청크 0건인데 로더 15프레임).
 * 그래서 탭 코드를 받은 뒤 **기본 화면(커피/음료 · 낮은 가격순) 1페이지**도 받아, 페이지가 재방문에 쓰는
 * 보관함(`list-view-cache`)에 넣어 둔다 → 처음 눌러도 `warm` 시드로 그려지고 최신 목록은 뒤에서 교체된다.
 *  - 주소는 워커 시드·cron 예열과 **같은 키**(`VOUCHERS_DEFAULT_SEED_PATH`)라 엣지 캐시를 맞는다.
 *  - 보관 키·모양은 `VouchersPage` 의 것과 같아야 한다 — 시험이 그 소스와 대조한다(갈리면 조용히 안 쓰인다).
 *  - 이미 보관본이 있으면 덮지 않는다(그쪽이 사용자가 실제로 본 것이다).
 */
export const VOUCHERS_PAGE_SIZE = 20
export const VOUCHERS_PAGE_INITIAL_VISIBLE = 9
export const VOUCHERS_DEFAULT_VIEW_KEY = `vouchers:list:page:${VOUCHERS_DEFAULT_CATEGORY}||price_low`

export async function warmVouchersList(fetcher: (url: string) => Promise<ListBody> = defaultFetch): Promise<boolean> {
  if (readListView(VOUCHERS_DEFAULT_VIEW_KEY) != null) return false
  const body = await fetcher(VOUCHERS_DEFAULT_SEED_PATH).catch(() => null)
  if (!body?.success || !Array.isArray(body.data) || body.data.length === 0) return false
  if (readListView(VOUCHERS_DEFAULT_VIEW_KEY) != null) return false // 받는 사이 사용자가 먼저 열었다
  saveListView(VOUCHERS_DEFAULT_VIEW_KEY, {
    products: body.data,
    page: 1,
    hasMore: body.data.length === VOUCHERS_PAGE_SIZE,
    embedVisible: VOUCHERS_PAGE_INITIAL_VISIBLE,
  })
  return true
}

type ListBody = { success?: boolean; data?: unknown } | null
async function defaultFetch(url: string): Promise<ListBody> {
  const r = await fetch(url, { credentials: 'same-origin' })
  return r.ok ? ((await r.json()) as ListBody) : null
}

