-- Add performance indexes for user queries (프로덕션용 단순 버전)
-- 기존 users 테이블 구조 유지하면서 인덱스만 추가

-- 이미 있을 수 있는 인덱스는 IF NOT EXISTS로 안전하게 추가
CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 새로운 성능 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);

-- 복합 인덱스 (최근 로그인한 사용자 조회용)
CREATE INDEX IF NOT EXISTS idx_users_login_created ON users(last_login_at DESC, created_at DESC);
