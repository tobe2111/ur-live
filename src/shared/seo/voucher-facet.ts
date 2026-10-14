/**
 * 🎟️ 교환권 목록의 **카테고리 facet** 시드 경로 — `/vouchers?category=<허용값>` (2026-10-12)
 *
 * **왜 필요한가(라이브 실측 — Googlebot UA 로 받아 본문 글자수를 셌다)**: sitemap 이 제출하는
 * facet 세 건(`편의점`·`커피/음료`·`베이커리/도넛`)의 크롤러 본문이 **8자**였다(로더 워드마크뿐).
 * `<title>`·description·canonical 은 카테고리별로 멀쩡한데 본문만 비어 있었다 —
 * 워커 VOUCHERS 슬롯 조건이 `!url.search` 라서 **쿼리가 붙는 순간 시드를 아예 안 받는다.**
 * ⇒ *"색인해 달라"* 고 제출한 URL 에 크롤러가 읽을 것을 한 줄도 주지 않는 상태였고,
 * 이것은 같은 날 유어샵·쇼핑 상세에서 고친 **짝 주장이 깨진** 바로 그 클래스다.
 *
 * 🔑 **재료는 이미 있었다**: `/api/products` 가 `category=` 를 서버에서 필터해 20건을 돌려준다
 * (실측 세 카테고리 전부 20건). 그리고 `커피/음료` 키는 **예열 목록에 이미 있다**
 * (`cache-prewarm.ts` — 2026-06-04 "홈 = 교환권" 이던 시절에 들어갔고 그 뒤 홈이 딜 피드로
 * 바뀌면서 **요청하는 곳이 0** 인 고아 키가 됐다). 이 모듈이 그 키를 **다시 쓰이게** 만든다
 * ⇒ 그 카테고리는 새 캐시 키·새 왕복이 **0** 이다(나머지 둘은 콜드 1회 self-fetch).
 *
 * 🔴 **쿼리가 `?category=<허용값>` **하나뿐**일 때만 받는다.** `&sort=price_high` 가 붙으면
 * 화면은 비싼 순인데 시드는 `sort=price_low` 라 **크롤러가 화면과 다른 목록**을 읽는다 —
 * 그건 클로킹 쪽으로 기울고, sitemap 이 제출하는 모양도 정확히 한 파라미터다.
 * 허용값은 `VOUCHER_FILTER_CATEGORIES`(canonical 이 믿는 그 SSOT)에서만 — 두 벌이면
 * canonical 은 통합하는데 본문은 내보내는(또는 그 반대) 모순이 조용히 생긴다.
 */
import { VOUCHER_FILTER_CATEGORIES } from './consumer-surfaces'

/**
 * `/vouchers` 기본 시드 경로. 🔒 `cache-prewarm.ts` HOT_PATHS 의 VOUCHERS 항목과 **byte-동일**해야
 * 한다 — 갈리면 예열이 조용히 헛돈다(2026-10-11 에 칩 4종이 정확히 그렇게 몇 달간 헛돌았다).
 */
export const VOUCHERS_SEED_PATH = '/api/products?page=1&limit=20&deal_only=1&sort=price_low'

/**
 * ☕ 2026-10-14 (대표 *"첫 화면은 이렇게 떠줘"* — 스크린샷: 커피/음료 선택 + 브랜드 로고 줄): `/vouchers` 첫 화면 카테고리.
 *   화면(`VouchersPage` 기본값)과 서버 시드(워커 VOUCHERS 슬롯)가 **같은 상수**를 쓴다 — 갈리면 서버가 '전체'를
 *   주고 화면은 커피를 다시 요청한다(첫 방문 요청 2회 — 2026-10-06 에 없앤 바로 그 낭비).
 */
export const VOUCHERS_DEFAULT_CATEGORY = '커피/음료'
/** 첫 화면 시드 경로. `cache-prewarm.ts` HOT_PATHS 의 커피/음료 키와 byte-동일(예열이 이미 있다). */
export const VOUCHERS_DEFAULT_SEED_PATH = `${VOUCHERS_SEED_PATH}&category=${encodeURIComponent(VOUCHERS_DEFAULT_CATEGORY)}`

/** facet 시드 경로. `null` = facet 이 아니다(= 종전대로 시드 없음). */
export function voucherFacetSeedPath(search: string): string | null {
  const q = new URLSearchParams(search)
  // 파라미터가 정확히 하나이고 그게 허용 카테고리일 때만.
  let n = 0
  q.forEach(() => { n += 1 })
  if (n !== 1) return null
  const cat = q.get('category')?.trim()
  if (!cat || !VOUCHER_FILTER_CATEGORIES.includes(cat)) return null
  return `${VOUCHERS_SEED_PATH}&category=${encodeURIComponent(cat)}`
}
