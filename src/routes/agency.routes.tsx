/**
 * Agency routes — TD-006 분리 (2026-05-06)
 */
import { lazy } from 'react'
import { Route, Navigate } from 'react-router-dom'

const AgencyLoginPage = lazy(() => import('@/pages/AgencyLoginPage'))
const AgencyForgotPasswordPage = lazy(() => import('@/pages/AgencyForgotPasswordPage'))
const AgencyResetPasswordPage = lazy(() => import('@/pages/AgencyResetPasswordPage'))
const AgencyPage = lazy(() => import('@/pages/AgencyPage'))
const AgencySellersPage = lazy(() => import('@/pages/AgencySellersPage'))
const AgencyOrdersPage = lazy(() => import('@/pages/AgencyOrdersPage'))
const AgencyStreamsPage = lazy(() => import('@/pages/AgencyStreamsPage'))
const AgencyStatsPage = lazy(() => import('@/pages/AgencyStatsPage'))
// 🛡️ 2026-05-20: 에이전시 = 가게 입점 영업 모델 (Phase 2)
const AgencyIntroducedStoresPage = lazy(() => import('@/pages/AgencyIntroducedStoresPage'))
const AgencySettlementsPage = lazy(() => import('@/pages/AgencySettlementsPage'))
const AgencyRankingPage = lazy(() => import('@/pages/AgencyRankingPage'))
const AgencySchedulePage = lazy(() => import('@/pages/AgencySchedulePage'))
const AgencyReturnsPage = lazy(() => import('@/pages/AgencyReturnsPage'))
const AgencyProductsPage = lazy(() => import('@/pages/AgencyProductsPage'))
const AgencyProfilePage = lazy(() => import('@/pages/AgencyProfilePage'))
const AgencyNoticesPage = lazy(() => import('@/pages/AgencyNoticesPage'))
const AgencyComparePage = lazy(() => import('@/pages/AgencyComparePage'))
const AgencyContractsPage = lazy(() => import('@/pages/AgencyContractsPage'))
const AgencyTargetsPage = lazy(() => import('@/pages/AgencyTargetsPage'))
const AgencyCampaignsPage = lazy(() => import('@/pages/AgencyCampaignsPage'))
const AgencyIncentivesPage = lazy(() => import('@/pages/AgencyIncentivesPage'))
const AgencyMessagesPage = lazy(() => import('@/pages/AgencyMessagesPage'))
const AgencyCouponsPage = lazy(() => import('@/pages/AgencyCouponsPage'))
const AgencyMembersPage = lazy(() => import('@/pages/AgencyMembersPage'))
const AgencyCalendarPage = lazy(() => import('@/pages/AgencyCalendarPage'))
const AgencyInvitesPage = lazy(() => import('@/pages/AgencyInvitesPage'))
const AgencyPublicPage = lazy(() => import('@/pages/AgencyPublicPage'))
const AgencyPKBattlesPage = lazy(() => import('@/pages/AgencyPKBattlesPage'))
const AgencyTransfersPage = lazy(() => import('@/pages/AgencyTransfersPage'))
const AgencyMatchSuggestionsPage = lazy(() => import('@/pages/AgencyMatchSuggestionsPage'))
const AgencySelfEventsPage = lazy(() => import('@/pages/AgencySelfEventsPage'))
const AgencyPromoteBoostsPage = lazy(() => import('@/pages/AgencyPromoteBoostsPage'))
const AgencyRegisterPage = lazy(() => import('@/pages/AgencyRegisterPage'))
const AgencyGroupBuyPage = lazy(() => import('@/pages/AgencyGroupBuyPage'))
// 🛡️ 2026-05-18: 숙소 공구 에이전시 — PR 5/6.
const AgencyStaysPage = lazy(() => import('@/pages/AgencyStaysPage'))
const AgencyRegisterBusinessPage = lazy(() => import('@/pages/AgencyRegisterBusinessPage'))
const AgencyWaitingPage = lazy(() => import('@/pages/AgencyWaitingPage'))
const AgencyGuidePage = lazy(() => import('@/pages/AgencyGuidePage'))

function AgencyAuthGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('agency_token')
  if (!token) return <Navigate to="/agency/login" replace />
  return <>{children}</>
}

export function AgencyRoutes() {
  return (
    <>
      {/* Public agency pages */}
      <Route path="/agency/login" element={<AgencyLoginPage />} />
      <Route path="/agency/register" element={<AgencyRegisterPage />} />
      <Route path="/agency/register/business" element={<AgencyRegisterBusinessPage />} />
      <Route path="/agency/waiting" element={<AgencyWaitingPage />} />
      <Route path="/agency/forgot-password" element={<AgencyForgotPasswordPage />} />
      <Route path="/agency/reset-password" element={<AgencyResetPasswordPage />} />
      <Route path="/a/:slug" element={<AgencyPublicPage />} />

      {/* Protected agency pages */}
      <Route path="/agency" element={<AgencyAuthGuard><AgencyPage /></AgencyAuthGuard>} />
      <Route path="/agency/sellers" element={<AgencyAuthGuard><AgencySellersPage /></AgencyAuthGuard>} />
      <Route path="/agency/orders" element={<AgencyAuthGuard><AgencyOrdersPage /></AgencyAuthGuard>} />
      <Route path="/agency/streams" element={<AgencyAuthGuard><AgencyStreamsPage /></AgencyAuthGuard>} />
      <Route path="/agency/stats" element={<AgencyAuthGuard><AgencyStatsPage /></AgencyAuthGuard>} />
      <Route path="/agency/introduced-stores" element={<AgencyAuthGuard><AgencyIntroducedStoresPage /></AgencyAuthGuard>} />
      <Route path="/agency/guide" element={<AgencyAuthGuard><AgencyGuidePage /></AgencyAuthGuard>} />
      <Route path="/agency/settlements" element={<AgencyAuthGuard><AgencySettlementsPage /></AgencyAuthGuard>} />
      <Route path="/agency/ranking" element={<AgencyAuthGuard><AgencyRankingPage /></AgencyAuthGuard>} />
      <Route path="/agency/schedule" element={<AgencyAuthGuard><AgencySchedulePage /></AgencyAuthGuard>} />
      <Route path="/agency/returns" element={<AgencyAuthGuard><AgencyReturnsPage /></AgencyAuthGuard>} />
      <Route path="/agency/sellers/:sellerId/products" element={<AgencyAuthGuard><AgencyProductsPage /></AgencyAuthGuard>} />
      <Route path="/agency/notices" element={<AgencyAuthGuard><AgencyNoticesPage /></AgencyAuthGuard>} />
      <Route path="/agency/compare" element={<AgencyAuthGuard><AgencyComparePage /></AgencyAuthGuard>} />
      <Route path="/agency/contracts" element={<AgencyAuthGuard><AgencyContractsPage /></AgencyAuthGuard>} />
      <Route path="/agency/targets" element={<AgencyAuthGuard><AgencyTargetsPage /></AgencyAuthGuard>} />
      <Route path="/agency/campaigns" element={<AgencyAuthGuard><AgencyCampaignsPage /></AgencyAuthGuard>} />
      <Route path="/agency/incentives" element={<AgencyAuthGuard><AgencyIncentivesPage /></AgencyAuthGuard>} />
      <Route path="/agency/messages" element={<AgencyAuthGuard><AgencyMessagesPage /></AgencyAuthGuard>} />
      <Route path="/agency/coupons" element={<AgencyAuthGuard><AgencyCouponsPage /></AgencyAuthGuard>} />
      <Route path="/agency/members" element={<AgencyAuthGuard><AgencyMembersPage /></AgencyAuthGuard>} />
      <Route path="/agency/calendar" element={<AgencyAuthGuard><AgencyCalendarPage /></AgencyAuthGuard>} />
      <Route path="/agency/invites" element={<AgencyAuthGuard><AgencyInvitesPage /></AgencyAuthGuard>} />
      <Route path="/agency/pk" element={<AgencyAuthGuard><AgencyPKBattlesPage /></AgencyAuthGuard>} />
      <Route path="/agency/transfers" element={<AgencyAuthGuard><AgencyTransfersPage /></AgencyAuthGuard>} />
      <Route path="/agency/match-suggestions" element={<AgencyAuthGuard><AgencyMatchSuggestionsPage /></AgencyAuthGuard>} />
      <Route path="/agency/events" element={<AgencyAuthGuard><AgencySelfEventsPage /></AgencyAuthGuard>} />
      <Route path="/agency/promote-boosts" element={<AgencyAuthGuard><AgencyPromoteBoostsPage /></AgencyAuthGuard>} />
      <Route path="/agency/profile" element={<AgencyAuthGuard><AgencyProfilePage /></AgencyAuthGuard>} />
      <Route path="/agency/group-buy" element={<AgencyAuthGuard><AgencyGroupBuyPage /></AgencyAuthGuard>} />
      <Route path="/agency/stays" element={<AgencyAuthGuard><AgencyStaysPage /></AgencyAuthGuard>} />
    </>
  )
}
