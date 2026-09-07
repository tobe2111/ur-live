import { cfImage, cfSrcSet } from '../../utils/cf-image'
import { DETAIL_HERO_DESKTOP_WIDTH, detailHeroMobileUrl, detailPlainUrl } from '../../shared/detail-hero-image'
import {
  HOME_CARD_IMG_WIDTH_LG, HOME_CARD_IMG_WIDTH_BASE,
  HOME_CARD_LG_QUERY, HOME_CARD_BASE_QUERY, HOME_CARD_ABOVE_FOLD,
} from '../../shared/home-card-image'
import { pickHeroPhotoFromSeedJson } from '../../shared/home-hero-photo'
import { BANNER_SLOT_SPECS } from '../../shared/constants/home-showcase'
import { HOME_HERO_MEDIA_QUERY, HOME_HERO_REQUEST_WIDTH, HOME_HERO_QUALITY } from '../../shared/home-hero-image'

/**
 * 🖼️ 홈 첫 화면 카드 사진 preload 링크 생성 (2026-08-27 대표 "메인페이지 로딩 자체도 느려").
 *
 * ## 무엇을 고치는가
 * 사진 URL 은 **이미 HTML 안**(SECTIONS 시드)에 있는데 `<img>` 를 React 가 만들기 때문에
 * **JS 마운트 뒤에야** 다운로드가 시작됐다. 실측(모바일): 마운트 1341ms → 첫 사진 표시 2221ms.
 * `<link rel="preload" as="image">` 를 head 에 넣으면 HTML 파싱 즉시 JS 와 **병렬로** 받는다.
 * (상세 히어로가 2026-07-02 에 고친 것과 같은 병목 — 그쪽 패턴을 홈으로 옮긴 것.)
 *
 * ## ⚠️ 이 코드의 함정 — 조용한 이중 다운로드
 * preload 는 **URL 이 byte-일치할 때만** 쓰인다. 한 글자만 달라도 브라우저는 그걸 버리고 같은
 * 사진을 다시 받는다 — **에러도 없고 화면도 멀쩡한데 더 느려지고 트래픽만 두 배**다.
 * 그래서 ① 카드와 **같은 함수**(`cfImage`/`cfSrcSet`)로 만들고 ② 폭·중단점·개수를
 * `shared/home-card-image` SSOT 에서 읽으며 ③ 뷰포트로 갈리는 폭은 `media=` 로 나눈다
 * (2·3열 200 ↔ 4열 400. 하나로 합치면 한쪽이 반드시 어긋난다).
 *
 * ## 왜 별도 파일인가
 * `worker/index.ts` 는 파일 크기 래칫(god 파일 가드)에 동결돼 있다. 이 블록을 인라인으로 두면
 * 그 한도를 넘는다 — 그리고 여기 있는 편이 **직접 테스트하기도 쉽다**(HTMLRewriter 없이 문자열만 본다).
 */

/** 시드에서 읽는 최소 모양 — 서버 `CARD_COLS`(section-rules.ts)의 부분집합. */
interface SeedShape {
  data?: Array<{ products?: Array<{ image_url?: string }> }>
}

const escAttr = (s: string) => s.replace(/"/g, '&quot;')

/**
 * SECTIONS 시드(JSON 문자열)에서 첫 섹션의 above-fold 카드 사진 preload 링크들을 만든다.
 *
 * @returns `<link …>` 문자열 배열. 시드가 깨졌거나 사진이 없으면 **빈 배열**(fail-soft —
 *   preload 가 없다고 홈이 안 뜨면 안 된다).
 */
export function buildHomeCardPreloadLinks(ssrExtraPayload: string): string[] {
  let first: Array<{ image_url?: string }>
  try {
    first = (JSON.parse(ssrExtraPayload) as SeedShape)?.data?.[0]?.products ?? []
  } catch {
    return [] // 시드 파싱 실패 — preload 생략(치명 아님)
  }

  const links: string[] = []
  for (const p of first.slice(0, HOME_CARD_ABOVE_FOLD)) {
    const src = p?.image_url
    if (!src) continue
    for (const [q, w] of [
      [HOME_CARD_BASE_QUERY, HOME_CARD_IMG_WIDTH_BASE],
      [HOME_CARD_LG_QUERY, HOME_CARD_IMG_WIDTH_LG],
    ] as const) {
      const href = cfImage(src, { width: w, format: 'auto' })
      // data: URI 는 이미 문서 안에 있다 — preload 할 것이 없다.
      if (!href || href.startsWith('data:')) continue
      const set = cfSrcSet(src, w)
      links.push(
        `<link rel="preload" as="image" fetchpriority="high" media="${q}" href="${escAttr(href)}"${
          set ? ` imagesrcset="${escAttr(set)}"` : ''
        }>`,
      )
    }
  }
  return links
}

/**
 * 🖼️ 공구/교환권 **상세 히어로** preload 링크 (2026-07-02 [UNLOCK_LOADING] 대표 "사진이 빠르게 안 나타남").
 *
 * 상세 히어로는 프리로드 스캐너를 못 탄다(공구=CSS background-image, 교환권=React 렌더 후 `<img>`)
 * → [엔트리→페이지 청크→렌더] 뒤에야 다운로드가 시작돼 사진이 늦게 떴다.
 * seed 의 `image_url` 로 클라와 **동일 함수**로 URL 을 만들어 주입하면 HTML 파싱 즉시 병렬로 받고,
 * 렌더 시점엔 캐시에 적중한다(byte-일치 보장).
 *
 * ⚠️ **표면별 정합**: `/group-buy/:id` 히어로 = `cfImage(900)` 단일 URL ↔ `/vouchers/:id` 히어로 =
 *   `cfImage(800)` + `cfSrcSet(800)` 밀도 srcSet. 형태가 다르면 **이중 다운로드**가 된다.
 * ⚠️ Save-Data 사용자만 quality 65 라 URL 이 달라 미적중 — 히어로 1장 한정 허용 트레이드오프.
 *
 * 🔁 2026-08-27: `worker/index.ts` 인라인이던 것을 **출력 불변**으로 여기 옮겼다(파일 크기 래칫 +
 *   홈 카드 preload 와 같은 성격이라 한곳에 모으는 편이 다음 사람이 찾기 쉽다).
 *
 * @returns `<link …>` 문자열, 만들 수 없으면 `null`(fail-soft).
 */
export function buildDetailHeroPreloadLink(ssrPayload: string, isVoucherSurface: boolean, isMobile = true): string | null {
  try {
    const heroSrc = (JSON.parse(ssrPayload) as { data?: { image_url?: string } })?.data?.image_url
    if (!heroSrc) return null
    // 🧵 2026-09-02: 이용권 상세는 `DetailGallery` 와 **같은 SSOT 함수**로 만든다. 이전의 `width: 900` 은
    //    08-31 크롭 도입 뒤 갤러리가 그리는 어떤 URL 과도 안 맞아 **preload 가 통째로 버려지고** 있었다
    //    (라이브 실측: 111KB 를 받고 안 쓴 뒤 같은 사진을 다시 받았다). 폰/PC 는 그리는 폭이 달라 UA 로 가른다.
    const heroUrl = isVoucherSurface
      ? cfImage(heroSrc, { width: 800, format: 'auto' })
      : isMobile ? detailHeroMobileUrl(heroSrc) : detailPlainUrl(heroSrc, DETAIL_HERO_DESKTOP_WIDTH)
    if (!heroUrl || heroUrl.startsWith('data:')) return null
    const heroSrcSet = isVoucherSurface ? cfSrcSet(heroSrc, 800) : ''
    return `<link rel="preload" as="image" fetchpriority="high" href="${escAttr(heroUrl)}"${
      heroSrcSet ? ` imagesrcset="${escAttr(heroSrcSet)}"` : ''
    }>`
  } catch {
    return null // seed 파싱 실패 — preload 생략(치명 아님)
  }
}

/**
 * 🏔️ 홈 **히어로** 사진 preload (2026-08-29 대표 — "히어로에 나올 사진이 가장 늦긴 해").
 *
 * ## 실측한 문제
 * 카드 4장은 위(`buildHomeCardPreloadLinks`)에서 preload 를 받는데 **정작 그 위에 있는 히어로는
 * 못 받고 있었다.** 라이브 PC 3회 측정에서 히어로 다운로드가 카드보다 **일관되게 ~630ms 늦게
 * 시작**했다(631/648/632ms). 화면 맨 위 사진이 가장 늦게 시작하는 셈이다.
 *   히어로는 이미 `loading="eager" fetchPriority="high"` 다 — 그건 **발견된 뒤**의 우선순위이고,
 *   발견 자체가 React 렌더 뒤라서 늦었다. preload 만이 그 앞을 당긴다.
 *
 * ## ⚠️ byte-일치
 * 클라이언트(`HomeHeroDefault`)가 만드는 `src`/`srcSet` 과 **같은 함수·같은 인자**로 만든다.
 * 한 글자만 달라도 preload 가 버려지고 96KB 를 두 번 받는다(에러 없이 더 느려진다).
 * 사진 고르기도 같은 SSOT(`shared/home-hero-photo`)를 쓴다.
 *
 * ## ⚠️ 중단점
 * 히어로 사진은 `hidden md:block` 이라 **768px 미만에서는 보이지 않는다.** `media=` 로 막지 않으면
 * 폰이 96KB 를 헛되이 받는다 — 고치려던 것보다 더 나쁜 회귀다.
 *
 * ## 어드민 배너가 있으면?
 * 그때는 클라이언트가 배너 사진을 쓴다. 다만 배너는 마운트 후 fetch 라, **첫 화면에 먼저 뜨는 건
 * 어느 경우에나 이 시드 사진**이다 — 그래서 이 preload 는 배너 유무와 무관하게 유효하다.
 *
 * @returns `<link …>` 문자열, 없으면 null(fail-soft).
 */
export function buildHomeHeroPreloadLink(mainSeedPayload: string): string | null {
  const pick = pickHeroPhotoFromSeedJson(mainSeedPayload)
  if (!pick?.src) return null
  const href = cfImage(pick.src, { width: HOME_HERO_REQUEST_WIDTH, quality: HOME_HERO_QUALITY })
  if (!href || href.startsWith('data:')) return null
  const set = cfSrcSet(pick.src, BANNER_SLOT_SPECS.hero.srcSetBase!)
  return `<link rel="preload" as="image" fetchpriority="high" media="${HOME_HERO_MEDIA_QUERY}" href="${escAttr(href)}"${set ? ` imagesrcset="${escAttr(set)}"` : ''}>`
}
