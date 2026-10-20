-- ============================================================
-- Migration 0207: 에이전시 크리에이터 심사 워크플로우 (Agency P0 #1)
-- ============================================================
-- 배경: 에이전시가 셀러 초대 시 즉시 'approved' 상태로 생성되어
--       사업자 검증/사기 방어 기제 부재. TikTok Agency Backstage 표준에 맞춤.
--
-- 변경 사항:
-- 1) sellers 테이블에 affiliated_agency_id, documents_submitted_at 컬럼 추가
-- 2) agency_creator_approvals 신규 테이블 (심사 큐)
--
-- 작성일: 2026-04-26
-- 참조: docs/AGENCY_BACKSTAGE_GAP_ANALYSIS.md (P0 #1)
-- ============================================================

-- 1) sellers 컬럼 추가 (방어적: 이미 존재해도 OK)
-- D1 SQLite 는 ADD COLUMN IF NOT EXISTS 미지원 → 별도 try/catch 패턴은 마이그레이션 러너 측에서 처리.
-- repair-schema 엔드포인트는 SELECT 후 누락 시만 추가하므로 idempotent.
ALTER TABLE sellers ADD COLUMN affiliated_agency_id INTEGER;
ALTER TABLE sellers ADD COLUMN documents_submitted_at DATETIME;

-- 2) agency_creator_approvals 심사 큐
CREATE TABLE IF NOT EXISTS agency_creator_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  agency_id INTEGER NOT NULL,
  business_number TEXT,
  id_image_url TEXT,
  -- pending: 심사 대기 / approved: 승인 / rejected: 반려
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason TEXT,
  reviewed_by INTEGER,         -- admin_id
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

-- 빠른 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_agency_creator_approvals_status
  ON agency_creator_approvals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_creator_approvals_seller
  ON agency_creator_approvals(seller_id);
CREATE INDEX IF NOT EXISTS idx_agency_creator_approvals_agency
  ON agency_creator_approvals(agency_id, created_at DESC);
