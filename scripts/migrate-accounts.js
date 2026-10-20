#!/usr/bin/env node

/**
 * 계정 DB 마이그레이션 스크립트
 * 
 * 실행 방법:
 * 1. 로컬: node scripts/migrate-accounts.js
 * 2. Cloudflare: wrangler d1 execute DB --file=scripts/migrate-accounts.sql
 */

import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 계정 정보
const ACCOUNTS = {
  seller: {
    email: 'tobe2111@naver.com',
    password: '358533aa!!',
    username: 'tobe2111',
    name: '메인 판매자',
    phone: '010-0000-0000',
    status: 'approved'
  },
  admin: {
    email: 'admin@ur-team.com',
    password: 'admin123',
    username: 'admin',
    name: '관리자'
  }
};

async function generateHashes() {
  console.log('🔐 bcrypt 해시 생성 중...\n');
  
  const sellerHash = await bcrypt.hash(ACCOUNTS.seller.password, 10);
  const adminHash = await bcrypt.hash(ACCOUNTS.admin.password, 10);
  
  console.log('✅ Seller 계정:');
  console.log(`   Email: ${ACCOUNTS.seller.email}`);
  console.log(`   Password: ${ACCOUNTS.seller.password}`);
  console.log(`   Hash: ${sellerHash}`);
  console.log('');
  
  console.log('✅ Admin 계정:');
  console.log(`   Email: ${ACCOUNTS.admin.email}`);
  console.log(`   Password: ${ACCOUNTS.admin.password}`);
  console.log(`   Hash: ${adminHash}`);
  console.log('');
  
  return { sellerHash, adminHash };
}

function generateSQL(sellerHash, adminHash) {
  return `
-- ===============================================
-- 자동 생성된 마이그레이션 SQL
-- 생성 시간: ${new Date().toISOString()}
-- ===============================================

-- 1. Seller 계정 생성/업데이트
INSERT INTO sellers (
  email, password_hash, username, name, phone, status, is_active, created_at
)
SELECT 
  '${ACCOUNTS.seller.email}',
  '${sellerHash}',
  '${ACCOUNTS.seller.username}',
  '${ACCOUNTS.seller.name}',
  '${ACCOUNTS.seller.phone}',
  '${ACCOUNTS.seller.status}',
  1,
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM sellers WHERE email = '${ACCOUNTS.seller.email}'
);

UPDATE sellers 
SET 
  password_hash = '${sellerHash}',
  status = '${ACCOUNTS.seller.status}',
  is_active = 1
WHERE email = '${ACCOUNTS.seller.email}';

-- 2. Admin 계정 생성/업데이트
INSERT INTO admins (
  email, password_hash, username, name, is_active, created_at
)
SELECT 
  '${ACCOUNTS.admin.email}',
  '${adminHash}',
  '${ACCOUNTS.admin.username}',
  '${ACCOUNTS.admin.name}',
  1,
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM admins WHERE email = '${ACCOUNTS.admin.email}'
);

UPDATE admins 
SET 
  password_hash = '${adminHash}',
  is_active = 1
WHERE email = '${ACCOUNTS.admin.email}';

-- 3. 결과 확인
SELECT 'seller' as type, id, email, name, status, is_active, substr(password_hash, 1, 20) as hash_preview
FROM sellers WHERE email = '${ACCOUNTS.seller.email}'
UNION ALL
SELECT 'admin' as type, id, email, name, NULL as status, is_active, substr(password_hash, 1, 20) as hash_preview
FROM admins WHERE email = '${ACCOUNTS.admin.email}';
`.trim();
}

async function main() {
  console.log('🚀 계정 DB 마이그레이션 스크립트\n');
  console.log('=' .repeat(50));
  console.log('');
  
  // 1. 해시 생성
  const { sellerHash, adminHash } = await generateHashes();
  
  // 2. SQL 생성
  const sql = generateSQL(sellerHash, adminHash);
  
  // 3. SQL 파일 저장
  const outputPath = path.join(__dirname, 'migrate-accounts-generated.sql');
  fs.writeFileSync(outputPath, sql, 'utf8');
  
  console.log('📄 SQL 파일 생성됨:');
  console.log(`   ${outputPath}`);
  console.log('');
  
  // 4. Cloudflare D1 실행 명령어
  console.log('🌐 Cloudflare D1 실행 방법:');
  console.log('');
  console.log('   Option 1: Wrangler CLI');
  console.log('   ------------------------');
  console.log('   npx wrangler d1 execute DB --file=scripts/migrate-accounts-generated.sql');
  console.log('');
  console.log('   Option 2: Dashboard');
  console.log('   -------------------');
  console.log('   1. Cloudflare Dashboard > Workers & Pages > D1');
  console.log('   2. "DB" 데이터베이스 선택');
  console.log('   3. Console 탭에서 위 SQL 복사/붙여넣기');
  console.log('');
  
  // 5. 완료
  console.log('=' .repeat(50));
  console.log('✅ 마이그레이션 준비 완료!');
  console.log('');
  console.log('⚠️  보안 주의사항:');
  console.log('   - 이 스크립트를 Git에 커밋하지 마세요');
  console.log('   - 배포 후 즉시 삭제하세요');
  console.log('   - 비밀번호를 주기적으로 변경하세요');
  console.log('');
}

// 실행
main().catch(console.error);

export { generateHashes, generateSQL };
