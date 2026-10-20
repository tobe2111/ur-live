-- Seed data for local development

-- Insert test users
INSERT OR IGNORE INTO users (id, kakao_id, name, email) VALUES (3, '3682754567', '정지원', 'jiwon@ur-team.com');

-- Insert test sellers  
INSERT OR IGNORE INTO sellers (id, name, email) VALUES (1, '테스트 셀러', 'seller@test.com');

-- Insert test products
INSERT OR IGNORE INTO products (id, seller_id, name, price, stock) VALUES (1, 1, '테스트 상품', 159200, 100);

