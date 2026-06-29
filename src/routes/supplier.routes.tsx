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
const SupplierWholesaleOrdersPage = lazy(() => import('@/pages/SupplierWholesaleOrdersPage'))
// 🏭 2026-06-29 (통합 셸 Phase 2): 제조사 대시보드도 판매사와 동일한 공용 상단바를 공유 — 같은
//   WholesaleLayout(<WholesaleUtilBar/> + <Outlet/>) 산하로. 바는 역할 인지(제조사면 supplier 분기 표시).
//   로그인/가입(인증 페이지)은 자체 풀페이지라 바 없이 둠(판매사 /wholesale/login 과 동일 정책).
const WholesaleLayout = lazy(() => import('@/pages/wholesale/WholesaleLayout'))

export function SupplierRoutes() {
  return (
    <>
      <Route path="/supplier/login" element={<ErrorBoundary><SupplierLoginPage /></ErrorBoundary>} />
      <Route path="/supplier/register" element={<ErrorBoundary><SupplierRegisterPage /></ErrorBoundary>} />
      <Route element={<WholesaleLayout />}>
        <Route path="/supplier" element={<ErrorBoundary><SupplierDashboardPage /></ErrorBoundary>} />
        {/* 💬 채팅 알림 딥링크 — 같은 대시보드를 렌더하되 페이지가 pathname 으로 채팅 탭 자동 선택 */}
        <Route path="/supplier/chat" element={<ErrorBoundary><SupplierDashboardPage /></ErrorBoundary>} />
        <Route path="/supplier/wholesale-orders" element={<ErrorBoundary><SupplierWholesaleOrdersPage /></ErrorBoundary>} />
      </Route>
    </>
  )
}
