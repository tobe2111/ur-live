import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LivePage from './pages/LivePage'
import CheckoutPage from './pages/CheckoutPage'
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
import AdminPage from './pages/AdminPage'
import AdminLoginPage from './pages/AdminLoginPage'
import MyOrdersPage from './pages/MyOrdersPage'
import KakaoCallbackPage from './pages/KakaoCallbackPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/live/:streamId" element={<LivePage />} />
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
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/my-orders" element={<MyOrdersPage />} />
        <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
