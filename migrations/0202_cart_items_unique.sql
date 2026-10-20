-- 0202_cart_items_unique.sql
-- cart_items에 (user_id, product_id, option_id) 유니크 인덱스를 추가해
-- SELECT→UPDATE/INSERT 레이스 컨디션으로 인한 중복 장바구니 항목을 방지.
--
-- SQLite는 UNIQUE 인덱스에서 NULL을 서로 다른 값으로 취급하므로
-- option_id가 NULL일 수도 있는 경우를 위해 COALESCE 기반 expression index 사용.

-- 1) 기존 중복 제거 — 가장 작은 id만 남김
DELETE FROM cart_items
WHERE id NOT IN (
  SELECT MIN(id)
  FROM cart_items
  GROUP BY user_id, product_id, COALESCE(option_id, -1)
);

-- 2) 유니크 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique
  ON cart_items(user_id, product_id, COALESCE(option_id, -1));
