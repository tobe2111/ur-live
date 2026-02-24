// React Router App - v2.1 (Cache Buster)
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import FrameWrapper from './components/FrameWrapper'
import { UpdateNotification } from './components/UpdateNotification'
import { AuthProvider } from './contexts/AuthContext'
import { useSessionValidation } from './hooks/useSessionValidation'
import { useMultiTabSync } from './hooks/useMultiTabSync'

// 초기 로딩 페이지만 즉시 로드
import HomePage from './pages/HomePage'
// MainHomePage - KREAM 스타일 메인 페이지
import MainHomePage from './pages/MainHomePage'
// CheckoutPage는 즉시 로드 (lazy loading 문제 해결)
import CheckoutPage from './pages/CheckoutPage'
// ShortFormPage - 요고 스타일 숏폼 커머스
import ShortFormPage from './pages/ShortFormPage'
// IntroducePage - 소개 페이지 (브랜딩 + 메인 페이지 iframe)
import IntroducePage from './pages/IntroducePage'

// 나머지 페이지는 lazy load
const LoginPage = lazy(() => import('./pages/LoginPage'))
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

// User 페이지들
const MyPage = lazy(() => import('./pages/MyPage'))
const AddressManagementPage = lazy(() => import('./pages/AddressManagementPage'))
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'))

// Admin 페이지들
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const AdminSettlementPage = lazy(() => import('./pages/AdminSettlementPage'))
const AdminBannersPage = lazy(() => import('./pages/AdminBannersPage'))

// Error 페이지들
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ServerErrorPage = lazy(() => import('./pages/ServerErrorPage'))

// 약관 페이지들
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))

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
  // 🔒 세션 검증: 5분마다 자동 세션 유효성 검증
  useSessionValidation()
  
  // 🔄 다중 탭 동기화: 다른 탭의 로그인/로그아웃 감지
  useMultiTabSync()
  
  return (
    <>
      <UpdateNotification />
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
            <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
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
            <Route path="/s/:sellerId" element={<SellerPublicPage />} />
            <Route path="/my-orders" element={<MyOrdersPage />} />
            <Route path="/orders" element={<MyOrdersPage />} />
            
            {/* Terms Pages */}
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/refund" element={<RefundPolicyPage />} />
            <Route path="/faq" element={<FAQPage />} />
            
            {/* Error Pages */}
            <Route path="/500" element={<ServerErrorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </FrameWrapper>
    </>
  )
}

// ✅ App 컴포넌트: BrowserRouter와 AuthProvider를 최상위에 배치
function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
