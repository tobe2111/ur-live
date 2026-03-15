// ============================================================
// Layout Component
// ============================================================

import { Outlet, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { useCartStore } from '../../stores/cart.store';
import { LanguageSelector } from '../ui/LanguageSelector';

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const cartItemCount = useCartStore(s => s.getTotalItems());
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
              <span>🌐</span>
              <span className="hidden sm:block">Global Market</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/products" className="text-gray-600 hover:text-blue-600 transition-colors">
                상품
              </Link>
              {isAuthenticated && (
                <Link to="/orders" className="text-gray-600 hover:text-blue-600 transition-colors">
                  주문 내역
                </Link>
              )}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Language */}
              <LanguageSelector />
              {/* Cart */}
              <Link
                to="/cart"
                className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors"
                data-testid="cart-icon"
              >
                <ShoppingCart className="w-6 h-6" />
                {cartItemCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold"
                    data-testid="cart-count"
                  >
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </Link>

              {/* User */}
              {isAuthenticated ? (
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-sm text-gray-600">{user?.name}</span>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                    title="로그아웃"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link to="/login" className="btn-secondary text-sm py-1.5 px-3">
                    로그인
                  </Link>
                  <Link to="/register" className="btn-primary text-sm py-1.5 px-3">
                    회원가입
                  </Link>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-600"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-3">
              <Link
                to="/products"
                className="block text-gray-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                상품
              </Link>
              {isAuthenticated ? (
                <>
                  <Link
                    to="/orders"
                    className="block text-gray-600"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    주문 내역
                  </Link>
                  <button onClick={handleLogout} className="block text-red-500">
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="block text-gray-600" onClick={() => setMobileMenuOpen(false)}>
                    로그인
                  </Link>
                  <Link to="/register" className="block text-blue-600" onClick={() => setMobileMenuOpen(false)}>
                    회원가입
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
          <p>© 2024 Global Marketplace. All rights reserved.</p>
          <p className="mt-1">Powered by Cloudflare Workers + Toss Payments</p>
        </div>
      </footer>
    </div>
  );
}
