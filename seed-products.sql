-- Insert dummy products for stream 4
INSERT OR IGNORE INTO products (id, name, price, original_price, discount_rate, stock, image_url, category, description, is_active) VALUES
(1, '게이밍 키보드 RGB', 89000, 129000, 31, 50, 'https://via.placeholder.com/300x300/FF5126/FFFFFF?text=Gaming+Keyboard', '게이밍 기어', '프로게이머가 사용하는 RGB 기계식 키보드', 1),
(2, '게이밍 마우스 무선', 69000, 99000, 30, 80, 'https://via.placeholder.com/300x300/0064FF/FFFFFF?text=Gaming+Mouse', '게이밍 기어', '초경량 무선 게이밍 마우스 16000 DPI', 1),
(3, '게이밍 헤드셋 7.1', 119000, 179000, 34, 35, 'https://via.placeholder.com/300x300/34C759/FFFFFF?text=Gaming+Headset', '게이밍 기어', '서라운드 7.1 채널 게이밍 헤드셋', 1);

-- Set current product for stream 4
UPDATE live_streams SET current_product_id = 1 WHERE id = 4;
