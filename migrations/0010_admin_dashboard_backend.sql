-- ============================================
-- Admin Dashboard Backend - Database Updates
-- ============================================
-- This migration adds necessary fields for:
-- 1. Banners table (add missing columns)
-- 2. Orders table (add settlement tracking)
-- 3. Sellers table (add special permissions)
-- ============================================

-- ============================================
-- 1. Update Banners Table
-- ============================================
-- SQLite doesn't support ALTER COLUMN, so we need to check if columns exist
-- Add image_url as alias for image (handled in app logic)
-- Add description column if it doesn't exist
CREATE TABLE IF NOT EXISTS banners_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  start_date DATETIME,
  end_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table if it exists
INSERT INTO banners_new (id, title, image_url, link_url, display_order, is_active, start_date, end_date, created_at, updated_at)
SELECT id, title, image as image_url, link as link_url, display_order, is_active, start_date, end_date, created_at, updated_at
FROM banners
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='banners');

-- Drop old table and rename
DROP TABLE IF EXISTS banners;
ALTER TABLE banners_new RENAME TO banners;

-- ============================================
-- 2. Update Orders Table (Add Settlement Fields)
-- ============================================
-- Note: SQLite doesn't support ALTER TABLE ADD COLUMN with CHECK constraints
-- We'll add these columns separately

-- Add settlement_status column
ALTER TABLE orders ADD COLUMN settlement_status TEXT DEFAULT 'pending' CHECK(settlement_status IN ('pending', 'settled', 'cancelled'));

-- Add settled_at column
ALTER TABLE orders ADD COLUMN settled_at DATETIME;

-- Add seller_id column (if not exists)
ALTER TABLE orders ADD COLUMN seller_id INTEGER REFERENCES sellers(id);

-- Add order_number column (if not exists)
ALTER TABLE orders ADD COLUMN order_number TEXT UNIQUE;

-- Add payment_status column (if not exists)
ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'approved', 'failed', 'cancelled', 'refunded'));

-- Add shipping fields (if not exists)
ALTER TABLE orders ADD COLUMN shipping_name TEXT;
ALTER TABLE orders ADD COLUMN shipping_phone TEXT;
ALTER TABLE orders ADD COLUMN shipping_address_detail TEXT;
ALTER TABLE orders ADD COLUMN shipping_zipcode TEXT;
ALTER TABLE orders ADD COLUMN courier TEXT;

-- Rename total_price to total_amount for consistency
-- This will be handled in application logic

-- ============================================
-- 3. Update Sellers Table (Add Special Permissions)
-- ============================================
-- Add can_manipulate_stats column for special seller permissions
ALTER TABLE sellers ADD COLUMN can_manipulate_stats INTEGER DEFAULT 0;

-- Add company_name column (if not exists)
ALTER TABLE sellers ADD COLUMN company_name TEXT;

-- ============================================
-- 4. Create Order Items Table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  image_url TEXT,
  option_info TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 5. Add Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_settlement_status ON orders(settlement_status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_banners_display_order ON banners(display_order);
CREATE INDEX IF NOT EXISTS idx_banners_is_active ON banners(is_active);

-- ============================================
-- 6. Add Products Table Updates
-- ============================================
-- Add product_type column (if not exists)
ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'featured' CHECK(product_type IN ('live', 'featured'));

-- Add is_active column (if not exists)
ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1;

-- Rename image to image_url for consistency
-- This will be handled in application logic

-- ============================================
-- Migration Complete
-- ============================================
-- Note: Some ALTER TABLE commands may fail if columns already exist
-- This is expected and safe to ignore
-- ============================================
