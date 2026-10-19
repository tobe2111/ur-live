# 2026-10-19 — 홈 LCP 앞당기기 · 숙소 목록 서버 첫 화면 · 배너 옆 장 미루기 · 숙소 대표색 중복

대표 지시: *"모두 개선해줘. 특히 홈 부분이 처음 등장할테니까 최대한 신경써서 우선적으로 개선해줘."*
(직전: 9개 화면을 느린 4G · CPU 4배로 재서 보고했다 — 빠름: 유어샵·교환권·이용권 상세 /
보통: 홈 LCP 2.0~3.1초 · 숙소 상세 · 블로그 / 느림: 숙소 목록 FCP 2.8초·LCP 3.0~5.2초 · 지도)

서비스: **유어딜(소비자)** 단독. 머니 경로 **없음**. 잠금 파일 `src/worker/index.ts` 접촉(`[UNLOCK_LOADING]`, 대표 승인 범위 "모두 개선").

## 한 것

1. **LCP 사진을 응답 헤더(Link)로 미리받기** — 홈 맨 위 배너 · 교환권 머리 배너 · 이용권 상세 히어로 · 숙소 상세 히어로.
   - 홈 배너 `<img>` 는 본문에 있어 인라인 CSS 47KB·카드 preload 뒤에야 발견됐다(실측 출발 1,819ms, 앱 CSS 는 헤더라 1,524ms).
   - 주소는 **각 서버 첫 화면이 `<img src>` 에 쓰는 같은 함수**에서 받는다(`worker/utils/lcp-image-link.ts`). 한 글자만 달라도 preload 가 버려지고 같은 사진을 두 번 받는다 → 시험이 빌더 출력과 문자열 대조.
   - 서버 첫 화면을 **실제로 그렸을 때만** 싣는다. 숙소 상세는 폰 UA 에서만(PC 는 다른 폭).
   - 가드 `lcp-image-link-2026-10-19.test.ts` 17건 + 주입 5건(`LCP헤더`).
2. **숙소 목록(`/stays`) 서버 첫 화면** — [상단 바 3줄 + 첫 큐레이션 줄(제목 + 가로 카드)] + 짧은 로더.
   - 클래스·큐레이션 규칙 SSOT `src/shared/stays-list.ts`(화면·워커가 같이 import). 카드는 홈 첫 화면과 같은 `cardHtml`.
   - 시드 `__SSR_INITIAL_STAYS__`(`/api/group-buy/stays/search?{defaultStaysQs()}` — 화면 첫 검색과 byte-일치), 화면은 `readStaysSeed` 로 **기본 질의일 때만 · 한 번만** 첫 렌더에 쓴다.
   - CSS 먼저 적용 표면에 `/stays` 추가 + 첫 화면 CSS ROOTS 에 모듈 추가(재생성).
   - 박스 대조(아이폰 13, 라이브 시드, 라이트·다크): 상단 바 `[0,0,390,145]` · h2 `[16,161,358,20]` · 첫 칸 `[0,193,243,249]` · 사진 `[0,193,243,183]` · 같은 사진 주소 — 전부 동일.
   - 아이콘은 같은 크기 빈 칸만(두 벌 금지). 큐레이션 줄이 없으면 '' → 종전 로더(무회귀). PC 는 안 그린다.
   - 가드 `stays-first-screen-2026-10-19.test.ts` 15건 + 주입 5건(`숙소첫화면`). 낡은 앵커 셋 재조준(stay-curations 2 · 인라인 1), 시험 셋 재조준(css-first-boot ⑤·⑤-2 · stay-curations · urshop-card-unify ④).
3. **홈 배너 2·3장 사진을 load 뒤로** — 가로 캐러셀 안 `loading="lazy"` 가 옆 장을 첫 화면과 같이 받았다(장당 ~45KB). `runAfterLoad` 뒤 + 손이 닿거나 자동 넘김 1.5초 전에 즉시 받는다.
4. **숙소 대표색 중복 POST** — 검색 응답에 `dominant_color` 가 없어 새 브라우저마다 숙소 전부의 색을 다시 뽑아 POST(2회 배치)했다. SELECT 에 추가 + 카드에 전달.
   - 가드 `home-banner-defer-stays-color-2026-10-19.test.tsx` + 주입 4건(`배너미루기`·`숙소대표색`).

## 다음 세션의 첫 액션 (E4 — 배포 후, 아이폰 UA)

```bash
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
curl -sSI -A "$UA" https://urdeal.kr/ | grep -i '^link:'          # cdn-cgi 배너 주소 + fetchpriority=high 가 있어야 한다
curl -sS  -A "$UA" https://urdeal.kr/stays | grep -c 'ur-first-screen\|__SSR_INITIAL_STAYS__'   # 2 이상
curl -sSI -A "$UA" https://urdeal.kr/pass/2919 | grep -i '^link:'   # 히어로
```
- 그리고 브라우저 실측(스크래치 하네스 `lcp.mjs`·`wf.mjs` 방식): 홈 배너 출발이 ~1.8초에서 당겨졌는지 · `/stays` FCP/LCP 가 ~3초에서 내려갔는지 · 홈에서 배너 2·3장이 load 전에 안 나가는지 · `/stays` 에 `dominant-color` POST 가 0 인지(이미 값이 있는 숙소).

## 이번에 틀렸던 판단

- 🩸 **#1929 의 사진 Link 헤더가 배포 후 한 번도 실리지 않았다**(E4 에서 발견, 14:00 KST). `appendLcpLink` 가 `,` 를 금지했는데
  cfImage 주소는 옵션을 쉼표로 잇는다 → 실제 값은 전부 버려졌다. 시험 픽스처가 옵션 하나짜리(`width=1100`)라 초록이었고,
  심지어 `'/a,b.jpg'` 를 "버린다" 쪽에 넣어 결함을 고정하고 있었다. #1934 에서 쉼표 허용 + **진짜 빌더 출력**으로 시험
  (Chromium 이 `<…,…>` 를 그대로 받는 것도 로컬 서버로 확인). ⇒ **값 검증 시험의 픽스처는 손으로 짓지 말고 실제 생성 함수로.**

- 처음 A/B 를 "A 는 라우팅 안 함, B 는 라우팅" 으로 쟀다 — 라우팅(fulfill)된 응답은 회선 흉내를 안 탄다. 둘 다 라우팅하니 차이가 잡음이 됐다 ⇒ **판정은 폭포(출발 시각)로** 했다.
- 숙소 상세 LCP ~3~4초를 "서버 히어로 ≠ 마운트 슬라이드" 로 의심했는데 같은 사진이었다 — React 마운트 때 LCP 가 재귀속되는 것(실제 지연 아님).
- 숙소 목록 첫 화면을 catch-all `else` 안 삼항으로 넣었다가 `check-loader-continuity` 가 잡았다 → 별도 `else if` 로.
- "대표색 POST 2회" 를 중복 호출로 봤는데 실제로는 **응답에 값이 없어서** 생긴 일이었다(보고 자체는 상품당 1회로 막혀 있다).

## 2차 — 지도·블로그 (대표 "지도랑 블로그도 상세히 진행해줘")

5. **블로그 상세·목록 서버 첫 화면** — 종전 서버 본문은 꾸밈 없는 크롤러용 HTML 이라 앱 CSS 를 기다렸다 그려지고 React 가 뜨면 통째로 바뀌었다. 이제 React 와 **같은 클래스 상수**(`shared/blog-page.ts`)로 그린다(`worker/utils/blog-detail-first-screen.ts`·`blog-list-first-screen.ts`, 폰 UA·크롤러만). 본문 마크다운은 `blogMarkdownHtml` 이 `BlogMarkdown` 과 같은 블록 규칙으로 문자열을 만든다(시험이 DOM 트리 대조). 목록은 첫 쪽 밖 글 링크를 `<noscript>` 로 유지. `/blog`·`/blog/:slug` 를 CSS 먼저 표면에 추가 + 첫 화면 CSS ROOTS 에 두 모듈. 박스 대조(라이트·다크, 아이폰13) 전부 일치.
   - 가드 `blog-detail-first-screen-2026-10-19.test.tsx` + 주입 9건. 커밋 `241bd87`·`1d8035f`.
6. **표면 청크 미리받기 상한 10 → 16** — 지도·이용권 상세·유어샵·검색·지역이 잘려 SiteFooter 등이 페이지 실행 뒤 직렬로 받아졌다(지도 실측 3.05s). 넘으면 빌드가 이름을 대며 경고.
7. **지도 시드 새로고침을 타일 뒤로** — 시드로 목록을 그린 직후 같은 page1 을 다시 받아(3.6s) 지도 타일(4.0~7.8s)과 회선을 나눠 썼다. 시드가 있으면 지도는 `ur:map-tiles-loaded` 뒤(백스톱 8초), 그 밖은 load·한가할 때. 시드가 없으면 즉시.
   - 가드 `map-seed-refresh-deferred-2026-10-19.test.ts` + 주입 3건, 옛 인라인 주입 1건 재조준.

8. **로그인 전 유어샵 탭(`/u/me`) 밀림 CLS 0.39 → 자리 예약** — 예시 진열대가 인기 이용권 응답 뒤에 생기며 혜택·가입 버튼을 425px 밀었다. 같은 `DealRow` 3줄을 `invisible` 로 세운다. 가드 `guest-urshop-reserve-2026-10-19.test.tsx` + 주입 3건.
9. **PC 교환권 인기 브랜드 줄 밀림 CLS 0.037 → 자리 예약** — 폰엔 `BrandStripReserve` 가 있었는데 PC(우측 그리드 위)는 없었다. 같은 클래스 상수 `PC_BRAND` 로 예약(`VouchersPage` 잠금 — 예약 한 줄 + 클래스 상수화). 가드 `top-chrome-reserve` ④ + 주입 2건.
   - 같은 실측에서 다른 주요 화면 11곳(폰)·6곳(PC) CLS 는 전부 0.002 이하 — 밀림은 이 둘뿐이었다.

### 2차 E4 (배포 후)
- `curl -A "$UA" https://urdeal.kr/blog/<slug> | grep -c ur-first-screen` → 1, `/blog` 도 1.
- 폭포: `/map` 에서 `/api/group-buy/products` 가 타일 **뒤**에 한 번만 나가는지 · SiteFooter 류 청크가 HTML 직후 modulepreload 로 출발하는지.

## 남은 것

- 지도 시트 서버 첫 화면 — 안 했다. CSS 먼저는 첫 화면 없이 지도에 걸면 나빠졌다(10-12 실측)라 첫 화면과 짝으로만 가능. 별건.
- 지도 타일 9장(41~73KB)이 LCP — 화질 유지 규칙상 줄이지 않는다.
