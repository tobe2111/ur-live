-- 🛡️ 2026-05-19: 상품 추천 (affiliate) 시스템 - 상품별 ON/OFF + 보상률.
--
-- 정책:
--   A. 셀러 라이브 상품 — referral_enabled = 0 (OFF)
--   B. 어드민 큐레이션 상품 — referral_enabled = 1 (ON), rate 5%
--   C. KT Alpha 교환권 — referral_enabled = 0 (OFF)
--
-- 컬럼:
--   referral_enabled        : 0/1 — 추천 활성화 여부
--   referral_commission_rate: NULL = platform 기본값 사용, 명시값이 있으면 상품별 override
--
-- platform_settings.affiliate_commission_rate:
--   기본값 5 (5%) — 이전 affiliate.routes.ts 의 하드코딩 2% 폐기 후 5% 적용.
--
-- 어드민 UI 에서 상품별 토글 + 보상률 조정 가능.

ALTER TABLE products ADD COLUMN referral_enabled INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN referral_commission_rate REAL;

CREATE INDEX IF NOT EXISTS idx_products_referral_enabled
  ON products(referral_enabled) WHERE referral_enabled = 1;

-- 글로벌 기본값 5% 시드 (이미 row 있으면 INSERT 무시).
INSERT OR IGNORE INTO platform_settings (key, value, updated_at)
VALUES ('affiliate_commission_rate', '5', datetime('now'));

-- 기존 row 가 다른 값이면 강제 갱신 (5% 정책 영구화).
UPDATE platform_settings SET value = '5', updated_at = datetime('now')
WHERE key = 'affiliate_commission_rate' AND value != '5';
