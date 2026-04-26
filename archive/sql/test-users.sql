-- 일반 사용자 테스트 계정 생성

-- 테스트 계정 1: test@example.com / test123
INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
VALUES (
  'test@example.com',
  'placeholder_hash_for_test123',
  '테스트 사용자',
  '010-1234-5678',
  datetime('now'),
  datetime('now')
);

-- 테스트 계정 2: user@example.com / user123
INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
VALUES (
  'user@example.com',
  'placeholder_hash_for_user123',
  '일반 사용자',
  '010-9876-5432',
  datetime('now'),
  datetime('now')
);

-- 테스트 계정 3: demo@example.com / demo123
INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
VALUES (
  'demo@example.com',
  'placeholder_hash_for_demo123',
  '데모 사용자',
  '010-5555-6666',
  datetime('now'),
  datetime('now')
);
