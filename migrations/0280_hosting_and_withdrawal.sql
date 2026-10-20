-- ============================================================
-- Migration 0280: 호스팅 시스템 (Phase 3) + 큐레이터 정산 SSOT (Phase 4)
-- 2026-05-25
--
-- 목적:
--   Phase 3: 모든 유저가 voucher 공구 호스팅 가능
--   Phase 4: 큐레이터 정산 = affiliate_earnings SUM (재활용)
--          + user_withdrawals (mig 0274) 재활용
--          + 셀러 자동 승급 안내 (누적 정산액 기반)
--
-- 의존: products (group_buy_*), users (mig 0278 handle), affiliate_earnings, user_withdrawals
--
-- 영구성:
--   * group_buy_hosts UNIQUE(host_user_id, product_id) — 호스트당 같은 공구 1개
--   * invite_code UNIQUE — URL 안전 (slugify_random)
--   * 모든 컬럼 idempotent ALTER (repair-schema)
-- ============================================================

-- ── 1. group_buy_hosts (호스트별 공구 모집 세션) ────────────
-- 어드민이 등록한 product 의 공구를 호스트가 본인 이름으로 모집.
-- product 자체의 group_buy_* 와 별개 — host_user_id 별 통계 분리.
CREATE TABLE IF NOT EXISTS group_buy_hosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  host_user_id INTEGER NOT NULL,
  invite_code TEXT NOT NULL,
  -- URL-safe slug (8자 hex), 공유 링크 `/g/:invite_code`
  target_quantity INTEGER NOT NULL DEFAULT 5,
  -- 호스트가 설정한 본인 목표 (product.group_buy_target 과 별개)
  current_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  -- 'active' | 'achieved' | 'expired' | 'cancelled'
  deadline_at DATETIME,
  note TEXT,
  -- 호스트의 한 줄 ("같이 사실 분?")
  total_earnings INTEGER NOT NULL DEFAULT 0,
  -- 누적 인센티브 적립액 (denormalized for dashboard)
  achieved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(host_user_id, product_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (host_user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gbh_invite_code ON group_buy_hosts(invite_code);
CREATE INDEX IF NOT EXISTS idx_gbh_host_status ON group_buy_hosts(host_user_id, status);
CREATE INDEX IF NOT EXISTS idx_gbh_product_status ON group_buy_hosts(product_id, status);

-- ── 2. group_buy_host_participants (참여자 audit) ────────────
-- 어떤 친구가 invite_code 로 들어와 참여했는지 — 호스트 dashboard 표시 + 사기 탐지.
CREATE TABLE IF NOT EXISTS group_buy_host_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  quantity INTEGER NOT NULL DEFAULT 1,
  earnings INTEGER NOT NULL DEFAULT 0,
  -- 본 참여로 호스트가 적립받은 금액
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(host_id, user_id),
  -- 같은 친구 1회만 카운트 (스팸 방지)
  FOREIGN KEY (host_id) REFERENCES group_buy_hosts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_gbhp_host ON group_buy_host_participants(host_id, joined_at DESC);

-- ── 3. users 컬럼 추가 — 셀러 승급 트래킹 (Phase 4) ──────────
ALTER TABLE users ADD COLUMN curator_total_lifetime_earnings INTEGER NOT NULL DEFAULT 0;
-- 누적 평생 정산액 (denormalized, 빠른 승급 안내 조회용)
ALTER TABLE users ADD COLUMN seller_upgrade_offered_at DATETIME;
-- 셀러 승급 안내 띄운 시각 (중복 안내 방지)
