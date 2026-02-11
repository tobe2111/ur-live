import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'

// 초기 로딩 페이지만 즉시 로드
import HomePage from './pages/HomePage'

// 나머지 페이지는 lazy load
const LoginPage = lazy(() => import('./pages/LoginPage'))
const KakaoCallbackPage = lazy(() => import('./pages/KakaoCallbackPage'))
const LivePage = lazy(() => import('./pages/LivePage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'))
const PaymentFailPage = lazy(() => import('./pages/PaymentFailPage'))
const CartPage = lazy(() => import('./pages/CartPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))

// Seller 페이지들
const SellerPage = lazy(() => import('./pages/SellerPage'))
const SellerLoginPage = lazy(() => import('./pages/SellerLoginPage'))
const SellerRegisterPage = lazy(() => import('./pages/SellerRegisterPage'))
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

// Admin 페이지들
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const AdminSettlementPage = lazy(() => import('./pages/AdminSettlementPage'))

// Error 페이지들
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ServerErrorPage = lazy(() => import('./pages/ServerErrorPage'))

// 로딩 컴포넌트
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600">로딩 중...</p>
    </div>
  </div>
)

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
            <Route path="/live/:streamId" element={<LivePage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/fail" element={<PaymentFailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/seller" element={<SellerPage />} />
            <Route path="/seller/login" element={<SellerLoginPage />} />
            <Route path="/seller/register" element={<SellerRegisterPage />} />
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
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/mypage/addresses" element={<AddressManagementPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/settlement" element={<AdminSettlementPage />} />
            <Route path="/s/:sellerId" element={<SellerPublicPage />} />
            <Route path="/my-orders" element={<MyOrdersPage />} />
            
            {/* Error Pages */}
            <Route path="/500" element={<ServerErrorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
