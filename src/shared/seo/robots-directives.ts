/**
 * 🤖 `robots` 메타의 **값 SSOT** (2026-10-14 신설)
 *
 * ## 왜 생겼나 — 라이브 실측 두 가지
 *
 * ### ① `max-image-preview` 가 전 표면 **0건**
 * Googlebot UA 로 색인 대상 12경로를 받아 `<meta name="robots">` 를 전수로 세니 **전부**
 * `index, follow` 하나였다(`/`·`/vouchers`·`/browse`·`/map`·`/stays`·`/pass/:id`·`/stays/:id`
 * ·`/u/:handle`·`/blog`·`/faq`·`/products/:id`·`/region/서울`).
 *
 * 이 지시어는 **검색결과·Discover 에서 우리 사진을 크게 쓸 수 있는지**를 정한다. 사진이 상품인
 * 서비스(이용권·숙소·교환권 카드가 전부 사진 한 장이다)에서 그 자리를 안 쓰고 있었다.
 *
 * ⚠️ **근거의 한계를 밝힌다**: 이 환경 프록시가 `developers.google.com` 을 막아(실측 000) **구글
 *    원문을 읽지 못했다.** 확실한 것은 ⓐ 유효값이 `none|standard|large` 라는 것 ⓑ 지시어가
 *    **없을 때의 기본값은 구글이 정하고 지역·시점에 따라 달라진다**는 것 ⓒ 그래서 큰 이미지를
 *    *보장받는* 유일한 길이 **명시**라는 것이다. "지금 작게 나온다" 를 실측한 것이 아니라
 *    **"우리가 크게 쓰라고 말한 적이 없다"** 를 실측한 것이다 — 그 차이를 과장하지 말 것.
 *
 * ### ② 같은 noindex 표면이 크롤러에 따라 다른 값을 받았다
 * 서버는 `noindex, follow` 를 내는데(실측 `/partnership`·`/vouchers/2192`·`/search`·`/gb-market`
 * ·`/influencer/rankings`·404 전부) `components/SEO.tsx` 는 `noindex, nofollow` 를 냈다.
 * 🔑 **둘이 공존한다** — `react-helmet-async@3` 의 DOM 동기화는 `meta[data-rh]`, 즉 **자기가 만든
 * 태그만** 질의한다(모듈 소스 실측 — `index.esm.js` 전체에서 head 질의는 `type[HELMET_ATTRIBUTE]`
 * 한 곳뿐이고 `data-rh` 는 2번 나온다).
 * 서버가 심은 태그에는 그 속성이 없어 **지워지지 않는다.** ⇒ JS 를 렌더하는 Googlebot 은 robots
 * 메타를 **둘** 받고, 충돌 시 구글은 **가장 제한적인 쪽**을 쓰므로 `nofollow` 가 이긴다.
 *
 * 영향 범위(실측): 표의 noindex 8개 중 robots.txt 로 막히지 않아 **크롤러가 실제로 오는 것 6개**
 * (`/about/print`·`/videos`·`/gb-market`·`/partnership`·`/terms/influencer`·`/terms/group-buy`)
 * **+ 교환권 상세 2,260건**(`VoucherDetailPage` 가 `noindex` 를 넘긴다). 그 페이지들이
 * Googlebot 에게 **막다른 길**이 된다 — 이 레포가 `noindex, follow` 를 일부러 고른 이유
 * (*색인은 말고 크롤 경로는 남긴다*)가 조용히 뒤집혀 있었다.
 *
 * ## 🔴 왜 상수 두 개로 모으나
 * 값이 **다섯 곳**에 흩어져 있었고(`index.html` · 봇 셸 · `SEO.tsx` · 워커 noindex rewrite 2곳)
 * 그중 둘이 이미 갈려 있었다. 같은 날 제목·`og:image:alt` 에서 고친 **"한 URL 두 값"** 과 같은
 * 클래스다. 값을 손으로 적는 자리가 하나라도 남으면 반드시 다시 갈린다.
 *
 * ⚠️ **`index.html` 은 정적 HTML 이라 이 모듈을 import 할 수 없다** — 그래서 거기만 리터럴이고,
 *    `src/tests/unit/robots-directives-2026-10-14.test.ts` 가 그 리터럴이 `ROBOTS_INDEX` 와
 *    **같은 글자인지** 대조한다(`og:image:alt` 에서 쓴 것과 같은 수법).
 *
 * ⚠️ **noindex 에는 `max-image-preview` 를 붙이지 않는다** — 색인하지 않는 페이지의 이미지
 *    미리보기 크기는 아무 의미가 없고, 지시어가 늘면 그만큼 갈릴 자리가 늘어난다.
 */

/** 색인 대상 표면의 robots 값. 사진을 크게 쓰라고 **명시**한다(기본값에 기대지 않는다). */
export const ROBOTS_INDEX = 'index, follow, max-image-preview:large'

/**
 * 색인 제외 표면의 robots 값. **`follow` 다** — 색인을 빼는 것과 크롤 경로를 끊는 것은 다른 일이고,
 * 이 레포는 전자만 원한다(CLAUDE.md 가 폐기·색인제외에서 반복해 적어 둔 그 판단).
 */
export const ROBOTS_NOINDEX = 'noindex, follow'
