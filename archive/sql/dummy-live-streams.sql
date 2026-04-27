-- 현재 라이브 중인 더미 데이터 5개 생성
-- YouTube Live Stream 데이터

-- 1. 패션 라이브
INSERT INTO live_streams (title, description, youtube_video_id, status, seller_id, platform, created_at, updated_at)
VALUES (
  '🔥 겨울 신상 패딩 특가! 최대 70% 할인',
  '겨울 시즌 필수 아이템! 따뜻한 패딩부터 스타일리시한 코트까지 모두 준비했어요. 지금 바로 만나보세요!',
  'jfKfPfyJRdk',  -- 실제 YouTube 라이브 스트림 ID (lofi hip hop radio)
  'live',
  1,
  'youtube',
  datetime('now'),
  datetime('now')
);

-- 2. 뷰티 라이브
INSERT INTO live_streams (title, description, youtube_video_id, status, seller_id, platform, created_at, updated_at)
VALUES (
  '💄 신상 화장품 언박싱 & 메이크업 쇼',
  '인기 뷰티 유튜버와 함께하는 특별한 라이브! 신상 화장품 리뷰와 메이크업 꿀팁을 함께 공유합니다.',
  '5qap5aO4i9A',  -- 실제 YouTube 라이브 스트림 ID
  'live',
  2,
  'youtube',
  datetime('now'),
  datetime('now')
);

-- 3. 가전제품 라이브
INSERT INTO live_streams (title, description, youtube_video_id, status, seller_id, platform, created_at, updated_at)
VALUES (
  '⚡ 스마트홈 가전 대전! 오늘만 특가',
  '최신 스마트홈 기기부터 생활가전까지! 실시간 시연과 함께 특별한 가격으로 만나보세요.',
  'BGEGse7vgqs',  -- 실제 YouTube 라이브 스트림 ID
  'live',
  1,
  'youtube',
  datetime('now'),
  datetime('now')
);

-- 4. 푸드 라이브
INSERT INTO live_streams (title, description, youtube_video_id, status, seller_id, platform, created_at, updated_at)
VALUES (
  '🍜 건강한 간편식 BEST 모음',
  '바쁜 일상 속 건강을 챙기는 간편식! 영양사가 직접 추천하는 건강한 먹거리를 소개합니다.',
  'T3A8ybBVU78',  -- 실제 YouTube 라이브 스트림 ID
  'live',
  2,
  'youtube',
  datetime('now'),
  datetime('now')
);

-- 5. 라이프스타일 라이브
INSERT INTO live_streams (title, description, youtube_video_id, status, seller_id, platform, created_at, updated_at)
VALUES (
  '🏠 홈데코 & 인테리어 소품 특집',
  '집을 더 아름답게! 감각적인 인테리어 소품과 홈데코 아이템을 실시간으로 소개합니다.',
  '36YnV9STBqc',  -- 실제 YouTube 라이브 스트림 ID
  'live',
  1,
  'youtube',
  datetime('now'),
  datetime('now')
);

-- 각 라이브 스트림에 대표 상품 추가
-- 패션 라이브 - 패딩
INSERT INTO products (name, description, price, original_price, discount_rate, image_url, stock, category, seller_id, is_active, created_at, updated_at)
VALUES (
  '프리미엄 구스다운 패딩',
  '800 필파워 구스다운 충전재로 최고의 보온성을 제공합니다. 슬림한 핏으로 스타일리시한 겨울 룩 연출!',
  89000,
  299000,
  70,
  'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=800',
  50,
  '패션',
  1,
  1,
  datetime('now'),
  datetime('now')
);

-- 뷰티 라이브 - 화장품 세트
INSERT INTO products (name, description, price, original_price, discount_rate, image_url, stock, category, seller_id, is_active, created_at, updated_at)
VALUES (
  '럭셔리 스킨케어 풀세트',
  '프리미엄 성분으로 피부 고민 해결! 토너, 세럼, 크림까지 완벽한 라인업',
  159000,
  298000,
  47,
  'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800',
  30,
  '뷰티',
  2,
  1,
  datetime('now'),
  datetime('now')
);

-- 가전제품 라이브 - 로봇청소기
INSERT INTO products (name, description, price, original_price, discount_rate, image_url, stock, category, seller_id, is_active, created_at, updated_at)
VALUES (
  'AI 스마트 로봇청소기',
  '자동 매핑, 장애물 회피, 물걸레 기능까지! 집안 청소의 새로운 기준',
  249000,
  499000,
  50,
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
  20,
  '가전',
  1,
  1,
  datetime('now'),
  datetime('now')
);

-- 푸드 라이브 - 건강식
INSERT INTO products (name, description, price, original_price, discount_rate, image_url, stock, category, seller_id, is_active, created_at, updated_at)
VALUES (
  '프로틴 도시락 정기배송 (10팩)',
  '영양사가 설계한 균형잡힌 식단! 고단백 저칼로리 건강 도시락',
  59000,
  89000,
  34,
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  100,
  '식품',
  2,
  1,
  datetime('now'),
  datetime('now')
);

-- 라이프스타일 라이브 - 인테리어 소품
INSERT INTO products (name, description, price, original_price, discount_rate, image_url, stock, category, seller_id, is_active, created_at, updated_at)
VALUES (
  '북유럽 감성 우드 선반세트',
  '자연스러운 원목 느낌의 디자인! 거실, 침실 어디에나 어울리는 만능 선반',
  39000,
  79000,
  51,
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800',
  45,
  '인테리어',
  1,
  1,
  datetime('now'),
  datetime('now')
);

-- 라이브 스트림에 현재 상품 연결 (마지막에 생성된 상품 ID 사용)
UPDATE live_streams SET current_product_id = (SELECT id FROM products WHERE name LIKE '%패딩%') WHERE title LIKE '%패딩%';
UPDATE live_streams SET current_product_id = (SELECT id FROM products WHERE name LIKE '%스킨케어%') WHERE title LIKE '%화장품%';
UPDATE live_streams SET current_product_id = (SELECT id FROM products WHERE name LIKE '%로봇청소기%') WHERE title LIKE '%가전%';
UPDATE live_streams SET current_product_id = (SELECT id FROM products WHERE name LIKE '%도시락%') WHERE title LIKE '%간편식%';
UPDATE live_streams SET current_product_id = (SELECT id FROM products WHERE name LIKE '%선반%') WHERE title LIKE '%인테리어%';
