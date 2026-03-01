/**
 * 🚀 App Router - 무한 루프 완전 해결 버전
 * 
 * React Router v6 + Future Flags (v7 준비)
 * 
 * 핵심:
 * 1. ✅ AuthProvider로 전체 앱 감싸기
 * 2. ✅ ProtectedRoute, PublicRoute로 각 라우트 보호
 * 3. ✅ Future flags 설정 (v7 대비)
 * 4. ✅ loading 상태 체크로 무한 루프 방지
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext.FIXED'
import { ProtectedRoute, PublicRoute } from '@/components/auth/RouteGuards'

// ============================================
// 페이지 Import (예시)
// ============================================
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import ProfilePage from '@/pages/ProfilePage'
import CartPage from '@/pages/CartPage'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import SellerDashboard from '@/pages/seller/SellerDashboard'

// ============================================
// App Component
// ============================================

export default function App() {
  return (
    <BrowserRouter
      future={{
        // ✅ React Router v7 대비 future flags
        v7_startTransition: true,      // useTransition으로 내비게이션 처리
        v7_relativeSplatPath: true,    // Splat path 상대 경로 해석 변경
      }}
    >
      {/* ✅ AuthProvider로 전체 앱 감싸기 */}
      <AuthProvider>
        <Routes>
          {/* ============================================ */}
          {/* 🌐 Public Routes (로그인 시 홈으로 리다이렉트) */}
          {/* ============================================ */}
          
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } 
          />
          
          <Route 
            path="/signup" 
            element={
              <PublicRoute>
                <SignupPage />
              </PublicRoute>
            } 
          />

          {/* ============================================ */}
          {/* 🏠 홈 (로그인 불필요) */}
          {/* ============================================ */}
          
          <Route path="/" element={<HomePage />} />

          {/* ============================================ */}
          {/* 🛡️ Protected Routes (로그인 필요) */}
          {/* ============================================ */}
          
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/cart" 
            element={
              <ProtectedRoute>
                <CartPage />
              </ProtectedRoute>
            } 
          />

          {/* ============================================ */}
          {/* 👔 Seller Routes (판매자 권한 필요) */}
          {/* ============================================ */}
          
          <Route 
            path="/seller/*" 
            element={
              <ProtectedRoute requireSeller>
                <SellerDashboard />
              </ProtectedRoute>
            } 
          />

          {/* ============================================ */}
          {/* 🔐 Admin Routes (관리자 권한 필요) */}
          {/* ============================================ */}
          
          <Route 
            path="/admin/*" 
            element={
              <ProtectedRoute requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          {/* ============================================ */}
          {/* 🚫 404 Not Found */}
          {/* ============================================ */}
          
          <Route 
            path="*" 
            element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h1 className="text-4xl font-bold mb-4">404</h1>
                  <p className="text-gray-600 mb-4">페이지를 찾을 수 없습니다.</p>
                  <a href="/" className="text-primary hover:underline">
                    홈으로 돌아가기
                  </a>
                </div>
              </div>
            } 
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
