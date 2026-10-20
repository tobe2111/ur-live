-- ============================================================
-- Migration 0125: sellers 테이블에 사업자 정보 컬럼 추가
-- ============================================================

ALTER TABLE sellers ADD COLUMN tax_email TEXT;
ALTER TABLE sellers ADD COLUMN representative_name TEXT;
ALTER TABLE sellers ADD COLUMN business_address TEXT;
ALTER TABLE sellers ADD COLUMN business_registration_file TEXT;
