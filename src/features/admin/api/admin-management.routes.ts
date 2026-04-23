/**
 * Admin Management API Routes
 *
 * Comprehensive endpoints for admin dashboard:
 * - GET  /sellers            - 모든 판매자 조회
 * - GET  /sellers/pending    - 승인 대기 중인 판매자 조회
 * - PATCH /sellers/:id/approve    - 판매자 승인
 * - PATCH /sellers/:id/reject     - 판매자 거부
 * - PATCH /sellers/:id/commission - 판매자 수수료율 변경
 * - PATCH /sellers/:id/permissions- 판매자 권한 변경
 * - GET  /orders             - 모든 주문 조회
 * - GET  /products           - 모든 상품 조회
 * - GET  /stats              - 대시보드 통계
 * - GET  /dashboard/stats    - 실시간 대시보드 통계
 * - GET  /settlement/stats   - 정산 통계
 * - GET  /settlement/records - 정산 기록
 * - DELETE /streams/:id      - 라이브 스트림 삭제
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { requireAdmin } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { sendAlimtalk, buildSampleApprovalMessage } from '../../alimtalk/aligo';
import { DEFAULT_COMMISSION_RATE } from '@/shared/constants';
import { KOREAN_NAMES, REVIEW_TEMPLATES } from './review-templates';

// v30 FIX: 에러 메시지 유출 방지. 프로덕션에서는 generic 메시지만 노출,
// 개발에서는 디버깅을 위해 원본 보존. SQL 오류/컬럼명이 클라이언트에 노출되던 문제 수정.
function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}
import { writeAuditLog } from '@/worker/middleware/admin-security';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';

interface SellerRow {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  business_name: string | null;
  business_number: string | null;
  status: string;
  created_at: string;
  commission_rate?: number;
  can_manipulate_stats?: number;
}

interface OrderRow {
  id: number;
  order_number: string;
  user_id: string;
  seller_id: number | null;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_address_detail: string | null;
  shipping_zipcode: string | null;
  courier: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
  seller_name: string | null;
  items?: OrderItemRow[];
}

interface OrderItemRow {
  id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  price: number;
  image_url: string | null;
}

interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  image_url: string | null;
  is_active: number;
  product_type: string | null;
  category: string | null;
  seller_id: number | null;
  created_at: string;
  seller_name: string | null;
}

interface CountRow {
  count: number;
}

interface SalesRow {
  total: number;
}

interface SettlementOverviewRow {
  total_orders: number;
  total_sales: number;
  total_commission: number;
  total_seller_amount: number;
}

interface SettlementSellerRow {
  seller_id: number;
  seller_name: string | null;
  business_name: string | null;
  commission_rate: number;
  order_count: number;
  total_sales: number;
  commission_amount: number;
  seller_amount: number;
}

interface SettlementRecordRow {
  id: number;
  order_number: string;
  seller_id: number | null;
  seller_name: string | null;
  business_name: string | null;
  total_amount: number;
  commission_rate: number;
  commission_amount: number;
  seller_amount: number;
  settlement_status: string;
  settled_at: string | null;
  created_at: string;
  user_name: string | null;
}

interface IdRow {
  id: number;
  status?: string;
  commission_rate?: number;
}

export const adminManagementRoutes = new Hono<{ Bindings: Env }>();

// 모든 admin 관리 엔드포인트는 admin 권한 필수
adminManagementRoutes.use('*', requireAdmin());

// ─── 판매자 관리 ──────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 146 (TD-006 부분): admin-sellers.routes.ts 로 이관.

// ─── 주문 관리 ──────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 149 (TD-006 부분): admin-orders.routes.ts 로 이관.

// ─── 상품 관리 ───────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 148 (TD-006 부분): admin-products.routes.ts 로 이관.
// (/products, /products/:id, /sample-requests 모두 포함)

// ─── 통계 ────────────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 144 (TD-006 부분): admin-stats.routes.ts 로 이관.

// ─── 정산 관리 ──────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 143 (TD-006 부분): admin-settlements.routes.ts 로 이관.
// worker/index.ts 에서 adminApp.route('/', adminSettlementsRoutes) 으로 마운트됨.

// ─── 라이브 스트림 관리 + Alimtalk ──────────────────────────────────────────
// 🛡️ 2026-04-22 배치 150 (TD-006 부분): admin-streams.routes.ts 로 이관.

// ═══════════════════════════════════════════════════════════════════════════════
// 분리된 sub-router (TD-006 완료):
// - 배치 122: review-templates (데이터)
// - 배치 138: admin-coupons
// - 배치 141: admin-side-banners
// - 배치 143: admin-settlements
// - 배치 144: admin-stats
// - 배치 146: admin-sellers
// - 배치 148: admin-products + sample-requests
// - 배치 149: admin-orders
// - 배치 150: admin-streams + alimtalk
// - 배치 151: admin-accounts (관리자 CRUD)
// - 배치 152: admin-analytics
// - 배치 153: admin-moderation (reviews v2 + live-monitor)
// - 배치 154: admin-users
// - 배치 155: admin-misc (donations + deals + commission + audit)
// - 배치 156: admin-review-generator
// ═══════════════════════════════════════════════════════════════════════════════

export default adminManagementRoutes;
