/**
 * 🏭 2026-06-01 유통스타트 도매몰 — 어드민 유통사 등급/마진 설정 API.
 * (docs/design/wholesale-utongstart.md, Phase 1b)
 *
 * - GET   /api/admin/distributor/grades              — 등급별 마진율 목록
 * - PUT   /api/admin/distributor/grades/:grade       — 등급 마진율/라벨/활성 수정
 * - GET   /api/admin/distributor/distributors?search= — 유통사(셀러) 검색 + 배정현황
 * - PATCH /api/admin/distributor/distributors/:id     — 유통사 등급 배정 + 특별할인 기간
 *
 * ⚠️ 도매몰 한정: distributor_grade 는 도매 카탈로그 가격 계산에서만 읽힘 — 일반 셀러 동작 불변.
 * 마운트: app.route('/api/admin/distributor', distributorAdminRoutes)
 *
 * 🧩 2026-06-22 byte-identical 분해(registrar 패턴, 동작 변화 0): 라우트 핸들러는 distributor-admin/ 하위
 *    모듈로 이동(공유 헬퍼/상수는 distributor-admin/helpers.ts). 이 파일은 app 생성 + 미들웨어 체인 +
 *    각 registerXxxRoutes(app) 를 원래 라우트 등록 순서 그대로 호출 + export 만 담당.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { adminIpWhitelist, adminAuditMiddleware } from '@/worker/middleware/admin-security'
import { registerGradesRoutes } from './distributor-admin/grades'
import { registerDistributorsRoutes } from './distributor-admin/distributors'
import { registerProposalsRoutes } from './distributor-admin/proposals'
import { registerOrdersRoutes } from './distributor-admin/orders'
import { registerProductsRoutes } from './distributor-admin/products'
import { registerOemRoutes } from './distributor-admin/oem'
import { registerProductsPricingRoutes } from './distributor-admin/products-pricing'
import { registerSettingsRoutes } from './distributor-admin/settings'
import { registerQtyTiersRoutes } from './distributor-admin/qty-tiers'
import { registerTaxDocumentsRoutes } from './distributor-admin/tax-documents'
import { registerSeedDemoRoutes } from './distributor-admin/seed-demo'
import { registerAutoGradeRoutes } from './distributor-admin/auto-grade'
import { registerSupplyToolsRoutes } from './distributor-admin/supply-tools'

const app = new Hono<{ Bindings: Env }>()
// 🏭 2026-06-07 (보안 audit, 사용자 승인): 이 라우터는 adminApp 밖에 마운트돼 IP 화이트리스트·감사로그가
//   누락됐었음(환불/세금계산서 발행 등 민감 작업 포함). adminApp(worker/index.ts:278-280)과 동일 체인 적용.
//   adminIpWhitelist 는 ADMIN_IP_WHITELIST 미설정 시 fail-open(전체 허용)이라 잠김 위험 없음.
app.use('*', adminIpWhitelist())
app.use('*', requireAdmin())
app.use('*', adminAuditMiddleware())

// 라우트 등록 — 원본 distributor-admin.routes.ts 의 등록 순서와 동일하게 호출(순서 보존 필수).
registerGradesRoutes(app)
registerDistributorsRoutes(app)
registerProposalsRoutes(app)
registerOrdersRoutes(app)
registerProductsRoutes(app)
registerOemRoutes(app)
registerProductsPricingRoutes(app)
registerSettingsRoutes(app)
registerQtyTiersRoutes(app)
registerTaxDocumentsRoutes(app)
registerSeedDemoRoutes(app)
registerAutoGradeRoutes(app)
registerSupplyToolsRoutes(app)

export { app as distributorAdminRoutes }
