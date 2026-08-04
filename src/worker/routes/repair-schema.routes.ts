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
// 컬럼 ALTER 목록은 데이터라 분리했다 — 이 파일은 *실행 로직*만 갖는다(2026-08-01).
import { COLUMN_REPAIRS, type ColumnRepair } from './repair-schema/column-repairs';

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

  const stmts: ColumnRepair[] = COLUMN_REPAIRS;

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
    // 2026-08-01: is_visible 은 이전에 is_hidden 이었다 — 현실과 반대라 교정(경위: admin-moderation.routes.ts).
    { name: 'product_reviews', sql: `CREATE TABLE IF NOT EXISTS product_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, user_id INTEGER NOT NULL, order_id INTEGER, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), title TEXT, content TEXT, images TEXT DEFAULT '[]', is_visible INTEGER DEFAULT 1, is_sponsored INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)` },
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
    // 📜 2026-07-05 약관 동의 로그 (누가·언제·몇 버전) — worker/utils/terms-agreements.ts SSOT 미러.
    { name: 'terms_agreements', sql: `CREATE TABLE IF NOT EXISTS terms_agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      doc_version TEXT NOT NULL,
      agreed INTEGER NOT NULL DEFAULT 1,
      agreed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(subject_type, subject_id, doc_type, doc_version)
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
    // 🔔 2026-07-01: 찜 재입고/가격인하 알림 dedup(멱등) — wishlist-notify cron 이 self-ensure 하지만
    //   fresh/repaired DB 보장 위해 등록. user_id TEXT(= wishlists.user_id 저장형).
    { name: 'wishlist_stock_notifications', sql: `CREATE TABLE IF NOT EXISTS wishlist_stock_notifications (
      user_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, product_id)
    )` },
    { name: 'wishlist_price_notifications', sql: `CREATE TABLE IF NOT EXISTS wishlist_price_notifications (
      user_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      last_price INTEGER,
      notified_at DATETIME,
      PRIMARY KEY (user_id, product_id)
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
      manually_edited INTEGER DEFAULT 0,
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
    // 🏠 2026-08-04 홈 쇼케이스 — 라우트 lazy ALTER 는 호출돼야 돌고, 컬럼이 없으면 어드민 저장이 조용히 실패한다. ⚠️ banner_slot 에 DEFAULT 금지(SQLite 는 기존 행에도 적용 → 옛 배너가 저절로 홈에 뜬다, 실사고).
    { name: 'banners.banner_slot', sql: 'ALTER TABLE banners ADD COLUMN banner_slot TEXT' },
    { name: 'banners.video_url', sql: 'ALTER TABLE banners ADD COLUMN video_url TEXT' },
    { name: 'homepage_sections.source', sql: "ALTER TABLE homepage_sections ADD COLUMN source TEXT DEFAULT 'manual'" },
    { name: 'homepage_sections.source_value', sql: 'ALTER TABLE homepage_sections ADD COLUMN source_value TEXT' },
    { name: 'homepage_sections.limit_count', sql: 'ALTER TABLE homepage_sections ADD COLUMN limit_count INTEGER DEFAULT 4' },
    { name: 'homepage_sections.more_href', sql: 'ALTER TABLE homepage_sections ADD COLUMN more_href TEXT' },
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
    //   에이전시가 입점시킨 가게 (sellers.introduced_by_agency_id) 의 모든 이용권 매출 →
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
    // 🎫 2026-06-26: order_item 당 access 1행 — INSERT OR IGNORE 가 confirm+webhook 양 경로에서 진짜 멱등이 되도록
    //   UNIQUE. (best-effort — 기존 중복행 있으면 생성 실패하나 타 repair 안 깨뜨림; 그 경우 status CAS 가 단일실행 보장.)
    { name: 'idx_dpa_order_item_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_dpa_order_item_unique ON digital_product_access(order_item_id)` },
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
    // 기본 등급 시드 (어드민이 /admin 에서 마진율 편집). 고등급(A)일수록 큰 보장마진(= 낮은 공급가). Basic/Standard/Premium (2026-06-29 영문화).
    { name: 'seed: distributor_grades', sql: `INSERT OR IGNORE INTO distributor_grades (grade, label, margin_pct, sort_order, is_special) VALUES
      ('A','Premium',38,1,0),
      ('B','Standard',30,2,0),
      ('C','Basic',15,3,0),
      ('D','D등급',8,4,0),
      ('OEM','OEM',40,5,0),
      ('SPECIAL','특별할인(기간한정)',45,9,1)` },
    // 🏭 2026-06-29 (등급명 영문화) — 기존 DB(옛 라벨 프리미엄/프로/일반) relabel. 멱등(영문이면 no-op),
    //   label 만 변경(마진/정렬 등 가격 요소 불변). distributor-admin/helpers v3 와 이중 보장.
    { name: 'relabel: distributor_grades A→Premium', sql: "UPDATE distributor_grades SET label = 'Premium' WHERE grade = 'A' AND label IN ('프리미엄','프리미엄 등급')" },
    { name: 'relabel: distributor_grades B→Standard', sql: "UPDATE distributor_grades SET label = 'Standard' WHERE grade = 'B' AND label IN ('프로','프로 등급')" },
    { name: 'relabel: distributor_grades C→Basic', sql: "UPDATE distributor_grades SET label = 'Basic' WHERE grade = 'C' AND label IN ('일반','일반 등급')" },

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
    // 🧾 2026-07-01: 소비자 정산 매입세금계산서 역발행(셀러→플랫폼). settlement-tax-invoices.ts.
    //   유어딜이 사업자 유저 셀러 정산 지급 시 초안 자동생성 → 셀러 승인 → provider(유니포스트) 발행.
    //   ⚠️ 도매(wholesale_tax_invoices)와 별개 — 소비자(유어딜 공구) 전용 서비스 분리.
    { name: 'settlement_tax_invoices', sql: `CREATE TABLE IF NOT EXISTS settlement_tax_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      settlement_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      supply_amount INTEGER NOT NULL DEFAULT 0,
      vat_amount INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0,
      supplier_biz_no TEXT,
      period TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      provider TEXT,
      provider_ref TEXT,
      nts_confirm_num TEXT,
      note TEXT,
      requested_at DATETIME,
      approved_at DATETIME,
      issued_at DATETIME,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_settlement_tax_inv_settlement', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_tax_inv_settlement ON settlement_tax_invoices(settlement_id)` },
    { name: 'idx_settlement_tax_inv_seller', sql: `CREATE INDEX IF NOT EXISTS idx_settlement_tax_inv_seller ON settlement_tax_invoices(seller_id, created_at DESC)` },
    { name: 'idx_settlement_tax_inv_status', sql: `CREATE INDEX IF NOT EXISTS idx_settlement_tax_inv_status ON settlement_tax_invoices(status, created_at DESC)` },
    // seller_business_info(대표자명/업태/종목/주소 — migration 0012) 역발행 표기용. 미존재 환경 대비 보강.
    { name: 'seller_business_info', sql: `CREATE TABLE IF NOT EXISTS seller_business_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      business_number TEXT,
      business_name TEXT,
      ceo_name TEXT,
      business_type TEXT,
      business_category TEXT,
      postal_code TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      is_verified INTEGER DEFAULT 0,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'idx_seller_business_info_seller', sql: `CREATE INDEX IF NOT EXISTS idx_seller_business_info_seller ON seller_business_info(seller_id)` },
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
      requires_license INTEGER DEFAULT 0,
      license_label TEXT,
      features_json TEXT,
      company_json TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_wholesale_malls_host', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_malls_host ON wholesale_malls(host) WHERE host IS NOT NULL` },
    { name: 'idx_wholesale_malls_active', sql: `CREATE INDEX IF NOT EXISTS idx_wholesale_malls_active ON wholesale_malls(active)` },
    { name: 'seed: wholesale_malls default (id=1)', sql: `INSERT OR IGNORE INTO wholesale_malls (id, slug, name, host, brand_name, brand_color, active, created_at) VALUES (1, 'default', '유통스타트', 'utongstart.com', '유통스타트', '#1f2937', 1, datetime('now'))` },
    // 🏥 2026-07-03 (의료용품 도매몰): 메디스타트(id=2, slug='medi') 시드 — slug UNIQUE 로 멱등, host 없음(?mall=medi 접근).
    { name: 'seed: wholesale_malls medi (id=2)', sql: `INSERT OR IGNORE INTO wholesale_malls (id, slug, name, host, brand_name, brand_color, categories_json, requires_license, license_label, active, created_at) VALUES (2, 'medi', '메디스타트', NULL, '메디스타트', '#0ea5e9', '[{"id":"medical_device","label":"의료기기"},{"id":"hygiene","label":"위생용품"},{"id":"care","label":"간병용품"},{"id":"health","label":"건강용품"}]', 1, '의료기기 판매업 신고번호', 1, datetime('now'))` },
    // 🏥 2026-07-03 규제 몰 인허가(신고번호) 사이드 테이블 — owner_type='supplier'|'distributor', owner 당 1행.
    { name: 'wholesale_licenses', sql: `CREATE TABLE IF NOT EXISTS wholesale_licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_type TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      mall_id INTEGER NOT NULL DEFAULT 1,
      permit_no TEXT,
      permit_url TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )` },
    { name: 'idx_wholesale_license_owner', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesale_license_owner ON wholesale_licenses(owner_type, owner_id)` },

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
        manually_edited INTEGER DEFAULT 0,
        updated_by INTEGER,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(guide_type, section_key)
      )`).run();
      // manually_edited 는 위 runColumnSteps 의 ALTER 가 old 테이블에 이미 추가함(같은 repair 실행 내 선행) → 보존 copy.
      await DB.prepare(`INSERT INTO operation_guides
        (id, guide_type, section_key, section_icon, section_title, section_order, content_md, manually_edited, updated_by, updated_at)
        SELECT id, guide_type, section_key, section_icon, section_title, section_order, content_md, COALESCE(manually_edited, 0), updated_by, updated_at
        FROM operation_guides_old`).run();
      await DB.prepare("DROP TABLE operation_guides_old").run();
      tableResults.push({ name: 'operation_guides:check-migration', status: 'ok' });
    }
  } catch (e: any) {
    tableResults.push({ name: 'operation_guides:check-migration', status: 'error', error: String(e?.message || e).slice(0, 200) });
  }

  // 🔔 2026-07-01: 알림 기본 테이블 보장(canonical). 이전엔 repair-schema 에 인덱스만 있고
  //   CREATE TABLE 이 없어, 마이그레이션(CI 미작동) 또는 lazy 인라인 생성에만 의존했음(fresh/
  //   repaired DB 에서 push_subscriptions 부재 → 웹푸시 전면 no-op 등의 리스크). 특히
  //   notifications.user_type 을 NOT NULL DEFAULT 'user' 로 통일 — user_type 없이 INSERT 하는
  //   소비자 알림이 조용히 실패하지 않게 함. 모두 IF NOT EXISTS(기존 테이블 불변).
  for (const t of [
    { name: 'notifications', sql: `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        user_type TEXT NOT NULL DEFAULT 'user',
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME
      )` },
    { name: 'user_notifications', sql: `CREATE TABLE IF NOT EXISTS user_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { name: 'agency_notifications', sql: `CREATE TABLE IF NOT EXISTS agency_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { name: 'push_subscriptions', sql: `CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_type TEXT NOT NULL DEFAULT 'user',
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
  ]) {
    try {
      await DB.prepare(t.sql).run();
      tableResults.push({ name: `${t.name}:ensure`, status: 'ok' });
    } catch (e: any) {
      tableResults.push({ name: `${t.name}:ensure`, status: 'error', error: String(e?.message || e).slice(0, 200) });
    }
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

// 🔧 2026-07-13 (데이터 감사 3단계): off-live user_id 이력 backfill (firebase_uid → 숫자 users.id).
//   GET(또는 apply 미지정)=dry-run 카운트만. apply 실행은 POST + body {confirm:true}. 멱등·admin 전용.
//   live(카카오)=대상 0(무동작). user_points 충돌(숫자 잔액행 이미 존재)은 건드리지 않고 conflict 보고.
repairSchemaRoutes.get('/api/_internal/backfill-user-id', requireAdmin(), async (c) => {
  const DB = (c.env as { DB?: D1Database }).DB;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);
  const { backfillUserIdMapping } = await import('../utils/user-id-backfill');
  const result = await backfillUserIdMapping(DB, false); // dry-run
  return c.json({ success: true, dry_run: true, ...result });
});

repairSchemaRoutes.post('/api/_internal/backfill-user-id', requireAdmin(), async (c) => {
  const DB = (c.env as { DB?: D1Database }).DB;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);
  const body = await c.req.json<{ confirm?: boolean }>().catch(() => ({} as { confirm?: boolean }));
  const apply = body.confirm === true;
  const { backfillUserIdMapping } = await import('../utils/user-id-backfill');
  const result = await backfillUserIdMapping(DB, apply);
  return c.json({ success: true, dry_run: !apply, ...result });
});

export { repairSchemaRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureMigrationTrackingTable = new WeakSet<object>()
