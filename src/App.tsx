import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import KakaoCallbackPage from './pages/KakaoCallbackPage'
import LivePage from './pages/LivePage'
import CheckoutPage from './pages/CheckoutPage'
import CartPage from './pages/CartPage'
import SellerPage from './pages/SellerPage'
import SellerLoginPage from './pages/SellerLoginPage'
import SellerRegisterPage from './pages/SellerRegisterPage'
import SellerBusinessInfoPage from './pages/SellerBusinessInfoPage'
import SellerTaxInvoicesPage from './pages/SellerTaxInvoicesPage'
import SellerOrdersPage from './pages/SellerOrdersPage'
import SellerProductsPage from './pages/SellerProductsPage'
import SellerProductNewPage from './pages/SellerProductNewPage'
import SellerProductEditPage from './pages/SellerProductEditPage'
import SellerLiveControlPage from './pages/SellerLiveControlPage'
import SellerStreamNewPage from './pages/SellerStreamNewPage'
import SellerStreamEditPage from './pages/SellerStreamEditPage'
import SellerProfileEditPage from './pages/SellerProfileEditPage'
import AdminPage from './pages/AdminPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminSettlementPage from './pages/AdminSettlementPage'
import SellerPublicPage from './pages/SellerPublicPage'
import MyOrdersPage from './pages/MyOrdersPage'
import NotFoundPage from './pages/NotFoundPage'
import ServerErrorPage from './pages/ServerErrorPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
        <Route path="/live/:streamId" element={<LivePage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
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
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/settlement" element={<AdminSettlementPage />} />
        <Route path="/s/:sellerId" element={<SellerPublicPage />} />
        <Route path="/my-orders" element={<MyOrdersPage />} />
        
        {/* Error Pages */}
        <Route path="/500" element={<ServerErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
