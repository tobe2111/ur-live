-- 🛡️ 2026-05-18: 숙소 공구 — 인플루언서 referral 모델.
--
--   사용자 요청: '인플루언서가 자신의 호텔 상품 링크를 주면 결제 시키고 리워드 얻고
--   소비자는 조금 더 싸게.'
--
--   모델:
--     1) 셀러가 숙소 등록 시 'influencer_discount_pct' (소비자 할인율) 와
--        'influencer_commission_pct' (인플 커미션율) 설정.
--     2) 인플루언서가 /api/affiliate/link/stay/:id 로 referral URL 받음.
--     3) 소비자가 URL 진입 → /stays/:id?ref=influencer_id → 할인된 가격 표시.
--     4) 결제 시 referrer_id 가 booking 에 기록 → 결제 확정 시 affiliate track 호출.
--     5) 인플루언서는 settle 시 commission 받음.
--
--   사례:
--     - 정가 1박 100,000원
--     - influencer_discount_pct = 10% → 소비자는 90,000원 결제
--     - influencer_commission_pct = 5% → 인플은 4,500원 commission (90,000원의 5%)
--     - 셀러 수익: 90,000 - 4,500 - 플랫폼 수수료 = 마진

ALTER TABLE product_stay_info ADD COLUMN influencer_discount_pct REAL DEFAULT 0;
  -- 인플루언서 URL 로 진입한 소비자의 할인율 (0-30 권장). 0 = 할인 없음.

ALTER TABLE product_stay_info ADD COLUMN influencer_commission_pct REAL DEFAULT 0;
  -- 인플루언서가 받는 커미션율 (결제 금액의 %). 보통 3-10%.

ALTER TABLE product_stay_info ADD COLUMN referral_enabled INTEGER NOT NULL DEFAULT 0;
  -- 셀러가 인플루언서 referral 모드를 활성화했는지 (0 = 비활성).

-- stay_bookings 에 referrer_id 추가 (어느 인플루언서를 통한 예약인지 추적).
ALTER TABLE stay_bookings ADD COLUMN referrer_id TEXT;
  -- users.id (TEXT — firebase uid 또는 number).

ALTER TABLE stay_bookings ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0;
  -- 적용된 할인 금액 (총액에서 차감됨).

ALTER TABLE stay_bookings ADD COLUMN influencer_commission_amount INTEGER NOT NULL DEFAULT 0;
  -- 인플루언서가 받을 commission 금액 (결제 확정 후 지급 대기).

CREATE INDEX IF NOT EXISTS idx_stay_bookings_referrer ON stay_bookings(referrer_id, status);
