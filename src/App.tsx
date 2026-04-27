import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import ErrorBoundary from './components/ErrorBoundary'
import { ChunkErrorBoundary } from './components/utils/ChunkErrorBoundary'
import FrameWrapper from './components/FrameWrapper'
import { useMultiTabSync } from './hooks/useMultiTabSync'
import ScrollToTop from './components/ScrollToTop'
import PushNotificationSetup from './components/PushNotificationSetup'
import OfflineBanner from './components/OfflineBanner'
import SecurityReloginBanner from './components/SecurityReloginBanner'
import BottomNav from '@/components/main/BottomNav'
import SideBanner from '@/components/SideBanner'
import KakaoConsultButton from '@/components/KakaoConsultButton'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'

// Redirect component for old product URL
function AgencyAuthGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('agency_token')
  if (!token) return <Navigate to="/agency/login" replace />
  return <>{children}</>
}

function ProductRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/products/${id}`} replace />;
}
import { QueryProvider } from './lib/react-query'
import { ProtectedRoute, PublicRoute } from './components/auth/RouteGuards'
import ToastContainer from './components/ToastContainer'

// ❌ REMOVED: Duplicate Sentry initialization (already done in main.tsx)

// ✅ 모든 페이지를 lazy loading (초기 번들 크기 최소화)
const MainHomePage = lazy(() => import('./pages/MainHomePage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const ShortsPage = lazy(() => import('./pages/ShortsPage'))
const IntroducePage = lazy(() => import('./pages/IntroducePage'))

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const KakaoCallbackPage = lazy(() => import('./pages/KakaoCallbackPage'))
const KakaoConsentCallbackPage = lazy(() => import('./pages/KakaoConsentCallbackPage'))
const KakaoLinkCallbackPage = lazy(() => import('./pages/KakaoLinkCallbackPage'))
const LivePageV2 = lazy(() => import('./pages/LivePageV2'))
const LiveListPage = lazy(() => import('./pages/LiveListPage'))
const PaymentDemoPage = lazy(() => import('./pages/PaymentDemoPage'))
const EmbedLivePage = lazy(() => import('./pages/EmbedLivePage'))
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'))
const PaymentFailPage = lazy(() => import('./pages/PaymentFailPage'))
const PointsChargePage = lazy(() => import('./pages/PointsChargePage'))
const PointsChargeSuccessPage = lazy(() => import('./pages/PointsChargeSuccessPage'))
const CartPage = lazy(() => import('./pages/CartPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'))
const WishlistPage = lazy(() => import('./pages/WishlistPage'))
const MyVouchersPage = lazy(() => import('./pages/MyVouchersPage'))
const VoucherVerifyPage = lazy(() => import('./pages/VoucherVerifyPage'))
const SellerGroupBuyPage = lazy(() => import('./pages/SellerGroupBuyPage'))
const SellerBundlesPage = lazy(() => import('./pages/SellerBundlesPage'))
const SellerGuidePage = lazy(() => import('./pages/SellerGuidePage'))
const AgencyGuidePage = lazy(() => import('./pages/AgencyGuidePage'))
const SellerMealVoucherNewPage = lazy(() => import('./pages/SellerMealVoucherNewPage'))
const StoreStatsPage = lazy(() => import('./pages/StoreStatsPage'))
const BrowsePage = lazy(() => import('./pages/BrowsePage'))
const GroupBuyListPage = lazy(() => import('./pages/GroupBuyListPage'))
const InterestListPage = lazy(() => import('./pages/InterestListPage'))
const CouponClaimPage = lazy(() => import('./pages/CouponClaimPage'))

// Seller 페이지들
const SellerPage = lazy(() => import('./pages/SellerPage'))
const SellerLoginPage = lazy(() => import('./pages/SellerLoginPage'))
const SellerRegisterPage = lazy(() => import('./pages/SellerRegisterPage'))
const SellerRegisterBusinessPage = lazy(() => import('./pages/SellerRegisterBusinessPage'))
const SellerWaitingPage = lazy(() => import('./pages/SellerWaitingPage'))
const SellerTikTokCallbackPage = lazy(() => import('./pages/SellerTikTokCallbackPage'))
const AgencyRegisterBusinessPage = lazy(() => import('./pages/AgencyRegisterBusinessPage'))
const AgencyWaitingPage = lazy(() => import('./pages/AgencyWaitingPage'))
const SellerForgotPasswordPage = lazy(() => import('./pages/SellerForgotPasswordPage'))
const SellerResetPasswordPage = lazy(() => import('./pages/SellerResetPasswordPage'))
const SellerBusinessInfoPage = lazy(() => import('./pages/SellerBusinessInfoPage'))
const SellerOrdersPage = lazy(() => import('./pages/SellerOrdersPage'))
const SellerProductsPage = lazy(() => import('./pages/SellerProductsPage'))
const SellerInventoryPage = lazy(() => import('./pages/SellerInventoryPage'))
const SellerProductNewPage = lazy(() => import('./pages/SellerProductNewPage'))
const SellerProductEditPage = lazy(() => import('./pages/SellerProductEditPage'))
const SellerStreamNewPage = lazy(() => import('./pages/SellerStreamNewPage'))
const SellerStreamEditPage = lazy(() => import('./pages/SellerStreamEditPage'))
const SellerProfileEditPage = lazy(() => import('./pages/SellerProfileEditPage'))
const SellerPublicPage = lazy(() => import('./pages/SellerPublicPage'))
const SellerSettlementsPage = lazy(() => import('./pages/SellerSettlementsPage'))
const SellerAlimtalkPage = lazy(() => import('./pages/SellerAlimtalkPage'))
const SellerYoutubeGrowthPage = lazy(() => import('./pages/SellerYoutubeGrowthPage'))
const SellerYoutubeGrowthSuccessPage = lazy(() => import('./pages/SellerYoutubeGrowthSuccessPage'))
const SellerDonationsPage = lazy(() => import('./pages/SellerDonationsPage'))
const SellerShortsPage = lazy(() => import('./pages/SellerShortsPage'))
const SellerLiveBroadcastPage = lazy(() => import('./pages/SellerLiveBroadcastPage'))
const SellerLiveAnalyticsPage = lazy(() => import('./pages/SellerLiveAnalyticsPage'))
const SellerAnalyticsPage = lazy(() => import('./pages/SellerAnalyticsPage'))
const SellerReviewsPage = lazy(() => import('./pages/SellerReviewsPage'))
const SellerCouponsPage = lazy(() => import('./pages/SellerCouponsPage'))
const SellerSupplyPage = lazy(() => import('./pages/SellerSupplyPage'))
const YouTubeCallbackPage = lazy(() => import('./pages/YouTubeCallbackPage'))

// User 페이지들
const AddressManagementPage = lazy(() => import('./pages/AddressManagementPage'))
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'))
const MyCouponsPage = lazy(() => import('./pages/MyCouponsPage'))
const MyReviewsPage = lazy(() => import('./pages/MyReviewsPage'))
const ReferralIndexPage = lazy(() => import('./pages/ReferralIndexPage'))
const MyGroupBuysPage = lazy(() => import('./pages/MyGroupBuysPage'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'))

// Account (탈퇴) 페이지들
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'))
const AccountDeleteWarningPage = lazy(() => import('./pages/AccountDeleteWarningPage'))
const AccountDeletedPage = lazy(() => import('./pages/AccountDeletedPage'))

// Admin 페이지들
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const AdminSettlementPage = lazy(() => import('./pages/AdminSettlementPage'))
const AdminBannersPage = lazy(() => import('./pages/AdminBannersPage'))
const AdminOrdersPage = lazy(() => import('./pages/AdminOrdersPage'))
const AdminProductsPage = lazy(() => import('./pages/AdminProductsPage'))
const AdminAlimtalkPricingPage = lazy(() => import('./pages/admin/AdminAlimtalkPricingPage'))
const KVMonitoringPage = lazy(() => import('./pages/admin/KVMonitoringPage'))
const AdminCafe24Page = lazy(() => import('./pages/admin/AdminCafe24Page'))
const AdminKakaoTestPage = lazy(() => import('./pages/admin/AdminKakaoTestPage'))
const AdminKakaoTestCallbackPage = lazy(() => import('./pages/admin/AdminKakaoTestCallbackPage'))
const AdminSampleRequestsPage = lazy(() => import('./pages/admin/AdminSampleRequestsPage'))
const AdminOperationsGuidePage = lazy(() => import('./pages/admin/AdminOperationsGuidePage'))
const AdminBlogPage = lazy(() => import('./pages/AdminBlogPage'))
const AdminAgencyPage = lazy(() => import('./pages/AdminAgencyPage'))
const AdminSellerApprovalPage = lazy(() => import('./pages/AdminSellerApprovalPage'))
const AdminAgencyCreatorApprovalPage = lazy(() => import('./pages/AdminAgencyCreatorApprovalPage'))
const AdminSettlementsBulkPage = lazy(() => import('./pages/AdminSettlementsBulkPage'))
const AdminNoticesPage = lazy(() => import('./pages/AdminNoticesPage'))
const AdminPlatformSettingsPage = lazy(() => import('./pages/AdminPlatformSettingsPage'))
const AdminDealMonitorPage = lazy(() => import('./pages/AdminDealMonitorPage'))
const AdminReviewsPage = lazy(() => import('./pages/AdminReviewsPage'))
const AdminReplayPage = lazy(() => import('./pages/AdminReplayPage'))
const AdminCouponsPage = lazy(() => import('./pages/AdminCouponsPage'))
const AdminAuditLogPage = lazy(() => import('./pages/AdminAuditLogPage'))
const AdminRevenueAnalyticsPage = lazy(() => import('./pages/AdminRevenueAnalyticsPage'))
const AdminAccountsPage = lazy(() => import('./pages/AdminAccountsPage'))
const AdminLiveMonitorPage = lazy(() => import('./pages/AdminLiveMonitorPage'))
const AdminHealthPage = lazy(() => import('./pages/AdminHealthPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const AdminReviewModerationPage = lazy(() => import('./pages/AdminReviewModerationPage'))
// Agency 페이지들
const AgencyLoginPage = lazy(() => import('./pages/AgencyLoginPage'))
const AgencyForgotPasswordPage = lazy(() => import('./pages/AgencyForgotPasswordPage'))
const AgencyResetPasswordPage = lazy(() => import('./pages/AgencyResetPasswordPage'))
const AgencyPage = lazy(() => import('./pages/AgencyPage'))
const AgencySellersPage = lazy(() => import('./pages/AgencySellersPage'))
const AgencyOrdersPage = lazy(() => import('./pages/AgencyOrdersPage'))
const AgencyStreamsPage = lazy(() => import('./pages/AgencyStreamsPage'))
const AgencyStatsPage = lazy(() => import('./pages/AgencyStatsPage'))
const AgencySettlementsPage = lazy(() => import('./pages/AgencySettlementsPage'))
const AgencyRankingPage = lazy(() => import('./pages/AgencyRankingPage'))
const AgencySchedulePage = lazy(() => import('./pages/AgencySchedulePage'))
const AgencyReturnsPage = lazy(() => import('./pages/AgencyReturnsPage'))
const AgencyProductsPage = lazy(() => import('./pages/AgencyProductsPage'))
const AgencyProfilePage = lazy(() => import('./pages/AgencyProfilePage'))
const AgencyNoticesPage = lazy(() => import('./pages/AgencyNoticesPage'))
const AgencyComparePage = lazy(() => import('./pages/AgencyComparePage'))
const AgencyContractsPage = lazy(() => import('./pages/AgencyContractsPage'))
const AgencyTargetsPage = lazy(() => import('./pages/AgencyTargetsPage'))
const AgencyCampaignsPage = lazy(() => import('./pages/AgencyCampaignsPage'))
const AgencyIncentivesPage = lazy(() => import('./pages/AgencyIncentivesPage'))
const AgencyMessagesPage = lazy(() => import('./pages/AgencyMessagesPage'))
const AgencyCouponsPage = lazy(() => import('./pages/AgencyCouponsPage'))
const AgencyMembersPage = lazy(() => import('./pages/AgencyMembersPage'))
const AgencyCalendarPage = lazy(() => import('./pages/AgencyCalendarPage'))
const AgencyInvitesPage = lazy(() => import('./pages/AgencyInvitesPage'))
const AgencyPublicPage = lazy(() => import('./pages/AgencyPublicPage'))
const AgencyPKBattlesPage = lazy(() => import('./pages/AgencyPKBattlesPage'))
const AgencyTransfersPage = lazy(() => import('./pages/AgencyTransfersPage'))
const SellerCastingsPage = lazy(() => import('./pages/SellerCastingsPage'))
const AdminTikTokDiscoveryPage = lazy(() => import('./pages/AdminTikTokDiscoveryPage'))
const AdminCastingsPage = lazy(() => import('./pages/AdminCastingsPage'))
const AgencyRegisterPage = lazy(() => import('./pages/AgencyRegisterPage'))
const AgencyGroupBuyPage = lazy(() => import('./pages/AgencyGroupBuyPage'))

const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const BlogListPage = lazy(() => import('./pages/BlogListPage'))
const BlogDetailPage = lazy(() => import('./pages/BlogDetailPage'))
const ReferralPage = lazy(() => import('./pages/ReferralPage'))
const RestaurantMapPage = lazy(() => import('./pages/RestaurantMapPage'))
const UserGroupBuyCreatePage = lazy(() => import('./pages/UserGroupBuyCreatePage'))

// Error 페이지들
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ServerErrorPage = lazy(() => import('./pages/ServerErrorPage'))

// 약관 페이지들
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage'))
const GDPRPage = lazy(() => import('./pages/GDPRPage'))
const AffiliatePage = lazy(() => import('./pages/AffiliatePage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))

// 🔧 Debug 페이지
const KakaoDebugPage = lazy(() => import('./pages/KakaoDebugPage'))

// 로딩 컴포넌트 — 배경 투명, 최소 UI로 흰 화면 방지
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
  </div>
)

// ✅ Router 내부에서 실행될 컴포넌트
function AppContent() {
  // ✅ authInitialized ref: 중복 초기화 방지 (StrictMode 이중 마운트 대비)
  const authInitialized = useRef(false)

  // ✅ 카카오 로그인 콜백: URL 파라미터 → localStorage (동기, 렌더 전 실행)
  // useEffect가 아닌 useMemo로 첫 렌더 전에 처리해야 ProtectedRoute가 통과됨
  const loginParamsProcessed = useRef(false)
  if (!loginParamsProcessed.current) {
    loginParamsProcessed.current = true
    const urlParams = new URLSearchParams(window.location.search)

    if (urlParams.get('login') === 'success' && urlParams.get('userId')) {
      // ── 카카오 로그인 성공: localStorage 즉시 설정 ──
      localStorage.setItem('user_type', 'user')
      localStorage.setItem('user_id', urlParams.get('userId')!)
      localStorage.setItem('session_login', 'true')
      const userName = urlParams.get('userName')
      const userEmail = urlParams.get('userEmail')
      const profileImage = urlParams.get('profileImage')
      if (userName) localStorage.setItem('user_name', userName)
      if (userEmail) localStorage.setItem('user_email', userEmail)
      if (profileImage) localStorage.setItem('user_profile_image', profileImage.replace(/^http:\/\//, 'https://'))

      // 🛡️ linked seller/agency token transfer (Worker sync/callback 이 세팅한 cookie 읽기)
      // 카카오 연동된 셀러/에이전시는 이 시점에 seller_token/agency_token 자동 획득
      const readCookie = (name: string): string | null => {
        const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(document.cookie)
        return match ? decodeURIComponent(match[1]) : null
      }
      const clearCookie = (name: string) => {
        document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure`
      }
      const sellerToken = readCookie('ur_pending_seller_token')
      if (sellerToken) {
        localStorage.setItem('seller_token', sellerToken)
        const sellerInfoRaw = readCookie('ur_pending_seller_info')
        if (sellerInfoRaw) {
          try {
            const info = JSON.parse(sellerInfoRaw)
            if (info.id) localStorage.setItem('seller_id', String(info.id))
            if (info.business_name) localStorage.setItem('seller_name', info.business_name)
          } catch { /* ignore */ }
        }
        clearCookie('ur_pending_seller_token')
        clearCookie('ur_pending_seller_info')
      }
      const agencyToken = readCookie('ur_pending_agency_token')
      if (agencyToken) {
        localStorage.setItem('agency_token', agencyToken)
        const agencyInfoRaw = readCookie('ur_pending_agency_info')
        if (agencyInfoRaw) {
          try {
            const info = JSON.parse(agencyInfoRaw)
            if (info.id) localStorage.setItem('agency_id', String(info.id))
            if (info.name) localStorage.setItem('agency_name', info.name)
          } catch { /* ignore */ }
        }
        clearCookie('ur_pending_agency_token')
        clearCookie('ur_pending_agency_info')
      }

      // URL 정리 (auth 파라미터 제거)
      urlParams.delete('login'); urlParams.delete('userId'); urlParams.delete('userName')
      urlParams.delete('userEmail'); urlParams.delete('profileImage')
      const clean = urlParams.toString()
      window.history.replaceState({}, '', clean ? `${window.location.pathname}?${clean}` : window.location.pathname)
    } else if (urlParams.has('firebase_token')) {
      if (isKorea()) {
        // 한국: firebase_token에서 claims를 디코딩하여 localStorage 설정
        const token = urlParams.get('firebase_token')!
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          const claims = payload.claims || {}
          localStorage.setItem('user_type', 'user')
          if (claims.userId) localStorage.setItem('user_id', String(claims.userId))
          if (claims.userName) localStorage.setItem('user_name', claims.userName)
          if (claims.email) localStorage.setItem('user_email', claims.email)
          if (claims.profileImage) localStorage.setItem('user_profile_image', claims.profileImage.replace(/^http:\/\//, 'https://'))
          localStorage.setItem('session_login', 'true')
        } catch { /* JWT decode failed — ignore */ }
        // URL에서 userName/profileImage도 체크
        const urlUserName = urlParams.get('userName')
        const urlProfileImage = urlParams.get('profileImage')
        if (urlUserName) localStorage.setItem('user_name', urlUserName)
        if (urlProfileImage) localStorage.setItem('user_profile_image', urlProfileImage.replace(/^http:\/\//, 'https://'))
        // URL 정리
        urlParams.delete('firebase_token'); urlParams.delete('userName'); urlParams.delete('profileImage')
        const clean = urlParams.toString()
        window.history.replaceState({}, '', clean ? `${window.location.pathname}?${clean}` : window.location.pathname)
      }
      // 글로벌: firebase_token은 아래 useEffect에서 비동기 처리
    }
  }

  // ✅ 글로벌 전용: firebase_token 비동기 처리 (Firebase SDK 필요)
  useEffect(() => {
    if (isKorea()) return
    const urlParams = new URLSearchParams(window.location.search)
    const firebaseToken = urlParams.get('firebase_token')
    if (!firebaseToken) return

    ;(async () => {
      try {
        const urlUserName = urlParams.get('userName') || ''
        const urlProfileImage = urlParams.get('profileImage') || ''
        const { signInWithCustomToken } = await import('@/lib/firebase-auth')
        const cred = await signInWithCustomToken(firebaseToken)
        const idToken = await cred.user.getIdToken(true)
        const tokenResult = await cred.user.getIdTokenResult(true)
        const numericUserId = tokenResult.claims?.userId || tokenResult.claims?.user_id || 0
        const claimsUserName = (tokenResult.claims?.userName as string) || urlUserName

        localStorage.setItem('user_type', 'user')
        localStorage.setItem('user_id', cred.user.uid)
        localStorage.setItem('lastLoginUid', cred.user.uid)
        if (claimsUserName) localStorage.setItem('user_name', claimsUserName)
        if (urlProfileImage) localStorage.setItem('user_profile_image', urlProfileImage.replace(/^http:\/\//, 'https://'))
        localStorage.setItem('numeric_user_id', String(numericUserId))

        const { useAuthWorld } = await import('@/shared/stores/useAuthWorld')
        useAuthWorld.getState().setUser(cred.user)
        useAuthWorld.getState().setAuthReady(true)
      } catch (err) {
        if (import.meta.env.DEV) console.error('[App] Firebase token login failed:', err)
      } finally {
        const p = new URLSearchParams(window.location.search)
        p.delete('firebase_token'); p.delete('userName'); p.delete('profileImage')
        const clean = p.toString()
        window.history.replaceState({}, '', clean ? `${window.location.pathname}?${clean}` : window.location.pathname)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ 핵심 수정: 단일 Auth 초기화 (중복 구독 완전 제거)
  // - initializeAuth() 하나만 호출 (내부에서 onAuthStateChanged 구독)
  // - Seller/Admin은 Firebase 로딩을 기다리지 않음 (localStorage JWT 즉시 체크)
  useEffect(() => {
    if (authInitialized.current) return
    authInitialized.current = true

    const userType = localStorage.getItem('user_type')

    // ✅ Seller/Admin은 Firebase 초기화 불필요 → isAuthReady를 즉시 true로
    if (userType === 'seller' || userType === 'admin') {
      useAuthKR.getState().setAuthReady(true)
      useAuthWorld.getState().setAuthReady(true)
      return
    }

    // ✅ 한국(KR): Firebase 초기화 완전 건너뜀
    // 카카오 로그인은 세션 쿠키 기반이므로 Firebase 불필요
    // ProtectedRoute는 localStorage (user_type + user_id)만 체크
    if (isKorea()) {
      useAuthKR.getState().setAuthReady(true)
      return
    }

    // ✅ 글로벌: 세션 쿠키 유저는 Firebase 불필요
    if (localStorage.getItem('user_type') === 'user' && localStorage.getItem('user_id')) {
      useAuthWorld.getState().setAuthReady(true)
      return
    }

    // firebase_token이 URL에 있으면 위 useEffect가 처리하므로 init 불필요
    if (new URLSearchParams(window.location.search).has('firebase_token')) {
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

  // 네이티브 앱: 페이지에 따라 상태바 스타일 변경
  useEffect(() => {
    import('./lib/native').then(({ setStatusBarStyle }) => {
      // 화이트 테마 페이지는 light 상태바 (검은 텍스트)
      const lightPages = ['/browse', '/checkout', '/my-orders', '/account/', '/cart',
        '/referral/', '/restaurant-map', '/products/', '/wishlist', '/my-vouchers', '/search', '/group-buy', '/community-group-buy']
      const isLight = lightPages.some(p => location.pathname === p || location.pathname.startsWith(p))
      setStatusBarStyle(isLight ? 'light' : 'dark')
    }).catch(() => {})
  }, [location.pathname])
  const fullScreenPrefixes = ['/cart', '/checkout', '/payment', '/points', '/seller', '/admin', '/agency', '/login', '/register', '/auth', '/embed', '/introduce', '/shorts', '/blog', '/my-orders']
  const fullScreen = fullScreenPrefixes.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
    || location.pathname.startsWith('/live/') // /live/123 은 풀스크린, /live 목록은 아님
  const hideBottomNav = fullScreen || location.pathname.startsWith('/products/')

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-[100] focus:bg-white focus:text-gray-900 focus:px-4 focus:py-2 focus:rounded-br focus:shadow">
        본문으로 건너뛰기
      </a>
      <FrameWrapper>
        <Suspense fallback={<PageLoader />}>
          <div className={fullScreen ? 'min-h-dvh' : 'max-w-[430px] mx-auto bg-white min-h-dvh'}>
          <div className="flex-1">
          <OfflineBanner />
          <ScrollToTop />
          <PushNotificationSetup />
          <main id="main-content">
          <Routes>
            {/* Public 페이지들 */}
            <Route path="/introduce" element={<IntroducePage />} />
            <Route path="/" element={<MainHomePage />} />
            <Route path="/shorts" element={<ShortsPage />} />
            <Route path="/v/:code" element={<VoucherVerifyPage />} />
            <Route path="/store/stats/:productId" element={<StoreStatsPage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/group-buy" element={<GroupBuyListPage />} />
            <Route path="/live" element={<LiveListPage />} />
            <Route path="/live/:streamId" element={<ErrorBoundary><LivePageV2 /></ErrorBoundary>} />
            <Route path="/products/:id" element={<ErrorBoundary><ProductDetailPage /></ErrorBoundary>} />
            {/* Redirect old single product URL to plural */}
            <Route path="/product/:id" element={<ProductRedirect />} />
            <Route path="/s/:sellerId" element={<SellerPublicPage />} />
            <Route path="/profile/:sellerId" element={<SellerPublicPage />} />
            <Route path="/search" element={<SearchPage />} />
            
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
            <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
            <Route path="/auth/kakao/sync/callback" element={<KakaoCallbackPage />} />
            
            {/* Seller 로그인 페이지 (Public) */}
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
            
            {/* Seller Protected 페이지들 */}
            <Route path="/seller" element={
              <ProtectedRoute requireSeller>
                <SellerPage />
              </ProtectedRoute>
            } />
            <Route path="/seller/dashboard" element={<Navigate to="/seller" replace />} />
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
            <Route path="/seller/orders" element={
              <ProtectedRoute requireSeller>
                <SellerOrdersPage />
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
            <Route path="/seller/meal-voucher/new" element={
              <ProtectedRoute requireSeller>
                <ErrorBoundary><SellerMealVoucherNewPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
<Route path="/seller/live-broadcast" element={
              <ProtectedRoute requireSeller>
                <SellerLiveBroadcastPage />
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
            <Route path="/admin/deals" element={
              <ProtectedRoute requireAdmin>
                <ErrorBoundary><AdminDealMonitorPage /></ErrorBoundary>
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
            <Route path="/auth/kakao/consent/callback" element={<KakaoConsentCallbackPage />} />
            <Route path="/auth/kakao/link/callback" element={<KakaoLinkCallbackPage />} />
            <Route path="/admin/kakao-test/callback" element={<AdminKakaoTestCallbackPage />} />
            <Route path="/admin/tiktok-discovery" element={
              <ProtectedRoute requireAdmin>
                <ErrorBoundary><AdminTikTokDiscoveryPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/admin/castings" element={
              <ProtectedRoute requireAdmin>
                <ErrorBoundary><AdminCastingsPage /></ErrorBoundary>
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

            {/* Agency 대시보드 — login/register는 공개, 나머지는 인증 필요 */}
            <Route path="/agency/login" element={<AgencyLoginPage />} />
            <Route path="/agency/register" element={<AgencyRegisterPage />} />
            <Route path="/agency/register/business" element={<AgencyRegisterBusinessPage />} />
            <Route path="/agency/waiting" element={<AgencyWaitingPage />} />
            <Route path="/agency/forgot-password" element={<AgencyForgotPasswordPage />} />
            <Route path="/agency/reset-password" element={<AgencyResetPasswordPage />} />
            <Route path="/agency" element={<AgencyAuthGuard><AgencyPage /></AgencyAuthGuard>} />
            <Route path="/agency/sellers" element={<AgencyAuthGuard><AgencySellersPage /></AgencyAuthGuard>} />
            <Route path="/agency/orders" element={<AgencyAuthGuard><AgencyOrdersPage /></AgencyAuthGuard>} />
            <Route path="/agency/streams" element={<AgencyAuthGuard><AgencyStreamsPage /></AgencyAuthGuard>} />
            <Route path="/agency/stats" element={<AgencyAuthGuard><AgencyStatsPage /></AgencyAuthGuard>} />
            <Route path="/agency/guide" element={<AgencyAuthGuard><AgencyGuidePage /></AgencyAuthGuard>} />
            <Route path="/agency/settlements" element={<AgencyAuthGuard><AgencySettlementsPage /></AgencyAuthGuard>} />
            <Route path="/agency/ranking" element={<AgencyAuthGuard><AgencyRankingPage /></AgencyAuthGuard>} />
            <Route path="/agency/schedule" element={<AgencyAuthGuard><AgencySchedulePage /></AgencyAuthGuard>} />
            <Route path="/agency/returns" element={<AgencyAuthGuard><AgencyReturnsPage /></AgencyAuthGuard>} />
            <Route path="/agency/sellers/:sellerId/products" element={<AgencyAuthGuard><AgencyProductsPage /></AgencyAuthGuard>} />
            <Route path="/agency/notices" element={<AgencyAuthGuard><AgencyNoticesPage /></AgencyAuthGuard>} />
            <Route path="/agency/compare" element={<AgencyAuthGuard><AgencyComparePage /></AgencyAuthGuard>} />
            <Route path="/agency/contracts" element={<AgencyAuthGuard><AgencyContractsPage /></AgencyAuthGuard>} />
            <Route path="/agency/targets" element={<AgencyAuthGuard><AgencyTargetsPage /></AgencyAuthGuard>} />
            <Route path="/agency/campaigns" element={<AgencyAuthGuard><AgencyCampaignsPage /></AgencyAuthGuard>} />
            <Route path="/agency/incentives" element={<AgencyAuthGuard><AgencyIncentivesPage /></AgencyAuthGuard>} />
            <Route path="/agency/messages" element={<AgencyAuthGuard><AgencyMessagesPage /></AgencyAuthGuard>} />
            <Route path="/agency/coupons" element={<AgencyAuthGuard><AgencyCouponsPage /></AgencyAuthGuard>} />
            <Route path="/agency/members" element={<AgencyAuthGuard><AgencyMembersPage /></AgencyAuthGuard>} />
            <Route path="/agency/calendar" element={<AgencyAuthGuard><AgencyCalendarPage /></AgencyAuthGuard>} />
            <Route path="/agency/invites" element={<AgencyAuthGuard><AgencyInvitesPage /></AgencyAuthGuard>} />
            <Route path="/agency/pk" element={<AgencyAuthGuard><AgencyPKBattlesPage /></AgencyAuthGuard>} />
            <Route path="/agency/transfers" element={<AgencyAuthGuard><AgencyTransfersPage /></AgencyAuthGuard>} />
            <Route path="/a/:slug" element={<AgencyPublicPage />} />
            <Route path="/agency/profile" element={<AgencyAuthGuard><AgencyProfilePage /></AgencyAuthGuard>} />
            <Route path="/agency/group-buy" element={<AgencyAuthGuard><AgencyGroupBuyPage /></AgencyAuthGuard>} />
            
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
            <Route path="/payment/success" element={<ErrorBoundary><PaymentSuccessPage /></ErrorBoundary>} />
            <Route path="/success" element={<ErrorBoundary><PaymentSuccessPage /></ErrorBoundary>} />
            <Route path="/payment/fail" element={<ErrorBoundary><PaymentFailPage /></ErrorBoundary>} />

            {/* 딜 포인트 충전 */}
            <Route path="/points/charge" element={<ProtectedRoute requireUser><PointsChargePage /></ProtectedRoute>} />
            <Route path="/points/charge/success" element={<ErrorBoundary><PointsChargeSuccessPage /></ErrorBoundary>} />
            <Route path="/points/charge/fail" element={<ErrorBoundary><PaymentFailPage /></ErrorBoundary>} />
            <Route path="/fail" element={<ErrorBoundary><PaymentFailPage /></ErrorBoundary>} />
            
            {/* 친구 초대 공동구매 */}
            <Route path="/referral/:code" element={<ReferralPage />} />

            {/* 맛집 지도 */}
            {/* 🛡️ 2026-04-22: dead route 활성화 — RestaurantMapPage 컴포넌트가 import/lazy load 됐으나
                redirect 만 되어 사용 안 되던 것을 실제 렌더링하도록 수정. 사용자는 지도 또는 /browse 카테고리 둘 다 사용 가능. */}
            <Route path="/restaurant-map" element={<RestaurantMapPage />} />

            {/* Terms Pages */}
            {/* 블로그 */}
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />

            <Route path="/terms" element={<TermsOfServicePage />} />
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

            {/* Debug 페이지 (개발 환경만) — 프로덕션에선 라우트 등록 안 됨 */}
            {import.meta.env.DEV && <Route path="/kakao-debug" element={<KakaoDebugPage />} />}
            
            {/* Error 페이지들 */}
            <Route path="/500" element={<ServerErrorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </main>
          </div>
          {!hideBottomNav && <BottomNav />}
          {!fullScreen && <SideBanner />}
          {/* 🛡️ 2026-04-22 배치 124: 카카오 상담 플로팅 버튼 (대시보드 외 모든 페이지) */}
          {!fullScreen && <KakaoConsultButton />}
          </div>
        </Suspense>
      </FrameWrapper>
      <ToastContainer />
      <SecurityReloginBanner />
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ChunkErrorBoundary>
        <HelmetProvider>
          <QueryProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AppContent />
            </BrowserRouter>
          </QueryProvider>
        </HelmetProvider>
      </ChunkErrorBoundary>
    </ErrorBoundary>
  )
}

export default App
