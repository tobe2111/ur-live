/**
 * 🖼️ 홈 카드 사진의 **표시 폭** — 클라(렌더)와 워커(preload)가 같은 값을 봐야 한다.
 *
 * ## 왜 SSOT 인가
 * 카드는 `cfImage(src, { width })` + `cfSrcSet(src, width)` 로 그린다. 워커가 그 카드를
 * `<link rel="preload" as="image">` 로 미리 당기려면 **완전히 같은 URL/srcSet** 을 만들어야 한다 —
 * 한 글자만 달라도 브라우저는 preload 를 안 쓰고 **같은 사진을 두 번 받는다**(느려지고 비싸진다).
 * 그런데 폭은 뷰포트에 따라 갈리므로(2열/3열 ↔ 4열), 그 분기가 두 곳에 손으로 적히면 반드시 어긋난다.
 *
 * ⚠️ 값을 바꿀 때는 **여기만** 바꾼다. 클라의 `useMediaQuery`, 워커의 `media=` 속성이 같은 상수를 읽는다.
 *    (가드: `home-card-image` 테스트 — 양쪽이 이 파일을 쓰는지 검사)
 */

/** lg 이상(4열)에서 카드 한 장이 차지하는 CSS 폭. 실측 322px → 여유 포함 400. */
export const HOME_CARD_IMG_WIDTH_LG = 400
/** lg 미만(2~3열). 실측 모바일 175px · 태블릿 174px → 200. */
export const HOME_CARD_IMG_WIDTH_BASE = 200

/**
 * 열 수가 4로 바뀌는 지점 — Tailwind `lg`(1024px).
 * 클라는 `useMediaQuery(HOME_CARD_LG_QUERY)`, 워커는 `<link media="...">` 로 같은 조건을 쓴다.
 */
export const HOME_CARD_LG_QUERY = '(min-width: 1024px)'
/** 위의 여집합 — preload 링크를 뷰포트별로 갈라 붙일 때 쓴다. */
export const HOME_CARD_BASE_QUERY = '(max-width: 1023px)'

/**
 * 📋 2026-11-01 대표 확정 안 B — 폰(<768)의 홈 **줄 목록** 사진 칸은 120px(`DEAL_ROW.mediaBox`).
 *   그 칸에 2열 시절 폭(200 → 2x 400)을 받으면 필요한 양의 약 3배를 받는다. 줄 목록은 120 → 2x 240.
 *   ⚠️ 줄 목록에만 쓴다 — 격자 카드(찜·지갑 추천 등 2열 175px)는 종전 BASE 그대로.
 *   ⚠️ 클라(`HomeSections`·`GroupBuyFeed`)·워커 preload·서버 첫 화면이 이 셋을 같이 읽는다(URL 이 갈리면 이중 다운로드).
 */
export const HOME_CARD_IMG_WIDTH_ROW = 120
/** 줄 목록 구간 — `DEAL_ROW` 의 `max-md`(768 미만)와 같은 경계. */
export const HOME_CARD_ROW_QUERY = '(max-width: 767px)'
/** 태블릿(격자 4열, 사진 폭 BASE) — preload 를 줄 목록과 갈라 붙일 때 쓴다. */
export const HOME_CARD_MID_QUERY = '(min-width: 768px) and (max-width: 1023px)'

/** 홈 카드 사진 폭 — 열 수를 아는 쪽이 부른다. 클라와 워커가 같은 판정을 쓴다. */
export function homeCardImgWidth(isLg: boolean, isRowViewport: boolean, row: boolean): number {
  if (isLg) return HOME_CARD_IMG_WIDTH_LG
  return row && isRowViewport ? HOME_CARD_IMG_WIDTH_ROW : HOME_CARD_IMG_WIDTH_BASE
}

/**
 * 첫 화면에서 **즉시(eager)** 로드하는 카드 수 = preload 대상 수.
 *
 * 이 숫자가 클라(`aboveFold={i < N && sIdx === 0}`)와 워커(preload 개수)에서 갈리면,
 * 워커가 더 많이 당기면 **안 쓰는 사진을 받고**(트래픽 낭비), 적게 당기면 **효과가 반쪽**이 된다.
 */
export const HOME_CARD_ABOVE_FOLD = 4

/**
 * 🖼️ 2026-10-12 카드 사진 밀도 상한 — 3x 폰(아이폰)도 2x 사진까지만 받는다(대표 *"이용권 사진들도 너무 늦게 뜨고"*).
 * 모바일 카드 표시 폭이 175px 라 3x 는 600px(실측 37~58KB), 2x 는 400px(23~36KB) — 장당 약 37% 감소.
 * 400px 를 175px 에 그리면 화소 밀도 2.3배라 눈에 띄는 흐림이 없다. 재생 실측: 홈 아래 카드 8장이 다 오는 시각이 당겨진다.
 * ⚠️ 클라 카드(`DealCardMedia`)·워커 preload(`home-card-preload`)·서버 첫 화면(`home-first-screen`)이 **같은 값**을 써야 한다
 *    — 하나만 바꾸면 preload 가 빗나가 같은 사진을 두 번 받는다.
 */
export const HOME_CARD_MAX_DPR = 2 as const
