-- Insert sample seller (is_featured_seller = 1)
INSERT OR IGNORE INTO sellers (id, username, email, password_hash, name, is_featured_seller, is_active) VALUES
(1, 'premiumshop', 'seller@premium-shop.com', '$2a$10$dummy', 'Premium Shop', 1, 1);

-- Update products with seller_id (if column exists)
UPDATE products SET seller_id = 1 WHERE seller_id IS NULL OR seller_id = 0;

-- Update live_streams with seller_id (if column exists) 
UPDATE live_streams SET seller_id = 1 WHERE seller_id IS NULL OR seller_id = 0;
