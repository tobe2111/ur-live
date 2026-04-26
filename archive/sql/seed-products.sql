-- Seed data for testing
-- Insert test products with detail images (seller_id NULL for now)

INSERT OR IGNORE INTO products (id, name, description, price, original_price, discount_rate, image_url, stock, category, seller_id, is_active, detail_images) 
VALUES 
(1, '무선 이어폰 프리미엄', '최고급 음질의 노이즈 캔슬링 무선 이어폰. 배터리 수명 30시간, IPX7 방수 기능', 89000, 129000, 31, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800', 50, '전자제품', NULL, 1, 
json_array(
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800'
)),

(2, '스마트 워치 Ultra', '건강 관리와 피트니스 트래킹을 위한 스마트 워치. GPS, 심박수 측정, 방수 기능', 159000, 219000, 27, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800', 30, '전자제품', NULL, 1,
json_array(
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
  'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800',
  'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=800'
)),

(3, '프리미엄 백팩', '노트북 수납 가능한 고급 백팩. 방수 소재, USB 충전 포트, 15.6인치 노트북 수납', 79000, 99000, 20, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800', 100, '패션', NULL, 1,
json_array(
  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800',
  'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=800',
  'https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=800'
)),

(4, '스니커즈 컬렉션', '편안한 착화감의 러닝 스니커즈. 통기성 좋은 메쉬 소재, 쿠션 기능', 119000, 159000, 25, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', 80, '신발', NULL, 1,
json_array(
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
  'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800',
  'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800'
)),

(5, '블루투스 스피커', '360도 사운드의 휴대용 블루투스 스피커. 방수 기능, 20시간 재생', 59000, 79000, 25, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800', 60, '전자제품', NULL, 1,
json_array(
  'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800',
  'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800',
  'https://images.unsplash.com/photo-1589492477829-5e65395b66cc?w=800'
));
