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
3. **마이 색인 밖 화면 18개** (라우트 69개 중 마이 색인·판매 메뉴에서 직접 열 수 있는 것 37개, 로그인/가입/콜백·파라미터 화면 제외):
   `consignment` · `reviews` · `products/new` · `products/quick` · `returns` · `operators` · `store` · `operating` ·
   `youtube-growth` · `stays/new` · `guide` · `mini-shop` · `promo-codes` · `followers` · `promo-spend` ·
   `experience-campaigns` · `proxy-products` · `plus-friend-guide`
   — 일부는 다른 화면 안 버튼으로 닿을 수 있다(예: 상품 목록 → 등록). 하나씩 확인해 색인에 넣거나 "죽은 화면" 으로 판정한다.

## 순서

1. ⬜ 18개 화면을 하나씩 판정 → 마이 색인(`useSellerNavModel` / `AllToolsSheet`)에 넣거나 폐기 후보로.
2. ⬜ 에이전시 콘솔에서 맡은 매장의 판매 화면을 **마이와 같은 시트**로 연다(`ToolPageSheet` 재사용, 좌석 토큰은 그대로).
3. ⬜ 모든 단독 `/seller/*` 주소 → `/user/profile?tool=<경로>` (마이가 그 시트를 바로 연다). 에이전시 좌석은 에이전시 콘솔로.
4. ⬜ 껍데기 삭제 + 번들 실측 → 예산 하향. `SellerLayout` 은 시트 안 임베드 모드만 남긴다.

각 단계는 화면 동작이 바뀌므로 하나씩 브라우저로 확인하고 가드를 함께 넣는다.
