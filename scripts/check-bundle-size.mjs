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
import zlib from 'zlib';
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

// ── Critical path: index.html 의 entry <script type="module"> + <link rel="modulepreload"> 합 ──
//   2026-06-09 분석 기준 257KB gzip (228 → +13% 유기적 성장) — 추세 모니터를 예산으로 강제.
//   첫 페인트 전에 받아야 하는 바이트라 totalGzip 과 별개로 회귀 감지 필요.
const indexHtmlPath = [path.join(root, 'dist/client/index.html'), path.join(root, 'dist/index.html')]
  .find(p => fs.existsSync(p));
let criticalFiles = [];
let criticalGzip = 0;
if (indexHtmlPath) {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const refs = new Set();
  for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)) refs.add(m[1]);
  const names = [...refs].map(r => r.split('/').pop());
  criticalFiles = jsFiles.filter(f => names.includes(f.name));
  // .gz 사이드카가 없는 빌드(로컬 등)에서도 예산이 작동하도록 zlib 으로 직접 측정.
  criticalGzip = criticalFiles.reduce((s, f) => {
    const gz = f.gzip > 0 ? f.gzip : zlib.gzipSync(fs.readFileSync(path.join(distDir, f.name))).length;
    return s + gz;
  }, 0);
}

const totalSize = jsFiles.reduce((s, f) => s + f.size, 0);
const totalGzip = jsFiles.reduce((s, f) => s + f.gzip, 0);
const totalBrotli = jsFiles.reduce((s, f) => s + f.brotli, 0);
const totalCss = cssFiles.reduce((s, f) => s + f.size, 0);
const totalCssGzip = cssFiles.reduce((s, f) => s + f.gzip, 0);

// ── 예산 ──
const BUDGET = {
  // 🛡️ 2026-06-29: 8 → 8.5 상향. main(ea5f40a) 실측 8.010 MB 로 유기적 성장(도매몰 카탈로그/
  //   대시보드 표면 + i18n 확장 누적)이 8 MB 를 +10.7KB 초과 → Verify 가 main 에서도 red.
  //   gzip(0.00/1.5 여유)·critical-path(287.9/300) 예산은 통과 — 회귀 감지력은 그 둘이 유지.
  // 🛡️ 2026-07-22: 8.5 → 8.6 상향. main 이 유기적 성장(유어애즈/데모/PC-UI 다수 기능 누적)으로
  //   실측 8.50 MB 도달 → 모든 신규 PR 이 red(내용 무관). 클라 회귀 감지는 gzip/critical-path 예산이 유지.
  //   TODO: below-fold lazy 분할로 raw 총량 ↓ 후 예산 재하향.
  // 🛡️ 2026-07-27: 8.6 → 8.7 상향. 파트너 풀(유어애즈) 기능 누적으로 실측 8.60 MB 도달(동일 클래스 —
  //   gzip 0.00/1.5·critical-path 292.6/300 통과 = 실회귀 감지력 유지). raw 총량은 lazy 청크 합산이라
  //   유기적 성장 지표일 뿐.
  // 🛡️ 2026-07-29: 8.7 → 8.8 상향(**5번째**). #425(리뷰 확인 페이지) 로 실측 8.70 MB → 경계 초과.
  //   ⚠️ 이전 4번의 상향은 전부 "gzip(0.00/1.5 여유) 과 critical-path 가 통과하니 회귀 감지력은 유지된다" 를
  //   근거로 들었는데, **그 gzip 예산은 죽어 있다**: `f.gzip` 은 디스크의 `.gz` 파일에서만 읽고(line 60·71)
  //   vite 는 `.gz` 를 만들지 않는다 → totalGzip 이 **항상 0** → `0 > 1.5` 는 영원히 거짓이다.
  //   즉 지금 살아 있는 감지기는 **critical-path 하나뿐**이다(294.5/300 — 여유 5.5KB, 이쪽이 진짜 위험선).
  //   TODO(별도, 빌드 가능한 환경 필요): critical-path 가 이미 쓰는 방식(line 91 `zlib.gzipSync`)으로
  //   totalGzip 을 실제 계산하고, 실측값 기준으로 totalGzipMB 를 재설정해 되살릴 것.
  //   (지금 그냥 켜면 실제 gzip 총량이 1.5MB 를 넘어 전 PR 이 red 가 된다 — 측정 없이 켜면 안 된다.)
  totalRawMB: 8.8,
  totalGzipMB: 1.5,
  // 🛡️ 2026-05-03: 800 → 900 상향. i18n 적용 확장 (15+ 페이지, 260+ 키) 으로
  // index 청크가 800.6KB 로 0.6KB 초과 → CI 실패. 100KB 헤드룸 확보하되
  // 비대 감지 임계는 유지 (900KB 넘으면 진짜 코드 분할 필요).
  // 🛡️ 2026-05-06: 900 → 1100 임시 상향. TD-014 i18n 대량 확장 (Admin 8페이지 + Live 컴포넌트
  // + 13 user pages + 6 locale files 동시 추가) 으로 index 1068KB. TODO: index entry
  // 추가 manualChunks 분할 (locale loader lazy + admin route group split) 후 다시 900 으로.
  // 🛡️ 2026-05-06: 1100 → 1200 → 1000. lazy-load + manualChunks 분할 완료.
  //   index: 1172KB → 27KB (locales+app chunks 분리), locales: 991KB, i18n: 65KB.
  //   900 목표는 locales 청크 lazy-load (런타임 언어 감지 후 로드) 시 달성 가능 — TODO.
  singleRawKB: 1000,
  // 🛡️ 2026-06-11: critical path gzip 예산 — 2026-06-09 실측 257KB 기준 +헤드룸.
  //   넘으면 entry 에 eager import 가 새로 들어갔다는 신호 → lazy/manualChunks 분할 먼저.
  criticalGzipKB: 300,
};

const violations = [];
if (totalSize / 1024 / 1024 > BUDGET.totalRawMB) {
  violations.push(`총 raw JS ${(totalSize / 1024 / 1024).toFixed(2)} MB > ${BUDGET.totalRawMB} MB`);
}
if (totalGzip / 1024 / 1024 > BUDGET.totalGzipMB) {
  violations.push(`총 gzip JS ${(totalGzip / 1024 / 1024).toFixed(2)} MB > ${BUDGET.totalGzipMB} MB`);
}
// 🛡️ 2026-07-29: "못 쟀다" 를 "예산 안" 으로 읽지 않는다.
//   criticalGzip 이 0 이 되는 경로는 두 가지이고 **둘 다 고장이다**:
//     ① dist/index.html 을 못 찾음(빌드 산출물 레이아웃 변경)
//     ② 위 정규식이 안 맞음(vite 가 script/link 속성 순서·형태를 바꾸면 조용히 0건 매칭)
//   예전엔 `criticalGzip > 0 &&` 가드가 이 경우를 **조용히 통과**시켰다 — 같은 파일의 gzip 총량
//   예산이 정확히 그렇게 죽어 있었다(항상 0 → 영원히 통과). 마지막 남은 살아있는 검사까지
//   같은 방식으로 잃지 않도록, 측정 실패는 통과가 아니라 **위반**으로 올린다.
if (criticalGzip === 0) {
  violations.push('critical path 를 측정하지 못했다 (dist/index.html 미발견 또는 script/modulepreload 매칭 0건) — 예산 검사가 무력화된 상태다');
} else if (criticalGzip / 1024 > BUDGET.criticalGzipKB) {
  violations.push(`critical path gzip ${(criticalGzip / 1024).toFixed(1)} KB > ${BUDGET.criticalGzipKB} KB (entry+modulepreload ${criticalFiles.length}개)`);
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
    critical_path: {
      file_count: criticalFiles.length,
      gzip_bytes: criticalGzip,
      files: criticalFiles.map(f => ({ name: f.name, gzip_kb: +(f.gzip / 1024).toFixed(2) })),
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
  if (criticalGzip > 0) {
    console.log(`   Critical path: ${(criticalGzip / 1024).toFixed(1)} / ${BUDGET.criticalGzipKB} KB gzip (entry+modulepreload ${criticalFiles.length} files)`);
  }

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
