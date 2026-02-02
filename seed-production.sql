-- 프로덕션 데이터 시드
-- 실행: npx wrangler d1 execute toss-live-commerce-db --remote --file=./seed-production.sql

-- 1. 라이브 스트림
INSERT OR IGNORE INTO live_streams (id, title, description, youtube_video_id, status, current_product_id) 
VALUES 
  (1, '🎄 겨울 특가 라이브 - 최대 50% 할인', '겨울 시즌 인기 상품 특가 방송! 지금 바로 만나보세요', 'dQw4w9WgXcQ', 'live', 1),
  (2, '🌸 봄 신상품 라이브', '봄 시즌 신상품 미리보기', 'dQw4w9WgXcQ', 'scheduled', NULL);

-- 2. 상품 데이터
INSERT OR IGNORE INTO products (id, name, description, price, original_price, discount_rate, image_url, stock, category, live_stream_id, is_active) 
VALUES 
  -- 패션 카테고리
  (1, '프리미엄 겨울 패딩', '방수 기능이 있는 고급 구스다운 패딩', 89000, 150000, 40, 'https://picsum.photos/400/400?random=1', 50, '패션', 1, 1),
  (2, '캐시미어 니트', '100% 순수 캐시미어 니트', 120000, 180000, 33, 'https://picsum.photos/400/400?random=11', 30, '패션', 1, 1),
  (3, '레더 부츠', '이탈리아산 천연 가죽 부츠', 150000, 220000, 31, 'https://picsum.photos/400/400?random=12', 25, '패션', 1, 1),
  
  -- 전자기기 카테고리
  (4, '스마트워치 프로', '심박수/수면 추적 기능', 249000, 350000, 28, 'https://picsum.photos/400/400?random=2', 30, '전자기기', 1, 1),
  (5, '무선 이어폰 X', '노이즈 캔슬링 + 30시간 배터리', 129000, 180000, 28, 'https://picsum.photos/400/400?random=4', 80, '전자기기', 1, 1),
  (6, '스마트 스피커 미니', 'AI 음성인식 + 스마트홈 제어', 79000, 120000, 34, 'https://picsum.photos/400/400?random=13', 100, '전자기기', 1, 1),
  
  -- 식품 카테고리
  (7, '프리미엄 커피 세트', '싱글 오리진 원두 3종 세트', 45000, 60000, 25, 'https://picsum.photos/400/400?random=3', 100, '식품', 1, 1),
  (8, '견과류 선물세트', '유기농 믹스 너트 5종', 35000, 50000, 30, 'https://picsum.photos/400/400?random=14', 150, '식품', 1, 1),
  
  -- 뷰티 카테고리
  (9, '히알루론산 세럼', '수분 집중 케어 앰플', 59000, 89000, 33, 'https://picsum.photos/400/400?random=15', 200, '뷰티', 1, 1),
  (10, '스킨케어 세트', '토너+로션+크림 3종', 89000, 130000, 31, 'https://picsum.photos/400/400?random=16', 80, '뷰티', 1, 1);

-- 3. 상품 옵션 (프로덕션 스키마: option_type, option_value)
INSERT OR IGNORE INTO product_options (id, product_id, option_type, option_value, price_adjustment, stock) 
VALUES 
  -- 프리미엄 겨울 패딩 옵션
  (1, 1, '색상', '블랙', 0, 20),
  (2, 1, '색상', '네이비', 0, 15),
  (3, 1, '색상', '베이지', 0, 15),
  (4, 1, '사이즈', 'S', 0, 10),
  (5, 1, '사이즈', 'M', 0, 20),
  (6, 1, '사이즈', 'L', 0, 15),
  (7, 1, '사이즈', 'XL', 0, 5),
  
  -- 캐시미어 니트 옵션
  (8, 2, '색상', '아이보리', 0, 10),
  (9, 2, '색상', '그레이', 0, 10),
  (10, 2, '색상', '네이비', 0, 10),
  (11, 2, '사이즈', 'S', 0, 10),
  (12, 2, '사이즈', 'M', 0, 15),
  (13, 2, '사이즈', 'L', 0, 5),
  
  -- 레더 부츠 옵션
  (14, 3, '사이즈', '230', 0, 5),
  (15, 3, '사이즈', '240', 0, 8),
  (16, 3, '사이즈', '250', 0, 7),
  (17, 3, '사이즈', '260', 0, 5),
  
  -- 스마트워치 프로 옵션
  (18, 4, '색상', '블랙', 0, 15),
  (19, 4, '색상', '실버', 0, 10),
  (20, 4, '색상', '로즈골드', 0, 5),
  
  -- 무선 이어폰 X 옵션
  (21, 5, '색상', '화이트', 0, 40),
  (22, 5, '색상', '블랙', 0, 40),
  
  -- 커피 세트 옵션
  (23, 7, '원두 타입', '에티오피아', 0, 40),
  (24, 7, '원두 타입', '콜롬비아', 0, 30),
  (25, 7, '원두 타입', '과테말라', 0, 30);

-- 4. 테스트 유저
INSERT OR IGNORE INTO users (id, toss_user_id, name, email, phone) 
VALUES 
  (1, 'test_user_001', '테스트 유저', 'test@ur-team.com', '010-1234-5678'),
  (2, 'guest_user_001', '게스트', NULL, NULL);

-- 통계 확인
SELECT '=== 데이터 시드 완료 ===' as message;
SELECT 'Live Streams: ' || COUNT(*) as stat FROM live_streams;
SELECT 'Products: ' || COUNT(*) as stat FROM products;
SELECT 'Product Options: ' || COUNT(*) as stat FROM product_options;
SELECT 'Users: ' || COUNT(*) as stat FROM users;
