-- Add reserved_stock column for pessimistic locking
-- This prevents overselling in live commerce scenarios with high concurrent traffic

-- 1. Add reserved_stock column to products table
ALTER TABLE products ADD COLUMN reserved_stock INTEGER DEFAULT 0;

-- 2. Add comment for documentation
-- reserved_stock: Amount of stock reserved during checkout process
-- Final stock calculation: available_stock = stock - reserved_stock

-- 3. Create index for performance optimization
CREATE INDEX IF NOT EXISTS idx_products_stock_reserved ON products(id, stock, reserved_stock);

-- 4. Add reservation_expires_at column to orders table
-- This allows automatic cleanup of expired reservations
ALTER TABLE orders ADD COLUMN reservation_expires_at DATETIME DEFAULT NULL;

-- 5. Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_orders_reservation_expires ON orders(reservation_expires_at);
