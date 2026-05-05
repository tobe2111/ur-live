-- 2026-05-05: 셀러 자동 등급화 + 광고 입찰 + 어뷰징 baseline (Day 1-2)
--
-- 1) 셀러 5단계 자동 등급 (diamond/gold/silver/bronze/new)
-- 2) 등급 변경 이력 (seller_tier_history)
-- 3) 광고 슬롯 입찰 시스템 (ad_slots, ad_bids) — 2차 수익원
-- 4) 셀러 baseline 통계 (이상치 탐지용)

-- ═══════════════════════════════════════════════════════════════
-- 1) sellers 등급 컬럼
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE sellers ADD COLUMN tier TEXT DEFAULT 'new'
  CHECK(tier IN ('diamond','gold','silver','bronze','new'));

ALTER TABLE sellers ADD COLUMN tier_score REAL DEFAULT 0;

ALTER TABLE sellers ADD COLUMN tier_updated_at DATETIME;

ALTER TABLE sellers ADD COLUMN exposure_weight REAL DEFAULT 1.0;
-- 노출 가중치 — 추천 정렬에 곱해짐 (diamond=4.0, gold=2.5, silver=1.5, bronze=1.0, new=0.7)

CREATE INDEX IF NOT EXISTS idx_sellers_tier_active
  ON sellers(tier, is_active);
CREATE INDEX IF NOT EXISTS idx_sellers_exposure_weight
  ON sellers(exposure_weight DESC, is_active);

-- ═══════════════════════════════════════════════════════════════
-- 2) 등급 변경 이력
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS seller_tier_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  prev_tier TEXT,
  new_tier TEXT,
  prev_score REAL,
  new_score REAL,
  metrics_json TEXT,                     -- JSON: gmv, cvr, donation, repurchase_rate, refund_rate
  changed_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tier_history_seller
  ON seller_tier_history(seller_id, changed_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 3) 광고 슬롯 + 입찰 (2차 수익원)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ad_slots (
  slot_id TEXT PRIMARY KEY,              -- 'main_hero' | 'category_top_1' | 'live_recommend_1' | 'live_recommend_2' | 'live_recommend_3'
  display_name TEXT NOT NULL,            -- '메인 hero 영역'
  description TEXT,
  base_price INTEGER NOT NULL DEFAULT 50000,  -- 일 단위 KRW (시작가)
  current_seller_id INTEGER,             -- 현재 낙찰자
  current_bid INTEGER,                   -- 현재 입찰가
  starts_at DATETIME,
  expires_at DATETIME,                   -- 보통 24시간
  auto_renew INTEGER DEFAULT 0,          -- 자동 재입찰 여부
  is_active INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_ad_slots_active_expires
  ON ad_slots(is_active, expires_at);

CREATE TABLE IF NOT EXISTS ad_bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id TEXT NOT NULL,
  seller_id INTEGER NOT NULL,
  bid_amount INTEGER NOT NULL CHECK(bid_amount > 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','won','lost','cancelled','refunded')),
  start_period DATETIME,                 -- 노출 시작 (낙찰 시 set)
  end_period DATETIME,
  payment_status TEXT DEFAULT 'pending'
    CHECK(payment_status IN ('pending','approved','failed')),
  toss_payment_key TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ad_bids_slot_status
  ON ad_bids(slot_id, status, bid_amount DESC);
CREATE INDEX IF NOT EXISTS idx_ad_bids_seller
  ON ad_bids(seller_id, created_at DESC);

-- 초기 슬롯 시드
INSERT OR IGNORE INTO ad_slots (slot_id, display_name, description, base_price) VALUES
  ('main_hero', '메인 hero 영역', '메인 홈 최상단 24시간 노출', 100000),
  ('category_top_1', '카테고리 상위 1', '카테고리 첫 번째 슬롯 (24시간)', 50000),
  ('live_recommend_1', '라이브 추천 1', '라이브 페이지 추천 1순위', 80000),
  ('live_recommend_2', '라이브 추천 2', '라이브 페이지 추천 2순위', 50000),
  ('live_recommend_3', '라이브 추천 3', '라이브 페이지 추천 3순위', 30000);

-- ═══════════════════════════════════════════════════════════════
-- 4) 셀러 baseline 통계 (이상치 탐지용)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS seller_baseline_stats (
  seller_id INTEGER PRIMARY KEY,
  -- 후원 baseline (최근 30일)
  avg_donation_amount REAL DEFAULT 0,
  std_donation_amount REAL DEFAULT 0,
  donation_count_30d INTEGER DEFAULT 0,
  -- 주문 baseline
  avg_orders_per_day REAL DEFAULT 0,
  std_orders_per_day REAL DEFAULT 0,
  -- 구매자 특성
  median_buyer_account_age_days REAL DEFAULT 0,
  -- 갱신 시각
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- 5) 셀러별 일별 KPI 캐시 (LTV/CVR/ARPU 빠른 조회)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS seller_kpi_daily (
  seller_id INTEGER NOT NULL,
  date DATE NOT NULL,
  unique_viewers INTEGER DEFAULT 0,
  viewers_purchased INTEGER DEFAULT 0,
  gmv INTEGER DEFAULT 0,
  donation_total INTEGER DEFAULT 0,
  cvr REAL DEFAULT 0,                    -- viewers_purchased / unique_viewers
  arpu INTEGER DEFAULT 0,                -- gmv / unique_viewers
  refund_amount INTEGER DEFAULT 0,
  refund_count INTEGER DEFAULT 0,
  PRIMARY KEY (seller_id, date)
);
CREATE INDEX IF NOT EXISTS idx_seller_kpi_date
  ON seller_kpi_daily(date DESC, seller_id);
