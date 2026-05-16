-- 🛡️ 2026-05-16: 후속 작업 — agencies.brand_color 정식 컬럼화 + 광고슬롯/공구 인덱스
--
-- 이전엔 agency-public.routes.ts 가 매 요청마다 try/catch 로 ALTER TABLE 실행.
-- 이제 정식 migration 으로 분리 → ALTER 런타임 호출 제거 가능.

-- 1) agency white-label brand color
ALTER TABLE agencies ADD COLUMN brand_color TEXT;

-- 2) 광고 슬롯 자동 push 의 EXISTS 서브쿼리가 hot query.
--    streams 리스트 (메인/공개페이지) 호출 시마다 ad_slots 검사 → 인덱스 필수.
CREATE INDEX IF NOT EXISTS idx_ad_slots_seller_active
  ON ad_slots(current_seller_id, is_active, expires_at);

-- 3) 공구 목록 (지도/리스트) hot query — category + is_active + group_buy_status.
--    KV 캐시 miss 시 D1 풀스캔 회피.
CREATE INDEX IF NOT EXISTS idx_products_voucher_active
  ON products(category, is_active, group_buy_status);
