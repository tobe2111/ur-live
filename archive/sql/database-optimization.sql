-- =============================================
-- 데이터베이스 최적화 스크립트
-- 인덱스 추가 및 쿼리 성능 개선
-- =============================================

-- 작성일: 2026-03-07
-- 목적: N+1 쿼리 제거 후 인덱스 최적화로 추가 성능 향상

-- =============================================
-- 1. Products 테이블 인덱스
-- =============================================

-- 자주 사용되는 WHERE 조건들
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- 복합 인덱스 (status + seller_id)
CREATE INDEX IF NOT EXISTS idx_products_status_seller ON products(status, seller_id);

-- 검색용 인덱스 (name, description)
-- SQLite는 Full-Text Search를 지원하므로 나중에 FTS 테이블로 전환 고려

-- =============================================
-- 2. Orders 테이블 인덱스
-- =============================================

-- 자주 사용되는 WHERE 조건들
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 복합 인덱스 (user_id + status)
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);

-- 복합 인덱스 (seller_id + status)
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON orders(seller_id, status);

-- =============================================
-- 3. Order Items 테이블 인덱스
-- =============================================

-- JOIN용 외래 키 인덱스
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- =============================================
-- 4. Users 테이블 인덱스
-- =============================================

-- 인증용 인덱스
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- =============================================
-- 5. Sessions 테이블 인덱스
-- =============================================

-- 세션 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- =============================================
-- 6. Streams 테이블 인덱스
-- =============================================

-- 라이브 스트림 조회용
CREATE INDEX IF NOT EXISTS idx_streams_seller_id ON streams(seller_id);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_scheduled_at ON streams(scheduled_at);

-- 복합 인덱스 (status + scheduled_at) - 라이브/예정 목록 조회
CREATE INDEX IF NOT EXISTS idx_streams_status_scheduled ON streams(status, scheduled_at);

-- =============================================
-- 7. Cart Items 테이블 인덱스
-- =============================================

-- 장바구니 조회용
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- 복합 인덱스 (user_id + product_id) - 중복 확인용
CREATE INDEX IF NOT EXISTS idx_cart_items_user_product ON cart_items(user_id, product_id);

-- =============================================
-- 8. Addresses 테이블 인덱스
-- =============================================

-- 주소 조회용
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- =============================================
-- 9. Notifications 테이블 인덱스
-- =============================================

-- 알림 조회용
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- 복합 인덱스 (user_id + is_read + created_at) - 미읽은 알림 조회
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, is_read, created_at);

-- =============================================
-- 성능 개선 효과 (예상)
-- =============================================

-- 1. Orders 조회 (user_id로 필터링)
--    Before: Full Table Scan (O(n))
--    After:  Index Scan (O(log n))
--    개선율: 10-100배 (데이터 양에 따라)

-- 2. Products 조회 (seller_id + status)
--    Before: Full Table Scan + 필터링
--    After:  복합 인덱스 직접 조회
--    개선율: 20-200배

-- 3. Order Items JOIN
--    Before: Nested Loop Join (O(n*m))
--    After:  Index Nested Loop Join (O(n*log m))
--    개선율: 5-50배

-- 4. Cart Items 조회
--    Before: Full Table Scan
--    After:  Index Scan
--    개선율: 10-100배

-- =============================================
-- 모니터링 쿼리
-- =============================================

-- 인덱스 사용 확인
-- EXPLAIN QUERY PLAN SELECT * FROM orders WHERE user_id = 1;

-- 인덱스 목록 확인
-- SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index';

-- 테이블 크기 확인
-- SELECT 
--   name,
--   (SELECT COUNT(*) FROM name) as row_count
-- FROM sqlite_master 
-- WHERE type = 'table';

-- =============================================
-- 주의사항
-- =============================================

-- 1. 인덱스는 쓰기 성능을 약간 저하시킵니다 (약 10-20%)
--    하지만 읽기 성능이 10-100배 향상되므로 전체적으로 유리

-- 2. 너무 많은 인덱스는 오히려 성능 저하
--    - 각 인덱스당 추가 저장 공간 필요
--    - INSERT/UPDATE/DELETE 시 모든 인덱스 갱신 필요

-- 3. 복합 인덱스는 순서가 중요
--    - (user_id, status)는 user_id만으로도 사용 가능
--    - (status, user_id)는 status만으로만 사용 가능

-- 4. Cloudflare D1 제한사항
--    - 최대 인덱스 수: 테이블당 64개
--    - 복합 인덱스: 최대 16개 컬럼
--    - 인덱스 크기: 최대 2048 바이트

-- =============================================
-- 배포 순서
-- =============================================

-- 1. 개발 환경에서 테스트
--    wrangler d1 execute DB --file=database-optimization.sql --local

-- 2. 프로덕션 배포 전 백업
--    wrangler d1 backup create DB

-- 3. 프로덕션 배포
--    wrangler d1 execute DB --file=database-optimization.sql

-- 4. 성능 모니터링
--    - 평균 쿼리 시간 측정
--    - 슬로우 쿼리 로그 확인
--    - CPU/메모리 사용량 모니터링

-- =============================================
-- 예상 비용 절감
-- =============================================

-- Cloudflare Workers CPU 시간 감소: -60%
-- 월간 절감액: $8-12 (DAU 10,000 기준)
-- 응답 시간 개선: -50-80% (쿼리 복잡도에 따라)

-- =============================================
-- 롤백 방법
-- =============================================

-- 인덱스 제거 (필요시)
-- DROP INDEX IF EXISTS idx_products_seller_id;
-- DROP INDEX IF EXISTS idx_orders_user_id;
-- ... (모든 인덱스 제거)
