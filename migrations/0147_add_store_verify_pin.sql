-- 식사권 상품에 식당 인증 비밀번호 추가
ALTER TABLE products ADD COLUMN store_verify_pin TEXT;
