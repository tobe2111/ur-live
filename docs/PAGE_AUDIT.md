# 전체 페이지 감사 (358개) — 2026-05-31

자동 스캔 (데이터페칭/순차쿼리/로딩·에러 상태/God파일). score 높을수록 우선.

## 요약
- 총 358 | manual-fetch 228 | multi-get≥3 48 | no-loading 24 | no-error 9 | god 9

## 🔴 유저 대면 우선 (로딩 체감 직결)
- GroupBuyDetailPage.tsx (score 5) [manual-fetch, multi-get(4), god(889)]
- CheckoutPage.tsx (score 4) [manual-fetch, multi-get(5)]
- SellerPublicPage.tsx (score 4) [manual-fetch, multi-get(5)]
- GroupBuyListPage.tsx (score 3) [manual-fetch, god(952)]
- GroupBuyTermsPage.tsx (score 3) []
- MyGroupBuysPage.tsx (score 3) [manual-fetch, multi-get(4)]
- MyVouchersPage.tsx (score 3) [manual-fetch, god(849)]
- ProductDetailPage.tsx (score 3) [manual-fetch, god(863)]
- GroupBuyConfirmPaymentPage.tsx (score 2) [manual-fetch, no-loading]
- LiveListPage.tsx (score 2) [manual-fetch, multi-get(3)]
- LivePageV2.tsx (score 2) [manual-fetch, multi-get(3)]
- VouchersPage.tsx (score 2) [manual-fetch, multi-get(3)]

## 🟡 내부(admin/agency/seller) 우선
- SellerSettlementsPage.tsx (score 13) [manual-fetch, multi-get(12), god(1215)]
- SellerLiveBroadcastPage.tsx (score 11) [manual-fetch, multi-get(10), god(906)]
- AdminKtAlphaPage.tsx (score 7) [manual-fetch, multi-get(6), god(1104)]
- AdminPage.tsx (score 7) [manual-fetch, multi-get(8)]
- SellerPage.tsx (score 6) [manual-fetch, multi-get(7)]
- AboutPage.tsx (score 5) [god(849)]
- InfluencerDashboardPage.tsx (score 4) [manual-fetch, multi-get(5)]
- SellerBusinessInfoPage.tsx (score 4) [manual-fetch, multi-get(3), god(846)]
- SellerInventoryPage.tsx (score 4) [manual-fetch, multi-get(5)]
- SellerOverlayPage.tsx (score 4) [manual-fetch, multi-get(4), no-loading]
- product-detail/ProductReviews.tsx (score 4) [manual-fetch, multi-get(4), no-loading]
- AccountDeletedPage.tsx (score 3) []
- AccountSettingsPage.tsx (score 3) []
- AdminAgencyPage.tsx (score 3) [manual-fetch, multi-get(4)]
- AdminOrdersPage.tsx (score 3) [manual-fetch, multi-get(4)]
- AdminProspectsPage.tsx (score 3) [manual-fetch, no-error]
- AdminReplayPage.tsx (score 3) [manual-fetch, multi-get(4)]
- AdminRevenueAnalyticsPage.tsx (score 3) [manual-fetch, multi-get(4)]
- AdminSettlementPage.tsx (score 3) [manual-fetch, multi-get(4)]
- AdminVoucherTransactionsPage.tsx (score 3) [manual-fetch, multi-get(4)]
- AgencyGroupBuyPage.tsx (score 3) [manual-fetch, multi-get(4)]
- AgencyGuidePage.tsx (score 3) []
- AgencyIntroducedStoresPage.tsx (score 3) [manual-fetch, multi-get(4)]
- AgencyPartnerLandingPage.tsx (score 3) []
- AgencyStatsPage.tsx (score 3) [manual-fetch, multi-get(4)]
- BusinessLandingPage.tsx (score 3) []
- FAQPage.tsx (score 3) []
- GDPRPage.tsx (score 3) []
- InfluencerLandingPage.tsx (score 3) []
- InfluencerTermsPage.tsx (score 3) []
- JoinChoicePage.tsx (score 3) []
- MainHomePage.tsx (score 3) [RQ, no-loading, no-error]
- MealVouchersPage.tsx (score 3) []
- MyDealHistoryPage.tsx (score 3) [manual-fetch, no-error]
- MyLedgerPage.tsx (score 3) [manual-fetch, no-error]
- NotFoundPage.tsx (score 3) []
- PaymentFailPage.tsx (score 3) []
- PrivacyPolicyPage.tsx (score 3) []
- ReferralIndexPage.tsx (score 3) []
- RefundPolicyPage.tsx (score 3) []

## ✅ RQ 적용됨(이상적 데이터페칭)
MainHomePage.tsx, AdminAdSlotsPage.tsx, AdminOpsInsightsPage.tsx, AdminTikTokDiscoveryPage.tsx, AdminAbusePage.tsx, SellerOrdersPage.tsx, main-home/GroupBuyFeed.tsx
