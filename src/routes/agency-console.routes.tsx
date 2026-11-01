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
import { lazy, type ReactNode } from 'react'
import { Route } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import { hasAgencyLogin } from '@/lib/agency-presence'

const AgencyLoginPage = lazy(() => import('@/pages/agency-console/AgencyLoginPage'))
const AgencySignupPage = lazy(() => import('@/pages/agency-console/AgencySignupPage'))
const AgencyVerifyPage = lazy(() => import('@/pages/agency-console/AgencyVerifyPage'))
const AgencyInvitePage = lazy(() => import('@/pages/agency-console/AgencyInvitePage'))
const AgencyResetPage = lazy(() => import('@/pages/agency-console/AgencyResetPage'))
const AgencyHomePage = lazy(() => import('@/pages/agency-console/AgencyHomePage'))
const AgencyMyPage = lazy(() => import('@/pages/agency-console/AgencyMyPage'))

/**
 * 🏠 2026-10-26 대표 확정 안 A — 손님(카카오) 로그인 없이 **에이전시 이메일 로그인만** 있으면 마이 자리에
 *   에이전시 마이(`AgencyMyPage`)를 띄운다. 둘 다 없으면 종전 로그인 전 화면(`guest`) 그대로.
 *   `ProtectedRoute` 의 guest 자리에 끼우므로 공용 인증 판정(잠금 파일)은 한 글자도 안 바뀐다.
 *   카카오로 이은 에이전시 로그인은 손님 로그인이 없으면 여기서 지워진다(`agency-presence.ts`).
 */
export function AgencyAwareGuest({ guest }: { guest: ReactNode }) {
  return hasAgencyLogin() ? <ErrorBoundary><AgencyMyPage /></ErrorBoundary> : <>{guest}</>
}

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
