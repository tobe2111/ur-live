-- Complete Product Seed Data with Detail Images, Options, and Long Descriptions
-- 2026-03-17: For production demo and testing

-- Clear existing products (optional - comment out if you want to keep existing data)
-- DELETE FROM products WHERE id BETWEEN 1 AND 10;
-- DELETE FROM product_options WHERE product_id BETWEEN 1 AND 10;

-- Insert or Update Products with Complete Data
INSERT OR REPLACE INTO products (
  id, name, description, long_description, price, compare_at_price, 
  stock_quantity, category, thumbnail_url, detail_images, 
  seller_id, status, created_at, updated_at
) VALUES

-- Product 1: Premium Wireless Headphones
(1, 
 'Premium Wireless Headphones', 
 'Premium noise-cancelling headphones with 30-hour battery life.',
 '최고급 노이즈 캔슬링 헤드폰으로 완벽한 몰입감을 선사합니다.

【주요 특징】
✓ 액티브 노이즈 캔슬링 (ANC) 기술
✓ 30시간 초장시간 배터리
✓ 고해상도 40mm 드라이버
✓ 블루투스 5.0 무선 연결
✓ 접이식 디자인으로 휴대 편리
✓ 프리미엄 가죽 이어패드

【제품 사양】
- 드라이버: 40mm 다이나믹 드라이버
- 주파수 응답: 20Hz - 20kHz
- 무게: 250g
- 충전 시간: 2.5시간
- 연결 방식: Bluetooth 5.0, 3.5mm AUX
- 노이즈 캔슬링: 최대 30dB 감쇄

【패키지 구성】
- 헤드폰 본체 x 1
- USB-C 충전 케이블 x 1
- 3.5mm AUX 케이블 x 1
- 휴대용 파우치 x 1
- 사용 설명서 x 1

음악 감상, 영화 시청, 업무 집중에 최적화된 프리미엄 헤드폰입니다.',
 89000, 149000, 50, 'fashion',
 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
 '["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200", "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=1200", "https://images.unsplash.com/photo-1545127398-14699f92334b?w=1200", "https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=1200"]',
 1, 'active', datetime('now'), datetime('now')),

-- Product 2: Classic White Sneakers
(2,
 'Classic White Sneakers',
 'Timeless white sneakers perfect for any outfit.',
 '어떤 옷에도 잘 어울리는 클래식 화이트 스니커즈입니다.

【주요 특징】
✓ 100% 프리미엄 가죽
✓ 편안한 쿠션 인솔
✓ 미끄럼 방지 고무 밑창
✓ 통기성 좋은 안감
✓ 클래식한 화이트 컬러
✓ 남녀공용 디자인

【사이즈 가이드】
- 230mm (US 5 / EU 36)
- 240mm (US 6 / EU 37)
- 250mm (US 7 / EU 38)
- 260mm (US 8 / EU 39)
- 270mm (US 9 / EU 40)
- 280mm (US 10 / EU 41)

【관리 방법】
1. 부드러운 천으로 먼지 제거
2. 전용 크리너로 오염 제거
3. 자연 건조 (직사광선 피할 것)
4. 방수 스프레이 사용 권장

【스타일링 팁】
- 청바지와 티셔츠: 캐주얼 룩
- 슬랙스와 셔츠: 스마트 캐주얼
- 원피스: 페미닌 스포티 룩
- 쇼츠와 후디: 스트릿 룩

모든 계절, 모든 스타일에 완벽한 매치!',
 120000, 180000, 100, 'fashion',
 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
 '["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200", "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=1200", "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=1200", "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=1200"]',
 1, 'active', datetime('now'), datetime('now')),

-- Product 3: Leather Backpack
(3,
 'Leather Backpack',
 'Premium leather backpack with multiple compartments.',
 '프리미엄 천연 가죽으로 제작된 고급 백팩입니다.

【주요 특징】
✓ 100% 천연 소가죽
✓ 15인치 노트북 수납 가능
✓ 다층 수납공간 (7개 포켓)
✓ 견고한 YKK 지퍼
✓ 편안한 패딩 스트랩
✓ 방수 코팅 처리

【수납 공간】
- 메인 포켓: 노트북 + A4 서류
- 앞면 포켓: 지갑, 핸드폰
- 사이드 포켓 x2: 물통, 우산
- 내부 포켓 x3: 카드, 열쇠, 소품

【제품 사양】
- 소재: 천연 소가죽 (Full Grain Leather)
- 사이즈: 42cm (H) x 30cm (W) x 15cm (D)
- 무게: 1.2kg
- 컬러: 다크 브라운
- 노트북 수납: 최대 15.6인치

【관리 방법】
1. 가죽 전용 크리너 사용
2. 월 1회 가죽 영양 크림 도포
3. 습기 제거제와 함께 보관
4. 직사광선과 고온 피할 것

【A/S 안내】
- 1년 무상 수선
- 지퍼 교체, 스트랩 교체 가능
- 가죽 염색 및 복원 서비스

비즈니스, 여행, 일상 모든 순간에 함께하는 동반자!',
 75000, 110000, 30, 'goods',
 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800',
 '["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200", "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=1200", "https://images.unsplash.com/photo-1546938576-6e6a64f317cc?w=1200", "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&crop=bottom"]',
 1, 'active', datetime('now'), datetime('now')),

-- Product 4: Sports Watch
(4,
 'Sports Watch',
 'Advanced fitness tracking with heart rate monitoring.',
 '운동과 건강 관리를 위한 스마트 스포츠 워치입니다.

【주요 특징】
✓ 24시간 심박수 모니터링
✓ 30종 운동 모드 지원
✓ 5ATM 방수 (수영 가능)
✓ GPS 내장 (실시간 경로 추적)
✓ 7일 배터리 수명
✓ 스마트폰 알림 연동

【운동 모드】
- 실내/실외 러닝
- 사이클링
- 수영 (수영장/개방 수역)
- 요가, 필라테스
- 웨이트 트레이닝
- 등산, 트레킹
- 농구, 축구, 테니스 등

【건강 모니터링】
- 심박수: 24시간 실시간 측정
- 혈중 산소: SpO2 측정
- 수면 분석: 깊은/얕은 수면 구분
- 스트레스 레벨: 자동 감지
- 생리 주기: 여성 건강 관리
- 호흡 훈련: 명상 가이드

【스마트 기능】
- 전화/문자 알림
- 날씨 정보
- 음악 컨트롤
- 스마트폰 찾기
- 알람 및 타이머
- 스톱워치

【제품 사양】
- 디스플레이: 1.4인치 AMOLED
- 해상도: 454 x 454
- 배터리: 420mAh (7일 사용)
- 방수: 5ATM (50m)
- 연결: Bluetooth 5.0
- 무게: 45g (스트랩 포함)

【패키지 구성】
- 워치 본체 x 1
- 실리콘 스트랩 x 1
- 충전 독 x 1
- 사용 설명서 x 1

건강한 라이프스타일의 시작!',
 189000, 250000, 25, 'fashion',
 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
 '["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200", "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=1200", "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=1200", "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=1200"]',
 1, 'active', datetime('now'), datetime('now')),

-- Product 5: Designer Sunglasses
(5,
 'Designer Sunglasses',
 'UV protection sunglasses with polarized lenses.',
 '프리미엄 편광 렌즈로 눈부신 햇빛을 차단하는 디자이너 선글라스입니다.

【주요 특징】
✓ UV400 100% 자외선 차단
✓ 편광 렌즈 (Polarized)
✓ 티타늄 프레임 (초경량)
✓ 스크래치 방지 코팅
✓ 반사 방지 코팅
✓ 케이스 & 안경닦이 포함

【렌즈 기술】
- UV400: 자외선 100% 차단
- 편광 필터: 수면/도로 반사광 제거
- 멀티 코팅: 스크래치, 먼지 방지
- 고선명 렌즈: 왜곡 최소화

【프레임 소재】
- 티타늄 합금: 초경량, 내구성
- 무게: 단 18g
- 탄성 경첩: 압력 분산
- 실리콘 코패드: 흘러내림 방지

【렌즈 컬러 옵션】
1. 그레이: 자연스러운 색 재현 (일상용)
2. 브라운: 대비 향상 (운전용)
3. 그린: 눈의 피로 감소 (골프용)
4. 미러 실버: 반사 차단 (스키/바다)

【사용 시나리오】
- 운전: 도로 반사광 차단
- 낚시: 수면 반사 제거
- 골프: 잔디 대비 향상
- 등산: 눈부심 차단
- 비치: 모래/바다 반사 차단

【인증】
- CE 인증 (유럽 안전 기준)
- FDA 승인 (미국 식약청)
- UV400 인증서 포함

【패키지 구성】
- 선글라스 본체 x 1
- 하드 케이스 x 1
- 마이크로파이버 파우치 x 1
- 안경닦이 x 1
- UV 테스트 카드 x 1
- 인증서 x 1

스타일과 눈 건강, 두 마리 토끼를 모두 잡는 선택!',
 125000, 200000, 40, 'fashion',
 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800',
 '["https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=1200", "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1200", "https://images.unsplash.com/photo-1509695507497-903c140c43b0?w=1200", "https://images.unsplash.com/photo-1577803645773-f96470509666?w=1200"]',
 1, 'active', datetime('now'), datetime('now')),

-- Product 6: Canvas Tote Bag
(6,
 'Canvas Tote Bag',
 'Eco-friendly canvas tote bag for everyday use.',
 '친환경 캔버스 소재로 제작된 실용적인 토트백입니다.

【주요 특징】
✓ 100% 천연 면 캔버스
✓ 친환경 염료 사용
✓ 15kg 하중 지지
✓ 세탁기 세탁 가능
✓ 심플 미니멀 디자인
✓ 남녀공용

【사이즈 정보】
- 가로: 38cm
- 세로: 42cm
- 마치: 10cm
- 손잡이 길이: 60cm
- 용량: 약 16L

【소재 정보】
- 본체: 12oz 캔버스 (100% 면)
- 손잡이: 이중 박음질 보강
- 염료: 친환경 무독성
- 인증: OEKO-TEX 100

【활용 방법】
1. 장보기: 마트, 시장
2. 출퇴근: 노트북, 서류
3. 학교: 교과서, 필통
4. 여행: 기내 수하물
5. 운동: 운동복, 신발
6. 피크닉: 돗자리, 간식

【세탁 방법】
- 세탁기 사용 가능 (30°C 이하)
- 중성 세제 사용
- 자연 건조 권장
- 다림질 가능 (중온)

【친환경 포인트】
✓ 플라스틱 봉투 대체
✓ 재사용 가능 (수명 3년+)
✓ 생분해 가능 소재
✓ 탄소 발자국 감소

【커스터마이징】
- 열전사 프린팅 가능
- 자수 가능
- 페인팅 가능
- 배지 부착 가능

【패키지 구성】
- 토트백 x 1
- 친환경 종이 패키지
- 재활용 라벨

일상의 모든 순간, 지구를 생각하는 선택!',
 45000, 70000, 80, 'goods',
 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800',
 '["https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=1200", "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=1200", "https://images.unsplash.com/photo-1596510915377-f9b2d6c10638?w=1200", "https://images.unsplash.com/photo-1610718666020-38c0c4d3fa55?w=1200"]',
 1, 'active', datetime('now'), datetime('now'));


-- Insert Product Options
INSERT OR REPLACE INTO product_options (id, product_id, option_type, option_value, price_adjustment, stock_quantity, created_at) VALUES
-- Product 1: Headphones - Color options
(1, 1, 'color', 'Black', 0, 20, datetime('now')),
(2, 1, 'color', 'Silver', 0, 15, datetime('now')),
(3, 1, 'color', 'Blue', 5000, 15, datetime('now')),

-- Product 2: Sneakers - Size options
(4, 2, 'size', '250mm', 0, 20, datetime('now')),
(5, 2, 'size', '260mm', 0, 25, datetime('now')),
(6, 2, 'size', '270mm', 0, 30, datetime('now')),
(7, 2, 'size', '280mm', 0, 25, datetime('now')),

-- Product 3: Backpack - Color options
(8, 3, 'color', 'Dark Brown', 0, 15, datetime('now')),
(9, 3, 'color', 'Black', 0, 10, datetime('now')),
(10, 3, 'color', 'Cognac', 8000, 5, datetime('now')),

-- Product 4: Watch - Color options
(11, 4, 'color', 'Black', 0, 10, datetime('now')),
(12, 4, 'color', 'Navy', 0, 8, datetime('now')),
(13, 4, 'color', 'White', 10000, 7, datetime('now')),

-- Product 5: Sunglasses - Lens Color options
(14, 5, 'lens_color', 'Gray', 0, 15, datetime('now')),
(15, 5, 'lens_color', 'Brown', 0, 12, datetime('now')),
(16, 5, 'lens_color', 'Green', 5000, 8, datetime('now')),
(17, 5, 'lens_color', 'Mirror Silver', 10000, 5, datetime('now')),

-- Product 6: Tote Bag - Color options
(18, 6, 'color', 'Natural', 0, 30, datetime('now')),
(19, 6, 'color', 'Black', 0, 25, datetime('now')),
(20, 6, 'color', 'Navy', 0, 25, datetime('now'));

-- Commit
SELECT 'Complete product data seeded successfully!' as result;
