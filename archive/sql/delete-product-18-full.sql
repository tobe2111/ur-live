-- 상품 ID 18과 연결된 모든 데이터 삭제
-- 1. 장바구니 항목 삭제
DELETE FROM cart_items WHERE product_id = 18;

-- 2. 위시리스트 삭제
DELETE FROM wishlists WHERE product_id = 18;

-- 3. 주문 항목 삭제
DELETE FROM order_items WHERE product_id = 18;

-- 4. 상품 옵션 삭제
DELETE FROM product_options WHERE product_id = 18;

-- 5. 상품 삭제
DELETE FROM products WHERE id = 18;
