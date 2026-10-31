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

## 남은 것 (대표 판단)
- `/creators`(제목 "동네 딜 소개하고 수익 받기")와 `/influencer` 가 같은 질의를 다툰다(키워드 잠식). 하나로 합치거나 한쪽을 정본으로 둘지.
- /partners 정직 고지 숫자(2026-10-12 기준 판매 중 359건 · 실제 매장 2곳)가 낡았다 — 지금 판매 중 182건. 덱(`deck-common.mjs`)과 짝이라 함께 갱신해야 한다.
- 두 페이지 공유 그림이 사이트 공통 `og-image.png` 다. 전용 카드가 필요하면 별건.

## 함께 들어간 것 (커밋 차단 해소)
- `follow-redirects` override `^1.16.1` → `^1.16.2`(lockfile 1.16.2) — 새 advisory GHSA-mrwp-f3q8-3g9p(high)가 pre-commit·CI npm audit 게이트를 막았다. axios 의 전이 의존성, semver 패치.
