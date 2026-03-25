-- ============================================================
-- Migration 0118: orders / order_items 누락 컬럼 일괄 추가
-- 2026-03-25
--
-- 배경:
--   0001_initial_schema.sql (구 스키마, INTEGER id)이 먼저 적용된 후
--   001_initial.sql (신 스키마, TEXT id)은 CREATE TABLE IF NOT EXISTS로
--   스킵되어, 신 스키마에서 정의된 컬럼 대부분이 누락됨.
--
--   결과: POST /api/orders → 500
--     - findByIdempotencyKey()  → "no such column: idempotency_key"
--     - reserveStock()          → "no such column: status" (products)
--     - createOrder() INSERT    → "no such column: subtotal"
--
-- 이 마이그레이션은 신 스키마 코드가 참조하는 모든 누락 컬럼을 추가합니다.
-- ============================================================

-- ============================================================
-- 1. orders 테이블 — status 컬럼 CHECK 제약 수정
--    0037 마이그레이션이 소문자 전용 CHECK(pending/paid/...)를 추가했으나
--    코드는 대문자(PENDING/PAID/...) 를 INSERT 함 → CHECK 위반
--    → status 컬럼을 DROP 후 재생성(CHECK 없음)
-- ============================================================
ALTER TABLE orders ADD COLUMN _status_bak TEXT;
UPDATE orders SET _status_bak = status;
ALTER TABLE orders DROP COLUMN status;
ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING';

-- 기존 소문자 값 → 대문자로 변환 (데이터 보존)
UPDATE orders SET status = CASE
  WHEN LOWER(_status_bak) = 'pending'                   THEN 'PENDING'
  WHEN LOWER(_status_bak) IN ('paid','approved','done')  THEN 'PAID'
  WHEN LOWER(_status_bak) = 'preparing'                 THEN 'PREPARING'
  WHEN LOWER(_status_bak) IN ('shipping','shipped')      THEN 'SHIPPING'
  WHEN LOWER(_status_bak) = 'delivered'                 THEN 'DELIVERED'
  WHEN LOWER(_status_bak) IN ('cancelled','canceled')   THEN 'CANCELLED'
  WHEN LOWER(_status_bak) = 'refunded'                  THEN 'REFUNDED'
  WHEN UPPER(_status_bak) IN (
    'PENDING','AWAITING_PAYMENT','PAID','DONE',
    'PREPARING','SHIPPING','DELIVERED','CANCELLED','FAILED','REFUNDED'
  ) THEN UPPER(_status_bak)
  ELSE 'PENDING'
END
WHERE _status_bak IS NOT NULL;

ALTER TABLE orders DROP COLUMN _status_bak;

-- status 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ============================================================
-- 2. orders 테이블 — 신 스키마에만 있는 컬럼 추가
-- ============================================================
ALTER TABLE orders ADD COLUMN subtotal INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN shipping_fee INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_amount INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN currency TEXT DEFAULT 'KRW';
ALTER TABLE orders ADD COLUMN shipping_memo TEXT;
ALTER TABLE orders ADD COLUMN idempotency_key TEXT;
ALTER TABLE orders ADD COLUMN locale TEXT DEFAULT 'ko';
ALTER TABLE orders ADD COLUMN paid_at TEXT;
-- shipped_at / delivered_at 는 0010_add_order_tracking.sql 에서 이미 추가됨
-- cancel_fail_reason / toss_order_id / toss_payment_key 는 0108 에서 추가됨
-- payment_method 는 0117 에서 추가됨
ALTER TABLE orders ADD COLUMN webhook_processed_at TEXT;
ALTER TABLE orders ADD COLUMN webhook_event_id TEXT;

-- idempotency 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency
  ON orders(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- 3. order_items 테이블 — 신 스키마에만 있는 컬럼 추가
--    구 스키마: id/order_id/product_id/quantity/price/product_name/option_info
--    신 코드가 참조하는 추가 컬럼:
--      seller_id, product_thumbnail, product_sku,
--      unit_price, subtotal, currency, options, status,
--      created_at, updated_at
-- ============================================================
ALTER TABLE order_items ADD COLUMN seller_id TEXT;
ALTER TABLE order_items ADD COLUMN product_thumbnail TEXT;
ALTER TABLE order_items ADD COLUMN product_sku TEXT;
ALTER TABLE order_items ADD COLUMN unit_price INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN subtotal INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN currency TEXT DEFAULT 'KRW';
ALTER TABLE order_items ADD COLUMN options TEXT DEFAULT '{}';
ALTER TABLE order_items ADD COLUMN status TEXT DEFAULT 'PENDING';
ALTER TABLE order_items ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
ALTER TABLE order_items ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

-- ============================================================
-- 4. 기존 order_items 레코드 — unit_price / subtotal 동기화
--    구 스키마의 price 컬럼 → unit_price 에 복사
-- ============================================================
UPDATE order_items
SET unit_price = price,
    subtotal   = price * quantity
WHERE unit_price = 0 AND price IS NOT NULL AND price > 0;

-- ============================================================
-- 5. 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id  ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status     ON order_items(status);
