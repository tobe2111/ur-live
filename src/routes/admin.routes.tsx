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
// 🛡️ 2026-05-27 (사용자 결정): admin 매장 검수 통합 페이지
const AdminPendingSellersPage = lazy(() => import('@/pages/AdminPendingSellersPage'))
const AdminProspectsPage = lazy(() => import('@/pages/AdminProspectsPage'))
// 🛡️ 2026-05-25 (migration 0279): CSV 일괄 송장 업로드
const AdminBulkTrackingPage = lazy(() => import('@/pages/AdminBulkTrackingPage'))
// 🛡️ 2026-05-25: 어드민 반품 검수 페이지
const AdminReturnsPage = lazy(() => import('@/pages/AdminReturnsPage'))
const AdminProductsPage = lazy(() => import('@/pages/AdminProductsPage'))
const AdminFcfsPage = lazy(() => import('@/pages/AdminFcfsPage'))
const AdminSuppliersPage = lazy(() => import('@/pages/AdminSuppliersPage'))
const AdminDistributorGradesPage = lazy(() => import('@/pages/AdminDistributorGradesPage'))
const AdminWholesaleImportPage = lazy(() => import('@/pages/AdminWholesaleImportPage'))
const AdminDongnedealImportPage = lazy(() => import('@/pages/AdminDongnedealImportPage'))
const AdminWholesaleActivityPage = lazy(() => import('@/pages/admin/AdminWholesaleActivityPage'))
const AdminLoginHistoryPage = lazy(() => import('@/pages/AdminLoginHistoryPage'))
const AdminWholesaleOrdersPage = lazy(() => import('@/pages/AdminWholesaleOrdersPage'))
// 🏦 2026-06-09: 도매 예치금 입금확인 페이지.
const AdminWholesaleDepositsPage = lazy(() => import('@/pages/AdminWholesaleDepositsPage'))
// 🏦 2026-06-09: 제조사 정산금 출금 신청 처리 페이지.
const AdminWholesaleWithdrawalsPage = lazy(() => import('@/pages/AdminWholesaleWithdrawalsPage'))
// 🏭 2026-06-09 Wave 2: 도매 메인 배너 관리 + 제안/신고 처리 큐.
const AdminWholesaleBannersPage = lazy(() => import('@/pages/AdminWholesaleBannersPage'))
const AdminWholesaleBoardPage = lazy(() => import('@/pages/AdminWholesaleBoardPage'))
const AdminPartnershipPage = lazy(() => import('@/pages/AdminPartnershipPage'))
const AdminWholesaleProposalsPage = lazy(() => import('@/pages/AdminWholesaleProposalsPage'))
// 🏭 Wave 2 (2026-06-09): 도매 프리미엄 전용관 상품 토글.
const AdminWholesaleProductsPage = lazy(() => import('@/pages/admin/AdminWholesaleProductsPage'))
// 🏬 Phase 1-b (2026-06-09): 멀티-몰 테넌시 — 도매 몰 관리.
const AdminWholesaleMallsPage = lazy(() => import('@/pages/admin/AdminWholesaleMallsPage'))
// 🏬 Phase 2 (2026-06-09): 크로스-몰 도매 통합 현황 (운영자 랜딩).
const AdminWholesaleOverviewPage = lazy(() => import('@/pages/admin/AdminWholesaleOverviewPage'))
// 🗺️ 2026-06-18: 동네별 딜 밀도 (행정동 태깅 기반 영입 타겟).
const AdminRegionDensityPage = lazy(() => import('@/pages/AdminRegionDensityPage'))
// 🏭 BIZ-1 (2026-06-08): 도매 클레임(RMA) 검수 페이지.
const AdminWholesaleClaimsPage = lazy(() => import('@/pages/admin/AdminWholesaleClaimsPage'))
const AdminWholesaleTaxPage = lazy(() => import('@/pages/admin/AdminWholesaleTaxPage'))
const AdminWholesaleIntegrityPage = lazy(() => import('@/pages/admin/AdminWholesaleIntegrityPage'))
const AdminBusinessMetricsPage = lazy(() => import('@/pages/admin/AdminBusinessMetricsPage'))
const AdminWholesaleQuotesPage = lazy(() => import('@/pages/admin/AdminWholesaleQuotesPage'))
const AdminAlimtalkPricingPage = lazy(() => import('@/pages/admin/AdminAlimtalkPricingPage'))
const KVMonitoringPage = lazy(() => import('@/pages/admin/KVMonitoringPage'))
const AdminSystemMonitoringPage = lazy(() => import('@/pages/AdminSystemMonitoringPage'))
const AdminErrorsPage = lazy(() => import('@/pages/AdminErrorsPage'))
const AdminEnvCheckPage = lazy(() => import('@/pages/AdminEnvCheckPage'))
const AdminVoucherOrdersPage = lazy(() => import('@/pages/AdminVoucherOrdersPage'))
// 🛡️ 2026-05-24 Q1: 교환권 거래 분리 표시 (누가 / 언제 / 어떤 교환권)
const AdminVoucherTransactionsPage = lazy(() => import('@/pages/AdminVoucherTransactionsPage'))
const AdminCafe24Page = lazy(() => import('@/pages/admin/AdminCafe24Page'))
const AdminKakaoTestPage = lazy(() => import('@/pages/admin/AdminKakaoTestPage'))
const AdminKakaoTestCallbackPage = lazy(() => import('@/pages/admin/AdminKakaoTestCallbackPage'))
const AdminSampleRequestsPage = lazy(() => import('@/pages/admin/AdminSampleRequestsPage'))
const AdminOperationsGuidePage = lazy(() => import('@/pages/admin/AdminOperationsGuidePage'))
// 🏭 2026-06-07: 도매몰(유통스타트 B2B) 전용 운영 가이드.
const AdminWholesaleGuidePage = lazy(() => import('@/pages/admin/AdminWholesaleGuidePage'))
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
const AdminMerchantCommissionsPage = lazy(() => import('@/pages/AdminMerchantCommissionsPage'))
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
const AdminPolicyDashboardPage = lazy(() => import('@/pages/AdminPolicyDashboardPage'))
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'))
const AdminReviewModerationPage = lazy(() => import('@/pages/AdminReviewModerationPage'))
const AdminTikTokDiscoveryPage = lazy(() => import('@/pages/AdminTikTokDiscoveryPage'))
const AdminRestaurantDemandPage = lazy(() => import('@/pages/AdminRestaurantDemandPage'))
const AdminCastingsPage = lazy(() => import('@/pages/AdminCastingsPage'))
const AdminOpsInsightsPage = lazy(() => import('@/pages/AdminOpsInsightsPage'))
const AdminGroupBuyPage = lazy(() => import('@/pages/AdminGroupBuyPage'))
const AdminDisputesPage = lazy(() => import('@/pages/AdminDisputesPage'))
const Admin2FASetupPage = lazy(() => import('@/pages/Admin2FASetupPage'))
const AdminPinSetupPage = lazy(() => import('@/pages/AdminPinSetupPage'))
const AdminCommissionWithdrawalsPage = lazy(() => import('@/pages/AdminCommissionWithdrawalsPage'))
const AdminPayoutCenterPage = lazy(() => import('@/pages/AdminPayoutCenterPage'))
const AdminPayoutsPage = lazy(() => import('@/pages/AdminPayoutsPage'))
// 📧 2026-06-09 Wave 3b: 어드민 단체메일 (filtered bulk email)
const AdminBulkEmailPage = lazy(() => import('@/pages/AdminBulkEmailPage'))

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
      <Route path="/admin/region-density" element={
        <ProtectedRoute requireAdmin>
          <AdminRegionDensityPage />
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-27 (사용자 결정): admin 매장 검수 통합 페이지 */}
      <Route path="/admin/pending-sellers" element={
        <ProtectedRoute requireAdmin>
          <AdminPendingSellersPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/prospects" element={
        <ProtectedRoute requireAdmin>
          <AdminProspectsPage />
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-23: Frontend 에러 대시보드 */}
      <Route path="/admin/errors" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminErrorsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-23: 환경변수 점검 페이지 */}
      <Route path="/admin/env-check" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminEnvCheckPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-23: KT Alpha 기프티쇼 발송 추적 페이지 */}
      <Route path="/admin/voucher-orders" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminVoucherOrdersPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-24 Q1: 교환권 거래 분리 표시 (voucher 구매 내역) */}
      <Route path="/admin/voucher-transactions" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminVoucherTransactionsPage /></ErrorBoundary>
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
      <Route path="/admin/payout-center" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminPayoutCenterPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/payouts" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminPayoutsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/policy" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminPolicyDashboardPage /></ErrorBoundary>
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
      {/* 🛡️ 2026-05-25 (migration 0279): CSV 일괄 송장 업로드 */}
      <Route path="/admin/shipping/bulk-tracking" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminBulkTrackingPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🛡️ 2026-05-25: 반품 검수 */}
      <Route path="/admin/returns" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminReturnsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/products" element={
        <ProtectedRoute requireAdmin>
          <AdminProductsPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/fcfs" element={
        <ProtectedRoute requireAdmin>
          <AdminFcfsPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/suppliers" element={
        <ProtectedRoute requireAdmin>
          <AdminSuppliersPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/distributor-grades" element={
        <ProtectedRoute requireAdmin>
          <AdminDistributorGradesPage />
        </ProtectedRoute>
      } />
      {/* 🗂️ 2026-06-17: 유통사 등급 페이지 탭 분리 — 같은 컴포넌트가 경로로 탭 결정(딥링크). */}
      <Route path="/admin/distributor-credit" element={
        <ProtectedRoute requireAdmin>
          <AdminDistributorGradesPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/distributor-tax" element={
        <ProtectedRoute requireAdmin>
          <AdminDistributorGradesPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/distributor-supply" element={
        <ProtectedRoute requireAdmin>
          <AdminDistributorGradesPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/wholesale-import" element={
        <ProtectedRoute requireAdmin>
          <AdminWholesaleImportPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/dongnedeal-import" element={
        <ProtectedRoute requireAdmin>
          <AdminDongnedealImportPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/wholesale-activity" element={
        <ProtectedRoute requireAdmin>
          <AdminWholesaleActivityPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/login-history" element={
        <ProtectedRoute requireAdmin>
          <AdminLoginHistoryPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/wholesale-orders" element={
        <ProtectedRoute requireAdmin>
          <AdminWholesaleOrdersPage />
        </ProtectedRoute>
      } />
      {/* 🏦 2026-06-09: 도매 예치금 입금확인 */}
      <Route path="/admin/wholesale-deposits" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleDepositsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🏦 2026-06-09: 제조사 정산금 출금 신청 처리 */}
      <Route path="/admin/wholesale-withdrawals" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleWithdrawalsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🏭 Wave 2 (2026-06-09): 도매 메인 배너 관리 */}
      <Route path="/admin/wholesale-banners" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleBannersPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/wholesale-board" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleBoardPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/admin/partnership" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminPartnershipPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🏭 Wave 2 (2026-06-09): 도매 제안/신고 처리 큐 */}
      <Route path="/admin/wholesale-proposals" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleProposalsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🏭 Wave 2 (2026-06-09): 도매 프리미엄 전용관 상품 토글 */}
      <Route path="/admin/wholesale-products" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleProductsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🏬 Phase 2 (2026-06-09): 크로스-몰 도매 통합 현황 (운영자 랜딩) */}
      <Route path="/admin/wholesale-overview" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleOverviewPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🏬 Phase 1-b (2026-06-09): 멀티-몰 테넌시 — 도매 몰 관리 */}
      <Route path="/admin/wholesale-malls" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleMallsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🏭 BIZ-1 (2026-06-08): 도매 클레임(RMA) 검수 */}
      <Route path="/admin/wholesale-claims" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleClaimsPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🏭 BIZ-3 (2026-06-08): 도매 견적/발주(Quote/PO) */}
      <Route path="/admin/wholesale-quotes" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleQuotesPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🏭 TAX-1 (2026-06-08): 도매 세무/정산 (미수·미지급 aging + 매입 역발행) */}
      <Route path="/admin/wholesale-tax" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleTaxPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🏭 DATA-1 (2026-06-08): 도매 데이터 무결성 (고아행 스윕) */}
      <Route path="/admin/wholesale-integrity" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleIntegrityPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 📊 (2026-06-08): 비즈니스 지표 대시보드 (GMV·순수익률·반복구매) */}
      <Route path="/admin/business-metrics" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminBusinessMetricsPage /></ErrorBoundary>
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
      {/* 🏭 2026-06-07: 도매몰(유통스타트 B2B) 전용 운영 가이드 */}
      <Route path="/admin/wholesale-guide" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminWholesaleGuidePage /></ErrorBoundary>
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
      {/* 🛡️ 2026-05-15: 어드민 2FA TOTP 설정 (선택 — 강제 흐름은 /admin/set-pin) */}
      <Route path="/admin/2fa" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><Admin2FASetupPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* 🔐 2026-06-17: 로그인 보안 PIN 설정 (대표 결정 — 6자리 PIN) */}
      <Route path="/admin/set-pin" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminPinSetupPage /></ErrorBoundary>
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
      <Route path="/admin/merchant-commissions" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminMerchantCommissionsPage /></ErrorBoundary>
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
      {/* 📧 2026-06-09 Wave 3b: 어드민 단체메일 (filtered bulk email) */}
      <Route path="/admin/bulk-email" element={
        <ProtectedRoute requireAdmin>
          <ErrorBoundary><AdminBulkEmailPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
    </>
  )
}
