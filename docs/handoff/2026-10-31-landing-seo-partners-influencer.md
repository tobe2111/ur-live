# 2026-10-31 대외 랜딩 SEO·GEO — /partners · /influencer

## 대표 지시
- "urdeal.kr/partners (사장님향 랜딩페이지) · urdeal.kr/influencer (인플루언서향 랜딩페이지) 이것들도 SEO, GEO 세팅 빡세게 해줘."

## 실측 (라이브 · 작업 전 · Googlebot·Yeti·OAI-SearchBot 셋 다 같은 결과)
| | 본문 | a태그 | JSON-LD | FAQ |
|---|---|---|---|---|
| /partners | 252자 | 0 | 브랜드·빵부스러기·WebPage | 화면에만 8개(서버 HTML 0) |
| /influencer | 256자 | 0 | 같음 | 화면에도 없음 |

메타·canonical·robots(index)·빵부스러기·sitemap 제출은 이미 멀쩡했다. 비어 있던 것은 인용할 Q&A · 구조화 신호 · 내부 링크.
그리고 `/partners` FAQ 의 답은 `{open && <p>}` 라 접혀 있으면 DOM 에서 지워져 렌더하는 크롤러도 못 봤다.

## 한 것
1. **FAQ SSOT** `src/shared/landing-faq.ts` — `PARTNER_FAQ`(PartnerFaq.tsx 에서 문장 그대로 이동, 요율은 `PARTNER_FACTS`) · `REFERRAL_FAQ`(신설 8개 — 답의 사실은 그 페이지가 이미 말하던 것 + 2026-10-16 대표 확정 "소개비는 매장 부담").
2. **화면**: PartnerFaq 가 SSOT 를 그리고 `<details>` 로(접혀도 답이 DOM 에) · /influencer 에 "자주 묻는 것" 섹션 신설(같은 배열, `<details>`) · 히어로 배지의 ✨ 이모지 제거.
3. **워커** `src/worker/utils/landing-seo.ts`(crawler-noscript 599줄·consumer-surfaces 600줄이 상한이라 판정을 여기로):
   - 크롤러 본문 `<dl>` 에 Q&A 전부 + 헤더에 실제로 있는 링크(partners: `/`·`/about` · influencer: `/`·`/partners`)
   - JSON-LD: 두 랜딩 `FAQPage` + /partners `Service`(대상 `BusinessAudience`, provider `#organization`)
4. **surface-copy** 문장 확장(화면 소스에 실재하는 문장만 — 가드가 대조): partners 장점·비교·도구 9줄 · influencer 세 단계 5줄.
5. **메타**: partners 제목 `가게 홍보, 손님이 온 다음에만 비용 - 매장 입점 안내` · 설명에 "식당·카페·미용실·숙소 사장님" + 0원 항목 / influencer 제목 `블로그·인스타로 동네 가게 소개하고 수익 받기` · 설명 104자. **사람을 신분(인플루언서)으로 부르지 않고 활동 이름으로 검색어를 받는다**(명칭 SSOT).
6. 가드 `landing-seo-2026-10-31.test.ts` + 주입 `scripts/mutations/landing-seo-2026-10-31.mjs` 6건 · 기존 두 시험 재조준(FAQ 문장이 SSOT 로 옮겨가서 R2·R3·실적수치 검사가 그 파일도 보게 — 불변식 그대로).

## 다음 세션 첫 액션 (E4)
```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
for p in partners influencer; do curl -sS -A "$UA" https://urdeal.kr/$p | grep -c '"FAQPage"'; done   # 각 1
```
본문 글자수(태그 제거) 252·256 → 1,000+ · `<a href>` 0 → 2 · /partners 에 `"Service"` + `BusinessAudience`.
그리고 **사람 화면**: 두 페이지 FAQ 가 펼쳐지는지(`<details>`), 다크에서 글자 보이는지.

## 틀렸던 판단 / 주의
- 구글은 2023-08 부터 FAQ 리치결과를 정부·의료 사이트에만 보여 준다. `FAQPage` 는 리치결과용이 아니라 Bing·네이버·AI 검색이 Q&A 를 읽게 하는 것(GEO).
- 처음에 크롤러 링크로 `/agency-partner` 를 넣으려 했다 — 그 경로는 SEO 표·sitemap 에 없어 뺐다. 화면에 있는 링크라도 색인 대상이 아니면 넣지 않는다.

## 2차 (대표 "모두 해줘")
1. **정직 고지 숫자 갱신** — D1 재측정(2026-10-31): is_active=1 · deal_only=0 · 이용권 4종 = **165건**, 그중 실제 매장 **2건**(2915 홍대돈까스 · 2919 달빛한스푼). 날짜를 둘로 갈랐다: `catalogMeasuredAt`(2026-10-31, 정직 고지) · `liveMeasuredAt`(2026-10-12 그대로 — 덱이 인플루언서 DB·소개 적립 문장의 기준일로도 써서, 다시 안 센 숫자에 새 날짜가 붙는 것을 막는다). `partners-facts.ts` ↔ `deck-common.mjs` 둘 다, 상인회 덱 PPTX·PDF 재생성(글자 diff = 그 문장 + 줄바꿈 2곳뿐, Noto Sans CJK 로 옛 판과 같은 글꼴).
2. **/creators ↔ /influencer 잠식 해소** — /creators 제목 `1기 소개 파트너 모집 - 지원 안내`(모집·지원 의도), /influencer 는 방법·수익. /influencer 헤더에 `1기 모집` 링크(화면에 실재 → 크롤러 링크에도). 푸터 3곳 `크리에이터 모집` → `소개 파트너 모집`(명칭 SSOT).
3. **/map 클라 제목을 서버와 같은 SSOT 로** — 서버는 `내 주변 동네딜 지도…` 인데 JS 렌더 뒤엔 `맛집 지도` 였다.
4. **`/life/request/<없는 키>` → 404**(`known-routes.ts`, 화면과 같은 `categoryDef`). 실재 업종 전부 통과 시험 + 반대 방향 주입.
5. **IndexNow 엔진별 직접 제출** — 공유 중계 `api.indexnow.org` 가 429 면 전부 막혔다 → 네이버(`searchadvisor.naver.com/indexnow`)·빙에 각각, **하나라도 받으면 성공**. 하트비트에 엔진별 상태.

## 구글 사이트링크(모두싸인처럼 묶음) 관련 판정
- 사이트링크는 신청 수단이 없다. 조건은 *브랜드 검색에서 홈이 1위* + 구조 신호. 지금 "유어딜" 1위가 홈 제목이 아니라 **/map 제목**(`내 주변 동네딜 지도…`)을 달고 나온다. 서버(Googlebot UA)는 홈·/map 둘 다 제 제목·제 canonical 을 낸다(실측).
- 대표 확인 필요: 서치콘솔 URL 검사 → `https://urdeal.kr/` 와 `https://urdeal.kr/map` 의 **"Google이 선택한 표준"** · 홈 "색인 생성 요청".

## 남은 것
- 두 페이지 공유 그림이 사이트 공통 `og-image.png` 다. 전용 카드가 필요하면 별건.
- 다른 덱 4개는 정직 고지 숫자를 안 쓴다(상인회 덱만) — 재생성 불필요.

## 함께 들어간 것 (커밋 차단 해소)
- `follow-redirects` override `^1.16.1` → `^1.16.2`(lockfile 1.16.2) — 새 advisory GHSA-mrwp-f3q8-3g9p(high)가 pre-commit·CI npm audit 게이트를 막았다. axios 의 전이 의존성, semver 패치.

## 3차 — main 병합(#2045 `/influencer` 단일화와 충돌 해소)
같은 날 다른 세션이 대표 *"인플루언서용은 하나로 통일하자. /influencer 이걸로"* 로 `/influencer` 가 `CreatorsPage` 를
띄우게 하고 `InfluencerLandingPage` 를 지웠다(`/creators` 는 301). 그래서 위 2차 ②(**/creators↔/influencer 잠식 해소**)는
**무효가 됐고 main 쪽을 택했다** — `/creators` 제목·`1기 모집` 링크·크롤러 링크 `/creators` 전부 제거, 푸터는 `/influencer`.
- `/influencer` 의 FAQ(`REFERRAL_FAQ`)는 **새 화면(`CreatorsPage`) 끝에 '자주 묻는 것' 으로 붙였다** — 안 붙이면 `FAQPage` 만
  남아 화면에 없는 Q&A 를 선언하게 된다(내용-스키마 불일치).
- 줄 부품을 `src/pages/landing/FaqItem.tsx` 하나로 모았다(main 의 `ur-collapse` 모양 — 접혀도 답이 DOM 에 있다). `PartnerFaq`·`CreatorsPage` 가 같이 쓴다.
- `/influencer` 크롤러 링크 = 그 화면에 실재하는 `/` · `/about` · `/partners`.
- PartnerFaq 는 main 의 움직임 판 + SSOT 배열 + `catalogMeasuredAt`.
- 🩸 **CI 빨간불 원인(병합 전)**: 지도 화면이 제목을 글자로 직접 적게 되면서 `restaurantMap.seoTitle` 을 부르는 소비자 코드가 0이 됐고,
  그 zh 키를 앵커로 쓰던 주입(`🎬 라이브 문구가 다른 언어로만 되살아난다`)이 헛돌았다 → 온보딩 zh 키로 재조준.
- 다음 E4 의 `/creators 제목` 항목은 삭제 — 대신 `/creators` → `/influencer` 301 과 `/influencer` FAQPage 를 본다.
