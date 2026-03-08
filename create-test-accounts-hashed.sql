-- Create test accounts with PBKDF2 hashed passwords
-- Generated on 2026-03-08

-- ========================================
-- Admin Account
-- ========================================
-- Email: admin@ur-team.com
-- Password: admin123
-- Role: super_admin
INSERT OR IGNORE INTO admins (username, email, password_hash, name, role, created_at)
VALUES ('admin', 'admin@ur-team.com', 'IfqvDOc4FxiF7m9hwgbJwQ==$vSTw9LaDbGKEM/cHnAZ8VpkzmlwP9gfULizMG4tKQXU=', '관리자', 'super_admin', datetime('now'));

-- ========================================
-- Seller Account
-- ========================================
-- Email: seller@ur-team.com
-- Password: seller123
-- Business: 테스트 상점 (123-45-67890)
-- Status: approved
INSERT OR IGNORE INTO sellers (username, email, password_hash, name, business_name, business_number, phone, status, commission_rate, created_at, updated_at)
VALUES ('testseller', 'seller@ur-team.com', 'itUVt4fdTdIdveuBvEh7iQ==$fiOwHhE6D+RBRi3cEQPsB5hc1z74K6dQYhq3/D+dbKM=', '테스트 셀러', '테스트 상점', '123-45-67890', '010-1234-5678', 'approved', 10.00, datetime('now'), datetime('now'));

-- ========================================
-- Verification Queries
-- ========================================
-- SELECT * FROM admins WHERE email = 'admin@ur-team.com';
-- SELECT * FROM sellers WHERE email = 'seller@ur-team.com';
