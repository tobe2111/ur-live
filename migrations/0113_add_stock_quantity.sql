-- ============================================================
-- Migration 0113: products/product_options에 stock_quantity 추가
-- 2026-03-24
--
-- 기존 코드가 stock_quantity 컬럼을 SELECT/INSERT에서 참조하나
-- 0001_initial_schema.sql 기반 DB에는 stock 컬럼만 존재함.
-- stock_quantity 추가 후 기존 stock 값으로 초기화.
-- ============================================================

-- 1. products 테이블에 stock_quantity 추가
ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0;

-- 기존 재고(stock) 값을 stock_quantity에 복사
UPDATE products SET stock_quantity = COALESCE(stock, 0) WHERE stock_quantity = 0 OR stock_quantity IS NULL;

-- 2. product_options 테이블에 stock_quantity 추가
ALTER TABLE product_options ADD COLUMN stock_quantity INTEGER DEFAULT 0;

-- 기존 재고(stock) 값을 stock_quantity에 복사
UPDATE product_options SET stock_quantity = COALESCE(stock, 0) WHERE stock_quantity = 0 OR stock_quantity IS NULL;
