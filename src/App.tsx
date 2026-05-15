import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryProvider } from './lib/react-query'
import { ProtectedRoute, PublicRoute } from './components/auth/RouteGuards'
import ToastContainer from './components/ToastContainer'
import ErrorBoundary from './components/ErrorBoundary'
import { ChunkErrorBoundary } from './components/utils/ChunkErrorBoundary'
import FrameWrapper from './components/FrameWrapper'
import { useMultiTabSync } from './hooks/useMultiTabSync'
import ScrollToTop from './components/ScrollToTop'
import OfflineBanner from './components/OfflineBanner'
import InAppBrowserBanner from './components/InAppBrowserBanner'
import BottomNav from '@/components/main/BottomNav'
import DesktopTopNav from '@/components/main/DesktopTopNav'
import { swallow } from '@/shared/utils/swallow'
import KakaoConsultButton from '@/components/KakaoConsultButton'
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

// ❌ REMOVED: Duplicate Sentry initialization (already done in main.tsx)

// ✅ Public / User 페이지들 lazy loading (초기 번들 크기 최소화)
const MainHomePage = lazy(() => import('./pages/MainHomePage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const ShortsPage = lazy(() => import('./pages/ShortsPage'))
const IntroducePage = lazy(() => import('./pages/IntroducePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
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
const PointsChargeSuccessPage = lazy(() => import('./pages/PointsChargeSuccessPage'))
const CartPage = lazy(() => import('./pages/CartPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'))
const WishlistPage = lazy(() => import('./pages/WishlistPage'))
const FollowingPage = lazy(() => import('./pages/FollowingPage'))
const MyVouchersPage = lazy(() => import('./pages/MyVouchersPage'))
const MyDigitalLibraryPage = lazy(() => import('./pages/MyDigitalLibraryPage'))
const VoucherVerifyPage = lazy(() => import('./pages/VoucherVerifyPage'))
const StoreStatsPage = lazy(() => import('./pages/StoreStatsPage'))
const BrowsePage = lazy(() => import('./pages/BrowsePage'))
const MealVouchersPage = lazy(() => import('./pages/MealVouchersPage'))
const GroupBuyListPage = lazy(() => import('./pages/GroupBuyListPage'))
const GroupBuyDetailPage = lazy(() => import('./pages/GroupBuyDetailPage'))
// 🛡️ 2026-05-15: PC 랜딩 (자영업자/인플루언서/에이전시 영업)
const BusinessLandingPage = lazy(() => import('./pages/BusinessLandingPage'))
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

// Redirect component for old product URL
function ProductRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/products/${id}`} replace />;
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
        borderTopColor: '#EC4899',
        animationDelay: '200ms',
      }}
    />
    <span className="sr-only">페이지 로딩 중…</span>
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

  // 네이티브 앱 + 모바일 브라우저: 페이지에 따라 상태바 스타일 / theme-color 변경
  useEffect(() => {
    // 화이트 테마 페이지 (CLAUDE.md 정책)
    const lightPages = ['/browse', '/meal-vouchers', '/checkout', '/my-orders', '/account/', '/cart',
      '/referral/', '/restaurant-map', '/products/', '/wishlist', '/my-vouchers', '/search', '/group-buy', '/community-group-buy']
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
          {/* 📐 2026-05-03: PC 풀너비 활성화 — 모바일 폭 강제 제거.
              각 페이지가 자체 `ur-content-narrow/medium/wide/full` 토큰으로 max-width 관리.
              MobileAppLayout 의 `data-mobile-only="true"` (라이브/쇼츠) 페이지는 여전히 430px 액자 유지. */}
          <div className="min-h-dvh">
          {/* 📐 2026-05-03: PC 상단 네비게이션 — 모바일 BottomNav 의 PC 대응. lg+ 에서만 표시. */}
          {!hideBottomNav && <DesktopTopNav />}
          <div className="flex-1">
          <InAppBrowserBanner />
          <Suspense fallback={null}><PWAInstallPrompt /></Suspense>
          <Suspense fallback={null}><OnboardingTrigger /></Suspense>
          <Suspense fallback={null}><RestoreAccountModal /></Suspense>
          <OfflineBanner />
          <ScrollToTop />
          <Suspense fallback={null}><PushNotificationSetup /></Suspense>
          <main id="main-content">
          <ErrorBoundary key={location.key}>
          <Routes>
            {/* Public 페이지들 */}
            <Route path="/introduce" element={<IntroducePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/" element={<MainHomePage />} />
            <Route path="/shorts" element={<ShortsPage />} />
            <Route path="/v/:code" element={<VoucherVerifyPage />} />
            {/* 🛡️ 2026-04-28: 선물 받기 페이지 (인증 불필요) */}
            <Route path="/gift/claim/:token" element={<GiftClaimPage />} />
            <Route path="/store/stats/:productId" element={<StoreStatsPage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/meal-vouchers" element={<MealVouchersPage />} />
            <Route path="/group-buy" element={<GroupBuyListPage />} />
            <Route path="/group-buy/:id" element={<GroupBuyDetailPage />} />
            {/* 🛡️ 2026-05-15: B2B 랜딩 페이지 — PC 풀 너비, 영업/모집용 */}
            <Route path="/business" element={<BusinessLandingPage />} />
            <Route path="/influencer" element={<InfluencerLandingPage />} />
            <Route path="/agency-partner" element={<AgencyPartnerLandingPage />} />
            <Route path="/live" element={<LiveListPage />} />
            <Route path="/live/recap/:id" element={<LiveRecapPage />} />
            <Route path="/live/:streamId" element={<ErrorBoundary><LivePageV2 /></ErrorBoundary>} />
            <Route path="/products/:id" element={<ErrorBoundary><ProductDetailPage /></ErrorBoundary>} />
            {/* Redirect old single product URL to plural */}
            <Route path="/product/:id" element={<ProductRedirect />} />
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

            {/* 블로그 */}
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />

            {/* Terms Pages */}
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
          </ErrorBoundary>
          </main>
          </div>
          {!hideBottomNav && <BottomNav />}
          {!fullScreen && <Suspense fallback={null}><SideBanner /></Suspense>}
          {/* 🛡️ 2026-04-22 배치 124: 카카오 상담 플로팅 버튼 (대시보드 외 모든 페이지) */}
          {!fullScreen && <KakaoConsultButton />}
          </div>
        </Suspense>
      </FrameWrapper>
      <ToastContainer />
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
