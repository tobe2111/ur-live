-- 테스트 라이브 스트림 데이터
-- Video ID Options (임베드 가능한 24/7 라이브 스트림):
-- 1. 4xDzrJKXOOY: synthwave radio - beats to chill/game to (추천 ⭐)
-- 2. 36YnV9STBqc: Space Ambient Music - 24/7 Space Journey
-- 참고: YouTube 임베드 정책이 엄격하므로 자신의 영상을 사용하는 것을 권장합니다
INSERT OR IGNORE INTO live_streams (id, title, description, youtube_video_id, status, created_at) VALUES 
  (1, '토스 라이브 커머스 - 겨울 특집', '겨울 시즌 인기 상품 라이브 방송', '4xDzrJKXOOY', 'live', datetime('now')),
  (2, '토스 라이브 커머스 - 봄맞이 세일', '봄 시즌 특가 상품 방송', 'jNQXAC9IVRw', 'scheduled', datetime('now'));

-- 테스트 상품 데이터
INSERT OR IGNORE INTO products (id, name, description, price, original_price, discount_rate, image_url, stock, category, live_stream_id, is_active) VALUES 
  (1, '프리미엄 겨울 패딩', '따뜻하고 가벼운 겨울 필수 아이템', 89000, 150000, 40, 'https://picsum.photos/400/400?random=1', 50, '패션', 1, 1),
  (2, '스마트워치 프로', '건강 관리와 편의를 한번에', 249000, 350000, 28, 'https://picsum.photos/400/400?random=2', 30, '전자기기', 1, 1),
  (3, '프리미엄 커피 세트', '엄선된 원두로 만든 프리미엄 커피', 45000, 60000, 25, 'https://picsum.photos/400/400?random=3', 100, '식품', 1, 1),
  (4, '무선 이어폰 X', '뛰어난 음질과 노이즈 캔슬링', 129000, 180000, 28, 'https://picsum.photos/400/400?random=4', 80, '전자기기', 1, 1),
  (5, '유기농 스킨케어 세트', '자연 그대로의 건강한 피부 관리', 65000, 90000, 27, 'https://picsum.photos/400/400?random=5', 60, '뷰티', 2, 1);

-- 테스트 상품 옵션
INSERT OR IGNORE INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES 
  (1, 'color', '블랙', 0, 20),
  (1, 'color', '네이비', 0, 15),
  (1, 'color', '베이지', 0, 15),
  (1, 'size', 'S', 0, 10),
  (1, 'size', 'M', 0, 20),
  (1, 'size', 'L', 0, 15),
  (1, 'size', 'XL', 0, 5),
  (2, 'color', '실버', 0, 15),
  (2, 'color', '골드', 5000, 10),
  (2, 'color', '블랙', 0, 5),
  (4, 'color', '화이트', 0, 40),
  (4, 'color', '블랙', 0, 40);

-- 테스트 사용자
INSERT OR IGNORE INTO users (id, toss_user_id, name, email, phone) VALUES 
  (1, 'toss_user_001', '김토스', 'kim@example.com', '010-1234-5678'),
  (2, 'toss_user_002', '이페이', 'lee@example.com', '010-2345-6789');

-- 테스트 장바구니
INSERT OR IGNORE INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id) VALUES 
  (1, 1, 1, 1, 89000, 1),
  (1, 2, 8, 1, 249000, 1);

-- 라이브 스트림의 현재 상품 업데이트
UPDATE live_streams SET current_product_id = 1 WHERE id = 1;
