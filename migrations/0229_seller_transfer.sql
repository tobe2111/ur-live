-- ============================================================
-- Migration 0229: 셀러 이전 (Network 마켓플레이스)
-- ============================================================
-- 컨셉: 에이전시 A 가 셀러를 에이전시 B 에게 이전 신청.
--   3자 동의 흐름:
--     1) A 신청 (from_agency 발의)
--     2) B 수락/거절 (to_agency 응답)
--     3) 셀러 본인 동의/거부 (final approval)
--   → 모두 동의 시 agency_sellers 매핑 변경.
--
-- 정책:
--   - 어드민 검토/취소 가능
--   - 이전 후 30일 내 재이전 차단 (cooldown)
--   - 이전 시 진행 중 정산/캠페인은 from_agency 가 마무리
--
-- 작성: 2026-04-27 (Phase 3-5)
-- ============================================================

CREATE TABLE IF NOT EXISTS seller_transfer_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  from_agency_id INTEGER NOT NULL,
  to_agency_id INTEGER NOT NULL,
  reason TEXT,                                          -- 이전 사유
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted_by_to', 'approved_by_seller', 'completed', 'rejected', 'cancelled')),
  to_response_at DATETIME,                              -- B 가 응답한 시각
  to_response TEXT,                                     -- 'accept' | 'reject'
  seller_response_at DATETIME,                          -- 셀러가 응답한 시각
  seller_response TEXT,                                 -- 'approve' | 'reject'
  completed_at DATETIME,                                -- 매핑 변경 완료 시각
  rejection_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (seller_id, from_agency_id, to_agency_id, status)
);
CREATE INDEX IF NOT EXISTS idx_transfer_seller ON seller_transfer_requests(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_from ON seller_transfer_requests(from_agency_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_to ON seller_transfer_requests(to_agency_id, status);
