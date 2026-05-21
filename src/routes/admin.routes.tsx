/**
 * Admin routes — TD-006 분리 (2026-05-06)
 */
import { lazy } from 'react'
import { Route } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ProtectedRoute, PublicRoute } from '@/components/auth/RouteGuards'

const AdminPage = lazy(() => import('@/pages/AdminPage'))
const AdminLoginPage = lazy(() => import('@/pages/AdminLoginPage'))
const AdminSettlementPage = lazy(() => import('@/pages/AdminSettlementPage'))
const AdminBannersPage = lazy(() => import('@/pages/AdminBannersPage'))
const AdminOrdersPage = lazy(() => import('@/pages/AdminOrdersPage'))
const AdminProductsPage = lazy(() => import('@/pages/AdminProductsPage'))
const AdminAlimtalkPricingPage = lazy(() => import('@/pages/admin/AdminAlimtalkPricingPage'))
const KVMonitoringPage = lazy(() => import('@/pages/admin/KVMonitoringPage'))
const AdminSystemMonitoringPage = lazy(() => import('@/pages/AdminSystemMonitoringPage'))
const AdminCafe24Page = lazy(() => import('@/pages/admin/AdminCafe24Page'))
const AdminKakaoTestPage = lazy(() => import('@/pages/admin/AdminKakaoTestPage'))
const AdminKakaoTestCallbackPage = lazy(() => import('@/pages/admin/AdminKakaoTestCallbackPage'))
const AdminSampleRequestsPage = lazy(() => import('@/pages/admin/AdminSampleRequestsPage'))
const AdminOperationsGuidePage = lazy(() => import('@/pages/admin/AdminOperationsGuidePage'))
const AdminBlogPage = lazy(() => import('@/pages/AdminBlogPage'))
const AdminNotificationSettingsPage = lazy(() => import('@/pages/AdminNotificationSettingsPage'))
const AdminAgencyPage = lazy(() => import('@/pages/AdminAgencyPage'))
const AdminSellerApprovalPage = lazy(() => import('@/pages/AdminSellerApprovalPage'))
const AdminAgencyCreatorApprovalPage = lazy(() => import('@/pages/AdminAgencyCreatorApprovalPage'))
const AdminSettlementsBulkPage = lazy(() => import('@/pages/AdminSettlementsBulkPage'))
const AdminNoticesPage = lazy(() => import('@/pages/AdminNoticesPage'))
const AdminPlatformSettingsPage = lazy(() => import('@/pages/AdminPlatformSettingsPage'))
const AdminDealMonitorPage = lazy(() => import('@/pages/AdminDealMonitorPage'))
const AdminReviewsPage = lazy(() => import('@/pages/AdminReviewsPage'))
const AdminReplayPage = lazy(() => import('@/pages/AdminReplayPage'))
const AdminCouponsPage = lazy(() => import('@/pages/AdminCouponsPage'))
const AdminAuditLogPage = lazy(() => import('@/pages/AdminAuditLogPage'))
const AdminAbusePage = lazy(() => import('@/pages/AdminAbusePage'))
const AdminAdSlotsPage = lazy(() => import('@/pages/AdminAdSlotsPage'))
const AdminCommissionSettingsPage = lazy(() => import('@/pages/AdminCommissionSettingsPage'))
const AdminInfluencerPayoutsPage = lazy(() => import('@/pages/AdminInfluencerPayoutsPage'))
const AdminInfluencerDisputesPage = lazy(() => import('@/pages/AdminInfluencerDisputesPage'))
const AdminKakaoReviewsPage = lazy(() => import('@/pages/AdminKakaoReviewsPage'))
const AdminRevenueAnalyticsPage = lazy(() => import('@/pages/AdminRevenueAnalyticsPage'))
const AdminAccountsPage = lazy(() => import('@/pages/AdminAccountsPage'))
const AdminLiveMonitorPage = lazy(() => import('@/pages/AdminLiveMonitorPage'))
// 🛡️ 2026-05-18: 숙소 공구 어드민 — PR 5/6.
const AdminStaysPage = lazy(() => import('@/pages/AdminStaysPage'))
// 🛡️ 2026-05-18: 사업자등록증 검증 대기 큐.
const AdminBusinessVerificationPage = lazy(() => import('@/pages/AdminBusinessVerificationPage'))
// 🛡️ 2026-05-19: KT Alpha (기프티쇼) 관리.
const AdminKtAlphaPage = lazy(() => import('@/pages/AdminKtAlphaPage'))
// 🛡️ 2026-05-19: 원천징수 + 지급조서 — 소득세법 §164/165 의무.
const AdminWithholdingPage = lazy(() => import('@/pages/AdminWithholdingPage'))
const AdminYoutubeQuotaPage = lazy(() => import('@/pages/AdminYoutubeQuotaPage'))
const AdminHealthPage = lazy(() => import('@/pages/AdminHealthPage'))
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'))
const AdminReviewModerationPage = lazy(() => import('@/pages/AdminReviewModerationPage'))
const AdminTikTokDiscoveryPage = lazy(() => import('@/pages/AdminTikTokDiscoveryPage'))
const AdminRestaurantDemandPage = lazy(() => import('@/pages/AdminRestaurantDemandPage'))
const AdminCastingsPage = lazy(() => import('@/pages/AdminCastingsPage'))
const AdminOpsInsightsPage = lazy(() => import('@/pages/AdminOpsInsightsPage'))
const AdminGroupBuyPage = lazy(() => import('@/pages/AdminGroupBuyPage'))
const AdminDisputesPage = lazy(() => import('@/pages/AdminDisputesPage'))
const Admin2FASetupPage = lazy(() => import('@/pages/Admin2FASetupPage'))
const AdminCommissionWithdrawalsPage = lazy(() => import('@/pages/AdminCommissionWithdrawalsPage'))

export function AdminRoutes() {
  return (
    <>
      {/* Admin 로그인 페이지 (Public) */}
      <Route path="/admin/login" element={
        <PublicRoute forAdmin>
          <AdminLoginPage />
        </PublicRoute>
      } />

      {/* Admin Protected 페이지들 */}
      <Route path="/admin" element={
        <ProtectedRoute requireAdmin>
          <AdminPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/settlement" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminSettlementPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/commission-withdrawals" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminCommissionWithdrawalsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/banners" element={
        <ProtectedRoute requireAdmin>
          <AdminBannersPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/orders" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminOrdersPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/products" element={
        <ProtectedRoute requireAdmin>
          <AdminProductsPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/alimtalk" element={
        <ProtectedRoute requireAdmin>
          <AdminAlimtalkPricingPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/kv-monitoring" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><KVMonitoringPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/system-monitoring" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminSystemMonitoringPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/sample-requests" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminSampleRequestsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/operations-guide" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminOperationsGuidePage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/cafe24" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminCafe24Page /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/cafe24/callback" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminCafe24Page /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/blog" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminBlogPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-04-28: 알림 채널 설정 */}
      <Route path="/admin/notification-settings" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminNotificationSettingsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/deals" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminDealMonitorPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-15: 공동구매 모니터링 + 강제 환불 */}
      <Route path="/admin/group-buy" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminGroupBuyPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-15: 분쟁 큐 (AI 자동 분류 + escalation) */}
      <Route path="/admin/disputes" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminDisputesPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-15: 어드민 2FA TOTP 설정 */}
      <Route path="/admin/2fa" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><Admin2FASetupPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/reviews" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminReviewsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/replay" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminReplayPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/seller-approval" element={
        <ProtectedRoute requireAdmin><AdminSellerApprovalPage /></ProtectedRoute>
      } />
      <Route path="/admin/agency-creator-approval" element={
        <ProtectedRoute requireAdmin><AdminAgencyCreatorApprovalPage /></ProtectedRoute>
      } />
      <Route path="/admin/settlements-bulk" element={
        <ProtectedRoute requireAdmin><AdminSettlementsBulkPage /></ProtectedRoute>
      } />
      <Route path="/admin/notices" element={
        <ProtectedRoute requireAdmin><AdminNoticesPage /></ProtectedRoute>
      } />
      <Route path="/admin/platform-settings" element={
        <ProtectedRoute requireAdmin><AdminPlatformSettingsPage /></ProtectedRoute>
      } />
      <Route path="/admin/kakao-test" element={
        <ProtectedRoute requireAdmin>
          <AdminKakaoTestPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/kakao-test/callback" element={
        <ProtectedRoute requireAdmin><AdminKakaoTestCallbackPage /></ProtectedRoute>
      } />
      <Route path="/admin/tiktok-discovery" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminTikTokDiscoveryPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/restaurant-demand" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminRestaurantDemandPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/castings" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminCastingsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/insights" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminOpsInsightsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/coupons" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminCouponsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/agencies" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminAgencyPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/abuse" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminAbusePage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/ad-slots" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminAdSlotsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/commission-settings" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminCommissionSettingsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/influencer-payouts" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminInfluencerPayoutsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/influencer-disputes" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminInfluencerDisputesPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/kakao-reviews" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminKakaoReviewsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/audit-log" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminAuditLogPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/revenue" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminRevenueAnalyticsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/accounts" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminAccountsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/live-monitor" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminLiveMonitorPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/stays" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminStaysPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/business-verification" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminBusinessVerificationPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/kt-alpha" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminKtAlphaPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/withholding" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWithholdingPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/youtube-quota" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminYoutubeQuotaPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/health" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminHealthPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminUsersPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/review-moderation" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminReviewModerationPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
    </>
  )
}
