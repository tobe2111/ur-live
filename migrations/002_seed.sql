-- ============================================================
-- Migration 002: Seed Data
-- Test data for development
-- ============================================================

-- Test Users
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, is_email_verified)
VALUES 
  ('user-admin-001', 'admin@marketplace.test', '$2b$10$placeholder', '관리자', 'ADMIN', 1),
  ('user-buyer-001', 'buyer@test.com', '$2b$10$placeholder', '테스트 구매자', 'BUYER', 1),
  ('user-seller-001', 'seller1@test.com', '$2b$10$placeholder', '셀러1', 'SELLER', 1),
  ('user-seller-002', 'seller2@test.com', '$2b$10$placeholder', '셀러2', 'SELLER', 1);

-- Test Sellers
INSERT OR IGNORE INTO sellers (id, user_id, name, slug, email, base_shipping_fee, free_shipping_threshold, status, is_verified)
VALUES 
  ('seller-001', 'user-seller-001', '멋진 패션샵', 'fashion-shop', 'seller1@test.com', 3000, 50000, 'ACTIVE', 1),
  ('seller-002', 'user-seller-002', '전자기기 마켓', 'electronics-market', 'seller2@test.com', 2500, 30000, 'ACTIVE', 1);

-- Test Categories
INSERT OR IGNORE INTO categories (id, name, slug, name_ko, name_en)
VALUES 
  ('cat-fashion', '패션', 'fashion', '패션', 'Fashion'),
  ('cat-electronics', '전자기기', 'electronics', '전자기기', 'Electronics');

-- Test Products (Seller 1 - Fashion)
INSERT OR IGNORE INTO products (id, seller_id, category_id, name, slug, description, price, stock_quantity, status, thumbnail_url)
VALUES 
  ('prod-001', 'seller-001', 'cat-fashion', '프리미엄 티셔츠', 'premium-tshirt', '고급 면 100% 프리미엄 티셔츠', 29900, 100, 'ACTIVE', 'https://via.placeholder.com/400x400?text=T-Shirt'),
  ('prod-002', 'seller-001', 'cat-fashion', '청바지 슬림핏', 'slim-jeans', '스트레치 슬림핏 청바지', 59900, 50, 'ACTIVE', 'https://via.placeholder.com/400x400?text=Jeans'),
  ('prod-003', 'seller-001', 'cat-fashion', '캐주얼 후드티', 'casual-hoodie', '부드러운 기모 후드티', 45000, 80, 'ACTIVE', 'https://via.placeholder.com/400x400?text=Hoodie');

-- Test Products (Seller 2 - Electronics)
INSERT OR IGNORE INTO products (id, seller_id, category_id, name, slug, description, price, stock_quantity, status, thumbnail_url)
VALUES 
  ('prod-004', 'seller-002', 'cat-electronics', '블루투스 이어폰', 'bt-earphone', '노이즈 캔슬링 블루투스 이어폰', 89000, 30, 'ACTIVE', 'https://via.placeholder.com/400x400?text=Earphone'),
  ('prod-005', 'seller-002', 'cat-electronics', 'USB-C 충전기', 'usb-c-charger', '65W 고속 충전기', 35000, 200, 'ACTIVE', 'https://via.placeholder.com/400x400?text=Charger'),
  ('prod-006', 'seller-002', 'cat-electronics', '스마트폰 케이스', 'phone-case', '강화유리 스마트폰 케이스', 15000, 500, 'ACTIVE', 'https://via.placeholder.com/400x400?text=Case');
