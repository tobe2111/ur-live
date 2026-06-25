/**
 * Schema Repair Routes (admin only)
 *
 * GET /api/_internal/repair-schema
 *
 * 🩹 Self-healing schema repair (idempotent, 재실행 안전)
 * 2026-04-22: D1 migration runner CI/CD 권한 부재 우회용.
 * 모든 ALTER TABLE 은 IF EXISTS / catch 처리 — 이미 있으면 무해 무동작.
 * 운영자가 한 번 호출하면 누락된 컬럼이 자동 추가됨.
 *
 * Migration 버전 추적 — 매 호출 시 _migration_history 에 기록.
 * CI 에서 D1 권한 받으면 정식 migration runner 로 전환하고 이 endpoint 는 deprecate.
 *
 * 🛡️ 2026-04-27: TD-006 Phase E — worker/index.ts 인라인 핸들러 분리.
 */
import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import { requireAdmin } from '../middleware/auth';
import { swallow } from '@/shared/utils/swallow';
import { ensureAdminsRoleUnconstrained } from '@/worker/utils/ensure-admins-role';

const repairSchemaRoutes = new Hono<{ Bindings: Env }>();

async function ensureMigrationTrackingTable(DB: D1Database) {
  if (_done_ensureMigrationTrackingTable.has(DB)) return
  _done_ensureMigrationTrackingTable.add(DB)
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS _migration_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run().catch(swallow('repair-schema:migration-history'));
}

// 🛡️ 2026-05-20: runSchemaRepair 를 standalone export — cron 에서 직접 호출 가능 (자동화).
//   기존: HTTP 핸들러 안에 모든 로직 인라인. cron 이 부르려면 어드민 토큰 필요해 불편.
//   변경: pure async fn 으로 추출 → 핸들러는 thin wrapper, cron 은 직접 invoke.
export type SchemaRepairResult = {
  columns: Array<{ desc: string; status: 'added' | 'exists' | 'error'; error?: string }>
  tables: Array<{ name: string; status: 'ok' | 'error'; error?: string }>
  /** 🛡️ 2026-06-10: D1 결과셋 컬럼 한도(100) 사전 경보 — 85 이상이면 column_warnings 에 표시. */
  column_counts?: Record<string, number>
  column_warnings?: string[]
}

export async function runSchemaRepair(DB: D1Database): Promise<SchemaRepairResult> {
  await ensureMigrationTrackingTable(DB);

  const stmts: Array<{ desc: string; sql: string; requiresTable?: string }> = [
    // ── sellers ────────────────────────────────────
    { desc: 'sellers.commission_rate', sql: "ALTER TABLE sellers ADD COLUMN commission_rate REAL DEFAULT 5.00" },
    { desc: 'sellers.seller_type', sql: "ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'" },
    { desc: 'sellers.business_number', sql: "ALTER TABLE sellers ADD COLUMN business_number TEXT" },
    { desc: 'sellers.phone', sql: "ALTER TABLE sellers ADD COLUMN phone TEXT" },
    { desc: 'sellers.bank_account', sql: "ALTER TABLE sellers ADD COLUMN bank_account TEXT" },
    { desc: 'sellers.last_login_at', sql: "ALTER TABLE sellers ADD COLUMN last_login_at TEXT" },
    { desc: 'sellers.kakao_chat_url', sql: "ALTER TABLE sellers ADD COLUMN kakao_chat_url TEXT" },
    { desc: 'sellers.base_shipping_fee', sql: "ALTER TABLE sellers ADD COLUMN base_shipping_fee INTEGER DEFAULT 3000" },
    { desc: 'sellers.shipping_fee', sql: "ALTER TABLE sellers ADD COLUMN shipping_fee INTEGER DEFAULT 3000" },
    { desc: 'sellers.free_shipping_threshold', sql: "ALTER TABLE sellers ADD COLUMN free_shipping_threshold INTEGER DEFAULT 50000" },
    { desc: 'sellers.profile_image', sql: "ALTER TABLE sellers ADD COLUMN profile_image TEXT" },
    { desc: 'sellers.bio', sql: "ALTER TABLE sellers ADD COLUMN bio TEXT" },
    { desc: 'sellers.youtube_channel', sql: "ALTER TABLE sellers ADD COLUMN youtube_channel TEXT" },
    { desc: 'sellers.youtube_email', sql: "ALTER TABLE sellers ADD COLUMN youtube_email TEXT" },
    { desc: 'sellers.agency_id', sql: "ALTER TABLE sellers ADD COLUMN agency_id INTEGER" },
    { desc: 'sellers.approved_by', sql: "ALTER TABLE sellers ADD COLUMN approved_by INTEGER" },
    { desc: 'sellers.approved_at', sql: "ALTER TABLE sellers ADD COLUMN approved_at DATETIME" },
    // 🛡️ 2026-06-12 (감사 1단계): 셀러 거절 사유 — /my-seller-status + SellerWaitingPage 표시.
    { desc: 'sellers.reject_reason', sql: "ALTER TABLE sellers ADD COLUMN reject_reason TEXT" },

    // ── admins ─────────────────────────────────────
    { desc: 'admins.role', sql: "ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'admin'" },
    { desc: 'admins.is_active', sql: "ALTER TABLE admins ADD COLUMN is_active INTEGER DEFAULT 1" },
    { desc: 'admins.last_login_at', sql: "ALTER TABLE admins ADD COLUMN last_login_at TEXT" },
    { desc: 'admins.login_pin_hash', sql: "ALTER TABLE admins ADD COLUMN login_pin_hash TEXT" },
    // ── RBAC 부트스트랩 (2026-06-17) ───────────────────────────────────────────
    //   2026-06-16 RBAC 도입 때 admins.role 가 DEFAULT 'admin' 로 추가되며 기존 슈퍼 계정이
    //   'admin' 으로 강등 → 슈퍼 전용(계정관리/감사로그) 접근 소실. 아래로 자가 복구(멱등).
    { desc: 'bootstrap: 지정 슈퍼 어드민 복구', sql: "UPDATE admins SET role = 'super_admin' WHERE lower(email) = 'tobe2111@naver.com'" },
    { desc: 'bootstrap: super_admin 최소 1명 보장(없으면 최초 어드민)', sql: "UPDATE admins SET role = 'super_admin' WHERE id = (SELECT id FROM admins ORDER BY id ASC LIMIT 1) AND NOT EXISTS (SELECT 1 FROM admins WHERE role = 'super_admin')" },

    // ── users (CRITICAL — 감사에서 발견) ─────────────
    { desc: 'users.password_hash', sql: "ALTER TABLE users ADD COLUMN password_hash TEXT" },
    { desc: 'users.last_login_at', sql: "ALTER TABLE users ADD COLUMN last_login_at TEXT" },
    { desc: 'users.firebase_uid', sql: "ALTER TABLE users ADD COLUMN firebase_uid TEXT" },
    { desc: 'users.user_type', sql: "ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'buyer'" },
    { desc: 'users.kakao_access_token', sql: "ALTER TABLE users ADD COLUMN kakao_access_token TEXT" },
    { desc: 'users.kakao_refresh_token', sql: "ALTER TABLE users ADD COLUMN kakao_refresh_token TEXT" },
    { desc: 'users.profile_image', sql: "ALTER TABLE users ADD COLUMN profile_image TEXT" },
    // 🛡️ 2026-05-24: PATCH /api/auth/profile 500 사고 — phone / updated_at 컬럼 누락 가능성.
    //   미사용 DB 에서 idempotent ALTER (이미 있으면 SQLite 가 에러 throw → repair-schema 가 swallow).
    { desc: 'users.phone', sql: "ALTER TABLE users ADD COLUMN phone TEXT" },
    { desc: 'users.updated_at', sql: "ALTER TABLE users ADD COLUMN updated_at TEXT" },
    // 🛡️ 2026-06-06 (보안): 카카오 email verified 플래그 — become(도매/제조) same-email 자동연결 게이트.
    { desc: 'users.email_verified', sql: "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0" },
    // 🛡️ 2026-06-12 (감사 1단계): 알림 설정 토글 실동작화 — push/email 발송 게이트 (system-push/system-email).
    { desc: 'users.push_enabled', sql: "ALTER TABLE users ADD COLUMN push_enabled INTEGER DEFAULT 1" },
    { desc: 'users.email_enabled', sql: "ALTER TABLE users ADD COLUMN email_enabled INTEGER DEFAULT 1" },
    // 🛡️ 2026-05-25 (migration 0278): 큐레이터 링크샵 — handle / bio / theme
    { desc: 'users.handle', sql: "ALTER TABLE users ADD COLUMN handle TEXT" },
    { desc: 'users.bio', sql: "ALTER TABLE users ADD COLUMN bio TEXT" },
    { desc: 'users.linkshop_theme', sql: "ALTER TABLE users ADD COLUMN linkshop_theme TEXT DEFAULT 'dark'" },
    // 🛡️ 2026-05-25 (migration 0279): 배송 재설계 — 지역 / 추적
    { desc: 'orders.region_code', sql: "ALTER TABLE orders ADD COLUMN region_code TEXT" },
    { desc: 'orders.extra_shipping_fee', sql: "ALTER TABLE orders ADD COLUMN extra_shipping_fee INTEGER NOT NULL DEFAULT 0" },
    { desc: 'orders.last_tracking_sync_at', sql: "ALTER TABLE orders ADD COLUMN last_tracking_sync_at DATETIME" },
    { desc: 'orders.tracking_status', sql: "ALTER TABLE orders ADD COLUMN tracking_status TEXT" },
    { desc: 'orders.tracking_carrier_code', sql: "ALTER TABLE orders ADD COLUMN tracking_carrier_code TEXT" },
    // 🔐 2026-06-16: agency 자동정산(agency-auto-settle cron) 멱등 마커 — 없으면 SELECT 부터
    //   'no such column' 으로 터져 자동정산이 영구 미작동(매 agency try-catch 로 silent skip). check-sql-column-exists 도 차단.
    { desc: 'orders.agency_settled', sql: "ALTER TABLE orders ADD COLUMN agency_settled INTEGER NOT NULL DEFAULT 0" },
    // 💸 2026-06-17: 혼합결제(Toss+딜) 의 '딜 사용분' — 결제 성공(/confirm) 시 이 값만큼 잔액 차감, 환불 시 복원.
    { desc: 'orders.deal_used', sql: "ALTER TABLE orders ADD COLUMN deal_used INTEGER NOT NULL DEFAULT 0" },
    // 🛡️ 2026-05-25 (migration 0280): 셀러 승급 트래킹
    { desc: 'users.curator_total_lifetime_earnings', sql: "ALTER TABLE users ADD COLUMN curator_total_lifetime_earnings INTEGER NOT NULL DEFAULT 0" },
    { desc: 'users.seller_upgrade_offered_at', sql: "ALTER TABLE users ADD COLUMN seller_upgrade_offered_at DATETIME" },
    // 🛡️ 2026-05-28: 유저 사업자 등록 (영입/추천 commission 현금 정산 분기용).
    //   사업자 → 현금 + 원천징수 / 비사업자 → 딜/상품권 (docs/SERVICE_MODEL.md §4).
    { desc: 'users.business_number', sql: "ALTER TABLE users ADD COLUMN business_number TEXT" },
    { desc: 'users.business_name', sql: "ALTER TABLE users ADD COLUMN business_name TEXT" },
    { desc: 'users.business_status', sql: "ALTER TABLE users ADD COLUMN business_status TEXT DEFAULT 'none'" }, // 'none'|'pending'|'verified'|'rejected'
    { desc: 'users.business_verified_at', sql: "ALTER TABLE users ADD COLUMN business_verified_at DATETIME" },
    { desc: 'users.tax_type', sql: "ALTER TABLE users ADD COLUMN tax_type TEXT DEFAULT 'business_income'" }, // 'business_income'(3.3%)|'other_income'(8.8%)
    { desc: 'users.bank_name', sql: "ALTER TABLE users ADD COLUMN bank_name TEXT" },
    { desc: 'users.bank_account', sql: "ALTER TABLE users ADD COLUMN bank_account TEXT" },
    { desc: 'users.account_holder', sql: "ALTER TABLE users ADD COLUMN account_holder TEXT" },
    { desc: 'idx_users_business_number', sql: "CREATE INDEX IF NOT EXISTS idx_users_business_number ON users(business_number) WHERE business_number IS NOT NULL" },
    // 🛡️ 2026-05-28: 공구 대행 등록 (products.seller_id 는 항상 매장, 등록자만 별도 기록).
    //   docs/SERVICE_MODEL.md §6 — 정산/QR 충돌 방지.
    { desc: 'products.registered_by_user_id', sql: "ALTER TABLE products ADD COLUMN registered_by_user_id INTEGER" },
    { desc: 'products.registered_by_agency_id', sql: "ALTER TABLE products ADD COLUMN registered_by_agency_id INTEGER" },
    { desc: 'products.registration_approved', sql: "ALTER TABLE products ADD COLUMN registration_approved INTEGER DEFAULT 1" }, // 대행 등록 시 0, 매장 승인 시 1
    { desc: 'products.pack_size', sql: "ALTER TABLE products ADD COLUMN pack_size INTEGER DEFAULT 1" },        // BIZ-8: 1박스 낱개수(표시용)
    { desc: 'products.order_multiple', sql: "ALTER TABLE products ADD COLUMN order_multiple INTEGER DEFAULT 1" }, // BIZ-8: 주문 수량 배수 강제
    // 🛡️ 2026-05-25 (migration 0281): 합배송 인프라 (Phase 6 deferred — ENABLE_BUNDLING=false)
    { desc: 'products.bundling_key', sql: "ALTER TABLE products ADD COLUMN bundling_key TEXT" },
    { desc: 'orders.consolidated_with', sql: "ALTER TABLE orders ADD COLUMN consolidated_with TEXT" },

    // ── products ───────────────────────────────────
    { desc: 'products.view_count', sql: "ALTER TABLE products ADD COLUMN view_count INTEGER DEFAULT 0" },
    { desc: 'products.avg_rating', sql: "ALTER TABLE products ADD COLUMN avg_rating REAL DEFAULT 0" },
    { desc: 'products.review_count', sql: "ALTER TABLE products ADD COLUMN review_count INTEGER DEFAULT 0" },
    { desc: 'products.sold_count', sql: "ALTER TABLE products ADD COLUMN sold_count INTEGER DEFAULT 0" },
    // 🛡️ 2026-04-22 배치 114: stock_quantity ALTER 제거 — 신규 환경에서 중복 컬럼 생성 방지.
    //   기존 `stock` 컬럼을 단일 truth source 로 사용. 이미 stock_quantity 가 있는 환경은
    //   코드의 fallback (`p.stock ?? p.stock_quantity`) 로 하위 호환.
    { desc: 'products.product_type', sql: "ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'regular'" },
    { desc: 'products.slug', sql: "ALTER TABLE products ADD COLUMN slug TEXT" },
    { desc: 'products.is_active', sql: "ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1" },
    { desc: 'products.thumbnail', sql: "ALTER TABLE products ADD COLUMN thumbnail TEXT" },
    // 🛡️ 2026-06-10 (상품 상세 500 전수조사 — 수렴 보장): PRODUCT_DETAIL_FIELDS 의 모든 컬럼은
    //   repair-schema 로 복구 가능해야 함 (CI: check-product-detail-fields-repairable.mjs strict).
    //   group-buy/restaurant/voucher 계열은 helpers.ts ensureTables 도 생성하지만, repair 가
    //   단일 수렴 지점이 되도록 여기에도 등록 (멱등 — 이미 있으면 no-op).
    { desc: 'products.seller_id', sql: "ALTER TABLE products ADD COLUMN seller_id INTEGER" },
    { desc: 'products.deal_only', sql: "ALTER TABLE products ADD COLUMN deal_only INTEGER DEFAULT 0" },
    { desc: 'products.group_buy_target', sql: "ALTER TABLE products ADD COLUMN group_buy_target INTEGER DEFAULT 0" },
    { desc: 'products.group_buy_current', sql: "ALTER TABLE products ADD COLUMN group_buy_current INTEGER DEFAULT 0" },
    { desc: 'products.group_buy_status', sql: "ALTER TABLE products ADD COLUMN group_buy_status TEXT DEFAULT 'active'" },
    { desc: 'products.group_buy_deadline', sql: "ALTER TABLE products ADD COLUMN group_buy_deadline DATETIME" },
    { desc: 'products.group_buy_tiers', sql: "ALTER TABLE products ADD COLUMN group_buy_tiers TEXT" },
    { desc: 'products.restaurant_name', sql: "ALTER TABLE products ADD COLUMN restaurant_name TEXT" },
    { desc: 'products.restaurant_address', sql: "ALTER TABLE products ADD COLUMN restaurant_address TEXT" },
    { desc: 'products.restaurant_phone', sql: "ALTER TABLE products ADD COLUMN restaurant_phone TEXT" },
    { desc: 'products.restaurant_lat', sql: "ALTER TABLE products ADD COLUMN restaurant_lat REAL" },
    { desc: 'products.restaurant_lng', sql: "ALTER TABLE products ADD COLUMN restaurant_lng REAL" },
    { desc: 'products.voucher_expiry', sql: "ALTER TABLE products ADD COLUMN voucher_expiry DATE" },
    { desc: 'products.voucher_terms', sql: "ALTER TABLE products ADD COLUMN voucher_terms TEXT" },

    // ── orders ─────────────────────────────────────
    { desc: 'orders.recipient_name', sql: "ALTER TABLE orders ADD COLUMN recipient_name TEXT" },
    { desc: 'orders.recipient_phone', sql: "ALTER TABLE orders ADD COLUMN recipient_phone TEXT" },
    { desc: 'orders.shipping_postal_code', sql: "ALTER TABLE orders ADD COLUMN shipping_postal_code TEXT" },
    { desc: 'orders.shipping_address', sql: "ALTER TABLE orders ADD COLUMN shipping_address TEXT" },
    { desc: 'orders.shipping_address_detail', sql: "ALTER TABLE orders ADD COLUMN shipping_address_detail TEXT" },
    { desc: 'orders.refunded_amount', sql: "ALTER TABLE orders ADD COLUMN refunded_amount INTEGER DEFAULT 0" },
    { desc: 'orders.payment_status', sql: "ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'" },
    { desc: 'orders.cancel_reason', sql: "ALTER TABLE orders ADD COLUMN cancel_reason TEXT" },
    { desc: 'orders.payment_method', sql: "ALTER TABLE orders ADD COLUMN payment_method TEXT" },
    { desc: 'orders.paid_at', sql: "ALTER TABLE orders ADD COLUMN paid_at DATETIME" },
    { desc: 'orders.shipped_at', sql: "ALTER TABLE orders ADD COLUMN shipped_at DATETIME" },
    { desc: 'orders.delivered_at', sql: "ALTER TABLE orders ADD COLUMN delivered_at DATETIME" },

    // ── order_items ────────────────────────────────
    { desc: 'order_items.product_name', sql: "ALTER TABLE order_items ADD COLUMN product_name TEXT" },
    { desc: 'order_items.product_thumbnail', sql: "ALTER TABLE order_items ADD COLUMN product_thumbnail TEXT" },
    { desc: 'order_items.product_sku', sql: "ALTER TABLE order_items ADD COLUMN product_sku TEXT" },
    { desc: 'order_items.price', sql: "ALTER TABLE order_items ADD COLUMN price INTEGER" },
    // 🛡️ 2026-06-25: 제조사 드랍쉽 발송 쿼리(supplier-dashboard.routes:988)가 oi.status 참조 — migration 0118 컬럼, 미적용 환경 500 방지.
    { desc: 'order_items.status', sql: "ALTER TABLE order_items ADD COLUMN status TEXT DEFAULT 'PENDING'" },

    // ── shipping_addresses ─────────────────────────
    { desc: 'shipping_addresses.label', sql: "ALTER TABLE shipping_addresses ADD COLUMN label TEXT" },
    { desc: 'shipping_addresses.delivery_note', sql: "ALTER TABLE shipping_addresses ADD COLUMN delivery_note TEXT" },
    { desc: 'shipping_addresses.entry_code', sql: "ALTER TABLE shipping_addresses ADD COLUMN entry_code TEXT" },
    { desc: 'shipping_addresses.entry_method', sql: "ALTER TABLE shipping_addresses ADD COLUMN entry_method TEXT" },
    { desc: 'shipping_addresses.country', sql: "ALTER TABLE shipping_addresses ADD COLUMN country TEXT DEFAULT 'KR'" },

    // ── live_streams ───────────────────────────────
    { desc: 'live_streams.current_viewers', sql: "ALTER TABLE live_streams ADD COLUMN current_viewers INTEGER DEFAULT 0" },
    { desc: 'live_streams.total_viewers', sql: "ALTER TABLE live_streams ADD COLUMN total_viewers INTEGER DEFAULT 0" },
    { desc: 'live_streams.like_count', sql: "ALTER TABLE live_streams ADD COLUMN like_count INTEGER DEFAULT 0" },
    // 2026-04-23 배치 164: 라이브 분석 정확도 개선 (P1)
    { desc: 'live_streams.peak_viewers', sql: "ALTER TABLE live_streams ADD COLUMN peak_viewers INTEGER DEFAULT 0" },
    // 2026-05-10: OME push 등 송출 측 에러를 셀러 진단 페이지에서 노출하기 위함
    { desc: 'live_streams.last_error', sql: "ALTER TABLE live_streams ADD COLUMN last_error TEXT" },
    // 🛡️ 2026-05-14: VOD 다시보기 상태 — cron 이 YouTube videos.list 로 채움.
    //   vod_ready 1 = YouTube 가 VOD 처리 완료, 시청 가능
    //   vod_blocked_reason: 'private' / 'embed_disabled' / 'made_for_kids' / 'processing_failed'
    { desc: 'live_streams.vod_ready', sql: "ALTER TABLE live_streams ADD COLUMN vod_ready INTEGER DEFAULT 0" },
    { desc: 'live_streams.vod_blocked_reason', sql: "ALTER TABLE live_streams ADD COLUMN vod_blocked_reason TEXT" },
    { desc: 'live_streams.vod_checked_at', sql: "ALTER TABLE live_streams ADD COLUMN vod_checked_at DATETIME" },
    // 2026-05-10: 셀러가 직접 업로드한 썸네일 (YouTube 자동 썸네일과 별도 보존)
    { desc: 'live_streams.custom_thumbnail_url', sql: "ALTER TABLE live_streams ADD COLUMN custom_thumbnail_url TEXT" },
    // 2026-05-11: admission webhook 이 status='live' 와 동시에 박는 시각. agency-calendar/kpi/stats 가 참조.
    { desc: 'live_streams.started_at', sql: "ALTER TABLE live_streams ADD COLUMN started_at DATETIME" },
    // 2026-05-13: OME closing webhook 시 즉시 ended 처리 대신 disconnect marker — 60s grace period 후 종료
    { desc: 'live_streams.disconnected_at', sql: "ALTER TABLE live_streams ADD COLUMN disconnected_at DATETIME" },
    // 2026-05-13: YouTube WHIP direct ingest URL — webrtc ingestion 시 저장. Worker proxy 가 forward.
    { desc: 'live_streams.whip_url', sql: "ALTER TABLE live_streams ADD COLUMN whip_url TEXT" },
    { desc: 'live_stream_views.last_heartbeat', sql: "ALTER TABLE live_stream_views ADD COLUMN last_heartbeat TEXT", requiresTable: 'live_stream_views' },
    { desc: 'idx_lsv_stream_session', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_lsv_stream_session ON live_stream_views(live_stream_id, session_id)", requiresTable: 'live_stream_views' },
    { desc: 'idx_lsv_stream_heartbeat', sql: "CREATE INDEX IF NOT EXISTS idx_lsv_stream_heartbeat ON live_stream_views(live_stream_id, last_heartbeat, left_at)", requiresTable: 'live_stream_views' },

    // ── chat_messages 복합 인덱스 (live_stream_id + id) ──
    // live-sse polling: WHERE live_stream_id=? AND id>? ORDER BY id ASC 쿼리 최적화
    { desc: 'idx_chat_live_id', sql: "CREATE INDEX IF NOT EXISTS idx_chat_live_id ON chat_messages(live_stream_id, id)" },

    // ── donations ──────────────────────────────────
    { desc: 'donations.payment_status', sql: "ALTER TABLE donations ADD COLUMN payment_status TEXT DEFAULT 'pending'" },
    { desc: 'donations.amount', sql: "ALTER TABLE donations ADD COLUMN amount INTEGER DEFAULT 0" },

    // ── dashboard_notifications 복합 인덱스 ──
    { desc: 'idx_dash_notif_recipient', sql: "CREATE INDEX IF NOT EXISTS idx_dash_notif_recipient ON dashboard_notifications(recipient_type, recipient_id, is_read, created_at)" },
    // ── chat_messages is_deleted 포함 복합 인덱스 (is_deleted=0 필터 최적화) ──
    { desc: 'idx_chat_live_deleted', sql: "CREATE INDEX IF NOT EXISTS idx_chat_live_deleted ON chat_messages(live_stream_id, is_deleted, id)" },
    // ── donations 스트림+결제상태+생성일 복합 인덱스 ──
    { desc: 'idx_donations_stream_payment_created', sql: "CREATE INDEX IF NOT EXISTS idx_donations_stream_payment_created ON donations(live_stream_id, payment_status, created_at)" },

    // ── 성능 인덱스 (자주 쿼리되는 컬럼) ──────────────
    // seller_follows: COUNT 쿼리 최적화 (셀러 공개 프로필)
    { desc: 'idx_seller_follows_seller_id', sql: "CREATE INDEX IF NOT EXISTS idx_seller_follows_seller_id ON seller_follows(seller_id)" },
    // donations: live_stream_id + payment_status 복합 조회 최적화
    { desc: 'idx_donations_stream_status', sql: "CREATE INDEX IF NOT EXISTS idx_donations_stream_status ON donations(live_stream_id, payment_status)" },
    // orders: user_id 기준 주문 내역 조회 최적화 (마이페이지)
    { desc: 'idx_orders_user_id', sql: "CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id, created_at DESC)" },
    // orders: seller_id 기준 정산/관리 조회 최적화
    { desc: 'idx_orders_seller_id', sql: "CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id, created_at DESC)" },
    // live_streams: status + updated_at (자동 종료 쿼리 최적화)
    { desc: 'idx_live_streams_status_updated', sql: "CREATE INDEX IF NOT EXISTS idx_live_streams_status_updated ON live_streams(status, updated_at)" },
    // products: seller_id + is_active (셀러 상품 목록 최적화)
    { desc: 'idx_products_seller_active', sql: "CREATE INDEX IF NOT EXISTS idx_products_seller_active ON products(seller_id, is_active)" },
    // user_notifications: user_id + created_at (알림 목록 최적화)
    { desc: 'idx_user_notifications_user', sql: "CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id, created_at DESC)" },
    // 🛡️ 2026-05-16: 광고 슬롯 자동 push EXISTS 서브쿼리용 — 매 streams 호출 시 평가됨
    { desc: 'idx_ad_slots_seller_active', sql: "CREATE INDEX IF NOT EXISTS idx_ad_slots_seller_active ON ad_slots(current_seller_id, is_active, expires_at)" },
    // 🛡️ 2026-05-16: 공구 목록 (지도/리스트) hot query — category + is_active + group_buy_status
    { desc: 'idx_products_voucher_active', sql: "CREATE INDEX IF NOT EXISTS idx_products_voucher_active ON products(category, is_active, group_buy_status)" },
    // 🗺️ 2026-06-18: 매장 행정동(洞) 태깅 — restaurant-geocode cron 이 채움 (하이퍼로컬 "내 동네 딜" 토대).
    //   products 컬럼 예산제 회피 위해 별도 테이블. region_dong_code 인덱스로 동별 집계/조인.
    { desc: 'product_regions table', sql: "CREATE TABLE IF NOT EXISTS product_regions (product_id INTEGER PRIMARY KEY, region_si TEXT, region_gu TEXT, region_dong TEXT, region_dong_code TEXT, lat REAL, lng REAL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)" },
    { desc: 'idx_product_regions_dong_code', sql: "CREATE INDEX IF NOT EXISTS idx_product_regions_dong_code ON product_regions(region_dong_code)" },
    // 🗺️ 2026-06-18: 유저 "내 동네" 태깅 — region.routes 가 채움 (GPS/수동). "내 동네 딜" 필터 기준.
    { desc: 'user_regions table', sql: "CREATE TABLE IF NOT EXISTS user_regions (user_id TEXT PRIMARY KEY, region_si TEXT, region_gu TEXT, region_dong TEXT, region_dong_code TEXT, gu_code TEXT, source TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)" },
    // 🛡️ 2026-05-16: 인플루언서 정산 인프라 (migration 0247)
    { desc: 'sellers.marketing_enabled', sql: "ALTER TABLE sellers ADD COLUMN marketing_enabled INTEGER DEFAULT 1" },
    { desc: 'products.referral_disabled', sql: "ALTER TABLE products ADD COLUMN referral_disabled INTEGER DEFAULT 0" },
    // 🛡️ 2026-05-20: migration 0268 — products → gift_catalog 연결 (categorization JOIN 핵심).
    { desc: 'products.kt_alpha_gift_code', sql: "ALTER TABLE products ADD COLUMN kt_alpha_gift_code TEXT" },
    { desc: 'products.brand_name', sql: "ALTER TABLE products ADD COLUMN brand_name TEXT" },
    { desc: 'products.brand_icon_url', sql: "ALTER TABLE products ADD COLUMN brand_icon_url TEXT" },
    { desc: 'products.auto_voucher_send', sql: "ALTER TABLE products ADD COLUMN auto_voucher_send INTEGER DEFAULT 0" },
    // 🛡️ 2026-05-20: migration 0271 — 상품별 referral on/off + rate override.
    { desc: 'products.referral_enabled', sql: "ALTER TABLE products ADD COLUMN referral_enabled INTEGER DEFAULT 1" },
    { desc: 'products.referral_commission_rate', sql: "ALTER TABLE products ADD COLUMN referral_commission_rate REAL" },
    // 🛡️ 2026-05-20: migration 0272 — sellers.seller_type / can_broadcast (D 공동구매 3자 분배).
    { desc: 'sellers.can_broadcast', sql: "ALTER TABLE sellers ADD COLUMN can_broadcast INTEGER DEFAULT 1" },
    { desc: 'sellers.contact_name', sql: "ALTER TABLE sellers ADD COLUMN contact_name TEXT" },
    // 🛡️ 2026-05-20: 역할 분담 명확화 (사용자 요청).
    //   에이전시 = 업체 입점 영업 (가게 사장님을 발굴/온보딩).
    //   해당 셀러가 어느 에이전시에 의해 입점됐는지 추적 → 에이전시 입점 commission 산정.
    { desc: 'sellers.introduced_by_agency_id', sql: "ALTER TABLE sellers ADD COLUMN introduced_by_agency_id INTEGER" },
    { desc: 'sellers.introduced_at', sql: "ALTER TABLE sellers ADD COLUMN introduced_at DATETIME" },
    { desc: 'sellers.agency_intro_code', sql: "ALTER TABLE sellers ADD COLUMN agency_intro_code TEXT" },
    // 🛡️ 2026-05-21 Phase D-6: 인플루언서 입점 유치 영구 commission lock-in.
    //   인플루언서가 매장 사장님을 플랫폼에 입점시키면 그 매장 매출의 일정 %를 영구 수령.
    //   다른 인플루언서가 후속 홍보해도 별개 — 이건 입점 유치 보상.
    { desc: 'sellers.introduced_by_influencer_id', sql: "ALTER TABLE sellers ADD COLUMN introduced_by_influencer_id INTEGER" },
    { desc: 'sellers.influencer_intro_code', sql: "ALTER TABLE sellers ADD COLUMN influencer_intro_code TEXT" },
    { desc: 'idx_sellers_intro_influencer', sql: "CREATE INDEX IF NOT EXISTS idx_sellers_intro_influencer ON sellers(introduced_by_influencer_id) WHERE introduced_by_influencer_id IS NOT NULL" },
    // 인플루언서가 본인 추천 코드 받음 (가입 시 자동 생성)
    { desc: 'sellers.intro_code', sql: "ALTER TABLE sellers ADD COLUMN intro_code TEXT" },
    // 🛡️ 2026-05-21 정정: 사업소득 (3.3%) default — 기타소득 (8.8%) 은 단발성 협업만.
    { desc: 'sellers.tax_type', sql: "ALTER TABLE sellers ADD COLUMN tax_type TEXT DEFAULT 'business_income'" },
    // 🏭 2026-06-01 유통스타트 도매몰: 판매사(=셀러) 등급 + 특별할인 기간. (docs/design/wholesale-utongstart.md)
    //   distributor_grade: A/B/C/D/OEM (NULL=미배정→기본 D). special_discount_until: 이 시각 전까지 SPECIAL 등급가 적용.
    { desc: 'sellers.distributor_grade', sql: "ALTER TABLE sellers ADD COLUMN distributor_grade TEXT" },
    { desc: 'sellers.special_discount_until', sql: "ALTER TABLE sellers ADD COLUMN special_discount_until DATETIME" },
    // 🏅 2026-06-16 프로 멤버십(연 구독) 만료일 — 구독만 이 컬럼을 씀(만료 시 cron 이 B→C 강등).
    { desc: 'sellers.plus_until', sql: "ALTER TABLE sellers ADD COLUMN plus_until TEXT" },
    // 🏭 2026-06-09 도매몰 가입 — 대표자 연락처 + 담당자(성명/연락처/이메일) 분리 수집. (판매사=sellers, 제조사=suppliers 양쪽)
    { desc: 'sellers.representative_phone', sql: "ALTER TABLE sellers ADD COLUMN representative_phone TEXT" },
    { desc: 'sellers.manager_name', sql: "ALTER TABLE sellers ADD COLUMN manager_name TEXT" },
    { desc: 'sellers.manager_phone', sql: "ALTER TABLE sellers ADD COLUMN manager_phone TEXT" },
    { desc: 'sellers.manager_email', sql: "ALTER TABLE sellers ADD COLUMN manager_email TEXT" },
    { desc: 'suppliers.representative_phone', sql: "ALTER TABLE suppliers ADD COLUMN representative_phone TEXT" },
    { desc: 'suppliers.manager_name', sql: "ALTER TABLE suppliers ADD COLUMN manager_name TEXT" },
    { desc: 'suppliers.manager_phone', sql: "ALTER TABLE suppliers ADD COLUMN manager_phone TEXT" },
    { desc: 'suppliers.manager_email', sql: "ALTER TABLE suppliers ADD COLUMN manager_email TEXT" },
    // 🏭 2026-06-01 유통스타트: 제조사 정산 source 분리(consumer/wholesale) — order_id 충돌 방지.
    { desc: 'supplier_settlements.source', sql: "ALTER TABLE supplier_settlements ADD COLUMN source TEXT DEFAULT 'consumer'" },
    { desc: 'wholesale_orders.refunded_amount', sql: "ALTER TABLE wholesale_orders ADD COLUMN refunded_amount INTEGER NOT NULL DEFAULT 0" },
    // 🚚 2026-06-09 제조사별 배송/주문 정책 — suppliers 3컬럼(0=제한/배송비/무료배송 없음) + 주문 배송비 합계.
    { desc: 'suppliers.min_order_amount', sql: "ALTER TABLE suppliers ADD COLUMN min_order_amount INTEGER DEFAULT 0" },
    { desc: 'suppliers.shipping_fee', sql: "ALTER TABLE suppliers ADD COLUMN shipping_fee INTEGER DEFAULT 0" },
    { desc: 'suppliers.free_ship_threshold', sql: "ALTER TABLE suppliers ADD COLUMN free_ship_threshold INTEGER DEFAULT 0" },
    { desc: 'wholesale_orders.shipping_total', sql: "ALTER TABLE wholesale_orders ADD COLUMN shipping_total INTEGER NOT NULL DEFAULT 0" },
    // 🏦 2026-06-09 예치금 주문 멱등 — 더블클릭/재시도 이중차감 방지(ensureDepositSchema 와 동일, repair 일관성).
    { desc: 'wholesale_orders.idempotency_key', sql: "ALTER TABLE wholesale_orders ADD COLUMN idempotency_key TEXT" },
    { desc: 'idx_wholesale_orders_idem', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesale_orders_idem ON wholesale_orders(distributor_seller_id, idempotency_key) WHERE idempotency_key IS NOT NULL" },
    // 🛡️ 2026-06-09 perf: confirm 의 toss_order_id 조회 + 정산 멱등확인(order_id,source) 풀스캔 방지 (ensureOrderTables 와 동일).
    { desc: 'idx_wholesale_orders_toss', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_orders_toss ON wholesale_orders(toss_order_id)" },
    { desc: 'idx_supplier_settlements_order_source', sql: "CREATE INDEX IF NOT EXISTS idx_supplier_settlements_order_source ON supplier_settlements(order_id, source)" },
    // 🏭 BIZ-2 v1 (2026-06-08) 여신/외상(credit terms): 도매 주문 100% 선결제 모순 해소용 ADDITIVE 외상 경로.
    //   distributor_credit_limit: 0=여신 없음(선결제 전용). outstanding_balance: 미상환 외상(플랫폼 채권). credit_frozen: 1=동결.
    //   원장(wholesale_credit_ledger)은 wholesale.routes ensureCreditSchema 가 CREATE — 여기선 sellers 3컬럼만 보강.
    { desc: 'sellers.distributor_credit_limit', sql: "ALTER TABLE sellers ADD COLUMN distributor_credit_limit INTEGER DEFAULT 0" },
    { desc: 'sellers.outstanding_balance', sql: "ALTER TABLE sellers ADD COLUMN outstanding_balance INTEGER DEFAULT 0" },
    { desc: 'sellers.credit_frozen', sql: "ALTER TABLE sellers ADD COLUMN credit_frozen INTEGER DEFAULT 0" },
    { desc: 'wholesale_credit_ledger', sql: `CREATE TABLE IF NOT EXISTS wholesale_credit_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      distributor_seller_id INTEGER NOT NULL,
      order_id INTEGER,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      balance_after INTEGER NOT NULL DEFAULT 0,
      memo TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { desc: 'idx_wholesale_credit_ledger_seller', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_credit_ledger_seller ON wholesale_credit_ledger(distributor_seller_id, created_at DESC)" },
    // 👥 2026-06-09 판매사 직원 서브계정 — 회사(parent_seller_id) 1계정 아래 직원 로그인.
    //   서브계정 토큰의 seller_id = parent_seller_id → 예치금/주문/카탈로그 byte-identical. role: admin/staff/viewer.
    //   (wholesale.routes ensureSubAccountSchema 가 런타임 CREATE — repair 일관성 위해 동일 정의 보강.)
    { desc: 'wholesale_sub_accounts', sql: `CREATE TABLE IF NOT EXISTS wholesale_sub_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_seller_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'staff',
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now')),
      last_login_at DATETIME
    )` },
    { desc: 'idx_wh_sub_accounts_email', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_wh_sub_accounts_email ON wholesale_sub_accounts(email)" },
    { desc: 'idx_wh_sub_accounts_parent', sql: "CREATE INDEX IF NOT EXISTS idx_wh_sub_accounts_parent ON wholesale_sub_accounts(parent_seller_id)" },
    // 🔐 2026-06-17 단일 세션 강제 (대시보드) — account 별 min_valid_iat. 로그인 시 갱신,
    //   미들웨어가 토큰 iat < min_valid_iat 면 거부. (런타임 ensureDashboardSessionsTable 도 best-effort CREATE.)
    { desc: 'dashboard_sessions', sql: `CREATE TABLE IF NOT EXISTS dashboard_sessions (
      account_type  TEXT    NOT NULL,
      account_id    INTEGER NOT NULL,
      min_valid_iat INTEGER NOT NULL DEFAULT 0,
      updated_at    TEXT,
      user_agent    TEXT,
      ip            TEXT,
      PRIMARY KEY (account_type, account_id)
    )` },
    // 🏦 2026-06-09 예치금(선불 deposit) 결제 — 도매 Toss 대체. (wholesale-deposit-core ensureDepositSchema 가 런타임 CREATE — 여기선 best-effort 보강.)
    //   wholesale_deposits: 판매사별 잔액(seller_id PK). txns: 거래원장. requests: 무통장입금 충전요청(어드민 확인 대상).
    { desc: 'wholesale_deposits', sql: `CREATE TABLE IF NOT EXISTS wholesale_deposits (
      seller_id INTEGER PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    )` },
    { desc: 'wholesale_deposit_txns', sql: `CREATE TABLE IF NOT EXISTS wholesale_deposit_txns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      ref_id TEXT,
      memo TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )` },
    { desc: 'wholesale_deposit_requests', sql: `CREATE TABLE IF NOT EXISTS wholesale_deposit_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      depositor_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_memo TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      confirmed_at TEXT
    )` },
    { desc: 'idx_wholesale_deposit_txns_seller', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_deposit_txns_seller ON wholesale_deposit_txns(seller_id, id DESC)" },
    { desc: 'idx_wholesale_deposit_requests_status', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_deposit_requests_status ON wholesale_deposit_requests(status, id DESC)" },
    // 🏦 2026-06-09 제조사 정산금 출금 신청(어드민 송금확인 대상). (supplier-withdrawal-core ensureWithdrawalSchema 가 런타임 ensure — 여기선 best-effort 보강.)
    //   reserved_amount: 미지급 출금이 잠근 금액(supplier_balances). 실가용 = available_amount - reserved_amount.
    { desc: 'wholesale_settlement_withdrawals', sql: `CREATE TABLE IF NOT EXISTS wholesale_settlement_withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested',
      bank_name TEXT,
      bank_account TEXT,
      account_holder TEXT,
      admin_memo TEXT,
      requested_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT
    )` },
    { desc: 'idx_wholesale_settlement_withdrawals_supplier', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_settlement_withdrawals_supplier ON wholesale_settlement_withdrawals(supplier_id, id DESC)" },
    { desc: 'idx_wholesale_settlement_withdrawals_status', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_settlement_withdrawals_status ON wholesale_settlement_withdrawals(status, id DESC)" },
    { desc: 'supplier_balances.reserved_amount', sql: "ALTER TABLE supplier_balances ADD COLUMN reserved_amount INTEGER NOT NULL DEFAULT 0" },
    // ── 💬 Wave 4a: 판매사↔제조사 채팅 (D1 polling, websocket/DO 없음) ──────────
    { desc: 'wholesale_chat_threads', sql: `CREATE TABLE IF NOT EXISTS wholesale_chat_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      distributor_seller_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      last_message_id INTEGER DEFAULT 0,
      last_message_at TEXT,
      last_preview TEXT,
      distributor_unread INTEGER DEFAULT 0,
      supplier_unread INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(distributor_seller_id, supplier_id)
    )` },
    { desc: 'wholesale_chat_messages', sql: `CREATE TABLE IF NOT EXISTS wholesale_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )` },
    // 🏭 2026-06-10: 도매 통합 게시판(공지/자료실) + 찜리스트 (wholesale-board.routes lazy DDL 과 동일)
    { desc: 'wholesale_board_posts', sql: `CREATE TABLE IF NOT EXISTS wholesale_board_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_type TEXT NOT NULL DEFAULT 'notice',
      mall_id INTEGER DEFAULT 1,
      title TEXT NOT NULL,
      body TEXT,
      product_id INTEGER,
      is_pinned INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    )` },
    { desc: 'idx_wholesale_board_type', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_board_type ON wholesale_board_posts(board_type, is_pinned DESC, id DESC)" },
    { desc: 'wholesale_wishlists', sql: `CREATE TABLE IF NOT EXISTS wholesale_wishlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      mall_id INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(seller_id, product_id)
    )` },
    { desc: 'idx_wholesale_wishlists_seller', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_wishlists_seller ON wholesale_wishlists(seller_id, id DESC)" },
    // 🛡️ 2026-06-11: 환불 보상 CAS 가 갱신하는 updated_at — 컬럼 부재 시 무음 실패(머니버그)
    { desc: 'wholesale_orders.updated_at', sql: "ALTER TABLE wholesale_orders ADD COLUMN updated_at DATETIME" },
    // 🤝 2026-06-10: 광고/제휴 문의 접수함 (partnership.routes lazy DDL 과 동일)
    { desc: 'partnership_inquiries', sql: `CREATE TABLE IF NOT EXISTS partnership_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'partnership',
      company TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      admin_memo TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    )` },
    { desc: 'idx_partnership_inquiries_status', sql: "CREATE INDEX IF NOT EXISTS idx_partnership_inquiries_status ON partnership_inquiries(status, id DESC)" },
    { desc: 'idx_wholesale_chat_threads_dist', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_chat_threads_dist ON wholesale_chat_threads(distributor_seller_id, last_message_at DESC)" },
    { desc: 'idx_wholesale_chat_threads_sup', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_chat_threads_sup ON wholesale_chat_threads(supplier_id, last_message_at DESC)" },
    { desc: 'idx_wholesale_chat_messages_thread', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_chat_messages_thread ON wholesale_chat_messages(thread_id, id)" },
    // 🛡️ 2026-05-21: 에이전시 lock-in 쿼리 성능 — 매장 수만 개 시 풀스캔 방지.
    //   에이전시가 '내가 입점시킨 매장 N개' 조회 / commission 계산 시 사용.
    //   partial index — introduced_by_agency_id IS NOT NULL 인 row 만 (스토리지 절약).
    { desc: 'idx_sellers_intro_agency', sql: "CREATE INDEX IF NOT EXISTS idx_sellers_intro_agency ON sellers(introduced_by_agency_id) WHERE introduced_by_agency_id IS NOT NULL" },
    // 🛡️ 2026-05-21: 지역 기반 검색 — restaurant_address LIKE '%서울%' 100배 느림 회피.
    //   region_si (광역시도) + region_gu (구/군) 정확 매치 INDEX. 가게 등록 시 자동 파싱.
    { desc: 'products.region_si', sql: "ALTER TABLE products ADD COLUMN region_si TEXT" },
    { desc: 'products.region_gu', sql: "ALTER TABLE products ADD COLUMN region_gu TEXT" },
    { desc: 'idx_products_region', sql: "CREATE INDEX IF NOT EXISTS idx_products_region ON products(region_si, region_gu, category) WHERE is_active = 1" },
    // 🛡️ 2026-05-21: 외부 예약 링크 (숙소/뷰티 등 사전 예약 필수 카테고리).
    //   네이버 예약 / 야놀자 / 카카오톡 채널 URL — 자체 캘린더 안 만들고 위임.
    { desc: 'products.external_booking_url', sql: "ALTER TABLE products ADD COLUMN external_booking_url TEXT" },
    // 정렬 / 필터링 성능 — 매장 수만 개 시 sold_count DESC 인덱스 필수.
    { desc: 'idx_products_sourcing', sql: "CREATE INDEX IF NOT EXISTS idx_products_sourcing ON products(is_active, category, sold_count DESC) WHERE is_active = 1" },
    // 🛡️ 2026-05-21: 자체 예약 캘린더 — 뷰티/액티비티 등 sub-1day 예약용.
    //   숙소는 별도 stay_bookings (날짜 기반) 유지. 본 시스템은 시간 슬롯 기반.
    //   매장은 booking_required=1 설정 시 자체 캘린더 활성화. (external_booking_url 과 mutually exclusive)
    { desc: 'products.booking_required', sql: "ALTER TABLE products ADD COLUMN booking_required INTEGER DEFAULT 0" },
    { desc: 'products.booking_duration_min', sql: "ALTER TABLE products ADD COLUMN booking_duration_min INTEGER DEFAULT 60" },
    // 🛡️ 2026-05-21 Phase B-2: reminder + refund 추적 (중복 발송 / 중복 환불 방지).
    { desc: 'appointment_bookings.reminder_sent_at', sql: "ALTER TABLE appointment_bookings ADD COLUMN reminder_sent_at TEXT" },
    { desc: 'appointment_bookings.refund_processed_at', sql: "ALTER TABLE appointment_bookings ADD COLUMN refund_processed_at TEXT" },
    { desc: 'appointment_bookings.refund_status', sql: "ALTER TABLE appointment_bookings ADD COLUMN refund_status TEXT" },
    // 🛡️ 2026-05-21 Phase E-3: 노쇼 자동 알림 중복 발송 방지.
    { desc: 'appointment_bookings.noshow_alert_sent_at', sql: "ALTER TABLE appointment_bookings ADD COLUMN noshow_alert_sent_at TEXT" },
    // 🛡️ 2026-06-12 (전수조사 4차 B-6): 숙소 D-1/D-day reminder dedup ('0 9'+'0 0' 이중 트리거 중복 발송 방지).
    { desc: 'stay_bookings.reminder_d1_sent_at', sql: "ALTER TABLE stay_bookings ADD COLUMN reminder_d1_sent_at TEXT" },
    { desc: 'stay_bookings.reminder_dday_sent_at', sql: "ALTER TABLE stay_bookings ADD COLUMN reminder_dday_sent_at TEXT" },
    // 🛡️ 2026-05-21 Phase C: 통합 정산 시스템 — payouts (실제 송금 기록).
    //   ledger_entries 는 이미 존재 (worker/utils/ledger.ts). payouts 는 실제 송금 audit trail.
    //   주체별 (seller/agency/store_owner/user) 송금 사이클 + 토스/은행 transaction_id 추적.
    { desc: 'orders.escrow_status', sql: "ALTER TABLE orders ADD COLUMN escrow_status TEXT DEFAULT 'held'" },
    // 에이전시 본인의 추천 코드 (가게에게 알려줘 가입 시 입력받음).
    { desc: 'agencies.intro_code', sql: "ALTER TABLE agencies ADD COLUMN intro_code TEXT" },
    { desc: 'agencies.store_intro_commission_pct', sql: "ALTER TABLE agencies ADD COLUMN store_intro_commission_pct REAL DEFAULT 2.0" },
    // 🛡️ 2026-05-21: 리뷰 대량 생성 (admin-review-generator) 가 INSERT 하는 컬럼.
    //   기존 0132 schema 에 user_name / selected_option / is_generated 없음 → 사용자 신고 "생성 실패".
    //   영구 fix: daily cron 이 ensure → endpoint 자체 ALTER 의존성 제거.
    { desc: 'product_reviews.user_name', sql: "ALTER TABLE product_reviews ADD COLUMN user_name TEXT" },
    { desc: 'product_reviews.selected_option', sql: "ALTER TABLE product_reviews ADD COLUMN selected_option TEXT" },
    { desc: 'product_reviews.is_generated', sql: "ALTER TABLE product_reviews ADD COLUMN is_generated INTEGER DEFAULT 0" },
    // 🛡️ 2026-05-24: /api/vouchers/my SELECT 가 참조하는 컬럼 — 미존재 시 첫 SELECT crash → fallback 만 동작 (applied_price 누락).
    //   영구 fix: repair-schema 에 등록 → 매일 18 UTC cron 이 자동 ADD COLUMN (멱등).
    //   gift_* 컬럼은 선물하기 기능 (voucher 양도) 용. refund_status 는 환불 추적용.
    { desc: 'vouchers.refund_status', sql: "ALTER TABLE vouchers ADD COLUMN refund_status TEXT" },
    { desc: 'vouchers.gift_from_user_id', sql: "ALTER TABLE vouchers ADD COLUMN gift_from_user_id TEXT" },
    { desc: 'vouchers.delivered_gift_name', sql: "ALTER TABLE vouchers ADD COLUMN delivered_gift_name TEXT" },
    { desc: 'vouchers.applied_discount_pct', sql: "ALTER TABLE vouchers ADD COLUMN applied_discount_pct INTEGER DEFAULT 0" },
    { desc: 'vouchers.applied_price', sql: "ALTER TABLE vouchers ADD COLUMN applied_price INTEGER" },
    { desc: 'table influencer_balances', sql: "CREATE TABLE IF NOT EXISTS influencer_balances (influencer_id TEXT PRIMARY KEY, pending_amount INTEGER DEFAULT 0, available_amount INTEGER DEFAULT 0, total_paid_out INTEGER DEFAULT 0, business_number TEXT, tax_type TEXT DEFAULT 'other_income', bank_name TEXT, bank_account TEXT, account_holder TEXT, created_at DATETIME DEFAULT (datetime('now')), updated_at DATETIME DEFAULT (datetime('now')))" },
    { desc: 'table influencer_attributions', sql: "CREATE TABLE IF NOT EXISTS influencer_attributions (id INTEGER PRIMARY KEY AUTOINCREMENT, influencer_id TEXT NOT NULL, order_id INTEGER, voucher_id INTEGER, product_id INTEGER, seller_id INTEGER, commission_amount INTEGER NOT NULL, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT (datetime('now')), available_at DATETIME, paid_at DATETIME, clawback_reason TEXT)" },
    { desc: 'idx_inf_attr_influencer', sql: "CREATE INDEX IF NOT EXISTS idx_inf_attr_influencer ON influencer_attributions(influencer_id, status)" },
    { desc: 'idx_inf_attr_pending_avail', sql: "CREATE INDEX IF NOT EXISTS idx_inf_attr_pending_avail ON influencer_attributions(status, available_at)" },
    { desc: 'table seller_blocked_influencers', sql: "CREATE TABLE IF NOT EXISTS seller_blocked_influencers (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, influencer_id TEXT NOT NULL, reason TEXT, blocked_at DATETIME DEFAULT (datetime('now')), unblocked_at DATETIME, UNIQUE(seller_id, influencer_id))" },
    { desc: 'idx_seller_blocked_inf_seller', sql: "CREATE INDEX IF NOT EXISTS idx_seller_blocked_inf_seller ON seller_blocked_influencers(seller_id, unblocked_at)" },
    // platform_settings default rows (INSERT OR IGNORE — 이미 있으면 skip)
    { desc: 'seed: platform_margin_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('platform_margin_pct', '5', '유어딜 운영 마진 (%)', datetime('now'))" },
    { desc: 'seed: influencer_commission_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('influencer_commission_pct', '0.5', '인플루언서 referral commission (%)', datetime('now'))" },
    { desc: 'seed: user_referral_bonus_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('user_referral_bonus_pct', '0.5', '사용자 referral 보너스 (%)', datetime('now'))" },
    { desc: 'seed: agency_commission_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('agency_commission_pct', '2', '에이전시 commission (%)', datetime('now'))" },
    { desc: 'seed: refund_window_days', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('refund_window_days', '7', '매장 송금 전 환불 가능 기간 (일)', datetime('now'))" },
    { desc: 'seed: influencer_payout_min', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('influencer_payout_min', '100000', '인플루언서 월 최소 송금액 (원)', datetime('now'))" },
    // 🛡️ 2026-05-16: 정산일자 조절 + 인플 송금방식 (migration 0248)
    { desc: 'influencer_balances.payout_method', sql: "ALTER TABLE influencer_balances ADD COLUMN payout_method TEXT DEFAULT 'cash'" },
    { desc: 'sellers.settlement_frequency', sql: "ALTER TABLE sellers ADD COLUMN settlement_frequency TEXT DEFAULT 'on_use_plus_7'" },
    { desc: 'sellers.settlement_day', sql: "ALTER TABLE sellers ADD COLUMN settlement_day INTEGER DEFAULT 1" },
    { desc: 'seed: influencer_payout_frequency', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('influencer_payout_frequency', 'monthly', '인플 송금 주기', datetime('now'))" },
    { desc: 'seed: influencer_payout_day_of_month', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('influencer_payout_day_of_month', '1', '월간 송금 날짜', datetime('now'))" },
    { desc: 'seed: influencer_deal_bonus_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('influencer_deal_bonus_pct', '20', '딜 선택 시 보너스 %', datetime('now'))" },
    { desc: 'seed: wholesale_deposit_account', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('wholesale_deposit_account', '우체국 014084-02-129530 송유미 (사람과고리)', '도매몰 예치금 무통장입금 안내 계좌', datetime('now'))" },
    { desc: 'table influencer_disputes', sql: "CREATE TABLE IF NOT EXISTS influencer_disputes (id INTEGER PRIMARY KEY AUTOINCREMENT, influencer_id TEXT NOT NULL, seller_id INTEGER, type TEXT NOT NULL, description TEXT NOT NULL, status TEXT DEFAULT 'open', resolution TEXT, created_at DATETIME DEFAULT (datetime('now')), resolved_at DATETIME)" },
    { desc: 'idx_inf_disputes_status', sql: "CREATE INDEX IF NOT EXISTS idx_inf_disputes_status ON influencer_disputes(status, created_at)" },
    // 🛡️ 2026-05-16: 매장 영입 referral + 협업 제안 (migration 0249)
    { desc: 'sellers.referred_by_influencer', sql: "ALTER TABLE sellers ADD COLUMN referred_by_influencer TEXT" },
    { desc: 'sellers.referral_bonus_until', sql: "ALTER TABLE sellers ADD COLUMN referral_bonus_until DATETIME" },
    { desc: 'table seller_influencer_deals', sql: "CREATE TABLE IF NOT EXISTS seller_influencer_deals (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, influencer_id TEXT NOT NULL, commission_pct REAL NOT NULL, starts_at DATETIME DEFAULT (datetime('now')), ends_at DATETIME, status TEXT DEFAULT 'proposed', proposed_by TEXT NOT NULL, message TEXT, created_at DATETIME DEFAULT (datetime('now')), responded_at DATETIME, UNIQUE(seller_id, influencer_id))" },
    { desc: 'idx_seller_inf_deals_seller', sql: "CREATE INDEX IF NOT EXISTS idx_seller_inf_deals_seller ON seller_influencer_deals(seller_id, status)" },
    { desc: 'idx_seller_inf_deals_inf', sql: "CREATE INDEX IF NOT EXISTS idx_seller_inf_deals_inf ON seller_influencer_deals(influencer_id, status)" },
    { desc: 'seed: seller_referral_bonus_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('seller_referral_bonus_pct', '1', '인플 매장 영입 추가 commission %', datetime('now'))" },
    { desc: 'seed: seller_referral_bonus_months', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('seller_referral_bonus_months', '6', '영입 보너스 기간 (개월)', datetime('now'))" },
    { desc: 'seed: max_influencer_commission_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('max_influencer_commission_pct', '2', '인플 commission 최대 cap %', datetime('now'))" },
    // 🛡️ 2026-05-16: 카카오맵 후기 보너스 (migration 0250)
    { desc: 'table kakao_review_submissions', sql: "CREATE TABLE IF NOT EXISTS kakao_review_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, voucher_id INTEGER NOT NULL, user_id TEXT NOT NULL, product_id INTEGER, seller_id INTEGER, review_url TEXT NOT NULL, bonus_amount INTEGER DEFAULT 0, status TEXT DEFAULT 'submitted', admin_notes TEXT, created_at DATETIME DEFAULT (datetime('now')), reviewed_at DATETIME, paid_at DATETIME, UNIQUE(voucher_id))" },
    { desc: 'idx_kakao_review_status', sql: "CREATE INDEX IF NOT EXISTS idx_kakao_review_status ON kakao_review_submissions(status, created_at)" },
    { desc: 'idx_kakao_review_seller', sql: "CREATE INDEX IF NOT EXISTS idx_kakao_review_seller ON kakao_review_submissions(seller_id, status)" },
    { desc: 'seed: kakao_review_bonus_amount', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('kakao_review_bonus_amount', '1000', '카카오맵 후기 보너스 (딜)', datetime('now'))" },
    { desc: 'seed: kakao_review_auto_approve', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('kakao_review_auto_approve', '0', '0=수동 검증 / 1=자동 승인', datetime('now'))" },
    // 🛡️ 2026-05-23: Frontend 에러 telemetry — POST /api/_errors/log 가 INSERT.
    { desc: 'table frontend_errors', sql: "CREATE TABLE IF NOT EXISTS frontend_errors (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL, stack TEXT, url TEXT, type TEXT, user_id TEXT, user_agent TEXT, ip TEXT, created_at DATETIME DEFAULT (datetime('now')))" },
    { desc: 'idx_frontend_errors_created', sql: "CREATE INDEX IF NOT EXISTS idx_frontend_errors_created ON frontend_errors(created_at DESC)" },
    { desc: 'idx_frontend_errors_type', sql: "CREATE INDEX IF NOT EXISTS idx_frontend_errors_type ON frontend_errors(type, created_at DESC)" },
    // 🛡️ 2026-05-23: Request tracing — 1% 샘플링 + 500 무조건 저장 (재현 곤란 영구 제거)
    { desc: 'table request_traces', sql: "CREATE TABLE IF NOT EXISTS request_traces (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL, duration_ms INTEGER, body TEXT, user_agent TEXT, ip TEXT, created_at DATETIME DEFAULT (datetime('now')))" },
    { desc: 'idx_request_traces_status', sql: "CREATE INDEX IF NOT EXISTS idx_request_traces_status ON request_traces(status, created_at DESC)" },
    { desc: 'idx_request_traces_name', sql: "CREATE INDEX IF NOT EXISTS idx_request_traces_name ON request_traces(name, created_at DESC)" },
    // 🛡️ 2026-05-16: 인플 ranking 공개 여부 (default 1 = 공개)
    { desc: 'influencer_balances.ranking_public', sql: "ALTER TABLE influencer_balances ADD COLUMN ranking_public INTEGER DEFAULT 1" },
    // 🛡️ 2026-05-16: sellers 신규 컬럼 보강 — production /api/sellers/:id/public 500 fix
    { desc: 'sellers.banner_url', sql: "ALTER TABLE sellers ADD COLUMN banner_url TEXT" },
    { desc: 'sellers.brand_color', sql: "ALTER TABLE sellers ADD COLUMN brand_color TEXT" },
    { desc: 'sellers.external_live_tiktok', sql: "ALTER TABLE sellers ADD COLUMN external_live_tiktok TEXT" },
    { desc: 'sellers.external_live_instagram', sql: "ALTER TABLE sellers ADD COLUMN external_live_instagram TEXT" },
    { desc: 'sellers.external_live_facebook', sql: "ALTER TABLE sellers ADD COLUMN external_live_facebook TEXT" },
    // 🛡️ 2026-05-27 (사용자 결정): 공구 상세에 셀러 SNS 버튼 노출 — 채팅/매너온도 X.
    //   기존 4개 (sns_instagram/youtube/facebook/twitter) 외 sns_tiktok 추가.
    { desc: 'sellers.sns_tiktok', sql: "ALTER TABLE sellers ADD COLUMN sns_tiktok TEXT" },
    // 🛡️ 2026-05-27 (큐레이터 banner 편집): users.banner_url — 큐레이터 공개 페이지 배경.
    { desc: 'users.banner_url', sql: "ALTER TABLE users ADD COLUMN banner_url TEXT" },
    // 🎨 2026-06-16 (링크샵 시안): 크리에이터 SNS 링크 (유튜브/인스타/틱톡).
    { desc: 'users.youtube_url', sql: "ALTER TABLE users ADD COLUMN youtube_url TEXT" },
    { desc: 'users.instagram_url', sql: "ALTER TABLE users ADD COLUMN instagram_url TEXT" },
    { desc: 'users.tiktok_url', sql: "ALTER TABLE users ADD COLUMN tiktok_url TEXT" },
    { desc: 'users.linkshop_headline', sql: "ALTER TABLE users ADD COLUMN linkshop_headline TEXT" },
    { desc: 'users.linkshop_accent', sql: "ALTER TABLE users ADD COLUMN linkshop_accent TEXT" },
    // 🛡️ 2026-05-27 (리뷰 집계 영구 fix — 사용자 보고):
    //   product_reviews INSERT 경로 7곳 (사용자/시드/admin) 마다 products UPDATE 누락 위험.
    //   D1 트리거로 모든 INSERT/UPDATE/DELETE 자동 처리 → review_count + avg_rating 영구 동기화.
    //   효과: BrowsePage/VouchersPage 카드 별점 즉시 반영 (상세 페이지 리뷰와 정합).
    // 🛡️ 2026-05-27 v2 (영구 + 사용자 요청): sold_count >= review_count × 3 도 자동 보장.
    //   모든 INSERT 경로 (사용자 / admin / fake seed) 트리거 단일 SSOT → sold_count 자동 정정.
    //   DROP 후 CREATE — 기존 v1 트리거 (sold_count 누락) 가 있으면 교체.
    { desc: 'drop legacy trigger: product_reviews_aggregate_insert', sql:
      "DROP TRIGGER IF EXISTS trg_product_reviews_aggregate_insert" },
    { desc: 'trigger: product_reviews_aggregate_insert v2', sql: `
      CREATE TRIGGER IF NOT EXISTS trg_product_reviews_aggregate_insert
      AFTER INSERT ON product_reviews
      BEGIN
        UPDATE products SET
          review_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = NEW.product_id),
          avg_rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM product_reviews WHERE product_id = NEW.product_id), 0),
          sold_count = MAX(
            COALESCE(sold_count, 0),
            (SELECT COUNT(*) FROM product_reviews WHERE product_id = NEW.product_id) * 3
          ),
          updated_at = datetime('now')
        WHERE id = NEW.product_id;
      END
    ` },
    { desc: 'trigger: product_reviews_aggregate_update', sql: `
      CREATE TRIGGER IF NOT EXISTS trg_product_reviews_aggregate_update
      AFTER UPDATE OF rating ON product_reviews
      BEGIN
        UPDATE products SET
          avg_rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM product_reviews WHERE product_id = NEW.product_id), 0),
          updated_at = datetime('now')
        WHERE id = NEW.product_id;
      END
    ` },
    { desc: 'trigger: product_reviews_aggregate_delete', sql: `
      CREATE TRIGGER IF NOT EXISTS trg_product_reviews_aggregate_delete
      AFTER DELETE ON product_reviews
      BEGIN
        UPDATE products SET
          review_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = OLD.product_id),
          avg_rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM product_reviews WHERE product_id = OLD.product_id), 0),
          updated_at = datetime('now')
        WHERE id = OLD.product_id;
      END
    ` },
    // 🛡️ backfill — 트리거 적용 이전에 INSERT 된 reviews 일괄 정합화.
    //   idempotent — 매번 실행해도 같은 결과. schema-repair daily cron 으로 안전 반복.
    // 🛡️ 2026-06-10 (D1 CPU 한도 초과 fix): 기존 버전은 '전 상품 × 상관 서브쿼리 4개' 풀스캔이라
    //   상품/리뷰가 늘며 'D1 DB exceeded its CPU time limit' 로 죽었음. product_reviews 를 GROUP BY 로
    //   1패스 집계해 count 가 어긋난 상품만 배치(1000행)로 보정 — 멱등, 반복 실행(버튼/일일 cron)으로 수렴.
    //   (트리거 v2 가 신규 리뷰는 실시간 유지 — 이 백필은 레거시 드리프트 전용.)
    { desc: 'backfill: products review aggregate from product_reviews', sql: `
      UPDATE products SET
        review_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = products.id),
        avg_rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM product_reviews WHERE product_id = products.id), 0)
      WHERE id IN (
        SELECT pr.product_id FROM product_reviews pr
        GROUP BY pr.product_id
        HAVING COUNT(*) != COALESCE((SELECT review_count FROM products px WHERE px.id = pr.product_id), 0)
        LIMIT 1000
      )
    ` },
    // 🛡️ 2026-05-27 (사용자 요청): sold_count >= review_count × 3 보장.
    //   기존 데이터에 review_count > sold_count 인 상품 발견 시 sold_count 자동 보정.
    //   idempotent — daily cron 으로 안전 반복.
    { desc: 'backfill: products.sold_count ≥ review_count × 3', sql: `
      UPDATE products SET
        sold_count = COALESCE(review_count, 0) * 3
      WHERE COALESCE(review_count, 0) > 0
        AND COALESCE(sold_count, 0) < COALESCE(review_count, 0) * 3
    ` },
    { desc: 'sellers.kakao_chat_url', sql: "ALTER TABLE sellers ADD COLUMN kakao_chat_url TEXT" },
    { desc: 'sellers.representative_name', sql: "ALTER TABLE sellers ADD COLUMN representative_name TEXT" },
    // 🛡️ 2026-05-27 (사용자 결정): 국세청 사업자등록정보 진위확인 + 자동 승인 — 개업일/검증 결과 컬럼.
    { desc: 'sellers.business_start_date', sql: "ALTER TABLE sellers ADD COLUMN business_start_date TEXT" },
    { desc: 'sellers.nts_verified_at', sql: "ALTER TABLE sellers ADD COLUMN nts_verified_at DATETIME" },
    { desc: 'sellers.nts_verify_result', sql: "ALTER TABLE sellers ADD COLUMN nts_verify_result TEXT" },
    // 🛡️ 2026-05-27 (영업 검증 Layer 2 — 사용자 결정): 사장님 사전 등록 (prospects).
    //   영업자 (agency/influencer) 가 매장 영입 전에 사장님 정보 등록 → 사장님 가입 시 자동 매칭 + commission lock-in.
    //   부정 방지: prospects.status='converted' 시 영업 commission 활성 (첫 매출 발생 시 — Layer 4).
    { desc: 'table seller_prospects', sql: `
      CREATE TABLE IF NOT EXISTS seller_prospects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        introducer_type TEXT NOT NULL,
        introducer_id TEXT NOT NULL,
        store_name TEXT,
        contact_name TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        business_address TEXT,
        notes TEXT,
        proof_image_url TEXT,
        status TEXT NOT NULL DEFAULT 'visiting',
        converted_seller_id INTEGER,
        first_sale_at DATETIME,
        commission_locked_at DATETIME,
        expires_at DATETIME,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      )
    ` },
    { desc: 'idx_seller_prospects_introducer', sql:
      "CREATE INDEX IF NOT EXISTS idx_seller_prospects_introducer ON seller_prospects(introducer_type, introducer_id, status)" },
    { desc: 'idx_seller_prospects_phone', sql:
      "CREATE INDEX IF NOT EXISTS idx_seller_prospects_phone ON seller_prospects(contact_phone) WHERE status = 'visiting'" },
    { desc: 'idx_seller_prospects_email', sql:
      "CREATE INDEX IF NOT EXISTS idx_seller_prospects_email ON seller_prospects(contact_email) WHERE status = 'visiting'" },
    // 🛡️ 2026-05-27 Step G: D-3 만료 임박 알림 dedup (1일 1회 발송)
    { desc: 'seller_prospects.last_expiry_notified_at', sql: "ALTER TABLE seller_prospects ADD COLUMN last_expiry_notified_at DATETIME" },
    { desc: 'sellers.first_voucher_notified', sql: "ALTER TABLE sellers ADD COLUMN first_voucher_notified INTEGER DEFAULT 0" },
    { desc: 'influencer_balances.payout_method', sql: "ALTER TABLE influencer_balances ADD COLUMN payout_method TEXT DEFAULT 'cash'" },
    // 🛡️ 2026-05-22: migrations 0276 (공구 피드 perf index) 자동 적용.
    //   partial composite index — category + group_buy_status + ORDER BY created_at 한 번에 cover.
    //   IF NOT EXISTS 라 멱등. wrangler d1 execute 수동 적용 없이 daily cron 으로 자동 반영.
    { desc: 'idx_products_groupbuy_feed', sql: "CREATE INDEX IF NOT EXISTS idx_products_groupbuy_feed ON products (category, group_buy_status, created_at DESC) WHERE is_active = 1" },
    // 🛡️ 2026-05-22 카카오 P0: 셀러-카카오 1:1 매핑 DB-level uniqueness (race condition 방어).
    //   application-level 체크만으로는 동시 link 시 같은 user_id 에 2개 seller 연동 가능.
    { desc: 'idx_sellers_linked_user_unique', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_linked_user_unique ON sellers(linked_user_id) WHERE linked_user_id IS NOT NULL" },
    // 🛡️ 2026-05-27 (영구 fix): same-email seller auto-link backfill.
    //   문제: 시드 데이터의 sellers.linked_user_id 가 NULL → 카카오 user 로그인 시 curator dashboard
    //         가 linked_seller 못 찾음 → BottomNav 가 /host/new fall through (사용자 보고).
    //   해결: email 매칭되는 seller-user 쌍 일괄 매핑. idempotent.
    //   KakaoAuthService.upsertUser 도 동적으로 매핑 → 다음 로그인 시 자동, 이건 일괄 backfill.
    // 🏭 2026-06-05 [UNLOCK] (사용자 승인 — 정지원/디스크프리 계정 중첩 근본수정): 결정적 + 1:1 매칭만.
    //   기존 LIMIT 1(ORDER BY 없음)은 같은 email 의 user 가 둘 이상이면 어느 user 에 붙을지 비결정적 →
    //   셀러를 엉뚱한 user 에 연결(링크샵이 옛 계정으로). 이제 email 이 정확히 1명일 때만(COUNT=1) 연결.
    { desc: 'backfill: sellers.linked_user_id (same-email, 1:1 only)', sql: `UPDATE sellers SET linked_user_id = (SELECT id FROM users u WHERE u.email = sellers.email ORDER BY u.id LIMIT 1), updated_at = datetime('now') WHERE (linked_user_id IS NULL OR linked_user_id = 0) AND email IS NOT NULL AND email != '' AND (SELECT COUNT(*) FROM users u2 WHERE u2.email = sellers.email) = 1` },
    // 🏭 2026-06-05 [UNLOCK]: users.email partial UNIQUE — 두 카카오 계정이 같은 email 로 분리 생성되는 것 차단.
    //   best-effort: 기존 중복 email 이 있으면 생성 실패(아래 catch) → 중복 정리 후 재실행 시 적용.
    { desc: 'idx_users_email_unique', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL AND email != ''" },
    // 🛡️ 2026-05-28: 영입 커미션 무기한(NULL) 일몰제 강제 — 레거시 영입 매장에 +12개월 캡 (LTV 보호).
    //   introduced_at 기준 (없으면 created_at). 이미 referral_bonus_until 설정된 매장은 불변.
    { desc: 'backfill: sellers.referral_bonus_until cap (introduced, NULL→+12mo)', sql: `UPDATE sellers SET referral_bonus_until = datetime(COALESCE(introduced_at, created_at, datetime('now')), '+12 months'), updated_at = datetime('now') WHERE referral_bonus_until IS NULL AND (introduced_by_agency_id IS NOT NULL OR introduced_by_influencer_id IS NOT NULL)` },
    // 🛡️ 2026-05-22 카카오 P0: kakao_id UNIQUE 보강 (이미 KakaoAuthService 에서 시도하지만 다중 진입점 안전).
    { desc: 'idx_users_kakao_id_unique', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kakao_id_unique ON users(kakao_id) WHERE kakao_id IS NOT NULL" },
    // 🛡️ 2026-05-22 P1: 교환권 페이지 로딩 perf — 사용자별 voucher 목록 조회.
    //   /api/vouchers/my 가 WHERE user_id = ? ORDER BY created_at DESC 매번 실행 →
    //   인덱스 없으면 vouchers 전체 scan. 사용자 N명 × voucher M개 = N*M row scan.
    { desc: 'idx_vouchers_user_created', sql: "CREATE INDEX IF NOT EXISTS idx_vouchers_user_created ON vouchers(user_id, created_at DESC)" },
    // 🛡️ 2026-05-22 P0: orders.commission_rate snapshot 컬럼 ensure — commission 변경 소급 적용 영구 방지.
    //   order.repository.ts createOrder 가 이 컬럼에 seller 의 현재 commission_rate 캡처.
    //   settlement-automation.ts 가 COALESCE(o.commission_rate, seller.rate) 로 우선 사용.
    //   production 에 컬럼 부재 환경 안전 — 본 ALTER 가 ensure.
    { desc: 'orders.commission_rate', sql: "ALTER TABLE orders ADD COLUMN commission_rate REAL DEFAULT 10.00" },
    { desc: 'orders.commission_amount', sql: "ALTER TABLE orders ADD COLUMN commission_amount INTEGER DEFAULT 0" },
    { desc: 'orders.seller_amount', sql: "ALTER TABLE orders ADD COLUMN seller_amount INTEGER DEFAULT 0" },
    // 🛡️ 2026-05-23: SQL column mismatch 23건 일괄 fix — production-schema 정합.
    //   - products.long_description: 어드민 상품 상세 마크다운 설명.
    //   - products.compare_at_price: 할인 전 가격 (정가) — Cafe24 sync / 어드민 상품 등록 시 사용.
    { desc: 'products.long_description', sql: "ALTER TABLE products ADD COLUMN long_description TEXT" },
    { desc: 'products.compare_at_price', sql: "ALTER TABLE products ADD COLUMN compare_at_price INTEGER" },
    //   - products.dominant_color: 카드 이미지 placeholder hex 색 (클라이언트 canvas 1x1 lazy 백필).
    { desc: 'products.dominant_color', sql: "ALTER TABLE products ADD COLUMN dominant_color TEXT" },
    //   - 디지털 상품 (migration 0243) — 무재고 디지털/정보 상품 + 디지털 보관함 (/my/digital 500 fix).
    { desc: 'products.product_kind', sql: "ALTER TABLE products ADD COLUMN product_kind TEXT DEFAULT 'physical'" },
    { desc: 'products.delivery_type', sql: "ALTER TABLE products ADD COLUMN delivery_type TEXT DEFAULT 'shipping'" },
    { desc: 'products.content_url', sql: "ALTER TABLE products ADD COLUMN content_url TEXT" },
    { desc: 'products.content_format', sql: "ALTER TABLE products ADD COLUMN content_format TEXT" },
    { desc: 'products.access_duration_days', sql: "ALTER TABLE products ADD COLUMN access_duration_days INTEGER" },
    { desc: 'products.preview_url', sql: "ALTER TABLE products ADD COLUMN preview_url TEXT" },
    { desc: 'products.file_size_mb', sql: "ALTER TABLE products ADD COLUMN file_size_mb INTEGER" },
    { desc: 'orders.delivery_kind', sql: "ALTER TABLE orders ADD COLUMN delivery_kind TEXT DEFAULT 'shipping'" },
    //   - donation_settlements.donation_ids: settlement 에 포함된 donation id 들 JSON 배열.
    { desc: 'donation_settlements.donation_ids', sql: "ALTER TABLE donation_settlements ADD COLUMN donation_ids TEXT" },
    //   - user_points.total_used: 총 사용 누적 (충전 vs 사용 추적).
    { desc: 'user_points.total_used', sql: "ALTER TABLE user_points ADD COLUMN total_used INTEGER DEFAULT 0" },
    //   - settlements: 셀러 정산 신청 / 자동 정산 보고서 양쪽 모두 settlements 테이블 사용.
    //     amount / bank_name / account_number / account_holder = 셀러 정산 신청 지급 정보.
    //     total_sales / total_platform_fee / total_settlement / generated_at = 자동 정산 보고서 집계 컬럼.
    { desc: 'settlements.amount', sql: "ALTER TABLE settlements ADD COLUMN amount INTEGER" },
    { desc: 'settlements.bank_name', sql: "ALTER TABLE settlements ADD COLUMN bank_name TEXT" },
    { desc: 'settlements.account_number', sql: "ALTER TABLE settlements ADD COLUMN account_number TEXT" },
    { desc: 'settlements.account_holder', sql: "ALTER TABLE settlements ADD COLUMN account_holder TEXT" },
    { desc: 'settlements.total_sales', sql: "ALTER TABLE settlements ADD COLUMN total_sales INTEGER DEFAULT 0" },
    { desc: 'settlements.total_platform_fee', sql: "ALTER TABLE settlements ADD COLUMN total_platform_fee INTEGER DEFAULT 0" },
    { desc: 'settlements.total_settlement', sql: "ALTER TABLE settlements ADD COLUMN total_settlement INTEGER DEFAULT 0" },
    { desc: 'settlements.generated_at', sql: "ALTER TABLE settlements ADD COLUMN generated_at DATETIME" },
    // 🛡️ 2026-05-31 도매몰 INC-2: 공급(B2B) 컬럼 — 마이그레이션 미적용 환경 보장(additive/idempotent).
    { desc: 'products.is_supply_product', sql: "ALTER TABLE products ADD COLUMN is_supply_product INTEGER DEFAULT 0" },
    { desc: 'products.supply_price', sql: "ALTER TABLE products ADD COLUMN supply_price INTEGER DEFAULT 0" },
    { desc: 'products.supply_source_id', sql: "ALTER TABLE products ADD COLUMN supply_source_id INTEGER" },
    { desc: 'products.supplier_id', sql: "ALTER TABLE products ADD COLUMN supplier_id INTEGER" },
    // 🛡️ 2026-06-01 도매몰 INC-4: 공급자 self-serve 카탈로그 등록 승인 게이트.
    //   supplier_id 가 있는(공급자 직접 등록) 상품의 승인 상태. 어드민 승인 전 is_active=0 로 카탈로그 비노출.
    //   admin 대행 등록 상품은 NULL(=기존처럼 즉시 노출).
    { desc: 'products.supply_approval_status', sql: "ALTER TABLE products ADD COLUMN supply_approval_status TEXT" },
    // 어드민 승인/거부 사유 메모 (공급자 등록 상품 거부 시 사유 전달).
    { desc: 'products.admin_memo', sql: "ALTER TABLE products ADD COLUMN admin_memo TEXT" },
    // 🏭 2026-06-07 온라인 최저가 검수 + 공급가 변경 승인 워크플로 (사용자 요청).
    //   업로드 시 제조사가 최저가 참고 링크 제출 → 어드민 검수(lowest_price_checked).
    //   판매중 상품 가격 수정은 pending_* 적재 후 어드민 승인 시에만 라이브 반영.
    { desc: 'products.lowest_price_url', sql: "ALTER TABLE products ADD COLUMN lowest_price_url TEXT" },
    { desc: 'products.lowest_price_checked', sql: "ALTER TABLE products ADD COLUMN lowest_price_checked INTEGER DEFAULT 0" },
    { desc: 'products.pending_supply_price', sql: "ALTER TABLE products ADD COLUMN pending_supply_price INTEGER" },
    { desc: 'products.pending_retail_price', sql: "ALTER TABLE products ADD COLUMN pending_retail_price INTEGER" },
    { desc: 'products.pending_price_url', sql: "ALTER TABLE products ADD COLUMN pending_price_url TEXT" },
    { desc: 'products.pending_price_reason', sql: "ALTER TABLE products ADD COLUMN pending_price_reason TEXT" },
    { desc: 'products.pending_price_requested_at', sql: "ALTER TABLE products ADD COLUMN pending_price_requested_at TEXT" },

    // 🛡️ 2026-06-01 [migration 0257 port] 사업자 등록 게이팅 정산 — 프로덕션 미적용 시
    //   seller-settlements.routes.ts:90 게이트가 OFF(현금정산 무제한) 되는 위험 차단. additive/idempotent.
    { desc: 'sellers.business_registration_status', sql: "ALTER TABLE sellers ADD COLUMN business_registration_status TEXT DEFAULT 'pending'" },
    { desc: 'sellers.business_registration_image_url', sql: "ALTER TABLE sellers ADD COLUMN business_registration_image_url TEXT" },
    { desc: 'sellers.business_registration_verified_at', sql: "ALTER TABLE sellers ADD COLUMN business_registration_verified_at DATETIME" },
    { desc: 'sellers.business_registration_verified_by', sql: "ALTER TABLE sellers ADD COLUMN business_registration_verified_by INTEGER" },
    { desc: 'sellers.business_registration_reject_reason', sql: "ALTER TABLE sellers ADD COLUMN business_registration_reject_reason TEXT" },
    { desc: 'sellers.preferred_settlement_method', sql: "ALTER TABLE sellers ADD COLUMN preferred_settlement_method TEXT DEFAULT 'auto'" },

    // 🛡️ 2026-06-01 영입자(크리에이터) 매장영입 commission — affiliate 와 구분용 source.
    //   'affiliate'(기존 referral/promotion, NULL 포함) vs 'store_intro'(매장 영입자 영구 commission).
    { desc: 'influencer_attributions.source', sql: "ALTER TABLE influencer_attributions ADD COLUMN source TEXT" },
    { desc: 'seed: influencer_store_intro_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('influencer_store_intro_pct', '1.5', '크리에이터 매장 영입 commission (%, 영입자에게 매장 매출의 %)', datetime('now'))" },

    // 🏭 2026-06-07 (사용자 요청): 커뮤니티 공구 제안자(공구를 유치하는 사람)가 작성하는 소개글/안내문구.
    { desc: 'community_group_buys.description', sql: "ALTER TABLE community_group_buys ADD COLUMN description TEXT" },

    // 🏭 2026-06-09 도매몰 메인 리디자인 Wave 2 — 프리미엄 전용관 플래그.
    //   products.is_premium=1 인 상품만 /api/wholesale/catalog?premium=1 에 노출. 어드민 토글로 설정.
    { desc: 'products.is_premium', sql: "ALTER TABLE products ADD COLUMN is_premium INTEGER DEFAULT 0" },
    // 🏭 2026-06-09 도매몰 예치금 입금계좌 — 어드민이 설정하는 무통장입금 안내 계좌(은행/계좌/예금주 한 문자열).
    { desc: 'seed: wholesale_deposit_account', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('wholesale_deposit_account', '', '도매몰 예치금 무통장입금 안내 계좌 (은행/계좌번호/예금주)', datetime('now'))" },
    // 🏬 2026-06-09 도매몰 멀티-몰 테넌시 — mall_id 컬럼(DEFAULT 1 → 기존 데이터 = 기본 몰 1, 동작 불변).
    //   모델 B(몰별 회원가입): products/sellers/suppliers/wholesale_banners/wholesale_proposal_tickets 에만 추가.
    //   예치금/주문/세금/채팅은 이미 per-mall account id(sellers.id/suppliers.id) 에 매달려 몰-격리 → mall_id 미추가.
    //   🔒 INVARIANT: DEFAULT 1 → 기존 전 행이 기본 몰 1 에 속함 → 기본 몰만 있으면 모든 필터가 1=동일 rows.
    { desc: 'sellers.mall_id', sql: "ALTER TABLE sellers ADD COLUMN mall_id INTEGER DEFAULT 1" },
    { desc: 'suppliers.mall_id', sql: "ALTER TABLE suppliers ADD COLUMN mall_id INTEGER DEFAULT 1" },
    { desc: 'products.mall_id', sql: "ALTER TABLE products ADD COLUMN mall_id INTEGER DEFAULT 1" },
    { desc: 'wholesale_banners.mall_id', sql: "ALTER TABLE wholesale_banners ADD COLUMN mall_id INTEGER DEFAULT 1" },
    { desc: 'wholesale_proposal_tickets.mall_id', sql: "ALTER TABLE wholesale_proposal_tickets ADD COLUMN mall_id INTEGER DEFAULT 1" },
    // 🏬 2026-06-15 (sellpie형 게시판): 세부 카테고리(supply/codev/live/sns/report/inquiry). my-tickets/board SELECT 가 참조.
    { desc: 'wholesale_proposal_tickets.category', sql: "ALTER TABLE wholesale_proposal_tickets ADD COLUMN category TEXT" },
    // 필터에 쓰는 컬럼 인덱스(카탈로그/배너/제안 스코핑 — products 는 도매 카탈로그 부분 인덱스).
    { desc: 'idx_products_mall_supply', sql: "CREATE INDEX IF NOT EXISTS idx_products_mall_supply ON products(mall_id) WHERE is_supply_product = 1" },
    { desc: 'idx_sellers_mall', sql: "CREATE INDEX IF NOT EXISTS idx_sellers_mall ON sellers(mall_id)" },
    { desc: 'idx_suppliers_mall', sql: "CREATE INDEX IF NOT EXISTS idx_suppliers_mall ON suppliers(mall_id)" },
    { desc: 'idx_wholesale_banners_mall', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_banners_mall ON wholesale_banners(mall_id, active, sort, id)" },
    { desc: 'idx_wholesale_proposal_tickets_mall', sql: "CREATE INDEX IF NOT EXISTS idx_wholesale_proposal_tickets_mall ON wholesale_proposal_tickets(mall_id, id DESC)" },
    // 🏷️ 2026-06-09 브랜드 전시관 로고 — 브랜드제품(is_brand_product=1)에 브랜드 로고 URL 저장(선택).
    //   브랜드 전시관 그리드에서 텍스트 칩 대신 로고 이미지 표시. 미설정 시 기존 텍스트 칩 동작 불변.
    { desc: 'products.brand_logo_url', sql: "ALTER TABLE products ADD COLUMN brand_logo_url TEXT" },
    // 🛡️ 2026-06-10 (교환권 500 후속 — 스키마 문서/실DB 편차 마감): production-schema.ts 에는 있으나
    //   구세대 prod 테이블에 없을 수 있는 컬럼 — 자가치유(withColumnPruning)가 빼고 응답하던 것을
    //   생성으로 완전 복귀. 멱등(있으면 exists).
    { desc: 'products.images', sql: "ALTER TABLE products ADD COLUMN images TEXT" },
    { desc: 'products.stock_quantity', sql: "ALTER TABLE products ADD COLUMN stock_quantity INTEGER" },
    // 🎫 2026-06-17 (교환권 발송 자동 복구): voucher_orders 재시도 추적 컬럼.
    //   kt-alpha-voucher-retry cron 이 'failed' 자동 재시도(retry_count<3, backoff) 시 참조.
    //   requiresTable 가드 — voucher_orders 는 아래 tables 루프에서 먼저 생성됨.
    { desc: 'voucher_orders.retry_count', sql: "ALTER TABLE voucher_orders ADD COLUMN retry_count INTEGER DEFAULT 0", requiresTable: 'voucher_orders' },
    { desc: 'voucher_orders.last_retry_at', sql: "ALTER TABLE voucher_orders ADD COLUMN last_retry_at DATETIME", requiresTable: 'voucher_orders' },
  ];

  const results: Array<{ desc: string; status: 'added' | 'exists' | 'error'; error?: string }> = [];
  // 🛡️ 2026-06-10 (no such table 8건 fix): 컬럼 ALTER 가 CREATE TABLE(아래 tables 루프)보다 먼저 돌아
  //   fresh 테이블(wholesale_banners 등)의 mall_id ALTER 가 실패하던 순서 버그 → 테이블 생성 후 실행.
  //   requiresTable 가드: 생성 루트가 없는 선택 테이블(라이브 등)은 부재 시 조용히 스킵('exists' 표기).
  const runColumnSteps = async () => {
    let existingTables: Set<string> | null = null;
    try {
      const r = await DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      existingTables = new Set(((r.results || []) as Array<{ name: string }>).map((t) => t.name));
    } catch { /* 조회 실패 시 가드 비활성 — 기존 동작 */ }
    for (const { desc, sql, requiresTable } of stmts) {
      if (requiresTable && existingTables && !existingTables.has(requiresTable)) {
        results.push({ desc, status: 'exists' }); // 미사용 기능 테이블 부재 — 스킵
        continue;
      }
      try {
        await DB.prepare(sql).run();
        results.push({ desc, status: 'added' });
      } catch (e: any) {
        const msg = String(e?.message || e);
        // 🛡️ 2026-06-18 (대표 신고 — 67 오류): 둘 다 비-실패(non-actionable) → 'exists' 로.
        //   · duplicate column / already exists = 이미 있음.
        //   · too many columns on sqlite_altertab_X = 그 테이블(예: sellers)이 SQLite 컬럼 한도 도달 →
        //     ALTER ADD 자체가 불가. 한도 도달 전 추가된 컬럼은 이미 존재(commission_rate 등도 같은 에러),
        //     아직 없는 컬럼은 ALTER 로는 못 넣음(한도) → 어느 쪽이든 이 루프에서 할 수 있는 게 없음.
        if (/duplicate column|already exists|too many columns/i.test(msg)) {
          results.push({ desc, status: 'exists' });
        } else {
          results.push({ desc, status: 'error', error: msg.slice(0, 200) });
        }
      }
    }
  };

  // 부수적: 자주 사용되는 보조 테이블 보장 (static code audit 확장)
  const tables: Array<{ name: string; sql: string }> = [
    { name: 'auth_refresh_tokens', sql: `CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )` },
    { name: 'rate_limit_attempts', sql: `CREATE TABLE IF NOT EXISTS rate_limit_attempts (
      key TEXT NOT NULL,
      action TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (key, action, window_start)
    )` },
    { name: 'password_reset_tokens', sql: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'refresh_tokens', sql: `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'product_reviews', sql: `CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      title TEXT,
      content TEXT,
      images TEXT,
      is_hidden INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'order_refund_history', sql: `CREATE TABLE IF NOT EXISTS order_refund_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      refund_amount INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'user_points', sql: `CREATE TABLE IF NOT EXISTS user_points (
      user_id INTEGER PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'point_transactions', sql: `CREATE TABLE IF NOT EXISTS point_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'coupons', sql: `CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL,
      discount_value INTEGER NOT NULL,
      min_purchase INTEGER DEFAULT 0,
      max_discount INTEGER,
      valid_from DATETIME,
      valid_until DATETIME,
      max_uses INTEGER,
      used_count INTEGER DEFAULT 0,
      seller_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'user_coupons', sql: `CREATE TABLE IF NOT EXISTS user_coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coupon_id INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      used_at DATETIME,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'wishlists', sql: `CREATE TABLE IF NOT EXISTS wishlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    )` },
    { name: 'agencies', sql: `CREATE TABLE IF NOT EXISTS agencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      commission_rate REAL DEFAULT 5.0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    // 🛡️ 2026-05-21: 자체 예약 캘린더 — 뷰티/액티비티/건강/펫 sub-1day 예약.
    //   매장이 가용 시간 슬롯 패턴 등록 → 유저가 결제 후 슬롯 선택 → 예약 확정.
    //   숙소는 별도 stay_bookings 유지.
    { name: 'product_booking_slots', sql: `CREATE TABLE IF NOT EXISTS product_booking_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 1 CHECK(capacity >= 1),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )` },
    { name: 'idx_booking_slots_product', sql: `CREATE INDEX IF NOT EXISTS idx_booking_slots_product ON product_booking_slots(product_id, day_of_week, is_active)` },
    { name: 'appointment_bookings', sql: `CREATE TABLE IF NOT EXISTS appointment_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      user_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      booking_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled','no_show','completed')),
      user_phone TEXT,
      user_name TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      cancelled_at TEXT,
      cancel_reason TEXT,
      completed_at TEXT
    )` },
    // 충돌 방지 + 매장별 조회 + 유저별 조회.
    { name: 'idx_appointments_slot', sql: `CREATE INDEX IF NOT EXISTS idx_appointments_slot ON appointment_bookings(product_id, booking_date, start_time, status)` },
    { name: 'idx_appointments_user', sql: `CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointment_bookings(user_id, booking_date)` },
    { name: 'idx_appointments_seller', sql: `CREATE INDEX IF NOT EXISTS idx_appointments_seller ON appointment_bookings(seller_id, booking_date, status)` },
    // 🛡️ 2026-05-21: race condition 영구 차단 — 같은 유저가 같은 슬롯 중복 예약 금지.
    //   동시 결제 race 는 application 에서 capacity check + INSERT WHERE COUNT, 본 UNIQUE 는 self-duplicate 방지.
    { name: 'idx_appointments_user_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_user_unique ON appointment_bookings(user_id, product_id, booking_date, start_time) WHERE status = 'confirmed'` },
    // 🛡️ 2026-05-21 Phase C: payouts — 실제 송금 기록 (ledger_entries 와 별개로 송금 audit).
    //   주 1회 배치 정산 → admin 검토 → "송금 버튼" 클릭 시 INSERT.
    //   토스/은행 transaction_id 추적 → 분쟁 시 reverse lookup 가능.
    { name: 'payouts', sql: `CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payee_type TEXT NOT NULL CHECK(payee_type IN ('seller','agency','store_owner','user')),
      payee_id TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      ledger_entry_ids TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','sent','failed','cancelled')),
      bank_name TEXT,
      account_number TEXT,
      account_holder TEXT,
      transaction_id TEXT,
      admin_memo TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      approved_at TEXT,
      sent_at TEXT,
      processed_by TEXT
    )` },
    { name: 'idx_payouts_status', sql: `CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status, created_at DESC)` },
    { name: 'idx_payouts_payee', sql: `CREATE INDEX IF NOT EXISTS idx_payouts_payee ON payouts(payee_type, payee_id, status)` },
    { name: 'idx_payouts_period', sql: `CREATE INDEX IF NOT EXISTS idx_payouts_period ON payouts(period_start, period_end, payee_type)` },
    // 🛡️ 2026-05-21 Phase D-4: 셀러 트래킹 링크 클릭 카운트 (funnel 측정).
    //   클릭 → 비결제 단계 측정. 결제 attribution 은 referral_commissions 별도.
    //   IP 해시 + UA hash 로 일일 unique 클릭 dedup (중복 봇 방지).
    { name: 'referral_clicks', sql: `CREATE TABLE IF NOT EXISTS referral_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id TEXT NOT NULL,
      product_id INTEGER,
      ip_hash TEXT,
      user_agent_hash TEXT,
      referer TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )` },
    { name: 'idx_referral_clicks_seller', sql: `CREATE INDEX IF NOT EXISTS idx_referral_clicks_seller ON referral_clicks(seller_id, created_at DESC)` },
    { name: 'idx_referral_clicks_product', sql: `CREATE INDEX IF NOT EXISTS idx_referral_clicks_product ON referral_clicks(product_id, created_at DESC) WHERE product_id IS NOT NULL` },
    // 📧 2026-06-09 Wave 3b: 어드민 단체메일 발송 로그 (filtered bulk email)
    { name: 'bulk_email_log', sql: `CREATE TABLE IF NOT EXISTS bulk_email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT,
      admin_email TEXT,
      filter_json TEXT,
      subject TEXT NOT NULL,
      recipient_count INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      is_test INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_bulk_email_log_created', sql: `CREATE INDEX IF NOT EXISTS idx_bulk_email_log_created ON bulk_email_log(created_at DESC)` },
    // 🚀 인덱스 추가 (2026-04-22 static audit 결과 — 셀러 대시보드 쿼리 500ms → 50ms)
    { name: 'idx_orders_seller_status_v2', sql: `CREATE INDEX IF NOT EXISTS idx_orders_seller_status_v2 ON orders(seller_id, status)` },
    { name: 'idx_donations_seller_payment_status', sql: `CREATE INDEX IF NOT EXISTS idx_donations_seller_payment_status ON donations(seller_id, payment_status)` },
    { name: 'idx_orders_live_stream_status', sql: `CREATE INDEX IF NOT EXISTS idx_orders_live_stream_status ON orders(live_stream_id, status)` },
    { name: 'idx_orders_user_id', sql: `CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)` },
    { name: 'idx_cart_user_id', sql: `CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart_items(user_id)` },
    { name: 'idx_products_seller_id', sql: `CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id)` },
    { name: 'idx_wishlists_user_id', sql: `CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id)` },
    { name: 'shipping_addresses', sql: `CREATE TABLE IF NOT EXISTS shipping_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      postal_code TEXT,
      address TEXT NOT NULL,
      address_detail TEXT,
      is_default INTEGER DEFAULT 0,
      country TEXT DEFAULT 'KR',
      label TEXT,
      delivery_note TEXT,
      entry_code TEXT,
      entry_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    // 🛡️ 2026-04-23 배치 169: 번들(세트) 상품
    { name: 'product_bundles', sql: `CREATE TABLE IF NOT EXISTS product_bundles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      seller_id INTEGER NOT NULL,
      discount_type TEXT DEFAULT 'percent' CHECK(discount_type IN ('percent', 'fixed')),
      discount_value REAL DEFAULT 0,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES sellers(id)
    )` },
    { name: 'product_bundle_items', sql: `CREATE TABLE IF NOT EXISTS product_bundle_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bundle_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (bundle_id) REFERENCES product_bundles(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )` },
    // 🛡️ 2026-04-23 배치 174: 운영 가이드 테이블 (어드민/셀러/에이전시)
    { name: 'operation_guides', sql: `CREATE TABLE IF NOT EXISTS operation_guides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guide_type TEXT NOT NULL CHECK(guide_type IN ('admin', 'seller', 'agency', 'wholesale')),
      section_key TEXT NOT NULL,
      section_icon TEXT,
      section_title TEXT NOT NULL,
      section_order INTEGER DEFAULT 0,
      content_md TEXT NOT NULL,
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(guide_type, section_key)
    )` },
    // 🛡️ 2026-05-20: migration 0274 (user_withdrawals) — 일반 user 현금 출금 신청.
    //   /api/_internal/repair-schema 한 번 호출로 production 적용 가능.
    { name: 'user_withdrawals', sql: `CREATE TABLE IF NOT EXISTS user_withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount >= 10000),
      withholding_tax INTEGER NOT NULL DEFAULT 0,
      net_amount INTEGER NOT NULL,
      bank_name TEXT NOT NULL,
      bank_account TEXT NOT NULL,
      account_holder TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested','approved','paid','rejected','failed','cancelled')),
      rejection_reason TEXT,
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      admin_memo TEXT
    )` },
    { name: 'idx_user_withdrawals_user_status', sql: `CREATE INDEX IF NOT EXISTS idx_user_withdrawals_user_status ON user_withdrawals(user_id, status, requested_at DESC)` },
    // 🏦 2026-06-12 지급 센터 (P1 사용자 결정) — 입금완료 기록 + 큐레이터 딜 차감 마커 + 에이전시 지급 이력.
    { name: 'settlements.paid_at', sql: 'ALTER TABLE settlements ADD COLUMN paid_at DATETIME' },
    { name: 'settlements.admin_memo', sql: 'ALTER TABLE settlements ADD COLUMN admin_memo TEXT' },
    { name: 'user_withdrawals.deal_deducted', sql: 'ALTER TABLE user_withdrawals ADD COLUMN deal_deducted INTEGER DEFAULT 0' },
    // 🏁 2026-06-12 P4: 국세청 상태조회 결과 저장 (유통=자동승인 근거 / 공급=어드민 표시)
    { name: 'sellers.nts_status', sql: 'ALTER TABLE sellers ADD COLUMN nts_status TEXT' },
    { name: 'suppliers.nts_status', sql: 'ALTER TABLE suppliers ADD COLUMN nts_status TEXT' },
    { name: 'agency_commission_payouts', sql: `CREATE TABLE IF NOT EXISTS agency_commission_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      row_count INTEGER NOT NULL,
      admin_memo TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )` },
    { name: 'idx_user_withdrawals_status_requested', sql: `CREATE INDEX IF NOT EXISTS idx_user_withdrawals_status_requested ON user_withdrawals(status, requested_at DESC)` },
    // migration 0273 — 검색 분석 로그.
    { name: 'search_logs', sql: `CREATE TABLE IF NOT EXISTS search_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      query TEXT NOT NULL,
      result_count INTEGER NOT NULL DEFAULT 0,
      clicked_product_id INTEGER,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'idx_search_logs_query', sql: `CREATE INDEX IF NOT EXISTS idx_search_logs_query ON search_logs(query, created_at DESC)` },
    { name: 'idx_search_logs_created_at', sql: `CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at DESC)` },
    // 🛡️ 2026-05-20: migration 0275 (FTS5 trigram) — 한국어 부분매칭 검색.
    //   `CREATE VIRTUAL TABLE IF NOT EXISTS` idempotent — 이미 trigram 으로 있으면 noop,
    //   없으면 새로 생성. porter unicode61 인 채로 있으면 (0080) 변경 안 됨 → 명시 마이그레이션 필요.
    //   안전한 접근: VIRTUAL TABLE 존재 여부 체크 후 tokenize 가 'trigram' 인지 확인.
    //   _migration_history 의 '0275' 마커로 한 번만 실행 보장.
    { name: 'products_fts_trigram_init', sql: `CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
      name, description, category,
      content=products,
      content_rowid=id,
      tokenize="trigram case_sensitive 0 remove_diacritics 1"
    )` },
    { name: 'products_fts_insert_trigger', sql: `CREATE TRIGGER IF NOT EXISTS products_fts_insert
      AFTER INSERT ON products
      BEGIN
        INSERT INTO products_fts(rowid, name, description, category)
        VALUES (NEW.id, COALESCE(NEW.name,''), COALESCE(NEW.description,''), COALESCE(NEW.category,''));
      END` },
    { name: 'products_fts_update_trigger', sql: `CREATE TRIGGER IF NOT EXISTS products_fts_update
      AFTER UPDATE ON products
      BEGIN
        UPDATE products_fts
        SET name = COALESCE(NEW.name,''),
            description = COALESCE(NEW.description,''),
            category = COALESCE(NEW.category,'')
        WHERE rowid = NEW.id;
      END` },
    // 🩹 2026-06-17 (데모 '정리' 500 근본수정): 외부콘텐츠(content=products) FTS5 는 AFTER DELETE 시점에
    //   원본 행이 사라져 `DELETE FROM products_fts WHERE rowid=OLD.id` 가 제거할 콘텐츠를 못 읽어 throw →
    //   상품 하드삭제가 500. 정식 'delete' 커맨드(OLD 값 명시 전달)로 교정. 기존 트리거는 DROP 후 재생성
    //   (CREATE IF NOT EXISTS 는 기존을 안 바꾸므로 선행 DROP 필수).
    { name: 'products_fts_delete_trigger_drop_legacy', sql: `DROP TRIGGER IF EXISTS products_fts_delete` },
    { name: 'products_fts_delete_trigger', sql: `CREATE TRIGGER IF NOT EXISTS products_fts_delete
      AFTER DELETE ON products
      BEGIN
        INSERT INTO products_fts(products_fts, rowid, name, description, category)
        VALUES('delete', OLD.id, COALESCE(OLD.name,''), COALESCE(OLD.description,''), COALESCE(OLD.category,''));
      END` },
    // 🛡️ 2026-05-20: 에이전시 입점 가게 commission ledger.
    //   에이전시가 입점시킨 가게 (sellers.introduced_by_agency_id) 의 모든 공구권 매출 →
    //   각 주문마다 2% (agencies.store_intro_commission_pct) commission 적립.
    //   타입: 'signup_bonus' (가게 첫 결제 ₩30k) / 'sales_commission' (매출 2%) / 'growth_bonus' (월 100만 돌파 ₩50k).
    //   영구 commission — 12개월 제한 없이 입점 가게 평생 매출에 대해 누적.
    { name: 'agency_store_intro_commissions', sql: `CREATE TABLE IF NOT EXISTS agency_store_intro_commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      store_seller_id INTEGER NOT NULL,
      order_id INTEGER,
      type TEXT NOT NULL CHECK (type IN ('signup_bonus', 'sales_commission', 'growth_bonus')),
      order_amount INTEGER DEFAULT 0,
      commission_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid', 'cancelled')),
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      available_at DATETIME,
      paid_at DATETIME,
      note TEXT,
      UNIQUE(order_id, type)
    )` },
    { name: 'idx_agency_intro_comm_agency', sql: `CREATE INDEX IF NOT EXISTS idx_agency_intro_comm_agency ON agency_store_intro_commissions(agency_id, status, created_at DESC)` },
    { name: 'idx_agency_intro_comm_store', sql: `CREATE INDEX IF NOT EXISTS idx_agency_intro_comm_store ON agency_store_intro_commissions(store_seller_id, type, created_at DESC)` },
    // 🔐 2026-06-11 (머니 감사 Med-B): signup_bonus 는 매장당 1회 — 동시 첫주문 2건 이중적립 race 차단.
    //   기존 UNIQUE(order_id,type) 는 order_id 다르면 무력했음.
    { name: 'idx_agency_intro_signup_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_intro_signup_unique ON agency_store_intro_commissions(store_seller_id) WHERE type = 'signup_bonus'` },
    // 🛡️ 2026-05-22: migrations 0277 — group-buy 피드 materialized cache.
    //   (status, category) PK 로 product JSON snapshot 저장. 5분 cron 으로 갱신.
    //   적용 즉시 group-buy-public.routes.ts 의 cache fallback path 자동 활성.
    { name: 'group_buy_feed_cache', sql: `CREATE TABLE IF NOT EXISTS group_buy_feed_cache (
      status TEXT NOT NULL,
      category TEXT NOT NULL,
      product_json TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      computed_at DATETIME NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (status, category)
    )` },
    { name: 'idx_group_buy_feed_cache_computed', sql: `CREATE INDEX IF NOT EXISTS idx_group_buy_feed_cache_computed ON group_buy_feed_cache (computed_at DESC)` },
    // 🛡️ 2026-05-22 카카오 P0: 계정 탈퇴 시 30일 grace period (restore 가능). 테이블 부재 production 환경 안전.
    { name: 'deleted_accounts', sql: `CREATE TABLE IF NOT EXISTS deleted_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      kakao_id TEXT,
      email TEXT,
      name TEXT,
      deleted_at DATETIME NOT NULL DEFAULT (datetime('now')),
      restorable_until DATETIME NOT NULL,
      restored_at DATETIME,
      purge_after DATETIME
    )` },
    { name: 'idx_deleted_accounts_kakao', sql: `CREATE INDEX IF NOT EXISTS idx_deleted_accounts_kakao ON deleted_accounts(kakao_id) WHERE kakao_id IS NOT NULL` },
    { name: 'idx_deleted_accounts_email', sql: `CREATE INDEX IF NOT EXISTS idx_deleted_accounts_email ON deleted_accounts(email) WHERE email IS NOT NULL` },

    // ── 큐레이터 링크샵 (migration 0278, 2026-05-25) ─────────
    { name: 'idx_users_handle_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_unique ON users(handle) WHERE handle IS NOT NULL` },
    // 🧭 2026-06-10 (사용자 신고 — 링크샵 영구 슬로우패스): 레거시 generic/예약 핸들('user' 등, 한글 닉네임
    //   빈 슬러그 시절 산물)을 user{id} 로 백필. 예약 핸들은 BottomNav 가드가 캐시를 매번 purge →
    //   매 탭 /u/me 홉 + cold fetch 의 자기파괴 루프였음. UNIQUE 충돌 시 해당 행만 skip(다음 실행 수렴).
    { name: 'backfill: users.handle reserved rename', sql: `UPDATE users SET handle = 'user' || id
      WHERE handle IN ('user','admin','me','api','host','new','login','seller','shop')
        AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.handle = 'user' || users.id AND u2.id != users.id)` },
    // 🏁 2026-06-17 (핸들 변경 리다이렉트): 옛 핸들 → user_id 매핑. /u/{옛핸들} → /u/{현재핸들} 자동 이동.
    { name: 'user_handle_aliases', sql: `CREATE TABLE IF NOT EXISTS user_handle_aliases (
      alias TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )` },
    // 🏁 2026-06-17 (사용자 신고 — /u/user2 핸들 변경 후 깨짐): 리다이렉트 기능 도입 前 변경된
    //   user2→jiwon 1회성 백필. alias 는 라이브 핸들 미스 시에만 사용(라이브 우선)이라 안전, INSERT OR IGNORE 멱등.
    { name: 'backfill: handle alias user2->jiwon (pre-feature)', sql: `INSERT OR IGNORE INTO user_handle_aliases (alias, user_id)
      SELECT 'user2', id FROM users WHERE handle = 'jiwon' LIMIT 1` },
    { name: 'product_pins', sql: `CREATE TABLE IF NOT EXISTS product_pins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      click_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )` },
    { name: 'idx_product_pins_user_pos', sql: `CREATE INDEX IF NOT EXISTS idx_product_pins_user_pos ON product_pins(user_id, position)` },
    { name: 'idx_product_pins_product', sql: `CREATE INDEX IF NOT EXISTS idx_product_pins_product ON product_pins(product_id)` },
    { name: 'pin_click_logs', sql: `CREATE TABLE IF NOT EXISTS pin_click_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pin_id INTEGER NOT NULL,
      curator_user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      visitor_user_id INTEGER,
      ip_hash TEXT,
      user_agent_hash TEXT,
      referer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pin_id) REFERENCES product_pins(id)
    )` },
    { name: 'idx_pin_clicks_pin_time', sql: `CREATE INDEX IF NOT EXISTS idx_pin_clicks_pin_time ON pin_click_logs(pin_id, created_at)` },
    { name: 'idx_pin_clicks_curator_time', sql: `CREATE INDEX IF NOT EXISTS idx_pin_clicks_curator_time ON pin_click_logs(curator_user_id, created_at)` },

    // ── 배송 재설계 (migration 0279, 2026-05-25) ──────────
    { name: 'regional_shipping_fees', sql: `CREATE TABLE IF NOT EXISTS regional_shipping_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      region_code TEXT NOT NULL,
      postal_code_pattern TEXT NOT NULL,
      extra_fee INTEGER NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'idx_regional_shipping_active', sql: `CREATE INDEX IF NOT EXISTS idx_regional_shipping_active ON regional_shipping_fees(is_active, region_code)` },
    // seed: 제주 / 도서산간 (idempotent)
    { name: 'regional_shipping_fees_seed_jeju', sql: `INSERT OR IGNORE INTO regional_shipping_fees (id, region_code, postal_code_pattern, extra_fee, description) VALUES (1, 'jeju', '63%', 3000, '제주특별자치도')` },
    { name: 'regional_shipping_fees_seed_ulleung', sql: `INSERT OR IGNORE INTO regional_shipping_fees (id, region_code, postal_code_pattern, extra_fee, description) VALUES (2, 'island', '40200-40240', 5000, '울릉도')` },
    { name: 'regional_shipping_fees_seed_baekryeong', sql: `INSERT OR IGNORE INTO regional_shipping_fees (id, region_code, postal_code_pattern, extra_fee, description) VALUES (3, 'island', '23004-23010', 5000, '백령도')` },
    { name: 'regional_shipping_fees_seed_yeonpyeong', sql: `INSERT OR IGNORE INTO regional_shipping_fees (id, region_code, postal_code_pattern, extra_fee, description) VALUES (4, 'island', '23100-23129', 5000, '연평도')` },
    { name: 'regional_shipping_fees_seed_geoje', sql: `INSERT OR IGNORE INTO regional_shipping_fees (id, region_code, postal_code_pattern, extra_fee, description) VALUES (5, 'island', '46900-46999', 5000, '거제 일부 도서')` },

    { name: 'shipping_tracking_events', sql: `CREATE TABLE IF NOT EXISTS shipping_tracking_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      carrier_code TEXT,
      tracking_number TEXT,
      status TEXT NOT NULL,
      status_text TEXT,
      location TEXT,
      occurred_at DATETIME,
      source TEXT NOT NULL DEFAULT 'tracker_delivery',
      raw_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )` },
    { name: 'idx_shipping_events_order', sql: `CREATE INDEX IF NOT EXISTS idx_shipping_events_order ON shipping_tracking_events(order_id, created_at DESC)` },

    // ── 호스팅 (migration 0280, 2026-05-25) ──────────────
    { name: 'group_buy_hosts', sql: `CREATE TABLE IF NOT EXISTS group_buy_hosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      host_user_id INTEGER NOT NULL,
      invite_code TEXT NOT NULL,
      target_quantity INTEGER NOT NULL DEFAULT 5,
      current_quantity INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      deadline_at DATETIME,
      note TEXT,
      total_earnings INTEGER NOT NULL DEFAULT 0,
      achieved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(host_user_id, product_id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (host_user_id) REFERENCES users(id)
    )` },
    { name: 'idx_gbh_invite_code', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_gbh_invite_code ON group_buy_hosts(invite_code)` },
    { name: 'idx_gbh_host_status', sql: `CREATE INDEX IF NOT EXISTS idx_gbh_host_status ON group_buy_hosts(host_user_id, status)` },
    { name: 'idx_gbh_product_status', sql: `CREATE INDEX IF NOT EXISTS idx_gbh_product_status ON group_buy_hosts(product_id, status)` },

    { name: 'group_buy_host_participants', sql: `CREATE TABLE IF NOT EXISTS group_buy_host_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 1,
      earnings INTEGER NOT NULL DEFAULT 0,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(host_id, user_id),
      FOREIGN KEY (host_id) REFERENCES group_buy_hosts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )` },
    { name: 'idx_gbhp_host', sql: `CREATE INDEX IF NOT EXISTS idx_gbhp_host ON group_buy_host_participants(host_id, joined_at DESC)` },
    // 🛡️ 2026-05-28: 디지털 상품 접근권/다운로드 로그 (migration 0243) — /my/digital 500 fix.
    { name: 'digital_product_access', sql: `CREATE TABLE IF NOT EXISTS digital_product_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      order_item_id INTEGER,
      access_token TEXT UNIQUE NOT NULL,
      expires_at DATETIME,
      download_count INTEGER DEFAULT 0,
      download_limit INTEGER DEFAULT 100,
      last_accessed DATETIME,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','revoked','expired')),
      created_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(user_id, product_id, order_id)
    )` },
    { name: 'idx_dpa_user', sql: `CREATE INDEX IF NOT EXISTS idx_dpa_user ON digital_product_access(user_id, status, created_at DESC)` },
    { name: 'idx_dpa_product', sql: `CREATE INDEX IF NOT EXISTS idx_dpa_product ON digital_product_access(product_id)` },
    { name: 'idx_dpa_order', sql: `CREATE INDEX IF NOT EXISTS idx_dpa_order ON digital_product_access(order_id)` },
    { name: 'idx_dpa_token', sql: `CREATE INDEX IF NOT EXISTS idx_dpa_token ON digital_product_access(access_token)` },
    { name: 'digital_download_logs', sql: `CREATE TABLE IF NOT EXISTS digital_download_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      ip TEXT,
      user_agent TEXT,
      bytes_served INTEGER,
      status TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_ddl_access', sql: `CREATE INDEX IF NOT EXISTS idx_ddl_access ON digital_download_logs(access_id, created_at DESC)` },
    { name: 'idx_products_kind_active', sql: `CREATE INDEX IF NOT EXISTS idx_products_kind_active ON products(product_kind, is_active, created_at DESC)` },

    // 🛡️ 2026-05-31 도매몰 INC-2: 외부 도매상(공급자) 데이터 모델. (D1=외부 도매상, D2=즉시 split)
    { name: 'suppliers', sql: `CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      business_number TEXT,
      representative TEXT,
      email TEXT,
      phone TEXT,
      password_hash TEXT,
      bank_name TEXT,
      bank_account TEXT,
      account_holder TEXT,
      commission_rate REAL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','rejected')),
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_suppliers_email', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email) WHERE email IS NOT NULL` },
    { name: 'idx_suppliers_status', sql: `CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status, created_at DESC)` },

    // 🏭 2026-06-16 유통스타트 도매몰: 판매사 등급별 보장마진율(어드민 편집). 판매사공급가 = max(제조사원가, 판매가 × (1−margin_pct/100)).
    //   margin_pct = 판매가 대비 보장마진(%). 값 마이그레이션은 distributor-admin ensureGrades(flag) 가 담당.
    { name: 'distributor_grades', sql: `CREATE TABLE IF NOT EXISTS distributor_grades (
      grade TEXT PRIMARY KEY,
      label TEXT,
      margin_pct REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_special INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT (datetime('now'))
    )` },
    // 기본 등급 시드 (어드민이 /admin 에서 마진율 편집). 고등급(A)일수록 큰 보장마진(= 낮은 공급가). 프리미엄/프로/일반.
    { name: 'seed: distributor_grades', sql: `INSERT OR IGNORE INTO distributor_grades (grade, label, margin_pct, sort_order, is_special) VALUES
      ('A','프리미엄',38,1,0),
      ('B','프로',30,2,0),
      ('C','일반',15,3,0),
      ('D','D등급',8,4,0),
      ('OEM','OEM',40,5,0),
      ('SPECIAL','특별할인(기간한정)',45,9,1)` },

    // 🛡️ 2026-06-16 어드민 활동 감사로그 — writeAuditLog/adminAuditMiddleware 가 기록(모든 어드민 변경 자동).
    //   ⚠️ 마이그레이션(0126/0128)에만 있어 prod(마이그 미실행)엔 테이블이 없을 수 있음 → writeAuditLog 가
    //   조용히 실패(try-catch)해 로그 유실. repair-schema 에 보장해야 실제로 기록됨.
    { name: 'admin_audit_logs', sql: `CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      admin_email TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      before_value TEXT,
      after_value TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )` },
    { name: 'admin_login_history', sql: `CREATE TABLE IF NOT EXISTS admin_login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      email TEXT,
      ip TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )` },
    { name: 'idx_admin_login_history_created', sql: `CREATE INDEX IF NOT EXISTS idx_admin_login_history_created ON admin_login_history(created_at DESC)` },
    { name: 'idx_admin_audit_admin_id', sql: `CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON admin_audit_logs(admin_id, created_at)` },
    { name: 'idx_admin_audit_action', sql: `CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs(action, created_at)` },
    { name: 'idx_admin_audit_created', sql: `CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC)` },

    // 🏭 2026-06-01 유통스타트: B2B 선결제 도매 주문 (판매사→유통스타트).
    { name: 'wholesale_orders', sql: `CREATE TABLE IF NOT EXISTS wholesale_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      distributor_seller_id INTEGER NOT NULL,
      toss_order_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'PENDING',
      grade TEXT,
      subtotal INTEGER NOT NULL DEFAULT 0,
      supply_total INTEGER NOT NULL DEFAULT 0,
      margin_total INTEGER NOT NULL DEFAULT 0,
      payment_key TEXT,
      refunded_amount INTEGER NOT NULL DEFAULT 0,
      courier TEXT,
      tracking_number TEXT,
      shipped_at DATETIME,
      ship_to_name TEXT,
      ship_to_phone TEXT,
      ship_to_address TEXT,
      ship_to_postal TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      paid_at DATETIME
    )` },
    { name: 'wholesale_order_items', sql: `CREATE TABLE IF NOT EXISTS wholesale_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wholesale_order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      supplier_id INTEGER,
      name TEXT,
      qty INTEGER NOT NULL DEFAULT 1,
      base_supply_price INTEGER NOT NULL DEFAULT 0,
      distributor_unit_price INTEGER NOT NULL DEFAULT 0,
      line_total INTEGER NOT NULL DEFAULT 0,
      courier TEXT,
      tracking_number TEXT,
      shipped_at DATETIME,
      line_status TEXT NOT NULL DEFAULT 'PENDING'
    )` },
    { name: 'idx_wholesale_orders_seller', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_orders_seller ON wholesale_orders(distributor_seller_id, created_at DESC)` },
    { name: 'idx_wholesale_items_order', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_items_order ON wholesale_order_items(wholesale_order_id)` },
    { name: 'idx_wholesale_items_supplier', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_items_supplier ON wholesale_order_items(supplier_id)` },
    // 🏭 2026-06-01 유통스타트: 상품제안 (어드민 → 판매사). Phase 4.
    { name: 'wholesale_proposals', sql: `CREATE TABLE IF NOT EXISTS wholesale_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      distributor_seller_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_wholesale_proposals_seller', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_proposals_seller ON wholesale_proposals(distributor_seller_id, status, created_at DESC)` },

    { name: 'supplier_balances', sql: `CREATE TABLE IF NOT EXISTS supplier_balances (
      supplier_id INTEGER PRIMARY KEY,
      pending_amount INTEGER NOT NULL DEFAULT 0,
      available_amount INTEGER NOT NULL DEFAULT 0,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT (datetime('now'))
    )` },

    { name: 'supplier_settlements', sql: `CREATE TABLE IF NOT EXISTS supplier_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      order_id INTEGER,
      product_id INTEGER,
      seller_id INTEGER,
      retail_amount INTEGER NOT NULL DEFAULT 0,
      supply_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','paid','cancelled')),
      created_at DATETIME DEFAULT (datetime('now')),
      available_at DATETIME,
      paid_at DATETIME,
      note TEXT,
      source TEXT DEFAULT 'consumer'
    )` },
    // 🏭 2026-06-08 TAX-1: 매입(제조사→플랫폼) 역발행 세금계산서 기록 (수동·멱등).
    { name: 'wholesale_purchase_invoices', sql: `CREATE TABLE IF NOT EXISTS wholesale_purchase_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      period TEXT NOT NULL,
      supply_amount INTEGER NOT NULL DEFAULT 0,
      vat_amount INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0,
      settlement_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      barobill_ref TEXT, note TEXT, created_by TEXT,
      created_at DATETIME DEFAULT (datetime('now')), issued_at DATETIME,
      UNIQUE(supplier_id, period)
    )` },
    { name: 'idx_wholesale_purchase_inv_period', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_purchase_inv_period ON wholesale_purchase_invoices(period, supplier_id)` },
    // 🏭 2026-06-09 Wave 3c: 도매 거래별(per-order) 전자세금계산서 자동발행 레코드.
    //   매출(sales: 플랫폼→판매사) = 주문당 1행 / 매입(purchase: 제조사→플랫폼 역발행) = (주문,제조사)당 1행.
    //   VAT 포함 공급대가에서 공급가액/세액 분리. provider 발행은 env-gated(TAX_INVOICE_API_KEY) — 미설정 시 'draft'.
    //   ⚠️ 기존 period 집계용 wholesale_purchase_invoices(수동·멱등) 와 별개 — 이건 거래단위 자동 레코드.
    { name: 'wholesale_tax_invoices', sql: `CREATE TABLE IF NOT EXISTS wholesale_tax_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      supplier_id INTEGER,
      distributor_seller_id INTEGER,
      supply_amount INTEGER NOT NULL DEFAULT 0,
      vat_amount INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      provider_ref TEXT,
      note TEXT,
      issued_at DATETIME,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    // 멱등: 매출=(order_id,'sales',0) / 매입=(order_id,'purchase',supplier_id). supplier_id 0 sentinel(매출).
    { name: 'idx_wholesale_tax_inv_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesale_tax_inv_unique ON wholesale_tax_invoices(order_id, type, supplier_id)` },
    { name: 'idx_wholesale_tax_inv_distributor', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_tax_inv_distributor ON wholesale_tax_invoices(distributor_seller_id, type, created_at DESC)` },
    { name: 'idx_wholesale_tax_inv_supplier', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_tax_inv_supplier ON wholesale_tax_invoices(supplier_id, type, created_at DESC)` },
    { name: 'idx_wholesale_tax_inv_status', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_tax_inv_status ON wholesale_tax_invoices(status, type, created_at DESC)` },
    // 🏭 2026-06-08 DATA-1: 고아행(FK 부재) 일일 스윕 리포트 (flag-only).
    { name: 'wholesale_integrity_reports', sql: `CREATE TABLE IF NOT EXISTS wholesale_integrity_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at DATETIME DEFAULT (datetime('now')),
      total_orphans INTEGER NOT NULL DEFAULT 0,
      checks_json TEXT NOT NULL
    )` },
    { name: 'idx_wholesale_integrity_run', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_integrity_run ON wholesale_integrity_reports(run_at DESC)` },
    // 🏭 2026-06-08 NOTI-1: 재입고 알림 구독 + 주문 메모 스레드.
    { name: 'wholesale_restock_subscriptions', sql: `CREATE TABLE IF NOT EXISTS wholesale_restock_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      distributor_seller_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      notified_at DATETIME,
      UNIQUE(distributor_seller_id, product_id)
    )` },
    { name: 'idx_wh_restock_distributor', sql: `CREATE INDEX IF NOT EXISTS idx_wh_restock_distributor ON wholesale_restock_subscriptions(distributor_seller_id)` },
    { name: 'idx_wh_restock_pending', sql: `CREATE INDEX IF NOT EXISTS idx_wh_restock_pending ON wholesale_restock_subscriptions(product_id, notified_at)` },
    { name: 'wholesale_order_notes', sql: `CREATE TABLE IF NOT EXISTS wholesale_order_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wholesale_order_id INTEGER NOT NULL,
      author_type TEXT NOT NULL,
      author_id INTEGER,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_wh_order_notes_order', sql: `CREATE INDEX IF NOT EXISTS idx_wh_order_notes_order ON wholesale_order_notes(wholesale_order_id, created_at)` },
    { name: 'idx_supplier_settle_supplier', sql: `CREATE INDEX IF NOT EXISTS idx_supplier_settle_supplier ON supplier_settlements(supplier_id, status, created_at DESC)` },
    { name: 'idx_supplier_settle_order', sql: `CREATE INDEX IF NOT EXISTS idx_supplier_settle_order ON supplier_settlements(order_id)` },
    // 🛡️ 2026-06-01 도매몰 INC-4: 공급자별 카탈로그 조회 + 어드민 승인 큐 인덱스.
    { name: 'idx_products_supplier', sql: `CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id, supply_approval_status, created_at DESC)` },
    { name: 'idx_supplier_settle_mature', sql: `CREATE INDEX IF NOT EXISTS idx_supplier_settle_mature ON supplier_settlements(status, available_at)` },
    // 🛡️ 2026-06-07 도매몰 정산 성능/멱등 backstop (IDX-1a/1b, SCHEMA-2). 모두 additive·best-effort.
    // IDX-1a: creditSupplierOnOrder 의 공급라인 조인(products src ON sp.supply_source_id=src.id) 풀스캔 제거.
    { name: 'idx_products_supply_source', sql: `CREATE INDEX IF NOT EXISTS idx_products_supply_source ON products(supply_source_id) WHERE supply_source_id IS NOT NULL` },
    // IDX-1b: 월별 세금 집계(status 필터 + strftime('%Y-%m', paid_at)) 가속.
    { name: 'idx_wholesale_orders_status_paid', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_orders_status_paid ON wholesale_orders(status, paid_at)` },
    // SCHEMA-2: 공급자 정산 멱등 backstop UNIQUE(order_id, product_id, source).
    // ⚠️ 운영 테이블에 이미 중복 (order_id, product_id, source) 행이 있으면 이 생성은 FAIL 한다(best-effort, swallowed → 무시).
    //   그 경우 인덱스가 적용되려면 1회성 dedup(중복 정리)이 먼저 필요하며, 이후 머니 정산 코드는
    //   이 UNIQUE 에 의존하도록 `INSERT ... ON CONFLICT DO NOTHING` 로 전환할 것.
    { name: 'idx_supplier_settle_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_settle_unique ON supplier_settlements(order_id, product_id, source)` },

    // 🛡️ 2026-06-01 도매몰 지급 실행: 공급자 지급(payout) 이력. available_amount → paid_amount 이동 기록.
    { name: 'supplier_payouts', sql: `CREATE TABLE IF NOT EXISTS supplier_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      settlement_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','failed','reversed')),
      bank_name TEXT,
      bank_account TEXT,
      account_holder TEXT,
      note TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_supplier_payouts_supplier', sql: `CREATE INDEX IF NOT EXISTS idx_supplier_payouts_supplier ON supplier_payouts(supplier_id, created_at DESC)` },

    // 🛡️ 2026-06-01 [migration 0257 port] 사업자 게이팅 정산 테이블 — 영입자/셀러 딜 정산 SSOT.
    { name: 'seller_deal_balances', sql: `CREATE TABLE IF NOT EXISTS seller_deal_balances (
      seller_id INTEGER PRIMARY KEY,
      gated_deal_amount INTEGER NOT NULL DEFAULT 0,
      redeemable_deal_amount INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'idx_seller_deal_balances_seller', sql: `CREATE INDEX IF NOT EXISTS idx_seller_deal_balances_seller ON seller_deal_balances(seller_id)` },
    { name: 'seller_deal_transactions', sql: `CREATE TABLE IF NOT EXISTS seller_deal_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      bucket TEXT NOT NULL,
      type TEXT NOT NULL,
      reference_id TEXT,
      memo TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'idx_seller_deal_tx_seller_created', sql: `CREATE INDEX IF NOT EXISTS idx_seller_deal_tx_seller_created ON seller_deal_transactions(seller_id, created_at DESC)` },
    { name: 'idx_seller_deal_tx_type', sql: `CREATE INDEX IF NOT EXISTS idx_seller_deal_tx_type ON seller_deal_transactions(type, created_at DESC)` },
    { name: 'voucher_orders', sql: `CREATE TABLE IF NOT EXISTS voucher_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      goods_code TEXT NOT NULL,
      goods_name TEXT NOT NULL,
      goods_image_url TEXT,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      total_amount INTEGER NOT NULL,
      recipient_phone TEXT NOT NULL,
      withholding_amount INTEGER NOT NULL DEFAULT 0,
      net_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      external_order_id TEXT,
      coupon_code TEXT,
      failure_reason TEXT,
      retry_count INTEGER DEFAULT 0,
      last_retry_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'idx_voucher_orders_seller', sql: `CREATE INDEX IF NOT EXISTS idx_voucher_orders_seller ON voucher_orders(seller_id, created_at DESC)` },
    { name: 'idx_voucher_orders_status', sql: `CREATE INDEX IF NOT EXISTS idx_voucher_orders_status ON voucher_orders(status, created_at DESC)` },
    { name: 'tax_withholding_log', sql: `CREATE TABLE IF NOT EXISTS tax_withholding_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      payout_year INTEGER NOT NULL,
      payout_month INTEGER NOT NULL,
      gross_amount INTEGER NOT NULL,
      withholding_rate REAL NOT NULL DEFAULT 8.8,
      withholding_amount INTEGER NOT NULL,
      net_amount INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT,
      ytd_gross_amount INTEGER NOT NULL,
      reportable INTEGER NOT NULL DEFAULT 1,
      reported_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'idx_tax_withholding_seller_year', sql: `CREATE INDEX IF NOT EXISTS idx_tax_withholding_seller_year ON tax_withholding_log(seller_id, payout_year, payout_month)` },
    { name: 'idx_tax_withholding_reportable', sql: `CREATE INDEX IF NOT EXISTS idx_tax_withholding_reportable ON tax_withholding_log(payout_year, reportable)` },
    // 🔐 2026-06-11 (머니 감사 Med-F): 이중 원천징수 race 차단 — 같은 정산 송금 재시도 멱등.
    { name: 'idx_tax_withholding_source_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_withholding_source_unique ON tax_withholding_log(source_type, source_id) WHERE source_id IS NOT NULL` },
    // 🔐 2026-06-11 (정합성 감사 — lazy DDL UNIQUE 드리프트): repair-schema 가 만드는 테이블의
    //   멱등 UNIQUE 누락분 보강. INSERT OR IGNORE / changes 검사가 의존하는 인덱스들 — 없으면
    //   동시 요청에서 쿠폰 반복claim·환불 이중적립·타임딜 이중claim·invite 이중보상.
    { name: 'idx_user_coupons_pair', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_coupons_pair ON user_coupons(user_id, coupon_id)` },
    { name: 'idx_community_gb_refunds_pair', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_community_gb_refunds_pair ON community_group_buy_refunds(group_id, user_id)` },
    // 🔐 2026-06-12 (커뮤니티 공구 4차 감사 #3, 머니룰 #3): join 의 INSERT OR IGNORE claim 이 의존 —
    //   없으면 동시 join 이중 보증금 차감. 기존 중복 행 존재 시 생성 실패 → 리포트로 발견 후 정리.
    { name: 'idx_cgb_members_pair', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_cgb_members_pair ON community_group_buy_members(group_buy_id, user_id)` },
    { name: 'idx_time_deal_claims_pair', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_time_deal_claims_pair ON time_deal_claims(deal_id, user_id)` },
    { name: 'idx_seller_follows_pair', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_follows_pair ON seller_follows(seller_id, user_id)` },
    { name: 'idx_invite_rewards_pair', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_rewards_pair ON invite_rewards(inviter_user_id, invited_user_id)` },
    // 🛡️ 2026-06-11 머니 감사: 주간 정산 cron 이중실행 시 (payee, 기간) 중복 pending payout 차단.
    { name: 'idx_payouts_period_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_period_unique ON payouts(payee_type, payee_id, period_start, period_end)` },
    // 🔐 2026-06-15 (링크샵 적립 머니룰 #3): affiliate_earnings 멱등 — referrer+order 당 1행만.
    //   기존 SELECT 체크만으론 동시요청 이중적립 race. INSERT OR IGNORE 가 이 인덱스에 의존.
    //   기존 중복 행 존재 시 생성 실패 → 리포트로 발견 후 정리(다른 _pair 인덱스와 동일 컨벤션).
    { name: 'idx_affiliate_earnings_referrer_order', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_earnings_referrer_order ON affiliate_earnings(referrer_id, order_id) WHERE order_id IS NOT NULL` },

    // 🏬 2026-06-09 도매몰 멀티-몰 테넌시 — 몰 설정 테이블 + 기본 몰(id=1) 시드.
    //   한 운영자가 카테고리별 분리 몰(식품/패션 등) 운영. 기본 몰 = 기존 유통스타트(slug='default', host=utongstart.com).
    //   🔒 INVARIANT: 행이 없을 때만 id=1 시드 → 단일 몰 환경은 항상 mall 1 = 오늘과 동일.
    { name: 'wholesale_malls', sql: `CREATE TABLE IF NOT EXISTS wholesale_malls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE,
      name TEXT,
      host TEXT,
      brand_name TEXT,
      brand_color TEXT,
      logo_url TEXT,
      deposit_account TEXT,
      commission_rate REAL,
      categories_json TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_wholesale_malls_host', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_malls_host ON wholesale_malls(host) WHERE host IS NOT NULL` },
    { name: 'idx_wholesale_malls_active', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_malls_active ON wholesale_malls(active)` },
    { name: 'seed: wholesale_malls default (id=1)', sql: `INSERT OR IGNORE INTO wholesale_malls (id, slug, name, host, brand_name, brand_color, active, created_at) VALUES (1, 'default', '유통스타트', 'utongstart.com', '유통스타트', '#1f2937', 1, datetime('now'))` },

    // 🏭 2026-06-09 도매몰 메인 리디자인 Wave 2 — 메인 배너 캐러셀(어드민 CRUD).
    { name: 'wholesale_banners', sql: `CREATE TABLE IF NOT EXISTS wholesale_banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      link TEXT,
      title TEXT,
      sort INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      start_at TEXT,
      end_at TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_wholesale_banners_active', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_banners_active ON wholesale_banners(active, sort, id)` },

    // 🏭 2026-06-09 도매몰 제안/신고 티켓(판매사→어드민). ⚠️ 기존 wholesale_proposals(어드민→판매사 상품제안)
    //   와 용도/스키마가 달라 별도 테이블명(wholesale_proposal_tickets) 사용 — 충돌 회피.
    { name: 'wholesale_proposal_tickets', sql: `CREATE TABLE IF NOT EXISTS wholesale_proposal_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'proposal',
      target TEXT,
      subject TEXT NOT NULL,
      body TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      admin_memo TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      resolved_at DATETIME
    )` },
    { name: 'idx_wholesale_proposal_tickets_seller', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_proposal_tickets_seller ON wholesale_proposal_tickets(seller_id, id DESC)` },
    { name: 'idx_wholesale_proposal_tickets_status', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_proposal_tickets_status ON wholesale_proposal_tickets(status, id DESC)` },

    // 🛡️ 2026-06-09: 어드민 단체메일 큐 (요청 안에서 발송 X → cron drainer + per-recipient 멱등).
    //   bulk_email_jobs = 작업 1행(필터/제목/본문/진행상황), bulk_email_job_recipients = 수신자별 행.
    //   recipient 행이 'pending' 일 때만 발송(CAS pending→sent) → cron 재실행이 중복발송 안 함.
    { name: 'bulk_email_jobs', sql: `CREATE TABLE IF NOT EXISTS bulk_email_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT,
      admin_email TEXT,
      filter_json TEXT,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total INTEGER NOT NULL DEFAULT 0,
      sent INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_bulk_email_jobs_status', sql: `CREATE INDEX IF NOT EXISTS idx_bulk_email_jobs_status ON bulk_email_jobs(status, id)` },
    { name: 'bulk_email_job_recipients', sql: `CREATE TABLE IF NOT EXISTS bulk_email_job_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      sent_at DATETIME
    )` },
    { name: 'idx_bulk_email_job_recipients_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_bulk_email_job_recipients_unique ON bulk_email_job_recipients(job_id, email)` },
    { name: 'idx_bulk_email_job_recipients_pending', sql: `CREATE INDEX IF NOT EXISTS idx_bulk_email_job_recipients_pending ON bulk_email_job_recipients(job_id, status)` },
  ];
  const tableResults: Array<{ name: string; status: 'ok' | 'error'; error?: string }> = [];
  for (const { name, sql } of tables) {
    try {
      await DB.prepare(sql).run();
      tableResults.push({ name, status: 'ok' });
    } catch (e: any) {
      const msg = String(e?.message || e);
      // 🛡️ 2026-06-18: 이미 있는 컬럼(duplicate)·한도 도달(too many columns)은 비-실패(이 단계 무동작 가능).
      if (/duplicate column|already exists|too many columns/i.test(msg)) {
        tableResults.push({ name, status: 'ok' });
      } else {
        tableResults.push({ name, status: 'error', error: msg.slice(0, 200) });
      }
    }
  }

  // 🛡️ 2026-06-10: 테이블 보장 후 컬럼/인덱스/백필 실행 (위 runColumnSteps 참조).
  await runColumnSteps();

  // 🛠️ 2026-06-17: admins.role 옛 CHECK(role IN ('admin','super_admin')) 가 제한역할(ops/cs/finance/
  //   viewer/wholesale) 생성을 막아 "새 관리자 추가 500" → 제약 있으면 안전 재빌드(원자 batch, 멱등).
  try {
    const adminsRole = await ensureAdminsRoleUnconstrained(DB);
    results.push({ desc: 'admins.role CHECK 재빌드', status: adminsRole === 'rebuilt' ? 'added' : adminsRole === 'error' ? 'error' : 'exists' });
  } catch (e) {
    results.push({ desc: 'admins.role CHECK 재빌드', status: 'error', error: String(e).slice(0, 200) });
  }

  // 🏭 2026-06-07: operation_guides CHECK 제약 확장 — guide_type 에 'wholesale' 추가.
  //   기존 프로덕션 테이블은 CHECK(guide_type IN ('admin','seller','agency')) 라서
  //   'wholesale' INSERT 가 거부됨. 표(컬럼/sql.text) 검사 후 'wholesale' 가
  //   미포함일 때만 테이블 재생성(rows 보존). 멱등 — 이미 포함이면 no-op.
  //   ※ 위 tables 루프가 fresh DB 에 신규 CHECK 로 테이블을 만들므로, 여기선
  //     이미 존재하는 구버전 테이블만 마이그레이션 대상.
  try {
    const meta = await DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='operation_guides'"
    ).first<{ sql: string }>();
    const ddl = meta?.sql || '';
    // CHECK 절이 있고 'wholesale' 가 빠진 경우에만 재생성.
    if (ddl && /guide_type/i.test(ddl) && /CHECK/i.test(ddl) && !/wholesale/i.test(ddl)) {
      // 외래키 없음(독립 테이블) → 안전하게 rename → 신규 생성 → copy → drop.
      await DB.prepare("ALTER TABLE operation_guides RENAME TO operation_guides_old").run();
      await DB.prepare(`CREATE TABLE operation_guides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guide_type TEXT NOT NULL CHECK(guide_type IN ('admin', 'seller', 'agency', 'wholesale')),
        section_key TEXT NOT NULL,
        section_icon TEXT,
        section_title TEXT NOT NULL,
        section_order INTEGER DEFAULT 0,
        content_md TEXT NOT NULL,
        updated_by INTEGER,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(guide_type, section_key)
      )`).run();
      await DB.prepare(`INSERT INTO operation_guides
        (id, guide_type, section_key, section_icon, section_title, section_order, content_md, updated_by, updated_at)
        SELECT id, guide_type, section_key, section_icon, section_title, section_order, content_md, updated_by, updated_at
        FROM operation_guides_old`).run();
      await DB.prepare("DROP TABLE operation_guides_old").run();
      tableResults.push({ name: 'operation_guides:check-migration', status: 'ok' });
    }
  } catch (e: any) {
    tableResults.push({ name: 'operation_guides:check-migration', status: 'error', error: String(e?.message || e).slice(0, 200) });
  }

  // 🏭 2026-06-12: dashboard_notifications CHECK 제약 확장 — recipient_type 에 'supplier' 추가.
  //   기존 프로덕션 테이블은 CHECK(IN ('admin','seller','agency')) 라서 제조사 알림(출금 승인/반려,
  //   신규 도매주문) INSERT 가 무음 실패하던 사고 수정. operation_guides CHECK 마이그레이션과 동일
  //   패턴(rename → 신규 CHECK 로 생성 → copy → drop). 멱등 — 이미 'supplier' 포함이면 no-op.
  try {
    const meta = await DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='dashboard_notifications'"
    ).first<{ sql: string }>();
    const ddl = meta?.sql || '';
    if (ddl && /recipient_type/i.test(ddl) && /CHECK/i.test(ddl) && !/supplier/i.test(ddl)) {
      await DB.prepare("ALTER TABLE dashboard_notifications RENAME TO dashboard_notifications_old").run();
      await DB.prepare(`CREATE TABLE dashboard_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_type TEXT NOT NULL CHECK (recipient_type IN ('admin', 'seller', 'agency', 'supplier')),
        recipient_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now'))
      )`).run();
      await DB.prepare(`INSERT INTO dashboard_notifications
        (id, recipient_type, recipient_id, type, title, message, link, is_read, created_at)
        SELECT id, recipient_type, recipient_id, type, title, message, link, is_read, created_at
        FROM dashboard_notifications_old`).run();
      await DB.prepare("DROP TABLE dashboard_notifications_old").run();
      await DB.prepare(
        "CREATE INDEX IF NOT EXISTS idx_dash_notif_recipient ON dashboard_notifications(recipient_type, recipient_id, is_read, created_at)"
      ).run();
      tableResults.push({ name: 'dashboard_notifications:check-migration', status: 'ok' });
    }
  } catch (e: any) {
    tableResults.push({ name: 'dashboard_notifications:check-migration', status: 'error', error: String(e?.message || e).slice(0, 200) });
  }

  // 🛡️ 2026-06-10 (교환권 500 사고 — D1 'too many columns in result set' 한도 100):
  //   넓은 테이블의 컬럼 수를 매 실행 보고 + 85 이상이면 경보. 한도 도달 전에 컬럼 다이어트/
  //   사이드테이블 분리를 결정할 수 있게 하는 조기 경보선. star-select 는 CI 가 별도 차단.
  const columnCounts: Record<string, number> = {};
  const columnWarnings: string[] = [];
  for (const tbl of ['products', 'users', 'sellers', 'orders', 'suppliers']) {
    try {
      const row = await DB.prepare(`SELECT COUNT(*) AS c FROM pragma_table_info('${tbl}')`).first<{ c: number }>();
      const cnt = Number(row?.c || 0);
      columnCounts[tbl] = cnt;
      if (cnt >= 85) columnWarnings.push(`⚠️ ${tbl} 컬럼 ${cnt}개 — D1 결과셋 한도(100) 임박. 컬럼 분리(사이드테이블) 검토 필요`);
    } catch { /* 테이블 없으면 skip */ }
  }

  return { columns: results, tables: tableResults, column_counts: columnCounts, column_warnings: columnWarnings };
}

// 🛡️ 2026-06-10 (드리프트 창 제거): 배포 파이프라인용 자동 트리거 — secret 헤더 인증.
//   "코드는 배포됐는데 스키마는 수동 버튼 대기" 가 '없던 에러' 류(no such column 등)의 구조적 원인.
//   REPAIR_SCHEMA_TOKEN(Cloudflare Variables) 미설정 시 403 fail-closed — 기존 admin 경로 불변.
repairSchemaRoutes.post('/api/_internal/repair-schema/auto', async (c) => {
  const expected = (c.env as { REPAIR_SCHEMA_TOKEN?: string }).REPAIR_SCHEMA_TOKEN
  const got = c.req.header('X-Repair-Token') || ''
  if (!expected || got !== expected) return c.json({ success: false, error: 'unauthorized' }, 403)
  const DB = (c.env as { DB?: D1Database }).DB
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500)
  const result = await runSchemaRepair(DB)
  const errs = result.columns.filter((r) => r.status === 'error').length
  return c.json({ success: true, errors: errs, warnings: result.column_warnings || [], counts: result.column_counts || {} })
})

// 🛡️ 2026-06-17 보안 PIN 잠금 복구(무로그인) — REPAIR_SCHEMA_TOKEN 인증. PIN 분실로 로그인 불가 시
//   CF env 토큰으로 해당 계정 PIN 해제(로그인 불가 상태에서도 복구). 해제 후 다음 로그인 시 재설정(must_set_pin).
repairSchemaRoutes.post('/api/_internal/reset-pin-token', async (c) => {
  const expected = (c.env as { REPAIR_SCHEMA_TOKEN?: string }).REPAIR_SCHEMA_TOKEN
  const got = c.req.header('X-Repair-Token') || ''
  if (!expected || got !== expected) return c.json({ success: false, error: 'unauthorized' }, 403)
  const DB = (c.env as { DB?: D1Database }).DB
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500)
  let email = ''
  try { const b = await c.req.json<{ email?: string }>(); email = String(b?.email || '').trim().toLowerCase() } catch { /* query fallback */ }
  if (!email) email = String(c.req.query('email') || '').trim().toLowerCase()
  if (!email) return c.json({ success: false, error: 'email 필요' }, 400)
  const r = await DB.prepare("UPDATE admins SET login_pin_hash = NULL WHERE lower(email) = ?").bind(email).run().catch(() => null)
  return c.json({ success: true, email, reset: r?.meta?.changes ?? 0, message: 'PIN 해제됨 — 다음 로그인 시 재설정' })
})

// 🛡️ 2026-06-17 경량 부트스트랩 — 전체 repair-schema(수백 마이그레이션 → 524 타임아웃) 대신
//   슈퍼 어드민 복구 2줄만 빠르게 실행. admin 토큰만 있으면 호출 가능(내부 경로).
repairSchemaRoutes.get('/api/_internal/bootstrap-super', requireAdmin(), async (c) => {
  const DB = (c.env as { DB: D1Database }).DB;
  const out: { byEmail: number; oldestPromoted?: number } = { byEmail: 0 };
  try {
    const r1 = await DB.prepare("UPDATE admins SET role = 'super_admin' WHERE lower(email) = 'tobe2111@naver.com'").run();
    out.byEmail = r1.meta?.changes ?? 0;
    const hasSuper = await DB.prepare("SELECT COUNT(*) AS c FROM admins WHERE role = 'super_admin'").first<{ c: number }>();
    if ((hasSuper?.c ?? 0) === 0) {
      const r2 = await DB.prepare("UPDATE admins SET role = 'super_admin' WHERE id = (SELECT id FROM admins ORDER BY id ASC LIMIT 1)").run();
      out.oldestPromoted = r2.meta?.changes ?? 0;
    }
    const supers = await DB.prepare("SELECT id, email, name, role FROM admins WHERE role = 'super_admin'").all();
    return c.json({ success: true, ...out, super_admins: supers.results ?? [] });
  } catch (err) {
    return c.json({ success: false, error: '부트스트랩 실패', _debug: String(err).slice(0, 200) }, 500);
  }
});

// 🛡️ 2026-06-17 보안 PIN 잠금 복구 — PIN 분실 시 해당 계정 PIN 해제(재설정 유도). 슈퍼관리자만.
repairSchemaRoutes.get('/api/_internal/reset-pin', requireAdmin(), async (c) => {
  const DB = (c.env as { DB: D1Database }).DB;
  try {
    const caller = ((c as unknown as { get: (k: string) => unknown }).get('user')) as { id?: string | number } | undefined;
    const me = await DB.prepare('SELECT role FROM admins WHERE id = ?').bind(caller?.id).first<{ role: string }>().catch(() => null);
    if (!me || me.role !== 'super_admin') return c.json({ success: false, error: '슈퍼관리자만 가능합니다' }, 403);
    const email = String(c.req.query('email') || '').trim().toLowerCase();
    if (!email) return c.json({ success: false, error: 'email 쿼리 필요' }, 400);
    const r = await DB.prepare("UPDATE admins SET login_pin_hash = NULL WHERE lower(email) = ?").bind(email).run().catch(() => null);
    return c.json({ success: true, email, reset: r?.meta?.changes ?? 0, message: 'PIN 해제됨 — 해당 계정 다음 로그인 시 재설정 필요' });
  } catch (err) {
    return c.json({ success: false, error: 'PIN 해제 실패', _debug: String(err).slice(0, 150) }, 500);
  }
});

// 🚚 2026-06-18 (대표 신고 — 전체 repair-schema 524/67오류): 진단 + 최근 additive 스키마만 빠르게.
//   ① PRAGMA 로 핵심 컬럼 실제 존재 여부 진단(ground truth) ② users 테이블(한도 여유)에 마퀴 컬럼/alias
//   안전 추가 ③ sellers(컬럼 한도 도달)는 ALTER 불가라 '존재 여부만' 보고. 전부 idempotent.
repairSchemaRoutes.get('/api/_internal/repair-schema-quick', requireAdmin(), async (c) => {
  const DB = (c.env as { DB?: D1Database }).DB;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);
  const ran: string[] = [];
  const errors: { step: string; error: string }[] = [];
  const colsOf = async (table: string): Promise<Set<string>> => {
    try {
      const r = await DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      return new Set((r.results || []).map((x) => x.name));
    } catch { return new Set(); }
  };
  const userCols = await colsOf('users');
  const sellerCols = await colsOf('sellers');
  // 진단 — 기능이 의존하는 컬럼이 실제로 있는지 (ground truth).
  const present = {
    'users.linkshop_headline': userCols.has('linkshop_headline'),
    'users.linkshop_accent': userCols.has('linkshop_accent'),
    'sellers.base_shipping_fee': sellerCols.has('base_shipping_fee'),
    'sellers.free_shipping_threshold': sellerCols.has('free_shipping_threshold'),
    'sellers.shipping_fee': sellerCols.has('shipping_fee'),
    'sellers.banner_url': sellerCols.has('banner_url'),
  };
  const run = async (step: string, sql: string) => {
    try { await DB.prepare(sql).run(); ran.push(step); }
    catch (e) {
      const m = String((e as Error)?.message || '');
      if (/duplicate column|already exists|too many columns/i.test(m)) ran.push(`${step} (skip: ${/too many/i.test(m) ? 'table maxed' : 'exists'})`);
      else errors.push({ step, error: m.slice(0, 160) });
    }
  };
  // users 는 컬럼 한도 여유 — 마퀴 헤드라인/액센트 안전 추가.
  if (!present['users.linkshop_headline']) await run('users.linkshop_headline', 'ALTER TABLE users ADD COLUMN linkshop_headline TEXT');
  if (!present['users.linkshop_accent']) await run('users.linkshop_accent', 'ALTER TABLE users ADD COLUMN linkshop_accent TEXT');
  // 핸들 변경 alias (리다이렉트) + user2→jiwon 1회 백필.
  await run('user_handle_aliases', `CREATE TABLE IF NOT EXISTS user_handle_aliases (
    alias TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')))`);
  await run('backfill user2->jiwon', `INSERT OR IGNORE INTO user_handle_aliases (alias, user_id)
    SELECT 'user2', id FROM users WHERE handle = 'jiwon' LIMIT 1`);
  // sellers 는 한도 도달 가능 — 없을 때만 추가 시도(실패해도 무해, 배송비는 shipping_fee 폴백으로 동작).
  if (!present['sellers.base_shipping_fee']) await run('sellers.base_shipping_fee', 'ALTER TABLE sellers ADD COLUMN base_shipping_fee INTEGER DEFAULT 0');
  if (!present['sellers.free_shipping_threshold']) await run('sellers.free_shipping_threshold', 'ALTER TABLE sellers ADD COLUMN free_shipping_threshold INTEGER');
  return c.json({ success: errors.length === 0, present, ran, errors });
});

// HTTP wrapper — admin auth + JSON response.
repairSchemaRoutes.get('/api/_internal/repair-schema', requireAdmin(), async (c) => {
  const env = c.env as any;
  const DB = env.DB as D1Database;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);
  const result = await runSchemaRepair(DB);
  return c.json({ success: true, ...result });
});

export { repairSchemaRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureMigrationTrackingTable = new WeakSet<object>()
