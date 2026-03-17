-- ============================================================
-- 실제 사용 가능한 상품 데이터 생성
-- 더미 데이터 삭제 및 프로덕션 준비 데이터 추가
-- ============================================================

-- 1. 기존 더미 상품 삭제 (seller_id=3의 테스트 데이터)
DELETE FROM products WHERE seller_id = 3 AND id IN (1, 2, 3, 4, 5, 17, 19, 20, 21);

-- 2. orphan 상품 삭제 (seller_id=1은 존재하지 않음)
DELETE FROM products WHERE seller_id = 1;

-- 3. seller_id=5 (tobe2111@naver.com)를 위한 실제 상품 추가
INSERT INTO products (
  name, description, price, original_price, discount_rate, 
  image_url, thumbnail_url, stock, stock_quantity, category, 
  seller_id, status, is_active, product_type, 
  stock_alert_threshold, reserved_stock
) VALUES
-- 프리미엄 전자제품
('애플 에어팟 프로 2세대', 
 '액티브 노이즈 캔슬링과 공간 오디오를 지원하는 프리미엄 무선 이어폰. MagSafe 충전 케이스 포함. 최대 30시간 재생 가능.',
 329000, 359000, 8,
 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800',
 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=400',
 50, 50, '전자제품',
 5, 'ACTIVE', 1, 'featured',
 10, 0),

('삼성 갤럭시 워치6', 
 '건강과 피트니스를 위한 최신 스마트워치. 수면 추적, 심박수 모니터링, GPS 내장. 5일 배터리 수명.',
 389000, 449000, 13,
 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800',
 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400',
 30, 30, '전자제품',
 5, 'ACTIVE', 1, 'featured',
 5, 0),

-- 패션 의류
('나이키 에어 맥스 97', 
 '아이코닉한 디자인의 클래식 러닝화. 에어 쿠셔닝으로 최고의 착용감 제공. 화이트/블랙 컬러.',
 189000, 219000, 14,
 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
 100, 100, '패션',
 5, 'ACTIVE', 1, 'popular',
 20, 0),

('노스페이스 다운 재킷', 
 '겨울 필수 아이템! 700 필 파워 구스 다운 충전재. 방수 처리 및 경량 디자인.',
 298000, 398000, 25,
 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800',
 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400',
 60, 60, '패션',
 5, 'ACTIVE', 1, 'featured',
 10, 0),

-- 생활용품
('다이슨 무선청소기 V15', 
 '강력한 흡입력과 레이저 먼지 감지 기능. 최대 60분 사용 가능. 10가지 청소 도구 포함.',
 899000, 1099000, 18,
 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800',
 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400',
 25, 25, '생활용품',
 5, 'ACTIVE', 1, 'featured',
 5, 0),

-- 뷰티
('설화수 자음생 크림', 
 '한방 명품 안티에이징 크림. 탄력과 영양 공급. 60ml 대용량.',
 389000, 420000, 7,
 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800',
 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400',
 40, 40, '뷰티',
 5, 'ACTIVE', 1, 'popular',
 5, 0),

-- 식품
('제주 한라봉 프리미엄', 
 '당도 높은 제주 프리미엄 한라봉. 3kg (12-15과). 산지 직송 신선 배송.',
 45000, 55000, 18,
 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=800',
 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=400',
 200, 200, '식품',
 5, 'ACTIVE', 1, 'popular',
 30, 0),

-- 스포츠
('요가 매트 프리미엄 TPE', 
 '친환경 TPE 소재, 두께 8mm. 충격 흡수와 미끄럼 방지. 요가백 포함.',
 58000, 78000, 26,
 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800',
 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400',
 150, 150, '스포츠',
 5, 'ACTIVE', 1, 'popular',
 20, 0);

-- 4. 실제 라이브 스트림 데이터 정리 (끝난 라이브는 ended로 변경)
UPDATE live_streams 
SET status = 'ended', ended_at = datetime('now') 
WHERE status = 'live' AND created_at < datetime('now', '-7 days');

-- 5. 새로운 예정 라이브 추가 (seller_id=5)
INSERT INTO live_streams (
  title, description, youtube_video_id, status, 
  seller_id, scheduled_at, thumbnail_url, viewer_count
) VALUES
('🔥 봄 신상품 특가 라이브', 
 '애플 제품 최대 30% 할인! 에어팟, 갤럭시워치 준비했습니다. 선착순 한정 수량!',
 'upcoming_live_1', 'scheduled',
 5, datetime('now', '+2 days'), 
 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800',
 0);
