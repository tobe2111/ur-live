# 2026-11-09 첫 로딩 때 홈이 맨 위로 튀던 것

대표 신고: *"첫 로딩에 홈페이지 부분에서 아래부분은 뒤늦게 로딩이 되는데 로딩 되면 맨 윗페이지로 올라가버려."*

> 📦 **§1~§33(첫 마운트 스크롤 튐 · 검은 화면 · HSTS · 로더 즉시 표시 · PC 첫 화면들)은 `docs/handoff/archive/2026-11-09-first-load-scroll-jump-part1.md` 로 옮겼다** — 필요하면 grep. 아래는 §34 부터.

## 34. [E4] #2278 · #2279 배포 뒤 판정(PC 1440px · 4G · CPU 4배) + 브랜치 재기동
- **#2278 PC 상세 `/pass/2919`**: 요청 목록에 `width=960`(폰 히어로) **없음** — 1280 폭 한 장만 받는다(종전엔 숨긴 채 수백 KB 추가). LCP 1,300ms(HTML 681 → 사진), 그 회차 TTFB 641.
- **#2279 로그인 전 탭 PC**: `/my-vouchers` FCP **1,020 · 628ms**(종전 2,690) · CLS 0.0029 / `/user/profile` FCP **828 · 464ms**(종전 3,170) · LCP 1,004 · 632 · CLS 0.0014. 액자 가로 밀림 0(남은 0.001~0.003 은 3.7s 에 하단 칩 줄 — 첫 화면 밖, 종전에도 있던 것).
- 🔎 **남은 것 하나**: `/my-vouchers` PC 의 LCP 가 **3.4~3.7s** — 서버가 그린 제목(696ms, 7,399px²)보다 React 가 마운트한 **예시 사진**(`GUEST_EXAMPLE_IMG.cafe` `wallet-brunch.webp` 7.7KB, 7,709px²)이 아주 조금 커서 LCP 가 그 사진으로 넘어간다. 폰에선 사진이 작아 제목이 LCP 다. 처방 후보: 게스트 첫 화면 서버 본문에 예시 줄(`GuestExampleRows`)까지 그리기, 또는 최소한 그 사진 `<link rel=preload>`. 다음 작업.
- 🩸 브랜치: 지정 브랜치의 원격이 머지 뒤 자동 삭제돼 `checkout -B … origin/main` 으로 다시 세웠다. `push --delete` 는 분류기가 막는다 — 원격이 남아 있으면 삭제 대신 `origin/main` 을 머지해 올린다(이번엔 원격이 없어 새 브랜치로 올라갔다).

## 35. 검색 `/search` 서버 첫 화면 (대표 "계속 최적화")
- 폰 공개 화면 열 곳을 다시 재서 고른 다음 표면: 홈·교환권·블로그·둘러보기는 0.7~0.8s, **검색 2.25 · 장바구니 2.1 · 알림 1.7 · about 2.6 · faq 2.9s**(로더-먼저만). 유입 통계(funnel)엔 `/pass` 만 있어 노출 경로로 골랐다 — 검색은 홈 머리에서 한 번에 간다.
- 기록 `docs/locks/loading/2026-11-10-search-first-screen.md`. 🩸 한 줄 분기 꼬리 주석 뒤에 코드를 붙여 **통째로 주석**이 된 것을 주입 검사가 잡았다(tsc·텍스트 시험은 초록).
- 다음 후보: `/faq`(2.9s · 전부 고정 문구 — `CONCEPT_FAQ` 공유 배열로 질문 목록까지 서버가 그릴 수 있다) · `/about`(2.6s) · `/cart`·`/notifications`(로그인 필요 — 게스트 분기와 비슷한 가드가 필요).
- 배포 뒤 판정: `vitals_nocb.cjs https://urdeal.kr/search`(종전 FCP 2,252) · `… pc` · 검색어 있는 `/search?q=돈가스`.

## 36. [E4] #2283 검색 서버 첫 화면 배포 뒤 판정(폰 4G·CPU 4배 / PC 1440px)
- `/search`(검색어 없음) 폰: FCP **544ms** · LCP 688(유달이, 0.66s) · CLS 0 — 종전 FCP 2,252. 다른 회차 FCP 1,720 은 TTFB 가 늦은 회차(HTML 이 늦으면 그만큼 밀린다 — 서버 몫이 아니라 회선, §34·결재 참조).
- `/search?q=돈가스` 폰: FCP **1,016**(헤더가 먼저) · LCP 3,700(결과 목록 — API 뒤, 종전과 같은 구조) · CLS 0.
- PC: FCP **464** · LCP 636 · CLS 0.0027(액자·네비 예약 효과 — 가로 밀림 0).
- 남은 것: 검색어 있는 화면의 결과(LCP 3.7s)는 서버가 결과 API 를 self-fetch 해야 줄어든다(새 캐시 키 + 질의별이라 예열 불가 — 지금은 안 한다).

## 37. 자주 묻는 질문 `/faq` 서버 첫 화면 (대표 "계속 최적화")
- 기록 `docs/locks/loading/2026-11-10-faq-first-screen.md`. 화면 전체가 고정 문구라 **전부** 그린다(답변 본문만 뺀다 — 모션 CSS 전엔 펼쳐 보인다).
- 🔑 `SubPageHeader` 클래스를 `shared/sub-page-head.ts` 로 옮겼다 — 마이 아래 하위 화면(찜·쿠폰·리뷰·숙소·탈퇴…)이 같은 머리줄을 쓰므로 **다음 하위 화면 첫 화면은 `subPageHeadHtml(title)` 한 줄**로 머리줄을 얻는다.
- 다음 후보: `/about`(2.6s · 소개 랜딩, 풀폭) · `/cart`·`/notifications`(로그인 필요 — 게스트와 반대로 **세션 있을 때만** 그릴 껍데기).
- 배포 뒤 판정: `vitals_nocb.cjs https://urdeal.kr/faq`(종전 FCP 2,880) · `… pc`.

## 38. [E4] #2285 자주 묻는 질문 서버 첫 화면 배포 뒤 판정(폰 4G·CPU 4배 / PC 1440px)
- `/faq` 폰: FCP = LCP **704 · 740 · 808 · 1,016ms**(종전 FCP 2,880 · LCP 2,880) · CLS 0. 한 회차 2,212 는 TTFB 가 늦은 회차(회선). 검색(0.54s)보다 0.2s 느린 건 HTML 이 크다(질문 13줄 + 표면 CSS 34KB) — 전부 첫 화면 내용이라 그대로 둔다.
- PC: FCP = LCP **1,124ms** · CLS 0.0015(액자·네비 예약 — 가로 밀림 0).
- 긴 작업(TBT) 폰 219~783ms 는 앱 마운트 비용으로 종전과 같은 구조(서버 첫 화면은 그걸 가릴 뿐 줄이지 않는다).

## 39. 알림 `/notifications` 서버 첫 화면 — 세션 쿠키가 있을 때만 (대표 "계속 최적화")
- 기록 `docs/locks/loading/2026-11-10-notifications-first-screen.md`. 가드 방향이 게스트 탭과 **반대**(`authed`). 공용 머리줄을 `utils/sub-page-head-html.ts` 로 빼서 FAQ·알림이 같이 쓴다(`wide` 인자).
- 🔴 E4 는 이 컨테이너가 못 잰다(소비자 세션 쿠키가 없다 — 비로그인 요청은 종전과 byte-동일한 로더). 판정은 ① 대표 폰 실측 또는 ② 월요일 RUM 표본(`vitals:…:FCP:/notifications`) 으로.
- 다음 후보: `/cart`(비로그인도 접근 — 머리줄 + 빈 장바구니/로더) · `/about`(2.6s, 랜딩 — 모션 부품이 많아 서버 그림과 앱 첫 프레임을 맞추기 어렵다, 후순위).

## 40. 장바구니 `/cart` 서버 첫 화면 — 머리줄 + 로더 (대표 "계속 최적화")
- 기록 `docs/locks/loading/2026-11-10-cart-first-screen.md`. 로딩 분기(흰 바탕 + 전체 로더)도 완성 화면과 같은 뿌리 + 머리줄로 맞췄다(서버 그림 → 로딩 → 완성이 한 모양).
- 🧭 "첫 화면 없는 표면" 예시를 쓰는 시험·주입이 `/search` → `/cart` → `/checkout` 으로 두 번 밀렸다. 다음엔 처음부터 `/checkout`(로그인 필요 + 결제 — 서버 첫 화면을 둘 일이 없다)을 예시로 쓸 것.
- 배포 뒤 판정: `vitals_nocb.cjs https://urdeal.kr/cart`(종전 FCP 2,100) · `… pc`.

## 41. [E4] #2288 장바구니 서버 첫 화면 배포 뒤 판정(폰 4G·CPU 4배 / PC 1440px)
- `/cart` 폰(비로그인·빈 장바구니): FCP **408 · 472 · 496ms**(종전 2,100) · CLS 0. 한 회차 1,060 은 TTFB 가 늦은 회차.
- LCP 는 **2.0~2.5s 그대로** — 가장 큰 요소가 빈 장바구니 안내 문장(`EmptyCart`, API 응답 뒤)이라 서버 머리줄이 LCP 가 아니다. 비로그인의 장바구니는 사실상 늘 비어 있으므로 **세션 쿠키가 없을 때 서버가 빈 장바구니 안내까지 그리면** LCP 도 0.5s 대가 된다(로그인 사용자는 API 가 와야 안다 — 지금처럼 머리줄만). 다음 PR 후보.
- PC: FCP **424** · LCP 2,028 · CLS 0.0002.

## 42. 장바구니 후속 — 비로그인은 빈 장바구니까지 서버가(로더 없음)
- §41 의 LCP 2.0~2.5s(빈 장바구니 안내가 API 뒤) 처방. `buildCartFirstScreen(…, authed)` — 세션 없음 → 머리줄 + `EmptyCart` 모양, 있음 → 머리줄 + 로더. 기록은 `2026-11-10-cart-first-screen.md` 후속 절.
- 배포 뒤 판정: 비로그인 `lcpel.cjs https://urdeal.kr/cart` 의 LCP 요소가 서버가 그린 안내 문장(≈FCP)인지 · PC 도.

## 43. 대외 안내 랜딩 셋 서버 첫 화면 — 머리줄 + 사진 칸 (대표 "계속 최적화")
- 기록 `docs/locks/loading/2026-11-10-landing-first-screen.md`. 🔑 사진은 preload 로 0.8s 에 와 있었는데 LCP 3.2~4.7s — "받는 것" 과 "그리는 것" 은 다르다. 제목·문장은 승인된 마스크 모션이라 일부러 안 그린다(사진이 LCP 라 충분하다).
- §34 의 PC 이용권 탭 예시 사진(LCP 3.4s)은 **하지 않기로** — 예시 줄이 스크롤 등장 모션(`ur-gp-shelf`, 2026-11-04 대표 *"모션그래픽 제대로 넣어줘"*)이라 서버가 그리면 그 모션을 꺼야 하고, 사용자가 보는 내용은 이미 0.7s 에 떠 있다(측정 라벨만 바뀐다).
- 배포 뒤 판정: `lcpel.cjs https://urdeal.kr/about`(LCP 요소가 서버 사진 · ≈0.8s) · `/partners` · `/influencer` · PC.

## 44. 장바구니 정정 — 비로그인은 로그인 안내 화면(§42 의 오판) + 검색 결과 시드
- 🩸 **이번에 틀렸던 판단**: 비로그인 장바구니를 "API 401 → 빈 장바구니" 로 추론해 `EmptyCart` 를 서버가 그렸다. 라이브 LCP 요소는 '장바구니를 이용하려면 로그인해 주세요'(로그인 안내 화면, `CartPage` `!loggedIn` 분기). 그 사이 바탕·문장이 통째로 바뀌는 깜빡임이 있었다 → 로그인 안내 화면 전체로 정정(`CART_GUEST_CLS`). 기록은 `2026-11-10-cart-first-screen.md` 정정 절.
- 🌱 검색 결과 시드: `/search?q=` 의 LCP 3.7s(결과가 앱 부팅 뒤 한 왕복) → 워커가 첫 장(`/api/search?q&page=1&limit=50&scope`, 훅과 같은 경로)을 `__SSR_INITIAL_SEARCH__`(검색어·범위 표식)로 싣고 `useSearchInfinite` 가 initialData 로 쓴다. 마감 700ms(차가운 D1 이 HTML 을 붙잡지 않게). 가드 `search-seed-2026-11-10.test.ts` + 주입 6.
- 배포 뒤 판정: 비로그인 `/cart` LCP 요소 = 서버 안내 문장(≈FCP) · `/search?q=돈가스` LCP(종전 3.7s) · `X-SSR-Status: SEARCH:*`(edge/stale/self/deadline 분포).

## 45. [E4] #2292 안내 랜딩 셋 · #2293 장바구니 정정 + 검색 시드 — 배포 뒤 판정(폰 4G·CPU 4배 / PC 1440px)
- **랜딩 셋**(LCP = 서버가 그린 사진): `/about` 폰 **1,812ms**(HTML 849) · `/partners` **1,748**(HTML 1,033) · `/influencer` **1,264**(HTML 518) — 종전 3.2~4.7s. PC `/about` LCP **880** · CLS 0.0012. 느린 회선 회차에서도 1초대.
- **비로그인 장바구니**: LCP = FCP = 서버 안내 문장 **580ms**(HTML 176) · 느린 회차 1,804(HTML 826) — 종전 LCP 2.0~2.5s(앱 뒤). 오판 정정 뒤 마운트 때 바뀌는 글자 없음.
- **검색 결과 `/search?q=돈가스`**: LCP **2.6~2.8s**(종전 3.7) — 요소가 **첫 줄 썸네일**(`IMG.w-[88px]`, 시드로 마운트 즉시 줄은 그려지고 사진이 그 뒤에 온다). `X-SSR-Status`: 반복 검색어 `SEARCH:edge-hit`(엣지 6ms) · 처음 검색어 `self-fetch-hit` 294~385ms(마감 700ms 안). 다음 처방: 시드의 첫 두 줄 썸네일을 응답 헤더 preload(유어쇼츠 §27 과 같은 방법 — `RestaurantRow` 의 cfImage 폭과 **같은 주소**여야 한다)로 당기면 LCP 가 마운트 시점(≈2.2s)으로.

## 46. 검색 결과 첫 줄 썸네일 preload (대표 "계속 최적화")
- §45 의 다음 처방. 시드의 화면에 보일 앞 4줄(범위 필터는 `SearchPage` 와 같은 판정) 사진을 응답 헤더 `Link: rel=preload`(auto)로. 주소는 줄과 같은 `cfImage(…, ROW_THUMB_OPTS)` — 옵션을 `shared/row-thumb.ts` 로 SSOT(`RestaurantRow` 가 읽는다, 지도 목록도 같은 부품이라 값 불변).
- 잠금표: `worker/index.ts` 한 토막(유어쇼츠 preload 줄 앞, 2672줄 유지) — `[LOADING_ADDITIVE]`. 가드 `search-thumb-preload-2026-11-10.test.ts` + 주입 5.
- 배포 뒤 판정: `lcpel.cjs "https://urdeal.kr/search?q=돈가스"` LCP(종전 2.6~2.8s) · 같은 썸네일 주소가 요청 목록에 **한 번만** 나오는지.

## 47. 홈 `?category=` 통째 밀림(CLS 0.83) — 서버가 전체 홈을 안 그린다 (대표 "계속 최적화")
- 폰 훑기에서 발견: `/?category=meal_voucher`(= `/meal-vouchers` 리다이렉트) **CLS 0.83**. 워커가 쿼리를 안 보고 전체 홈 첫 화면을 그렸고 앱은 카테고리면 편성을 숨긴다. 기록 `docs/locks/loading/2026-11-10-home-category-no-first-screen.md`.
- 처방: `shared/home-query.ts`(`homeCategoryOf`) — 화면 훅과 워커가 같은 목록. 워커 폰 홈 분기에 `&& !homeCategoryOf(url.search)`.
- 배포 뒤 판정: `vitals_nocb.cjs "https://urdeal.kr/?category=meal_voucher"` CLS(종전 0.83) · `/`·`/?sort=newest` 는 첫 화면 그대로인지.
- 같은 훑기의 남은 후보: `/new-openings` CLS 0.75(1.57s 에 목록이 140→220 으로 내려간다) · `/map` LCP 5.5s · 로더만 있는 화면(gb-market 2.9 · partnership 3.0 · privacy 3.0 · terms 2.6 · area-report 2.5 · experience 2.4).

## 48. `/new-openings` 로딩 밀림(CLS 0.75) — 칩 줄·로더 자리 예약
- 원인(rAF 추적): 2.0s 머리글 → 2.3s 응답과 함께 지역 칩 줄(40px)이 끼어들고 로더(작은 칸)가 90장 목록으로 바뀌어 맨 아래 출처 문단이 화면 밖으로. 처방: 응답 전 `mt-5 h-10` 예약 + 로더 `min-h-[100dvh]`. 잠금표 밖. 가드 `new-openings-reserve-2026-11-10.test.ts` + 주입 3.
- 배포 뒤 판정: `vitals_nocb.cjs https://urdeal.kr/new-openings` CLS(종전 0.75).

## 49. 마이 하위 화면 여섯 서버 첫 화면(머리줄 + 로더) — 세션 있을 때만 · 폰만
- 기록 `docs/locks/loading/2026-11-10-my-sub-first-screen.md`. 알림과 같은 방식·같은 CSS 표면. 판정은 RUM(세션 필요 — 이 환경에서 못 잰다).
- 후보로 남긴 것: 알림 첫 화면의 로더가 화면 아래(뿌리 100dvh) · `/wishlist`·`/my-gifticons`(뿌리 `WalletPageWrapper`) · PC.
- `/map` 재측정: FCP 0.69s · LCP 3.6s(요소 = 카카오 지도 바탕 타일) — 지도 SDK 몫이라 손대지 않음.

## 50. [E4] #2296 검색 결과 썸네일 preload — 배포 뒤 판정(폰 4G·CPU 4배, 3회)
- 사진 도착: **0.58 · 1.52 · 2.53s**(종전 2.6~3.9s) · 같은 주소 요청 **1회**(preload 재사용 확인).
- LCP: **2.76 · 3.51 · 3.74s** — **안 줄었다**(종전 2.6~2.8). 요소는 여전히 첫 줄 썸네일인데, 사진이 와 있어도 **줄이 그려지는 시점(앱 마운트)** 이 LCP 를 정한다.
- 🩸 이번에 틀렸던 판단: "사진이 늦게 출발해서 LCP 가 늦다" — 실제 병목은 앱 부팅이었다(랜딩 §43 의 "받는 것 ≠ 그리는 것" 과 같은 클래스인데 다시 밟았다). 다음 처방은 **서버가 결과 줄 자체를 그리는 것**(시드는 이미 있다).

## 51. [E4] #2298 홈 `?category=` — **안 고쳐졌다**(CLS 0.83 그대로) → 진짜 원인 수리
- 배포 뒤 실측(3회): CLS **0.83~1.03 그대로**, 첫 글자는 0.85s → **2.9~3.7s 로 늦어졌다**(서버 그림을 걷었으므로).
- 🩸 **이번에 틀렸던 판단**: "서버가 전체 홈을 그려서 밀린다" — 서버 그림은 증상이었다. rAF 추적: 앱의 **첫 프레임**이 전체 홈(편성 1,728px)을 그리고(`useState('all')`), `useHomeQuerySync` 의 effect 가 다음 프레임에 카테고리로 바꿔 목록이 y 1873 → 145 로 올라온다. 측정기(`shiftdbg`)의 "prev [0,0]" 을 믿고 원인을 추론했다 — **프레임 단위로 직접 봤어야 했다**.
- 처방: `MobileHomePage` 가 `useState(() => homeCategoryOf(location.search) ?? 'all')` 로 첫 렌더부터 읽는다(PC 홈과 같다). 서버가 전체 홈을 안 그리는 것(#2298)은 그대로 맞다(틀린 그림을 안 보여 준다). 가드 재조준 + 주입 1.
- 남은 것: 같은 추적에서 2.8s 에 0.17 짜리 밀림(첫 카드 높이 260 ↔ 141 — 뼈대와 카드의 높이가 다르다) · 그 주소의 첫 글자를 되찾으려면 카테고리 화면의 서버 첫 화면이 필요.
- 배포 뒤 판정: `vitals_nocb.cjs "https://urdeal.kr/?category=meal_voucher"` CLS · `catdbg.cjs` 로 첫 프레임의 `sec` 가 145 인지.

## 52. 검색 결과 줄을 서버가 그린다 — §50 의 다음 처방
- 기록 `docs/locks/loading/2026-11-10-search-results-first-screen.md`. 로컬 렌더와 라이브 앱의 위치가 픽셀 단위로 일치.
- 배포 뒤 판정: `lcpel.cjs "https://urdeal.kr/search?q=돈가스"` LCP(종전 2.8~3.7s) · 마운트 때 줄이 다시 올라오지 않는지(`shiftdbg`·눈) · `X-SSR-Status: SEARCH:deadline` 회차는 종전과 같은지.

## 53. 폰 피드 줄의 화면 밖 높이 추정 260 → 141 (§51 의 남은 밀림 0.17)
- `.ur-cv-grid > *` 의 추정(260px)은 PC 카드 값인데 폰은 줄 목록(141px)이다 — 새로 그려진 줄이 한 프레임 260 으로 잡혔다 줄어든다(rAF 추적: 첫 줄 260 → 141, 2.8s 에 CLS 0.17). `.ur-cv-grid.ur-cv-feedrow`(폰만) 141px. 잠금표 밖(`GroupBuyFeed`·`index.css`). 가드 `progressive-cap-2026-10-13` 재조준 + 주입 2.
- 배포 뒤 판정: `catdbg.cjs "https://urdeal.kr/?category=meal_voucher"` 에서 SHIFT 0.17 이 사라지는지 · 홈 `/` CLS 가 0.0001 그대로인지.

## 54. [E4] #2301 `/new-openings` 배포 뒤 판정 + 홈 카테고리 머리 첫 화면
- `/new-openings` (폰 4G·CPU 4배, 3회): CLS **0.0162**(종전 0.75). 남은 0.016 은 칩 줄 실제 높이와 예약(40px)의 몇 px 차이.
- 홈 `?category=` 머리 첫 화면: 기록 `docs/locks/loading/2026-11-10-home-category-head-first-screen.md`. 배포 뒤 판정: `vitals_nocb.cjs "https://urdeal.kr/?category=meal_voucher"` FCP(종전 2.9~3.7s) · CLS.

## 55. [E4] #2303 배포 뒤 판정(폰 4G·CPU 4배)
- **검색 결과 `/search?q=돈가스`**: LCP **0.80 · 0.83 · 0.87 · 0.89s**(종전 2.8~3.7s) · FCP 0.60~0.66s · CLS 0~0.0001 — 서버가 그린 첫 줄 썸네일이 LCP. 한 회차는 FCP 1.95 · LCP 2.39(HTML 이 늦은 회차).
- **홈 `/?category=meal_voucher`**: CLS **0.0001**(종전 0.83~1.03, 3회 모두) — 앱이 첫 렌더부터 카테고리를 읽는다. 첫 글자는 아직 2.96~3.42s(머리 첫 화면은 #2305).

## 56. [E4] #2305 배포 뒤 판정(폰 4G·CPU 4배) — 홈 `?category=` 마무리
- `/?category=meal_voucher`: 첫 글자 **0.64 · 0.68 · 1.58s**(종전 2.96~3.42s) · LCP 0.89~1.69s · CLS **0.0001**(3회). 처음(#2298 전) 대비: CLS 0.83 → 0.0001, 첫 글자 0.85s 수준 회복.
- 전체 홈 `/`: FCP 0.85 · CLS 0.0001 — 영향 없음.
- 남은 후보: 로더만 있는 화면(gb-market · partnership · privacy · terms · area-report · experience) · 알림 첫 화면의 로더 위치 · `/wishlist`·`/my-gifticons`.
