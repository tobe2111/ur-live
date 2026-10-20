-- Migration: Add settlement_status to orders table
-- Created: 2026-02-06
-- Description: Add settlement tracking fields to orders table

-- Add settlement_status column (pending/completed)
ALTER TABLE orders ADD COLUMN settlement_status TEXT DEFAULT 'pending';

-- Add settled_at column (정산 완료 시각)
ALTER TABLE orders ADD COLUMN settled_at DATETIME;

-- Create index for faster settlement queries
CREATE INDEX IF NOT EXISTS idx_orders_settlement_status ON orders(settlement_status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_settlement ON orders(seller_id, settlement_status);
