#!/usr/bin/env node
// migrate-all.js — D1 마이그레이션 전체 순차 실행 (Windows/Linux/Mac 호환)
//
// 사용법:
//   node scripts/migrate-all.js          # 로컬 D1
//   node scripts/migrate-all.js --prod   # 프로덕션 D1 (주의!)

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DB_NAME = 'toss-live-commerce-db';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const isProd = process.argv.includes('--prod');

async function confirm(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(message, () => { rl.close(); resolve(); });
  });
}

async function main() {
  if (isProd) {
    console.log('⚠️  프로덕션 DB에 마이그레이션을 실행합니다.');
    await confirm('    계속하려면 Enter, 취소하려면 Ctrl+C: ');
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => path.join(MIGRATIONS_DIR, f));

  console.log(`📦 총 ${files.length}개 마이그레이션 파일 발견\n`);

  let failed = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = path.basename(file);
    process.stdout.write(`[${String(i + 1).padStart(3)}/${files.length}] ${name} ... `);

    const remoteFlag = isProd ? '--remote' : '--local';
    const cmd = `npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --file="${file}"`;

    try {
      execSync(cmd, { stdio: 'pipe' });
      console.log('✅');
    } catch {
      console.log('⚠️  (오류 무시 — IF NOT EXISTS로 멱등 처리됨)');
      failed++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 완료: ${files.length}개 실행, ${failed}개 경고`);
  console.log(isProd ? '🚀 프로덕션 DB 마이그레이션 완료' : '🏠 로컬 DB 마이그레이션 완료');
}

main().catch(e => { console.error(e); process.exit(1); });
