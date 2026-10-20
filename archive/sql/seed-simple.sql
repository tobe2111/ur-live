-- 간단한 테스트 데이터

-- Users
INSERT OR IGNORE INTO users (name, email) VALUES
  ('김토스', 'test@example.com'),
  ('이라이브', 'live@example.com');

-- Live Streams (sellers already exist from migration)
INSERT OR IGNORE INTO live_streams (title, description, status, youtube_video_id, seller_id, seller_instagram, seller_youtube) VALUES
  ('🔥 겨울 패션 특가 라이브!', '프리미엄 겨울 의류 최대 50% 할인', 'live', 'jNQXAC9IVRw', 1, 'https://instagram.com/seller1', 'https://youtube.com/@seller1'),
  ('⚡ 스마트 전자기기 대방출', '최신 스마트워치, 이어폰 특가', 'live', 'jNQXAC9IVRw', 2, '', ''),
  ('🎁 뷰티 & 헬스케어', '겨울 피부관리 필수템', 'ended', 'jNQXAC9IVRw', 1, '', ''),
  ('🛍️ 홈 데코 & 리빙', '새해 맞이 인테리어 특가', 'scheduled', 'jNQXAC9IVRw', 2, '', '');

-- Products
INSERT OR IGNORE INTO products (name, description, price, discount_rate, stock, image_url, live_stream_id, seller_id, is_active) VALUES
  ('프리미엄 겨울 패딩', '고급 구스다운 충전재', 189000, 20, 50, 'https://picsum.photos/400/400?random=1', 1, 1, 1),
  ('캐시미어 니트', '100% 순수 캐시미어', 129000, 15, 30, 'https://picsum.photos/400/400?random=2', 1, 1, 1),
  ('스마트워치 프로', 'GPS + 건강 모니터링', 349000, 30, 100, 'https://picsum.photos/400/400?random=3', 2, 2, 1),
  ('무선 이어폰', 'ANC 노이즈 캔슬링', 89000, 20, 150, 'https://picsum.photos/400/400?random=4', 2, 2, 1);

SELECT '✅ Seed data inserted' as result;
