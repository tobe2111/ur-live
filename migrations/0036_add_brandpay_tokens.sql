-- 브랜드페이 토큰 관리 테이블 추가
-- customerToken은 브랜드페이 결제수단 관리에 필요

-- users 테이블에 브랜드페이 관련 컬럼 추가
ALTER TABLE users ADD COLUMN brandpay_customer_key TEXT;
ALTER TABLE users ADD COLUMN brandpay_access_token TEXT;
ALTER TABLE users ADD COLUMN brandpay_refresh_token TEXT;
ALTER TABLE users ADD COLUMN brandpay_token_expires_at DATETIME;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_brandpay_customer_key ON users(brandpay_customer_key);

-- 주석
-- brandpay_customer_key: customer_{userId} 형태의 고유 식별자
-- brandpay_access_token: 브랜드페이 API 호출에 사용하는 액세스 토큰
-- brandpay_refresh_token: 액세스 토큰 갱신에 사용하는 리프레시 토큰
-- brandpay_token_expires_at: 액세스 토큰 만료 시간
