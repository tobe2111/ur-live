-- Add payment cancellation columns to orders table

ALTER TABLE orders ADD COLUMN cancelled_at DATETIME;
ALTER TABLE orders ADD COLUMN cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN refund_status TEXT; -- 'pending', 'completed', 'failed'
ALTER TABLE orders ADD COLUMN refunded_at DATETIME;
