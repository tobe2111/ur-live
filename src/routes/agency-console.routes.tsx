/**
 * 🏢 2026-10-11 에이전시 콘솔 라우트 (대표 확정 — 에이전시 = 여러 매장을 맡아 운영하는 대행사,
 *   계정은 **이메일로만**, 로그인 화면은 안 A). 결정: `docs/decisions/2026-10-11-agency-model-email-only.md`.
 *
 * ⚠️ 2026-09-04 에 일몰된 옛 에이전시(대시보드·커미션·카카오 로그인)와 **다른 것**이다. 같은 `/agency`
 *   주소를 쓰지만 코드는 전부 `pages/agency-console/` · `features/agency-console/` 에 새로 있고,
 *   `agency-sunset-final.test.ts` 가 "새 것은 이 목록뿐" 으로 고정한다.
 *
 * 공개 화면(로그인·가입·인증·합류·재설정)과 콘솔(`/agency`)은 각 페이지가 스스로 토큰을 본다 —
 *   공용 ProtectedRoute 는 소비자·셀러 토큰을 보므로 여기 쓰면 안 된다.
 */
import { lazy } from 'react'
import { Route } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'

const AgencyLoginPage = lazy(() => import('@/pages/agency-console/AgencyLoginPage'))
const AgencySignupPage = lazy(() => import('@/pages/agency-console/AgencySignupPage'))
const AgencyVerifyPage = lazy(() => import('@/pages/agency-console/AgencyVerifyPage'))
const AgencyInvitePage = lazy(() => import('@/pages/agency-console/AgencyInvitePage'))
const AgencyResetPage = lazy(() => import('@/pages/agency-console/AgencyResetPage'))
const AgencyHomePage = lazy(() => import('@/pages/agency-console/AgencyHomePage'))

export function AgencyConsoleRoutes() {
  return (
    <>
      <Route path="/agency/login" element={<ErrorBoundary><AgencyLoginPage /></ErrorBoundary>} />
      <Route path="/agency/signup" element={<ErrorBoundary><AgencySignupPage /></ErrorBoundary>} />
      <Route path="/agency/verify" element={<ErrorBoundary><AgencyVerifyPage /></ErrorBoundary>} />
      <Route path="/agency/invite" element={<ErrorBoundary><AgencyInvitePage /></ErrorBoundary>} />
      <Route path="/agency/reset" element={<ErrorBoundary><AgencyResetPage /></ErrorBoundary>} />
      <Route path="/agency" element={<ErrorBoundary><AgencyHomePage /></ErrorBoundary>} />
    </>
  )
}
