-- Disable foreign key checks temporarily
PRAGMA foreign_keys = OFF;

-- Users
INSERT OR IGNORE INTO users (name, email) VALUES
  ('김토스', 'test@example.com'),
  ('이라이브', 'live@example.com');

-- Live Streams
INSERT OR IGNORE INTO live_streams (title, description, status, youtube_video_id, seller_id) VALUES
  ('🔥 겨울 패션 특가 라이브!', '프리미엄 겨울 의류 최대 50% 할인', 'live', 'jNQXAC9IVRw', 1),
  ('⚡ 스마트 전자기기 대방출', '최신 스마트워치, 이어폰 특가', 'live', 'jNQXAC9IVRw', 2),
  ('🎁 뷰티 & 헬스케어', '겨울 피부관리 필수템', 'ended', 'jNQXAC9IVRw', 1),
  ('🛍️ 홈 데코 & 리빙', '새해 맞이 인테리어 특가', 'scheduled', 'jNQXAC9IVRw', 2);

-- Products
INSERT OR IGNORE INTO products (name, description, price, discount_rate, stock, image_url, live_stream_id, seller_id, is_active) VALUES
  ('프리미엄 겨울 패딩', '고급 구스다운 충전재', 189000, 20, 50, 'https://picsum.photos/400/400?random=1', 1, 1, 1),
  ('캐시미어 니트', '100% 순수 캐시미어', 129000, 15, 30, 'https://picsum.photos/400/400?random=2', 1, 1, 1),
  ('스마트워치 프로', 'GPS + 건강 모니터링', 349000, 30, 100, 'https://picsum.photos/400/400?random=3', 2, 2, 1),
  ('무선 이어폰', 'ANC 노이즈 캔슬링', 89000, 20, 150, 'https://picsum.photos/400/400?random=4', 2, 2, 1),
  ('프리미엄 스킨케어 세트', '보습+탄력', 79000, 30, 80, 'https://picsum.photos/400/400?random=5', 3, 1, 1),
  ('모던 테이블 램프', 'LED 터치', 39000, 20, 60, 'https://picsum.photos/400/400?random=6', 4, 2, 1);

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;

SELECT '✅ Seed data inserted successfully!' as result;
