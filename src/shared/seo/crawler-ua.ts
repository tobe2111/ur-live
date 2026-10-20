/**
 * 🔎 **검색 크롤러 UA 판정 + 서버 첫 화면 렌더 조건의 SSOT**
 * (2026-10-11 대표 *"네이버도 해주고. 그리고 SEO, GEO 모두 가장 이상적인 형태인지 … 우리 서비스로 트래픽이 몰려야해"*)
 *
 * ## 왜 이 파일이 생겼나 — 네이버가 우리 홈을 **빈 페이지**로 보고 있었다 (라이브 실측)
 *
 * 같은 URL 을 UA 만 바꿔 재니 서버가 주는 본문 글자 수가 이렇게 갈렸다:
 *
 *                        `/`      `/u/jiwon1228`   `/pass/2915`
 *     Yeti (네이버)        6자          6자            49자
 *     Googlebot 스마트폰  363자        242자           49자
 *     Googlebot 데스크톱    6자          6자            49자
 *
 * 홈·유어샵의 서버 첫 화면(2026-10-08·10-09)은 `isMobileUserAgent` 게이트 뒤에 있고, 그 술어는
 * `/Mobi|Android|iPhone|iPad|iPod/i` 다. **Yeti 의 UA 에는 그 다섯 중 아무것도 없다**
 * (`Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)`). 그래서 데스크톱으로 판정돼
 * 로더만 받았다 — 그 1초를 없애려고 만든 첫 화면이 **정작 JS 를 안 돌리는 크롤러에게는 안 그려졌다.**
 *
 * Googlebot 은 스마트폰 크롤러가 기본이라 `Android`·`Mobile` 이 걸려 **우연히** 보고 있었다.
 * 즉 구글은 보고 네이버는 못 보는 상태였고, 에러가 없어 아무도 몰랐다.
 *
 * ## 🔒 `isMobileUserAgent` 를 넓히지 않은 이유
 *
 * 그 함수는 `shared/detail-hero-image.ts` 에 있고 **히어로 사진 폭**을 정한다(워커 preload ·
 * 감시 `<img>` · 슬라이드가 같은 함수로 URL 을 만드는 그 SSOT). 거기에 크롤러를 섞으면 한 술어가
 * *"사진을 몇 px 로 받나"* 와 *"본문을 그려 주나"* 두 질문에 동시에 답하게 되고, 한쪽을 고치면
 * 다른 쪽이 조용히 따라 움직인다. ⇒ **조건을 넓히는 자리를 여기로 분리**하고, 사진 폭 술어는
 * 그대로 쓴다(`shouldRenderMobileFirstScreen` 이 그걸 import 해 조합한다 — 조합이 한 곳이라
 * 분기가 늘어도 갈릴 수 없다).
 *
 * ## ⚖️ 클로킹이 아니다
 *
 * 크롤러에게 주는 것은 **모바일 사용자가 받는 것과 같은 HTML** 이다(같은 함수·같은 시드).
 * UA 로 레이아웃을 가르는 것은 반응형 사이트의 정상 동작이고 구글도 Dynamic Serving 으로 허용한다.
 * ⚠️ 그래서 이 목록에 UA 를 더할 때도 **그 크롤러에게만 다른 내용을 주는 일은 하지 말 것** —
 * 이 파일이 정하는 것은 "누구에게 *모바일* 첫 화면을 그리나" 뿐이다.
 *
 * ## ❌ 이 파일이 안 하는 것
 *
 * - **차단 판정이 아니다.** 수확 봇 차단은 `worker/middleware/bot-detection.ts` 의
 *   `SCRAPER_UA_PATTERNS` 이고 목적이 반대다(그쪽은 막고 이쪽은 보여 준다). 두 목록을
 *   합치지 말 것 — 2026-08-22 의 차단 결정과 이 노출 결정은 서로 다른 축이다.
 * - **소셜 스크래퍼는 넣지 않는다**(facebookexternalhit·Twitterbot·KakaoTalk …). 그들은
 *   `<head>` 메타만 읽고 본문을 안 쓴다 — 넣으면 공유 미리보기 한 번에 첫 화면 조립 비용만 든다.
 */
import { isMobileUserAgent } from '../detail-hero-image'

/**
 * 본문을 색인하는 검색 크롤러(JS 를 안 돌리거나 돌려도 정적 HTML 을 먼저 읽는 쪽).
 *
 * ⚠️ `Yeti\//` 처럼 **구분자까지** 앵커한 것은 의도다 — 맨 `Yeti` 는 다른 제품명에도 섞인다.
 * ⚠️ AI 크롤러도 넣는다: 지금은 Cloudflare 엣지가 일부를 403 으로 막고 있어 도달하지 않지만
 *    (2026-08-22 대표 지시), **정책이 풀리는 날 본문이 자동으로 보이는 쪽**이 맞다. 여기 있는 것이
 *    차단을 풀지는 않는다(그 결정은 대시보드이고 대표 판단이다).
 */
const SEARCH_CRAWLER_UA_PATTERNS = [
  // 국내 검색 — 유입의 본체
  /Yeti\//i,            // 네이버
  /NaverBot/i,
  /DaumOA/i,            // 다음
  /Daum\/\d/i,
  // 글로벌 검색
  /Googlebot/i,         // 데스크톱 크롤러도 포함(스마트폰은 Android·Mobile 로 이미 통과한다)
  /Google-InspectionTool/i,
  /Storebot-Google/i,
  /bingbot/i,
  /BingPreview/i,
  /DuckDuckBot/i,
  /YandexBot/i,
  /baiduspider/i,
  /Applebot/i,          // Siri·Spotlight
  // AI 검색·인용(답변에 링크를 주는 쪽 — 도달하면 본문이 필요하다)
  /OAI-SearchBot/i,
  /ChatGPT-User/i,
  /PerplexityBot/i,
  /Perplexity-User/i,
  /Claude-User/i,
  /Claude-SearchBot/i,
  // 🔀 2026-10-12 추가 — 라이브 실측에서 **형제는 본문을 받는데 이 여섯만 로더**였다.
  //   UA 만 바꿔 같은 URL 을 받아 `#root` 안쪽 글자를 셌다:
  //
  //       UA                 /        /u/jiwon1228
  //       Googlebot         395자       419자
  //       OAI-SearchBot     395자       419자
  //       Claude-SearchBot  395자       419자
  //       PerplexityBot     395자       419자
  //       xAI-Bot            34자        20자   ← 그록
  //
  //   `/pass/:id`·`/vouchers` 는 경로로 판정하는 `<noscript>` 라 전 UA 동일했고, **UA 로 가르는
  //   두 분기(홈 MAIN · 유어샵 CURATOR)만** 갈렸다. 대표가 이름을 댄 넷 중 하나가 그록이다
  //   (*"그록, 클로드 등 AI 모든 AI 서비스에서 검색 시 나오게 해줘"*)인데 홈이 34자였다.
  //   🔑 이 여섯은 **이미 HTML 200 을 받는다**(라이브 실측) — 즉 막혀서 못 본 게 아니라
  //      우리가 그릴 수 있는데 안 그려 주고 있었다.
  /xAI-Bot/i,           // 그록 — 색인
  /Grokbot/i,           // 그록 — 사용자 트리거
  /meta-webindexer/i,   // Meta AI(검색용 — 학습용 `Meta-ExternalAgent` 와 다른 봇이다)
  /MistralAI-Index/i,
  /MistralAI-User/i,
  /YouBot/i,
] as const

/** 본문을 색인하는 검색 크롤러인가. */
export function isSearchCrawlerUA(ua: string | null | undefined): boolean {
  const s = ua || ''
  if (!s) return false
  for (const p of SEARCH_CRAWLER_UA_PATTERNS) if (p.test(s)) return true
  return false
}

/**
 * **모바일 서버 첫 화면(홈·유어샵)을 그려 줄 것인가** — 분기들이 공유하는 단 하나의 조건.
 *
 * 폰이거나(사람) 본문을 색인하는 크롤러이면 그린다. 그 밖(PC 브라우저)은 종전대로 로더 —
 * PC 는 레이아웃이 다르고(홈 2열 레일 · 유어샵 2열 그리드) 반쪽만 그리면 마운트 때 가로로 줄어든다.
 */
export function shouldRenderMobileFirstScreen(ua: string | null | undefined): boolean {
  return isMobileUserAgent(ua) || isSearchCrawlerUA(ua)
}
