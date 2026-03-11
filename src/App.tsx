import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import ErrorBoundary from './components/ErrorBoundary'
import FrameWrapper from './components/FrameWrapper'
import { useMultiTabSync } from './hooks/useMultiTabSync'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import { QueryProvider } from './lib/react-query'

// ❌ REMOVED: Duplicate Sentry initialization (already done in main.tsx)
// initSentry() was causing "Multiple Sentry Session Replay instances" error

// ✅ 모든 페이지를 lazy loading (초기 번들 크기 최소화)
const HomePage = lazy(() => import('./pages/HomePage'))
const MainHomePage = lazy(() => import('./pages/MainHomePage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const ShortFormPage = lazy(() => import('./pages/ShortFormPage'))
const IntroducePage = lazy(() => import('./pages/IntroducePage'))

// 나머지 페이지는 lazy load
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
const SellerDashboardPage = lazy(() => import('./pages/SellerDashboardPage'))
const SellerBusinessInfoPage = lazy(() => import('./pages/SellerBusinessInfoPage'))
const SellerTaxInvoicesPage = lazy(() => import('./pages/SellerTaxInvoicesPage'))
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
  console.log('[App] 📱 AppContent 마운트됨')
  
  // ✅ 전역 onAuthStateChanged 리스너 등록 (최상단, 한 번만)
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    const setupGlobalAuthListener = async () => {
      try {
        const { onAuthStateChanged } = await import('@/lib/firebase-auth');
        const { isKorea } = await import('@/shared/config/region');
        const isKR = isKorea();
        
        console.log(`[App] 🔐 전역 Auth 리스너 설정 (${isKR ? 'KR' : 'WORLD'})`);
        
        unsubscribe = await onAuthStateChanged(async (user) => {
          console.log('[App] 🔄 Auth State 변경 감지:', user?.uid || 'null');
          
          // Zustand store에 즉시 반영
          if (isKR) {
            const { useAuthKR } = await import('@/shared/stores/useAuthKR');
            useAuthKR.getState().setUser(user);
            useAuthKR.getState().setAuthReady(true);
          } else {
            const { useAuthWorld } = await import('@/shared/stores/useAuthWorld');
            useAuthWorld.getState().setUser(user);
            useAuthWorld.getState().setAuthReady(true);
          }
        });
      } catch (err) {
        console.error('[App] ❌ 전역 Auth 리스너 설정 실패:', err);
      }
    };
    
    setupGlobalAuthListener();
    
    return () => {
      if (unsubscribe) {
        console.log('[App] 🔌 전역 Auth 리스너 해제');
        unsubscribe();
      }
    };
  }, []);
  
  // ✅ Zustand Store 인증 초기화 (Week 5 Day 1)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (isKorea()) {
          console.log('[App] 🇰🇷 KR 인증 초기화 시작')
          await useAuthKR.getState().initializeAuth()
          console.log('[App] ✅ KR 인증 초기화 완료')
        } else {
          console.log('[App] 🌍 WORLD 인증 초기화 시작')
          await useAuthWorld.getState().initializeAuth()
          console.log('[App] ✅ WORLD 인증 초기화 완료')
        }
      } catch (err) {
        console.error('[App] ❌ 인증 초기화 실패:', err)
      }
    }
    initAuth()
  }, [])
  
  // 🔄 다중 탭 동기화: 다른 탭의 로그인/로그아웃 감지
  useMultiTabSync()
  
  console.log('[App] 📍 현재 경로:', window.location.pathname)
  
  return (
    <>
      <FrameWrapper>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* 소개 페이지 - 브랜딩 + 메인 페이지 iframe */}
            <Route path="/introduce" element={<IntroducePage />} />
            {/* KREAM 스타일 메인 페이지 */}
            <Route path="/" element={<MainHomePage />} />
            {/* ShortForm 페이지 - 요고 스타일 */}
            <Route path="/shortform" element={<ShortFormPage />} />
            {/* 기존 홈페이지는 /browse로 이동 */}
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
            <Route path="/auth/kakao/sync/callback" element={<KakaoCallbackPage />} />
            <Route path="/live/:streamId" element={<LivePageV2 />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/payment/demo" element={<PaymentDemoPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/fail" element={<PaymentFailPage />} />
            <Route path="/fail" element={<PaymentFailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/seller" element={<SellerPage />} />
            <Route path="/seller/login" element={<SellerLoginPage />} />
            <Route path="/seller/register" element={<SellerRegisterPage />} />
            {/* Redirect /seller/dashboard to /seller (통합됨) */}
            <Route path="/seller/dashboard" element={<Navigate to="/seller" replace />} />
            <Route path="/seller/business-info" element={<SellerBusinessInfoPage />} />
            <Route path="/seller/tax-invoices" element={<SellerTaxInvoicesPage />} />
            <Route path="/seller/orders" element={<SellerOrdersPage />} />
            <Route path="/seller/products" element={<SellerProductsPage />} />
            <Route path="/seller/products/new" element={<SellerProductNewPage />} />
            <Route path="/seller/products/:id/edit" element={<SellerProductEditPage />} />
            <Route path="/seller/live-control" element={<SellerLiveControlPage />} />
            <Route path="/seller/streams/new" element={<SellerStreamNewPage />} />
            <Route path="/seller/streams/:id" element={<SellerStreamEditPage />} />
            <Route path="/seller/profile" element={<SellerProfileEditPage />} />
            <Route path="/seller/settlements" element={<SellerSettlementsPage />} />
            <Route path="/seller/live-broadcast" element={<SellerLiveBroadcastPage />} />
            <Route path="/seller/youtube/callback" element={<YouTubeCallbackPage />} />
            {/* Redirect /mypage to /user/profile */}
            <Route path="/mypage" element={<UserProfilePage />} />
            <Route path="/user/profile" element={<UserProfilePage />} />
            <Route path="/mypage/addresses" element={<AddressManagementPage />} />
            <Route path="/mypage/wishlist" element={<WishlistPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/settlement" element={<AdminSettlementPage />} />
            <Route path="/admin/banners" element={<AdminBannersPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/products" element={<AdminProductsPage />} />
            <Route path="/s/:sellerId" element={<SellerPublicPage />} />
            <Route path="/my-orders" element={<MyOrdersPage />} />
            <Route path="/orders" element={<MyOrdersPage />} />
            
            {/* Account Settings & Delete Pages */}
            <Route path="/account/settings" element={<AccountSettingsPage />} />
            <Route path="/account/delete-warning" element={<AccountDeleteWarningPage />} />
            <Route path="/account/deleted" element={<AccountDeletedPage />} />
            
            {/* Terms Pages */}
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/refund" element={<RefundPolicyPage />} />
            <Route path="/faq" element={<FAQPage />} />
            
            {/* 🔧 Debug Pages */}
            <Route path="/debug/kakao" element={<KakaoDebugPage />} />
            
            {/* Error Pages */}
            <Route path="/500" element={<ServerErrorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </FrameWrapper>
    </>
  )
}

// ✅ App 컴포넌트: BrowserRouter 최상위 배치 (AuthProvider 제거)
function App() {
  console.log('[App] 🚀 App 컴포넌트 렌더링 (v2.3 - Zustand + React Query + Sentry)')
  
  return (
    <Sentry.ErrorBoundary 
      fallback={({ error }) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-red-600 mb-4">오류가 발생했습니다</h2>
            <p className="text-gray-600 mb-4">{error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>
      )}
      showDialog={false}
    >
      <ErrorBoundary>
        <QueryProvider>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            {/* ❌ <AuthProvider> REMOVED - Migrated to Zustand Stores */}
            <AppContent />
          </BrowserRouter>
        </QueryProvider>
      </ErrorBoundary>
    </Sentry.ErrorBoundary>
  )
}

export default App
