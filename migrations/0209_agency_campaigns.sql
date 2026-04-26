-- ============================================================
-- Migration 0209: 에이전시 캠페인 관리 (Agency P0 #4)
-- ============================================================
-- 배경: 에이전시는 셀러의 라이브 일정을 조회만 가능, 직접 캠페인 기획/추적 불가.
-- TikTok Backstage 처럼 에이전시 주도의 캠페인(이벤트)을 만들고
-- 참여 셀러별 KPI/보너스를 설정해 매출 목표 달성을 트래킹.
--
-- 변경 사항:
-- 1) agency_campaigns: 캠페인 기본 정보 (기간, 인센티브 기본율)
-- 2) agency_campaign_participants: 참여 셀러 + 개별 KPI/보너스
-- 3) agency_campaign_orders: 캠페인 기간 동안의 주문 누적 (낙관적 갱신용 view 대체 캐시)
--
-- 작성일: 2026-04-26
-- 참조: docs/AGENCY_BACKSTAGE_GAP_ANALYSIS.md (P0 #4)
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  -- active: 진행 중 / scheduled: 예정 / ended: 종료 / cancelled: 취소
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','ended','cancelled')),
  -- 기본 인센티브율 % (셀러별 bonus_rate 가 우선, 없으면 이 값 사용)
  base_incentive_rate REAL DEFAULT 0,
  -- 캠페인 전체 목표 금액 (옵션, 표시용)
  target_amount INTEGER,
  -- 카테고리/태그 (자유 텍스트, 추후 검색용)
  category TEXT,
  created_by_admin INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE INDEX IF NOT EXISTS idx_agency_campaigns_agency_status
  ON agency_campaigns(agency_id, status, end_date DESC);
CREATE INDEX IF NOT EXISTS idx_agency_campaigns_dates
  ON agency_campaigns(start_date, end_date) WHERE status IN ('scheduled','active');

CREATE TABLE IF NOT EXISTS agency_campaign_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  -- 셀러별 매출 목표 (옵션)
  target_amount INTEGER,
  -- 셀러별 보너스율 % (캠페인 base_incentive_rate 를 override). NULL 이면 base 사용.
  bonus_rate REAL,
  -- 참여 상태
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','withdrawn','removed')),
  -- 누적 매출 (cron 또는 트리거로 갱신, denormalized 캐시)
  current_amount INTEGER DEFAULT 0,
  current_orders INTEGER DEFAULT 0,
  -- 마지막 누적 시각 (stale 검증)
  last_aggregated_at DATETIME,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (campaign_id, seller_id),
  FOREIGN KEY (campaign_id) REFERENCES agency_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_participants_campaign
  ON agency_campaign_participants(campaign_id, current_amount DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_seller
  ON agency_campaign_participants(seller_id, status);
