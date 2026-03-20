import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import ErrorBoundary from './components/ErrorBoundary'
import { ChunkErrorBoundary } from './components/utils/ChunkErrorBoundary'
import FrameWrapper from './components/FrameWrapper'
import { useMultiTabSync } from './hooks/useMultiTabSync'
import { QueryProvider } from './lib/react-query'
import { ProtectedRoute, PublicRoute } from './components/auth/RouteGuards'
import AuthProvider from './components/auth/AuthProvider'

// Redirect component for old product URL
function ProductRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/products/${id}`} replace />;
}

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
              {/* ✅ AuthProvider: 앱 루트에서 Firebase onAuthStateChanged 단 1회 구독 */}
              <AuthProvider>
                <AppContent />
              </AuthProvider>
            </BrowserRouter>
          </QueryProvider>
        </ChunkErrorBoundary>
      </ErrorBoundary>
    </Sentry.ErrorBoundary>
  )
}

export default App
