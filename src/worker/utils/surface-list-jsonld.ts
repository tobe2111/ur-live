/**
 * 🔎 2026-10-11 — **목록·유어샵 표면의 구조화 데이터.** 대표 *"언제나 최상단에 노출이 될 수 있게끔
 * 세계최고의 SEO, GEO를 자랑하게 만들어줘"* · *"특히 이용권 페이지들은 더욱"*.
 *
 * ## 왜 생겼나 (라이브 실측 — 네이버 Yeti UA 로 서버 HTML 을 그대로 받아 셌다)
 * 상세는 멀쩡했다(`detail-ssr-meta.ts` 가 `Product`+`Offer`+`BreadcrumbList`+`LocalBusiness` 를 낸다).
 * 그런데 **목록 다섯 화면은 구조화 데이터가 0건**이었다:
 *
 *       경로                     breadcrumb  ld+json  ItemList
 *       /vouchers · /map · /stays · /browse · /u/:handle      0        0        0
 *
 * `applySurfaceMeta` 는 `jsonLd` 필드를 **이미** 갖고 있었는데(블로그 목록이 그 자리를 쓴다)
 * 소비자 목록 표면만 아무도 넘기지 않았다. 그래서 검색결과가 제목 아래에 **빵부스러기 대신
 * 생 URL**(`urdeal.kr › vouchers` 가 아니라 `https://urdeal.kr/vouchers`)을 보여 준다.
 *
 * ## 두 가지 규율
 * 1. **추가 요청 0.** 항목은 그 표면이 이미 받아 둔 SSR 시드(`__SSR_INITIAL_MAIN__` 등)에서만 뽑는다.
 *    시드가 없는 표면(`/map`·`/stays` — 슬롯이 없다)은 빵부스러기만 낸다. 구조화 데이터를 위해
 *    self-fetch 를 새로 만들지 않는다(서브리퀘스트 예산은 무료 50/인보케이션이고 실측 ~49다).
 * 2. **noindex 를 가리키지 않는다.** 교환권 상세(`/vouchers/:id`)는 2026-07-07 결정으로 `noindex` 다
 *    → `/vouchers` 목록은 **ItemList 를 안 낸다**(빵부스러기만). 색인하지 말라고 한 URL 을
 *    "이 목록의 항목입니다" 로 제출하면 서로 반대되는 신호를 보내는 것이다.
 *    항목 단위로도 같다 — 시드 안에 `deal_only=1` 이 섞여 있으면 그 항목만 뺀다.
 *
 * ## 왜 워커에 두나
 * 클라 `<SEO>`(react-helmet)는 **JS 렌더 후**라 네이버 Yeti·DaumOA 가 못 본다(`SEO.tsx` 의
 * 2026-07-28 주석이 같은 사실을 실측으로 기록해 뒀다). 목록 화면의 `<SEO>` 에 JSON-LD 를 더하면
 * 구글만 보고 네이버는 못 본다 — 그래서 서버에서 낸다.
 * ⚠️ 워커는 alias(`@/`) 를 못 푸는 esbuild 로 빌드되므로 **상대경로로 import** 할 것.
 */
import { canonicalDetailPath } from '../../shared/product-flow'
import { curatorHomePins } from '../../shared/curator-pin-order'
import { CONSUMER_SURFACE_SEO, CONSUMER_SITE_NAME, registerDynamicSurfaceSeo } from '../../shared/seo/consumer-surfaces'
import { withCrumbRoot } from '../../shared/seo/breadcrumb'
import { CONCEPT_FAQ } from '../../shared/seo/concept-content'
import { lifeCategoryCrumb, lifeJsonLdNodes, lifeCategorySeo } from '../../shared/life-seo'
import { landingJsonLdNodes } from './landing-seo'
import { agencyInviteSurfaceSeo } from '../../shared/agency-store-invite'
// 🏠 업종 페이지 서버 메타 — 여기서 끼운다(워커 index 가 이 모듈을 import 한다). 공용 번들엔 업종 데이터가 안 실린다.
registerDynamicSurfaceSeo(lifeCategorySeo)
// 🔗 에이전시 매장 영입 링크(2026-10-31) — 카톡에 주소를 붙여 넣으면 유어딜 홈 카드(`index, follow`)가 뜨던 것. 조회 없이 noindex.
registerDynamicSurfaceSeo(agencyInviteSurfaceSeo)
import { addressInRegion, parseRegionPath, regionPath, type RegionRef } from '../../shared/constants/region-slugs'
import { REGION_PATH_RE } from '../../shared/seo/region-seed'

/**
 * 목록 항목 상한. ItemList 는 **요약**이고 전량 덤프가 아니다(구글 캐러셀도 3~10개를 쓴다).
 * 📏 그리고 이 JSON 은 **사람이 받는 응답에도 그대로 실린다**(같은 구조화 데이터를 크롤러에게만
 * 주는 것은 구글 가이드 위반이다). 라이브 시드로 재니 20개면 **10.3KB**, 10개면 ~5KB 다 —
 * 첫 페인트 바이트를 아끼려고 10 으로 둔다(리치결과에 필요한 양은 이미 넘는다).
 */
export const SURFACE_LIST_MAX = 10

/**
 * `</script>` 가 문서를 깨뜨리는 것만 막는다. `detail-ssr-meta.ts`·`blog-ssr-meta.ts` 와 같은 처방.
 * ⚠️ `&`·`<` 를 HTML escape 하면 **JSON 이 깨진다**(`&amp;` 는 JSON 문자열이 아니다) — 하지 말 것.
 */
function escapeScript(json: string): string {
  return json.replace(/<\//g, '<\\/')
}

/**
 * 사진 URL 을 절대 URL 로. `data:`·빈 값은 `null`(구조화 데이터에서 뺀다).
 * ⚠️ 여기서 `cfImage` 를 거치지 않는다 — 구글 이미지는 **원본 해상도**를 선호하고,
 *    목록 카드의 preload URL 과 같아야 할 이유도 없다(preload 와 결합된 자리가 아니다).
 */
function absUrl(raw: string | null | undefined, origin: string): string | null {
  const v = String(raw || '').trim()
  if (!v || v.startsWith('data:')) return null
  if (/^https?:\/\//i.test(v)) return v
  return v.startsWith('/') ? `${origin}${v}` : null
}

interface SeedItem {
  id?: number | string
  name?: string | null
  image_url?: string | null
  price?: number | null
  current_price?: number | null
  original_price?: number | null
  category?: string | null
  deal_only?: number | string | null
  restaurant_name?: string | null
  avg_rating?: number | null
  review_count?: number | null
}

/** 시드 봉투 모양은 표면마다 다르다(`data` 가 배열 / `data.products`) — 둘 다 받는다. */
function seedItems(ssrPayload: string | null): SeedItem[] {
  if (!ssrPayload) return []
  try {
    const d = JSON.parse(ssrPayload) as { data?: SeedItem[] | { products?: SeedItem[] } }
    const raw = Array.isArray(d?.data) ? d.data : d?.data?.products
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

/**
 * 항목 하나 → `ListItem`. 색인 불가(교환권)·식별 불가(id·이름 없음)면 `null`.
 *
 * 상세 URL 은 **`canonicalDetailPath` SSOT** 로 만든다 — 목록이 `/group-buy/:id` 를 가리키던 시절처럼
 * 두 벌이 갈리면 같은 상품을 두 URL 로 제출하게 되고 그게 곧 중복 신호다.
 */
function listItem(p: SeedItem, position: number, origin: string): Record<string, unknown> | null {
  const id = p?.id
  const name = String(p?.name || '').trim()
  if (id == null || !name) return null
  // 🔴 교환권(`deal_only=1`)은 상세가 noindex 다 — 목록이 그 URL 을 항목으로 제출하지 않는다.
  if (Number(p.deal_only) === 1) return null
  const path = canonicalDetailPath({ id, deal_only: p.deal_only, category: p.category }) ?? `/products/${id}`
  const url = `${origin}${path}`
  const price = Number(p.current_price ?? p.price ?? 0)
  const item: Record<string, unknown> = { '@type': 'Product', name, url }
  // 🖼️ **절대 URL 이어야 한다.** 유어샵 핀의 사진은 `/api/media/...` 상대 경로로 오는 것이 섞여
  //    있고(라이브 실측), 상대 경로를 넣으면 구글이 그 `image` 를 통째로 버린다 — 에러는 안 난다.
  const img = absUrl(p.image_url, origin)
  if (img) item.image = img
  const brand = String(p.restaurant_name || '').trim()
  if (brand) item.brand = { '@type': 'Brand', name: brand }
  if (Number.isFinite(price) && price > 0) {
    item.offers = {
      '@type': 'Offer',
      url,
      priceCurrency: 'KRW',
      price,
      availability: 'https://schema.org/InStock',
    }
  }
  // ⭐ 리뷰가 **실제로 있을 때만**(2026-10-11 #1712 과 같은 규율 — 0건에 `ratingValue: 0` 은
  //    "평점 0점짜리 상품"이라고 말하는 것이고 구글 정책 위반이다).
  const rc = Number(p.review_count ?? 0)
  const rv = Number(p.avg_rating ?? 0)
  if (rc > 0 && rv > 0) {
    item.aggregateRating = { '@type': 'AggregateRating', ratingValue: rv, reviewCount: rc }
  }
  return { '@type': 'ListItem', position, url, item }
}

/** 지역 허브(`/region`)의 빵부스러기 라벨 — 표의 다른 `crumb` 과 같은 길이 감각(짧게). */
export const REGION_HUB_CRUMB = '지역'

/**
 * 빵부스러기 체인. 경로 조각을 접두부터 되짚어 표에 있는 것만 단계로 쌓는다
 * (`/terms/seller` → 유어딜 › 이용약관 › 판매자 약관). 손으로 체인을 적어 두면 표가 자라며 갈린다.
 *
 * 필터(`?category=`·`?brand=`)가 붙으면 마지막 단계를 하나 더 — sitemap 이 그 URL 들을 실제로
 * 제출하므로 목록 본체와 같은 빵부스러기를 내면 그 자체가 중복 신호가 된다.
 */
function crumbTrail(
  pathname: string,
  search: string,
  origin: string,
  regionRef?: RegionRef | null,
): Array<{ name: string; url: string }> {
  // 🍞 2026-10-14 — 루트는 `withCrumbRoot` 가 붙인다(상세 빌더 셋과 **같은 함수**). 종전엔 여기서
  //   손으로 붙여, 상세는 `홈` 목록은 `유어딜` 로 같은 URL 이 두 이름을 갖고 있었다.
  const trail: Array<{ name: string; url: string }> = []
  const segs = pathname.split('/').filter(Boolean)
  let acc = ''
  for (const s of segs) {
    acc += `/${s}`
    const crumb = CONSUMER_SURFACE_SEO[acc]?.crumb
    if (crumb) trail.push({ name: crumb, url: `${origin}${acc}` })
  }
  // 🗺️ 2026-10-12 — 지역 착지 페이지는 경로가 **동적**(`/region/서울/중구`)이라 위 표 조회가
  //   한 단계도 못 쌓고, 라이브에서 색인 대상 44개 전부가 `BreadcrumbList` **0건**이었다
  //   (`ItemList` 는 나오는데 빵부스러기만 없어서, 검색결과에 빵부스러기 대신 생 URL 이 뜬다).
  //   ⚠️ 표에 44행을 넣지 않는다 — 이미 해석해 둔 `regionRef` 에서 쌓는다(두 벌이면 갈린다).
  //   ⚠️ `/region` 은 **실재하는 허브 페이지**다(`resolveRegionSeo` 가 제 title·canonical 을 준다)
  //      → 중간 단계로 넣어도 없는 URL 을 가리키지 않는다(유어샵의 `/u` 와 다른 점).
  //   🔑 URL 은 `resolveRegionSeo` 의 canonical 과 **같은 조립**이어야 한다(정규화된 sido + 인코딩).
  //      어긋나면 빵부스러기가 canonical 아닌 URL 을 가리켜 서로 다른 신호를 보낸다.
  if (pathname === '/region' || regionRef) {
    trail.push({ name: REGION_HUB_CRUMB, url: `${origin}/region` })
  }
  if (regionRef) {
    // 🔗 2026-10-13: 조립은 `regionPath` **한 곳** — canonical·sitemap 과 같은 함수다.
    trail.push({ name: regionRef.sido, url: `${origin}${regionPath({ sido: regionRef.sido })}` })
    if (regionRef.sigungu) {
      trail.push({ name: regionRef.sigungu, url: `${origin}${regionPath(regionRef)}` })
    }
  }
  const entry = CONSUMER_SURFACE_SEO[pathname]
  // ⚠️ `trail` 에 루트가 더는 안 들어 있다 — 종전 `length > 1`(루트 말고 한 단계라도 쌓였나)과
  //   같은 뜻이 되도록 `length > 0` 으로. 숫자만 옮기면 조건의 의미가 뒤집힌다.
  if (entry?.canonicalParams?.length && trail.length > 0) {
    let params: URLSearchParams | null = null
    try { params = new URLSearchParams(search || '') } catch { params = null }
    const leaf = (params?.get('brand') || params?.get('category') || '').trim()
    if (leaf) {
      const key = params?.get('brand')?.trim() ? 'brand' : 'category'
      trail.push({ name: leaf, url: `${origin}${pathname}?${key}=${encodeURIComponent(leaf)}` })
    }
  }
  // 🏠 업종 견적 페이지(`/life/request/:key`) — 표에 없는 동적 경로라 마지막 단계(업종 이름)를 여기서 붙인다.
  const lifeLeaf = lifeCategoryCrumb(pathname)
  if (lifeLeaf) trail.push({ name: lifeLeaf, url: `${origin}${pathname}` })
  return withCrumbRoot(origin, trail)
}

/**
 * 🔗 `@id` 를 줘서 본문 노드(`CollectionPage`·`ProfilePage`)가 **참조**로 가리킨다.
 *   종전엔 같은 체인을 `@graph` 와 `breadcrumb` 양쪽에 **두 벌** 실었다(실측: 전 목록 표면).
 *   이 JSON 은 사람이 받는 응답에도 그대로 실리므로 두 벌은 바이트도 두 배다.
 *   참조 대상은 같은 `@graph` 안에 있어 **매달린 `@id` 가 생기지 않는다**(2026-10-11 E4 기준).
 */
function breadcrumbNode(trail: Array<{ name: string; url: string }>, canonical: string): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem', position: i + 1, name: t.name, item: t.url,
    })),
  }
}

/** 본문 노드가 쓸 참조. 체인과 **같은 `@id`** 를 가리켜야 한다(손으로 적으면 갈린다). */
function breadcrumbRef(canonical: string): Record<string, unknown> {
  return { '@id': `${canonical}#breadcrumb` }
}

/**
 * 경로에서 지역을 읽는다. `/region/서울/중구` → `{ sido: '서울', sigungu: '중구' }`.
 *
 * ⚠️ 워커가 받는 `pathname` 은 한글이 **퍼센트 인코딩**돼 올 수 있어 세그먼트를 디코딩한다
 *    (`decodeURIComponent` 는 깨진 입력에 throw 하므로 감싼다 — 지역 페이지 하나 때문에
 *    전 표면의 JSON-LD 가 날아가면 안 된다).
 * ⚠️ 실재하지 않는 지역명은 `parseRegionPath` 가 `null` 을 돌려준다 → 항목 0 → 빵부스러기만.
 *    지어낸 세그먼트(도어웨이)에 ItemList 를 달아 주지 않는다.
 */
function regionRefOf(path: string): RegionRef | null {
  if (!REGION_PATH_RE.test(path)) return null
  const seg = path.replace(/\/+$/, '').split('/')
  try {
    return parseRegionPath(decodeURIComponent(seg[2] || ''), seg[3] ? decodeURIComponent(seg[3]) : undefined)
  } catch {
    return null
  }
}

/**
 * 정적/목록 표면의 JSON-LD. 만들 게 없으면 `''`(호출부는 미주입 — fail-soft).
 *
 * @param ssrPayload 그 표면이 **이미 받아 둔** SSR 시드(없으면 빵부스러기만). 추가 요청 0 — 머리말 규율 1.
 */
export function buildSurfaceListJsonLd(
  pathname: string,
  search: string,
  origin: string,
  meta: { title: string; description: string; canonical: string; noindex?: boolean },
  ssrPayload: string | null
): string {
  // 🔴 noindex 표면(`/search`·`/gb-market`)엔 아무것도 안 낸다 — 색인하지 말라면서 리치결과를
  //    달라고 하는 셈이다.
  if (meta.noindex) return ''
  // 끝 슬래시를 떼어 `resolveConsumerSurfaceSeo` 와 **같은 키**로 본다 — 안 떼면 `/browse/` 가
  // 빵부스러기도 항목도 못 받는다(그 리졸버는 이미 떼고 찾는다).
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  // 지역 해석을 **빵부스러기보다 먼저** — 체인에 지역 단계를 쌓는 데 쓴다(아래 항목 필터와 같은 값).
  const regionRef = regionRefOf(path)
  const trail = crumbTrail(path, search, origin, regionRef)
  // 홈은 체인이 자기 하나뿐이다 — 한 단계 빵부스러기는 정보가 0 이라 내지 않는다.
  const nodes: Array<Record<string, unknown>> = trail.length > 1 ? [breadcrumbNode(trail, meta.canonical)] : []

  // 🎟️ 항목을 내는 표면은 **이 둘뿐**이다(허용목록). 나머지는 빵부스러기만 낸다.
  //   🩸 처음엔 "슬롯 허용목록 + `/vouchers` 경로 차단목록" **두 겹**으로 짰는데, 주입 러너가
  //      **둘 다 헛돈다**고 잡았다 — 한 겹을 없애도 다른 겹이 같은 결과를 내므로 어느 쪽도
  //      출력으로 판정할 수 없었다. 그리고 슬롯 겹은 애초에 지키는 게 없었다: 모양이 다른 시드
  //      (`DETAIL`·`BLOG`·`SECTIONS`)는 `listItem` 이 행마다 걸러서 **자연히 0건**이 된다.
  //      ⇒ 규칙을 **한 줄**로 모았다. `/vouchers`(교환권 목록)가 여기 없는 이유는 그 상세
  //      (`/vouchers/:id`)가 2026-07-07 결정으로 noindex 라서다(머리말 규율 2).
  //   🗺️ 2026-10-12 추가: **지역 착지 페이지**(`/region/서울`·`/region/서울/중구`). 그 44개가
  //      "동네 맛집 할인권" 질의의 착지점인데 라이브에서 항목 **0건**이었다. 항목은 홈과 **같은
  //      시드**(MAIN — 같은 캐시 키라 추가 요청 0)에서 뽑고, 지역 필터는 화면과 **같은 SSOT**
  //      (`addressInRegion`)로 건다. 손으로 주소를 파싱하면 화면과 갈려 다른 가게가 섞인다.
  // 🏨 2026-10-12: `/stays` 추가 — 숙소 상세(`/stays/:id`)는 색인 대상이고(`canonicalDetailPath`)
  //   그 표면이 **항목 0건**이었다. 교환권 목록(`/vouchers`)은 여전히 **제외** — 그 상세가
  //   2026-07-07 결정으로 noindex 라, 색인하지 말라고 한 URL 을 "이 목록의 항목" 으로 제출하면
  //   서로 반대되는 신호가 된다(허용목록 한 줄로 그 규율을 지킨다).
  // 🗺️ 2026-10-14: `/map` 추가 — 이 표면은 **이미 그 항목들을 크롤러 본문에서 링크하고 있었다**
  //   (라이브 실측: `<a href="/pass/…">` **8건**) 그런데 `ItemList` 는 **0건**이었다. 즉 "이 목록의
  //   항목" 이라는 구조화 신호만 빠져 있었고, 형제 `/stays`(2026-10-12 추가)와 **같은 클래스의
  //   누락**이다(허용목록에 아무도 넣지 않았을 뿐 — 위 주석들이 `/map` 을 한 번도 언급하지 않는다).
  //   필터는 필요 없다 — `/map` 은 동네딜 전부를 보여 주는 표면이고(이용권·숙소 둘 다 정당한 항목),
  //   교환권은 `listItem` 이 행마다 걸러 낸다(머리말 규율 2).
  const ITEM_PATHS = new Set(['/', '/browse', '/stays', '/map'])
  // 🔑 `/stays` 는 자기 슬롯이 없어 **홈과 같은 시드**를 받는다 — 숙소만 골라야 한다.
  //   안 걸러내면 식당 이용권이 "숙소 목록의 항목" 으로 제출된다(빌드도 화면도 안 깨진다).
  const keepItem = (p: SeedItem): boolean => {
    if (regionRef) {
      return addressInRegion(
        (p as { restaurant_address?: string | null; business_address?: string | null }).restaurant_address
        || (p as { business_address?: string | null }).business_address,
        regionRef,
      )
    }
    if (path === '/stays') return (p as { category?: string | null }).category === 'stay_voucher'
    return true
  }
  const items = ITEM_PATHS.has(path) || regionRef
    ? seedItems(ssrPayload)
        .filter(keepItem)
        .slice(0, SURFACE_LIST_MAX * 2)
        .map((p, i) => listItem(p, i + 1, origin))
        .filter((x): x is Record<string, unknown> => x !== null)
        .slice(0, SURFACE_LIST_MAX)
        // 교환권을 걸러내 position 에 구멍이 생기므로 다시 매긴다(1..N 연속이어야 한다).
        .map((x, i) => ({ ...x, position: i + 1 }))
    : []

  // 🧭 2026-10-12 (대표 *"AI 검색에서도 노출이 될 수 있게"*): `/faq` 에 **`FAQPage`** 를 더한다.
  //   **왜 이 자리인가**: 답변 14개는 `shared/seo/concept-content.ts` 에 이미 있고 화면이 그걸
  //   그린다. 그런데 `FAQPage.tsx` 가 만드는 JSON-LD 는 **react-helmet 경유**라, JS 를 안 돌리는
  //   크롤러는 라이브에서 **0건**을 받았다(2026-10-12 Googlebot 실측). 언어모델이 그대로 인용할
  //   수 있는 형태는 Q&A 인데 그게 서버 HTML 에 없었다.
  //   🔑 **화면과 같은 배열을 쓴다** — 손으로 베끼면 내용-스키마 불일치가 되고 구글은 그걸 정책
  //      위반으로 본다. 둘이 갈릴 수 없게 SSOT 한 곳에서만 읽는다.
  //   ⚠️ 허용목록 **한 줄**이다(`/faq` 하나). 다른 표면에 FAQPage 를 내면 그 페이지에 없는 Q&A 를
  //      선언하는 셈이라 역효과다.
  if (path === '/faq') {
    nodes.push({
      '@type': 'FAQPage',
      '@id': `${meta.canonical}#faq`,
      mainEntity: CONCEPT_FAQ.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    })
  }

  nodes.push(...lifeJsonLdNodes(path, origin, meta.canonical)) // 🏠 생활 서비스: 허브=업종 목록 · 업종=Service(대상 사업자)
  nodes.push(...landingJsonLdNodes(path, origin, meta.canonical)) // ❓ 입점·소개 랜딩: FAQPage(화면과 같은 배열) + 입점 Service(2026-10-31)
  nodes.push({
    '@type': items.length ? 'CollectionPage' : 'WebPage',
    '@id': meta.canonical,
    url: meta.canonical,
    name: meta.title,
    description: meta.description,
    inLanguage: 'ko',
    isPartOf: { '@id': `${origin}/#website` },
    ...(trail.length > 1 ? { breadcrumb: breadcrumbRef(meta.canonical) } : {}),
    ...(items.length
      ? { mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items } }
      : {}),
  })

  return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }))
}

/**
 * 유어샵 핀 — `curator-ssr-body.ts` 의 `CuratorSeedPin` 과 같은 모양.
 * ⚠️ `deal_only` 를 `number | null` 로 **좁게** 둔다 — `curatorHomePins`(순서 SSOT)의
 *    `CuratorPinOrderFields` 가 그 타입이고, 넓히면 그 함수에 넘길 수 없다(tsc 가 잡는다).
 */
interface CuratorPin extends Omit<SeedItem, 'deal_only'> {
  product_id?: number
  product_name?: string | null
  thumbnail?: string | null
  deal_only?: number | null
  deal_pct?: number | null
}

/**
 * 🛍️ 유어샵(`/u/:handle` — CURATOR 슬롯)의 구조화 데이터.
 *
 * 이 표면은 `CONSUMER_SURFACE_SEO` 표에 없다(핸들이 경로에 있는 동적 표면) — 그래서 호출부
 * CURATOR 블록이 메타를 직접 만들고, 여기서 그 메타에 맞는 JSON-LD 를 만든다.
 *
 * 🔢 **진열 순서는 `curatorHomePins` SSOT 를 쓴다** — 워커 첫 화면이 그리는 순서와 같아야 한다.
 * 손으로 두 번 정렬하면 갈리고, 갈리면 **에러가 아니라 거짓말**이 된다(순번은 SNS 에서
 * *"N번 이용권"* 으로 부르는 주소다 — `curator-pin-order.ts` 머리말).
 *
 * 빵부스러기는 **두 단계**(유어딜 › 이름)다. `유어샵` 을 중간 단계로 넣으면 `/u` 라는
 * **없는 URL** 을 가리키게 된다.
 */
export function buildCuratorJsonLd(
  ssrPayload: string,
  origin: string,
  meta: { title: string; description: string; canonical: string },
  curator: { name?: string; handle?: string; profile_image?: string | null }
): string {
  try {
    const pins = (JSON.parse(ssrPayload) as { pins?: CuratorPin[] })?.pins
    const name = String(curator?.name || '').trim() || `@${String(curator?.handle || '').trim()}`
    const items = (Array.isArray(pins) ? curatorHomePins(pins) : [])
      .map(p => ({ ...p, id: p.id ?? p.product_id, name: p.name ?? p.product_name, image_url: p.image_url ?? p.thumbnail }))
      .slice(0, SURFACE_LIST_MAX * 2)
      .map((p, i) => listItem(p, i + 1, origin))
      .filter((x): x is Record<string, unknown> => x !== null)
      .slice(0, SURFACE_LIST_MAX)
      .map((x, i) => ({ ...x, position: i + 1 }))
    // 🍞 유어샵은 **두 단계**다 — `유어샵` 을 중간에 넣으면 `/u` 라는 없는 URL 을 가리킨다(2026-10-11).
    const trail = withCrumbRoot(origin, [{ name, url: meta.canonical }])
    const person: Record<string, unknown> = { '@type': 'Person', name, url: meta.canonical }
    if (curator?.handle) person.identifier = String(curator.handle)
    if (curator?.profile_image) person.image = String(curator.profile_image)
    const nodes: Array<Record<string, unknown>> = [
      breadcrumbNode(trail, meta.canonical),
      {
        '@type': 'ProfilePage',
        '@id': meta.canonical,
        url: meta.canonical,
        name: meta.title,
        description: meta.description,
        inLanguage: 'ko',
        isPartOf: { '@id': `${origin}/#website` },
        breadcrumb: breadcrumbRef(meta.canonical),
        mainEntity: person,
      },
    ]
    if (items.length) {
      nodes.push({
        '@type': 'ItemList',
        name: `${name} 유어샵 진열`,
        numberOfItems: items.length,
        itemListElement: items,
      })
    }
    return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }))
  } catch {
    return ''
  }
}

/**
 * 🏪 **가게 유어샵**(`/s/:username` — SELLER 슬롯)의 구조화 데이터 (2026-10-14).
 *
 * ## 실측 — 형제는 내는데 이 표면만 0건이었다
 * Googlebot UA 로 받아 `ld+json` 블록을 세니:
 *
 *     /u/jiwon1228            블록 2 → [Organization, WebSite] + [BreadcrumbList, ProfilePage, ItemList]
 *     /s/store_muxlddtf74b    블록 1 → [Organization, WebSite]  ← **페이지 노드가 없다**
 *     /s/store_mt9rvbhg1i6    블록 1 → 같음
 *
 * 즉 가게 유어샵은 **빵부스러기도 진열 목록도 페이지 종류도** 없이 사이트 전역 브랜드 노드만
 * 받고 있었다. `seller-noscript.ts` 머리말이 *"이 파일이 안 하는 것: 메타·OG·JSON-LD"* 로
 * 적어 둔 바로 그 구멍이다(그 PR 은 본문만 채웠다).
 *
 * 🔴 **2건이라서 작은 문제가 아니다.** `/s/:username` 은 2026-10-14 기록대로 **앞으로 등록되는
 * 모든 매장의 유어샵 URL** 이다(`/store/new` 가 `linked_user_id` 를 비우므로 sitemap 이 `/u/` 가
 * 아니라 `/s/` 로 갈린다). 지금 2건인 것은 매장이 2곳이라서일 뿐이다.
 *
 * ## 모양 — `/u/:handle` 과 **같은 틀**이고 주인만 다르다
 * `ProfilePage.mainEntity` 가 개인 유어샵은 `Person`, 가게 유어샵은 **`Organization`** 이다.
 * 가게를 `Person` 이라고 말하면 구글이 엔티티를 사람으로 적재한다(아래 ⚠️ 참조).
 *
 * ## 규율 (형제 빌더와 같다)
 * - **지어내지 않는다** — 넣는 값은 전부 그 페이로드다. 없는 필드는 **키 자체를 안 만든다**
 *   (`sameAs`·`image` 는 실제 값이 있을 때만). 라이브 실측상 이 가게들은 `bio`·`profile_image`·
 *   SNS·`website_url` 이 전부 `null` 이라 지금은 이름·진열만 나간다.
 * - **추가 요청 0** — 진열은 그 표면이 이미 받아 둔 `__SSR_INITIAL_SELLER__` 시드의 `products` 다.
 * - **빵부스러기는 두 단계**(유어딜 › 가게명). `유어샵` 을 중간에 넣으면 `/s` 라는 **없는 URL** 을
 *   가리킨다(`buildCuratorJsonLd` 가 `/u` 로 같은 함정을 적어 뒀다).
 * - **정본은 `meta.canonical`** 이다 — `buildSellerSurfaceMeta` 가 `canonicalShopPath` SSOT 로 고른
 *   그 값이고, `/profile/:username` 별칭으로 들어와도 같은 하나를 가리킨다(2026-10-14 #74).
 * - **행 조립을 다시 쓰지 않는다** — `listItem`(목록·지역·유어샵이 쓰는 것)을 그대로 쓴다.
 *   그래서 항목 URL(`canonicalDetailPath` SSOT) · 교환권 제외 · 상한이 **자동으로 같다**.
 *
 * ## ⚠️ 이 빌더가 **안 하는 것** (그리고 안 하는 이유)
 * - **주소·전화**: 이 페이로드의 `business_address` 는 라이브에서 `null` 이고 애초에 담겨 오지 않는다.
 *   같은 가게의 주소는 상세(`/pass/:id`)가 `FoodEstablishment` 로 이미 내고 있다 — 없는 값을
 *   채우려고 다른 모듈을 끌어오지 않는다(지어내기 금지).
 * - **클라(`SellerPublicPage.tsx`)의 `Person` 노드**: 그 화면은 자기 `<SEO jsonLd>` 로
 *   `@type: 'Person'` 을 내는데 ① 가게는 사람이 아니고 ② `url` 이 **비정본** `/profile/:username`
 *   이다. 둘 다 결함이지만 그 파일은 **로딩 잠금표**라 문자열 한 줄도 대표 승인이 필요하다 ⇒
 *   인계에 대기 항목으로 올렸다. 🔑 **크롤러에는 그 노드가 도달하지 않는다**(봇 UA 는 스크립트
 *   없는 문서를 받아 React 가 돌지 않는다 — 2026-10-14 실측) ⇒ 지금 손해는 GEO 쪽뿐이다.
 *   그리고 종류가 겹치지 않아 2026-10-14 의 중복 제거(`shared/seo/jsonld-dedupe`)도 안 지운다.
 */
export function buildSellerShopJsonLd(
  ssrPayload: string,
  origin: string,
  meta: { title: string; description: string; canonical: string }
): string {
  try {
    const sp = (JSON.parse(ssrPayload) as {
      data?: {
        name?: string | null
        business_name?: string | null
        profile_image?: string | null
        website_url?: string | null
        sns_instagram?: string | null
        sns_youtube?: string | null
        sns_facebook?: string | null
        sns_twitter?: string | null
        products?: SeedItem[] | null
      }
    })?.data
    const name = String(sp?.name || sp?.business_name || '').trim()
    if (!name) return ''

    const items = (Array.isArray(sp?.products) ? sp!.products! : [])
      .map((p, i) => listItem(p, i + 1, origin))
      .filter((x): x is Record<string, unknown> => x !== null)
      .slice(0, SURFACE_LIST_MAX)
      .map((x, i) => ({ ...x, position: i + 1 }))

    // 🔗 `sameAs` 는 엔티티 결합(검색엔진이 "이 가게가 그 인스타 계정" 임을 아는 것)의 유일한 수단이다.
    //    🔴 **없는 계정을 가리키지 않는다** — 값이 없으면 키를 안 만든다(빈 배열도 안 낸다).
    const sameAs = [sp?.website_url, sp?.sns_instagram, sp?.sns_youtube, sp?.sns_facebook, sp?.sns_twitter]
      .map(v => String(v || '').trim())
      .filter(v => /^https?:\/\//.test(v))

    const org: Record<string, unknown> = { '@type': 'Organization', name, url: meta.canonical }
    if (sp?.profile_image) org.image = String(sp.profile_image)
    if (sameAs.length) org.sameAs = sameAs

    const trail = withCrumbRoot(origin, [{ name, url: meta.canonical }])
    const nodes: Array<Record<string, unknown>> = [
      breadcrumbNode(trail, meta.canonical),
      {
        '@type': 'ProfilePage',
        '@id': meta.canonical,
        url: meta.canonical,
        name: meta.title,
        description: meta.description,
        inLanguage: 'ko',
        isPartOf: { '@id': `${origin}/#website` },
        breadcrumb: breadcrumbRef(meta.canonical),
        mainEntity: org,
      },
    ]
    if (items.length) {
      nodes.push({
        '@type': 'ItemList',
        name: `${name} 유어샵 진열`,
        numberOfItems: items.length,
        itemListElement: items,
      })
    }
    return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }))
  } catch {
    return ''
  }
}
