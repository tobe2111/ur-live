/**
 * Agency routes — TD-006 분리 (2026-05-06)
 *
 * 🌇 2026-08-19 **일몰 축소** (대표 확정): 39 라우트 → 16.
 *   근거(라이브 실측): `agency_sellers` 0행 · `store_agency_delegation` 0행 ·
 *   `introduced_by_agency_id` 0명 · `agency_invites`/`coupons`/`incentives`/`messages`/`notices`/
 *   `targets` 는 **테이블조차 없음**(지연 생성 패턴 = 프로덕션에서 한 번도 실행 안 됨).
 *   제거분 다수는 `LIVE_COMMERCE_SUSPENDED`(영구 중단) 의존(pk·schedule·calendar·ranking·promote-boosts).
 *
 *   남긴 기준 = **살아남는 모델(관계·정산·승계)에 직접 봉사하는 것 + 인증**:
 *     introduced-stores(영입 보상 근거) · delegations(위임) · transfers(승계 동의) ·
 *     settlements/ledger(정산) · sellers(로스터) · profile · guide
 *
 *   ⚠️ **페이지 컴포넌트·API 파일은 삭제하지 않았다** — 일부 API 파일이 머니 경로 심볼을 함께
 *      export 한다(`agency-incentives.routes.ts` 의 `computeCommission` → `order-commissions.ts`·
 *      `commission-budget.ts`). 라우트/마운트만 내렸으므로 되돌리기는 이 파일 복원 + 마운트 복원.
 *   설계 SSOT: docs/design/store-operator-model.md
 */
import { lazy } from 'react'
import { Route, Navigate } from 'react-router-dom'
import { AGENCY_DASHBOARD_SUNSET } from '@/shared/feature-flags'

const AgencyLoginPage = lazy(() => import('@/pages/AgencyLoginPage'))
const AgencyForgotPasswordPage = lazy(() => import('@/pages/AgencyForgotPasswordPage'))
const AgencyResetPasswordPage = lazy(() => import('@/pages/AgencyResetPasswordPage'))
const AgencyPage = lazy(() => import('@/pages/AgencyPage'))
const AgencySellersPage = lazy(() => import('@/pages/AgencySellersPage'))
// 🛡️ 2026-05-20: 에이전시 = 가게 입점 영업 모델 (Phase 2)
const AgencyIntroducedStoresPage = lazy(() => import('@/pages/AgencyIntroducedStoresPage'))
// 🤝 2026-07-10: 3단 위임 모델 (§4.3) — 매장 위임 조회/요청
const AgencyDelegationsPage = lazy(() => import('@/pages/AgencyDelegationsPage'))
const AgencySettlementsPage = lazy(() => import('@/pages/AgencySettlementsPage'))
const MyLedgerPage = lazy(() => import('@/pages/MyLedgerPage'))
const AgencyProfilePage = lazy(() => import('@/pages/AgencyProfilePage'))
const AgencyPublicPage = lazy(() => import('@/pages/AgencyPublicPage'))
const AgencyTransfersPage = lazy(() => import('@/pages/AgencyTransfersPage'))
const AgencyRegisterPage = lazy(() => import('@/pages/AgencyRegisterPage'))
const AgencyRegisterBusinessPage = lazy(() => import('@/pages/AgencyRegisterBusinessPage'))
const AgencyWaitingPage = lazy(() => import('@/pages/AgencyWaitingPage'))
const AgencyGuidePage = lazy(() => import('@/pages/AgencyGuidePage'))
// 🌇 일몰 안내 — 가입 라우트를 404 로 죽이지 않고 "다음 행선지"를 알려준다.
const AgencySunsetPage = lazy(() => import('@/pages/AgencySunsetPage'))

function AgencyAuthGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('agency_token')
  if (!token) return <Navigate to="/agency/login" replace />
  return <>{children}</>
}

export function AgencyRoutes() {
  // 🌇 신규 가입 종료 — 서버(`POST /api/agency/register` 403)와 **한 쌍**이다.
  //    화면만 막으면 직접 POST 로 우회되고, 서버만 막으면 사용자가 폼을 다 채운 뒤 에러를 본다.
  const Register = AGENCY_DASHBOARD_SUNSET ? AgencySunsetPage : AgencyRegisterPage
  const RegisterBusiness = AGENCY_DASHBOARD_SUNSET ? AgencySunsetPage : AgencyRegisterBusinessPage

  return (
    <>
      {/* Public agency pages */}
      <Route path="/agency/login" element={<AgencyLoginPage />} />
      <Route path="/agency/register" element={<Register />} />
      <Route path="/agency/register/business" element={<RegisterBusiness />} />
      <Route path="/agency/waiting" element={<AgencyWaitingPage />} />
      <Route path="/agency/forgot-password" element={<AgencyForgotPasswordPage />} />
      <Route path="/agency/reset-password" element={<AgencyResetPasswordPage />} />
      <Route path="/a/:slug" element={<AgencyPublicPage />} />

      {/* Protected agency pages — 관계·정산·승계만 */}
      <Route path="/agency" element={<AgencyAuthGuard><AgencyPage /></AgencyAuthGuard>} />
      <Route path="/agency/sellers" element={<AgencyAuthGuard><AgencySellersPage /></AgencyAuthGuard>} />
      <Route path="/agency/introduced-stores" element={<AgencyAuthGuard><AgencyIntroducedStoresPage /></AgencyAuthGuard>} />
      <Route path="/agency/delegations" element={<AgencyAuthGuard><AgencyDelegationsPage /></AgencyAuthGuard>} />
      <Route path="/agency/transfers" element={<AgencyAuthGuard><AgencyTransfersPage /></AgencyAuthGuard>} />
      <Route path="/agency/settlements" element={<AgencyAuthGuard><AgencySettlementsPage /></AgencyAuthGuard>} />
      <Route path="/agency/ledger" element={<AgencyAuthGuard><MyLedgerPage /></AgencyAuthGuard>} />
      <Route path="/agency/profile" element={<AgencyAuthGuard><AgencyProfilePage /></AgencyAuthGuard>} />
      <Route path="/agency/guide" element={<AgencyAuthGuard><AgencyGuidePage /></AgencyAuthGuard>} />
    </>
  )
}
