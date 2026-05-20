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

repairSchemaRoutes.get('/api/_internal/repair-schema', requireAdmin(), async (c) => {
  const env = c.env as any;
  const DB = env.DB as D1Database;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);
  await ensureMigrationTrackingTable(DB);

  const stmts: Array<{ desc: string; sql: string }> = [
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

    // ── admins ─────────────────────────────────────
    { desc: 'admins.role', sql: "ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'admin'" },
    { desc: 'admins.is_active', sql: "ALTER TABLE admins ADD COLUMN is_active INTEGER DEFAULT 1" },
    { desc: 'admins.last_login_at', sql: "ALTER TABLE admins ADD COLUMN last_login_at TEXT" },

    // ── users (CRITICAL — 감사에서 발견) ─────────────
    { desc: 'users.password_hash', sql: "ALTER TABLE users ADD COLUMN password_hash TEXT" },
    { desc: 'users.last_login_at', sql: "ALTER TABLE users ADD COLUMN last_login_at TEXT" },
    { desc: 'users.firebase_uid', sql: "ALTER TABLE users ADD COLUMN firebase_uid TEXT" },
    { desc: 'users.user_type', sql: "ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'buyer'" },
    { desc: 'users.kakao_access_token', sql: "ALTER TABLE users ADD COLUMN kakao_access_token TEXT" },
    { desc: 'users.kakao_refresh_token', sql: "ALTER TABLE users ADD COLUMN kakao_refresh_token TEXT" },
    { desc: 'users.profile_image', sql: "ALTER TABLE users ADD COLUMN profile_image TEXT" },

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
    { desc: 'live_stream_views.last_heartbeat', sql: "ALTER TABLE live_stream_views ADD COLUMN last_heartbeat TEXT" },
    { desc: 'idx_lsv_stream_session', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_lsv_stream_session ON live_stream_views(live_stream_id, session_id)" },
    { desc: 'idx_lsv_stream_heartbeat', sql: "CREATE INDEX IF NOT EXISTS idx_lsv_stream_heartbeat ON live_stream_views(live_stream_id, last_heartbeat, left_at)" },

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
    // 🛡️ 2026-05-16: 인플루언서 정산 인프라 (migration 0247)
    { desc: 'sellers.marketing_enabled', sql: "ALTER TABLE sellers ADD COLUMN marketing_enabled INTEGER DEFAULT 1" },
    { desc: 'products.referral_disabled', sql: "ALTER TABLE products ADD COLUMN referral_disabled INTEGER DEFAULT 0" },
    // 🛡️ 2026-05-20: migration 0271 — 상품별 referral on/off + rate override.
    { desc: 'products.referral_enabled', sql: "ALTER TABLE products ADD COLUMN referral_enabled INTEGER DEFAULT 1" },
    { desc: 'products.referral_commission_rate', sql: "ALTER TABLE products ADD COLUMN referral_commission_rate REAL" },
    // 🛡️ 2026-05-20: migration 0272 — sellers.seller_type / can_broadcast (D 공동구매 3자 분배).
    { desc: 'sellers.can_broadcast', sql: "ALTER TABLE sellers ADD COLUMN can_broadcast INTEGER DEFAULT 1" },
    { desc: 'sellers.contact_name', sql: "ALTER TABLE sellers ADD COLUMN contact_name TEXT" },
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
    // 🛡️ 2026-05-16: 인플 ranking 공개 여부 (default 1 = 공개)
    { desc: 'influencer_balances.ranking_public', sql: "ALTER TABLE influencer_balances ADD COLUMN ranking_public INTEGER DEFAULT 1" },
    // 🛡️ 2026-05-16: sellers 신규 컬럼 보강 — production /api/sellers/:id/public 500 fix
    { desc: 'sellers.banner_url', sql: "ALTER TABLE sellers ADD COLUMN banner_url TEXT" },
    { desc: 'sellers.brand_color', sql: "ALTER TABLE sellers ADD COLUMN brand_color TEXT" },
    { desc: 'sellers.external_live_tiktok', sql: "ALTER TABLE sellers ADD COLUMN external_live_tiktok TEXT" },
    { desc: 'sellers.external_live_instagram', sql: "ALTER TABLE sellers ADD COLUMN external_live_instagram TEXT" },
    { desc: 'sellers.external_live_facebook', sql: "ALTER TABLE sellers ADD COLUMN external_live_facebook TEXT" },
    { desc: 'sellers.kakao_chat_url', sql: "ALTER TABLE sellers ADD COLUMN kakao_chat_url TEXT" },
    { desc: 'sellers.representative_name', sql: "ALTER TABLE sellers ADD COLUMN representative_name TEXT" },
    { desc: 'sellers.first_voucher_notified', sql: "ALTER TABLE sellers ADD COLUMN first_voucher_notified INTEGER DEFAULT 0" },
    { desc: 'influencer_balances.payout_method', sql: "ALTER TABLE influencer_balances ADD COLUMN payout_method TEXT DEFAULT 'cash'" },
  ];

  const results: Array<{ desc: string; status: 'added' | 'exists' | 'error'; error?: string }> = [];
  for (const { desc, sql } of stmts) {
    try {
      await DB.prepare(sql).run();
      results.push({ desc, status: 'added' });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/duplicate column|already exists/i.test(msg)) {
        results.push({ desc, status: 'exists' });
      } else {
        results.push({ desc, status: 'error', error: msg.slice(0, 200) });
      }
    }
  }

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
      guide_type TEXT NOT NULL CHECK(guide_type IN ('admin', 'seller', 'agency')),
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
  ];
  const tableResults: Array<{ name: string; status: 'ok' | 'error'; error?: string }> = [];
  for (const { name, sql } of tables) {
    try {
      await DB.prepare(sql).run();
      tableResults.push({ name, status: 'ok' });
    } catch (e: any) {
      tableResults.push({ name, status: 'error', error: String(e?.message || e).slice(0, 200) });
    }
  }

  return c.json({ success: true, columns: results, tables: tableResults });
});

export { repairSchemaRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureMigrationTrackingTable = new WeakSet<object>()
