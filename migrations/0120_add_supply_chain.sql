-- ============================================================
-- Migration 0120: 공급가 시스템 (Supply Chain)
-- 2026-03-25
--
-- 어드민이 공급 상품을 등록하고, 셀러가 샘플 신청 후
-- 승인되면 자신의 스토어에 상품을 등록해 라이브 판매할 수 있는 시스템.
--
-- 1. products: supply_price (공급가), is_supply_product (공급 상품 여부) 컬럼 추가
-- 2. sample_requests: 샘플 신청 테이블 생성
-- ============================================================

-- 1. products 테이블에 공급가 및 공급 상품 플래그 추가
ALTER TABLE products ADD COLUMN supply_price INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN is_supply_product INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN supply_source_id INTEGER DEFAULT NULL;  -- 공급 상품 원본 ID (셀러가 등록한 상품의 경우)

-- 공급 상품 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_products_is_supply ON products(is_supply_product);

-- 2. 샘플 신청 테이블
CREATE TABLE IF NOT EXISTS sample_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
  seller_memo TEXT,         -- 셀러 메모 (샘플 신청 사유)
  admin_memo TEXT,          -- 어드민 메모 (승인/거부 사유)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  approved_by INTEGER,
  UNIQUE(seller_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_sample_requests_seller_id  ON sample_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_sample_requests_product_id ON sample_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_sample_requests_status     ON sample_requests(status);
