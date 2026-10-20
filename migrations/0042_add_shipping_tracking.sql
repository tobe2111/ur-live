-- 주문 테이블에 택배사 정보 추가 (나머지는 이미 존재)
ALTER TABLE orders ADD COLUMN shipping_company TEXT;
