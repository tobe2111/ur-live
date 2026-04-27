-- ============================================================
-- Migration 0217: 에이전시 멀티 권한 (Multi-role) — M4
-- ============================================================
-- 배경: 현재 에이전시 = 1계정 모델. TikTok Backstage 처럼
-- owner / manager / agent / analyst 다중 역할 분리 필요.
-- 운영 규모화 (1인 ↔ N인 팀) 의 기반.
--
-- Phase 1 (이 마이그레이션):
--   1) agency_members 테이블 — 에이전시 소속 멤버 + 역할 + 권한
--   2) 에이전시 owner 자동 생성 (기존 agencies.email = owner)
--   3) Phase 2 (별도 PR): 인증 미들웨어 통합
--
-- 역할:
--   - owner:    모든 권한 + 멤버 관리 + 정산 + 계약
--   - manager:  영입/캠페인/메시지/쿠폰 + 정산 신청 (계약/멤버 X)
--   - agent:    영입/메시지/쿠폰 + 조회 (정산/캠페인 생성 X)
--   - analyst:  조회만 (모든 변경 X)
--
-- 작성일: 2026-04-26 (M4)
-- 참조: docs/AGENCY_BACKSTAGE_LEARNING.md (E. 에이전트 권한)
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  -- 멤버 식별: 이메일 (초대 단계 + 가입 후 user_id 매핑)
  email TEXT NOT NULL,
  user_id INTEGER,                                  -- users.id (가입 완료 후 채워짐)
  -- 역할
  role TEXT NOT NULL CHECK (role IN ('owner','manager','agent','analyst')),
  -- 세분 권한 (JSON, role 디폴트 위에 오버라이드)
  -- {"invite":true,"settle":false,"campaign":true,"message":true,"coupon":true,"contract":false,"view":true}
  permissions TEXT,
  -- 상태: invited (초대됨, 미가입) / active (활동 중) / suspended (일시 정지) / removed
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','active','suspended','removed')),
  -- 초대 토큰 (가입 링크에 포함, 만료 시간 별도)
  invite_token TEXT,
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invited_by INTEGER,                               -- agency_members.id of inviter
  joined_at DATETIME,
  last_active_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (agency_id, email),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agency_members_agency
  ON agency_members(agency_id, status, role);
CREATE INDEX IF NOT EXISTS idx_agency_members_email
  ON agency_members(email, status);
CREATE INDEX IF NOT EXISTS idx_agency_members_invite_token
  ON agency_members(invite_token) WHERE invite_token IS NOT NULL;

-- 기존 에이전시 owner 자동 생성 (멱등 — INSERT OR IGNORE)
-- agencies.email 이 곧 owner email. 기존 owner 가 빠지지 않도록.
INSERT OR IGNORE INTO agency_members (agency_id, email, role, status, joined_at)
SELECT id, email, 'owner', 'active', created_at
FROM agencies
WHERE email IS NOT NULL;
