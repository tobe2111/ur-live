-- 🛡️ 2026-05-19: voucher_orders + stay_bookings 누락된 CHECK 제약 추가.
--
--   SQLite 는 ALTER TABLE ADD CONSTRAINT 미지원 → 새 테이블 만들어 데이터 마이그레이션.
--   대신 운영 중 위반 데이터 발견 시 어드민 알림으로 처리하고, application-level 검증에 의존.
--   (이미 routes 에서 status 화이트리스트 체크 중)
--
-- 본 migration 은 INDEX 추가 + 데이터 정합성 검증만 수행.

-- voucher_orders.status 가 화이트리스트 외 값이면 어드민 알림 (수동 처리).
INSERT OR IGNORE INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
SELECT 'admin', NULL, 'voucher_orders_invalid_status',
       '⚠️ voucher_orders 비정상 status 발견',
       'status = ' || status || ' (id: ' || id || ') — 정상값: pending/processing/sent/failed/cancelled/used',
       '/admin/kt-alpha',
       datetime('now')
  FROM voucher_orders
 WHERE status NOT IN ('pending', 'processing', 'sent', 'failed', 'cancelled', 'used')
 LIMIT 5;

-- stay_bookings.status 화이트리스트 검증.
INSERT OR IGNORE INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
SELECT 'admin', NULL, 'stay_bookings_invalid_status',
       '⚠️ stay_bookings 비정상 status 발견',
       'status = ' || status || ' (id: ' || id || ') — 정상값: pending/confirmed/checked_in/checked_out/cancelled/no_show',
       '/admin/stays',
       datetime('now')
  FROM stay_bookings
 WHERE status NOT IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'refunded')
 LIMIT 5;

-- 인덱스 보강 — 자주 쓰이는 쿼리.
CREATE INDEX IF NOT EXISTS idx_voucher_orders_seller_created ON voucher_orders(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voucher_orders_status ON voucher_orders(status);
CREATE INDEX IF NOT EXISTS idx_stay_bookings_seller_status ON stay_bookings(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_tax_withholding_year_reportable ON tax_withholding_log(payout_year, reportable, reported_at);
