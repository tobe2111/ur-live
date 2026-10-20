-- Migration: Add status column to orders table
-- This fixes the missing 'status' column that was referenced but never created
-- 실행: npx wrangler d1 migrations apply toss-live-commerce-db --local
-- 프로덕션: npx wrangler d1 migrations apply toss-live-commerce-db

-- Add status column to orders table
-- status: 주문 전체 상태 (pending, paid, preparing, shipped, delivered, cancelled, refunded)
-- payment_status: 결제 상태 (pending, approved, failed, cancelled, refunded)
ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'));

-- Remove duplicate index (already exists in 0010_add_order_tracking.sql)
-- CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Update existing records: sync status with payment_status
UPDATE orders SET status = 
  CASE 
    WHEN payment_status = 'approved' THEN 'paid'
    WHEN payment_status = 'cancelled' THEN 'cancelled'
    WHEN payment_status = 'refunded' THEN 'refunded'
    WHEN payment_status = 'failed' THEN 'cancelled'
    ELSE 'pending'
  END
WHERE status IS NULL OR status = 'pending';
