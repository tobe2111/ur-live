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

1. 🟡 화면 판정 — 위 분류 완료(2026-10-11). 남은 것: 진입점 없는 둘(consignment · plus-friend-guide)의 처리.
2. ⬜ 에이전시 콘솔에서 맡은 매장의 판매 화면을 **마이와 같은 시트**로 연다(`ToolPageSheet` 재사용, 좌석 토큰은 그대로).
3. ⬜ 모든 단독 `/seller/*` 주소 → `/user/profile?tool=<경로>` (마이가 그 시트를 바로 연다). 에이전시 좌석은 에이전시 콘솔로.
4. ⬜ 껍데기 삭제 + 번들 실측 → 예산 하향. `SellerLayout` 은 시트 안 임베드 모드만 남긴다.

각 단계는 화면 동작이 바뀌므로 하나씩 브라우저로 확인하고 가드를 함께 넣는다.
