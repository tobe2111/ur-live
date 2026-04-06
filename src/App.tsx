import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import ErrorBoundary from './components/ErrorBoundary'
import { ChunkErrorBoundary } from './components/utils/ChunkErrorBoundary'
import FrameWrapper from './components/FrameWrapper'
import { useMultiTabSync } from './hooks/useMultiTabSync'
import BottomNav from '@/components/main/BottomNav'
import SideBanner from '@/components/SideBanner'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'

// Redirect component for old product URL
function ProductRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/products/${id}`} replace />;
}
import { QueryProvider } from './lib/react-query'
import { ProtectedRoute, PublicRoute } from './components/auth/RouteGuards'
import ToastContainer from './components/ToastContainer'

// ❌ REMOVED: Duplicate Sentry initialization (already done in main.tsx)

// ✅ 모든 페이지를 lazy loading (초기 번들 크기 최소화)
const HomePage = lazy(() => import('./pages/HomePage'))
const MainHomePage = lazy(() => import('./pages/MainHomePage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const ShortFormPage = lazy(() => import('./pages/ShortFormPage'))
const IntroducePage = lazy(() => import('./pages/IntroducePage'))

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const KakaoCallbackPage = lazy(() => import('./pages/KakaoCallbackPage'))
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
const BrowsePage = lazy(() => import('./pages/BrowsePage'))

// Seller 페이지들
const SellerPage = lazy(() => import('./pages/SellerPage'))
const SellerLoginPage = lazy(() => import('./pages/SellerLoginPage'))
const SellerRegisterPage = lazy(() => import('./pages/SellerRegisterPage'))
const SellerBusinessInfoPage = lazy(() => import('./pages/SellerBusinessInfoPage'))
const SellerOrdersPage = lazy(() => import('./pages/SellerOrdersPage'))
const SellerProductsPage = lazy(() => import('./pages/SellerProductsPage'))
const SellerInventoryPage = lazy(() => import('./pages/SellerInventoryPage'))
const SellerProductNewPage = lazy(() => import('./pages/SellerProductNewPage'))
const SellerProductEditPage = lazy(() => import('./pages/SellerProductEditPage'))
const SellerLiveControlPage = lazy(() => import('./pages/SellerLiveControlPage'))
const SellerStreamNewPage = lazy(() => import('./pages/SellerStreamNewPage'))
const SellerStreamEditPage = lazy(() => import('./pages/SellerStreamEditPage'))
const SellerProfileEditPage = lazy(() => import('./pages/SellerProfileEditPage'))
const SellerPublicPage = lazy(() => import('./pages/SellerPublicPage'))
const SellerSettlementsPage = lazy(() => import('./pages/SellerSettlementsPage'))
const SellerAlimtalkPage = lazy(() => import('./pages/SellerAlimtalkPage'))
const SellerYoutubeGrowthPage = lazy(() => import('./pages/SellerYoutubeGrowthPage'))
const SellerYoutubeGrowthSuccessPage = lazy(() => import('./pages/SellerYoutubeGrowthSuccessPage'))
const SellerDonationsPage = lazy(() => import('./pages/SellerDonationsPage'))
const SellerLiveBroadcastPage = lazy(() => import('./pages/SellerLiveBroadcastPage'))
const SellerLiveAnalyticsPage = lazy(() => import('./pages/SellerLiveAnalyticsPage'))
const SellerSupplyPage = lazy(() => import('./pages/SellerSupplyPage'))
const SellerLivePage = lazy(() => import('./pages/SellerLivePage'))
const YouTubeCallbackPage = lazy(() => import('./pages/YouTubeCallbackPage'))

// User 페이지들
const MyPage = lazy(() => import('./pages/MyPage'))
const AddressManagementPage = lazy(() => import('./pages/AddressManagementPage'))
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'))
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
const AdminSampleRequestsPage = lazy(() => import('./pages/admin/AdminSampleRequestsPage'))
const AdminAdScraperPage = lazy(() => import('./pages/admin/AdminAdScraperPage'))
const AdminDealMonitorPage = lazy(() => import('./pages/AdminDealMonitorPage'))

// Error 페이지들
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ServerErrorPage = lazy(() => import('./pages/ServerErrorPage'))

// 약관 페이지들
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))

// 🔧 Debug 페이지
const KakaoDebugPage = lazy(() => import('./pages/KakaoDebugPage'))

// 로딩 컴포넌트
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600 font-medium">로딩 중...</p>
    </div>
  </div>
)

// ✅ Router 내부에서 실행될 컴포넌트
function AppContent() {
  // ✅ authInitialized ref: 중복 초기화 방지 (StrictMode 이중 마운트 대비)
  const authInitialized = useRef(false)

  // ✅ firebase_token URL 파라미터 처리 (최우선, 한 번만)
  useEffect(() => {
    const processFirebaseToken = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const firebaseToken = urlParams.get('firebase_token')
      
      if (!firebaseToken) return
      
      try {
        // URL에서 사용자 정보 미리 읽기 (삭제 전에)
        const urlUserName = urlParams.get('userName') || ''
        const urlProfileImage = urlParams.get('profileImage') || ''

        const { signInWithCustomToken } = await import('@/lib/firebase-auth')
        const userCredential = await signInWithCustomToken(firebaseToken)
        const user = userCredential.user
        // ID Token 갱신 및 claims 추출
        const idToken = await user.getIdToken(true)
        const tokenResult = await user.getIdTokenResult(true)
        const numericUserId = tokenResult.claims?.userId || tokenResult.claims?.user_id || 0
        const claimsUserName = (tokenResult.claims?.userName as string) || urlUserName
        const rawProfileImage = (tokenResult.claims?.profileImage as string) || urlProfileImage
        const claimsProfileImage = rawProfileImage.replace(/^http:\/\//, 'https://')
        // ✅ user_name / profileImage localStorage 저장 (프로필 페이지 표시용)
        if (claimsUserName) {
          localStorage.setItem('user_name', claimsUserName)
        }
        if (claimsProfileImage) {
          localStorage.setItem('user_profile_image', claimsProfileImage)
        }

        // ✅ Firebase displayName / photoURL 업데이트
        if (!user.displayName && claimsUserName) {
          try {
            const { updateProfile } = await import('firebase/auth')
            await updateProfile(user, {
              displayName: claimsUserName,
              ...(claimsProfileImage ? { photoURL: claimsProfileImage } : {}),
            })
          } catch (e) {
            console.warn('[App] ⚠️ Firebase 프로필 업데이트 실패 (무시):', e)
          }
        }

        // ✅ localStorage를 먼저 업데이트 (hasFirebaseUserSession() race condition 방지)
        localStorage.setItem('user_type', 'user')
        localStorage.setItem('lastLoginUid', user.uid)
        localStorage.setItem('user_id', user.uid)
        localStorage.setItem('user_email', user.email || '')
        localStorage.setItem('numeric_user_id', String(numericUserId))

        // ✅ useAuthKR에 Firebase User 즉시 설정 (onAuthStateChanged 지연 방지)
        const { useAuthKR } = await import('@/shared/stores/useAuthKR')
        useAuthKR.getState().setUser(user)
        useAuthKR.getState().setAuthReady(true)  // ProtectedRoute 스피너 즉시 해제
        sessionStorage.setItem('auth_processed_uid', user.uid)  // onAuthStateChanged 중복 방지
        // ✅ useAuthStore에 토큰 저장
        const { useAuthStore } = await import('@/client/stores/auth.store')
        useAuthStore.getState().setAuth(
          {
            id: user.uid,
            email: user.email || '',
            name: claimsUserName || user.displayName || '',
            role: 'user',
          },
          idToken,
          ''
        )
        // URL 파라미터 제거 (auth 관련 전부)
        urlParams.delete('firebase_token')
        urlParams.delete('userName')
        urlParams.delete('profileImage')
        const newUrl = urlParams.toString()
          ? `${window.location.pathname}?${urlParams.toString()}`
          : window.location.pathname
        window.history.replaceState({}, '', newUrl)
      } catch (error) {
        console.error('[App] ❌ Firebase Custom Token 로그인 실패:', error)

        // URL 파라미터 제거
        const urlParams2 = new URLSearchParams(window.location.search)
        urlParams2.delete('firebase_token')
        urlParams2.delete('userName')
        urlParams2.delete('profileImage')
        const newUrl = urlParams2.toString()
          ? `${window.location.pathname}?${urlParams2.toString()}`
          : window.location.pathname
        window.history.replaceState({}, '', newUrl)

        // ✅ 로그인 페이지로 리다이렉트 (무한 루프 방지)
        window.location.href = '/login'
      }
    }
    
    processFirebaseToken()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ 핵심 수정: 단일 Auth 초기화 (중복 구독 완전 제거)
  // - initializeAuth() 하나만 호출 (내부에서 onAuthStateChanged 구독)
  // - Seller/Admin은 Firebase 로딩을 기다리지 않음 (localStorage JWT 즉시 체크)
  useEffect(() => {
    if (authInitialized.current) return
    authInitialized.current = true

    const userType = localStorage.getItem('user_type')

    // ✅ firebase_token이 URL에 있으면 Seller/Admin 빠른 처리 건너뜀
    // (카카오 로그인 중이므로 processFirebaseToken이 user_type을 'user'로 덮어씀)
    const hasIncomingToken = !!new URLSearchParams(window.location.search).get('firebase_token')

    // ✅ Seller/Admin은 Firebase 초기화 불필요 → isAuthReady를 즉시 true로
    if (!hasIncomingToken && (userType === 'seller' || userType === 'admin')) {
      useAuthKR.getState().setAuthReady(true)
      useAuthWorld.getState().setAuthReady(true)
      return
    }

    // ✅ firebase_token이 있으면 processFirebaseToken이 인증을 처리하므로
    // initializeAuth()를 호출하지 않음 (onAuthStateChanged(null) → 깜빡임 방지)
    if (hasIncomingToken) {
      return
    }

    // ✅ User (Firebase) 초기화
    const initAuth = async () => {
      try {
        const isKR = isKorea()
        if (isKR) {
          useAuthKR.getState().initializeAuth()
        } else {
          useAuthWorld.getState().initializeAuth()
        }
      } catch (err) {
        console.error('[App] ❌ 인증 초기화 실패:', err)
        // 실패해도 authReady를 true로 설정해 무한 스피너 방지
        useAuthKR.getState().setAuthReady(true)
        useAuthWorld.getState().setAuthReady(true)
      }
    }
    
    initAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 🔄 다중 탭 동기화
  useMultiTabSync()

  const location = useLocation()
  const fullScreenPrefixes = ['/checkout', '/payment', '/points', '/seller', '/admin', '/login', '/register', '/auth', '/embed', '/introduce']
  const fullScreen = fullScreenPrefixes.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
    || location.pathname.startsWith('/live/') // /live/123 은 풀스크린, /live 목록은 아님
  const hideBottomNav = fullScreen || location.pathname.startsWith('/products/')

  return (
    <>
      <FrameWrapper>
        <Suspense fallback={<PageLoader />}>
          <div className={fullScreen ? 'min-h-dvh' : 'max-w-screen-sm mx-auto bg-white min-h-dvh pb-14'}>
          <div className="flex-1">
          <Routes>
            {/* Public 페이지들 */}
            <Route path="/introduce" element={<IntroducePage />} />
            <Route path="/" element={<MainHomePage />} />
            <Route path="/shortform" element={<ShortFormPage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/live" element={<LiveListPage />} />
            <Route path="/live/:streamId" element={<LivePageV2 />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            {/* Redirect old single product URL to plural */}
            <Route path="/product/:id" element={<ProductRedirect />} />
            <Route path="/s/:sellerId" element={<SellerPublicPage />} />
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
            <Route path="/seller/live" element={
              <ProtectedRoute requireSeller>
                <SellerLivePage />
              </ProtectedRoute>
            } />
            <Route path="/seller/live-control" element={
              <ProtectedRoute requireSeller>
                <SellerLiveControlPage />
              </ProtectedRoute>
            } />
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
            <Route path="/seller/live-broadcast" element={
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
            <Route path="/admin/ad-scraper" element={
              <ProtectedRoute requireAdmin>
                <ErrorBoundary><AdminAdScraperPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/admin/deals" element={
              <ProtectedRoute requireAdmin>
                <ErrorBoundary><AdminDealMonitorPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            
            {/* 장바구니: 비로그인도 접근 가능 (결제 시에만 로그인 필요) */}
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={
              <ProtectedRoute requireUser>
                <CheckoutPage />
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
            <Route path="/wishlist" element={
              <ProtectedRoute requireUser>
                <WishlistPage />
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
            
            {/* Payment 페이지들 */}
            <Route path="/payment/demo" element={<ErrorBoundary><PaymentDemoPage /></ErrorBoundary>} />

            {/* 임베드 위젯 (외부 서비스용) */}
            <Route path="/embed/live/:streamId" element={<EmbedLivePage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/fail" element={<PaymentFailPage />} />

            {/* 딜 포인트 충전 */}
            <Route path="/points/charge" element={<PointsChargePage />} />
            <Route path="/points/charge/success" element={<PointsChargeSuccessPage />} />
            <Route path="/points/charge/fail" element={<PaymentFailPage />} />
            <Route path="/fail" element={<PaymentFailPage />} />
            
            {/* Terms Pages */}
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/refund" element={<RefundPolicyPage />} />
            <Route path="/faq" element={<FAQPage />} />
            {/* ✅ 마이페이지 메뉴에서 사용하는 긴 형식 경로 → 짧은 경로로 리다이렉트 */}
            <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
            <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
            <Route path="/refund-policy" element={<Navigate to="/refund" replace />} />
            
            {/* Debug 페이지 (개발 환경만) */}
            <Route path="/kakao-debug" element={<KakaoDebugPage />} />
            
            {/* Error 페이지들 */}
            <Route path="/500" element={<ServerErrorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </div>
          {!hideBottomNav && <BottomNav />}
          {!fullScreen && <SideBanner />}
          {!hideBottomNav && (
            <a
              href="http://pf.kakao.com/_AITdn/chat"
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-16 right-4 z-[9998] flex items-center justify-center w-10 h-10 rounded-full bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] shadow-md hover:shadow-lg transition-all duration-200 opacity-70 hover:opacity-100"
              title="카카오 채널 상담"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.86 5.32 4.64 6.74-.15.56-.82 3.06-.85 3.26 0 0-.02.13.05.18.07.06.16.03.16.03.22-.03 2.54-1.67 3.6-2.4.77.11 1.57.19 2.4.19 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/></svg>
            </a>
          )}
          </div>
        </Suspense>
      </FrameWrapper>
      <ToastContainer />
    </>
  )
}

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ServerErrorPage />}>
      <ErrorBoundary>
        <ChunkErrorBoundary>
          <QueryProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AppContent />
            </BrowserRouter>
          </QueryProvider>
        </ChunkErrorBoundary>
      </ErrorBoundary>
    </Sentry.ErrorBoundary>
  )
}

export default App
