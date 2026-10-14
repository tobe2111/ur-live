/**
 * 📝 2026-07-01 블로그 서버측 SSR 메타/구조화데이터 빌더 (worker/index.ts 에서 추출).
 *   JS 안 도는 크롤러(네이버/카카오/소셜 스크래퍼)용 title/OG/JSON-LD 를 순수 계산으로 생성.
 *   worker/index 의 HTMLRewriter `.on()` 배선은 이 결과값만 소비 — god 파일 성장 방지(file-size 래칫).
 *   ⚠️ 동작 불변: 기존 인라인 로직과 byte-동일한 출력(JSON-LD/canonical/OG). 순수 함수만.
 */
import { CONSUMER_SITE_NAME } from '../../../shared/seo/consumer-surfaces'
import { productShareImage, ogAbsHttps } from '../../../shared/og-share-image'

/** 블로그 빵부스러기 라벨 — 표의 다른 `crumb` 들과 같은 감각(짧게). */
const BLOG_CRUMB = '블로그'


// script 종료 태그 이스케이프 — <script type="application/json"> / ld+json 안전 임베드.
function escapeScript(s: string): string {
  return s.replace(/<\/script/gi, '<\\/script')
}

// 제목/요약 등 메타 텍스트의 마크다운 볼드 표기(**) 제거 — 크롤러/소셜/JSON-LD 에 글자로 노출 방지.
function stripBold(s: string): string {
  return s.replace(/\*\*/g, '')
}

/**
 * 🍞 2026-10-12 — 블로그 빵부스러기. 라이브 실측에서 `/blog` 와 글 23편 전부
 *   `BreadcrumbList` **0건**이었다(검색결과 제목 아래에 빵부스러기 대신 생 URL 이 뜬다).
 *   목록 표면들은 `surface-list-jsonld.ts` 가 체인을 쌓아 주는데, 블로그는 **다른 빌더**를
 *   쓰는 유일한 표면이라 그 처방이 여기까지 안 와 있었다.
 *
 * 체인은 **두~세 단계**다: `유어딜 › 블로그`(목록) / `유어딜 › 블로그 › 제목`(상세).
 * ⚠️ `name`·`item` 둘 다 넣는다 — 마지막 단계도 자기 URL 을 갖는다(구글 권장).
 * ⚠️ 사이트 이름은 `CONSUMER_SITE_NAME` SSOT 를 쓴다(손으로 '유어딜' 을 적으면 갈린다).
 *    워커는 alias(`@/`) 를 못 풀어 상대경로로 받는다.
 */
function blogBreadcrumb(
  origin: string,
  canonical: string,
  leaf?: { name: string; url: string },
): Record<string, unknown> {
  const trail: Array<{ name: string; url: string }> = [
    { name: CONSUMER_SITE_NAME, url: `${origin}/` },
    { name: BLOG_CRUMB, url: `${origin}/blog` },
  ]
  if (leaf) trail.push(leaf)
  return {
    '@type': 'BreadcrumbList',
    // 🔗 `@id` 를 줘서 본문 노드가 **참조**로 가리킨다 — 같은 체인을 두 벌 싣지 않는다
    //   (그러면 같은 문서에 동일한 BreadcrumbList 가 둘이 된다). 참조 대상은 같은 `@graph`
    //   안에 있으므로 **매달린 `@id` 가 생기지 않는다**(2026-10-11 E4 판정 기준).
    '@id': `${canonical}#breadcrumb`,
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem', position: i + 1, name: t.name, item: t.url,
    })),
  }
}

export interface BlogPostMeta {
  /** <title> 값 — "제목 - 유어딜 블로그" */
  pageTitle: string
  /** og/twitter title — 원제목 */
  title: string
  description: string
  canonical: string
  ogImage: string
  /** 이스케이프 완료된 BlogPosting JSON-LD 문자열 */
  jsonLd: string
}

/** 블로그 상세(/blog/:slug) 서버 메타 — payload 없거나 파싱 실패 시 null(기본 메타 유지). */
export function buildBlogPostMeta(ssrPayload: string, origin: string): BlogPostMeta | null {
  try {
    const post = (JSON.parse(ssrPayload) as { data?: { title?: string; summary?: string; slug?: string; author?: string; published_at?: string; updated_at?: string; thumbnail_url?: string | null } })?.data
    if (!post || !post.title) return null
    const title = stripBold(String(post.title))
    const description = stripBold(String(post.summary || '')).slice(0, 200)
    const canonical = `${origin}/blog/${post.slug || ''}`
    const pub = post.published_at ? new Date(post.published_at).toISOString() : undefined
    // 🗓️ 2026-10-12: `dateModified` 를 **`updated_at`** 에서 받는다. 종전엔 둘 다 `published_at`
    //   이라 *"고쳤다"* 는 신호가 구조적으로 존재할 수 없었고(라이브 실측 두 값이 동일),
    //   게다가 그 `published_at` 자신이 재시드 때마다 다시 쓰이고 있었다(같은 커밋에서 동결).
    //   ⚠️ `updated_at` 이 `published_at` 보다 **앞서면** 쓰지 않는다 — 수정이 발행보다 먼저일
    //   수는 없고, 그런 값을 내면 구글이 둘 다 신뢰하지 않는다(모순 신호).
    const upRaw = post.updated_at ? new Date(post.updated_at).toISOString() : undefined
    const mod = upRaw && pub && upRaw >= pub ? upRaw : pub
    // 🖼️ 2026-10-12: 종전엔 `/blog/og/:slug`(글별 배너)를 가리켰는데 그게 **SVG** 다 —
    //   실측 `content-type: image/svg+xml` · 853B.
    //   🩸 **정정(같은 날, 더 정확한 쪽)**: 처음 여기에 *"카카오·페북·트위터가 SVG 를 안 읽어 23편이
    //     전부 **빈 카드**"* 라고 적었는데 **카카오는 과장이다** — 2026-10-09 audit log 가
    //     *"카드는 떴고 그 안의 외부 `<image href>` 만 비었다"* 고 적어 둔 **우리 실측**이 있다.
    //     정확히는 ① **트위터·페북·슬랙**: 문서상 JPG·PNG·WEBP·GIF 만이라 그림이 **안 뜬다**
    //     ② **카카오**: 뜨지만 그 배너가 제목을 **그림에 또 그려** `og:title` 과 중복이었다
    //     (2026-10-12 대표가 유어샵에서 바로잡은 그 *"카드 안에 또 카드"*). 둘 다 고쳐야 할
    //     이유지만 **빈 카드는 아니었다** — 근거를 과장하면 다음 세션이 그 과장을 전제로 삼는다.
    //   🩸 그 라우트 머리말이 근거로 적어 둔 *"사이트 기본 OG 가 이미 SVG(og-image.svg)라 동일 호환"*
    //     은 **낡은 전제**다 — 기본 OG 는 지금 `og-image.png`(실측 1200×630 라스터 44,972B)다.
    //   🔒 **라우트는 지우지 않는다** — 이전에 스크랩된 카드가 그 주소를 물고 있다(유어샵 합성
    //     카드와 같은 판단). 바뀐 것은 *새로 나가는 og:image 가 무엇을 가리키는가* 하나다.
    //   📌 썸네일은 **아직 전 글이 비어 있다**(라이브 실측 `thumbnail_url: null`) — 그래서 오늘은
    //     전부 기본 카드로 떨어지고, 글에 사진이 붙는 날 저절로 1200×630 카드가 된다.
    //   📐 그리고 **두 축을 섞지 않는다**(`og-share-image.ts` 머리말): JSON-LD `image` 는
    //     구글이 쓰는 **글 사진**이라 원본이 낫고, `og:image` 는 1.91:1 **카드**다.
    //     종전엔 둘이 같은 SVG 였다 — 그래서 구글 쪽도 SVG 를 받고 있었다(글 리치결과 미지원).
    //   🩸 그리고 JSON-LD 쪽은 **절대 URL 이어야 한다** — 상대 경로면 구글이 그 필드를 **버리면서
    //     에러를 안 낸다**(2026-10-11 에 유어샵 핀 사진으로 값을 치른 그 자리다). `ogAbsHttps` 가
    //     절대화 + R2 공개 도메인 치환까지 한 번에 한다. 첫 판에서 실제로 `/api/media/...` 가
    //     그대로 샜고, **빌더를 돌려 눈으로 보고서야** 잡았다(문자열 검사로는 안 보인다).
    const photo = ogAbsHttps(post.thumbnail_url, origin)
    const ogImage = photo ? productShareImage(photo, origin) : `${origin}/og-image.png`
    // 🧠 2026-07-27 GEO (대표 — "구글 AI 개요에 우리 서비스가"): publisher/isPartOf 를 index.html 의
    //   사이트 전역 Organization·WebSite 노드(@id)에 **참조로 연결** — 기존엔 이름만 같은 분리 노드라
    //   검색 AI 가 "이 글의 발행자 = 유어딜(urdeal.kr) 서비스"로 묶지 못했다. @id 로 그래프가 이어지면
    //   블로그 22편이 전부 브랜드 엔티티의 근거 문서가 된다(동음이의 혼동 방지의 핵심).
    const article: Record<string, unknown> = {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: title, description,
      author: { '@type': 'Organization', name: post.author || '유어딜' },
      publisher: { '@id': `${origin}/#organization` },
      isPartOf: { '@id': `${origin}/#website` },
      mainEntityOfPage: canonical, url: canonical,
      ...(pub ? { datePublished: pub, dateModified: mod || pub } : {}),
    }
    // 🍞 빵부스러기를 더하려면 노드가 둘이 되므로 `@graph` 로 감싼다(소비자는 재귀로 훑는다).
    //   `@context` 는 바깥에 한 번만 — 안쪽 노드에 남겨 두면 중복 선언이 된다.
    const { '@context': _ctx, ...articleNode } = article as Record<string, unknown>
    const crumb = blogBreadcrumb(origin, canonical, { name: title, url: canonical })
    const jsonLd = escapeScript(JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        // 🔴 사진이 없으면 `image` 를 **아예 안 낸다** — 브랜드 기본 카드를 "이 글의 사진"
        //   이라고 말하는 것은 지어내기다(이 레포가 `aggregateRating`·`Offer` 에서 지키는 규율).
        { ...articleNode, ...(photo ? { image: photo } : {}), breadcrumb: { '@id': crumb['@id'] } },
        crumb,
      ],
    }))
    return { pageTitle: `${title} - 유어딜 블로그`, title, description, canonical, ogImage, jsonLd }
  } catch { return null }
}

/**
 * 블로그 목록(/blog) Blog + ItemList(BlogPosting) JSON-LD — 검색 리치결과.
 * payload 없거나(콜드 timeout) 파싱 실패/글 0건이면 '' 반환(메타만 주입).
 */
export function buildBlogListJsonLd(ssrPayload: string | null, origin: string, canonical: string, name: string, description: string): string {
  // 시드가 아예 없어도(콜드 self-fetch timeout) 빵부스러기는 낸다 — 경로만으로 만들어진다.
  if (!ssrPayload) {
    return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': [blogBreadcrumb(origin, canonical)] }))
  }
  try {
    const posts = (JSON.parse(ssrPayload) as { data?: Array<{ slug?: string; title?: string; summary?: string; author?: string; published_at?: string }> })?.data || []
    const items = posts.slice(0, 20).filter(p => p && p.slug && p.title).map((p, i) => ({
      '@type': 'ListItem', position: i + 1, url: `${origin}/blog/${p.slug}`,
      item: {
        '@type': 'BlogPosting', headline: stripBold(String(p.title)), description: stripBold(String(p.summary || '')).slice(0, 200),
        url: `${origin}/blog/${p.slug}`, mainEntityOfPage: `${origin}/blog/${p.slug}`,
        author: { '@type': 'Organization', name: p.author || '유어딜' },
        publisher: { '@id': `${origin}/#organization` },
        ...(p.published_at ? { datePublished: new Date(p.published_at).toISOString() } : {}),
      },
    }))
    // 🍞 글이 0건(콜드 timeout·발행 0)이어도 **빵부스러기는 낸다** — 그건 payload 와 무관하고,
    //   종전엔 여기서 `''` 로 빠져 그 경우 `/blog` 가 구조화 데이터를 통째로 못 받았다.
    const crumb = blogBreadcrumb(origin, canonical)
    if (!items.length) {
      return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': [crumb] }))
    }
    // 🧹 2026-10-14 — **같은 글을 두 벌 내던 것.** 라이브 실측: `/blog` 의 ld 블록이
    //   **19,279바이트 = 문서의 61%**(총 20KB / 31KB)이고 `headline` 이 **40회**(고유 20편),
    //   `Organization` 노드가 **42개**였다. `blogPost` 와 `mainEntity.itemListElement[].item` 이
    //   **같은 BlogPosting 객체를 각각 통째로** 직렬화했기 때문이다.
    //   ⚠️ 이 JSON 은 **사람이 받는 응답에도 그대로 실린다**(크롤러에게만 주면 구글 가이드 위반) —
    //   즉 모든 방문자가 쓸모없는 10KB 를 더 받고 있었다. #73(`/pass` 서버+react-helmet 두 벌)과
    //   같은 클래스의 다른 표면이다.
    // 🔑 **`mainEntity` 쪽을 남긴다** — 소비자 표면 전부(`surface-list-jsonld.ts`)가
    //    `ItemList` + 중첩 `item` + `numberOfItems` 한 벌로 돌고 있고, 블로그만 밖에 있었다.
    //    `Blog` 는 name·description·url·publisher·isPartOf·mainEntity·breadcrumb 를 그대로 갖는다.
    // 🔢 `numberOfItems` 도 그 표면들과 맞춘다(종전 선언 없음 — ItemList 권장 필드).
    const blog = {
      '@type': 'Blog', name, description, url: canonical,
      publisher: { '@id': `${origin}/#organization` },
      isPartOf: { '@id': `${origin}/#website` },
      mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items },
      breadcrumb: { '@id': crumb['@id'] },
    }
    return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': [blog, crumb] }))
  } catch { return '' }
}
