# 2026-10-18 화면별 무게 예산 — 10개 상한 밖을 못 보던 구멍

## 무엇이 문제였나
`check-surface-budgets` 가 손님 화면의 봉투를 **route-chunk-map**(워커 미리받기 맵)에서 읽었다. 그 맵은 head 링크 스팸을
막으려고 js 를 **10개(`MAX_LINKS`)에서 자른다** ⇒ 11번째부터는 무게 예산에서도 안 보였다.
- #1912 에서 stayDetail 이 **아무것도 안 늘었는데 +6.0KB** 로 빨간불(다른 봉투 하나가 사라져 11번째였던 `lz-vouchers` 가 상한 안으로 들어옴).
- 반대 방향이 더 나빴다 — 11번째 뒤로 30KB 가 붙어도 초록.

## 고친 것
- 손님 화면도 대시보드처럼 **매니페스트 정적 폐쇄**로 잰다(`routeSurfacesFrom` = `closureSurfacesFrom(…, '')`, 상한 없음).
- 맵은 **대조**에만 쓴다 — `mapSubsetErrors`: 맵의 js 가 폐쇄의 부분집합이 아니면 실패(생성기·측정기가 다른 진입점을 읽는 것 차단).
- 기준 재잠금(코드 변화 0, 사유 기록). 드러난 숨은 무게:
  | 화면 | 종전 | 정정 | 숨어 있던 것 |
  |---|---|---|---|
  | cart | 233.3 | 266.4 | **lz-gbDetail 16.2**(이용권 상세 코드!) · embla 6.5 · lz-productL 3.7 · app-cart 3.7 |
  | guestMy | 224.1 | 249.7 | embla 6.5 · app-utils-deferred 6.4 · lz-product 5.6 · lz-productL 3.7 |
  | stayDetail | 222.0 | 229.9 | lz-home-homePc-vouchers 5.8 |
- 시험 ④ 4건 + 주입 3건(되돌려-검증 8/8 빨간불).

## 다음 세션 첫 액션
**장바구니가 이용권 상세 코드 16KB 와 캐러셀(embla) 6.5KB 를 첫 화면에 정적으로 받는다.** `CartPage` 의 정적 import 폐쇄에서
`lz-gbDetail`·`embla` 를 끌고 오는 모듈을 찾아(`dist/client/.vite/manifest.json` 의 imports 를 거꾸로 따라간다) lazy 로 내릴 수 있는지 볼 것.
guestMy(로그아웃 마이)도 embla·상품 상세 봉투를 받는다 — 같은 원인일 가능성. 줄이면 `--rebaseline`(개선 잠금).

## 이번에 틀렸던 판단
- 처음엔 이 구멍을 "#1912 의 측정 착시" 로만 봤다. 정정해 보니 **실제 화면 셋이 25~33KB 를 숨기고 있었다** — 착시가 아니라 가드의 눈먼 자리였다.

---

## 2차 (같은 날) — 장바구니·로그아웃 마이 다이어트
**원인**: 작은 공용 부품 하나(`components/mall/*`·`shared/mall/origin`·`DealMiniCard`·lucide `minus`) 때문에
그것이 들어 있던 봉투(app-components ~70KB + 그 봉투가 끌고 오는 embla·상품 상세 봉투)를 **통째로** 받았다.
- `vite.config.ts` `CROSS_MODULES` → 좁은 전용 봉투 **`app-cross`**(묶음기 `LIBRARY_ENVELOPES` 에도 등록 — 안 그러면 다시 페이지 봉투로 옮겨진다)
- `CartPage` 옵션 모달 lazy(열 때만) · `voucher-checkout` 의 `pay-summary`·`toss-key-type` 을 결제 버튼 뒤 동적 import

| 화면 | 전 | 후 |
|---|---|---|
| cart | 266.4 | **195.5** |
| guestMy | 249.7 | **197.3** |
| dash:admin | 304.9 | 300.3 |
| dash:agency | 306.5 | 301.8 |
| product | 193.5 | 194.8 (+1.3, 허용 안) |
critical-chunks 14 불변 · chunk-cycles 0 · exec-cost 10화면 예산 안(전부 소폭 감소).

**버린 길 셋**(다시 시도하지 말 것): ① 장바구니를 ROUTES 에 넣어 묶음기 사용자로 세기 → `lz-browse-vouchers ↔ lz-common` 순환
② 화면 밖 공용 모듈을 `lz-outside` 하나로 → 43KB 봉투가 생겨 오히려 증가 ③ app-cross 에 유틸 9개 → 손님 상세 화면 +2.9 ⇒ **4개로 좁혔다.**
가드 `cross-envelope-2026-10-18.test.ts` + 주입 4건(되돌려-검증 4/4 빨간불).

**다음 후보**: `guestMy` 197 · `stayDetail` 229.9 — stayDetail 의 `lz-home-homePc-vouchers` 5.8KB 를 누가 끌고 오는지 같은 방법(manifest imports 역추적)으로.

### ✅ E4 판정 통과 (배포 후 라이브, 머지 `8f9fa8a75`)
배포 전·후 같은 방법으로 라이브 `CartPage` 청크의 정적 import 를 셌다(배포 버전 `index-C4axmEgX` → `index-C3dGMd1A`).
- 정적 import **29 → 17**. 사라진 것: `app-components` · `lz-gbDetail` · `embla` · `lz-product` · `lz-productL` · `radix-ui` · `app-ui-utils` · `lz-boot-*` 3 · `lz-gbDetail-*` 3 — 생긴 것: `app-cross`
- 반대 방향(기능 유지): `app-components`(옵션 모달)·`lz-gbDetail`(결제 유틸)·`tosspayments` 는 **동적 import 로 남아 있다** — 쓰는 순간 받는다.
- `/cart`·`/user/profile`·`/` 200. 헤드리스 렌더에서 장바구니가 받은 JS 17개 중 위 봉투 0개.
- ⚠️ 못 잰 것: 이 컨테이너 브라우저는 라이브 자산을 간헐로 못 받아 청크 자가복구로 튄다(`/user/profile` 이 그랬다) — 화면 렌더 판정은 PR CI 의 render-smoke 에 기댄다. 옵션 변경·결제 버튼을 실제로 눌러 보는 것은 로그인·장바구니가 필요해 못 했다.

---

## 3차 (같은 날) — 숙소 상세 230.2 → 205.8KB (−24.4)
**원인**: `stay-detail/amenity-meta.tsx` 가 편의시설 아이콘 열한 개(lucide)를 정적으로 불렀고, 그 아이콘 파일들이
교환권(`lz-vouchers` 6.0)·홈(`lz-home-homePc-vouchers` 5.8)·공용 `lucide`(10.4) 봉투에 흩어져 있어서 **셋을 통째로** 받았다.
본문의 `Hotel`(사진 대체)·`TicketPercent`(추천 할인)도 공용 lucide 를 끌었다.
- 판정(키워드 → 종류)은 `amenityKind()` 로 그대로 두고(순서 불변), 그림만 `AmenityIcon` lazy + 같은 크기 fallback
- `Hotel` → `StayLineIcon`, `TicketPercent` → `CouponIcon`(유어딜 세트 — 디자인 규칙과도 맞다)
- 렌더 확인(하네스 + 라이브 응답 스텁): 시설 아이콘 6종 정상, 사진 없을 때 침대 아이콘.
- critical-chunks 14 불변 · 청크 순환 0 · 다른 화면 ±0.4 이하 감소. 가드 `stay-detail-first-screen-2026-10-18.test.ts` 19건 + 주입 4건(4/4 빨간불).

**다음 후보**: `search` 223.6 (지도 봉투 `lz-map`·`app-kakao-sdk`·`lucide` 를 정적으로 받는다 — 검색 결과 지도 보기 때문인지 같은 방법으로).
- 🩸 **이번에 틀린 것**: 첫 판에서 편의시설 아이콘을 객체 지도로 모았더니 `consumer-icon-system` 래칫이 154 → 141 로 "줄었다" — 래칫이 `<Icon` JSX 만 세서 **못 보게 된** 것이었다. 기준도 안 내려 CI 주입이 빨간불(여덟 번째). JSX `switch` 로 되돌려 정직한 값 152 로 잠갔다.

## 4차 — #1920 E4 와 그 뒤처리 (2026-10-19)

- **E4 (머지 `2873d5a36`, 배포 후 라이브)**: `/stays/2887` 의 `StayDetailPage-BB3n8vOC.js` 정적 import 에서
  `lucide`(일반)·`lz-vouchers`·`lz-home-homePc-vouchers` **0건**, `AmenityIcon` 은 동적 import. 페이지·아이콘 청크 200.
- 🩸 **그런데 절반만 끝났었다**: Vite 미리받기 지도(`__vite__mapDeps`)를 보니 그 lazy 청크가
  `lucide-BxP95RIU`·`lz-vouchers`·`lz-browse-vouchers`·`lz-linkshop1-vouchers`·`lz-home-homePc-vouchers`(gzip ~28KB)를
  의존으로 달고 있었다 — 첫 화면에서 빠졌을 뿐 **아이콘이 그려지는 순간 뒤에서 받는다**. 첫 화면 예산 래칫은 정적 폐쇄만
  보므로 이걸 못 본다. ⇒ **lazy 로 뗐으면 그 청크의 `__vite__mapDeps` 까지 볼 것.**
- 버린 길: 아이콘 일곱을 고정 묶음(`app-stay-amenity`)으로 빼 봤더니 `lz-vouchers` 가 그 묶음을 정적으로 끌고 오고,
  묶음은 다시 `lz-home-homePc-vouchers`(Flame)를 끌고 왔다. 남이 쓰는 모듈을 옮기면 남이 따라온다.
- 처방: `stay-detail/AmenityIcon.tsx` 가 열두 그림을 **파일 안에서** 그린다(외부 import 0, 획 1.6). lazy 청크 gzip **1.0KB**,
  의존은 이미 받은 `react-core` 하나. 아이콘 래칫 152 → **141**(실제로 걷은 11건). 가드: 같은 시험 +1 · 주입 +1(5건 빨간불 확인).
- E4(다음): 배포 후 `StayDetailPage-*.js` 의 `import("./AmenityIcon-…")` mapDeps 가 `react-core` 하나인지.

## 5차 — 검색 216.9 → 172.6 (2026-10-19)

- 원인(모듈 그래프 덤프 `edges4.tsv`): 검색은 지도의 결과 한 줄(`RestaurantRow`)·`prefetch-detail`·`utils`·`CatIcon`(5.2KB)만 쓰는데
  그 넷이 `lz-map`(br 18.9)에 있어 지도 봉투 → `lz-home-homePc-map`·`app-ui-utils`·`app-kakao-sdk`·`lz-boot-gbDetailL-map-productL` 까지 받았다.
  인기 검색어 머리 `TrendingUp`(0.4KB) 하나가 `lucide` 봉투(10.2)를 끌었다.
- 처방: 넷을 고정 묶음 `app-map-row`(LIBRARY_ENVELOPES) — 넷의 의존이 전부 첫 화면에 이미 있는 청크라 남을 안 끈다(옮기기 전에 확인).
  `TrendingUp` → `ChartIcon`. 아이콘 래칫 141 → 139. 지도 +0.8(요청 1개, 래칫 안).
  🩸 그 요청 1개를 `surface-chunk-runtime`(PR 게이트 아님)이 잡았다 — 지도 28 → **29개**. 바이트 래칫은 안에 있었는데
  개수 래칫은 따로 센다(두 래칫은 다른 이야기를 한다). 의도된 대가라 기준만 29 로 올렸다(다른 화면은 안 내렸다 — 로컬 측정이 CI 와 다를 수 있다).
- 가드 `search-first-screen-2026-10-19.test.ts` 5건 + 주입 4건 빨간불 확인. `cross-envelope` 주입 앵커 재조준(보호 목록 문자열이 바뀜).
- 남은 후보(정적 폐쇄 brotli): 지역 198.4(홈 봉투 넷 ~26KB — 홈 피드 재사용이라 정당성 먼저 볼 것) · 장바구니 187.6 · 숙소 목록 181.1 ·
  로그아웃 마이 189.4 · 마이 216.0 의 `lucide` 10.2(아이콘 1~2개가 끄는지 같은 방법으로) · 대시보드 둘(293·295).
- ✅ 머지 `ef79f1bf1`(#1926). E4(다음): 라이브 `/search` 하드로드의 modulepreload 에 `lz-map-*` 이 없고 `app-map-row-*` 가 있는지.

## 6차 — 장바구니·숙소 목록·로그아웃 마이의 lucide 봉투 (2026-10-19)

- 원인: 셸·홈·PC 목록 밖 lucide 아이콘을 **하나라도** 쓰면 `lucide` 봉투(br 10.2) 전체가 그 화면에 실린다.
  장바구니 `PackageCheck`(합배송)·`ImageOff`(상품 사진 없음) · 숙소 목록 `Calendar`·`CalendarDays` · 로그아웃 마이 `Globe`(언어)·`Monitor`·`Sun`·`Moon`(테마) — 일곱이 전부였다.
- 처방: 뜻 아이콘은 유어딜 세트(`BoxIcon`·`BagIcon`), 세트에 없는 넷(달력·지구본·모니터/해/달)은 **그 파일 안에서** 그렸다(24 그리드 · 획 1.6).
  세트에 새로 넣지 않은 이유: 세트 모듈을 쓰는 다른 화면이 그 그림까지 받는다(4차 편의시설 아이콘과 같은 판단).
- 실측(brotli 첫 화면): 장바구니 187.2 → **177.4** · 숙소 목록 180.6 → **171.0** · 로그아웃 마이 189.0 → **179.4**. 예산 재잠금, 청크 개수 래칫 6화면 통과(변화 0).
  아이콘 래칫 139 → **132**.
- 🩸 마이(판매자, `dash:my`)는 이 처방이 안 먹는다 — `ThemeToggle` 이 아니라 `app-seller-nav` 청크가 `lucide` 를 import 한다.
  `SellerSection` 의 `Plus` 를 바꿔 봤는데 효과 0 이라 되돌렸다. 다음 후보는 그 청크의 어떤 모듈이 lucide 이름을 쓰는지 덤프로 찾는 것.
- 가드 `lucide-drag-first-screen-2026-10-19.test.ts` 14건 + 주입 4건 빨간불 확인.
