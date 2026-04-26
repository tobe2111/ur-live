-- ============================================================
-- Migration 0210: 에이전시 인센티브 규칙 엔진 (Agency P0 #5)
-- ============================================================
-- 배경: 현재 수수료는 commission_rate (기본 2%) 단일 고정.
-- TikTok Backstage 처럼 매출/평점/방송 횟수 등 KPI 기반 인센티브 자동 계산.
--
-- 변경 사항:
-- 1) agency_incentive_rules: 에이전시별 인센티브 규칙
--    metric: sales | rating | streams | orders | viewers
-- 2) agency_incentive_payouts: 월별 인센티브 지급 내역
-- 3) cron 매월 1일 새벽 자동 계산 (별도 worker/cron 파일)
--
-- 작성일: 2026-04-26
-- 참조: docs/AGENCY_BACKSTAGE_GAP_ANALYSIS.md (P0 #5)
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_incentive_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  -- 평가 metric
  metric TEXT NOT NULL CHECK (metric IN ('sales','rating','streams','orders','viewers')),
  -- 임계치 (metric 따라 단위 다름: sales=원, rating=별점, streams=회, orders=건, viewers=명)
  threshold REAL NOT NULL,
  -- 보너스율 % (commission 위에 추가로 지급)
  bonus_rate REAL NOT NULL,
  -- 활성화 여부
  is_active INTEGER NOT NULL DEFAULT 1,
  -- 우선순위 (높은 순 — 동일 셀러가 여러 규칙 충족 시 max bonus 적용)
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE INDEX IF NOT EXISTS idx_incentive_rules_agency_active
  ON agency_incentive_rules(agency_id, is_active, priority DESC);

CREATE TABLE IF NOT EXISTS agency_incentive_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  -- 평가 대상 월 (YYYY-MM)
  month TEXT NOT NULL,
  -- 적용된 rule (NULL 가능 — 어떤 규칙도 충족 못 한 경우)
  rule_id INTEGER,
  -- 평가된 metric 값 (snapshot)
  metric_value REAL NOT NULL,
  -- 매출 기반 commission 원금
  base_commission INTEGER NOT NULL DEFAULT 0,
  -- 추가 보너스 (rule.bonus_rate × 매출)
  bonus_commission INTEGER NOT NULL DEFAULT 0,
  -- 총 지급액
  total INTEGER NOT NULL DEFAULT 0,
  -- 지급 상태
  status TEXT NOT NULL DEFAULT 'calculated' CHECK (status IN ('calculated','paid','cancelled')),
  paid_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (agency_id, seller_id, month),
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (seller_id) REFERENCES sellers(id),
  FOREIGN KEY (rule_id) REFERENCES agency_incentive_rules(id)
);

CREATE INDEX IF NOT EXISTS idx_incentive_payouts_month
  ON agency_incentive_payouts(month, status);
CREATE INDEX IF NOT EXISTS idx_incentive_payouts_agency_seller
  ON agency_incentive_payouts(agency_id, seller_id, month DESC);
