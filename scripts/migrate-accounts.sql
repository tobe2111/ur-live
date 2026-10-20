-- ===============================================
-- 계정 DB 마이그레이션 스크립트
-- 생성일: 2026-03-09
-- 목적: 하드코딩 계정을 DB에 bcrypt 해시로 저장
-- ===============================================

-- 1. 판매자 계정 (tobe2111@naver.com)
-- 비밀번호: 358533aa!!
-- bcrypt hash: $2b$10$SsTjFirVeRKqFlkru6byk.sYyjakfpZKnfZyshCTMn2DL.KvJqoEO

-- 기존 계정 확인
SELECT COUNT(*) as count FROM sellers WHERE email = 'tobe2111@naver.com';

-- 계정이 없으면 생성
INSERT INTO sellers (
  email, 
  password_hash, 
  username,
  name, 
  phone,
  status, 
  is_active,
  created_at,
  last_login_at
)
SELECT 
  'tobe2111@naver.com',
  '$2b$10$SsTjFirVeRKqFlkru6byk.sYyjakfpZKnfZyshCTMn2DL.KvJqoEO',
  'tobe2111',
  '메인 판매자',
  '010-0000-0000',
  'approved',
  1,
  datetime('now'),
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM sellers WHERE email = 'tobe2111@naver.com'
);

-- 계정이 이미 있으면 password_hash 업데이트
UPDATE sellers 
SET 
  password_hash = '$2b$10$SsTjFirVeRKqFlkru6byk.sYyjakfpZKnfZyshCTMn2DL.KvJqoEO',
  status = 'approved',
  is_active = 1
WHERE email = 'tobe2111@naver.com';

-- ===============================================

-- 2. 관리자 계정 (admin@ur-team.com)
-- 비밀번호: admin123
-- bcrypt hash: $2b$10$XYgSEHLNbgbiGU8UTbV7MuT.vc6tnXsVptSubM.eQg6zzwv2bjLwu

-- 기존 계정 확인
SELECT COUNT(*) as count FROM admins WHERE email = 'admin@ur-team.com';

-- 계정이 없으면 생성
INSERT INTO admins (
  email,
  password_hash,
  username,
  name,
  is_active,
  created_at,
  last_login_at
)
SELECT 
  'admin@ur-team.com',
  '$2b$10$XYgSEHLNbgbiGU8UTbV7MuT.vc6tnXsVptSubM.eQg6zzwv2bjLwu',
  'admin',
  '관리자',
  1,
  datetime('now'),
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM admins WHERE email = 'admin@ur-team.com'
);

-- 계정이 이미 있으면 password_hash 업데이트
UPDATE admins 
SET 
  password_hash = '$2b$10$XYgSEHLNbgbiGU8UTbV7MuT.vc6tnXsVptSubM.eQg6zzwv2bjLwu',
  is_active = 1
WHERE email = 'admin@ur-team.com';

-- ===============================================

-- 결과 확인
SELECT 
  'seller' as type,
  id,
  email,
  name,
  status,
  is_active,
  substr(password_hash, 1, 20) as hash_preview,
  created_at
FROM sellers 
WHERE email = 'tobe2111@naver.com'

UNION ALL

SELECT 
  'admin' as type,
  id,
  email,
  name,
  NULL as status,
  is_active,
  substr(password_hash, 1, 20) as hash_preview,
  created_at
FROM admins 
WHERE email = 'admin@ur-team.com';

-- ===============================================
-- 실행 완료!
-- 
-- ✅ Seller: tobe2111@naver.com / 358533aa!!
-- ✅ Admin: admin@ur-team.com / admin123
-- 
-- ⚠️ 주의: 이 파일을 Git에 커밋하지 마세요!
-- ⚠️ 보안을 위해 배포 후 삭제하세요!
-- ===============================================
