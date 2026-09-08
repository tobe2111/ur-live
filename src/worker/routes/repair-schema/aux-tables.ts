/* file-size-ok — 순수 데이터 매니페스트(사유는 아래 "왜 이 파일도 600줄 캡을 면제하나").
   ⚠️ 이 표식은 파일 첫 8줄 안에 있어야 가드가 읽는다. 위로 뭔가 끼워 넣지 말 것. */
/**
 * 🗂️ 보조 테이블 복구 정의 (repair-schema.routes.ts 에서 추출 — 2026-09-07)
 *
 * 이 파일의 형제(`column-repairs` · `admin-tables` · `index-repairs`)와 같은 이유로 나눴다:
 * **라우트 파일은 실행 로직만 갖는다**(그 파일 헤더가 스스로 밝힌 설계다). 테이블 정의는
 * 데이터라 여기 둔다 — 그래야 새 테이블이 늘어도 라우트 파일이 god 파일로 자라지 않는다.
 *
 * ⚠️ 이 레포는 **마이그레이션 CI 가 동작하지 않는다**(TECHNICAL_DEBT — D1 권한 없음).
 *    마이그레이션 파일에만 있는 테이블은 prod 에 없을 수 있고, 그걸 쓰는 코드는 try-catch 안에서
 *    **조용히 실패**한다. 여기 등록해야 실제로 존재한다.
 *
 * ⚠️ 순수 데이터만 둔다 — 실행 순서·다른 목록과의 합성(`...ADMIN_REPAIRS`)·에러 처리는 전부
 *    라우트 쪽 로직이다. 처음 추출할 때 그 합성까지 가져왔다가 순환 의존으로 타입 에러가 났다.
 *
 * ## file-size-ok — 왜 이 파일도 600줄 캡을 면제하나
 *
 * 형제 `column-repairs.ts` 와 **같은 사유**다(그 파일 헤더에 자세히 적혀 있다). 요약하면:
 * 래칫이 막으려는 것은 로직이 쌓여 읽을 수 없게 된 god 파일인데, 이 파일은 **분기 0 · 함수 0**
 * 인 append-only DDL 목록이고 길이가 곧 "우리 스키마에 테이블이 이만큼 있다"는 사실이다.
 * 도메인별로 쪼개면(소비자/도매/유어애즈) 실행 순서가 흩어지고, 새 테이블을 어느 파일에 넣을지
 * 매번 판단해야 해서 오히려 드리프트가 는다.
 *
 * 🔴 **이 면제는 데이터에만 해당한다.** 여기에 `if` 하나라도 들어오면 그 순간 면제 사유가 사라진다.
 */

export const AUX_TABLE_REPAIRS: Array<{ name: string; sql: string }> = [
    // 🎬 2026-09-07 유어쇼츠 — 마이그레이션 러너가 CI 에서 못 도니 여기서 보장한다.
    { name: 'home_shorts', sql: `CREATE TABLE IF NOT EXISTS home_shorts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL UNIQUE,
      title TEXT,
      channel TEXT,
      thumb_url TEXT,
      product_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'manual',
      duration_sec INTEGER,
      consent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )` },
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
    // 📥 2026-09-08 결재함 답 우편함 — worker/utils/decision-answers.ts SSOT 미러.
    { name: 'decision_answers', sql: `CREATE TABLE IF NOT EXISTS decision_answers (
      slug TEXT PRIMARY KEY,
      answer TEXT NOT NULL,
      answered_by TEXT,
      answered_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      synced_ref TEXT
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
    // 🤝 2026-09-08 손바뀜 마감 — 이 행이 마감인지(kind) + 만들 때 주인이 누구였는지(payee_user_id).
    //   취소로 돈이 되살아나 **새 주인**에게 가는 것을 막는 게이트가 이 둘을 읽는다.
    { name: 'payouts.kind', sql: 'ALTER TABLE payouts ADD COLUMN kind TEXT' },
    { name: 'payouts.payee_user_id', sql: 'ALTER TABLE payouts ADD COLUMN payee_user_id INTEGER' },
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

    // ── 큐레이터 유어샵 (migration 0278, 2026-05-25) ─────────
    { name: 'idx_users_handle_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_unique ON users(handle) WHERE handle IS NOT NULL` },
    // 🧭 2026-06-10 (사용자 신고 — 유어샵 영구 슬로우패스): 레거시 generic/예약 핸들('user' 등, 한글 닉네임
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
    // 🔐 2026-06-15 (유어샵 적립 머니룰 #3): affiliate_earnings 멱등 — referrer+order 당 1행만.
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
