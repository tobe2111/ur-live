-- Migration 0127: seller_business_info 테이블에 address_detail 컬럼 추가
ALTER TABLE seller_business_info ADD COLUMN address_detail TEXT;
