# 셀러 대시보드 제거 — 판매 일은 전부 마이에서 (2026-10-11)

대표: *"셀러 대시보드를 없애는 것을 목표로 하고 마이에서 모두 다 할 수 있게. 이후에 셀러 대시보드를 없애서 용량확보"*
(앞서 2026-09-26 *"드물게 하는 일도 일단 마이로 하고, 대시보드는 쓸 필요없게끔 하자"*)

## 지금 상태 (2026-10-11 실측)

- 판매 화면은 **이미 마이 시트에서 열린다** — `ToolPageSheet` 가 `MemoryRouter` 안에 실제 라우트 표(`SellerRoutes()`)를
  넣는다. 화면 파일은 대시보드와 **같은 것**이다(복제 0).
- 그래서 지울 대상은 **대시보드 껍데기**뿐이다: `/seller` 첫 화면(`SellerPage` + `seller-page/*`), 더보기(`SellerMorePage`),
  옆 메뉴·아래 탭(`SellerLayout` 의 단독 표시 부분, `SellerBottomTabs`, `SellerGroupTabs`), 단독 `/seller/*` 주소.
- **용량**: 껍데기는 약 40~50 KB(raw, 대시보드 전용 — 손님은 원래 안 받는다). 같은 날 이미 확보한 것:
  Sentry −302 KB · 손님 번역 −195 KB · 차트 −380 KB. ⇒ 대시보드 제거의 가치는 **용량보다 단순함**(한 곳·코드 감소)이다.
- ✅ 2026-10-11: 카카오 사장님이 `/seller` 첫 화면으로 오면 마이로 보낸다(`SellerPage.tsx` `shouldSendOwnerToMy`).

## 막는 것

1. **에이전시 직원** — 이메일 로그인이라 마이가 없다. 지금은 `/seller` 가 유일한 작업 화면이다.
2. **이미 나간 링크** — 알림톡·메일·외부 콜백이 `/seller/...` 를 가리킨다. 지운 뒤에도 그 화면이 열려야 한다.
3. **마이 색인 밖 화면** — 🩸 처음에 "18개"라고 적었는데 **틀렸다.** 마이 '전체 도구'(`AllToolsSheet`)는
   `useSellerNavModel().commandItems` 를 그대로 쓰고, 그 색인은 메뉴(`NAV_GROUPS`) + **탭 형제(`SELLER_TAB_GROUPS`)**
   + 검색 전용(`SELLER_SEARCH_ONLY`)의 합이다. 탭 형제를 빠뜨리고 셌다. 실측(tsx 로 색인을 직접 뽑음):
   - ✅ **이미 마이 색인에 있다 (9)**: `returns` · `reviews` · `operators` · `store` · `operating` · `guide` ·
     `followers` · `promo-spend` · `proxy-products`
   - ↪️ **다른 화면 안 버튼으로 닿는다 (4)** — 시트가 실제 라우트 표를 렌더하므로 그대로 열린다:
     `products/new`·`products/quick`(상품 목록) · `stays/new`(숙소) · `mini-shop`(업체 정보)
   - 🌙 **기능 플래그로 꺼져 있다 (2)**: `promo-codes`(`SELLER_COUPONS_HIDDEN`) · `experience-campaigns`(`SELLER_DORMANT_HIDDEN`)
   - 🔗 **외부에서 들어오는 주소 (1)**: `youtube-growth`(OAuth 복귀) — 3단계 리다이렉트가 받아야 한다
   - 🪦 **앱 안 진입점 없음 (2)**: `consignment`(가이드 문구만 언급, API·크론은 살아 있다) ·
     `plus-friend-guide`(유일한 링크가 `SellerOnboardingChecklist` 인데 **그 컴포넌트를 렌더하는 곳이 0** — 실측)
   ⇒ **1단계의 실제 남은 일은 작다**: 진입점 없는 둘을 색인에 넣을지 지울지. 진짜 일은 2·3단계다.

## 순서

1. ✅(E2, 2026-10-12) 화면 판정 — 진입점 없던 둘 정리: `consignment` 은 이미 은퇴(2026-09-28 결재 — 리다이렉트, API 는 보존) ·
   `plus-friend-guide` 는 검색 전용 색인(`SELLER_SEARCH_ONLY`)에 넣어 마이 '전체 도구'·⌘K 로 닿게 했다(화면은 살아 있고 알림톡 수신에 필요).
2. ✅(E2) 에이전시 콘솔에서 맡은 매장의 판매 화면을 **마이와 같은 시트**로 연다 — 2026-10-12 대표 확정 **안 A**
   (*"A안으로 해줘. 이건 PC버전도 중요해"*). `AgencyStorePlate`(마이 판과 같은 클래스 — 시험이 짝을 대조) +
   `ToolPageSheet`·`AllToolsSheet` 재사용. PC 는 [맡은 매장 목록 | 판] 두 칸, `/agency` 를 소비자 액자에서 제외.
   오늘 숫자는 `/api/agency-console/stores` 에 실려 와 좌석 없이 보이고, 좌석은 도구를 누를 때만 받는다(직원 id 까지 대조).
   정산은 보기만(출금은 사장님). **대시보드로 보내는 [운영하기] 는 없앴다.**
   남은 전체화면 길: 사용처리(`/seller/scan`) · 전체 도구의 시트 불가 화면 — 둘은 아직 대시보드 껍데기 안에서 뜬다(4단계 전 정리).
3. ✅(E2) 모든 단독 `/seller/*` 주소 → `/user/profile?tool=<경로>` (마이가 그 시트를 바로 연다). 에이전시 좌석은 에이전시 콘솔로.
   - ✅ **카카오 사장님 몫 완료(2026-10-12)** — 판정 `src/lib/seller-deep-link.ts`, 보내는 곳 `SellerLayout`(시트 안 반환 뒤),
     받는 곳 `useToolDeepLink`(판매 구역) + `useToolDeepLinkFallback`(페이지). 홈·대시보드·더보기 → 마이 첫 화면.
   - 남기는 길: 에이전시 좌석 · 마이 없는 옛 계정 · `?from=my`/세션 표시(마이가 일부러 보낸 전체화면) ·
     `FULL_SCREEN_ONLY` 둘 · `/seller/youtube/callback`(OAuth) · `?dash=1`(마이가 못 열어 되돌린 것 — 왕복 0).
   - 좌석이 안 맞으면 **토큰을 발급하지 않고** 대시보드로 되돌린다(마이를 여는 것만으로 좌석을 바꾸지 않는다는 기존 규칙).
   - 브라우저 확인: `/seller/orders` → 마이 + '주문 관리' 시트 · `/seller` → 마이 · `/seller/scan` → 대시보드 그대로.
   - ✅(E2) 에이전시 좌석의 깊은 링크 — `consoleRedirectFor` 로 `/agency?tool=<경로>` (2026-10-12). 콘솔 로그인이 이 브라우저에
     살아 있을 때만 보낸다(없으면 로그인 뒤 링크를 잃는다). 콘솔은 **이 직원의 그 매장 좌석**일 때만 시트를 열고(새로 발급 안 함),
     아니면 `dash=1` 로 대시보드에 되돌린다. 콘솔이 연 전체화면도 `dash=1` 을 달아 다시 콘솔로 튕기지 않는다.
4. ✅(E2, 2026-10-12) **틀 얇게** — 대표 결정 "남겨 두기"(숨김 화면은 지우지 않는다, 틀만). 단독 대시보드에서 사이드바(PC)·하단 탭 다섯(폰)을
   걷어내고 머리줄 하나 [매장·제목 · 검색 · 알림 · 전체 메뉴] 만 남겼다. 메뉴는 `/seller/more` 가 허브(이용권 등록 · 홈/주문/이용권/정산 ·
   나머지 · 계정 — 목록은 `useSellerNavModel` 그대로). `SellerLayout` 395→254줄, `SellerBottomTabs` 삭제, `.ur-seller-nav-active` 제거.
   남긴 배선: 깊은 링크 리다이렉트 · 토큰 자동 갱신 · 도매 전용 바운스 · 귀환/좌석 띠 · 승인 배너 · 묶음 탭 · ⌘K · 상담 FAB.
   동반 수리: `SellerBottomBar` 가 사라진 탭 높이(60px)만큼 떠 있던 것(마이 시트 안에서도 떠 있었다) → 바닥(safe-area)에.
   ⚠️ 번들 감소는 작다(틀 소스 ~10KB) — 이 단계의 값은 용량이 아니라 "대시보드라는 두 번째 앱" 을 없앤 것이다.
   ⬜ 남은 것: 페이지 53개의 `<SellerLayout>` 래퍼는 그대로(얇은 틀이 받는다) · 숨김 화면 보존.

각 단계는 화면 동작이 바뀌므로 하나씩 브라우저로 확인하고 가드를 함께 넣는다.

### 4단계 선행 (2026-10-12)
- ✅(E2) 판매 알림 받은편지함을 마이로 — `/api/seller/my-stores/notifications`(사람 기준) + '내 가게' 머리의 종. 에이전시 콘솔도 ✅ — `/api/agency-console/notifications` + `AgencyNotificationsSheet`(#1718).
- 실측: 껍데기 소스 ~50KB · 닿지 않는 화면 14개 146KB raw(예산의 ~2%). 껍데기 삭제 차단 요인 = 페이지 53개의 `<SellerLayout>` 래퍼 · 껍데기 안 리다이렉트/토큰 갱신 · 테스트 11개.
