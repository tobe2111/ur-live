/* file-size-ok — 순수 데이터 매니페스트(사유는 아래 "왜 이 파일만 600줄 캡을 면제하나").
   ⚠️ 이 표식은 파일 첫 8줄 안에 있어야 가드가 읽는다. 위로 뭔가 끼워 넣지 말 것. */
/**
 * 🧱 스키마 자가치유 — **컬럼 ALTER 목록**(`repair-schema.routes.ts` 에서 추출, 2026-08-01).
 *
 * 옮긴 이유: 이 파일은 성격상 **컬럼이 늘 때마다 자란다**(그게 존재 이유다). 라우트 본문과 한 파일에
 * 있으면 파일 크기 래칫이 매번 걸리고, 그때마다 rebaseline 하면 래칫이 무의미해진다.
 * 그래서 *자라는 데이터*와 *자라지 않는 로직*을 갈랐다.
 *
 * ⚠️ 순수 데이터만 둔다 — 실행 순서·`requiresTable` 가드·에러 처리는 전부 라우트 쪽 로직이다.
 *    여기에 로직을 넣으면 가른 의미가 없어진다.
 *
 * ## file-size-ok — 왜 이 파일만 600줄 캡을 면제하나
 *
 * 래칫이 막으려는 것은 **god 파일**, 즉 "일단 여기에 한 블록 더" 로 로직이 쌓여 읽을 수 없게 된
 * 페이지/라우트다. 이 파일은 그 종류가 아니다 — **분기 0, 함수 0, 항목당 정확히 한 줄**인
 * append-only DDL 목록이고, 길이가 곧 "우리 스키마에 컬럼이 이만큼 있다"는 사실이다.
 *
 * 대안을 실제로 검토했고 둘 다 더 나빴다:
 *   ① **종류별 분할**(ALTER / CREATE INDEX) — 실행 순서가 바뀐다. 인덱스가 그 컬럼의 ALTER 보다
 *      먼저/나중에 도는 문제는 결과적으로 안전한 방향일 수 있지만, **머니 인접 경로의 DDL 순서를
 *      린트를 만족시키려고 조용히 바꾸는 것**은 하지 않는다.
 *   ② **위치별 반토막**(partA/partB) — 순서는 보존되지만 경계에 의미가 없다. 린트는 통과하고
 *      읽는 사람은 손해 본다. 그건 고친 게 아니라 숨긴 것이다.
 *
 * 🔑 **이 면제가 무효가 되는 조건**: 여기에 `if`·루프·헬퍼 함수 같은 **로직이 한 줄이라도 들어오면**
 *    더 이상 데이터 매니페스트가 아니다. 그때는 면제를 떼고 진짜로 분리해야 한다.
 */
export interface ColumnRepair {
  desc: string
  sql: string
  /** 이 테이블이 없으면 조용히 스킵(생성 루트가 없는 선택 기능 테이블). */
  requiresTable?: string
}

export const COLUMN_REPAIRS: ColumnRepair[] = [
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
    // 🛡️ 2026-07-05: 소프트 삭제 컬럼 — 목록 제외/로그인 차단 필터가 참조(admin-accounts delete).
    { desc: 'admins.status', sql: "ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'active'" },
    { desc: 'admins.deleted_at', sql: "ALTER TABLE admins ADD COLUMN deleted_at DATETIME" },
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
    // 🛡️ 2026-05-25 (migration 0278): 큐레이터 유어샵 — handle / bio / theme
    { desc: 'users.handle', sql: "ALTER TABLE users ADD COLUMN handle TEXT" },
    { desc: 'users.bio', sql: "ALTER TABLE users ADD COLUMN bio TEXT" },
    // 🖼️ 2026-07-01 (대표 — 유어샵 판매자 정보 편집): 통신판매업신고번호. sellers 는 100컬럼 한도(예산제)라
    //   side table(seller_business_info)에 저장 — 공개 응답은 seller.routes 가 additive enrich.
    { desc: 'seller_business_info.mail_order_number', sql: "ALTER TABLE seller_business_info ADD COLUMN mail_order_number TEXT" },
    // 🔗 2026-07-01 (대표 결정): users.linkshop_theme 필드 제거 — 유어샵은 방문자 전역 테마를 따름(죽은 필드).
    //   기존 DB 컬럼은 D1 DROP 위험이라 방치(무해). 신규 복구 대상에서 제외.
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
    // 🔔 2026-07-01: 레거시 notifications 테이블 인덱스(마이그레이션에만 있던 것 — repair-schema 로 이관).
    //   소비자 벨/목록(GET /api/social/notifications, unread-count)이 user_type+user_id 로 조회 → 풀스캔 방지.
    { desc: 'idx_notifications_user', sql: "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_type, user_id, is_read)" },
    { desc: 'idx_notifications_created', sql: "CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC)" },
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
    // 📜 2026-07-05: 약관 v1.0 시행 — 가입 시 약관 동의 기록 (terms-consent.ts ensureTermsConsents 와 동일 스키마)
    { desc: 'terms_consents table', sql: "CREATE TABLE IF NOT EXISTS terms_consents (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_type TEXT NOT NULL, subject_id TEXT, user_id TEXT, terms_slug TEXT NOT NULL, terms_version TEXT NOT NULL, core_terms_agreed INTEGER DEFAULT 0, ip TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)" },
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
    // 🛡️ 2026-06-28 정산 보류 — 분쟁/환불 진행 중 성숙·지급 제외(matureSupplierSettlements·payoutSupplier 가 held_at IS NULL 만).
    { desc: 'supplier_settlements.held_at', sql: "ALTER TABLE supplier_settlements ADD COLUMN held_at DATETIME" },
    { desc: 'wholesale_orders.refunded_amount', sql: "ALTER TABLE wholesale_orders ADD COLUMN refunded_amount INTEGER NOT NULL DEFAULT 0" },
    // 🚚 2026-06-09 제조사별 배송/주문 정책 — suppliers 3컬럼(0=제한/배송비/무료배송 없음) + 주문 배송비 합계.
    { desc: 'suppliers.min_order_amount', sql: "ALTER TABLE suppliers ADD COLUMN min_order_amount INTEGER DEFAULT 0" },
    { desc: 'suppliers.shipping_fee', sql: "ALTER TABLE suppliers ADD COLUMN shipping_fee INTEGER DEFAULT 0" },
    { desc: 'suppliers.free_ship_threshold', sql: "ALTER TABLE suppliers ADD COLUMN free_ship_threshold INTEGER DEFAULT 0" },
    { desc: 'wholesale_orders.shipping_total', sql: "ALTER TABLE wholesale_orders ADD COLUMN shipping_total INTEGER NOT NULL DEFAULT 0" },
    // 🏭 2026-06-27 B2B 상태머신 단계 타임스탬프/사유 + 🛡️ 2026-06-28 배송비 단발환불 멱등 마커.
    //   ensureOrderTables 의 ALTER 와 동일 — accept/reject/distributor-admin 라우트는 ensureOrderTables 를
    //   안 거치는 경로가 있어 repair-schema 에도 등록(콜드 isolate 에서 컬럼 부재로 무음 실패하던 것 차단).
    { desc: 'wholesale_orders.accepted_at', sql: "ALTER TABLE wholesale_orders ADD COLUMN accepted_at DATETIME" },
    { desc: 'wholesale_orders.rejected_at', sql: "ALTER TABLE wholesale_orders ADD COLUMN rejected_at DATETIME" },
    { desc: 'wholesale_orders.reject_reason', sql: "ALTER TABLE wholesale_orders ADD COLUMN reject_reason TEXT" },
    { desc: 'wholesale_orders.cancelled_at', sql: "ALTER TABLE wholesale_orders ADD COLUMN cancelled_at DATETIME" },
    { desc: 'wholesale_orders.cancel_reason', sql: "ALTER TABLE wholesale_orders ADD COLUMN cancel_reason TEXT" },
    { desc: 'wholesale_orders.confirmed_at', sql: "ALTER TABLE wholesale_orders ADD COLUMN confirmed_at DATETIME" },
    { desc: 'wholesale_orders.shipping_refunded', sql: "ALTER TABLE wholesale_orders ADD COLUMN shipping_refunded INTEGER NOT NULL DEFAULT 0" },
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
    // 🔐 2026-07-11 계좌 재검증 게이트 — 정산 계좌 변경 시 0으로 리셋, 어드민 재검증 후 1 복원.
    //   production-drift 컬럼(seller-profile.routes.ts 에서 동적 UPDATE 로만 써 repair-schema 미등록이었음).
    //   check-sql-column-exists 가 static UPDATE 를 분석하려면 inline DDL 에 등록 필요.
    { desc: 'sellers.is_verified', sql: "ALTER TABLE sellers ADD COLUMN is_verified INTEGER DEFAULT 1" },
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
    // 🏪 2026-08-19 매장 운영 주체(operator) — 한 계정이 여러 매장을 운영할 수 있게 하는 관계.
    //   설계 SSOT: docs/design/store-operator-model.md · 런타임 ensureSellerOperators 도 best-effort CREATE.
    //   ⚠️ revoked_at 은 행 삭제 대신 — 누가 언제 운영했는지가 분쟁 시 유일한 근거다.
    { desc: 'seller_operators', sql: `CREATE TABLE IF NOT EXISTS seller_operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      granted_by_user_id INTEGER,
      granted_at DATETIME DEFAULT (datetime('now')),
      revoked_at DATETIME,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { desc: 'idx_seller_operators_pair', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_operators_pair ON seller_operators(seller_id, user_id)" },
    { desc: 'idx_seller_operators_user', sql: "CREATE INDEX IF NOT EXISTS idx_seller_operators_user ON seller_operators(user_id, revoked_at)" },
    // 🔒 2026-08-27 유어애즈 DB 열람량 — 대행사 차단(ads-db-access.ts)의 짝. 등록 유형은 자기신고라
    //   우회되지만 "하루에 몇 행 가져갔나"는 우회할 수 없다. 상한의 근거이자 감사 기록.
    { desc: 'seller_ads_db_usage', sql: `CREATE TABLE IF NOT EXISTS seller_ads_db_usage (
      seller_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      rows_served INTEGER NOT NULL DEFAULT 0,
      calls INTEGER NOT NULL DEFAULT 0,
      last_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(seller_id, day)
    )` },
    // 📣 2026-08-20 인플루언서 협업 제안(아웃리치) — 셀러가 작성·저장, 발송은 유어딜 대행(seller-dashboard-v2).
    { desc: 'influencer_outreach_requests', sql: `CREATE TABLE IF NOT EXISTS influencer_outreach_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      product_id INTEGER,
      target_lead_ids TEXT NOT NULL,
      target_count INTEGER NOT NULL DEFAULT 0,
      commission_pct REAL NOT NULL DEFAULT 0,
      product_support TEXT NOT NULL DEFAULT 'free',
      channels TEXT NOT NULL DEFAULT '[]',
      period_days INTEGER,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      quoted_fee_krw INTEGER NOT NULL DEFAULT 0,
      admin_note TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )` },
    { desc: 'idx_outreach_seller', sql: "CREATE INDEX IF NOT EXISTS idx_outreach_seller ON influencer_outreach_requests(seller_id, created_at DESC)" },
    { desc: 'influencer_offer_invites', sql: `CREATE TABLE IF NOT EXISTS influencer_offer_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outreach_id INTEGER NOT NULL,
      lead_id INTEGER,
      token TEXT NOT NULL UNIQUE,
      seller_id INTEGER NOT NULL,
      product_id INTEGER,
      commission_pct REAL NOT NULL DEFAULT 0,
      product_support TEXT NOT NULL DEFAULT 'free',
      channels TEXT NOT NULL DEFAULT '[]',
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      accepted_user_id TEXT,
      accepted_at DATETIME,
      created_at DATETIME DEFAULT (datetime('now'))
    )` },
    { desc: 'idx_offer_invites_outreach', sql: "CREATE INDEX IF NOT EXISTS idx_offer_invites_outreach ON influencer_offer_invites(outreach_id)" },
    // 💾 2026-08-23 이용권 등록 서버 임시저장 — 셀러(좌석)당 1행. seller_meta 를 안 쓰는 이유는
    //   seller-stores.routes.ts 주석 참조(수백 KB 드래프트가 모든 meta 조회에 끌려다님).
    { desc: 'seller_voucher_drafts', sql: `CREATE TABLE IF NOT EXISTS seller_voucher_drafts (
      seller_id INTEGER PRIMARY KEY,
      draft_json TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
    )` },
    { desc: 'outreach_email_queue', sql: `CREATE TABLE IF NOT EXISTS outreach_email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outreach_id INTEGER NOT NULL,
      invite_id INTEGER,
      lead_id INTEGER,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      html TEXT NOT NULL,
      unsubscribe_token TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now')),
      sent_at DATETIME,
      UNIQUE(outreach_id, lead_id)
    )` },
    { desc: 'idx_outreach_email_status', sql: "CREATE INDEX IF NOT EXISTS idx_outreach_email_status ON outreach_email_queue(status, created_at)" },
    { desc: 'idx_outreach_email_addr', sql: "CREATE INDEX IF NOT EXISTS idx_outreach_email_addr ON outreach_email_queue(email, sent_at)" },
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
    // 🎯 2026-06-30 유어애즈 일별 메트릭(멀티테넌트) — ensureMetricsHistorySchema 와 동일 스키마 등록(복구 가능성).
    //   핵심: UNIQUE INDEX(account_id, tenant, snap_date) 가 있어야 UPSERT 의 ON CONFLICT 가 유효(멱등·미스토어 방지).
    { desc: 'ad_daily_metrics', sql: `CREATE TABLE IF NOT EXISTS ad_daily_metrics (
      account_id INTEGER NOT NULL,
      tenant TEXT NOT NULL DEFAULT '',
      snap_date TEXT NOT NULL,
      cost INTEGER DEFAULT 0,
      conv_amt INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      conv INTEGER DEFAULT 0,
      imp INTEGER DEFAULT 0,
      roas REAL,
      avg_rnk REAL,
      created_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(account_id, tenant, snap_date)
    )` },
    { desc: 'idx_ad_daily_metrics_uniq', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_daily_metrics_uniq ON ad_daily_metrics(account_id, tenant, snap_date)" },
    // 🆕 2026-07-15 소셜 미디어 자동화(유어딜 자체 홍보 — 스레드/인스타/유튜브). 토큰 at-rest 암호화.
    { desc: 'social_accounts', sql: `CREATE TABLE IF NOT EXISTS social_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      account_ref TEXT,
      display_name TEXT,
      access_token_enc TEXT,
      refresh_token_enc TEXT,
      token_expires_at DATETIME,
      extra TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { desc: 'idx_social_accounts_platform', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform)" },
    { desc: 'social_posts', sql: `CREATE TABLE IF NOT EXISTS social_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      topic_slug TEXT,
      title TEXT,
      body TEXT NOT NULL,
      hashtags TEXT DEFAULT '[]',
      media_url TEXT,
      media_kind TEXT DEFAULT 'none',
      status TEXT DEFAULT 'draft',
      external_id TEXT,
      external_url TEXT,
      error TEXT,
      scheduled_at DATETIME,
      published_at DATETIME,
      ai_generated INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { desc: 'idx_social_posts_status', sql: "CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(platform, status)" },
    // 🎬 릴스/쇼츠 영상 기획·렌더 추적(추가만).
    { desc: 'social_posts.storyboard', sql: "ALTER TABLE social_posts ADD COLUMN storyboard TEXT" },
    { desc: 'social_posts.render_provider_job', sql: "ALTER TABLE social_posts ADD COLUMN render_provider_job TEXT" },
    { desc: 'social_posts.render_status', sql: "ALTER TABLE social_posts ADD COLUMN render_status TEXT" },
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
    // 🌍 2026-07-08 (대표 "수천개 대비 — 지도영역/거리 조회"): 공간 인덱스. bbox(위경도 BETWEEN)·near(거리정렬)
    //   쿼리가 스케일에서 풀스캔 안 하도록. group-buy-public GET /products 의 bbox/near 파라미터용 토대.
    { desc: 'idx_products_geo', sql: "CREATE INDEX IF NOT EXISTS idx_products_geo ON products(restaurant_lat, restaurant_lng) WHERE is_active = 1" },
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
    { desc: 'agencies.commission_term_months', sql: "ALTER TABLE agencies ADD COLUMN commission_term_months INTEGER" },
    // 🛡️ 2026-05-21: 리뷰 대량 생성 (admin-review-generator) 가 INSERT 하는 컬럼.
    //   기존 0132 schema 에 user_name / selected_option / is_generated 없음 → 사용자 신고 "생성 실패".
    //   영구 fix: daily cron 이 ensure → endpoint 자체 ALTER 의존성 제거.
    { desc: 'product_reviews.user_name', sql: "ALTER TABLE product_reviews ADD COLUMN user_name TEXT" },
    { desc: 'product_reviews.selected_option', sql: "ALTER TABLE product_reviews ADD COLUMN selected_option TEXT" },
    { desc: 'product_reviews.is_generated', sql: "ALTER TABLE product_reviews ADD COLUMN is_generated INTEGER DEFAULT 0" },
    // 🏪 2026-07-07: 사장님 답글 — 기존엔 seller-analytics ensure 에서만 lazy ALTER(셀러가 답글 달 때) →
    //   데모 리뷰 시드/표시 경로에서 컬럼 부재 위험. repair-schema 에 등록해 영구 보장(멱등).
    { desc: 'product_reviews.seller_reply', sql: "ALTER TABLE product_reviews ADD COLUMN seller_reply TEXT" },
    { desc: 'product_reviews.seller_reply_at', sql: "ALTER TABLE product_reviews ADD COLUMN seller_reply_at DATETIME" },
    // 🔴 2026-08-01: 가시성/광고표시 — 옛 is_hidden 모양으로 만들어진 DB 가 있다면 여기서 치유.
    { desc: 'product_reviews.is_visible', sql: "ALTER TABLE product_reviews ADD COLUMN is_visible INTEGER DEFAULT 1" },
    { desc: 'product_reviews.is_sponsored', sql: "ALTER TABLE product_reviews ADD COLUMN is_sponsored INTEGER DEFAULT 0" },
    // 🛡️ 2026-05-24: /api/vouchers/my SELECT 가 참조하는 컬럼 — 미존재 시 첫 SELECT crash → fallback 만 동작 (applied_price 누락).
    //   영구 fix: repair-schema 에 등록 → 매일 18 UTC cron 이 자동 ADD COLUMN (멱등).
    //   gift_* 컬럼은 선물하기 기능 (voucher 양도) 용. refund_status 는 환불 추적용.
    { desc: 'vouchers.refund_status', sql: "ALTER TABLE vouchers ADD COLUMN refund_status TEXT" },
    { desc: 'vouchers.gift_from_user_id', sql: "ALTER TABLE vouchers ADD COLUMN gift_from_user_id TEXT" },
    { desc: 'vouchers.delivered_gift_name', sql: "ALTER TABLE vouchers ADD COLUMN delivered_gift_name TEXT" },
    { desc: 'vouchers.applied_discount_pct', sql: "ALTER TABLE vouchers ADD COLUMN applied_discount_pct INTEGER DEFAULT 0" },
    { desc: 'vouchers.applied_price', sql: "ALTER TABLE vouchers ADD COLUMN applied_price INTEGER" },
    { desc: 'vouchers.is_experience', sql: "ALTER TABLE vouchers ADD COLUMN is_experience INTEGER DEFAULT 0" },
    { desc: 'table influencer_balances', sql: "CREATE TABLE IF NOT EXISTS influencer_balances (influencer_id TEXT PRIMARY KEY, pending_amount INTEGER DEFAULT 0, available_amount INTEGER DEFAULT 0, total_paid_out INTEGER DEFAULT 0, business_number TEXT, tax_type TEXT DEFAULT 'other_income', bank_name TEXT, bank_account TEXT, account_holder TEXT, created_at DATETIME DEFAULT (datetime('now')), updated_at DATETIME DEFAULT (datetime('now')))" },
    { desc: 'table influencer_attributions', sql: "CREATE TABLE IF NOT EXISTS influencer_attributions (id INTEGER PRIMARY KEY AUTOINCREMENT, influencer_id TEXT NOT NULL, order_id INTEGER, voucher_id INTEGER, product_id INTEGER, seller_id INTEGER, commission_amount INTEGER NOT NULL, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT (datetime('now')), available_at DATETIME, paid_at DATETIME, clawback_reason TEXT)" },
    { desc: 'idx_inf_attr_influencer', sql: "CREATE INDEX IF NOT EXISTS idx_inf_attr_influencer ON influencer_attributions(influencer_id, status)" },
    { desc: 'idx_inf_attr_pending_avail', sql: "CREATE INDEX IF NOT EXISTS idx_inf_attr_pending_avail ON influencer_attributions(status, available_at)" },
    { desc: 'table seller_blocked_influencers', sql: "CREATE TABLE IF NOT EXISTS seller_blocked_influencers (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, influencer_id TEXT NOT NULL, reason TEXT, blocked_at DATETIME DEFAULT (datetime('now')), unblocked_at DATETIME, UNIQUE(seller_id, influencer_id))" },
    { desc: 'idx_seller_blocked_inf_seller', sql: "CREATE INDEX IF NOT EXISTS idx_seller_blocked_inf_seller ON seller_blocked_influencers(seller_id, unblocked_at)" },
    // platform_settings default rows (INSERT OR IGNORE — 이미 있으면 skip)
    { desc: 'seed: platform_margin_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('platform_margin_pct', '5', '유어딜 운영 마진 (%)', datetime('now'))" },
    { desc: 'seed: influencer_commission_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('influencer_commission_pct', '0', '인플루언서 자동 referral commission (%) — 2026-08-23 심플 모델로 종료(딜 % 만)', datetime('now'))" },
    // 🛑 2026-08-23 대표(심플 모델): 과거 시드가 심은 0.5% 기본값을 0 으로 치유 — 어드민이 다른 값으로
    //   바꾼 행(≠0.5)은 보존. INSERT OR IGNORE 는 기존 행을 못 고치므로 이 UPDATE 가 필요하다.
    { desc: 'heal: influencer_commission_pct 0.5→0 (심플 모델)', sql: "UPDATE platform_settings SET value='0', updated_at=datetime('now') WHERE key='influencer_commission_pct' AND value='0.5'" },
    { desc: 'heal: user_referral_bonus_pct 0.5→0 (심플 모델)', sql: "UPDATE platform_settings SET value='0', updated_at=datetime('now') WHERE key='user_referral_bonus_pct' AND value='0.5'" },
    { desc: 'seed: user_referral_bonus_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('user_referral_bonus_pct', '0', '사용자 referral 보너스 (%) — 2026-08-23 심플 모델로 종료', datetime('now'))" },
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
    // 🙋 2026-08-27 소개자 공개 프로필 — 매장이 검색할 **모수**. 없으면 딜 제안 상대를 못 찾는다
    //   (그 전엔 유저 ID 를 손으로 타이핑해야 했다). 공개는 본인이 켜는 opt-in.
    { desc: 'table influencer_profiles', sql: "CREATE TABLE IF NOT EXISTS influencer_profiles (user_id TEXT PRIMARY KEY, is_open INTEGER NOT NULL DEFAULT 0, intro TEXT, channels TEXT, categories TEXT, regions TEXT, created_at DATETIME DEFAULT (datetime('now')), updated_at DATETIME DEFAULT (datetime('now')))" },
    { desc: 'idx_influencer_profiles_open', sql: "CREATE INDEX IF NOT EXISTS idx_influencer_profiles_open ON influencer_profiles(is_open) WHERE is_open = 1" },
    { desc: 'table seller_influencer_deals', sql: "CREATE TABLE IF NOT EXISTS seller_influencer_deals (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, influencer_id TEXT NOT NULL, commission_pct REAL NOT NULL, starts_at DATETIME DEFAULT (datetime('now')), ends_at DATETIME, status TEXT DEFAULT 'proposed', proposed_by TEXT NOT NULL, message TEXT, created_at DATETIME DEFAULT (datetime('now')), responded_at DATETIME, UNIQUE(seller_id, influencer_id))" },
    { desc: 'idx_seller_inf_deals_seller', sql: "CREATE INDEX IF NOT EXISTS idx_seller_inf_deals_seller ON seller_influencer_deals(seller_id, status)" },
    { desc: 'idx_seller_inf_deals_inf', sql: "CREATE INDEX IF NOT EXISTS idx_seller_inf_deals_inf ON seller_influencer_deals(influencer_id, status)" },
    // 🎬 2026-07-12 WP-B 조건부 우대커미션 (콘텐츠 인증 시 발효). requires_content_proof=1 이면
    //   인플 링크제출(proof_url,proof_status='submitted') → 매장 승인 시 status='active'(발효).
    { desc: 'seller_influencer_deals.requires_content_proof', sql: "ALTER TABLE seller_influencer_deals ADD COLUMN requires_content_proof INTEGER DEFAULT 0" },
    { desc: 'seller_influencer_deals.proof_url', sql: "ALTER TABLE seller_influencer_deals ADD COLUMN proof_url TEXT" },
    { desc: 'seller_influencer_deals.proof_status', sql: "ALTER TABLE seller_influencer_deals ADD COLUMN proof_status TEXT" },
    // 🤝 2026-07-10 매장↔에이전시 위임 3단 모델 (docs/design/vendor-commission-passthrough.md §4.3)
    //   관계+모드 저장만 — 돈 효과 0 (분배 엔진은 8월 flip 과 함께). SSOT ensure: store-agency-delegation.ts
    { desc: 'table store_agency_delegation', sql: "CREATE TABLE IF NOT EXISTS store_agency_delegation (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, agency_id INTEGER NOT NULL, mode TEXT NOT NULL DEFAULT 'approval', granted_at DATETIME, revoked_at DATETIME, created_at DATETIME DEFAULT (datetime('now')), updated_at DATETIME DEFAULT (datetime('now')), UNIQUE(seller_id, agency_id))" },
    { desc: 'idx_store_agency_delegation_agency', sql: "CREATE INDEX IF NOT EXISTS idx_store_agency_delegation_agency ON store_agency_delegation(agency_id, mode)" },
    // 🎟️ 2026-07-06 공구 엔진 §2-B: 양방향 공구 제안(인플→매장 / 매장→인플). 상대방 승인 시 gb 세션 open.
    { desc: 'table gb_proposals', sql: "CREATE TABLE IF NOT EXISTS gb_proposals (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, seller_id INTEGER, influencer_id TEXT NOT NULL, proposed_by TEXT NOT NULL, deadline DATETIME, price INTEGER, promo_pct REAL, target INTEGER, message TEXT, status TEXT DEFAULT 'proposed', response_note TEXT, created_at DATETIME DEFAULT (datetime('now')), responded_at DATETIME)" },
    { desc: 'idx_gb_proposals_seller', sql: "CREATE INDEX IF NOT EXISTS idx_gb_proposals_seller ON gb_proposals(seller_id, status)" },
    { desc: 'idx_gb_proposals_inf', sql: "CREATE INDEX IF NOT EXISTS idx_gb_proposals_inf ON gb_proposals(influencer_id, status)" },
    { desc: 'idx_gb_proposals_product', sql: "CREATE INDEX IF NOT EXISTS idx_gb_proposals_product ON gb_proposals(product_id, status)" },
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
    // 🎨 2026-06-16 (유어샵 시안): 크리에이터 SNS 링크 (유튜브/인스타/틱톡).
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
    //   셀러를 엉뚱한 user 에 연결(유어샵이 옛 계정으로). 이제 email 이 정확히 1명일 때만(COUNT=1) 연결.
    { desc: 'backfill: sellers.linked_user_id (same-email, 1:1 only)', sql: `UPDATE sellers SET linked_user_id = (SELECT id FROM users u WHERE u.email = sellers.email ORDER BY u.id LIMIT 1), updated_at = datetime('now') WHERE (linked_user_id IS NULL OR linked_user_id = 0) AND email IS NOT NULL AND email != '' AND (SELECT COUNT(*) FROM users u2 WHERE u2.email = sellers.email) = 1` },
    // 🏭 2026-06-05 [UNLOCK]: users.email partial UNIQUE — 두 카카오 계정이 같은 email 로 분리 생성되는 것 차단.
    //   best-effort: 기존 중복 email 이 있으면 생성 실패(아래 catch) → 중복 정리 후 재실행 시 적용.
    { desc: 'idx_users_email_unique', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL AND email != ''" },
    // 🛡️ 2026-05-28: 영입 커미션 무기한(NULL) 일몰제 강제 — 레거시 영입 매장에 +12개월 캡 (LTV 보호).
    //   introduced_at 기준 (없으면 created_at). 이미 referral_bonus_until 설정된 매장은 불변.
    { desc: 'backfill: sellers.referral_bonus_until cap (introduced, NULL→+12mo)', sql: `UPDATE sellers SET referral_bonus_until = datetime(COALESCE(introduced_at, created_at, datetime('now')), '+12 months'), updated_at = datetime('now') WHERE referral_bonus_until IS NULL AND (introduced_by_agency_id IS NOT NULL OR introduced_by_influencer_id IS NOT NULL)` },
    // 🛡️ 2026-06-25 (대표 승인 — B4 기존 데이터 복구): 카카오 로그인 에이전시가 영입한 매장의 귀속을
    //   user.id(users.id) → canonical agencies.id 로 정정. 기존 prospect/registration 이 user.id 를 저장해
    //   대시보드(agencies.id 조회)에서 영입 매장·커미션이 안 보였음(forward fix 는 seller-prospects.routes).
    //   가드: '이미 유효한 agencies.id 가 아니면서(NOT IN agencies.id) 유효한 linked_user_id 인(IN …) 값만'
    //   매핑 → 정상 행 불변·멱등(재실행 시 값이 이미 agency id 라 제외)·collision 회피.
    { desc: 'backfill: seller_prospects.introducer_id (agency user.id→agencies.id)', sql: `UPDATE seller_prospects SET introducer_id = (SELECT a.id FROM agencies a WHERE a.linked_user_id = CAST(seller_prospects.introducer_id AS INTEGER) LIMIT 1) WHERE introducer_type = 'agency' AND CAST(introducer_id AS INTEGER) IN (SELECT linked_user_id FROM agencies WHERE linked_user_id IS NOT NULL) AND CAST(introducer_id AS INTEGER) NOT IN (SELECT id FROM agencies)` },
    { desc: 'backfill: sellers.introduced_by_agency_id (user.id→agencies.id)', sql: `UPDATE sellers SET introduced_by_agency_id = (SELECT a.id FROM agencies a WHERE a.linked_user_id = sellers.introduced_by_agency_id LIMIT 1), updated_at = datetime('now') WHERE introduced_by_agency_id IS NOT NULL AND introduced_by_agency_id IN (SELECT linked_user_id FROM agencies WHERE linked_user_id IS NOT NULL) AND introduced_by_agency_id NOT IN (SELECT id FROM agencies)` },
    // 🏭 2026-06-29 (대표 신고 — "업로드 제품 카테고리 배치 안됨") 근본수정 backfill: 도매 상품 카테고리를
    //   표준 3종(food/living/health)으로 정규화. 스토어 임포트('lifestyle' 하드코드)·레거시 자유입력값이
    //   카탈로그 칩 필터(p.category='food'…)에 안 잡혀 미배치되던 것 일괄 치유. is_supply_product=1 만
    //   (소비자 상품 불변 — 서비스 분리). 순서: food→health→나머지 catch-all living. 멱등(재실행 시 3종은 제외).
    { desc: 'backfill: supply products category → food', sql: `UPDATE products SET category='food', updated_at=datetime('now') WHERE COALESCE(is_supply_product,0)=1 AND COALESCE(category,'') NOT IN ('food','living','health') AND (lower(category) LIKE '%food%' OR category LIKE '%식품%' OR category LIKE '%먹거리%' OR category LIKE '%음료%' OR category LIKE '%간식%' OR category LIKE '%농산%' OR category LIKE '%수산%' OR category LIKE '%축산%' OR category LIKE '%신선%')` },
    { desc: 'backfill: supply products category → health', sql: `UPDATE products SET category='health', updated_at=datetime('now') WHERE COALESCE(is_supply_product,0)=1 AND COALESCE(category,'') NOT IN ('food','living','health') AND (lower(category) LIKE '%health%' OR lower(category) LIKE '%supplement%' OR category LIKE '%건강%' OR category LIKE '%영양%' OR category LIKE '%비타민%' OR category LIKE '%다이어트%')` },
    { desc: 'backfill: supply products category → living (catch-all)', sql: `UPDATE products SET category='living', updated_at=datetime('now') WHERE COALESCE(is_supply_product,0)=1 AND (category IS NULL OR category NOT IN ('food','living','health'))` },
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
    { desc: 'orders.commission_rate', sql: "ALTER TABLE orders ADD COLUMN commission_rate REAL DEFAULT 5.00" }, // 🔒 2026-06-27 (감사 ⑤): 기본 5% 통일(셀러 기본·policy 와 일치). createOrder 가 셀러율 스냅샷하므로 평시 미사용 — fresh DB 일관용.
    { desc: 'orders.commission_amount', sql: "ALTER TABLE orders ADD COLUMN commission_amount INTEGER DEFAULT 0" },
    { desc: 'orders.seller_amount', sql: "ALTER TABLE orders ADD COLUMN seller_amount INTEGER DEFAULT 0" },
    // 🛡️ 2026-05-23: SQL column mismatch 23건 일괄 fix — production-schema 정합.
    //   - products.long_description: 어드민 상품 상세 마크다운 설명.
    //   - products.compare_at_price: 할인 전 가격 (정가) — Cafe24 sync / 어드민 상품 등록 시 사용.
    { desc: 'products.long_description', sql: "ALTER TABLE products ADD COLUMN long_description TEXT" },
    // 🛡️ 2026-07-02 (쇼핑 전수조사): detail_images 를 repair 에도 등록 — migration 0004 에만 있어
    //   fresh/미적용 env 부재 가능. PRODUCT_DETAIL_FIELDS 에 추가하려면 repair 로 복구 가능해야 함.
    { desc: 'products.detail_images', sql: "ALTER TABLE products ADD COLUMN detail_images TEXT" },
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
    //   - 💸 2026-07-05 유상/무상 버킷 (point-buckets.ts SSOT): free_balance = 무상 잔액(0 ≤ free ≤ balance),
    //     free_delta = 거래별 무상 적용분(적립+/차감-) — 무상 우선 차감·무상 환급 제외·환불 대칭 복원 근거.
    { desc: 'user_points.free_balance', sql: "ALTER TABLE user_points ADD COLUMN free_balance INTEGER NOT NULL DEFAULT 0" },
    { desc: 'point_transactions.free_delta', sql: "ALTER TABLE point_transactions ADD COLUMN free_delta INTEGER DEFAULT 0" },
    // 🔴 2026-08-01: 아래 3개는 INSERT 에 쓰이는데 등록이 없어, 컬럼 부재 창에서 원장 기록만 사라졌다(불일치 3건).
    { desc: 'point_transactions.points_amount', sql: "ALTER TABLE point_transactions ADD COLUMN points_amount INTEGER DEFAULT 0" },
    { desc: 'point_transactions.balance_after', sql: "ALTER TABLE point_transactions ADD COLUMN balance_after INTEGER" },
    { desc: 'point_transactions.order_id', sql: "ALTER TABLE point_transactions ADD COLUMN order_id TEXT" },
    //   - 🎁 2026-07-05 체험단(FCFS) 참여 리뷰 자동 표시 (표시광고법) — 작성 API 서버 판정으로 세팅.
    { desc: 'product_reviews.is_sponsored', sql: "ALTER TABLE product_reviews ADD COLUMN is_sponsored INTEGER DEFAULT 0" },
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
    { desc: 'seed: influencer_store_intro_pct', sql: "INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES ('influencer_store_intro_pct', '2', '매장 영입(소개) commission (%, 영입자에게 매장 매출의 %)', datetime('now'))" },

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
    // 🏥 2026-07-03 (의료용품 도매몰): 규제 몰 게이트 컬럼(기존 몰 기본 0/NULL = 무영향).
    { desc: 'wholesale_malls.requires_license', sql: "ALTER TABLE wholesale_malls ADD COLUMN requires_license INTEGER DEFAULT 0" },
    { desc: 'wholesale_malls.license_label', sql: "ALTER TABLE wholesale_malls ADD COLUMN license_label TEXT" },
    { desc: 'wholesale_malls.features_json', sql: "ALTER TABLE wholesale_malls ADD COLUMN features_json TEXT" },
    { desc: 'wholesale_malls.company_json', sql: "ALTER TABLE wholesale_malls ADD COLUMN company_json TEXT" },
    // 🏬 소비자 경로(`urdeal.kr/{슬러그}`) 개방 표시. DEFAULT 0 = fail-closed(서비스 분리) — mall-consumer.ts 참조.
    { desc: 'wholesale_malls.consumer_path', sql: "ALTER TABLE wholesale_malls ADD COLUMN consumer_path INTEGER DEFAULT 0" },
    // 📣 2026-08-09 과업①(상인회 SaaS) — 몰별 GA4/네이버 확인/방문자 고지문(ensureMallSchema 미러).
    { desc: 'wholesale_malls.ga_id', sql: "ALTER TABLE wholesale_malls ADD COLUMN ga_id TEXT" },
    { desc: 'wholesale_malls.naver_verification', sql: "ALTER TABLE wholesale_malls ADD COLUMN naver_verification TEXT" },
    { desc: 'wholesale_malls.privacy_md', sql: "ALTER TABLE wholesale_malls ADD COLUMN privacy_md TEXT" },
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
    // 📖 2026-07-11 (가이드 버전 재시드): 수동편집 보존 플래그 — blog_posts.manually_edited 미러.
    //   guide.routes.ts maybeSyncGuideSeed 가 manually_edited=0 섹션만 시드 최신화(관리자 편집 보존).
    //   guide.routes.ts 인라인 ensure(ensureGuideEditColumn) 병행 — 여기 등록은 repair 경로용.
    { desc: 'operation_guides.manually_edited', sql: "ALTER TABLE operation_guides ADD COLUMN manually_edited INTEGER DEFAULT 0", requiresTable: 'operation_guides' },
]
