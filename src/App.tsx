import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryProvider } from './lib/react-query'
import { ProtectedRoute, PublicRoute } from './components/auth/RouteGuards'
import IosTopupGate from './components/IosTopupGate'
import { isUtongstart, isWholesaleAllowedPath, isWholesaleSurface, isMarketingSurface } from './utils/domain'
import ToastContainer from './components/ToastContainer'
import { ConfirmHost } from './components/ui/confirm-dialog'
import NewVersionBanner from './components/main/NewVersionBanner'
import ErrorBoundary from './components/ErrorBoundary'
import { ChunkErrorBoundary } from './components/utils/ChunkErrorBoundary'
import FrameWrapper from './components/FrameWrapper'
import { useMultiTabSync } from './hooks/useMultiTabSync'
import ScrollToTop from './components/ScrollToTop'
import OfflineBanner from './components/OfflineBanner'
import BottomNav from '@/components/main/BottomNav'
import DesktopTopNav from '@/components/main/DesktopTopNav'
import { swallow } from '@/shared/utils/swallow'
import KakaoConsultButton from '@/components/KakaoConsultButton'
import { featureFlags } from '@/shared/config/feature-flags'
// lazy-loaded — only rendered conditionally, not on initial paint
const PushNotificationSetup = lazy(() => import('./components/PushNotificationSetup'))
const PWAInstallPrompt = lazy(() => import('./components/PWAInstallPrompt'))
const OnboardingTrigger = lazy(() => import('./components/onboarding/OnboardingTrigger'))
const RestoreAccountModal = lazy(() => import('./components/account/RestoreAccountModal'))
const SideBanner = lazy(() => import('@/components/SideBanner'))
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
// TD-006: route group files
import { SellerRoutes } from './routes/seller.routes'
import { AdminRoutes } from './routes/admin.routes'
import { AgencyRoutes } from './routes/agency.routes'
import { SupplierRoutes } from './routes/supplier.routes'

// ❌ REMOVED: Duplicate Sentry initialization (already done in main.tsx)

// ✅ Public / User 페이지들 lazy loading (초기 번들 크기 최소화)
// 🏠 2026-06-20 (대표 결정 — 홈=동네딜 지도+바텀시트): 홈 `/` 메인 콘텐츠를 RestaurantMapPage(지도+
//   드래그 바텀시트+카테고리 칩+내 주변)로 전환. RestaurantMapPage 는 lazy(아래 167행) — 지도는 어차피
//   카카오 SDK async 로드라 컴포넌트 청크 페치(~50-100ms)는 SDK 준비 대비 무시 가능. 기존 MainHomePage(교환권
//   blend)는 dead route 가 되어 import 제거(엔트리 축소). 일반상품/교환권은 '쇼핑' 탭(/vouchers)으로 이전.
//   ⚠️ [UNLOCK_LOADING] 트레이드오프: 홈 SSR 슬롯(__SSR_INITIAL_MAIN__) 미사용 → 홈 첫 화면이 지도 로딩.
//   worker/index.ts SSR inject 는 무수정(주입은 되나 지도 홈이 안 읽음 — 무해).
const WholesaleCatalogPage = lazy(() => import('./pages/WholesaleCatalogPage'))
const WholesaleDashboardPage = lazy(() => import('./pages/WholesaleDashboardPage'))
const WholesaleDepositPage = lazy(() => import('./pages/WholesaleDepositPage'))
const WholesaleProductPage = lazy(() => import('./pages/WholesaleProductPage'))
const WholesaleCheckoutPage = lazy(() => import('./pages/WholesaleCheckoutPage'))
const WholesaleCartPage = lazy(() => import('./pages/WholesaleCartPage'))
const WholesaleSuccessPage = lazy(() => import('./pages/WholesaleSuccessPage'))
const WholesaleOrdersPage = lazy(() => import('./pages/WholesaleOrdersPage'))
const WholesaleStatementPage = lazy(() => import('./pages/WholesaleStatementPage'))
const WholesaleDocsPage = lazy(() => import('./pages/WholesaleDocsPage'))
const WholesaleOemPage = lazy(() => import('./pages/WholesaleOemPage'))
const WholesaleQuotesPage = lazy(() => import('./pages/wholesale/WholesaleQuotesPage'))
const WholesaleLayout = lazy(() => import('./pages/wholesale/WholesaleLayout'))
const WholesaleNaverPage = lazy(() => import('./pages/wholesale/WholesaleNaverPage'))
const WholesaleStartPage = lazy(() => import('./pages/wholesale/WholesaleStartPage'))
const WholesaleBoardPage = lazy(() => import('./pages/wholesale/WholesaleBoardPage'))
const WholesaleSupportPage = lazy(() => import('./pages/wholesale/WholesaleSupportPage'))
const WholesaleChannelsPage = lazy(() => import('./pages/wholesale/WholesaleChannelsPage'))
const WholesaleTermsPage = lazy(() => import('./pages/wholesale/WholesaleTermsPage'))
const WholesalePrivacyPage = lazy(() => import('./pages/wholesale/WholesalePrivacyPage'))
const PartnershipInquiryPage = lazy(() => import('./pages/PartnershipInquiryPage'))
const WholesaleWishlistPage = lazy(() => import('./pages/wholesale/WholesaleWishlistPage'))
const WholesaleProposalsPage = lazy(() => import('./pages/wholesale/WholesaleProposalsPage'))
const WholesaleStaffPage = lazy(() => import('./pages/wholesale/WholesaleStaffPage'))
const WholesaleStaffLoginPage = lazy(() => import('./pages/wholesale/WholesaleStaffLoginPage'))
const WholesaleIntroPage = lazy(() => import('./pages/WholesaleIntroPage'))
const WholesaleJoinPage = lazy(() => import('./pages/WholesaleJoinPage'))
const WholesaleLoginPage = lazy(() => import('./pages/WholesaleLoginPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const ShortsPage = lazy(() => import('./pages/ShortsPage'))
const IntroducePage = lazy(() => import('./pages/IntroducePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const JoinChoicePage = lazy(() => import('./pages/JoinChoicePage'))
const KakaoCallbackPage = lazy(() => import('./pages/KakaoCallbackPage'))
const KakaoConsentCallbackPage = lazy(() => import('./pages/KakaoConsentCallbackPage'))
const KakaoLinkCallbackPage = lazy(() => import('./pages/KakaoLinkCallbackPage'))
const LivePageV2 = lazy(() => import('./pages/LivePageV2'))
const LiveListPage = lazy(() => import('./pages/LiveListPage'))
const LiveRecapPage = lazy(() => import('./pages/LiveRecapPage'))
const PaymentDemoPage = lazy(() => import('./pages/PaymentDemoPage'))
const EmbedLivePage = lazy(() => import('./pages/EmbedLivePage'))
const SellerOverlayPage = lazy(() => import('./pages/SellerOverlayPage'))
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'))
const PaymentFailPage = lazy(() => import('./pages/PaymentFailPage'))
const PointsChargePage = lazy(() => import('./pages/PointsChargePage'))
// 🛡️ 2026-05-24: 딜 사용 내역 페이지 (사용자 요청 — 충전/사용/적립/환불 히스토리)
const MyDealHistoryPage = lazy(() => import('./pages/MyDealHistoryPage'))
const TossWidgetPayPage = lazy(() => import('./pages/TossWidgetPayPage'))
const TossDebugPage = lazy(() => import('./pages/TossDebugPage'))
const PointsChargeSuccessPage = lazy(() => import('./pages/PointsChargeSuccessPage'))
const CartPage = lazy(() => import('./pages/CartPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
// 🛡️ 2026-05-25 (migration 0278): 큐레이터 링크샵
const CuratorPage = lazy(() => import('./pages/CuratorPage'))
const CuratorEarningsPage = lazy(() => import('./pages/CuratorEarningsPage'))
// 🏁 2026-06-22 (대표 — 상품/이용권 전용 추가 페이지): 링크샵 핀 picker.
const LinkshopPinPicker = lazy(() => import('./pages/curator-page/LinkshopPinPicker'))
// 🛡️ 2026-05-25 (migration 0280): 호스팅 (Phase 3)
const HostingPage = lazy(() => import('./pages/HostingPage'))
const HostingNewPage = lazy(() => import('./pages/HostingNewPage'))
const HostInvitePage = lazy(() => import('./pages/HostInvitePage'))
// 🛡️ 2026-05-25 (Phase 2 잔여): 반품 회수 송장 추적 UI
const MyReturnsPage = lazy(() => import('./pages/MyReturnsPage'))
// 🛡️ 2026-05-25: /u/me → 본인 공개페이지 redirect
const UMeRedirectPage = lazy(() => import('./pages/UMeRedirectPage'))
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'))
const WishlistPage = lazy(() => import('./pages/WishlistPage'))
const FollowingPage = lazy(() => import('./pages/FollowingPage'))
const MyVouchersPage = lazy(() => import('./pages/MyVouchersPage'))
const MyStorePage = lazy(() => import('./pages/MyStorePage'))
const InfluencerSettlementPage = lazy(() => import('./pages/InfluencerSettlementPage'))
const InfluencerDiscoverPage = lazy(() => import('./pages/InfluencerDiscoverPage'))
const InfluencerAnalyticsPage = lazy(() => import('./pages/InfluencerAnalyticsPage'))
const InfluencerRankingsPage = lazy(() => import('./pages/InfluencerRankingsPage'))
const MyFollowsPage = lazy(() => import('./pages/MyFollowsPage'))
const MyDigitalLibraryPage = lazy(() => import('./pages/MyDigitalLibraryPage'))
const VoucherVerifyPage = lazy(() => import('./pages/VoucherVerifyPage'))
const StoreStatsPage = lazy(() => import('./pages/StoreStatsPage'))
const BrowsePage = lazy(() => import('./pages/BrowsePage'))
// 🛡️ 2026-05-19: 교환권 전용 페이지 — /browse 와 분리 (카카오 선물하기 스타일).
const VouchersPage = lazy(() => import('./pages/VouchersPage'))
// 🆕 2026-06-26 통합 마케팅 서비스(가칭) — 3번째 서비스 /ads (유어딜/도매몰과 분리된 surface)
// 🆕 2026-06-27 /ads = 공개 랜딩(소개), /ads/dashboard = 로그인 후 입점 대시보드
const MarketingLandingPage = lazy(() => import('./pages/marketing/MarketingLandingPage'))
const MarketingLoginPage = lazy(() => import('./pages/marketing/MarketingLoginPage'))
const MarketingDashboardPage = lazy(() => import('./pages/marketing/MarketingDashboardPage'))
const VoucherDetailPage = lazy(() => import('./pages/VoucherDetailPage'))
const MealVouchersPage = lazy(() => import('./pages/MealVouchersPage'))
const GroupBuyListPage = lazy(() => import('./pages/GroupBuyListPage'))
const GroupBuyDetailPage = lazy(() => import('./pages/GroupBuyDetailPage'))
const GroupBuyConfirmPaymentPage = lazy(() => import('./pages/GroupBuyConfirmPaymentPage'))
// 🛡️ 2026-05-18: 숙소 공구 사용자 페이지 — PR 3/6, PR 6/6.
const StaysSearchPage = lazy(() => import('./pages/StaysSearchPage'))
const StayDetailPage = lazy(() => import('./pages/StayDetailPage'))
const MyStaysPage = lazy(() => import('./pages/MyStaysPage'))
// 🛡️ 2026-06-12 (전수조사 4차 B-1): 숙소 Toss 결제 returnUrl 경량 confirm 페이지.
const StayCheckoutReturnPage = lazy(() => import('./pages/StayCheckoutReturnPage'))
// 🛡️ 2026-05-18: 인플루언서 referral 대시보드.
const InfluencerDashboardPage = lazy(() => import('./pages/InfluencerDashboardPage'))
// 🛡️ 2026-05-15: PC 랜딩 (자영업자/인플루언서/에이전시 영업)
const BusinessLandingPage = lazy(() => import('./pages/BusinessLandingPage'))
const SellerProspectsPage = lazy(() => import('./pages/SellerProspectsPage'))
const SellerProxyProductsPage = lazy(() => import('./pages/SellerProxyProductsPage'))
const SellerPlusFriendGuidePage = lazy(() => import('./pages/SellerPlusFriendGuidePage'))
const InfluencerLandingPage = lazy(() => import('./pages/InfluencerLandingPage'))
const AgencyPartnerLandingPage = lazy(() => import('./pages/AgencyPartnerLandingPage'))
const InterestListPage = lazy(() => import('./pages/InterestListPage'))
const CouponClaimPage = lazy(() => import('./pages/CouponClaimPage'))
const GiftClaimPage = lazy(() => import('./pages/GiftClaimPage'))

// User 페이지들
const AddressManagementPage = lazy(() => import('./pages/AddressManagementPage'))
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'))
const MyCouponsPage = lazy(() => import('./pages/MyCouponsPage'))
const MyReviewsPage = lazy(() => import('./pages/MyReviewsPage'))
const ReferralIndexPage = lazy(() => import('./pages/ReferralIndexPage'))
const MyCommissionsPage = lazy(() => import('./pages/MyCommissionsPage'))
const MyAppointmentsPage = lazy(() => import('./pages/MyAppointmentsPage'))
const MyGroupBuysPage = lazy(() => import('./pages/MyGroupBuysPage'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'))

// Account (탈퇴) 페이지들
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'))
const AccountDeleteWarningPage = lazy(() => import('./pages/AccountDeleteWarningPage'))
const AccountDeletedPage = lazy(() => import('./pages/AccountDeletedPage'))

const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const BlogListPage = lazy(() => import('./pages/BlogListPage'))
const BlogDetailPage = lazy(() => import('./pages/BlogDetailPage'))
const ReferralPage = lazy(() => import('./pages/ReferralPage'))
const RestaurantMapPage = lazy(() => import('./pages/RestaurantMapPage'))
const UserGroupBuyCreatePage = lazy(() => import('./pages/UserGroupBuyCreatePage'))
const CommunityGroupBuyMessagesPage = lazy(() => import('./pages/CommunityGroupBuyMessagesPage'))

// Error 페이지들
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ServerErrorPage = lazy(() => import('./pages/ServerErrorPage'))

// 약관 페이지들
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const InfluencerTermsPage = lazy(() => import('./pages/InfluencerTermsPage'))
const SellerTermsPage = lazy(() => import('./pages/SellerTermsPage'))
const GroupBuyTermsPage = lazy(() => import('./pages/GroupBuyTermsPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage'))
const GDPRPage = lazy(() => import('./pages/GDPRPage'))
const AffiliatePage = lazy(() => import('./pages/AffiliatePage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))

// 🔧 Debug 페이지
const KakaoDebugPage = lazy(() => import('./pages/KakaoDebugPage'))

// Redirect component for old product URL
function ProductRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/products/${id}`} replace />;
}

// 🛡️ 2026-05-25 (migration 0278): 큐레이터 핀 SPA fallback
//   서버 /api/curator/:handle/p/:productId/redirect 가 302 안 될 때 (SPA pushState 라우팅)
//   client 에서 localStorage.affiliate_ref 직접 세팅 + 클릭 로그 호출 후 상품 페이지로 navigate.
function CuratorPinClientRedirect() {
  const { handle = '', productId = '' } = useParams<{ handle: string; productId: string }>()
  // best-effort: 서버에 클릭 추적 + ref 부여 redirect 위임 → 그래도 SPA 가 가로채면 fallback 으로 직접 navigate.
  // 가장 단순한 영구 방어: window.location.replace 로 서버 302 흐름 강제.
  if (typeof window !== 'undefined' && handle && productId) {
    window.location.replace(`/api/curator/${encodeURIComponent(handle)}/p/${encodeURIComponent(productId)}/redirect`)
    return null
  }
  return <Navigate to={`/products/${productId}`} replace />
}

// 로딩 컴포넌트 — 배경 투명, 최소 UI로 흰 화면 방지
// 🛡️ 2026-04-29: PageLoader — 브랜드 spinner + sr-only "로딩 중" announcement (a11y)
//   짧은 로딩에 깜빡임 방지: 200ms 안에 끝나면 spinner 안 보임.
const PageLoader = () => (
  <div
    className="flex items-center justify-center min-h-screen"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div
      className="w-8 h-8 rounded-full animate-spin"
      style={{
        border: '3px solid rgba(255,255,255,0.08)',
        borderTopColor: '#6b7280',
        animationDelay: '200ms',
      }}
    />
    <span className="sr-only">페이지 로딩 중…</span>
  </div>
)

// 🏭 2026-06-29 (대표 요청 — 도매몰 페이지 로딩 애니메이션): 도매 surface(/wholesale·/supplier)
//   전용 *라이트* 브랜드 로더. 소비자 PageLoader 는 다크(흰 spinner) 라 라이트 도매 배경(#F4F5F7)에서
//   어색 → Suspense fallback 을 surface 별로 분기(아래 isWholesaleSurface). 색상은 WT SSOT
//   (wholesale-theme.ts: ink #0C2454 / brand #FC5424 / fill #F4F5F7 / line2 #E7E9ED)을 인라인 하드코딩 —
//   소비자 메인 청크에 wholesale-theme 를 끌어들이지 않기 위함(값은 브랜드 고정). 멀티-몰 커스텀
//   브랜딩은 로딩 순간엔 기본(유통스타트)으로 표시(전환 잔상 방지보다 단순/안정 우선).
const WholesaleLoader = () => (
  <div
    className="flex flex-col items-center justify-center gap-5 min-h-[100dvh]"
    style={{ background: '#F4F5F7' }}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    {/* 🏷️ 브랜드 로고(라이트 배경용 PNG, public/utong-start-logo.png) — 은은한 pulse 로 '로딩 중' 표현.
        로고 종횡비 900:310 → height 52 / width 151 명시(CLS 0). 로고 교체는 public 파일만 변경하면 반영. */}
    <img
      src="/utong-start-logo.png"
      alt="유통스타트 도매몰"
      width={151}
      height={52}
      decoding="async"
      draggable={false}
      className="w-auto select-none animate-pulse"
      style={{ height: 52 }}
    />
    {/* 회전 아크(오렌지 액센트) — 명확한 로딩 모션. 200ms 후 회전 시작해 짧은 로딩엔 모션 깜빡임 방지 */}
    <div className="relative w-6 h-6">
      <div className="absolute inset-0 rounded-full" style={{ border: '2.5px solid #E7E9ED' }} />
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{ border: '2.5px solid transparent', borderTopColor: '#FC5424', animationDelay: '200ms' }}
      />
    </div>
    <span className="sr-only">유통스타트 도매몰 로딩 중…</span>
  </div>
)

// ✅ Router 내부에서 실행될 컴포넌트
function AppContent() {
  // ✅ authInitialized ref: 중복 초기화 방지 (StrictMode 이중 마운트 대비)
  const authInitialized = useRef(false)

  // 🛡️ 2026-05-01 (D fix): 카카오 OAuth callback URL → localStorage 처리는
  //   src/utils/auth-callback-bootstrap.ts 로 이전됨 (main.tsx 에서 React mount 전 동기 호출).
  //   render 함수 안에서 localStorage / history 를 건드리지 않음 — pure render.

  // 🛡️ 2026-05-01: 카카오 콜백 에러 파라미터 처리 — 무한 로딩 방지.
  //   sync/callback 이 세션 쿠키 발급 실패 / 카카오 토큰 교환 실패 등으로 ?error=... 부착 시
  //   사용자에게 명시적 토스트 + URL 정리. 묵음 실패 → 무한 스피너 시나리오 차단.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const errorCode = urlParams.get('error')
    if (!errorCode) return

    const errorMessages: Record<string, string> = {
      session_cookie_failed: '로그인 세션 발급에 실패했어요. 다시 시도해주세요.',
      kakao_auth_failed: '카카오 인증에 실패했어요. 다시 시도해주세요.',
      kakao_sync_failed: '카카오 로그인에 일시적 문제가 발생했어요. 다시 시도해주세요.',
      database_error: '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
      firebase_config_error: '인증 설정 오류가 발생했어요. 관리자에게 문의해주세요.',
      env_missing: '서버 환경 설정이 누락됐어요. 관리자에게 문의해주세요.',
      no_code: '카카오 인증 코드를 받지 못했어요. 다시 시도해주세요.',
      oauth_state_mismatch: '인증 정보가 만료됐어요. 다시 시도해주세요.',
      oauth_state_expired: '로그인 세션이 만료됐어요. 처음부터 다시 시도해주세요.',
    }
    const msg = errorMessages[errorCode] || `로그인 중 오류가 발생했어요 (${errorCode})`

    import('@/hooks/useToast').then(({ toast }) => toast.error(msg)).catch(swallow('app:oauth-error-toast-import'))

    // 잘못된 세션 흔적 정리 — 모든 카카오 콜백 에러에서 localStorage 인증 흔적 제거.
    //   세션이 발급 안 됐는데 user_id 만 stale 하게 남아있으면 ProtectedRoute 통과 → 401 무한 루프.
    //   database_error 도 포함 (사용자 신고: toss_user_id 컬럼 누락 → INSERT 실패 → /user/profile redirect).
    const authErrors = [
      'session_cookie_failed', 'kakao_auth_failed', 'kakao_sync_failed',
      'database_error', 'firebase_config_error', 'no_code', 'oauth_state_mismatch',
      'env_missing', 'oauth_state_expired',
    ]
    const isKakaoOAuthError = errorCode.startsWith('kakao_oauth_')
    if (authErrors.includes(errorCode) || isKakaoOAuthError) {
      try {
        localStorage.removeItem('user_type')
        localStorage.removeItem('user_id')
        localStorage.removeItem('user_name')
        localStorage.removeItem('user_email')
        localStorage.removeItem('user_profile_image')
        localStorage.removeItem('session_login')
      } catch { /* ignore */ }
      // 🛡️ 2026-05-08: 보호 경로 + OAuth 에러 시 history 를 '/' 로 치환했던 로직 제거.
      // 부작용으로 브라우저 뒤로가기가 이전 페이지가 아닌 메인으로 점프하는 회귀 버그 발생.
      // localStorage 인증 상태가 이미 위에서 클리어되었으므로, 다음 render 에서 ProtectedRoute 가
      // 자연스럽게 /login 으로 redirect 하면서 history 스택은 유지됨.
    }

    urlParams.delete('error'); urlParams.delete('detail')
    const clean = urlParams.toString()
    window.history.replaceState({}, '', clean ? `${window.location.pathname}?${clean}` : window.location.pathname)
  }, [])

  // 🛡️ 2026-05-01: firebase_token URL 처리 useEffect REMOVED.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.has('firebase_token')) {
      p.delete('firebase_token')
      const clean = p.toString()
      window.history.replaceState({}, '', clean ? `${window.location.pathname}?${clean}` : window.location.pathname)
    }
  }, [])

  // 🛡️ 2026-05-02: 카카오 로그인 직후 토스트 제거 (사용자 요청).
  //   이전: '${name}님으로 로그인됐어요. 다른 계정이면 마이페이지에서 전환할 수 있어요.'
  //   sessionStorage 키는 잔존 가능성 있어 cleanup 만 유지.
  useEffect(() => {
    try { sessionStorage.removeItem('ur_kakao_login_welcome') } catch { /* */ }
  }, [])

  // 🛡️ 2026-05-27 (P2 referral): URL ?invite={inviterUserId} 감지 → localStorage 저장.
  //   친구가 초대 링크로 진입 → 가입 (KakaoCallback) 시 referral_tree 등록.
  //   24시간 유효 (timestamp). self-invite 는 KakaoCallback 에서 차단.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const inviter = params.get('invite')
      if (inviter && /^\d+$/.test(inviter)) {
        localStorage.setItem('pending_referral_inviter', JSON.stringify({ id: inviter, ts: Date.now() }))
      }
    } catch { /* ignore */ }
  }, [])

  // ✅ Auth 초기화 — KR 은 Firebase 미사용, 글로벌만 Firebase 초기화.
  useEffect(() => {
    if (authInitialized.current) return
    authInitialized.current = true

    const userType = localStorage.getItem('user_type')

    // Seller/Admin은 Firebase 초기화 불필요 → isAuthReady 즉시 true
    if (userType === 'seller' || userType === 'admin') {
      useAuthKR.getState().setAuthReady(true)
      useAuthWorld.getState().setAuthReady(true)
      return
    }

    // 한국(KR): Firebase 100% 미사용 — 카카오 세션 쿠키 only.
    if (isKorea()) {
      useAuthKR.getState().setAuthReady(true)
      return
    }

    // 글로벌: 세션 쿠키 유저는 Firebase 불필요
    if (localStorage.getItem('user_type') === 'user' && localStorage.getItem('user_id')) {
      useAuthWorld.getState().setAuthReady(true)
      return
    }

    // ✅ 글로벌 전용: Firebase 초기화 (Google/Apple 로그인 등)
    const initAuth = async () => {
      try {
        useAuthWorld.getState().initializeAuth()
      } catch (err) {
        if (import.meta.env.DEV) console.error('[App] ❌ 인증 초기화 실패:', err)
        useAuthWorld.getState().setAuthReady(true)
      }
    }

    initAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 🔄 다중 탭 동기화
  useMultiTabSync()

  const location = useLocation()
  // 🧭 2026-06-10 페이지 전환 페이드 — 첫 로드(LCP)는 제외, 라우트 이동부터 적용.
  const initialLocationKeyRef = useRef(location.key)
  const pageEnterCls = location.key === initialLocationKeyRef.current ? undefined : 'ur-page-enter'

  // 🛡️ 2026-05-27 v5 [UNLOCK_LOADING] (Lighthouse 100점 시도, 사용자 명령):
  //   idle prefetch 전체 제거 — Lighthouse 메인 페이지 측정 시 lazy chunk 동시 fetch → 점수 ↓.
  //   trade-off: 탭 클릭 시 chunk download wait 200-500ms (이전엔 즉시 navigation).
  //   사용자가 메인에서 머무는 동안 prefetch 발생 → 사용자 체감 wait 0 의 효과 포기.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const preload = () => {
      /* idle prefetch 제거 — 탭 클릭 시 lazy load */
      // 🛡️ 2026-05-27 (영구 fix — /host/new fall through 사용자 보고):
      //   로그인 사용자가 BottomNav 의 링크샵 클릭 시 cache 없으면 /u/me → dashboard → /host/new.
      //   idle 시 background 로 dashboard 호출 → linked_seller_username / user_handle localStorage 채움.
      //   다음 링크샵 클릭 즉시 /profile/{username} 또는 /u/{handle} 직행 (0 RTT).
      //   5분 이내 이미 cache 있으면 skip — 불필요한 API 호출 방지.
      const isLoggedIn = !!(localStorage.getItem('user_id') || localStorage.getItem('session_login') ||
                            localStorage.getItem('seller_token') || localStorage.getItem('admin_token'))
      if (isLoggedIn) {
        const lastWarm = Number(localStorage.getItem('linkshop_dashboard_warm_ts') || 0)
        if (Date.now() - lastWarm > 5 * 60_000) {
          import('@/lib/api').then(m => {
            m.default.get('/api/curator/me/dashboard').then((r: { data: { linked_seller?: { username?: string }; handle?: string | null } }) => {
              try {
                if (r.data?.linked_seller?.username) localStorage.setItem('linked_seller_username', r.data.linked_seller.username)
                if (r.data?.handle) localStorage.setItem('user_handle', r.data.handle)
                localStorage.setItem('linkshop_dashboard_warm_ts', String(Date.now()))
              } catch { /* quota / storage 손상 */ }
            }).catch(() => { /* 401 / 네트워크 — silent */ })
          }).catch(() => {})
        }
      }
    }
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
    if (ric) {
      ric(preload, { timeout: 3000 })
    } else {
      const t = setTimeout(preload, 1500)
      return () => clearTimeout(t)
    }
  }, [])

  // 네이티브 앱 + 모바일 브라우저: 페이지에 따라 상태바 스타일 / theme-color 변경
  useEffect(() => {
    // 화이트 테마 페이지 (CLAUDE.md 정책)
    const lightPages = ['/browse', '/vouchers', '/meal-vouchers', '/checkout', '/my-orders', '/account/', '/cart',
      '/referral/', '/map', '/restaurant-map', '/products/', '/wishlist', '/my-vouchers', '/search', '/group-buy', '/community-group-buy']
    const isLight = lightPages.some(p => location.pathname === p || location.pathname.startsWith(p))

    // 1. Capacitor 네이티브 앱 — StatusBar 플러그인
    import('./lib/native').then(({ setStatusBarStyle }) => {
      setStatusBarStyle(isLight ? 'light' : 'dark')
    }).catch((err) => { if (import.meta.env.DEV) console.warn('[App] setStatusBarStyle failed:', err) })

    // 2. 모바일 브라우저 — <meta name="theme-color"> 동적 update
    //    Chrome/Samsung/Edge 가 status bar 배경색을 이 값으로 칠함.
    //    iOS Safari 는 black-translucent 메타라 영향 X (페이지 배경 그대로).
    try {
      // index.html 의 media-query 메타 2개를 dynamic 단일 메타로 override
      const existing = document.querySelectorAll('meta[name="theme-color"]')
      existing.forEach(el => {
        // dynamic override 마크 — re-render 시 같은 노드 재사용
        if (el.getAttribute('data-dynamic') !== '1') el.remove()
      })
      let dynamic = document.querySelector('meta[name="theme-color"][data-dynamic="1"]') as HTMLMetaElement | null
      if (!dynamic) {
        dynamic = document.createElement('meta')
        dynamic.setAttribute('name', 'theme-color')
        dynamic.setAttribute('data-dynamic', '1')
        document.head.appendChild(dynamic)
      }
      dynamic.setAttribute('content', isLight ? '#FFFFFF' : '#020202')
    } catch { /* SSR / 브라우저 미지원 */ }
  }, [location.pathname])

  // 🛡️ 2026-05-25 (migration 0278): 큐레이터 자동 핀 (Phase 1-B).
  //   비로그인 → PinButton 클릭 → localStorage 'pending_pin_product_id' + 카카오 로그인.
  //   로그인 후 App.tsx mount 시 pending 검사 → 자동 핀 추가 + toast.
  //   1탭 UX 의 핵심 — 로그인 후 사용자가 따로 클릭하지 않아도 의도 보존.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (cancelled) return
        const raw = localStorage.getItem('pending_pin_product_id')
        if (!raw) return
        const pid = Number(raw)
        if (!Number.isFinite(pid) || pid <= 0) {
          localStorage.removeItem('pending_pin_product_id')
          return
        }
        const { useAuthStore } = await import('@/client/stores/auth.store')
        const state = useAuthStore.getState() as any
        if (!state?.isAuthenticated || !state?.user) return // 아직 미인증 → 다음 mount 까지 보존
        localStorage.removeItem('pending_pin_product_id')
        const { curatorApi } = await import('@/features/curator/api/curator-api')
        const { toast } = await import('@/hooks/useToast')
        const res = await curatorApi.addPin(pid)
        if (res.success) {
          if (res.handle_just_created && res.handle) {
            toast.success(`🎉 내 링크샵 생성! /u/${res.handle} — 첫 핀이 추가됐어요`)
          } else {
            toast.success('📌 핀이 추가되었어요')
          }
        } else if (res.code === 'ALREADY_PINNED') {
          toast.info('이미 핀에 있는 상품이에요')
        }
      } catch { /* silent — UX 방해 X */ }
    })()
    return () => { cancelled = true }
  }, [])

  // 🛡️ 2026-05-24 (regression fix): /pay/widget 누락 → BottomNav 가 결제 버튼 가림.
  //   결제 위젯 마운트하는 모든 경로는 반드시 여기 등록. 신규 추가 시 tests/unit/toss-fullscreen-routes.test.ts
  //   가 자동 검증 (App.tsx 의 fullScreenPrefixes 와 TossPaymentWidget 마운트 라우트 일치 확인).
  const fullScreenPrefixes = ['/cart', '/checkout', '/payment', '/pay', '/points', '/seller', '/admin', '/agency', '/login', '/register', '/auth', '/embed', '/introduce', '/shorts', '/blog', '/my-orders']
  const fullScreen = fullScreenPrefixes.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
    || location.pathname.startsWith('/live/') // /live/123 은 풀스크린, /live 목록은 아님
  // 🏭 유통스타트 B2B(도매몰/제조사)는 소비자 BottomNav/TopNav 미표시 — 별도 도메인·업태.
  //   isWholesaleSurface = SSOT (`/wholesale*`·`/supplier*`). 같은 헬퍼를 BottomNav·DesktopTopNav
  //   컴포넌트가 자기-차단에도 사용 → 1차(여기서 마운트 차단) + 2차(컴포넌트 self-guard) 이중 방어.
  // 🏁 2026-06-26 [UNLOCK_LOADING] (대표 결정 — "특정 링크로 들어온 방문자는 네비 숨김"):
  //   /u/{handle}?embed=1 로 진입하면 standalone 매장처럼 상/하단 네비를 숨긴다. 한 번 본 플래그는
  //   sessionStorage 로 세션 유지(상품 클릭→뒤로 등 인앱 이동에도 깨끗) + 링크샵 표면(/u·/profile·/s)에서만
  //   적용 → 방문자가 홈 등으로 나가면 네비 복귀(갇힘 방지). 기존 hideBottomNav 조건은 불변(additive).
  const embedFlag = (() => {
    try {
      const sp = new URLSearchParams(location.search)
      if (sp.get('embed') === '1') { sessionStorage.setItem('ur_linkshop_embed', '1'); return true }
      return sessionStorage.getItem('ur_linkshop_embed') === '1'
    } catch { return new URLSearchParams(location.search).get('embed') === '1' }
  })()
  const embedHideNav = embedFlag && /^\/(u|profile|s)(\/|$)/.test(location.pathname)
  const hideBottomNav = fullScreen || location.pathname.startsWith('/products/')
    || isWholesaleSurface(location.pathname) || isMarketingSurface(location.pathname) || embedHideNav
  // 🗺️ 2026-06-20 (대표 — 홈=리스트 / 지도는 버튼 이동): 지도 페이지(/restaurant-map)만 h-screen 자체관리
  //   풀스크린(바텀시트가 하단 담당) → main 하단 네비 여백 제외. 홈(/)=리스트는 일반 페이지(여백 필요).
  //   ⚠️ 도매/제조사(isWholesaleSurface)는 위 hideBottomNav 가 이미 커버(여백 0) — 여기 중복 불필요.
  const mapFullScreen = location.pathname === '/map' || location.pathname === '/restaurant-map'

  return (
    <>
      <FrameWrapper>
        {/* 🏭 2026-06-29 (대표 요청): 도매 surface 는 라이트 브랜드 로더로, 그 외(소비자)는 기존 PageLoader.
            isWholesaleSurface = `/wholesale`·`/supplier` SSOT(소비자 경로엔 byte-동일 — PageLoader 유지). */}
        <Suspense fallback={isWholesaleSurface(location.pathname) ? <WholesaleLoader /> : <PageLoader />}>
          {/* 📐 2026-05-03: PC 풀너비 활성화 — 모바일 폭 강제 제거.
              각 페이지가 자체 `ur-content-narrow/medium/wide/full` 토큰으로 max-width 관리.
              MobileAppLayout 의 `data-mobile-only="true"` (라이브/쇼츠) 페이지는 여전히 430px 액자 유지. */}
          <div className="min-h-dvh">
          {/* 📐 2026-05-03: PC 상단 네비게이션 — 모바일 BottomNav 의 PC 대응. lg+ 에서만 표시. */}
          {!hideBottomNav && <DesktopTopNav />}
          <div className="flex-1">
          {/* 🗑️ 2026-06-20 (대표 요청): 인앱 브라우저 경고 배너(InAppBrowserBanner) 제거 —
              "카카오톡 인앱 브라우저에서는 일부 기능이 제한될 수 있어요" 노이즈. 카카오 로그인은
              이제 정상 동작 + 카톡 인앱은 main.tsx 가 외부 브라우저로 자동 redirect. 복원하려면
              `import InAppBrowserBanner from './components/InAppBrowserBanner'` 후 여기 다시 렌더. */}
          {/* 🗑️ 2026-06-17 (사용자 요청): 앱 설치 팝업(PWAInstallPrompt) 제거 */}
          <Suspense fallback={null}><OnboardingTrigger /></Suspense>
          <Suspense fallback={null}><RestoreAccountModal /></Suspense>
          <OfflineBanner />
          <ConfirmHost />
          <ScrollToTop />
          <Suspense fallback={null}><PushNotificationSetup /></Suspense>
          {/* 🛡️ 2026-06-04 (사용자 신고 — 영구 수정): 모바일 BottomNav(fixed h-14 lg:hidden)가
              콘텐츠 하단을 가림. BottomNav 표시 페이지에만 하단 여백(높이+safe-area) 예약.
              hideBottomNav 페이지(결제/풀스크린/대시보드 등)는 여백 0 — 자체 레이아웃 보존. */}
          {/* 🖥️ 2026-06-20: 하단 네비가 이제 PC(lg+) 액자에도 표시되므로 lg:pb-0 제거 — 모든 뷰포트에서 하단 여백 예약. */}
          <main id="main-content" className={(hideBottomNav || mapFullScreen) ? undefined : 'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]'}>
          <ErrorBoundary key={location.key}>
          {/* 🏭 2026-06-04 도매몰 도메인 SPA 가드 — utongstart.com 비-도매몰 경로 navigate() 차단.
              worker 302(src/worker/index.ts)가 주 방어, 이건 SPA 내부 이동 보강(직접 로드는 worker 가 처리). */}
          {isUtongstart() && !isWholesaleAllowedPath(location.pathname) && <Navigate to="/wholesale" replace />}
          <div key={location.key} className={pageEnterCls}>
          <Routes>
            {/* Public 페이지들 */}
            <Route path="/introduce" element={<IntroducePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/" element={isUtongstart() ? <Navigate to="/wholesale" replace /> : <RestaurantMapPage home mode="list" />} />
            <Route path="/wholesale/intro" element={<WholesaleIntroPage />} />
            <Route path="/wholesale/join" element={<WholesaleJoinPage />} />
            <Route path="/wholesale/login" element={<WholesaleLoginPage />} />
            <Route path="/wholesale" element={<WholesaleCatalogPage key="home" />} />
            {/* 💬 채팅 알림 딥링크 — 같은 카탈로그를 렌더하되 채팅 위젯 자동 오픈(WholesaleChatButton 이 pathname 감지) */}
            <Route path="/wholesale/chat" element={<WholesaleCatalogPage key="home" />} />
            {/* 🏬 2026-06-14 (사용자 요청): 컬렉션 전용 페이지 — 같은 컴포넌트 mode 재사용.
                key 로 컬렉션 전환 시 강제 리마운트(초기 정렬/필터 재적용). */}
            <Route path="/wholesale/best" element={<WholesaleCatalogPage key="best" mode="best" />} />
            <Route path="/wholesale/new" element={<WholesaleCatalogPage key="new" mode="new" />} />
            <Route path="/wholesale/margin" element={<WholesaleCatalogPage key="margin" mode="margin" />} />
            <Route path="/wholesale/premium" element={<WholesaleCatalogPage key="premium" mode="premium" />} />
            <Route path="/wholesale/brands" element={<WholesaleCatalogPage key="brands" mode="brands" />} />
            {/* 🏭 2026-06-27 (대표 — 모든 도매 페이지 공통 상단바): 도매 app 페이지를 WholesaleLayout 으로 감싸
                상단 WholesaleUtilBar(회원·예치금 실시간·충전·대시보드·로그아웃) 자동 표시. 카탈로그는 자체
                풀헤더에 동일 바 존재 → 제외. 인증·랜딩(start/staff-login)·비도매(partnership)도 제외. */}
            <Route element={<WholesaleLayout />}>
              <Route path="/wholesale/dashboard" element={<WholesaleDashboardPage />} />
              <Route path="/wholesale/deposits" element={<WholesaleDepositPage />} />
              <Route path="/wholesale/product/:id" element={<WholesaleProductPage />} />
              <Route path="/wholesale/cart" element={<WholesaleCartPage />} />
              <Route path="/wholesale/checkout" element={<WholesaleCheckoutPage />} />
              <Route path="/wholesale/success" element={<WholesaleSuccessPage />} />
              <Route path="/wholesale/orders" element={<WholesaleOrdersPage />} />
              <Route path="/wholesale/statement" element={<WholesaleStatementPage />} />
              <Route path="/wholesale/documents" element={<WholesaleDocsPage />} />
              <Route path="/wholesale/oem" element={<WholesaleOemPage />} />
              <Route path="/wholesale/quotes" element={<WholesaleQuotesPage />} />
              <Route path="/wholesale/naver" element={<WholesaleNaverPage />} />
              <Route path="/wholesale/board" element={<WholesaleBoardPage />} />
              <Route path="/wholesale/support" element={<WholesaleSupportPage />} />
              <Route path="/wholesale/channels" element={<WholesaleChannelsPage />} />
              <Route path="/wholesale/terms" element={<WholesaleTermsPage />} />
              <Route path="/wholesale/privacy" element={<WholesalePrivacyPage />} />
              <Route path="/wholesale/wishlist" element={<WholesaleWishlistPage />} />
              <Route path="/wholesale/proposals" element={<WholesaleProposalsPage />} />
              <Route path="/wholesale/staff" element={<WholesaleStaffPage />} />
            </Route>
            <Route path="/wholesale/start" element={<WholesaleStartPage />} />
            <Route path="/partnership" element={<PartnershipInquiryPage />} />
            <Route path="/wholesale/staff-login" element={<WholesaleStaffLoginPage />} />
            <Route path="/shorts" element={<ShortsPage />} />
            <Route path="/v/:code" element={<VoucherVerifyPage />} />
            {/* 🛡️ 2026-04-28: 선물 받기 페이지 (인증 불필요) */}
            <Route path="/gift/claim/:token" element={<GiftClaimPage />} />
            <Route path="/store/stats/:productId" element={<StoreStatsPage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/vouchers" element={<VouchersPage />} />
            {/* 🆕 통합 마케팅 서비스(가칭) — 3번째 서비스. 도매몰처럼 자체 surface 로 분리 */}
            {/* 🆕 2026-06-27 /ads = 공개 랜딩(소개), /ads/dashboard = 로그인 후 입점 대시보드 */}
            <Route path="/ads" element={<ErrorBoundary><MarketingLandingPage /></ErrorBoundary>} />
            <Route path="/ads/login" element={<ErrorBoundary><MarketingLoginPage /></ErrorBoundary>} />
            <Route path="/ads/dashboard" element={<ErrorBoundary><MarketingDashboardPage /></ErrorBoundary>} />
            {/* 🛡️ 2026-05-23: 교환권 전용 detail 페이지 (deal 결제). voucher 와 group-buy UI 분리. */}
            <Route path="/vouchers/:id" element={<VoucherDetailPage />} />
            <Route path="/meal-vouchers" element={<MealVouchersPage />} />
            <Route path="/group-buy" element={<GroupBuyListPage />} />
            {/* confirm-payment 가 :id 매칭 우선 — 더 구체적인 path 먼저 */}
            <Route path="/group-buy/confirm-payment" element={<GroupBuyConfirmPaymentPage />} />
            <Route path="/group-buy/:id" element={<GroupBuyDetailPage />} />
            {/* 🛡️ 2026-05-18: 숙소 공구 사용자 페이지 — PR 3/6 */}
            <Route path="/stays" element={<StaysSearchPage />} />
            {/* 🛡️ 2026-06-12 (B-1): Toss returnUrl confirm 페이지 — :id 보다 구체적 path (정적 세그먼트 우선 매칭) */}
            <Route path="/stays/checkout-return" element={<ProtectedRoute requireUser><StayCheckoutReturnPage /></ProtectedRoute>} />
            <Route path="/stays/:id" element={<StayDetailPage />} />
            <Route path="/my-stays" element={<MyStaysPage />} />
            <Route path="/influencer" element={<InfluencerDashboardPage />} />
            {/* 🛡️ 2026-05-15: B2B 랜딩 페이지 — PC 풀 너비, 영업/모집용 */}
            <Route path="/business" element={<BusinessLandingPage />} />
            <Route path="/influencer" element={<InfluencerLandingPage />} />
            <Route path="/agency-partner" element={<AgencyPartnerLandingPage />} />
            {/* 🛡️ 2026-05-27 (영업 검증 Layer 2): 영업자 prospects dashboard. */}
            <Route path="/agency/prospects" element={<SellerProspectsPage />} />
            <Route path="/seller/prospects" element={<SellerProspectsPage />} />
            <Route path="/seller/proxy-products" element={<SellerProxyProductsPage />} />
            <Route path="/seller/plus-friend-guide" element={<SellerPlusFriendGuidePage />} />
            <Route path="/live" element={<LiveListPage />} />
            <Route path="/live/recap/:id" element={<LiveRecapPage />} />
            <Route path="/live/:streamId" element={<ErrorBoundary><LivePageV2 /></ErrorBoundary>} />
            <Route path="/products/:id" element={<ErrorBoundary><ProductDetailPage /></ErrorBoundary>} />
            {/* Redirect old single product URL to plural */}
            <Route path="/product/:id" element={<ProductRedirect />} />
            <Route path="/search" element={<SearchPage />} />

            {/* 🛡️ 2026-05-25 큐레이터 링크샵 (migration 0278) */}
            {/* 🏁 2026-06-15 (옵션 1): /creator = 크리에이터 콘솔 정식 URL (메인 앱 내, 별도 로그인 X). /u/me/earnings 는 하위호환 alias. */}
            <Route path="/creator" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><CuratorEarningsPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/u/me/earnings" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><CuratorEarningsPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            {/* 🏁 2026-06-22 (대표 — 상품/이용권 전용 추가 페이지): 링크샵에 상품·이용권 핀 picker. */}
            <Route path="/u/me/add" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><LinkshopPinPicker /></ErrorBoundary>
              </ProtectedRoute>
            } />
            {/* 🛡️ 2026-05-25: /u/me → 본인 공개페이지 자동 redirect */}
            <Route path="/u/me" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><UMeRedirectPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/u/:handle" element={<ErrorBoundary><CuratorPage /></ErrorBoundary>} />
            {/* SPA fallback: /u/:handle/p/:productId 클릭 시 서버 302 가 작동 안 할 때 ref 부여 후 navigate. */}
            <Route path="/u/:handle/p/:productId" element={<CuratorPinClientRedirect />} />

            {/* 🛡️ 2026-05-25 호스팅 (migration 0280) */}
            <Route path="/host" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><HostingPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/host/new" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><HostingNewPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/g/:invite_code" element={<ErrorBoundary><HostInvitePage /></ErrorBoundary>} />

            {/* 🛡️ 2026-05-25 반품 회수 송장 추적 */}
            <Route path="/my-returns" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><MyReturnsPage /></ErrorBoundary>
              </ProtectedRoute>
            } />

            {/* Public Auth 페이지들 */}
            <Route path="/login" element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } />
            <Route path="/register" element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            } />
            <Route path="/join" element={<JoinChoicePage />} />
            <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
            <Route path="/auth/kakao/sync/callback" element={<KakaoCallbackPage />} />
            <Route path="/auth/kakao/consent/callback" element={<KakaoConsentCallbackPage />} />
            <Route path="/auth/kakao/link/callback" element={<KakaoLinkCallbackPage />} />

            {/* Seller 페이지들 (공개 + 보호) — src/routes/seller.routes.tsx */}
            {/* NOTE: called as function (not JSX component) so RR6 createRoutesFromChildren
                sees the Fragment+Route tree directly instead of a non-Route component wrapper */}
            {SellerRoutes()}

            {/* Admin 페이지들 (공개 + 보호) — src/routes/admin.routes.tsx */}
            {AdminRoutes()}

            {/* Agency 페이지들 (공개 + 보호) — src/routes/agency.routes.tsx */}
            {AgencyRoutes()}

            {/* Supplier(도매 공급자) 페이지들 — src/routes/supplier.routes.tsx (도매몰 INC-6) */}
            {SupplierRoutes()}

            {/* 장바구니: 비로그인도 접근 가능 (결제 시에만 로그인 필요) */}
            <Route path="/cart" element={<ErrorBoundary><CartPage /></ErrorBoundary>} />
            <Route path="/checkout" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><CheckoutPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/mypage" element={
              <ProtectedRoute requireUser>
                <UserProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/user/profile" element={
              <ProtectedRoute requireUser>
                <UserProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/mypage/addresses" element={
              <ProtectedRoute requireUser>
                <AddressManagementPage />
              </ProtectedRoute>
            } />
            <Route path="/mypage/wishlist" element={
              <ProtectedRoute requireUser>
                <WishlistPage />
              </ProtectedRoute>
            } />
            <Route path="/mypage/group-buys" element={
              <ProtectedRoute requireUser>
                <MyGroupBuysPage />
              </ProtectedRoute>
            } />
            <Route path="/community-group-buy/new" element={
              <ProtectedRoute requireUser>
                <UserGroupBuyCreatePage />
              </ProtectedRoute>
            } />
            <Route path="/wishlist" element={
              <ProtectedRoute requireUser>
                <WishlistPage />
              </ProtectedRoute>
            } />
            <Route path="/following" element={
              <ProtectedRoute requireUser>
                <FollowingPage />
              </ProtectedRoute>
            } />
            <Route path="/interest-list" element={
              <ProtectedRoute requireUser>
                <InterestListPage />
              </ProtectedRoute>
            } />
            <Route path="/my-vouchers" element={
              <ProtectedRoute requireUser>
                <MyVouchersPage />
              </ProtectedRoute>
            } />
            {/* 🏪 2026-06-22 사업자 유저 경량 '내 매장'(원장+분쟁) — 풀 셀러 대시보드 대신 앱 내. */}
            <Route path="/my-store" element={
              <ProtectedRoute requireUser>
                <MyStorePage />
              </ProtectedRoute>
            } />
            <Route path="/influencer/settlement" element={
              <ProtectedRoute requireUser>
                <InfluencerSettlementPage />
              </ProtectedRoute>
            } />
            <Route path="/influencer/discover" element={
              <ProtectedRoute requireUser>
                <InfluencerDiscoverPage />
              </ProtectedRoute>
            } />
            <Route path="/influencer/analytics" element={
              <ProtectedRoute requireUser>
                <InfluencerAnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/influencer/rankings" element={<InfluencerRankingsPage />} />
            {/* 🛡️ 2026-05-15: 단골 알림 매트릭스 설정 */}
            <Route path="/my/follows" element={
              <ProtectedRoute requireUser>
                <MyFollowsPage />
              </ProtectedRoute>
            } />
            <Route path="/my/digital" element={
              <ProtectedRoute requireUser>
                <MyDigitalLibraryPage />
              </ProtectedRoute>
            } />
            <Route path="/my-orders" element={
              <ProtectedRoute requireUser>
                <MyOrdersPage />
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute requireUser>
                <MyOrdersPage />
              </ProtectedRoute>
            } />
            <Route path="/my-coupons" element={
              <ProtectedRoute requireUser>
                <MyCouponsPage />
              </ProtectedRoute>
            } />
            <Route path="/my-reviews" element={
              <ProtectedRoute requireUser>
                <MyReviewsPage />
              </ProtectedRoute>
            } />
            <Route path="/referral" element={<ReferralIndexPage />} />
            <Route path="/my-commissions" element={<MyCommissionsPage />} />
            <Route path="/my-appointments" element={<MyAppointmentsPage />} />
            <Route path="/account/settings" element={
              <ProtectedRoute requireUser>
                <AccountSettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/account/delete-warning" element={
              <ProtectedRoute requireUser>
                <AccountDeleteWarningPage />
              </ProtectedRoute>
            } />
            <Route path="/account/deleted" element={<AccountDeletedPage />} />
            <Route path="/notifications" element={
              <ProtectedRoute requireUser>
                <NotificationsPage />
              </ProtectedRoute>
            } />

            {/* Payment 페이지들 */}
            {/* /payment/demo: dev 전용 — 프로덕션 빌드 시 tree-shake */}
            {import.meta.env.DEV && <Route path="/payment/demo" element={<ErrorBoundary><PaymentDemoPage /></ErrorBoundary>} />}

            {/* 임베드 위젯 (외부 서비스용) */}
            <Route path="/embed/live/:streamId" element={<EmbedLivePage />} />
            <Route path="/embed/seller-overlay/:streamId" element={<SellerOverlayPage />} />
            <Route path="/payment/success" element={<ErrorBoundary><PaymentSuccessPage /></ErrorBoundary>} />
            <Route path="/success" element={<ErrorBoundary><PaymentSuccessPage /></ErrorBoundary>} />
            <Route path="/payment/fail" element={<ErrorBoundary><PaymentFailPage /></ErrorBoundary>} />
            {/* 🛡️ 2026-05-23: widget 키 (_wt_) 환경에서 충전/공구 결제용 공용 in-page 위젯 페이지. */}
            <Route path="/pay/widget" element={<ProtectedRoute requireUser><TossWidgetPayPage /></ProtectedRoute>} />
            {/* 🛡️ 2026-05-23: 결제 진단 페이지 (운영자 ground truth 수집용).
                🔒 2026-06-12 (4차 감사 D6): prod 에선 어드민 토큰 필요 (진단 도구라 DEV 게이트로
                죽이지 않고 requireAdmin — ERROR_DEBUGGING_PLAYBOOK 의 ground truth 수집 용도 보존). */}
            <Route path="/toss-debug" element={
              import.meta.env.DEV
                ? <ErrorBoundary><TossDebugPage /></ErrorBoundary>
                : <ProtectedRoute requireAdmin><ErrorBoundary><TossDebugPage /></ErrorBoundary></ProtectedRoute>
            } />

            {/* 딜 포인트 충전 — iOS IAP 게이트(플래그 OFF 기본=children 그대로) */}
            <Route path="/points/charge" element={<ProtectedRoute requireUser><IosTopupGate><PointsChargePage /></IosTopupGate></ProtectedRoute>} />
            <Route path="/points/charge/success" element={<ErrorBoundary><PointsChargeSuccessPage /></ErrorBoundary>} />
            <Route path="/my-deal-history" element={<ProtectedRoute requireUser><MyDealHistoryPage /></ProtectedRoute>} />
            <Route path="/points/charge/fail" element={<ErrorBoundary><PaymentFailPage /></ErrorBoundary>} />
            <Route path="/fail" element={<ErrorBoundary><PaymentFailPage /></ErrorBoundary>} />

            {/* 친구 초대 공동구매 */}
            <Route path="/referral/:code" element={<ReferralPage />} />

            {/* 맛집 지도 */}
            {/* 🗺️ 2026-06-23 (대표 — 주소 간소화): 지도 페이지 canonical = /map. 옛 /restaurant-map 은 리다이렉트(북마크/외부링크 보존). */}
            <Route path="/map" element={<RestaurantMapPage />} />
            <Route path="/restaurant-map" element={<Navigate to="/map" replace />} />

            {/* 블로그 */}
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />

            {/* Terms Pages */}
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/terms/influencer" element={<InfluencerTermsPage />} />
            <Route path="/terms/seller" element={<SellerTermsPage />} />
            <Route path="/terms/group-buy" element={<GroupBuyTermsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/gdpr" element={<GDPRPage />} />
            <Route path="/user/affiliate" element={<AffiliatePage />} />
            <Route path="/refund" element={<RefundPolicyPage />} />
            <Route path="/faq" element={<FAQPage />} />
            {/* ✅ 마이페이지 메뉴에서 사용하는 긴 형식 경로 → 짧은 경로로 리다이렉트 */}
            <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
            <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
            <Route path="/refund-policy" element={<Navigate to="/refund" replace />} />
            <Route path="/shipping-policy" element={<Navigate to="/refund" replace />} />
            <Route path="/coupon/:code" element={<CouponClaimPage />} />

            {/* 커뮤니티 공구 상세 (ReferralPage 재사용) */}
            <Route path="/community-group-buy/:code" element={<ReferralPage />} />
            {/* 🔗 2026-06-12 (4차 감사 #1): 알림 딥링크 착지 — 참여자/제안자/식당 메시지 스레드 */}
            <Route path="/community-group-buy/:code/messages" element={<CommunityGroupBuyMessagesPage />} />

            {/* Debug 페이지 (개발 환경만) — 프로덕션에선 라우트 등록 안 됨 */}
            {import.meta.env.DEV && <Route path="/kakao-debug" element={<KakaoDebugPage />} />}

            {/* Error 페이지들 */}
            <Route path="/500" element={<ServerErrorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </div>
          </ErrorBoundary>
          </main>
          </div>
          {!hideBottomNav && <BottomNav />}
          {!fullScreen && <Suspense fallback={null}><SideBanner /></Suspense>}
          {/* 🛡️ 2026-05-24 (사용자 명령): 우하단 카카오 FAB 잠시 숨김 (featureFlags.kakaoFab=false).
              복원: src/shared/config/feature-flags.ts 의 kakaoFab 을 true 로. 대신 /user/profile 페이지에 별도 배치. */}
          {!fullScreen && featureFlags.kakaoFab && <KakaoConsultButton />}
          </div>
        </Suspense>
      </FrameWrapper>
      <ToastContainer />
      <NewVersionBanner />
    </>
  )
}

// 🛡️ 2026-05-28 (SSR Phase 3 Step 3-1): Router 를 prop 으로 받음.
//   client: <App /> → BrowserRouter (기존 동작 100% 보존).
//   server: <App Router={StaticRouter} routerProps={{ location: url }} />.
//   타입: ComponentType 추상화 (BrowserRouter 와 StaticRouter prop 인터페이스 다름).
import type { ComponentType, ReactNode } from 'react'
type RouterLike = ComponentType<{ children?: ReactNode; [key: string]: unknown }>
export type { RouterLike }

interface AppProps {
  Router?: RouterLike
  routerProps?: Record<string, unknown>
}

function App({
  Router = BrowserRouter as unknown as RouterLike,
  routerProps = { future: { v7_startTransition: true, v7_relativeSplatPath: true } },
}: AppProps = {}) {
  return (
    <ErrorBoundary>
      <ChunkErrorBoundary>
        <HelmetProvider>
          <QueryProvider>
            <Router {...routerProps}>
              <AppContent />
            </Router>
          </QueryProvider>
        </HelmetProvider>
      </ChunkErrorBoundary>
    </ErrorBoundary>
  )
}

export default App
