-- ============================================================
-- Migration 0278: 큐레이터 링크샵 + 핀 시스템 (Phase 1 인프라)
-- 2026-05-25
--
-- 목적: 모든 유저가 본인 공개 페이지(/u/:handle)에서 상품 핀 큐레이션.
--       클릭 → 상품 페이지 ?ref={user_id} → 기존 affiliate_ref 시스템 재활용
--       → 결제 시 affiliate_earnings 자동 적립 (큐레이터 정산 = referrer_id SUM).
--
-- 영구성:
--   * users.handle UNIQUE — 핸들 충돌 0 보장
--   * product_pins UNIQUE(user_id, product_id) — 중복 핀 0
--   * pin_click_logs ip_hash — 사기 탐지 + 일일 supply
--
-- 의존:
--   * users.id (INTEGER, 기존)
--   * products.id (INTEGER, 기존)
--   * products.referral_enabled / referral_commission_rate (migration 0271, 기존)
-- ============================================================

-- ── 1. users 컬럼 추가 ──────────────────────────────────────
ALTER TABLE users ADD COLUMN handle TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN linkshop_theme TEXT DEFAULT 'dark';

-- handle UNIQUE (NULL 은 다중 허용 — partial index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_unique
  ON users(handle) WHERE handle IS NOT NULL;

-- ── 2. product_pins 테이블 ─────────────────────────────────
CREATE TABLE IF NOT EXISTS product_pins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_product_pins_user_pos
  ON product_pins(user_id, position);
CREATE INDEX IF NOT EXISTS idx_product_pins_product
  ON product_pins(product_id);

-- ── 3. pin_click_logs (클릭 추적 + 봇 탐지) ────────────────
CREATE TABLE IF NOT EXISTS pin_click_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pin_id INTEGER NOT NULL,
  curator_user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  visitor_user_id INTEGER,           -- 로그인 방문자 (nullable)
  ip_hash TEXT,                       -- SHA256(ip + daily_salt) — IP 직접 저장 X
  user_agent_hash TEXT,
  referer TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pin_id) REFERENCES product_pins(id)
);

CREATE INDEX IF NOT EXISTS idx_pin_clicks_pin_time
  ON pin_click_logs(pin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pin_clicks_curator_time
  ON pin_click_logs(curator_user_id, created_at);
