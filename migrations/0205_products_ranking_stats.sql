-- 0205: products 테이블 랭킹 통계 컬럼
--
-- ProductRepository.findAll의 sort='ranking' SQL이 참조하는 컬럼이 스키마에 없어서
-- 정렬 의미가 사라지던 문제 (self-audit B CRITICAL #1) 수정.
--
-- view_count: 상품 상세 페이지 조회 카운트 (증가는 /api/products/:id GET 핸들러에서)
-- avg_rating: 리뷰 평균 별점 (review INSERT/UPDATE 시 리프레시)
-- review_count: 리뷰 개수 (review INSERT/DELETE 시 리프레시)

ALTER TABLE products ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN avg_rating REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN review_count INTEGER DEFAULT 0;

-- 기존 랭킹 쿼리가 더 빠르게 동작하도록 ranking 점수 생성 식에 자주 쓰이는 컬럼
-- 인덱스 (sold_count 는 0200 에서 이미 인덱스)
CREATE INDEX IF NOT EXISTS idx_products_view_count ON products(view_count);
CREATE INDEX IF NOT EXISTS idx_products_avg_rating ON products(avg_rating);
