-- Fix: 셀러가 등록한 상품이 ur특가에 노출되는 버그 수정
-- 원인: product_type 컬럼의 DEFAULT가 'featured'로 설정되어
--       셀러 INSERT 시 product_type을 명시하지 않으면 자동으로 'featured'가 저장됨
--
-- 1. 기존 셀러 상품(seller_id IS NOT NULL)을 모두 'live'로 업데이트
UPDATE products
SET product_type = 'live'
WHERE seller_id IS NOT NULL
  AND product_type = 'featured';
