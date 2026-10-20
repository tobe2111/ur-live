-- 테스트용 시드 데이터
-- 판매자 계정 (approved_by는 나중에 업데이트)
INSERT OR IGNORE INTO sellers (id, username, password_hash, name, email, business_name, status, is_active, created_at, updated_at)
VALUES 
  (1, 'seller1', '$2a$10$placeholder_hash_for_seller123', '김판매', 'seller1@example.com', '토스 패션몰', 'approved', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, 'seller2', '$2a$10$placeholder_hash_for_seller123', '이상품', 'seller2@example.com', '스마트 전자', 'approved', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 테스트용 사용자
INSERT OR IGNORE INTO users (id, name, email, phone, created_at)
VALUES (1, '테스트 구매자', 'buyer@example.com', '010-1234-5678', CURRENT_TIMESTAMP);

-- 테스트용 배송지
INSERT OR IGNORE INTO shipping_addresses (id, user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at)
VALUES (1, 1, '테스트 구매자', '010-1234-5678', '06236', '서울시 강남구 테헤란로 123', '10층', 1, CURRENT_TIMESTAMP);

-- 테스트용 라이브 스트림
INSERT OR IGNORE INTO live_streams (id, title, description, youtube_video_id, status, seller_id, created_at, updated_at)
VALUES (1, '🎮 게이밍 기어 특가 라이브', '프로게이머가 추천하는 필수 아이템!', 'test123', 'live', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 테스트용 상품
INSERT OR IGNORE INTO products (id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, live_stream_id, created_at, updated_at)
VALUES 
  (1, '프리미엄 무선 이어폰', '노이즈 캔슬링 기능이 탑재된 프리미엄 이어폰', 129000, 150000, 14, 'https://picsum.photos/400/400?random=1', 100, '전자기기', 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, '게이밍 키보드', '기계식 스위치가 적용된 RGB 게이밍 키보드', 89000, 120000, 26, 'https://picsum.photos/400/400?random=2', 50, '전자기기', 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
