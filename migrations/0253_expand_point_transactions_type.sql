-- 🛡️ 2026-05-17: point_transactions.type CHECK 제거.
--
-- 배경: migration 0142 가 type CHECK(IN 'charge','donate','refund','ad_reward') 정의.
--   그러나 production 코드가 다음 type 들도 사용:
--     - referral_bonus (group-buy.routes.ts:306, 565, 571)
--     - influencer_payout (marketing.routes.ts:669)
--     - kakao_review_bonus (review-bonus.routes.ts:41)
--   → CHECK 위반 → silent .catch fail → 포인트 적립/지급 안 됨 (referral, payout, review bonus).
--
-- 해결: CHECK 제거. 0118 의 orders.status fix 동일 패턴.

ALTER TABLE point_transactions ADD COLUMN _type_bak TEXT;
UPDATE point_transactions SET _type_bak = type;
ALTER TABLE point_transactions DROP COLUMN type;
ALTER TABLE point_transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'charge';
UPDATE point_transactions SET type = COALESCE(_type_bak, 'charge');
ALTER TABLE point_transactions DROP COLUMN _type_bak;

-- 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_point_tx_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_tx_type ON point_transactions(type);
