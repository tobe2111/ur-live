/**
 * Agency API Routes — 진입점 (분할 후 thin orchestrator)
 *
 * 실제 구현은 아래 서브 파일에 분산:
 *   agency-auth.routes.ts      — login, register, password
 *   agency-profile.routes.ts   — profile, notifications
 *   agency-sellers.routes.ts   — seller management, products, streams
 *   agency-analytics.routes.ts — stats, schedule, returns, targets, CSV
 *   agency-orders.routes.ts    — orders, streams, settlements
 *   agency-ops.routes.ts       — notices, contracts, kakao-link
 *
 * Auth:
 *   POST /api/agency/login
 *   POST /api/agency/register
 *
 * Protected (requires agency JWT):
 *   GET  /api/agency/profile
 *   GET  /api/agency/sellers            - 소속 셀러 목록
 *   GET  /api/agency/sellers/:id/stats  - 특정 셀러 통계
 *   GET  /api/agency/stats              - 전체 집계 통계
 *   GET  /api/agency/stats/batch        - 셀러별 일괄 통계
 *   GET  /api/agency/orders             - 소속 셀러 주문 목록
 *   GET  /api/agency/streams            - 소속 셀러 라이브 현황
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import type { AgencyVars } from './agency-shared'
import { agencyAuthRoutes } from './agency-auth.routes'
import { agencyProfileRoutes } from './agency-profile.routes'
import { agencySellersRoutes } from './agency-sellers.routes'
import { agencyAnalyticsRoutes } from './agency-analytics.routes'
import { agencyOrdersRoutes } from './agency-orders.routes'
import { agencyOpsRoutes } from './agency-ops.routes'

const app = new Hono<{ Bindings: Env; Variables: AgencyVars }>()
app.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

// ── 서브 라우터 마운트 ────────────────────────────────────────
// 순서 중요: 더 구체적인 경로가 먼저 등록되어야 함
app.route('/', agencyAuthRoutes)
app.route('/', agencyProfileRoutes)
app.route('/', agencySellersRoutes)
app.route('/', agencyAnalyticsRoutes)
app.route('/', agencyOrdersRoutes)
app.route('/', agencyOpsRoutes)

export { app as agencyRoutes }
