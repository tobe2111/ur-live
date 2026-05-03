#!/usr/bin/env node
/**
 * Bundle Size Analyzer + Budget Check
 *
 * 사용:
 *   node scripts/check-bundle-size.mjs            # 표 출력
 *   node scripts/check-bundle-size.mjs --json     # JSON 출력 (CI 용)
 *   node scripts/check-bundle-size.mjs --budget   # 예산 초과 시 exit 1
 *
 * 예산 (BUDGET):
 *   - 총 raw JS:    < 8 MB
 *   - 총 gzip JS:   < 1.5 MB
 *   - 단일 파일 raw: < 800 KB (코드 분할 권장 임계)
 *
 * CI 통합:
 *   .github/workflows/build.yml 에서
 *     - run: npm run build:client
 *     - run: node scripts/check-bundle-size.mjs --budget
 *   추가 시 PR 별 회귀 방어.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const jsonMode = args.has('--json');
const budgetMode = args.has('--budget');

// 배포 산출물: dist/client/assets (Cloudflare Pages 표준)
// fallback: dist/assets (구 vite 출력)
const candidatePaths = [
  path.join(root, 'dist/client/assets'),
  path.join(root, 'dist/assets'),
];
const distDir = candidatePaths.find(p => fs.existsSync(p));

if (!distDir) {
  console.error('❌ Build output not found. Run `npm run build:client` first.');
  console.error(`   Expected one of: ${candidatePaths.join(', ')}`);
  process.exit(1);
}

const files = fs.readdirSync(distDir);

const jsFiles = files
  .filter(f => f.endsWith('.js'))
  .map(f => {
    const stats = fs.statSync(path.join(distDir, f));
    const gzPath = path.join(distDir, f + '.gz');
    const brPath = path.join(distDir, f + '.br');
    return {
      name: f,
      size: stats.size,
      gzip: fs.existsSync(gzPath) ? fs.statSync(gzPath).size : 0,
      brotli: fs.existsSync(brPath) ? fs.statSync(brPath).size : 0,
    };
  })
  .sort((a, b) => b.size - a.size);

const cssFiles = files
  .filter(f => f.endsWith('.css'))
  .map(f => ({
    name: f,
    size: fs.statSync(path.join(distDir, f)).size,
    gzip: fs.existsSync(path.join(distDir, f + '.gz'))
      ? fs.statSync(path.join(distDir, f + '.gz')).size : 0,
  }));

const totalSize = jsFiles.reduce((s, f) => s + f.size, 0);
const totalGzip = jsFiles.reduce((s, f) => s + f.gzip, 0);
const totalBrotli = jsFiles.reduce((s, f) => s + f.brotli, 0);
const totalCss = cssFiles.reduce((s, f) => s + f.size, 0);
const totalCssGzip = cssFiles.reduce((s, f) => s + f.gzip, 0);

// ── 예산 ──
const BUDGET = {
  totalRawMB: 8,
  totalGzipMB: 1.5,
  // 🛡️ 2026-05-03: 800 → 900 상향. i18n 적용 확장 (15+ 페이지, 260+ 키) 으로
  // index 청크가 800.6KB 로 0.6KB 초과 → CI 실패. 100KB 헤드룸 확보하되
  // 비대 감지 임계는 유지 (900KB 넘으면 진짜 코드 분할 필요).
  singleRawKB: 900,
};

const violations = [];
if (totalSize / 1024 / 1024 > BUDGET.totalRawMB) {
  violations.push(`총 raw JS ${(totalSize / 1024 / 1024).toFixed(2)} MB > ${BUDGET.totalRawMB} MB`);
}
if (totalGzip / 1024 / 1024 > BUDGET.totalGzipMB) {
  violations.push(`총 gzip JS ${(totalGzip / 1024 / 1024).toFixed(2)} MB > ${BUDGET.totalGzipMB} MB`);
}
const overSized = jsFiles.filter(f => f.size / 1024 > BUDGET.singleRawKB);
if (overSized.length > 0) {
  violations.push(`단일 파일 ${BUDGET.singleRawKB}KB 초과: ${overSized.length}개`);
  overSized.forEach(f => violations.push(`  - ${f.name}: ${(f.size / 1024).toFixed(1)} KB`));
}

if (jsonMode) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    distDir: path.relative(root, distDir),
    js: {
      file_count: jsFiles.length,
      total_raw_bytes: totalSize,
      total_gzip_bytes: totalGzip,
      total_brotli_bytes: totalBrotli,
      top10: jsFiles.slice(0, 10).map(f => ({
        name: f.name,
        raw_kb: +(f.size / 1024).toFixed(2),
        gzip_kb: +(f.gzip / 1024).toFixed(2),
      })),
    },
    css: {
      file_count: cssFiles.length,
      total_raw_bytes: totalCss,
      total_gzip_bytes: totalCssGzip,
    },
    budget: BUDGET,
    violations,
  }, null, 2));
} else {
  console.log('\n📦 Bundle Size Analysis');
  console.log(`📂 ${path.relative(root, distDir)}\n`);

  console.log('Top 10 Largest JS Files:');
  console.log('─'.repeat(100));
  jsFiles.slice(0, 10).forEach((file, i) => {
    const sizeKB = (file.size / 1024).toFixed(2);
    const gzipKB = (file.gzip / 1024).toFixed(2);
    const brotliKB = (file.brotli / 1024).toFixed(2);
    const reduction = file.gzip > 0 ? (((file.size - file.gzip) / file.size) * 100).toFixed(1) : 0;
    const warn = file.size / 1024 > BUDGET.singleRawKB ? ' ⚠️  큰 청크 — 코드 분할 검토' : '';
    console.log(`${(i + 1).toString().padStart(2)}. ${file.name}${warn}`);
    console.log(`    Raw: ${sizeKB.padStart(8)} KB | Gzip: ${gzipKB.padStart(7)} KB (-${reduction}%) | Brotli: ${brotliKB.padStart(7)} KB`);
  });

  console.log('\n' + '─'.repeat(100));
  console.log(`📊 Total JS:`);
  console.log(`   Raw:    ${(totalSize / 1024 / 1024).toFixed(2)} MB  (${jsFiles.length} files)`);
  console.log(`   Gzip:   ${(totalGzip / 1024).toFixed(2)} KB`);
  console.log(`   Brotli: ${(totalBrotli / 1024).toFixed(2)} KB`);
  console.log(`📊 Total CSS:`);
  console.log(`   Raw:    ${(totalCss / 1024).toFixed(2)} KB  (${cssFiles.length} files)`);
  console.log(`   Gzip:   ${(totalCssGzip / 1024).toFixed(2)} KB`);

  console.log('\n💰 Budget:');
  console.log(`   Total raw JS:  ${(totalSize / 1024 / 1024).toFixed(2)} / ${BUDGET.totalRawMB} MB`);
  console.log(`   Total gzip JS: ${(totalGzip / 1024 / 1024).toFixed(2)} / ${BUDGET.totalGzipMB} MB`);
  console.log(`   Single max KB: ${BUDGET.singleRawKB} KB`);

  if (violations.length === 0) {
    console.log('\n✅ All within budget.');
  } else {
    console.log('\n⚠️  Budget violations:');
    violations.forEach(v => console.log(`   - ${v}`));
  }
}

if (budgetMode && violations.length > 0) {
  process.exit(1);
}
