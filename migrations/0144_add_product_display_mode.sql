-- live_streams에 상품 표시 모드 추가
-- current_only: 현재 소개 중인 상품만 표시 (기본값)
-- all: 등록된 전체 상품 표시
ALTER TABLE live_streams ADD COLUMN product_display_mode TEXT DEFAULT 'current_only';
