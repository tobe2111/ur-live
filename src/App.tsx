import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import ErrorBoundary from './components/ErrorBoundary'
import { ChunkErrorBoundary } from './components/utils/ChunkErrorBoundary'
import FrameWrapper from './components/FrameWrapper'
import { useMultiTabSync } from './hooks/useMultiTabSync'
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
const PaymentDemoPage = lazy(() => import('./pages/PaymentDemoPage'))
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'))
const PaymentFailPage = lazy(() => import('./pages/PaymentFailPage'))
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
const SellerProductNewPage = lazy(() => import('./pages/SellerProductNewPage'))
const SellerProductEditPage = lazy(() => import('./pages/SellerProductEditPage'))
const SellerLiveControlPage = lazy(() => import('./pages/SellerLiveControlPage'))
const SellerStreamNewPage = lazy(() => import('./pages/SellerStreamNewPage'))
const SellerStreamEditPage = lazy(() => import('./pages/SellerStreamEditPage'))
const SellerProfileEditPage = lazy(() => import('./pages/SellerProfileEditPage'))
const SellerPublicPage = lazy(() => import('./pages/SellerPublicPage'))
const SellerSettlementsPage = lazy(() => import('./pages/SellerSettlementsPage'))
const SellerLiveBroadcastPage = lazy(() => import('./pages/SellerLiveBroadcastPage'))
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
        console.log('[App] 🔑 firebase_token 파라미터 감지')
        
        const { signInWithCustomToken } = await import('@/lib/firebase-auth')
        const userCredential = await signInWithCustomToken(firebaseToken)
        const user = userCredential.user
        console.log('[App] ✅ Firebase Custom Token 로그인 성공:', user.uid)
        
        // ID Token 갱신
        const idToken = await user.getIdToken(true)
        console.log('[App] ✅ ID Token 갱신 완료')
        
        // ✅ Custom Token claims에서 numeric userId 추출
        const tokenResult = await user.getIdTokenResult(true);
        const numericUserId = tokenResult.claims?.userId || tokenResult.claims?.user_id || 0;
        console.log('[App] 🔢 Numeric user ID from claims:', numericUserId);
        
        // ✅ useAuthStore에 토큰 저장
        const { useAuthStore } = await import('@/client/stores/auth.store')
        useAuthStore.getState().setAuth(
          {
            id: user.uid,
            email: user.email || '',
            name: user.displayName || '',
            role: 'user',
          },
          idToken,
          ''
        )
        console.log('[App] ✅ useAuthStore에 accessToken 저장 완료')
        
        localStorage.setItem('user_type', 'user')
        localStorage.setItem('user_id', user.uid)
        localStorage.setItem('user_email', user.email || '')
        localStorage.setItem('numeric_user_id', String(numericUserId)); // ✅ 숫자 ID 저장
        
        // URL 파라미터 제거
        urlParams.delete('firebase_token')
        const newUrl = urlParams.toString() 
          ? `${window.location.pathname}?${urlParams.toString()}`
          : window.location.pathname
        window.history.replaceState({}, '', newUrl)
      } catch (error) {
        console.error('[App] ❌ Firebase Custom Token 로그인 실패:', error)
        
        // ✅ URL 파라미터 제거 (firebase_token, userName 포함)
        const urlParams2 = new URLSearchParams(window.location.search)
        urlParams2.delete('firebase_token')
        urlParams2.delete('userName')
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
    
    // ✅ Seller/Admin은 Firebase 초기화 불필요 → isAuthReady를 즉시 true로
    if (userType === 'seller' || userType === 'admin') {
      console.log(`[App] 🏪 ${userType} 세션 감지 - Firebase 초기화 스킵, isAuthReady=true`)
      useAuthKR.getState().setAuthReady(true)
      useAuthWorld.getState().setAuthReady(true)
      return
    }

    // ✅ User (Firebase) 초기화
    const initAuth = async () => {
      try {
        const isKR = isKorea()
        console.log(`[App] 🔐 Firebase Auth 초기화 (${isKR ? 'KR' : 'WORLD'})`)
        
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
  
  return (
    <>
      <FrameWrapper>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public 페이지들 */}
            <Route path="/introduce" element={<IntroducePage />} />
            <Route path="/" element={<MainHomePage />} />
            <Route path="/shortform" element={<ShortFormPage />} />
            <Route path="/browse" element={<BrowsePage />} />
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
            <Route path="/seller/register" element={<SellerRegisterPage />} />
            <Route path="/seller/signup" element={<SellerRegisterPage />} />
            
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
                <SellerProfileEditPage />
              </ProtectedRoute>
            } />
            <Route path="/seller/settlements" element={
              <ProtectedRoute requireSeller>
                <SellerSettlementsPage />
              </ProtectedRoute>
            } />
            <Route path="/seller/live-broadcast" element={
              <ProtectedRoute requireSeller>
                <SellerLiveBroadcastPage />
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
                <AdminSettlementPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/banners" element={
              <ProtectedRoute requireAdmin>
                <AdminBannersPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/orders" element={
              <ProtectedRoute requireAdmin>
                <AdminOrdersPage />
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
                <KVMonitoringPage />
              </ProtectedRoute>
            } />
            
            {/* User Protected 페이지들 */}
            <Route path="/cart" element={
              <ProtectedRoute requireUser>
                <CartPage />
              </ProtectedRoute>
            } />
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
            <Route path="/payment/demo" element={<PaymentDemoPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/fail" element={<PaymentFailPage />} />
            <Route path="/fail" element={<PaymentFailPage />} />
            
            {/* Terms Pages */}
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/refund" element={<RefundPolicyPage />} />
            <Route path="/faq" element={<FAQPage />} />
            
            {/* Debug 페이지 (개발 환경만) */}
            <Route path="/kakao-debug" element={<KakaoDebugPage />} />
            
            {/* Error 페이지들 */}
            <Route path="/500" element={<ServerErrorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </FrameWrapper>
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
