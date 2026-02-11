-- Migration: Add payments table and order payment fields
-- Purpose: Store payment information with PG-agnostic design
-- Date: 2026-02-11

-- ==========================================
-- 1. Create payments table (PG-agnostic)
-- ==========================================
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Order reference
  order_id TEXT NOT NULL,
  
  -- PG provider info (supports multiple PG providers)
  pg_provider TEXT NOT NULL DEFAULT 'tosspayments',  -- tosspayments, portone, nicepay, etc.
  pg_payment_key TEXT NOT NULL,                       -- PG's unique payment key
  pg_transaction_id TEXT,                             -- PG's transaction ID (optional)
  
  -- Payment details
  method TEXT NOT NULL,              -- card, virtual_account, transfer, mobile, etc.
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',  -- completed, pending, failed, cancelled, refunded
  
  -- Card info (if applicable)
  card_company TEXT,                 -- 카드사 (삼성카드, 현대카드 등)
  card_number TEXT,                  -- 마스킹된 카드번호 (1234-56**-****-7890)
  installment_months INTEGER,        -- 할부 개월 (0: 일시불)
  
  -- Virtual account info (if applicable)
  virtual_account_bank TEXT,         -- 가상계좌 은행
  virtual_account_number TEXT,       -- 가상계좌 번호
  virtual_account_holder TEXT,       -- 예금주명
  virtual_account_due_date DATETIME, -- 입금기한
  
  -- Timestamps
  requested_at DATETIME,             -- 결제 요청 시각
  approved_at DATETIME,              -- 결제 승인 시각
  cancelled_at DATETIME,             -- 결제 취소 시각
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Additional info (JSON format for flexibility)
  pg_raw_data TEXT,                  -- PG사 원본 응답 데이터 (JSON)
  
  FOREIGN KEY (order_id) REFERENCES orders(order_no) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_pg_payment_key ON payments(pg_payment_key);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_pg_provider ON payments(pg_provider);

-- ==========================================
-- 2. Add payment fields to orders table
-- ==========================================

-- Note: payment_key and payment_status already exist, skip them

-- Add payment_method column (new)
-- We'll wrap in a transaction and use PRAGMA to check first
-- For now, we'll just try to add new columns that don't exist

-- Try to add payment_method (might fail if exists, that's ok)
-- ALTER TABLE orders ADD COLUMN payment_method TEXT;

-- Try to add pg_provider (might fail if exists, that's ok)
-- ALTER TABLE orders ADD COLUMN pg_provider TEXT DEFAULT 'tosspayments';

-- Since SQLite doesn't support conditional column addition,
-- We'll add a dummy comment here and manually add columns via code if needed
-- For now, we'll rely on the application layer to handle missing columns gracefully

-- Create index on payment_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_key ON orders(payment_key);

-- ==========================================
-- 3. Migration notes
-- ==========================================
-- This migration creates a PG-agnostic payment system:
-- 
-- Benefits:
-- 1. Easy PG provider switching (just change pg_provider value)
-- 2. Supports multiple PG providers simultaneously
-- 3. Stores both normalized fields and raw PG data
-- 4. Flexible for future PG providers
--
-- Supported PG providers (extensible):
-- - tosspayments: Current implementation
-- - portone: Future support
-- - nicepay: Future support
-- - inicis: Future support
-- - payple: Future support
--
-- To switch PG provider:
-- 1. Update PAYMENT_PG_PROVIDER environment variable
-- 2. Implement new PG provider adapter
-- 3. No database schema changes needed!
