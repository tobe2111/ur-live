/**
 * 🔎 2026-07-29 (대표 "소비자 쪽 성능·SEO·UX 점검"): 정적 표면 · 셀러 링크샵의 서버 메타 빌더 + 배선.
 *
 * `detail-ssr-meta.ts` 와 같은 이유로 분리한다 — `worker/index.ts` 의 HTMLRewriter 배선은 **결과값만**
 * 소비하고, 계산과 반복되는 `.on()` 체인은 여기 둔다(god 파일 래칫 준수).
 *
 * ## 왜 필요했나 (라이브 실측)
 * 서버 메타 rewrite 가 **상세 슬롯에만** 있었다(DETAIL·PRODUCT·BLOGPOST·CURATOR·WHOLESALE).
 * 그래서:
 *   - `/`·`/vouchers`·`/browse` → title/description 3개가 동일한 홈 메타, `og:url` 전부 `https://urdeal.kr`,
 *     canonical 없음. 그런데 sitemap 은 뒤 둘을 priority 0.9 로 제출한다 → 크롤러엔 홈의 중복 3장.
 *   - `/s/:username` → 같은 링크샵인데 `/u/:handle`(CURATOR)만 개인화되고 이쪽은 "유어딜 홈" 메타.
 * 클라 `<SEO>`(react-helmet)는 JS 렌더 후라 네이버 Yeti 가 못 본다 — `SEO.tsx` 의 2026-07-28 주석이
 * 같은 사실을 실측으로 기록해 뒀다(정적 토큰만 실효였다).
 */
import { escapeAttr } from '../../shared/seo/consumer-surfaces'

export interface SurfaceRewriteMeta {
  /** `<title>` 값 */
  pageTitle: string
  /** og/twitter title */
  title: string
  description: string
  canonical: string
  /** 지정 시 og:type 도 교체(링크샵 = 'profile'). 없으면 기존 값 유지. */
  ogType?: string
  /** 지정 시 og:image / twitter:image 교체. 없으면 사이트 기본 OG 카드 유지. */
  ogImage?: string
  /** 이스케이프 완료된 JSON-LD 문자열. 빈 문자열이면 미주입. */
  jsonLd?: string
  /** true 면 robots 를 noindex 로 교체(교환권 상세 등 — 클라 `<SEO noindex>` 와 대칭). */
  noindex?: boolean
}

/** HTMLRewriter 를 직접 타입 의존하지 않기 위한 구조적 타입(워커 런타임 타입 없이도 빌드/테스트 가능). */
interface ElementLike {
  setInnerContent(content: string, options?: { html: boolean }): unknown
  setAttribute(name: string, value: string): unknown
  append(content: string, options: { html: boolean }): unknown
}
interface HandlerLike {
  element(el: ElementLike): void
}
interface RewriterLike<T> {
  on(selector: string, handlers: HandlerLike): T
}

/**
 * title/description/OG/twitter/canonical 을 한 번에 배선. 상세 빌더들의 `.on()` 체인과 같은 순서·같은 셀렉터.
 * `ogImage` 를 안 주면 사이트 기본 OG 카드를 그대로 둔다 — 목록/정적 표면은 그게 맞다.
 */
export function applySurfaceMeta<T extends RewriterLike<T>>(rb: T, meta: SurfaceRewriteMeta): T {
  let out = rb
    .on('title', { element(el) { el.setInnerContent(meta.pageTitle) } })
    .on('meta[name="description"]', { element(el) { el.setAttribute('content', meta.description) } })
    .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', meta.title) } })
    .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', meta.description) } })
    .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', meta.canonical) } })
    .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', meta.title) } })
    .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', meta.description) } })
  if (meta.ogType) {
    const t = meta.ogType
    out = out.on('meta[property="og:type"]', { element(el) { el.setAttribute('content', t) } })
  }
  if (meta.ogImage) {
    const img = meta.ogImage
    out = out
      .on('meta[property="og:image"]', { element(el) { el.setAttribute('content', img) } })
      .on('meta[name="twitter:image"]', { element(el) { el.setAttribute('content', img) } })
  }
  if (meta.noindex) {
    out = out.on('meta[name="robots"]', { element(el) { el.setAttribute('content', 'noindex, follow') } })
  }
  const href = escapeAttr(meta.canonical)
  const ld = meta.jsonLd
  return out.on('head', {
    element(el) {
      el.append(`<link rel="canonical" href="${href}">`, { html: true })
      if (ld) el.append(`<script type="application/ld+json">${ld}</script>`, { html: true })
    },
  })
}

interface SellerPublicPayload {
  data?: {
    name?: string
    business_name?: string
    bio?: string | null
    username?: string
  }
}

/**
 * 셀러 링크샵(`/s/:username`·`/profile/:username` — SELLER slot) 메타.
 * 페이로드(`/api/sellers/:id/public`)의 표시 이름·소개만 사용 — CURATOR 블록과 같은 최소 의존.
 * 이름을 못 구하면 `null`(기본 메타 유지) — 빈 제목으로 덮어써 더 나쁘게 만들지 않는다.
 */
export function buildSellerSurfaceMeta(
  ssrPayload: string,
  origin: string,
  pathname: string
): SurfaceRewriteMeta | null {
  let sp: SellerPublicPayload['data']
  try {
    sp = (JSON.parse(ssrPayload) as SellerPublicPayload)?.data
  } catch {
    return null
  }
  const shopName = String(sp?.name || sp?.business_name || '').trim()
  if (!shopName) return null
  const title = `${shopName} 링크샵 - 유어딜`
  const description =
    String(sp?.bio || '').trim().slice(0, 200) ||
    `${shopName}의 이용권·상품을 유어딜 링크샵에서 만나보세요.`
  return {
    pageTitle: title,
    title,
    description,
    canonical: `${origin}${pathname}`,
    ogType: 'profile',
  }
}

/**
 * 🪦 개별 엔티티를 렌더하는 SSR 슬롯 — 이들만 "대상이 없으면 noindex" 대상이다.
 *   목록 슬롯(MAIN/VOUCHERS/BROWSE/BLOG)은 API 가 404 여도 페이지 자체는 유효하므로 제외.
 */
const ENTITY_SLOTS = new Set(['DETAIL', 'PRODUCT', 'STAYDETAIL', 'SELLER', 'CURATOR', 'BLOGPOST'])

/**
 * 사라진 상세 페이지를 색인에서 빼야 하는가.
 *
 * 실측: `/group-buy/99999999` 가 **200 + 제네릭 홈 메타 + `robots: index, follow`** 로 나갔다.
 * 워커의 SSR self-fetch 는 그 순간 404 를 받고 있었는데(`X-SSR-Status: DETAIL:self-fetch-404`) 쓰지 않았다.
 * sitemap 이 상세 URL 829건(공구 329·상품 500)을 제출하고 상품은 내려가므로, 내려갈 때마다
 * "홈과 똑같은 색인 가능한 URL" 이 하나씩 생기는 구조였다.
 *
 * ⚠️ **타임아웃은 포함하지 않는다** — `self-fetch-timeout` 은 "없다" 가 아니라 "느리다" 이고,
 *    콜드 콜로에서 흔하다. 그걸로 noindex 를 내면 멀쩡한 상품이 색인에서 빠진다(더 큰 사고).
 */
export function shouldNoindexMissingEntity(slot: string, ssrStatus: string): boolean {
  return ENTITY_SLOTS.has(slot) && ssrStatus === 'self-fetch-404'
}
