-- ============================================================
-- Migration 0224: 셀러 7일 부트캠프 온보딩
-- ============================================================
-- 컨셉: 신규 셀러가 가입 후 7일 안에 단계별 체크리스트 완수.
-- 7개 단계 모두 완수 → 자동 보상 (딜 1만).
--
-- 단계 (step_key):
--   1) profile_complete       — 프로필 사진/소개/주소 입력
--   2) first_product          — 첫 상품 등록
--   3) first_live             — 첫 라이브 (15분 이상 권장)
--   4) first_donation         — 첫 후원 받기
--   5) first_payment          — 첫 결제 받기
--   6) first_alimtalk         — 알림톡 첫 발송
--   7) bootcamp_completed     — 7일 완주 (자동 부여)
--
-- 정책: 강제 X — 안 해도 페널티 없음. 단순 가이드 + 보상.
--
-- 작성: 2026-04-27 (Phase 1-5)
-- ============================================================

CREATE TABLE IF NOT EXISTS seller_onboarding_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reward_claimed INTEGER DEFAULT 0,
  UNIQUE (seller_id, step_key)
);
CREATE INDEX IF NOT EXISTS idx_seller_onboarding_seller
  ON seller_onboarding_progress(seller_id, completed_at DESC);
