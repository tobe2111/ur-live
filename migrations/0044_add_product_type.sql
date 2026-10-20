-- Add product_type column to products table
-- 'live' for live streaming products
-- 'featured' for Ur special deals products
ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'featured';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_type_seller ON products(product_type, seller_id);
