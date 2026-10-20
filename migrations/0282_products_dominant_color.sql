-- 0282_products_dominant_color.sql
-- 카드 이미지 placeholder 용 도미넌트 컬러 (hex "#RRGGBB").
-- 클라이언트가 이미지 onLoad 시 canvas 1x1 로 추출 → lazy 백필 (서버 이미지 처리 0, cf-image 0).
-- NULL 이면 카드는 카테고리 색 fallback 사용.
ALTER TABLE products ADD COLUMN dominant_color TEXT;
