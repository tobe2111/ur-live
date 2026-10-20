-- 🛡️ 2026-05-19: products.brand_icon_url 컬럼 추가 — KT Alpha 브랜드 아이콘 노출.
--
--   메인 페이지 브랜드 칩 + 검색/카탈로그에서 브랜드 로고 표시 용도.
--   gift_catalog.brand_icon_url 의 복제본 (bulk-import 시 함께 채워짐).

ALTER TABLE products ADD COLUMN brand_icon_url TEXT;
