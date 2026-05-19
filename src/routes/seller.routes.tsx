/**
 * Seller routes — TD-006 분리 (2026-05-06)
 * 공개(register/login/forgot-password) + 보호(Protected) 셀러 페이지 라우트
 */
import { lazy } from 'react'
import { Route, Navigate } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ProtectedRoute, PublicRoute } from '@/components/auth/RouteGuards'

const SellerPage = lazy(() => import('@/pages/SellerPage'))
const SellerLoginPage = lazy(() => import('@/pages/SellerLoginPage'))
const SellerRegisterPage = lazy(() => import('@/pages/SellerRegisterPage'))
const SellerRegisterBusinessPage = lazy(() => import('@/pages/SellerRegisterBusinessPage'))
const SellerWaitingPage = lazy(() => import('@/pages/SellerWaitingPage'))
const SellerTikTokCallbackPage = lazy(() => import('@/pages/SellerTikTokCallbackPage'))
const SellerForgotPasswordPage = lazy(() => import('@/pages/SellerForgotPasswordPage'))
const SellerResetPasswordPage = lazy(() => import('@/pages/SellerResetPasswordPage'))
const SellerBusinessInfoPage = lazy(() => import('@/pages/SellerBusinessInfoPage'))
const SellerTierPage = lazy(() => import('@/pages/SellerTierPage'))
const SellerOrdersPage = lazy(() => import('@/pages/SellerOrdersPage'))
const SellerConsignmentPage = lazy(() => import('@/pages/SellerConsignmentPage'))
const SellerProductsPage = lazy(() => import('@/pages/SellerProductsPage'))
const SellerInventoryPage = lazy(() => import('@/pages/SellerInventoryPage'))
const SellerProductNewPage = lazy(() => import('@/pages/SellerProductNewPage'))
const SellerProductEditPage = lazy(() => import('@/pages/SellerProductEditPage'))
const SellerStreamNewPage = lazy(() => import('@/pages/SellerStreamNewPage'))
const SellerStreamEditPage = lazy(() => import('@/pages/SellerStreamEditPage'))
const SellerProfileEditPage = lazy(() => import('@/pages/SellerProfileEditPage'))
const SellerPublicPage = lazy(() => import('@/pages/SellerPublicPage'))
const SellerSettlementsPage = lazy(() => import('@/pages/SellerSettlementsPage'))
const SellerAlimtalkPage = lazy(() => import('@/pages/SellerAlimtalkPage'))
const SellerYoutubeGrowthPage = lazy(() => import('@/pages/SellerYoutubeGrowthPage'))
const SellerYoutubeGrowthSuccessPage = lazy(() => import('@/pages/SellerYoutubeGrowthSuccessPage'))
const SellerDonationsPage = lazy(() => import('@/pages/SellerDonationsPage'))
const SellerTransfersPage = lazy(() => import('@/pages/SellerTransfersPage'))
const SellerShortsPage = lazy(() => import('@/pages/SellerShortsPage'))
const SellerLiveBroadcastPage = lazy(() => import('@/pages/SellerLiveBroadcastPage'))
const SellerVerifyWhipProxyPage = lazy(() => import('@/pages/SellerVerifyWhipProxyPage'))
const SellerStreamingSetupPage = lazy(() => import('@/pages/SellerStreamingSetupPage'))
const SellerLiveAnalyticsPage = lazy(() => import('@/pages/SellerLiveAnalyticsPage'))
const SellerAnalyticsPage = lazy(() => import('@/pages/SellerAnalyticsPage'))
const SellerReviewsPage = lazy(() => import('@/pages/SellerReviewsPage'))
const SellerCouponsPage = lazy(() => import('@/pages/SellerCouponsPage'))
const SellerSupplyPage = lazy(() => import('@/pages/SellerSupplyPage'))
const SellerGroupBuyPage = lazy(() => import('@/pages/SellerGroupBuyPage'))
const SellerBundlesPage = lazy(() => import('@/pages/SellerBundlesPage'))
const SellerGuidePage = lazy(() => import('@/pages/SellerGuidePage'))
const SellerAdSlotsPage = lazy(() => import('@/pages/SellerAdSlotsPage'))
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
const SellerMiniShopPage = lazy(() => import('@/pages/SellerMiniShopPage'))
const SellerStreamingGuidePage = lazy(() => import('@/pages/SellerStreamingGuidePage'))
const SellerPromoCodesPage = lazy(() => import('@/pages/SellerPromoCodesPage'))
const SellerFollowersPage = lazy(() => import('@/pages/SellerFollowersPage'))
const SellerCastingsPage = lazy(() => import('@/pages/SellerCastingsPage'))
const SellerPromoteBoostsPage = lazy(() => import('@/pages/SellerPromoteBoostsPage'))
const YouTubeCallbackPage = lazy(() => import('@/pages/YouTubeCallbackPage'))

export function SellerRoutes() {
  return (
    <>
      {/* Public seller pages */}
      <Route path="/seller/login" element={
        <PublicRoute forSeller>
          <SellerLoginPage />
        </PublicRoute>
      } />
      <Route path="/seller/register" element={<ErrorBoundary><SellerRegisterPage /></ErrorBoundary>} />
      <Route path="/seller/signup" element={<ErrorBoundary><SellerRegisterPage /></ErrorBoundary>} />
      <Route path="/seller/register/business" element={<ErrorBoundary><SellerRegisterBusinessPage /></ErrorBoundary>} />
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
      <Route path="/seller/castings" element={
        <ProtectedRoute requireSeller>
          <SellerCastingsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/promote-boosts" element={
        <ProtectedRoute requireSeller>
          <SellerPromoteBoostsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/orders" element={
        <ProtectedRoute requireSeller>
          <SellerOrdersPage />
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-04-28: MD 위탁 판매 (셀러간 협업) */}
      <Route path="/seller/consignment" element={
        <ProtectedRoute requireSeller>
          <SellerConsignmentPage />
        </ProtectedRoute>
      } />
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
      <Route path="/seller/products/:id/edit" element={
        <ProtectedRoute requireSeller>
          <SellerProductEditPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/live" element={<Navigate to="/seller/live-broadcast" replace />} />
      <Route path="/seller/live-control" element={<Navigate to="/seller/live-broadcast" replace />} />
      <Route path="/seller/streams/new" element={
        <ProtectedRoute requireSeller>
          <SellerStreamNewPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/streams/:id" element={
        <ProtectedRoute requireSeller>
          <SellerStreamEditPage />
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
      <Route path="/seller/youtube-growth" element={
        <ProtectedRoute requireSeller>
          <SellerYoutubeGrowthPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/youtube-growth/success" element={
        <ProtectedRoute requireSeller>
          <SellerYoutubeGrowthSuccessPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/alimtalk" element={
        <ProtectedRoute requireSeller>
          <SellerAlimtalkPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/donations" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerDonationsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/transfers" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerTransfersPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/shorts" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerShortsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/seller/group-buy" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerGroupBuyPage /></ErrorBoundary>
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
      {/* 🛡️ 2026-05-15 (PRISM 따라잡기): 미니샵 커스터마이징 */}
      <Route path="/seller/mini-shop" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerMiniShopPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-15 (PRISM 따라잡기): PRISM/OBS 송출 가이드 */}
      <Route path="/seller/streaming-guide" element={
        <ProtectedRoute requireSeller>
          <ErrorBoundary><SellerStreamingGuidePage /></ErrorBoundary>
        </ProtectedRoute>
      } />
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
      <Route path="/seller/streaming-setup" element={
        <ProtectedRoute requireSeller>
          <SellerStreamingSetupPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/live-broadcast" element={
        <ProtectedRoute requireSeller>
          <SellerLiveBroadcastPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/verify-whip-proxy" element={
        <ProtectedRoute requireSeller>
          <SellerVerifyWhipProxyPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/live-broadcast/:streamId" element={
        <ProtectedRoute requireSeller>
          <SellerLiveBroadcastPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/live-analytics" element={
        <ProtectedRoute requireSeller>
          <SellerLiveAnalyticsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/live-analytics/:streamId" element={
        <ProtectedRoute requireSeller>
          <SellerLiveAnalyticsPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/supply" element={
        <ProtectedRoute requireSeller>
          <SellerSupplyPage />
        </ProtectedRoute>
      } />
      <Route path="/seller/youtube/callback" element={
        <ProtectedRoute requireSeller>
          <YouTubeCallbackPage />
        </ProtectedRoute>
      } />
    </>
  )
}
