-- 주문 배송 추적 기능 추가
-- 실행: npx wrangler d1 migrations apply webapp-production --local
-- 프로덕션: npx wrangler d1 migrations apply webapp-production

-- 1. orders 테이블에 배송 추적 컬럼 추가 (프로덕션에는 이미 존재)
-- ALTER TABLE orders ADD COLUMN courier TEXT; -- 택배사 (CJ대한통운, 우체국택배 등)
-- ALTER TABLE orders ADD COLUMN tracking_number TEXT; -- 송장번호
-- ALTER TABLE orders ADD COLUMN shipped_at DATETIME; -- 발송 일시
-- ALTER TABLE orders ADD COLUMN delivered_at DATETIME; -- 배송 완료 일시

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 3. status 필드에 가능한 값들:
--    - pending: 결제 대기
--    - paid: 결제 완료
--    - preparing: 상품 준비중
--    - shipped: 발송 완료
--    - delivered: 배송 완료
--    - cancelled: 주문 취소
--    - refunded: 환불 완료
