-- 🛡️ 2026-05-19: voucher_orders + stay_bookings 운영 보강 (인덱스 + 알림).
--
--   ⚠️ 전제: migration 0257 (voucher_orders, tax_withholding_log) + 0258 (stay_bookings) 적용됨.
--
--   SQLite 는 ALTER TABLE ADD CONSTRAINT 미지원이므로 application-level 검증 의존.
--   본 migration 은 인덱스 추가 + 비정상 status 데이터 점검 알림만 수행.

-- 인덱스 보강 — 자주 쓰이는 쿼리.
CREATE INDEX IF NOT EXISTS idx_voucher_orders_seller_created ON voucher_orders(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voucher_orders_status_check ON voucher_orders(status);
CREATE INDEX IF NOT EXISTS idx_stay_bookings_seller_status ON stay_bookings(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_tax_withholding_year_reportable ON tax_withholding_log(payout_year, reportable, reported_at);

-- 비정상 status 발견 시 어드민 알림 (수동 처리). LIMIT 으로 폭주 방지.
-- dashboard_notifications 테이블이 없으면 SQL ERROR → 전체 migration 실패하므로 try-catch 없이도
-- 0140_add_dashboard_notifications 가 production 에 적용되어 있어야 함.
INSERT OR IGNORE INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
SELECT 'admin', NULL, 'voucher_orders_invalid_status',
       '⚠️ voucher_orders 비정상 status 발견',
       'status = ' || status || ' (id: ' || id || ') — 정상값: pending/processing/sent/failed/cancelled/used',
       '/admin/kt-alpha',
       datetime('now')
  FROM voucher_orders
 WHERE status NOT IN ('pending', 'processing', 'sent', 'failed', 'cancelled', 'used')
 LIMIT 5;

INSERT OR IGNORE INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
SELECT 'admin', NULL, 'stay_bookings_invalid_status',
       '⚠️ stay_bookings 비정상 status 발견',
       'status = ' || status || ' (id: ' || id || ') — 정상값: pending/confirmed/checked_in/checked_out/cancelled/no_show',
       '/admin/stays',
       datetime('now')
  FROM stay_bookings
 WHERE status NOT IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'refunded')
 LIMIT 5;
