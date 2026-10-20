-- 🛡️ 2026-05-18: 셀러 등급별 voucher 발행 한도.
--
--   배경: 신규 / 저등급 셀러가 무제한 voucher 발행 → 어뷰즈 / 매장 운영 부담.
--   해결: 등급별 월 voucher 발행 가능 갯수 제한.
--
--   적용:
--     - 브론즈: 월 5개 (신규 검증용)
--     - 실버: 월 20개
--     - 골드: 월 50개
--     - 플래티넘: 월 200개
--     - 다이아: 무제한 (-1)
--
--   계산:
--     - 한도 = 활성 (is_active=1) + 이번 달 생성 product 의 카테고리 voucher 류 갯수.
--     - 셀러가 신규 stay/식사권/미용권 등 voucher 모드 product 생성 시 검사.
--   helper: src/worker/utils/seller-tier-limits.ts (별도 PR 의 코드)

ALTER TABLE seller_tiers ADD COLUMN voucher_monthly_limit INTEGER DEFAULT 5;
  -- -1 = 무제한.

-- 기존 등급별 한도 적용 (UPDATE).
UPDATE seller_tiers SET voucher_monthly_limit = 5   WHERE name = '브론즈';
UPDATE seller_tiers SET voucher_monthly_limit = 20  WHERE name = '실버';
UPDATE seller_tiers SET voucher_monthly_limit = 50  WHERE name = '골드';
UPDATE seller_tiers SET voucher_monthly_limit = 200 WHERE name = '플래티넘';
UPDATE seller_tiers SET voucher_monthly_limit = -1  WHERE name = '다이아';

-- referral_enabled 권한도 등급 기반 — 실버 이상.
ALTER TABLE seller_tiers ADD COLUMN referral_allowed INTEGER NOT NULL DEFAULT 0;

UPDATE seller_tiers SET referral_allowed = 0 WHERE name = '브론즈';
UPDATE seller_tiers SET referral_allowed = 1 WHERE name IN ('실버', '골드', '플래티넘', '다이아');
