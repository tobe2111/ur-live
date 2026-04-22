-- 0204: 배송지 테이블에 실무 필수 필드 추가
-- - label: 배송지 별칭 ("집", "회사", "부모님댁" 등)
-- - delivery_note: 배송 메모 ("문 앞에 두세요", "부재시 경비실" 등)
-- - entry_code: 공동현관 비밀번호 (아파트/오피스텔 배송 필수)
-- - entry_method: 출입 방식 (free/password/intercom/pickup_box)

ALTER TABLE shipping_addresses ADD COLUMN label TEXT;
ALTER TABLE shipping_addresses ADD COLUMN delivery_note TEXT;
ALTER TABLE shipping_addresses ADD COLUMN entry_code TEXT;
ALTER TABLE shipping_addresses ADD COLUMN entry_method TEXT DEFAULT 'free';
