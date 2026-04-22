-- Migration 0203: Track partial refund amount per order.
-- Adds orders.refunded_amount (cumulative) and an audit table for every refund.
-- Safe to run multiple times; uses IF NOT EXISTS.

-- NOTE: SQLite lacks "ADD COLUMN IF NOT EXISTS". The wrangler migration runner
-- treats duplicate-column errors as failures, so deploys that already applied
-- this column should skip this migration. A plain ALTER is used here to match
-- the rest of the migration chain; idempotency is handled by the runner
-- tracking migration_id in d1_migrations.
ALTER TABLE orders ADD COLUMN refunded_amount INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_refund_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  toss_transaction_key TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_order_refund_order ON order_refund_history(order_id);
