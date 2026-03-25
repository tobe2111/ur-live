-- ============================================================
-- Migration 0117: orders 테이블 누락 컬럼 추가
-- 2026-03-25
--
-- payment_method가 migration 0034에서 주석 처리되어 누락됨
-- /api/admin/orders 500 에러 수정
-- ============================================================

-- payment_method 컬럼 추가 (card, bank_transfer, virtual_account 등)
ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method)
  WHERE payment_method IS NOT NULL;
