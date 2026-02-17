-- Insert sample products
INSERT OR IGNORE INTO products (id, name, description, price, original_price, discount_rate, stock, category, image_url, is_active) VALUES
(1, 'Premium Wireless Headphones', 'Premium noise-cancelling headphones with 30-hour battery life and studio-quality sound.', 89000, 149000, 40, 50, 'fashion', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800', 1),
(2, 'Classic White Sneakers', 'Timeless white sneakers perfect for any outfit. Comfortable and durable.', 120000, 180000, 33, 100, 'fashion', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', 1),
(3, 'Leather Backpack', 'Premium leather backpack with multiple compartments. Perfect for work or travel.', 75000, 110000, 32, 30, 'goods', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800', 1),
(4, 'Sports Watch', 'Advanced fitness tracking with heart rate monitoring and GPS.', 189000, 250000, 24, 25, 'fashion', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800', 1),
(5, 'Designer Sunglasses', 'UV protection sunglasses with polarized lenses.', 125000, 200000, 38, 40, 'fashion', 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800', 1),
(6, 'Canvas Tote Bag', 'Eco-friendly canvas tote bag. Perfect for shopping or daily use.', 45000, 70000, 36, 80, 'goods', 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800', 1),
(7, 'Wireless Charging Pad', 'Fast wireless charging for all Qi-enabled devices.', 35000, 55000, 36, 60, 'goods', 'https://images.unsplash.com/photo-1591290619762-0c0a6b5c2e7a?w=800', 1),
(8, 'Stainless Steel Water Bottle', 'Insulated water bottle keeps drinks cold for 24 hours.', 28000, 45000, 38, 100, 'goods', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800', 1),
(9, 'Organic Green Tea Set', 'Premium organic green tea from Jeju Island. 100g pack.', 32000, 50000, 36, 50, 'food', 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800', 1),
(10, 'Bamboo Cutting Board', 'Eco-friendly bamboo cutting board. Durable and stylish.', 42000, 65000, 35, 40, 'goods', 'https://images.unsplash.com/photo-1594991641450-f0df7c6d0cbf?w=800', 1);

-- Insert sample live streams (스키마에 맞게 기본 필드만 사용)
INSERT OR IGNORE INTO live_streams (id, title, description, youtube_video_id, status, current_product_id) VALUES
(1, '프리미엄 헤드폰 라이브', '최신 헤드폰을 소개합니다! 지금 특가로 만나보세요.', 'dQw4w9WgXcQ', 'live', 1),
(2, '골드 주얼리 특가', '프리미엄 주얼리를 특가로! 놓치지 마세요.', 'dQw4w9WgXcQ', 'live', 3),
(3, '스니커즈 신상품', '이번 시즌 신상 스니커즈 대공개!', 'dQw4w9WgXcQ', 'live', 2);
