-- ============================================================
-- Migration 0129: POST /api/orders 500 에러 수정용 누락 컬럼 추가
-- 2026-03-30
--
-- 배경:
--   구 스키마(0001_initial_schema.sql)로 생성된 DB에서
--   POST /api/orders 호출 시 500 에러 발생:
--
--   1) productRepo.findByIds → s.base_shipping_fee 컬럼 없음
--      (코드에서 제거됨, 이 마이그레이션에서는 sellers에 추가)
--
--   2) orderRepo.reserveStock → products.sold_count 컬럼 없음
--      (코드에서 별도 처리로 분리, 이 마이그레이션에서 추가)
--
-- D1 콘솔 또는 wrangler d1 execute로 적용하세요.
-- 이미 존재하는 컬럼에서 에러가 나면 무시하고 다음 구문 실행하세요.
-- ============================================================

-- 1. products 테이블: sold_count 추가
ALTER TABLE products ADD COLUMN sold_count INTEGER DEFAULT 0;

-- 2. sellers 테이블: base_shipping_fee 추가 (shipping_fee 값 복사)
ALTER TABLE sellers ADD COLUMN base_shipping_fee INTEGER DEFAULT 3000;
UPDATE sellers SET base_shipping_fee = COALESCE(shipping_fee, 3000) WHERE base_shipping_fee = 3000 OR base_shipping_fee IS NULL;
