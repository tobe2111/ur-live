-- 셀러별 배송비 설정 추가
-- 각 셀러가 자신의 배송비 정책을 설정할 수 있도록 함

-- sellers 테이블에 배송비 관련 컬럼 추가
ALTER TABLE sellers ADD COLUMN shipping_fee INTEGER DEFAULT 3000;  -- 기본 배송비 3,000원
ALTER TABLE sellers ADD COLUMN free_shipping_threshold INTEGER DEFAULT 0;  -- 무료배송 최소 금액 (0 = 무료배송 없음)

-- 인덱스 추가 (불필요하지만 일관성을 위해)
-- CREATE INDEX IF NOT EXISTS idx_sellers_shipping_fee ON sellers(shipping_fee);

-- 기존 셀러 데이터에 기본값 설정
UPDATE sellers SET shipping_fee = 3000 WHERE shipping_fee IS NULL;
UPDATE sellers SET free_shipping_threshold = 0 WHERE free_shipping_threshold IS NULL;

-- 주석 추가
-- shipping_fee: 셀러의 기본 배송비 (원 단위)
-- free_shipping_threshold: 무료배송 최소 주문 금액 (0 = 무료배송 없음)
--   예시: 50000 → 5만원 이상 주문 시 무료배송
