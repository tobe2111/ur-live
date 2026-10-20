-- 테스트 데이터 시드

-- 1. 사용자 추가
INSERT OR IGNORE INTO users (id, name, email, phone, created_at) VALUES
  (1, '김토스', 'test@example.com', '010-1234-5678', CURRENT_TIMESTAMP),
  (2, '이라이브', 'live@example.com', '010-2345-6789', CURRENT_TIMESTAMP);

-- Note: sellers는 0003 마이그레이션에서 이미 추가됨 (seller1, seller2)

-- 2. 라이브 스트림 추가
INSERT OR IGNORE INTO live_streams (id, title, description, status, youtube_video_id, seller_id, thumbnail_url, platform, created_at) VALUES
  (1, '🔥 겨울 패션 특가 라이브!', '프리미엄 겨울 의류 최대 50% 할인', 'live', 'dQw4w9WgXcQ', 1, 'https://picsum.photos/800/450?random=1', 'youtube', CURRENT_TIMESTAMP),
  (2, '⚡ 스마트 전자기기 대방출', '최신 스마트워치, 이어폰 특가', 'scheduled', 'dQw4w9WgXcQ', 2, 'https://picsum.photos/800/450?random=2', 'youtube', CURRENT_TIMESTAMP),
  (3, '🎁 뷰티 & 헬스케어', '겨울 피부관리 필수템', 'ended', 'dQw4w9WgXcQ', 1, 'https://picsum.photos/800/450?random=3', 'youtube', CURRENT_TIMESTAMP),
  (4, '🛍️ 홈 데코 & 리빙', '새해 맞이 인테리어 특가', 'live', 'jNQXAC9IVRw', 2, 'https://picsum.photos/800/450?random=4', 'youtube', CURRENT_TIMESTAMP);

-- 3. 상품 추가 (재고를 충분히 설정)
INSERT OR IGNORE INTO products (id, name, description, price, discount_rate, stock, image_url, live_stream_id, seller_id, is_active, created_at) VALUES
  -- 라이브 1 상품
  (1, '프리미엄 겨울 패딩', '고급 구스다운 충전재, 방수 기능', 189000, 20, 100, 'https://picsum.photos/400/400?random=11', 1, 1, 1, CURRENT_TIMESTAMP),
  (2, '캐시미어 니트', '100% 순수 캐시미어', 129000, 15, 100, 'https://picsum.photos/400/400?random=12', 1, 1, 1, CURRENT_TIMESTAMP),
  (3, '울 코트', '이탈리아 울 100%', 259000, 25, 100, 'https://picsum.photos/400/400?random=13', 1, 1, 1, CURRENT_TIMESTAMP),
  -- 라이브 2 상품
  (4, '스마트워치 프로', '건강 모니터링 + GPS', 349000, 30, 100, 'https://picsum.photos/400/400?random=21', 2, 2, 1, CURRENT_TIMESTAMP),
  (5, '무선 이어폰', '노이즈 캔슬링 ANC', 89000, 20, 100, 'https://picsum.photos/400/400?random=22', 2, 2, 1, CURRENT_TIMESTAMP),
  (6, '태블릿 10인치', '고성능 프로세서', 449000, 15, 100, 'https://picsum.photos/400/400?random=23', 2, 2, 1, CURRENT_TIMESTAMP),
  -- 라이브 3 상품
  (7, '프리미엄 스킨케어 세트', '보습+탄력 케어', 79000, 30, 100, 'https://picsum.photos/400/400?random=31', 3, 1, 1, CURRENT_TIMESTAMP),
  (8, '비타민 C 세럼', '피부 톤 개선', 45000, 25, 100, 'https://picsum.photos/400/400?random=32', 3, 1, 1, CURRENT_TIMESTAMP),
  -- 라이브 4 상품 (참치 상품 추가!)
  (9, '모던 테이블 램프', 'LED 터치 조명', 39000, 20, 100, 'https://picsum.photos/400/400?random=41', 4, 2, 1, CURRENT_TIMESTAMP),
  (10, '감성 쿠션 세트', '프리미엄 벨벳 소재', 29000, 15, 100, 'https://picsum.photos/400/400?random=42', 4, 2, 1, CURRENT_TIMESTAMP),
  (19, '국민 참치 대뱃살 부위 할인가', '신선한 참치 대뱃살', 45000, 10, 100, 'https://picsum.photos/400/400?random=19', 4, 2, 1, CURRENT_TIMESTAMP),
  (21, '국내산 참치 대뱃살 파격 특가!', '국내산 신선 참치', 45000, 15, 100, 'https://picsum.photos/400/400?random=21', 4, 2, 1, CURRENT_TIMESTAMP);

-- 4. 현재 노출 상품 설정 (라이브 스트림별 메인 상품)
UPDATE live_streams SET current_product_id = 1 WHERE id = 1;
UPDATE live_streams SET current_product_id = 4 WHERE id = 2;
UPDATE live_streams SET current_product_id = 7 WHERE id = 3;
UPDATE live_streams SET current_product_id = 9 WHERE id = 4;

-- 5. 상품 옵션 추가 (일부 상품만)
INSERT OR IGNORE INTO product_options (id, product_id, option_type, option_value, price_adjustment, stock, created_at) VALUES
  -- 패딩 옵션
  (1, 1, '색상/사이즈', '블랙 / S', 0, 30, CURRENT_TIMESTAMP),
  (2, 1, '색상/사이즈', '블랙 / M', 0, 40, CURRENT_TIMESTAMP),
  (3, 1, '색상/사이즈', '블랙 / L', 0, 30, CURRENT_TIMESTAMP),
  (4, 1, '색상/사이즈', '네이비 / M', 0, 30, CURRENT_TIMESTAMP),
  -- 스마트워치 옵션
  (5, 4, '색상/연결', '블랙 / GPS', 0, 50, CURRENT_TIMESTAMP),
  (6, 4, '색상/연결', '실버 / GPS+LTE', 50000, 50, CURRENT_TIMESTAMP);

-- 6. 완료
SELECT '✅ Seed data inserted successfully' as result;
