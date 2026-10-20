/**
 * 🖼️ 상품 공유 그림 — **소셜 카드가 받을 1200×630 한 장**을 정하는 단일 소스 (2026-10-12)
 *
 * ## 왜 생겼나 (라이브 실측 — UA 를 `KakaoTalk-Scrap` 으로 두고 서버 HTML 을 받아 `og:image` 를 쟀다)
 * 상세마다 공유 그림의 성질이 **갈려 있었다**:
 *
 *     /pass/:id      → /api/og/group-buy/:id      1200×630  (우리가 그린 카드)
 *     /u/:handle     → cdn-cgi …width=1200,height=630  (2026-10-12 에 이 길로 옮겼다)
 *     /stays/:id     → /api/media/…jpg  **원본 1397×748 · 518KB**     ← 원본 그대로
 *     /stays/2773    → /api/media/…png  **원본 PNG**                   ← 원본 그대로
 *     /vouchers/:id  → bizimg.giftishow.com/… **원본 500×500 · 258KB** ← 남의 CDN 원본
 *     /products/:id  → 같음                                            ← 남의 CDN 원본
 *
 * 세 가지가 동시에 나빴다:
 *   ① **비율이 안 맞는다** — 소셜 large card 는 1.91:1 을 기대한다. 500×500(1.0)은 렌더러가
 *      잘라 쓰거나 **small card 로 떨어뜨린다**(카드가 작아지면 사진이 썸네일이 된다).
 *   ② **무겁다** — 258~518KB 원본. 스크래퍼는 느리면 **기다려 주지 않고 포기**한다
 *      (`ushop-share-card.ts` 가 같은 실측을 적어 뒀다: 워커 경유 1203ms ↔ R2 직접 343ms).
 *   ③ **남의 CDN 이다** — `bizimg.giftishow.com` 은 **핫링크·데이터센터 IP 차단 이력**이 있다
 *      (2026-06-17 차단 → 2026-07-13 해제 실측). 차단되는 날 카드 사진이 통째로 빈다.
 *
 * ## 처방 — `fit=pad` (실측으로 고른 값이다)
 * 같은 사진을 네 가지로 구워 재 봤다(giftishow 500×500 원본 258,475B):
 *
 *     fit=cover,gravity=auto  → 1200×630  112,028B   정사각을 가로로 잘라 **세로 44% 손실**
 *     fit=contain             →  **630×630**  52,269B  요청한 1200×630 을 **안 만든다**(패딩 없음)
 *     fit=pad,background=…    → 1200×630   54,819B   ✅ 정확히 1200×630 · 잘림 0 · 원본의 1/5
 *
 * ⇒ **상품 사진은 `pad`** 다. 가로 사진은 여백이 거의 안 생기고(숙소 1397×748 = 1.867 vs 1.905 →
 *   좌우 1% 미만), 정사각·세로 사진은 **안 잘린다**. `cover` 를 쓰면 기프티콘 상품 사진의 절반이 날아간다.
 *
 * 🔴 **얼굴 사진은 반대다** — 유어샵 프로필은 `fit=cover,gravity=auto` 가 맞다(꽉 채우고 리사이저가
 *    피사체를 찾는다. 대표가 그 카드를 보고 확정했다). 그래서 이 파일은 `fit` 을 **인자로** 받는다.
 *    두 쓰임을 한 값으로 묶지 말 것 — 묶는 순간 한쪽이 잘리거나 한쪽에 여백이 생긴다.
 *
 * ## 이 파일이 **안 하는 것**
 * 🔴 **JSON-LD `Product.image` 는 바꾸지 않는다.** 그건 소셜 카드가 아니라 **구글 상품 사진**이고,
 *    원본이 더 높은 해상도다. 1200×630 으로 깎아 넘기면 구글 이미지 검색에서 손해다.
 *    ⇒ 빌더는 `photo`(원본, JSON-LD 용)와 `ogImage`(카드, 소셜 용) **두 축**을 따로 들고 간다.
 *    같은 교훈을 `consumer-surfaces.ts` 의 `canonicalParams` ↔ `titleParams` 에서 이미 치렀다.
 *
 * ## 이 파일이 **못 하는 것**
 * 카드를 **그리는** 주체는 카카오·페이스북·슬랙이다. 비율·바이트를 맞췄다는 것이 "예쁘다" 를
 * 말해 주지 않는다 — 실제 카톡방에서 봐야 한다(E4).
 *
 * ⚠️ **워커가 import 한다** — React·lucide·i18n 을 끌어오지 말 것.
 */

/** 소셜 카드 그림 크기 — large card 비율 1.91:1. `og:image:width/height` 선언이 이 값을 읽는다. */
export const OG_CARD_W = 1200
export const OG_CARD_H = 630

/**
 * 상품 사진 뒤 바탕 — 🎫 디자인 시스템 라이트 바탕(`--bg`, `src/index.css` SSOT).
 * ⚠️ jpeg 는 투명을 못 담으므로 `pad` 에는 배경이 **필수**다(없으면 투명 PNG 뒤가 검정이 된다 —
 *    `ushop-share-card.ts` 가 유달이에서 같은 실측을 적어 뒀다).
 * ⚠️ 생 `#` 을 주면 fragment 로 잘리고, 떼고 주면 리사이저가 `err=9401` 로 거절한다(실측) —
 *    그래서 `encodeURIComponent` 를 거친다.
 */
export const OG_CARD_BG = '#F8F7FC'

/**
 * `og:image` 가 **무엇을 보여주는지** 한 줄. 그림을 못 받는 사람·스크린리더·그림이 깨진 카드가 읽는다.
 *
 * 🩸 2026-10-14 실측: `summary_large_image` 를 내는 소비자 표면 **33곳 전부 `og:image:alt` 가 0건**
 * 이었다. `og:image:width/height` 는 2026-10-12 에 봇 셸·`index.html` 둘 다 선언했는데 **alt 만
 * 빠졌다.** 클라 `<SEO>`(react-helmet)엔 있었으므로 **JS 를 렌더하는 크롤러만 보고 있었다** —
 * 같은 날 제목에서 고친 *한 URL 두 값* 과 정확히 같은 클래스다.
 *
 * 🔑 **alt 은 `og:image` 를 고르는 같은 자리에서 정한다.** 그림이 셋(브랜드 카드 · 사진 카드 ·
 *   유달이 폴백)이고 각각 설명이 다르므로, 두 곳에서 정하면 그림은 바뀌고 alt 은 안 바뀌는 날이 온다.
 *
 * ⚠️ 사진 카드는 **제목을 그대로** 쓴다 — 그 카드가 보여 주는 것이 그 제목의 대상이기 때문이다.
 *   사진 내용을 추측해 적지 않는다(지어내지 않는 규율).
 */
export function ogImageAlt(image: string, title: string, siteName = '유어딜'): string {
  const u = String(image || '')
  if (/udal-loader/.test(u)) return `${siteName} 마스코트 유달이`
  if (/\/og-image\.(png|svg)$/.test(u)) return `${siteName} 브랜드 카드`
  const t = String(title || '').trim()
  return t || `${siteName} 공유 카드`
}

/** R2 공개 도메인 — `/api/media/<key>` 는 워커를 거치지 말고 여기로(같은 결과, 3.5배 빠르다). */
const R2_PUBLIC_HOST = 'https://media.ur-team.com'

/** 절대 https URL 로. 스크래퍼는 상대 경로를 조용히 버린다. 만들 수 없으면 `''`. */
export function ogAbsHttps(src: string | null | undefined, origin: string): string {
  const t = String(src || '').trim()
  if (!t || t.startsWith('data:') || t.startsWith('blob:')) return ''
  // 🔑 `/api/media/<key>` 는 **이미 절대 URL 이 된 뒤**에도 잡는다 — 호출부(`absImage`)가 먼저
  //   `${origin}` 을 붙이므로 상대 모양만 보면 놓친다(실측: 숙소 데모 사진이 전부 이 형태였다).
  const m = /^(?:https?:\/\/[^/]+)?\/api\/media\/(.+)$/.exec(t)
  const abs = m ? `${R2_PUBLIC_HOST}/${m[1]}` : t.startsWith('/') ? `${origin}${t}` : t
  return /^https:\/\//i.test(abs) ? abs : ''
}

export interface OgCardOpts {
  /** `pad` = 상품(잘리지 않는다) · `cover` = 얼굴(꽉 채운다). 머리말의 실측 표를 보고 고를 것. */
  fit: 'pad' | 'cover'
  /** `pad` 일 때만 쓰인다(기본 `OG_CARD_BG`). */
  background?: string
}

/**
 * 🖼️ 원본 사진 → **정확히 1200×630** 소셜 카드 주소.
 *
 * `format=jpeg` 고정: 이 그림을 굽는 것은 우리 화면이 아니라 **남의 렌더러**다(AVIF/WebP 를 못 읽을 수 있다).
 * `onerror=redirect`: 리사이저가 원본을 못 가져오면 원본으로 302 — 종전 동작(원본 그대로)과 같다.
 * `%` 한 번 더 감싸기: 경로에 박히는 원본이 이미 퍼센트 인코딩이면 리사이저가 풀어 다른 주소를
 * 가져간다(2026-08-11 에 한글 파일명 네이버 사진 134개가 그래서 404 였다).
 *
 * 🔑 **주소가 모양에서 파생된다** — 크기·fit 이 주소에 박혀 있으므로 모양을 바꾸면 주소가 **저절로**
 *    바뀌고 카카오 캐시가 새로 받는다(판 번호를 손으로 올리던 2026-09 의 수습이 그래서 필요했다).
 *
 * 감쌀 수 없는 입력(상대경로 불가·스킴 불가)이면 **빈 문자열** — 호출부가 종전 값으로 떨어진다.
 */
export function ogCardUrl(src: string | null | undefined, origin: string, opts: OgCardOpts): string {
  const abs = ogAbsHttps(src, origin)
  if (!abs) return ''
  const common = `width=${OG_CARD_W},height=${OG_CARD_H},quality=85,format=jpeg,onerror=redirect`
  const tail = opts.fit === 'cover'
    ? 'fit=cover,gravity=auto'
    : `fit=pad,background=${encodeURIComponent(opts.background || OG_CARD_BG)}`
  return `${origin}/cdn-cgi/image/${common},${tail}/${abs.replace(/%/g, '%25')}`
}

/**
 * 상품 상세(숙소·교환권·쇼핑·몰)의 `og:image`. 못 감싸면 **원본을 그대로** 돌려준다 —
 * 그림이 없는 카드보다 비율이 안 맞는 카드가 낫다(종전과 같은 동작).
 */
export function productShareImage(photo: string | null | undefined, origin: string): string {
  return ogCardUrl(photo, origin, { fit: 'pad' }) || String(photo || '')
}
