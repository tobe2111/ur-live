-- 🛡️ 2026-05-18: 숙소 (stay_voucher) 공구 완전 구현 — Foundation schema.
--   사용자 요청: '야놀자/Booking.com 수준 완벽 구현, 모든 대시보드에 기록'.
--
--   범위 (PR 1 / 6):
--     - 숙소 메타 정보 (시설/규정/취소 정책)
--     - 객실 타입 (스탠다드/디럭스/스위트) 다객실 지원
--     - 날짜별 가격/재고 캘린더 (성수기/주말/공휴일)
--     - 예약 (체크인-체크아웃) 본 테이블
--     - 게스트 정보 + 특이 요청
--     - 체크인 QR 코드
--     - 리뷰 (사용 후) + 사진
--
--   후속 PR 2-6: 셀러/사용자/어드민/에이전시 UI + 알림 + 결제.

-- ─── 1. product_stay_info ───────────────────────────────────────────────
-- 1:1 with products. 'stay_voucher' 카테고리 상품에만 row 존재.

CREATE TABLE IF NOT EXISTS product_stay_info (
  product_id INTEGER PRIMARY KEY,

  -- 숙박 시설 정보
  property_type TEXT NOT NULL DEFAULT 'pension',
    -- 'hotel' / 'motel' / 'pension' / 'guesthouse' / 'resort' / 'glamping' / 'house'
  star_rating INTEGER,                       -- 1-5 (호텔만)
  total_rooms INTEGER NOT NULL DEFAULT 1,    -- 전체 객실 수 (참고용)

  -- 체크인/체크아웃 시간 (24h 형식: '15:00')
  check_in_time TEXT NOT NULL DEFAULT '15:00',
  check_out_time TEXT NOT NULL DEFAULT '11:00',

  -- 위치 (검색용 — 기존 restaurant_address 와 별개로 위경도 명시)
  address TEXT,
  address_detail TEXT,
  postal_code TEXT,
  region_sido TEXT,        -- 시/도 (지역 필터링용 — '서울', '제주' 등)
  region_sigungu TEXT,     -- 시/군/구
  latitude REAL,
  longitude REAL,

  -- 시설 (JSON array of strings)
  --   예: ["wifi","parking","breakfast","pool","spa","gym","sauna","pet_friendly","bbq","kitchen"]
  amenities TEXT,

  -- 객실 공통 시설 (객실별로 다른 건 product_stay_rooms.amenities)
  --   예: ["aircon","tv","refrigerator","kitchen","bath","shower","balcony"]
  room_amenities TEXT,

  -- 정책
  cancellation_policy TEXT NOT NULL DEFAULT 'standard',
    -- 'flexible'   = 체크인 24시간 전까지 100% 환불
    -- 'standard'   = 체크인 48시간 전까지 100%, 24시간 전까지 50%
    -- 'strict'     = 체크인 72시간 전까지 50%, 이후 환불 불가
    -- 'non_refundable' = 환불 불가 (대신 가격 ↓)
  custom_cancellation_text TEXT,    -- 세부 안내 (셀러 자유 입력)

  -- 규정 (자유 텍스트)
  house_rules TEXT,                  -- '금연 / 반려동물 불가 / 파티 금지' 등
  check_in_instructions TEXT,        -- '리셉션에서 신분증 제시 / 비밀번호 안내' 등

  -- 부가 정보
  description_full TEXT,             -- 상세 설명 (Markdown 가능)
  nearby_attractions TEXT,           -- JSON array: [{name, distance_km, type}]

  -- 운영
  min_nights INTEGER NOT NULL DEFAULT 1,   -- 최소 숙박 박수 (성수기 2박 이상 등)
  max_nights INTEGER,                       -- 최대 숙박 박수 (NULL = 제한 없음)
  advance_booking_days INTEGER NOT NULL DEFAULT 90,
    -- 사용자가 며칠 전까지 예약 가능한지 (예: 90일치 캘린더만 노출)

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stay_info_region ON product_stay_info(region_sido, region_sigungu);
CREATE INDEX IF NOT EXISTS idx_stay_info_type ON product_stay_info(property_type);
CREATE INDEX IF NOT EXISTS idx_stay_info_location ON product_stay_info(latitude, longitude);

-- ─── 2. product_stay_rooms ──────────────────────────────────────────────
-- N rooms per stay product. '스탠다드 더블 / 디럭스 트윈 / 스위트' 같은 객실 타입.

CREATE TABLE IF NOT EXISTS product_stay_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,

  name TEXT NOT NULL,                      -- '스탠다드 더블', '디럭스 트윈' 등
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,

  -- 객실 정원
  base_guests INTEGER NOT NULL DEFAULT 2,  -- 기준 인원 (2인 기준 가격)
  max_guests INTEGER NOT NULL DEFAULT 2,   -- 최대 입실 가능

  -- 추가 인원 요금
  extra_guest_fee INTEGER NOT NULL DEFAULT 0,
    -- 기준 인원 초과 1인당 추가 요금 (1박 기준)

  -- 침대 구성 (참고용 표시)
  bed_config TEXT,    -- '퀸 1', '싱글 2', '더블 1 + 싱글 1'

  -- 면적
  room_size_sqm REAL,    -- 객실 면적 (㎡)

  -- 기본 가격 (1박 기준 — 캘린더 override 없을 때 fallback)
  base_price_weekday INTEGER NOT NULL,    -- 평일 (일~목)
  base_price_weekend INTEGER NOT NULL,    -- 주말 (금~토)
  base_price_holiday INTEGER,             -- 공휴일/성수기 (NULL → weekend 사용)

  -- 재고 (이 타입의 객실 총 갯수)
  total_inventory INTEGER NOT NULL DEFAULT 1,

  -- 객실 전용 시설 (JSON array)
  amenities TEXT,
  --   예: ["balcony","ocean_view","bathtub","king_bed"]

  -- 이미지 (JSON array of URLs, 첫번째가 대표)
  image_urls TEXT,

  -- 운영
  is_active INTEGER NOT NULL DEFAULT 1,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stay_rooms_product ON product_stay_rooms(product_id, display_order);
CREATE INDEX IF NOT EXISTS idx_stay_rooms_active ON product_stay_rooms(product_id, is_active);

-- ─── 3. product_stay_calendar ───────────────────────────────────────────
-- 날짜별 가용 + 가격 override. UNIQUE(room_id, stay_date) 로 1일 1 row.

CREATE TABLE IF NOT EXISTS product_stay_calendar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,    -- 검색 쿼리 가속용 (FK 중복 OK)

  stay_date TEXT NOT NULL,           -- 'YYYY-MM-DD' 형식
  available_count INTEGER NOT NULL,  -- 해당 날짜 잔여 객실 수 (예약될 때마다 감소)
  price_override INTEGER,            -- NULL → base_price 사용 / 숫자 → 강제 적용

  -- 차단 (셀러가 일시 폐쇄 / 내부 사용 / 정비 등)
  is_blocked INTEGER NOT NULL DEFAULT 0,
  blocked_reason TEXT,

  -- 메모 (어드민/셀러 내부용)
  internal_note TEXT,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES product_stay_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(room_id, stay_date)
);
CREATE INDEX IF NOT EXISTS idx_stay_cal_room_date ON product_stay_calendar(room_id, stay_date);
CREATE INDEX IF NOT EXISTS idx_stay_cal_date_avail ON product_stay_calendar(stay_date, available_count);
CREATE INDEX IF NOT EXISTS idx_stay_cal_product_date ON product_stay_calendar(product_id, stay_date);

-- ─── 4. stay_bookings ───────────────────────────────────────────────────
-- 사용자의 실제 예약. orders 테이블의 stay 전용 sub-record.

CREATE TABLE IF NOT EXISTS stay_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,         -- orders.id (결제 단위)
  product_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,        -- 검색 쿼리 가속용
  user_id INTEGER NOT NULL,

  -- 예약 기간
  check_in_date TEXT NOT NULL,       -- 'YYYY-MM-DD'
  check_out_date TEXT NOT NULL,
  nights INTEGER NOT NULL,           -- check_out - check_in (캐시)

  -- 게스트
  guest_count INTEGER NOT NULL DEFAULT 1,
  guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  guest_email TEXT,

  -- 특이 요청 (자유 텍스트 — 어린이 동반, 알레르기 등)
  special_request TEXT,

  -- 가격 분해 (감사 용도)
  room_total INTEGER NOT NULL,        -- 객실 총액 (날짜별 합산)
  extra_guest_fee INTEGER NOT NULL DEFAULT 0,
  cleaning_fee INTEGER NOT NULL DEFAULT 0,    -- 청소비 (있을 시)
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL,      -- 최종 결제 금액

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending'      = 결제 대기
    -- 'confirmed'    = 결제 완료, 체크인 대기
    -- 'checked_in'   = 체크인 완료 (셀러가 처리)
    -- 'checked_out'  = 체크아웃 완료
    -- 'cancelled'    = 취소 (환불 처리됨)
    -- 'no_show'      = 노쇼
    -- 'refunded'     = 환불 완료
    -- 'dispute'      = 분쟁 진행 중

  -- 체크인 QR (셀러가 스캔)
  check_in_code TEXT,                  -- 8자리 코드 (예: 'A3K7-9M2P')
  checked_in_at DATETIME,
  checked_in_by INTEGER,               -- seller_id (체크인 처리한 직원/셀러)
  checked_out_at DATETIME,

  -- 환불
  cancelled_at DATETIME,
  cancellation_reason TEXT,
  refund_amount INTEGER,
  refunded_at DATETIME,

  -- 노쇼/분쟁
  no_show_marked_at DATETIME,
  no_show_marked_by INTEGER,
  dispute_id INTEGER,                  -- disputes.id

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (room_id) REFERENCES product_stay_rooms(id) ON DELETE RESTRICT,
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_stay_bookings_order ON stay_bookings(order_id);
CREATE INDEX IF NOT EXISTS idx_stay_bookings_seller_status ON stay_bookings(seller_id, status, check_in_date);
CREATE INDEX IF NOT EXISTS idx_stay_bookings_user ON stay_bookings(user_id, check_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_stay_bookings_product_dates ON stay_bookings(product_id, check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_stay_bookings_status_dates ON stay_bookings(status, check_in_date);
CREATE INDEX IF NOT EXISTS idx_stay_bookings_checkin_code ON stay_bookings(check_in_code);

-- ─── 5. stay_booking_reviews ────────────────────────────────────────────
-- 체크아웃 후 리뷰. product_reviews 와 별개 — 숙소 전용 평점 카테고리.

CREATE TABLE IF NOT EXISTS stay_booking_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL UNIQUE,    -- 1 예약 = 1 리뷰
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,

  -- 5가지 카테고리 평점 (1-5)
  rating_cleanliness REAL,      -- 청결도
  rating_location REAL,          -- 위치
  rating_service REAL,           -- 서비스
  rating_facility REAL,          -- 시설
  rating_value REAL,             -- 가성비
  rating_overall REAL NOT NULL,  -- 전체 (5개 평균 또는 별도)

  -- 코멘트
  title TEXT,
  comment TEXT,
  photos TEXT,                   -- JSON array of image URLs

  -- 셀러 답글
  seller_reply TEXT,
  seller_replied_at DATETIME,

  -- 운영
  is_visible INTEGER NOT NULL DEFAULT 1,    -- 어드민 숨김 가능
  is_verified INTEGER NOT NULL DEFAULT 1,   -- 실제 예약자 (자동 TRUE — booking_id UNIQUE)
  helpful_count INTEGER NOT NULL DEFAULT 0, -- 다른 사용자 '도움됨' 클릭

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (booking_id) REFERENCES stay_bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stay_reviews_product ON stay_booking_reviews(product_id, is_visible, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stay_reviews_overall ON stay_booking_reviews(product_id, rating_overall DESC);

-- ─── 6. stay_property_amenities (lookup) ────────────────────────────────
-- 시설 아이콘/라벨 메타데이터. 셀러 등록 폼 + 사용자 표시에서 사용.

CREATE TABLE IF NOT EXISTS stay_property_amenities (
  code TEXT PRIMARY KEY,           -- 'wifi', 'parking', 'breakfast' 등
  label_ko TEXT NOT NULL,
  label_en TEXT NOT NULL,
  icon_emoji TEXT,                 -- '📶', '🅿️', '🍳'
  category TEXT NOT NULL,          -- 'property' / 'room' / 'service'
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- 기본 시설 시드 (자주 쓰는 것만 30개)
INSERT OR IGNORE INTO stay_property_amenities (code, label_ko, label_en, icon_emoji, category, display_order) VALUES
  ('wifi',         '와이파이',     'Wi-Fi',           '📶', 'property', 10),
  ('parking',      '주차 가능',    'Parking',         '🅿️', 'property', 20),
  ('parking_free', '무료 주차',    'Free Parking',    '🅿️', 'property', 21),
  ('breakfast',    '조식 제공',    'Breakfast',       '🍳', 'service',  30),
  ('pool',         '수영장',       'Pool',            '🏊', 'property', 40),
  ('spa',          '스파',         'Spa',             '💆', 'property', 50),
  ('gym',          '피트니스',     'Gym',             '🏋️', 'property', 60),
  ('sauna',        '사우나',       'Sauna',           '🧖', 'property', 70),
  ('pet_friendly', '반려동물 동반', 'Pet Friendly',    '🐾', 'property', 80),
  ('bbq',          'BBQ 시설',     'BBQ',             '🍖', 'property', 90),
  ('kitchen',      '주방',         'Kitchen',         '🍳', 'room',     100),
  ('kitchenette',  '간이주방',     'Kitchenette',     '🍴', 'room',     105),
  ('aircon',       '에어컨',       'Air Conditioning','❄️', 'room',     110),
  ('heating',      '난방',         'Heating',         '🔥', 'room',     120),
  ('tv',           'TV',           'TV',              '📺', 'room',     130),
  ('refrigerator', '냉장고',       'Refrigerator',    '🧊', 'room',     140),
  ('washer',       '세탁기',       'Washer',          '🌀', 'room',     145),
  ('bath',         '욕조',         'Bathtub',         '🛁', 'room',     150),
  ('shower',       '샤워실',       'Shower',          '🚿', 'room',     155),
  ('balcony',      '발코니',       'Balcony',         '🪟', 'room',     160),
  ('ocean_view',   '오션뷰',       'Ocean View',      '🌊', 'room',     170),
  ('mountain_view','마운틴뷰',     'Mountain View',   '🏔️', 'room',     175),
  ('city_view',    '시티뷰',       'City View',       '🏙️', 'room',     180),
  ('non_smoking',  '금연실',       'Non-Smoking',     '🚭', 'room',     185),
  ('smoking',      '흡연실',       'Smoking',         '🚬', 'room',     186),
  ('concierge',    '컨시어지',     'Concierge',       '🛎️', 'service',  200),
  ('luggage',      '짐 보관',      'Luggage Storage', '🧳', 'service',  210),
  ('shuttle',      '셔틀 서비스',  'Shuttle',         '🚐', 'service',  220),
  ('reception_24', '24시간 리셉션','24h Reception',   '🕐', 'service',  230),
  ('elevator',     '엘리베이터',   'Elevator',        '🛗', 'property', 240);

-- ─── 7. stay_booking_status_log ─────────────────────────────────────────
-- 예약 상태 변경 이력 (분쟁 / 감사 / 셀러 책임 추적).

CREATE TABLE IF NOT EXISTS stay_booking_status_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  prev_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_role TEXT NOT NULL,      -- 'user' / 'seller' / 'admin' / 'system'
  changed_by_id INTEGER,
  reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES stay_bookings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stay_booking_status_log_booking ON stay_booking_status_log(booking_id, created_at DESC);

-- ─── 8. 기존 orders 테이블 — 숙소 예약 메타 추가 ─────────────────────
-- 빠른 조회용 (JOIN 없이 my_orders 페이지에서 표시).

ALTER TABLE orders ADD COLUMN stay_booking_id INTEGER;
ALTER TABLE orders ADD COLUMN stay_check_in_date TEXT;
ALTER TABLE orders ADD COLUMN stay_check_out_date TEXT;
ALTER TABLE orders ADD COLUMN stay_nights INTEGER;
CREATE INDEX IF NOT EXISTS idx_orders_stay_booking ON orders(stay_booking_id) WHERE stay_booking_id IS NOT NULL;
