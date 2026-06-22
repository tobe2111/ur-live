/**
 * 🛡️ 2026-05-19: 어드민 — KT Alpha (기프티쇼) 관리.
 *
 *   GET    /admin/kt-alpha/settings    — 현재 설정 + 잔액 + sync 통계
 *   PATCH  /admin/kt-alpha/settings    — markup_pct / user_id / callback_no / dev_mode 등 설정 갱신
 *   POST   /admin/kt-alpha/sync        — 수동 sync 트리거 (cron 안 기다리고)
 *   POST   /admin/kt-alpha/balance     — 비즈머니 잔액 강제 갱신
 *   GET    /admin/kt-alpha/catalog     — gift_catalog 조회 (필터/페이징)
 *
 *   인증: adminApp.use('*', requireAdmin()) 가 처리.
 *
 * 🧩 route-group 분해 (동작 byte-identical) — 핸들러 본문은 admin-kt-alpha/ 하위 모듈로 이동.
 *   각 registerXxx 를 원래 라우트 등록 순서와 동일하게 호출.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { registerSettings } from './admin-kt-alpha/settings'
import { registerDebug } from './admin-kt-alpha/debug'
import { registerCatalog } from './admin-kt-alpha/catalog'
import { registerConsumerProducts } from './admin-kt-alpha/consumer-products'
import { registerCategories } from './admin-kt-alpha/categories'
import { registerProducts } from './admin-kt-alpha/products'
import { registerDiagnostics } from './admin-kt-alpha/diagnostics'
import { registerVoucherOrders } from './admin-kt-alpha/voucher-orders'
import { registerSystem } from './admin-kt-alpha/system'

export const adminKtAlphaRoutes = new Hono<{ Bindings: Env }>()

registerSettings(adminKtAlphaRoutes)
registerDebug(adminKtAlphaRoutes)
registerCatalog(adminKtAlphaRoutes)
registerConsumerProducts(adminKtAlphaRoutes)
registerCategories(adminKtAlphaRoutes)
registerProducts(adminKtAlphaRoutes)
registerDiagnostics(adminKtAlphaRoutes)
registerVoucherOrders(adminKtAlphaRoutes)
registerSystem(adminKtAlphaRoutes)
