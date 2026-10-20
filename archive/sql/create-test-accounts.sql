-- 어드민 계정 생성 (이메일: tobe2111@naver.com / 비밀번호: 358533aa!!)
INSERT OR IGNORE INTO admins (username, email, password_hash, name, role, created_at)
VALUES ('admin', 'tobe2111@naver.com', '358533aa!!_hash', '관리자', 'super_admin', datetime('now'));

-- 셀러 계정 생성 (이메일: seller@ur-team.com / 비밀번호: seller123)
INSERT OR IGNORE INTO sellers (username, email, password_hash, name, business_name, business_number, phone, status, commission_rate, created_at, updated_at)
VALUES ('testseller', 'seller@ur-team.com', 'seller123_hash', '테스트 셀러', '테스트 상점', '123-45-67890', '010-1234-5678', 'approved', 10.00, datetime('now'), datetime('now'));
