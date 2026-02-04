-- 주문시 사업자 정보 수집을 위한 컬럼 추가
-- 실행: npx wrangler d1 migrations apply toss-live-commerce-db --local
-- 프로덕션: npx wrangler d1 migrations apply toss-live-commerce-db --remote

-- orders 테이블에 사업자 정보 컬럼 추가
ALTER TABLE orders ADD COLUMN issue_tax_invoice BOOLEAN DEFAULT 0; -- 세금계산서 발행 요청 여부
ALTER TABLE orders ADD COLUMN buyer_business_number TEXT; -- 구매자 사업자등록번호
ALTER TABLE orders ADD COLUMN buyer_business_name TEXT; -- 구매자 상호명
ALTER TABLE orders ADD COLUMN buyer_ceo_name TEXT; -- 구매자 대표자명

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_orders_issue_tax_invoice ON orders(issue_tax_invoice);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_business_number ON orders(buyer_business_number);
