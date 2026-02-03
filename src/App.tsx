import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LivePage from './pages/LivePage'
import CheckoutPage from './pages/CheckoutPage'
import SellerPage from './pages/SellerPage'
import MyOrdersPage from './pages/MyOrdersPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/live/:streamId" element={<LivePage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/seller" element={<SellerPage />} />
        <Route path="/seller-login" element={<SellerPage />} />
        <Route path="/my-orders" element={<MyOrdersPage />} />
        <Route path="/admin" element={<SellerPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
