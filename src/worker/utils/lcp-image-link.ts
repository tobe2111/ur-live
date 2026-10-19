/**
 * 🏁 화면의 가장 큰 그림(LCP)을 **응답 헤더**에서 미리 받게 한다 (2026-10-19 대표 *"모두 개선해줘.
 *    특히 홈 부분이 처음 등장할테니까 최대한 신경써서 우선적으로"*).
 *
 * ## 무엇을 고치는가 (라이브 실측 — 폰 · 느린 4G · CPU 4배)
 * 홈의 LCP 는 맨 위 배너 사진이다. 그 `<img>` 는 서버 첫 화면 **본문**에 있어서, 브라우저가 `<head>` 의
 * 인라인 첫 화면 CSS(약 47KB)와 카드 preload 넷을 다 지나야 발견한다:
 *
 *     1524ms  앱 CSS 출발          ← 응답 헤더(Link) 로 온다 — HTML 을 다 받기 전에 출발
 *     1771ms  카드 사진 3장 출발    ← <head> preload
 *     1819ms  배너(LCP) 출발       ← 본문 <img> — 가장 늦다
 *     2100ms  JS 25개가 같이 출발   ← 이때부터 회선을 나눠 쓴다
 *     3295ms  배너 끝 → LCP 3.35s
 *
 * 배너만 늦었던 이유는 "늦게 발견" 이다. CSS 와 같은 자리(응답 헤더)에 실으면 HTML 첫 바이트와 함께
 * 출발해 JS 가 몰리기 전에 끝난다. 상세(이용권·숙소)·교환권 머리 배너도 같은 처방이다.
 *
 * ## ⚠️ 이 모듈의 함정 — 조용한 이중 다운로드
 * preload 는 URL 이 **byte-일치**할 때만 쓰인다(한 글자만 달라도 같은 사진을 두 번 받고 에러도 없다).
 * 그래서 주소를 **새로 조립하지 않는다** — 각 서버 첫 화면이 `<img src>` 에 쓰는 **같은 함수**를 부른다.
 * 시험이 빌더 출력의 `<img src>` 와 이 함수의 값을 문자열로 대조한다.
 *
 * ## 언제 내지 않나
 * 그 화면이 서버 첫 화면을 **실제로 그렸을 때만** 낸다(호출부가 빌더 결과가 비지 않았을 때만 부른다).
 * 그리지 않았는데 사진만 당기면 React 가 다른 크기로 다시 받는다.
 */
import { stripBannersOf, stripBannerImageUrl, bannersOfSlot } from '../../shared/home-strip-banners'
import { detailGalleryImages, detailHeroMobileUrl, DETAIL_HERO_MOBILE_WIDTH } from '../../shared/detail-hero-image'

/** 홈 — 섹션 시드의 맨 위 배너 첫 장(`home-first-screen.ts stripBannerHtml` 과 같은 함수). 배너가 없으면 '' (카드는 이미 preload 된다). */
export function homeLcpImage(sectionsSeedJson: string | null | undefined): string {
  if (!sectionsSeedJson) return ''
  try { return stripBannerImageUrl(stripBannersOf(JSON.parse(sectionsSeedJson))[0]?.image_url, 'strip') } catch { return '' }
}

/** 교환권 — 머리 배너 첫 장(`vouchers-first-screen.ts heroBannerHtml` 과 같은 함수). */
export function vouchersLcpImage(bannersJson: string | null | undefined): string {
  if (!bannersJson) return ''
  try { return stripBannerImageUrl(bannersOfSlot(JSON.parse(bannersJson), 'vouchers')[0]?.image_url, 'vouchers') } catch { return '' }
}

/** 숙소 상세 — 히어로(`stay-detail-ssr-body.ts` 와 같은 사진·같은 함수). */
export function stayLcpImage(stayPayload: string | null | undefined): string {
  if (!stayPayload) return ''
  try {
    const p = (JSON.parse(stayPayload) as { data?: { product?: Record<string, unknown> } })?.data?.product
    if (!p) return ''
    const url = detailHeroMobileUrl(detailGalleryImages(p)[0] || '', DETAIL_HERO_MOBILE_WIDTH)
    return url && !url.startsWith('data:') ? url : ''
  } catch { return '' }
}

/** `<link rel=preload>` 의 href 를 꺼낸다 — 상세 히어로는 이미 그 태그를 만들므로 같은 값을 헤더에도 싣는다. */
export function hrefOfPreloadTag(tag: string | null | undefined): string {
  return (tag?.match(/\bhref="([^"]+)"/)?.[1] ?? '').replace(/&amp;/g, '&')
}

/**
 * 응답 헤더에 싣는다. 같은 출처 경로만(`/` 로 시작, `//` 아님) — 외부 주소·이상한 값은 헤더를 깨므로 버린다.
 * `<` `>` `;` · 공백이 섞이면 Link 헤더 문법이 깨진다 → 그 경우 버린다.
 *
 * 🩸 2026-10-19 배포 후 실측 — 첫 판이 `,` 도 버려서 **한 번도 실리지 않았다.** cfImage 주소는 옵션을 쉼표로
 *   잇는다(`/cdn-cgi/image/width=900,quality=85,…/`) — 즉 실제로 넘어오는 값은 **전부** 쉼표를 품는다.
 *   시험 픽스처가 옵션 하나짜리(`width=1100`)라 초록이었다. `<…>` 안의 쉼표는 Link 문법상 정상이다(RFC 8288 —
 *   URI-Reference 는 꺾쇠로 감싸므로 값 구분자 쉼표와 섞이지 않는다).
 */
export function appendLcpLink(h: Headers, href: string): void {
  if (!href || !href.startsWith('/') || href.startsWith('//') || /[<>;\s]/.test(href)) return
  h.append('Link', `<${href}>; rel=preload; as=image; fetchpriority=high`)
}
