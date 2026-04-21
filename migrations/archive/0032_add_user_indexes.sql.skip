-- Add performance indexes for user queries
-- Migration: 0032_add_user_indexes.sql

-- Index for last_login_at (활성 사용자 조회, 통계)
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC);

-- Index for created_at (신규 가입 통계)
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Composite index for active user analytics (최근 로그인한 사용자)
CREATE INDEX IF NOT EXISTS idx_users_login_created ON users(last_login_at DESC, created_at DESC);

-- Index for name search (사용자 검색 기능)
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
