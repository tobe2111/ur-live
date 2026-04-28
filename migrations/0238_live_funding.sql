-- 🛡️ 2026-04-28: 라이브 펀딩 (와디즈 모델)
--
-- 비즈니스 컨셉:
--   셀러가 PB(Private Brand) 또는 한정판 상품을 사전 펀딩 형태로 판매.
--   목표 금액 (또는 인원) 달성 시 제작·발송. 미달성 시 자동 환불.
--
-- 기존 group_buy 와의 차이:
--   - group_buy: 인원 단위 (10명 모이면 할인), 즉시 발송
--   - funding:   금액 목표 (5천만원 모이면 제작), 마감 후 일정 기간 후 발송
--   - funding:   리워드 등급 (5만원 = 기본판, 10만원 = 한정판 + 굿즈)
--
-- 상태 머신:
--   draft → preparing → live → succeeded/failed/cancelled
--   succeeded → producing → shipping → delivered

CREATE TABLE IF NOT EXISTS live_fundings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  product_id INTEGER,                       -- 연결 product (옵션, MVP 는 별도 모델)
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  category TEXT,                             -- 'goods' | 'tech' | 'food' | 'beauty' | 'fashion' | 'culture'

  -- 목표 + 마감
  target_amount INTEGER NOT NULL,            -- 목표 금액 (원)
  current_amount INTEGER NOT NULL DEFAULT 0, -- 현재 누적 금액
  starts_at DATETIME,
  ends_at DATETIME NOT NULL,                 -- 펀딩 마감 시각
  expected_ship_at DATETIME,                 -- 예상 발송 시각

  -- 상태
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'preparing', 'live', 'succeeded', 'failed', 'cancelled', 'producing', 'shipping', 'delivered')),

  -- 통계 캐시
  backer_count INTEGER NOT NULL DEFAULT 0,    -- 후원자 수 (gift-style 중복 카운트 X)

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (seller_id) REFERENCES sellers(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_live_fundings_seller ON live_fundings(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_live_fundings_status_ends ON live_fundings(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_live_fundings_category ON live_fundings(category, status);

-- 리워드 등급 (5만원 / 10만원 / 30만원 등)
CREATE TABLE IF NOT EXISTS funding_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funding_id INTEGER NOT NULL,
  title TEXT NOT NULL,                       -- "기본판", "한정판 + 굿즈" 등
  description TEXT,
  amount INTEGER NOT NULL,                   -- 후원 금액 (원)
  stock INTEGER,                              -- 한정 수량 (NULL = 무제한)
  claimed INTEGER NOT NULL DEFAULT 0,        -- 현재 신청자 수
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (funding_id) REFERENCES live_fundings(id)
);

CREATE INDEX IF NOT EXISTS idx_funding_rewards_funding ON funding_rewards(funding_id, display_order);

-- 후원 (참여) 기록
CREATE TABLE IF NOT EXISTS funding_backers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funding_id INTEGER NOT NULL,
  reward_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,                   -- 결제 금액
  toss_payment_key TEXT,                     -- 결제 키 (마감 후 환불 시 필요)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'refunded', 'shipped', 'delivered')),
  -- 배송지 (마감 후 입력 가능)
  shipping_address TEXT,
  shipping_address_detail TEXT,
  shipping_postal_code TEXT,
  shipping_phone TEXT,
  paid_at DATETIME,
  refunded_at DATETIME,
  shipped_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (funding_id) REFERENCES live_fundings(id),
  FOREIGN KEY (reward_id) REFERENCES funding_rewards(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_funding_backers_funding ON funding_backers(funding_id, status);
CREATE INDEX IF NOT EXISTS idx_funding_backers_user ON funding_backers(user_id, created_at DESC);
