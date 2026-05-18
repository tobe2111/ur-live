-- 🛡️ 2026-05-18: 숙소 'voucher' 모드 추가 — 기간 무관 숙소권 (식사권과 동일 모델).
--
--   사용자 모델 (시중 없는 신규 모델):
--     - sale_mode='voucher'   = 기간 무관 숙소권. 평일/주말 분리 가격. 결제 시 voucher 발급,
--                              매장에 별도 연락해서 실제 날짜 잡음. (식사권과 동일)
--     - sale_mode='date'      = 캘린더 기반 날짜 지정 예약 (이미 구현됨, 야놀자 스타일).
--     - sale_mode='both'      = 두 모드 모두 — 셀러가 voucher 도 팔고 일부 날짜만 캘린더 열어둠.
--
--   voucher 모드의 객실 가격:
--     - product_stay_rooms.base_price_weekday / weekend 는 이미 있음.
--     - voucher 구매 시 사용자는 평일/주말 중 선택. 평일권은 평일만 사용 가능 (월-목),
--       주말권은 금-토만 사용 가능. 일요일은 평일/주말 둘 다 허용.
--     - voucher 유효기간: 셀러 설정 (default 180일).

ALTER TABLE product_stay_info ADD COLUMN sale_mode TEXT DEFAULT 'date';
  -- 'voucher' | 'date' | 'both'

ALTER TABLE product_stay_info ADD COLUMN voucher_validity_days INTEGER DEFAULT 180;
  -- voucher 발급 후 유효기간 (기본 180일).

ALTER TABLE product_stay_info ADD COLUMN voucher_weekday_only INTEGER NOT NULL DEFAULT 0;
  -- 1 = 평일권만 판매 (주말권 X)
ALTER TABLE product_stay_info ADD COLUMN voucher_weekend_only INTEGER NOT NULL DEFAULT 0;
  -- 1 = 주말권만 판매 (평일권 X)
-- 둘 다 0 = 평일/주말 voucher 모두 판매 (사용자가 선택).

-- stay_bookings 에 voucher 모드용 필드:
ALTER TABLE stay_bookings ADD COLUMN sale_mode TEXT DEFAULT 'date';
  -- 'voucher' | 'date' — 어느 모드로 구매한 예약인지.

ALTER TABLE stay_bookings ADD COLUMN voucher_type TEXT;
  -- 'weekday' | 'weekend' | NULL (date 모드는 NULL)

ALTER TABLE stay_bookings ADD COLUMN voucher_expires_at DATETIME;
  -- voucher 유효 만료일.

ALTER TABLE stay_bookings ADD COLUMN voucher_used_at DATETIME;
  -- 실제 매장 사용 처리된 시각 (셀러 측 check_in_at 과 별개로 기간 무관 모드 추적).

ALTER TABLE stay_bookings ADD COLUMN voucher_used_check_in DATE;
ALTER TABLE stay_bookings ADD COLUMN voucher_used_check_out DATE;
  -- voucher 사용 시 실제 체크인-체크아웃 (셀러와 협의 후 기록).

CREATE INDEX IF NOT EXISTS idx_stay_bookings_voucher_status
  ON stay_bookings(seller_id, sale_mode, status, voucher_expires_at);
