# 2026-10-11 — 크롤러가 우리 본문을 보게 (네이버 본문 · 브랜드 이름 · 이용권 매장 엔티티)

대표 지시: *"머지해줘. **네이버도 해주고.** 그리고 SEO, GEO 모두 가장 이상적인 형태인지 알아봐줄래? 우리 서비스로
트래픽이 몰려야해"* → *"언제나 최상단에 노출이 될 수 있게끔 세계최고의 SEO, GEO를 자랑하게 만들어줘"* →
*"특히 이용권 페이지들은 더욱"* → (구글 SERP 스크린샷 2장) *"저렇게 야놀자처럼 나타나는거 코드로 개선할 수 있어?"*

> ⚠️ 제가 대표에게 먼저 분명히 말한 것: **"언제나 최상단"은 어떤 SEO 로도 보장할 수 없습니다**(경쟁·도메인 나이·
> 콘텐츠 양이 정합니다). 보장할 수 있는 것은 **우리 쪽 결함을 0 으로 만드는 것**이고, 이 세션이 한 일이 그것입니다.

## 다음 세션의 첫 액션 — 배포 뒤 1분이면 재는 것

```bash
UA_YETI='Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)'
for p in / /u/jiwon1228 /pass/2915 /vouchers/2192; do
  n=$(curl -sS -A "$UA_YETI" "https://urdeal.kr$p" \
      | sed -e 's/<script[^>]*>.*<\/script>//g' -e 's/<[^>]*>/ /g' \
      | tr -s ' \n' ' ' | wc -c)
  echo "$p  본문 ${n}자"
done
```
**판정**: 네 경로 전부 **수백 자 이상**이면 통과(배포 전 실측은 `/` 6자 · `/u/:handle` 6자 · `/pass/:id` 49자 ·
`/vouchers/:id` 37자였다). 그리고 홈에서 `grep -o '"@type":"WebSite"[^}]*name":"[^"]*"'` 가 **유어딜**을 돌려줘야 한다.

⚠️ **그 뒤 E4 는 우리가 못 잰다** — 색인은 수일~수주 걸리고 판정 화면(**서치콘솔 · 네이버 서치어드바이저**)은
**대표만** 볼 수 있다. 위 curl 은 *"우리가 줄 것을 주고 있는가"* 까지만 판정한다.

## 완료분 (이 브랜치, PR 미머지)

| | 무엇 | 왜 |
|---|---|---|
| ① | `shared/seo/crawler-ua.ts` 신규 — `shouldRenderMobileFirstScreen` = **폰 ∪ 검색 크롤러** | 서버 첫 화면이 `isMobileUserAgent` 뒤에 있었고 **Yeti UA 엔 `Mobi\|Android\|iPhone` 이 하나도 없다** |
| ② | `worker/utils/crawler-noscript.ts` 신규 — `<noscript>` 본문 요약 | 첫 화면은 [사진·제목]까지만 그린다(의도) → 크롤러에겐 "내용 없는 페이지" |
| ③ | `shared/seo/brand-jsonld.ts` 신규 — 홈 `Organization`+`WebSite` | 구글이 사이트 이름을 **`urdeal.kr`**(도메인)로 쓰고 있었다 |
| ④ | `detail-ssr-meta.ts` — 매장을 **독립 `LocalBusiness` 엔티티**로 + `offers.availableAtOrFrom` | `address`·`geo` 가 `Product` 안이라 **구글이 버린다** → 로컬 신호가 한 번도 전달된 적 없음 |
| ⑤ | `aggregateRating` 을 리뷰 있을 때만 | 0건에 `ratingValue: 0` 은 구글 정책 위반 + 0점짜리로 읽힌다 |

가드 `src/tests/unit/seo-crawler-visibility-2026-10-11.test.ts` 20건 + 주입 15건(`scripts/mutations/seo-crawler-visibility.mjs`)
**되돌려-검증 전부 빨간불 확인**. tsc 0 · 관련 가드 5파일 122건 pass.

## 이번에 틀렸던 판단 (이게 제일 값지다)

1. **"GEO = 0" 이라고 보고하려 했다.** 대표가 보내 준 스크린샷에 **구글 AI 개요가 유어딜을 정확히 설명하고 있었다.**
   AI 개요는 **Googlebot 색인**으로 만들어지므로 GPTBot 차단과 무관하다. 막힌 것은 ChatGPT·Claude·Perplexity 쪽뿐이다.
   ⇒ *"AI 크롤러가 막혔다"* 에서 *"AI 검색 전부가 안 된다"* 로 번역하면 틀린다.
2. **주입을 주석에 심어 헛돌았다.** `/** Yeti… */` 로 결함을 심었는데 `readCode` 가 주석을 걷어내 단언이 못 봤다
   (이 레포가 반복해 밟은 자리). **판정 대상은 코드다** — 술어의 정규식 자체에 심어야 빨간불이 난다.
3. **핀 구조를 중첩으로 가정했다.** `pins[].product.name` 으로 썼는데 SSOT(`CuratorSeedPin`)는 **평평하다**
   (`pins[].product_name`). 중첩으로 읽으면 전부 `undefined` 가 되는데 **에러가 안 나고 `<noscript>` 가 조용히 빈다.**
   시드 모양은 기억이 아니라 타입에서 가져올 것.
4. **`isScraperUA` 가 미배선이라고 단정했다** — grep 에 테스트만 잡혀서였다. 실제로는 `scrapeProtection` 안에서 쓰이고
   그 미들웨어는 마운트돼 있다(단 `/api/products`·`/api/group-buy/*` 세 접두어에만).

## 남은 결정 / 대기 (대표 판단)

- **🔴 AI 크롤러 정책** — GPTBot·ClaudeBot 이 **Cloudflare 엣지에서 403**(우리 코드 아님: `server: cloudflare`,
  25바이트 응답, 워커 헤더 0). 2026-08-22 대표 *"크롤링도 마찬가지"* 의 결과이고, **학습 크롤러와 검색·인용 크롤러가
  구분되지 않은 채** 함께 막혀 있다. 되돌리면 ChatGPT·Perplexity 가 유어딜을 인용할 수 있다. **대시보드는 대표 소관**이고
  세션은 플랫폼 쓰기를 하지 않는다 ⇒ 결재함 항목.
- **다국어** — `hreflang` **0건** · 서버 HTML `<html lang="ko">` 고정 · `og:locale` `ko_KR` 하나 · 언어별 URL 없음.
  클라 i18n 6개 언어는 **JS 뒤에 바뀌므로 색인되지 않는다.** 인바운드 관광 수요를 노리려면 `/en/pass/:id` 식 URL 체계가
  필요하고 라우팅·사이트맵·캐시키·SSR 시드까지 닿는 **큰 변경**이다. 한국어 색인이 먼저 서야 한다는 것이 제 의견.
- **사이트링크(야놀자의 6줄)** — **신청 수단이 없다.** 구글 자동 선정이고 `SearchAction` 검색창 사이트링크는 2024-11
  지원 종료. 코드로 되는 둘(파비콘 #1704 · 사이트 이름 이번 PR)은 끝냈다. 앱 설치 카드는 앱이 있어야 한다.
- **남은 점검** — 목록 표면 `BreadcrumbList` · `llms.txt`(현재 404) · sitemap/canonical 커버리지 전수.

## 못 한 것 · 범위 밖

- **PC(lg+) 첫 화면은 그대로다** — 크롤러는 모바일 HTML 을 받는 것이 정상(Dynamic Serving)이고, PC 사용자 응답은
  byte-동일이다.
- `<noscript>` 는 **첫 화면이 안 그리는 것만** 담는다. 안내 문구를 지어내 넣지 말 것(클로킹이 된다 — 그 규율이
  `crawler-noscript.ts` 머리말에 있다).
