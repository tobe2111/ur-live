-- 라이브 전용 특가 필드 추가
-- 작성일: 2026-03-24
-- 설명: 상품 테이블에 라이브 방송 중에만 적용되는 특가 가격 필드 추가

ALTER TABLE products ADD COLUMN live_only_price INTEGER DEFAULT NULL;

-- 라이브 전용 특가 적용 여부 (라이브 방송 중에만 live_only_price로 노출)
ALTER TABLE products ADD COLUMN live_price_enabled INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_live_price ON products(live_only_price) WHERE live_only_price IS NOT NULL;
