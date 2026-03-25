-- ============================================================
-- Migration 0108: P1 기술 부채 해소 - 인프라 스키마 개선
-- 2026-03-13
--
-- 1. orders 테이블에 cancel_fail_reason 컬럼 추가
--    (Toss cancel API 실패 시 사유 기록용)
-- 2. password_hash_version 컬럼 추가
--    (SHA-256 레거시 vs PBKDF2 추적용)
-- 3. 성능 인덱스 추가 (toss_payment_key 검색 최적화)
-- ============================================================

-- 1. 주문 취소 실패 사유 컬럼 (이미 있으면 무시)
ALTER TABLE orders ADD COLUMN cancel_fail_reason TEXT DEFAULT NULL;

-- 2. 비밀번호 해시 버전 트래킹
--    NULL 또는 'sha256'  → 레거시 (점진적 마이그레이션 대상)
--    'pbkdf2'           → 현재 표준
ALTER TABLE users ADD COLUMN password_hash_version TEXT DEFAULT 'sha256';

-- 기존 사용자는 모두 레거시로 마킹 (로그인 시 자동 업그레이드됨)
UPDATE users SET password_hash_version = 'sha256' WHERE password_hash_version IS NULL;

-- 신규 등록 사용자의 기본값은 pbkdf2
-- (auth.routes.ts의 register 핸들러에서 'pbkdf2'로 설정)

-- 3. Toss payment key / order id 컬럼 추가 (001_initial.sql이 IF NOT EXISTS로 스킵됐을 경우 대비)
ALTER TABLE orders ADD COLUMN toss_order_id TEXT;
ALTER TABLE orders ADD COLUMN toss_payment_key TEXT;

-- Toss payment key 인덱스 (취소 API 경로에서 자주 사용)
CREATE INDEX IF NOT EXISTS idx_orders_toss_payment_key_v2
  ON orders(toss_payment_key)
  WHERE toss_payment_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_toss_order_id
  ON orders(toss_order_id)
  WHERE toss_order_id IS NOT NULL;

-- 4. 주문 취소 추적 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at
  ON orders(cancelled_at)
  WHERE cancelled_at IS NOT NULL;

-- 5. 재고 동시성 제어를 위한 products 버전 컬럼 (낙관적 락)
--    현재 D1 batch() 원자적 실행으로 처리하나,
--    향후 version 컬럼 기반 낙관적 락 전환 가능
ALTER TABLE products ADD COLUMN stock_version INTEGER DEFAULT 0;

-- stock 변경 시 version 증가 트리거 (SQLite 지원)
CREATE TRIGGER IF NOT EXISTS trg_products_stock_version
  AFTER UPDATE OF stock_quantity ON products
  FOR EACH ROW
  WHEN OLD.stock_quantity != NEW.stock_quantity
BEGIN
  UPDATE products SET stock_version = stock_version + 1 WHERE id = NEW.id;
END;
