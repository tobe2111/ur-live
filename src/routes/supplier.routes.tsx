/**
 * 🛡️ 2026-06-01 도매몰 INC-6: 공급자(도매상) 라우트.
 *   /supplier/login · /supplier/register (공개) + /supplier (자체 가드 — supplier_token).
 *   대시보드 페이지가 토큰 없으면 /supplier/login 으로 리다이렉트하므로 ProtectedRoute 불필요.
 */
import { lazy } from 'react'
import { Route } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'

const SupplierLoginPage = lazy(() => import('@/pages/SupplierLoginPage'))
const SupplierRegisterPage = lazy(() => import('@/pages/SupplierRegisterPage'))
const SupplierDashboardPage = lazy(() => import('@/pages/SupplierDashboardPage'))

export function SupplierRoutes() {
  return (
    <>
      <Route path="/supplier/login" element={<ErrorBoundary><SupplierLoginPage /></ErrorBoundary>} />
      <Route path="/supplier/register" element={<ErrorBoundary><SupplierRegisterPage /></ErrorBoundary>} />
      <Route path="/supplier" element={<ErrorBoundary><SupplierDashboardPage /></ErrorBoundary>} />
    </>
  )
}
