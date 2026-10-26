-- 🏡 숙소 예약도 이용권 행을 갖는다 (2026-10-25 대표 "숙소를 이용권 방식으로 합치는 안으로 진행하자. 끝까지.")
--
-- 결제가 확정된 숙소 예약마다 vouchers 행 1장을 만들어 지갑 QR · 사장님 스캔 · 사용 시점 정산 원장을
-- 이용권 경로가 그대로 맡게 한다. 예약 상세(객실·날짜·달력)는 stay_bookings 에 그대로 남는다.
-- 발급은 platform_settings.stay_voucher_unify_enabled='true' 일 때만(기본 OFF). 코드: stay-voucher-unify.ts
ALTER TABLE vouchers ADD COLUMN stay_booking_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_stay_booking_unique ON vouchers(stay_booking_id) WHERE stay_booking_id IS NOT NULL;
