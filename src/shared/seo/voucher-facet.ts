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

/**
 * 🔢 facet 이 thin 이 되지 않는 최소 재고 (2026-10-18).
 *
 * **라이브 실측으로 정했다**(Googlebot UA 로 받아 `<noscript>` 를 파싱): 가장 작은 카테고리
 * `마트상품권`(5건)도 본문 **159자 · 항목 5개 · 사진 4장**이고, `음악`(7건) 258자 ·
 * `영화`(12건) 270자였다 — 8줄 상한에 걸리기 전까지는 건수가 곧 본문 길이다.
 * 5건이 thin 이 아니므로 3을 쓴다(3건이면 ~100자 · 그 아래는 제출 가치가 없다).
 *
 * 🔴 `REGION_INDEX_MIN_DEALS` 와 **값이 같지만 다른 축이다** — 저쪽은 *매장*을 세고 이쪽은
 *   *상품*을 센다. 한쪽을 고칠 때 다른 쪽이 따라가면 안 되므로 상수를 공유하지 않는다.
 */
export const VOUCHER_FACET_MIN_ITEMS = 3

/**
 * 🔗 facet 주소 조립 — **한 곳에서만** 한다. canonical(`consumer-surfaces`)·sitemap 제출·허브
 * 내부 링크가 같은 함수를 지나므로 표기가 갈릴 수 없다(2026-10-12 에 `/pass`↔`/stays` 로
 * 그 대가를 치렀고, 같은 해 sitemap 이 한글 URL 43건을 인코딩 없이 제출한 것도 이 클래스다).
 */
export function voucherFacetPath(category: string): string {
  return `/vouchers?category=${encodeURIComponent(category)}`
}

/**
 * 🧾 재고 집계 → **sitemap 이 제출할** facet 목록(건수 내림차순).
 *
 * 🔴 **제출은 "색인해 달라" 라서 엄격하다** — 허용목록(`VOUCHER_FILTER_CATEGORIES`, canonical 이
 *   믿는 그 집합) ∩ 재고 `VOUCHER_FACET_MIN_ITEMS` 이상. 둘 중 하나라도 빠지면
 *   *제출한 URL 의 정본이 다른 곳을 가리키거나*(허용목록 밖은 canonical 이 `/vouchers` 로
 *   통합한다) *빈 목록을 색인 요청한다*(2026-07-29 영문 슬러그 6건 사고).
 *
 * ⚠️ **집계가 비면 빈 배열이고, 그때 sitemap 은 종전 3개로 폴백한다**(그 판단은 호출부에 있다 —
 *    여기서 폴백을 넣으면 "집계 실패" 와 "재고 0" 이 구분되지 않는다).
 */
export function voucherFacetsByStock(
  rows: ReadonlyArray<{ category?: string | null; n?: number | null }>,
): Array<{ category: string; count: number }> {
  const out: Array<{ category: string; count: number }> = []
  for (const r of rows || []) {
    const cat = typeof r?.category === 'string' ? r.category.trim() : ''
    const n = Number(r?.n)
    if (!cat || !VOUCHER_FILTER_CATEGORIES.includes(cat)) continue
    if (!Number.isFinite(n) || n < VOUCHER_FACET_MIN_ITEMS) continue
    out.push({ category: cat, count: n })
  }
  return out.sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
}

/**
 * 🧭 허브(`/vouchers`)가 크롤러 문서에 낼 **카테고리 링크**.
 *
 * **왜 필요한가(라이브 실측 2026-10-18, Googlebot UA)**: 허브 본문은 295자에 h1·h2 까지 멀쩡한데
 * **`<a href>` 가 0개**였다. 그래서 facet 20개는 sitemap 으로만 발견됐고 그중 **제출은 3개**뿐이라
 * **17개로 들어가는 길이 아예 없었다**. facet 자체는 2026-10-12 수리로 **이미 멀쩡하다**(제출 안 된
 * `?category=치킨` 도 제목·self-canonical·본문 275자를 낸다) — 비어 있던 것은 발견 경로뿐이다.
 *
 * 🔴 **상품 항목은 여전히 링크하지 않는다** — 교환권 상세는 2026-07-07 결정으로 noindex 이고,
 *   색인 말라고 한 URL 로 크롤 예산을 보내지 않는다(`crawler-noscript.ts` 가 그 이유로 `/vouchers`
 *   항목에 a태그를 안 단다). **카테고리는 그 이유에 해당하지 않는다** — facet 은 index 대상이다.
 *   두 축이 다르고, 가드가 양방향을 고정한다.
 *
 * 🔑 **왜 재고 집계를 안 보나(= `/region` 과 다른 선택)**: 지역 44곳은 *주소에서 파싱*해야 알 수
 *   있는 동적 값이라 요약이 없으면 링크를 **지어내게** 된다. 교환권 카테고리는 **코드에 선언된
 *   고정 집합**이고 라이브와 정확히 일치한다(실측 2026-10-18: `/api/vouchers/categories` 20종 =
 *   SSOT 20종, 전부 count ≥ 5). 그래서 지어내기가 아니다. 그리고 이 요약을 KV 로 읽으면
 *   **사람 요청마다** 비용을 물리는데 그 값은 `<noscript>` 전용이라 사람에게는 렌더조차 안 된다.
 *
 * ⚠️ **대가**: 어떤 카테고리가 재고 0 이 되면 빈 facet 으로 가는 내부 링크가 하나 남는다.
 *    색인 피해는 없다 — **sitemap 이 그 facet 을 제출하지 않는다**(위 `voucherFacetsByStock`).
 *    즉 링크는 관대하고 제출은 엄격하다. 두 방향이 다른 것이 의도다.
 * ⚠️ **이 함수가 못 보는 것**: SSOT 20종이 라이브와 어긋나는 순간(테스트는 라이브를 못 본다).
 */
export function voucherFacetLinks(): Array<{ label: string; href: string }> {
  // 라벨은 **카테고리 이름 그대로** — `regionChildLinks` 가 `ref.sigungu || ref.sido` 를 쓰는 것과
  // 같은 규율이다(허브 h1 이 "교환권" 이라 문맥이 이미 있고, 말을 덧붙이면 20줄이 같은 꼬리를 단다).
  return VOUCHER_FILTER_CATEGORIES.map((c) => ({ label: c, href: voucherFacetPath(c) }))
}
