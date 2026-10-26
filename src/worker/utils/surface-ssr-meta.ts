/**
 * 🔎 2026-07-29 (대표 "소비자 쪽 성능·SEO·UX 점검"): 정적 표면 · 셀러 유어샵의 서버 메타 빌더 + 배선.
 *
 * `detail-ssr-meta.ts` 와 같은 이유로 분리한다 — `worker/index.ts` 의 HTMLRewriter 배선은 **결과값만**
 * 소비하고, 계산과 반복되는 `.on()` 체인은 여기 둔다(god 파일 래칫 준수).
 *
 * ## 왜 필요했나 (라이브 실측)
 * 서버 메타 rewrite 가 **상세 슬롯에만** 있었다(DETAIL·PRODUCT·BLOGPOST·CURATOR·WHOLESALE).
 * 그래서:
 *   - `/`·`/vouchers`·`/browse` → title/description 3개가 동일한 홈 메타, `og:url` 전부 `https://urdeal.kr`,
 *     canonical 없음. 그런데 sitemap 은 뒤 둘을 priority 0.9 로 제출한다 → 크롤러엔 홈의 중복 3장.
 *   - `/s/:username` → 같은 유어샵인데 `/u/:handle`(CURATOR)만 개인화되고 이쪽은 "유어딜 홈" 메타.
 * 클라 `<SEO>`(react-helmet)는 JS 렌더 후라 네이버 Yeti 가 못 본다 — `SEO.tsx` 의 2026-07-28 주석이
 * 같은 사실을 실측으로 기록해 뒀다(정적 토큰만 실효였다).
 */
import { escapeAttr, withSiteName, CONSUMER_SITE_NAME, type ResolvedSurfaceSeo } from '../../shared/seo/consumer-surfaces'
import { canonicalShopPath } from '../../shared/seo/shop-canonical'
// 🗺️ 워커 전용 — 이 표를 크리티컬 패스(consumer-surfaces)에서 끌어오면 app-constants 청크가 첫 페인트로 딸려온다.
import { normalizeSido, regionPath } from '../../shared/constants/region-slugs'
import { ROBOTS_NOINDEX } from '../../shared/seo/robots-directives'
import { isHubCanonical, NOIMAGEINDEX_META } from '../../shared/seo/image-hub'

/** 시군구 형태 — '중구'·'파주시'·'양양군'. 접두부 1글자 허용(중구·동구·남구가 탈락하지 않게). */
const SIGUNGU_RE = /^[가-힣]{1,10}(시|군|구)$/

export interface SurfaceRewriteMeta {
  /** `<title>` 값 */
  pageTitle: string
  /** og/twitter title */
  title: string
  description: string
  canonical: string
  /** 지정 시 og:type 도 교체(유어샵 = 'profile'). 없으면 기존 값 유지. */
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
  /** 🔗 `applyCanonical` 이 기존 canonical 태그를 걷어내는 데 쓴다(중복 차단). */
  remove(): unknown
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
    out = out.on('meta[name="robots"]', { element(el) { el.setAttribute('content', ROBOTS_NOINDEX) } })
  }
  const ld = meta.jsonLd
  let withCanon = applyCanonical(out, meta.canonical)
  // 🖼️ 2026-10-24 허브 표면은 사진만 이미지 색인에서 뺀다 — 출처가 상세로 잡히게(`shared/seo/image-hub.ts`).
  if (isHubCanonical(meta.canonical)) {
    withCanon = withCanon.on('head', { element(el) { el.append(NOIMAGEINDEX_META, { html: true }) } })
  }
  if (ld) {
    withCanon = withCanon.on('head', {
      element(el) { el.append(`<script type="application/ld+json">${ld}</script>`, { html: true }) },
    })
  }
  return withCanon
}

/**
 * 🔗 canonical 을 **정확히 하나** 만든다 (2026-10-12 — 대표 "응 모두 해줘").
 *
 * ## 왜 필요했나 (라이브 실측, Googlebot UA)
 * 서빙 문서의 canonical 이 **전 표면에서 2개**였다 — 홈·`/blog`·`/vouchers`·`/browse`·`/u/:handle` 전부.
 * 검색봇은 `app.get('*')` 의 **봇 셸**을 받는데 그 템플릿이 자기 canonical(`${origin}${pathname}`)을
 * 이미 갖고 있고, 메타 빌더들은 `<head>` 에 하나를 **더 붙이기만** 했다(`el.append`).
 *
 * 🩸 지금까지는 **두 값이 같아서 무해**했다. 그런데 `/pass/:id`(숙소)가 정본을 `/stays/:id` 로 옮긴
 * 순간 `/pass/2887` 이 `[/pass/2887, /stays/2887]` 을 함께 내보냈다 — **모순되는 canonical 을 받으면
 * 구글은 둘 다 무시하고 자기가 고른다.** 즉 정본 단일화가 **전달되지 않았다**(에러 0 · 배포 성공).
 *
 * ## 왜 append 를 그냥 교체로 바꾸면 안 되나
 * 두 셸의 조건이 **다르다**: 봇 셸엔 canonical 이 **있고** `index.html` 엔 **없다**. 그래서
 *   - 교체만 하면 → 사람이 받는 문서에 canonical 이 **안 생긴다**(실측상 `index.html` 에 그 태그가 없다)
 *   - 붙이기만 하면 → 봇이 받는 문서에 **2개**가 된다 (지금의 결함)
 * ⇒ **지우고 하나를 붙인다.** 두 경로에서 모두 정확히 1개가 되고, `onEndTag` 같은 조건부 장치가 필요 없다.
 *
 * 🔴 **`setAttribute` 로 제자리 교체하는 자리도 이 함수로 모은다** — 몰 분기(`worker/index.ts`)가 그
 * 방식이었는데, 그건 "태그가 이미 있다" 는 전제이고 **사람 경로에선 그 전제가 거짓**이라 몰 페이지는
 * canonical 을 아예 못 받고 있었다(같은 결함의 반대 얼굴).
 */
export function applyCanonical<T extends RewriterLike<T>>(rb: T, canonical: string): T {
  const href = escapeAttr(canonical)
  return rb
    .on('link[rel="canonical"]', { element(el) { el.remove() } })
    .on('head', {
      element(el) { el.append(`<link rel="canonical" href="${href}">`, { html: true }) },
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
 * 셀러 유어샵(`/s/:username`·`/profile/:username` — SELLER slot) 메타.
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
  const title = `${shopName} 유어샵 - 유어딜`
  const description =
    String(sp?.bio || '').trim().slice(0, 200) ||
    `${shopName}의 이용권·상품을 유어딜 유어샵에서 만나보세요.`
  // 🏪 2026-10-14 — `/s/{username}` 과 `/profile/{username}` 은 **같은 컴포넌트를 렌더하는 두 별칭**
  //   인데 각자 자기자신을 정본이라 말하고 있었다(라이브 실측: 둘 다 200 · 같은 제목). sitemap 이
  //   쓰는 **같은 함수**로 정본을 고른다 — 조립처가 둘이면 제출한 URL 이 다른 URL 을 정본이라
  //   말하는 모순이 조용히 생긴다. 셋 다 없으면 `null` → 자기 경로(정본을 지어내지 않는다).
  const shopPath = canonicalShopPath(
    (sp as { curator_handle?: string | null } | undefined)?.curator_handle,
    (sp as { username?: string | null } | undefined)?.username,
    (sp as { id?: number | string | null } | undefined)?.id,
  )
  return {
    pageTitle: title,
    title,
    description,
    canonical: `${origin}${shopPath ?? pathname}`,
    ogType: 'profile',
  }
}

/**
 * 🪦 개별 엔티티를 렌더하는 SSR 슬롯 — 이들만 "대상이 없으면 noindex" 대상이다.
 *   목록 슬롯(MAIN/VOUCHERS/BROWSE/BLOG)은 API 가 404 여도 페이지 자체는 유효하므로 제외.
 */
const ENTITY_SLOTS = new Set([
  'DETAIL', 'PRODUCT', 'STAYDETAIL', 'SELLER', 'CURATOR', 'BLOGPOST', 'MALL',
  // 🔗 2026-10-25 생활 요청 공유(`/life/q/:token`) — 없는 토큰은 404 + noindex(추측 주소가 색인되지 않게).
  'LIFESHARE',
  // 🏠 2026-10-26 생활 업체 소개(`/life/biz/:id`) — 없는·내려간 업체는 404 + noindex.
  'LIFEBIZ',
  // 🩸 2026-10-14 — **형제 하나가 빠져 있었다.** 2026-10-12 에 `MALL` 을 넣으면서 `MALLPRODUCT`
  //   (`/{슬러그}/p/{id}` — 소개비 귀속 경로)를 놓쳤고, 그 경로가 **아무 슬러그·아무 id** 로
  //   무한 thin URL 이 됐다. 라이브 실측(Googlebot UA):
  //
  //       /zzqqxx/p/2887     200 · index,follow · canonical 자기자신 · 본문 32자
  //                          x-ssr-status: MALLPRODUCT:self-fetch-404   ← 404 를 받고도 200 을 냈다
  //       /zzqqxx/p/999999   같음
  //       (대조) /zzqqxx     404 · noindex                              ← 1세그먼트는 멀쩡했다
  //
  //   `/group-buy/99999999`(2026-07-29)과 **글자 그대로 같은 모양**이다 — 워커가 그 순간 404 를
  //   받아 놓고 쓰지 않는 것. 그때 만든 기계가 이 슬롯만 비켜 갔다.
  'MALLPRODUCT',
])

/**
 * 사라진 상세 페이지를 색인에서 빼야 하는가.
 *
 * 실측: `/group-buy/99999999`(당시 주소) 가 **200 + 제네릭 홈 메타 + `robots: index, follow`** 로 나갔다.
 * 워커의 SSR self-fetch 는 그 순간 404 를 받고 있었는데(`X-SSR-Status: DETAIL:self-fetch-404`) 쓰지 않았다.
 * sitemap 이 상세 URL 829건(공구 329·상품 500)을 제출하고 상품은 내려가므로, 내려갈 때마다
 * "홈과 똑같은 색인 가능한 URL" 이 하나씩 생기는 구조였다.
 *
 * ⚠️ **타임아웃은 포함하지 않는다** — `self-fetch-timeout` 은 "없다" 가 아니라 "느리다" 이고,
 *    콜드 콜로에서 흔하다. 그걸로 noindex 를 내면 멀쩡한 상품이 색인에서 빠진다(더 큰 사고).
 *
 * 🔴 **400 도 포함하지 않는다.** 2026-10-12 에 "숫자 아닌 id 가 다섯 슬롯 전부 `200 + index, follow`"
 *    를 실측하고 여기에 `self-fetch-400` 을 더하려 했는데, **그 행동이 이미 결함으로 심어져 있었다**
 *    (`scripts/mutations/ushop-malformed-handle-404.mjs`): *"API 를 고치는 대신 술어를 넓히는 것이 더
 *    쉬워 보인다 — 그 길은 일시적 400 을 영구 noindex 로 바꾼다."* 그 판단이 맞다. 400 은 *"요청이
 *    틀렸다"* 이고 부재가 아니다 — 쿼리·헤더 탓인 400 을 부재로 읽으면 살아 있는 엔티티가 색인에서
 *    빠진다. ⇒ 고칠 곳은 **API** 다: 경로 세그먼트로 식별되는 리소스가 애초에 존재할 수 없으면
 *    그 핸들러가 **404** 를 줘야 한다(`/u/:handle` 을 2026-10-12 에 그렇게 고쳤다 — 같은 선례).
 *    ⚠️ 그래도 **쓰기 검증·가용성 조회의 400 은 400 그대로다** — 일관성을 이유로 한쪽으로 몰면
 *    "저장 실패" 를 "없음" 이라 말하게 된다(같은 매니페스트의 두 번째·세 번째 주입이 그걸 막는다).
 */
export function shouldNoindexMissingEntity(slot: string, ssrStatus: string): boolean {
  return ENTITY_SLOTS.has(slot) && ssrStatus === 'self-fetch-404'
}

/**
 * 🧨 2026-10-12 **철거된 서비스의 표면** — 서비스 자체가 사라졌으므로 `410 Gone`.
 *
 * 배경(대표 *"SEO 측면에서 어떻게 해야하는지 알려줘"* → *"모두 해줘"*): 2026-10-11 도매몰 철거
 * (#1710)가 화면·라우트·마운트는 전부 지웠는데 **크롤러가 보는 쪽은 그대로 남아 있었다.**
 * Googlebot UA 로 실측한 네 URL 이 전부 이 모양이었다:
 *
 *     /wholesale · /wholesale/intro · /wholesale/join · /wholesale/oem
 *       → HTTP 200 · robots `index, follow` · canonical 2개 · 본문 **0자**
 *       → <title>유통스타트 도매몰 — 제조사 직거래 B2B 도매사이트</title>
 *
 * 그리고 `public/robots.txt` 가 그 넷을 **"공개 인덱스 대상"** 이라고 명시 허용하고 있었다.
 * 즉 구글이 정의한 교과서적 **soft 404**(있다고 말하면서 아무것도 없는 페이지)를, 우리가 직접
 * 초대해서 만들고 있었다. 색인되든 안 되든 크롤되는 순간 사이트 품질 신호가 깎인다.
 *
 * 🔴 **왜 404 가 아니라 410 인가**: 엔티티가 없어진 것(`shouldNoindexMissingEntity` — 상품 하나가
 *    내려간 것)과 **서비스가 없어진 것**은 다르다. 상품은 다시 올라올 수 있어 404("지금 없다")가
 *    맞지만, 도매몰은 돌아오지 않는다. 410("영구히 사라졌다")은 구글이 재크롤을 더 빨리 포기하는
 *    유일한 신호다. 둘은 **판정 근거도 다르다** — 엔티티는 self-fetch 404(런타임), 이쪽은 경로(정적).
 *
 * 🔴 **301 → `/` 는 하지 않는다**: 301 은 *"이 내용이 저기로 옮겨갔다"* 일 때만 맞다. 도매몰은
 *    유어딜로 대체되는 서비스가 아니므로 홈으로 301 하면 구글이 **soft-404 로 재분류**해서 색인에서
 *    빼는 건 똑같고 사이트 신뢰도만 추가로 깎인다.
 *
 * 🔴 **robots.txt 로 막아서 해결하려 하지 말 것** — 가장 흔한 실수다. `Disallow` 를 넣으면 크롤러가
 *    이 410 을 **읽을 수 없어** 색인에 영구 잔존한다. 지울 때는 크롤을 열어 둬야 "사라졌다"가 전달된다.
 *
 * ⚠️ 본문은 SPA 셸 그대로 내려간다(HTTP 상태는 렌더를 막지 않는다) → 브라우저는 부팅해서
 *    `NotFoundPage` 를 정상 렌더한다. 라우트는 #1710 이 이미 지웠으므로 catch-all 이 받는다.
 *
 * ⚠️ **`/api/*` 는 이 함수가 보지 않는다** — 호출부가 text/html 청크포인트 안이고, `features/supply/`
 *    의 정산 엔진·공구 서비스 몰 인프라(`wholesale-malls*` — 이름만 wholesale 이다)는 살아 있다.
 *    경로 문자열이 비슷하다고 같이 묶으면 소비자 결제·환불·cron 이 끊긴다.
 */
export function isRetiredSurface(pathname: string): boolean {
  return /^\/(wholesale|supplier)(\/|$)/.test(pathname)
}

/**
 * 🗺️ 2026-08-03 (대표 — 도시별 색인 페이지): `/region/:sido[/:sigungu]` 서버 메타.
 *
 * 왜 서버에서 만드는가: 네이버 Yeti 는 JS 를 돌리지 않는다. 클라이언트 `<SEO>`(react-helmet)만
 * 두면 크롤러에겐 **모든 지역 페이지가 홈 메타**로 보이고, 그러면 도시 페이지를 만든 의미가 없다.
 *
 * ⚠️ 왜 `consumer-surfaces`(문구 SSOT)가 아니라 여기 있는가 — **번들 때문이다.**
 *   지역 정규화 표(`shared/constants/region-slugs`)는 `app-constants` 청크에 묶이는데,
 *   `consumer-surfaces` 는 소비자 페이지들이 `<SEO>` 용으로 import 하는 **크리티컬 패스 모듈**이다.
 *   거기서 region-slugs 를 끌어오면 첫 페인트에 그 청크가 통째로 딸려 온다
 *   (`check-critical-chunks` 가 실제로 잡았다 — CI 가 아니었으면 조용히 무거워졌을 것이다).
 *   이 파일은 **워커 전용**이라 클라 번들에 영향이 0 이다. 지역 페이지의 클라 `<SEO>` 는
 *   `RegionPage` 가 직접 만들므로 문구가 두 벌이 되는 문제도 없다(딜 개수까지 넣어 더 구체적이다).
 *
 * ⚠️ 이 함수가 **못** 하는 것 — 딜 개수를 모른다(여기선 DB 조회를 하지 않는다. area-report 와 같은 규칙).
 *   그래서 "딜이 적은 지역은 noindex" 는 클라이언트 렌더에서만 붙는다. 실무상 구멍이 크지 않은 이유는
 *   **thin 지역 URL 로 가는 링크를 아예 만들지 않기 때문**이다(RegionLinkGrid·sitemap 둘 다 `indexable`
 *   만 내보낸다). 직접 주소를 친 경우에만 index 로 나가고, 그건 크롤러가 도달할 일이 드물다.
 */
export function resolveRegionSeo(
  pathname: string,
  origin: string,
  siteName: string = CONSUMER_SITE_NAME
): ResolvedSurfaceSeo | null {
  const m = /^\/region(?:\/([^/]+))?(?:\/([^/]+))?\/?$/.exec(pathname)
  if (!m) return null

  const dec = (v?: string) => {
    if (!v) return ''
    try { return decodeURIComponent(v).trim() } catch { return v.trim() }
  }
  const sidoRaw = dec(m[1])
  const sigunguRaw = dec(m[2])

  // `/region` 허브
  if (!sidoRaw) {
    const t = withSiteName('지역별 이용권·동네딜 - 우리 동네 할인 찾기', siteName)
    return {
      pageTitle: t,
      title: t,
      description: '서울·경기·부산부터 제주까지, 지역별 식당·카페·뷰티·숙박 이용권을 할인가로. 온라인에서 사고 매장에서 QR·PIN으로 바로 사용하세요.',
      canonical: `${origin}/region`,
    }
  }

  const sido = normalizeSido(sidoRaw)
  // 모르는 지역 = 크롤러가 지어냈거나 오타. 색인시키면 soft-404 가 쌓인다.
  if (!sido || (sigunguRaw && !SIGUNGU_RE.test(sigunguRaw))) {
    const t = withSiteName('지역별 이용권·동네딜', siteName)
    return { pageTitle: t, title: t, description: '지역별 이용권·동네딜을 확인해보세요.', canonical: `${origin}/region`, noindex: true }
  }

  const label = sigunguRaw ? `${sido} ${sigunguRaw}` : sido
  const t = withSiteName(`${label} 이용권·동네딜 할인`, siteName)
  // 🔗 2026-10-13: 조립을 `regionPath` **한 곳**으로 — sitemap·빵부스러기·크롤러 링크·클라
  //   `<SEO url>` 가 전부 그 함수를 지난다(종전엔 다섯 벌이었고 둘이 날것이었다).
  const canonicalPath = regionPath({ sido, ...(sigunguRaw ? { sigungu: sigunguRaw } : {}) })
  return {
    pageTitle: t,
    title: t,
    description: `${label}의 식당·카페·뷰티·숙박 이용권을 할인가로. 온라인에서 사고 매장에서 QR·PIN으로 바로 사용하세요.`,
    canonical: `${origin}${canonicalPath}`,
  }
}
