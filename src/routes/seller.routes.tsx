/**
 * Seller routes — TD-006 분리 (2026-05-06)
 * 공개(register/login/forgot-password) + 보호(Protected) 셀러 페이지 라우트
 */
import { lazy } from 'react'
import { Route, Navigate, useLocation } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ProtectedRoute, PublicRoute } from '@/components/auth/RouteGuards'

const SellerPage = lazy(() => import('@/pages/SellerPage'))
// 📱 2026-09-14: 다섯 번째 탭 '더보기' — 폰에서 사이드바를 대신한다(seller-primary-nav).
const SellerMorePage = lazy(() => import('@/pages/SellerMorePage'))
const SellerLoginPage = lazy(() => import('@/pages/SellerLoginPage')); const SellerRelinkPage = lazy(() => import('@/pages/SellerRelinkPage')) // 🔁 카카오 재연결
// 🏁 2026-07-02 (대표 "B — 단일 퍼널"): 셀러 가입 단일 관문 = /seller/register/supplier.
//   레거시 /seller/register(별도 아이디/비번 독립계정)·/seller/register/business(막다른 안내)는
//   쿼리 보존 리다이렉트로 폐쇄 — 어디서 눌러도 같은 화면(카카오 계정 업그레이드)에 도착.
const SellerRegisterSupplierPage = lazy(() => import('@/pages/SellerRegisterSupplierPage'))

/** 레거시 셀러 가입 경로 → 단일 관문 리다이렉트 (에이전시 ?agency= 등 쿼리 보존). */
function LegacySellerRegisterRedirect() {
  const location = useLocation()
  return <Navigate to={{ pathname: '/seller/register/supplier', search: location.search }} replace />
}
const SellerWaitingPage = lazy(() => import('@/pages/SellerWaitingPage'))
const SellerTikTokCallbackPage = lazy(() => import('@/pages/SellerTikTokCallbackPage'))
const SellerForgotPasswordPage = lazy(() => import('@/pages/SellerForgotPasswordPage'))
const SellerResetPasswordPage = lazy(() => import('@/pages/SellerResetPasswordPage'))
const SellerBusinessInfoPage = lazy(() => import('@/pages/SellerBusinessInfoPage'))
const SellerTierPage = lazy(() => import('@/pages/SellerTierPage'))
const SellerOrdersPage = lazy(() => import('@/pages/SellerOrdersPage'))
const SellerProductsPage = lazy(() => import('@/pages/SellerProductsPage'))
const SellerInventoryPage = lazy(() => import('@/pages/SellerInventoryPage'))
const SellerProductNewPage = lazy(() => import('@/pages/SellerProductNewPage'))
// ⚡ 2026-08-01 세션 ③-b — 3분 등록(사진·가격·마감만). 풀 폼(위)은 그대로 둔다.
const SellerQuickGbPage = lazy(() => import('@/pages/SellerQuickGbPage'))
// ↩️ 2026-08-01 세션 ⑤ — 반품 큐(API 는 있었는데 화면이 0건이었다)
const SellerReturnsPage = lazy(() => import('@/pages/SellerReturnsPage'))
const SellerProductEditPage = lazy(() => import('@/pages/SellerProductEditPage'))
const SellerBookingSlotsPage = lazy(() => import('@/pages/SellerBookingSlotsPage'))
const SellerAppointmentsPage = lazy(() => import('@/pages/SellerAppointmentsPage'))
const MyLedgerPage = lazy(() => import('@/pages/MyLedgerPage'))
const StoreOwnerDashboardPage = lazy(() => import('@/pages/StoreOwnerDashboardPage'))
const SellerProfileEditPage = lazy(() => import('@/pages/SellerProfileEditPage'))
const SellerPublicPage = lazy(() => import('@/pages/SellerPublicPage'))
const SellerSettlementsPage = lazy(() => import('@/pages/SellerSettlementsPage'))
// 🏪 2026-08-19 매장 운영자 관리 (store-operator-model.md 2단계) — 소유자 전용, 서버가 최종 게이트.
const SellerOperatorsPage = lazy(() => import('@/pages/SellerOperatorsPage'))
// 🏪📣 2026-08-20 seller-dashboard-v2: 매장 관리(카카오맵 등록·삭제·위임) · 인플루언서 탐색/제안
const SellerStoresPage = lazy(() => import('@/pages/SellerStoresPage'))
// 🏪 2026-09-16 (대표 — "업체 정보 입력하는 페이지는 하나로 통일"): 모달·유어샵 설정·프로필이 한 장으로.
const SellerStoreInfoPage = lazy(() => import('@/pages/SellerStoreInfoPage'))
// 🏪 2026-09-04 (대표 확정 '운영 매장 요약 대시보드'): 중개사가 매장에 청구할 근거를 보는 화면.
const SellerOperatingSummaryPage = lazy(() => import('@/pages/SellerOperatingSummaryPage'))
const SellerInfluencersPage = lazy(() => import('@/pages/SellerInfluencersPage'))
const SellerAlimtalkPage = lazy(() => import('@/pages/SellerAlimtalkPage'))
const SellerTransfersPage = lazy(() => import('@/pages/SellerTransfersPage'))
const SellerAnalyticsPage = lazy(() => import('@/pages/SellerAnalyticsPage'))
const SellerReviewsPage = lazy(() => import('@/pages/SellerReviewsPage'))
const SellerCouponsPage = lazy(() => import('@/pages/SellerCouponsPage'))
const SellerSupplyPage = lazy(() => import('@/pages/SellerSupplyPage'))
const SellerGroupBuyPage = lazy(() => import('@/pages/SellerGroupBuyPage'))
const SellerReviewVerificationsPage = lazy(() => import('@/pages/SellerReviewVerificationsPage'))
const SellerVoucherScanPage = lazy(() => import('@/pages/SellerVoucherScanPage'))
const SellerBundlesPage = lazy(() => import('@/pages/SellerBundlesPage'))
const SellerGuidePage = lazy(() => import('@/pages/SellerGuidePage'))
const SellerAdSlotsPage = lazy(() => import('@/pages/SellerAdSlotsPage'))
// 🕳️ 2026-09-27: 아래 셋은 **`App.tsx` 에 홀로 떨어져 있었다.** 그래서 마이 시트가 열 수 없었다 —
//   시트는 `SellerRoutes()` 를 렌더하므로 이 표에 없는 주소는 `*`(Escape)로 떨어져 **마이를 통째로 튕겨낸다.**
//   `/seller/prospects` 는 '전체 도구' 색인이 실제로 내주는 주소였고(`seller-nav.ts:123`),
//   `/seller/proxy-products` 는 시트 **안의 탭**(`seller-tab-groups.ts:55`), `/seller/plus-friend-guide` 는
//   온보딩 체크리스트의 CTA 다. 셋 다 "열리는 줄 알았는데 마이에서 쫓겨나는" 모양이었고 에러는 안 났다.
//   ⚠️ 옮기기만 했다 — 경로·element·가드 전부 그대로다(`App.tsx` 도 같은 `<Routes>` 안이라 대시보드 동작 불변).
const SellerProspectsPage = lazy(() => import('@/pages/SellerProspectsPage'))
const SellerProxyProductsPage = lazy(() => import('@/pages/SellerProxyProductsPage'))
const SellerPlusFriendGuidePage = lazy(() => import('@/pages/SellerPlusFriendGuidePage'))
const SellerMarketingPage = lazy(() => import('@/pages/SellerMarketingPage'))
const SellerRealtimeDashboardPage = lazy(() => import('@/pages/SellerRealtimeDashboardPage'))
const SellerMealVoucherNewPage = lazy(() => import('@/pages/SellerMealVoucherNewPage'))
// 🛡️ 2026-05-18: 숙소 공구 (stay_voucher) 셀러 페이지 — PR 2/6.
const SellerStaysPage = lazy(() => import('@/pages/SellerStaysPage'))
const SellerStayNewPage = lazy(() => import('@/pages/SellerStayNewPage'))
const SellerStayDetailPage = lazy(() => import('@/pages/SellerStayDetailPage'))
const SellerStaysBookingsPage = lazy(() => import('@/pages/SellerStaysBookingsPage'))
// 🛡️ 2026-05-19: 발송된 교환권 (KT Alpha) 이력.
const SellerVoucherOrdersPage = lazy(() => import('@/pages/SellerVoucherOrdersPage'))
const Seller2FASetupPage = lazy(() => import('@/pages/Seller2FASetupPage'))
const SellerNotifyFollowersPage = lazy(() => import('@/pages/SellerNotifyFollowersPage'))
const SellerPromoCodesPage = lazy(() => import('@/pages/SellerPromoCodesPage'))
const SellerFollowersPage = lazy(() => import('@/pages/SellerFollowersPage'))
const YouTubeCallbackPage = lazy(() => import('@/pages/YouTubeCallbackPage'))
// 🤝 2026-07-10: 3단 위임/promo 투명성 모델 (docs/design/vendor-commission-passthrough.md §4.3)
const SellerPromoSpendPage = lazy(() => import('@/pages/SellerPromoSpendPage'))
const SellerInfluencerDealsPage = lazy(() => import('@/pages/SellerInfluencerDealsPage'))
const SellerExperienceCampaignsPage = lazy(() => import('@/pages/SellerExperienceCampaignsPage'))

export function SellerRoutes() {
  return (
    <>
      {/* Public seller pages */}
      <Route path="/seller/login" element={
        <PublicRoute forSeller>
          <SellerLoginPage />
        </PublicRoute>
      } />
      <Route path="/seller/relink" element={<ErrorBoundary><SellerRelinkPage /></ErrorBoundary>} />{/* 🔁 카카오 계정 교체 재연결(비보호) */}
      {/* 🏁 2026-07-02 단일 퍼널: 레거시 가입 경로 전부 → /seller/register/supplier (쿼리 보존) */}
      <Route path="/seller/register" element={<LegacySellerRegisterRedirect />} />
      <Route path="/seller/signup" element={<LegacySellerRegisterRedirect />} />
      <Route path="/seller/register/business" element={<LegacySellerRegisterRedirect />} />
      <Route path="/seller/register/supplier" element={<ErrorBoundary><SellerRegisterSupplierPage /></ErrorBoundary>} />
      <Route path="/seller/waiting" element={<ErrorBoundary><SellerWaitingPage /></ErrorBoundary>} />
      <Route path="/seller/tiktok-callback" element={<ErrorBoundary><SellerTikTokCallbackPage /></ErrorBoundary>} />
      <Route path="/seller/forgot-password" element={<ErrorBoundary><SellerForgotPasswordPage /></ErrorBoundary>} />
      <Route path="/seller/reset-password" element={<ErrorBoundary><SellerResetPasswordPage /></ErrorBoundary>} />
      <Route path="/s/:sellerId" element={<SellerPublicPage />} />
      <Route path="/profile/:sellerId" element={<SellerPublicPage />} />

      {/* Protected seller pages */}
      <Route path="/seller" element={
        <ProtectedRoute requireSeller>
          <SellerPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/dashboard" element={<Navigate to="/seller" replace />} />
      <Route path="/seller/more" element={
        <ProtectedRoute requireSeller>
          <SellerMorePage />
        </ProtectedRoute>
      } />
      <Route path="/seller/tier" element={
        <ProtectedRoute requireSeller>
          <SellerTierPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/business-info" element={
        <ProtectedRoute requireSeller>
          <SellerBusinessInfoPage />
        </ProtectedRoute>
      } />
      {/* 🌇 2026-09-04 에이전시 일몰 — `/seller/promote-boosts` 삭제. 이 쿠폰은 **에이전시만** 발급할 수
          있었고(발급 API 가 에이전시 인증), 쓰는 곳은 라이브 방송(영구 중단)이었다. 라이브 실측
          `promote_boost_coupons` 0행 — 발급도 사용도 된 적이 없다. */}
      <Route path="/seller/orders" element={
        <ProtectedRoute requireSeller>
          <SellerOrdersPage />
        </ProtectedRoute>
      } />
      {/* 🪦 2026-09-28 (대표 결재 `2026-09-28-dead-seller-screens.md` — *"3번은 모두 없애줘"*):
          **MD 위탁 판매(`/seller/consignment`) 은퇴.** 라이브 D1 에 테이블
          `consignment_partnerships` 이 **없어서**(마이그레이션 0236 은 레포에 있는데 D1 마이그레이션이
          CI 에서 안 돈다 — `TECHNICAL_DEBT.md`) 페이지를 열면 API 일곱 개가 전부 `no such table` 로
          죽었다. 진입점이 0 이라 아무도 신고하지 않았을 뿐이다.
          ⚠️ **라우트는 남긴다** — 나간 링크·북마크가 404 가 되면 안 된다(`/my-store` 와 같은 방식).
          🔒 **API(`/api/seller/consignment`)는 안 건드린다** — 위탁 정산은 머니 경로라 제거는
             단독 세션 + staging 이 붙는다. 화면이 없으면 들어갈 문이 없다. */}
      <Route path="/seller/consignment" element={<Navigate to="/seller/more" replace />} />
      <Route path="/seller/products" element={
        <ProtectedRoute requireSeller>
          <SellerProductsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/inventory" element={
        <ProtectedRoute requireSeller>
          <SellerInventoryPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/analytics" element={
        <ProtectedRoute requireSeller>
          <SellerAnalyticsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/reviews" element={
        <ProtectedRoute requireSeller>
          <SellerReviewsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/coupons" element={
        <ProtectedRoute requireSeller>
          <SellerCouponsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/products/new" element={
        <ProtectedRoute requireSeller>
          <SellerProductNewPage />
        </ProtectedRoute>
      } />
      {/* ⚡ 3분 등록 — `/new` 보다 **뒤**에 둘 필요는 없다(정적 경로라 겹치지 않는다). */}
      <Route path="/seller/products/quick" element={
        <ProtectedRoute requireSeller>
          <SellerQuickGbPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/returns" element={
        <ProtectedRoute requireSeller>
          <SellerReturnsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/products/:id/edit" element={
        <ProtectedRoute requireSeller>
          <SellerProductEditPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/products/:id/booking-slots" element={
        <ProtectedRoute requireSeller>
          <SellerBookingSlotsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/appointments" element={
        <ProtectedRoute requireSeller>
          <SellerAppointmentsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/ledger" element={
        <ProtectedRoute requireSeller>
          <MyLedgerPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/store-dashboard" element={
        <ProtectedRoute requireSeller>
          <StoreOwnerDashboardPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/profile" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerProfileEditPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/settlements" element={
        <ProtectedRoute requireSeller>
          <SellerSettlementsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/operators" element={
        <ProtectedRoute requireSeller>
          <SellerOperatorsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/stores" element={
        <ProtectedRoute requireSeller>
          <SellerStoresPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/store" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerStoreInfoPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/operating" element={
        <ProtectedRoute requireSeller>
          <SellerOperatingSummaryPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/influencers" element={
        <ProtectedRoute requireSeller>
          <SellerInfluencersPage />
        </ProtectedRoute>
      } />
      {/* 🪦 2026-09-28 (같은 결재): **유튜브 성장 지원 은퇴.** 코드는 멀쩡했지만 라이브 주문 **0건 ·
          매출 0원**이고, 들어갈 문이 **자기 성공 페이지뿐**이었다(전체 도구 목록에 없었다).
          ⚠️ 이건 **결제가 붙은 유료 기능**이라(100명 20,000원 ~ 10,000명 850,000원, Toss) 은퇴 =
             파는 문을 닫는 것이다. 매출 0원이라 잃는 돈은 없다. 되살리려면 이 커밋을 revert.
          🔒 API(`/api/youtube-growth`)는 안 건드린다 — 결제 경로다. */}
      <Route path="/seller/youtube-growth" element={<Navigate to="/seller/more" replace />} />
      <Route path="/seller/youtube-growth/success" element={<Navigate to="/seller/more" replace />} />
      <Route path="/seller/alimtalk" element={
        <ProtectedRoute requireSeller>
          <SellerAlimtalkPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/transfers" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerTransfersPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/group-buy" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerGroupBuyPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🧭 2026-06-10: 계산대용 바우처 스캔 — 현장 1탭 사용처리 */}
      <Route path="/seller/scan" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerVoucherScanPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🗺️ 2026-07-02: 카카오맵 리뷰 확인 큐 — 매장에서 확인(게이미피케이션) */}
      <Route path="/seller/review-verifications" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerReviewVerificationsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-18: 숙소 공구 — PR 2/6 */}
      <Route path="/seller/stays" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerStaysPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/stays/bookings" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerStaysBookingsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/voucher-orders" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerVoucherOrdersPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/stays/new" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerStayNewPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/stays/:id" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerStayDetailPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/bundles" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerBundlesPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/guide" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerGuidePage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/ad-slots" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerAdSlotsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/marketing" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerMarketingPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/realtime" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerRealtimeDashboardPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/meal-voucher/new" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerMealVoucherNewPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-15: 셀러 2FA TOTP 설정 */}
      <Route path="/seller/2fa" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><Seller2FASetupPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-15 (PRISM 따라잡기): 단골에게 push 알림 발송 */}
      <Route path="/seller/notify-followers" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerNotifyFollowersPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🏪 2026-09-16: 유어샵 설정 → 업체 정보로 흡수(배너·브랜드 컬러가 거기로 갔다).
          라우트는 남긴다 — 북마크·안내 문구에 이 주소가 이미 퍼져 있어 지우면 404 가 된다. */}
      <Route path="/seller/mini-shop" element={<Navigate to="/seller/store" replace />} />
      {/* 🛡️ 2026-05-15: 셀러 promo 코드 (단골 전용 할인) */}
      <Route path="/seller/promo-codes" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerPromoCodesPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-15: 단골 분석 (수 추이 + 알림 ON 비율) */}
      <Route path="/seller/followers" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerFollowersPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/supply" element={
        <ProtectedRoute requireSeller>
          <SellerSupplyPage />
        </ProtectedRoute>
      } />
      {/* 🌇 2026-09-04 에이전시 일몰 — `/seller/agency-delegation` 제거. 매장↔중개사 위임은
          에이전시가 아니라 `seller_operators`(owner/operator)로 다시 만든다(설계 대기).
          docs/design/store-operator-model.md */}
      <Route path="/seller/promo-spend" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerPromoSpendPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/influencer-deals" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerInfluencerDealsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/experience-campaigns" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerExperienceCampaignsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/youtube/callback" element={
        <ProtectedRoute requireSeller>
          <YouTubeCallbackPage />
        </ProtectedRoute>
      } />
      {/* 🕳️ 2026-09-27 App.tsx 에서 이사 — 위 머리말 참조. 가드를 새로 씌우지 않는다(옮기기만). */}
      <Route path="/seller/prospects" element={<SellerProspectsPage />} />
      <Route path="/seller/proxy-products" element={<SellerProxyProductsPage />} />
      <Route path="/seller/plus-friend-guide" element={<SellerPlusFriendGuidePage />} />
    </>
  )
}
