-- Disable foreign key checks temporarily
PRAGMA foreign_keys = OFF;

-- Insert sample seller
INSERT OR IGNORE INTO sellers (id, username, email, password_hash, name, is_featured_seller, is_active) VALUES
(1, 'premiumshop', 'seller@premium-shop.com', '$2a$10$dummyhashforproduction12345', 'Premium Shop', 1, 1);

-- Insert sample products
INSERT OR IGNORE INTO products (id, name, description, price, original_price, discount_rate, stock, category, image_url, is_active, seller_id) VALUES
(1, 'Premium Wireless Headphones', 'Premium noise-cancelling headphones with 30-hour battery life.', 89000, 149000, 40, 50, 'fashion', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800', 1, 1),
(2, 'Classic White Sneakers', 'Timeless white sneakers perfect for any outfit.', 120000, 180000, 33, 100, 'fashion', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', 1, 1),
(3, 'Leather Backpack', 'Premium leather backpack with multiple compartments.', 75000, 110000, 32, 30, 'goods', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800', 1, 1),
(4, 'Sports Watch', 'Advanced fitness tracking with heart rate monitoring.', 189000, 250000, 24, 25, 'fashion', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800', 1, 1),
(5, 'Designer Sunglasses', 'UV protection sunglasses with polarized lenses.', 125000, 200000, 38, 40, 'fashion', 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800', 1, 1),
(6, 'Canvas Tote Bag', 'Eco-friendly canvas tote bag.', 45000, 70000, 36, 80, 'goods', 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800', 1, 1);

-- Insert live streams
INSERT OR IGNORE INTO live_streams (id, title, description, youtube_video_id, status, seller_id, thumbnail_url) VALUES
(1, '프리미엄 헤드폰 라이브', '최신 헤드폰 소개!', 'dQw4w9WgXcQ', 'live', 1, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'),
(2, '골드 주얼리 특가', '프리미엄 주얼리 특가!', 'dQw4w9WgXcQ', 'live', 1, 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400'),
(3, '스니커즈 신상품', '신상 스니커즈 대공개!', 'dQw4w9WgXcQ', 'live', 1, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400');

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;
