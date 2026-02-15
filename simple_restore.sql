-- 간단한 테스트 데이터 (기존 프로덕션 데이터 활용)

-- 판매자 1명만 추가
INSERT OR IGNORE INTO sellers (id, username, password_hash, name, email, phone, business_name, business_number, status, is_active, created_at)
VALUES 
(1, 'test_seller', '$2a$10$dummy', '테스트판매자', 'test@test.com', '010-1234-5678', '테스트샵', '123-45-67890', 'approved', 1, datetime('now'));

-- 라이브 스트림 3개 (간단 버전)
INSERT OR IGNORE INTO live_streams (id, title, description, youtube_video_id, status, seller_id, scheduled_at, created_at)
VALUES 
(1, '겨울 패션 특가전 🧥', '따뜻한 겨울 코트와 니트 최대 50% 할인!', '5qap5aO4i9A', 'live', 1, datetime('now', '-1 hour'), datetime('now', '-2 hours')),
(2, '뷰티 신상품 론칭쇼 💄', '2024 S/S 신상 화장품 단독 공개!', '5qap5aO4i9A', 'live', 1, datetime('now', '-30 minutes'), datetime('now', '-1 hour')),
(3, '홈데코 인테리어 특집 🏡', '새학기 맞이 인테리어 소품 대방출!', '5qap5aO4i9A', 'scheduled', 1, datetime('now', '+1 hour'), datetime('now', '-3 hours'));

-- 상품 15개
INSERT OR IGNORE INTO products (id, name, description, price, original_price, discount_rate, image_url, category, stock, seller_id, is_active)
VALUES 
(1, '울 블렌드 롱 코트', '고급스러운 울 소재의 따뜻한 겨울 코트', 189000, 259000, 27, 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=500', 'fashion', 45, 1, 1),
(2, '캐시미어 터틀넥 니트', '부드러운 캐시미어 100% 프리미엄 니트', 129000, 189000, 32, 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=500', 'fashion', 67, 1, 1),
(3, '오버핏 패딩 점퍼', '가볍고 따뜻한 구스다운 패딩', 159000, 229000, 31, 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=500', 'fashion', 52, 1, 1),
(4, '울 체크 머플러', '따뜻한 울 소재 체크 패턴 머플러', 39000, 59000, 34, 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=500', 'fashion', 120, 1, 1),
(5, '가죽 장갑', '고급 양가죽 터치 가능 장갑', 49000, 69000, 29, 'https://images.unsplash.com/photo-1611652022419-a9419f74343a?w=500', 'fashion', 88, 1, 1),
(6, '하이드레이팅 세럼', '피부 깊숙이 수분을 채워주는 히알루론산 세럼', 45000, 65000, 31, 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500', 'beauty', 150, 1, 1),
(7, '비타민C 토너', '피부 톤업과 보습을 동시에! 비타민C 토너', 38000, 52000, 27, 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?w=500', 'beauty', 200, 1, 1),
(8, '쿠션 파운데이션', '24시간 지속되는 커버력, SPF50+', 42000, 58000, 28, 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500', 'beauty', 180, 1, 1),
(9, '립 틴트 세트', '촉촉한 발색, 오래 지속되는 립 틴트 3종 세트', 35000, 51000, 31, 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500', 'beauty', 220, 1, 1),
(10, '아이 팔레트', '데일리 메이크업 필수 아이섀도우 10색', 48000, 68000, 29, 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=500', 'beauty', 95, 1, 1),
(11, '북유럽 스타일 테이블 램프', '감성 조명으로 분위기 연출', 79000, 115000, 31, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500', 'home', 75, 1, 1),
(12, '면 100% 쿠션 커버 세트', '부드러운 촉감의 쿠션 커버 4종 세트', 29000, 45000, 36, 'https://images.unsplash.com/photo-1556912167-f556f1f39faa?w=500', 'home', 130, 1, 1),
(13, '우드 벽시계', '내추럴한 우드 소재 벽시계', 45000, 62000, 27, 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=500', 'home', 88, 1, 1),
(14, '인테리어 액자 3종 세트', '모던한 디자인 아트 프레임', 59000, 89000, 34, 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500', 'home', 95, 1, 1),
(15, '디퓨저 선물 세트', '은은한 향기로 힐링 타임', 38000, 55000, 31, 'https://images.unsplash.com/photo-1602874801006-96e0908e8188?w=500', 'home', 160, 1, 1);

-- 라이브-상품 연결
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, display_order, is_featured)
VALUES 
(1, 1, 1, 1), (1, 2, 2, 1), (1, 3, 3, 0), (1, 4, 4, 0), (1, 5, 5, 0),
(2, 6, 1, 1), (2, 7, 2, 1), (2, 8, 3, 0), (2, 9, 4, 0), (2, 10, 5, 0),
(3, 11, 1, 1), (3, 12, 2, 1), (3, 13, 3, 0), (3, 14, 4, 0), (3, 15, 5, 0);

