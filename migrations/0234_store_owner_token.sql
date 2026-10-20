-- 식사권 사장님 Magic Link 토큰
--
-- 2026-04-27: 사장님이 PIN 없이 통계 페이지 진입할 수 있는 영구 토큰.
-- 셀러가 식사권 등록 시 자동 생성 → 알림톡으로 사장님께 발송.
-- token URL: /store/stats/:productId?t={token}
--
-- 보안: 32자 random hex (128bit) + rate limit + 셀러가 재발송 가능 (token rotation).

ALTER TABLE products ADD COLUMN store_owner_token TEXT;
CREATE INDEX IF NOT EXISTS idx_products_store_owner_token ON products(store_owner_token);
