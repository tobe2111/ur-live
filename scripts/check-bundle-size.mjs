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

/**
 * gzip 크기를 **직접 계산**한다.
 *
 * ⚠️ 2026-07-29: 예전엔 디스크의 `.gz` 사이드카만 읽었다(`existsSync(f + '.gz') ? … : 0`).
 *   **vite 는 `.gz` 를 만들지 않는다** → 모든 파일의 gzip 이 0 → totalGzip 이 항상 0 →
 *   `0 > 1.5` 는 영원히 거짓 → **gzip 예산이 몇 달간 통과만 했다.**
 *   그 죽은 값이 raw 예산 상향 4번의 근거로 인용됐다("gzip 은 여유 있으니 감지력은 유지된다").
 *   critical-path 예산은 같은 파일에서 이미 `zlib.gzipSync` 로 직접 재고 있었다 — 그 방식으로 통일한다.
 *   사이드카가 있으면(압축 산출물을 만드는 빌드) 그걸 우선 쓴다: 실제 배포 바이트에 더 가깝다.
 */
const gzipOf = (fileName) => {
  const gzPath = path.join(distDir, fileName + '.gz');
  if (fs.existsSync(gzPath)) return fs.statSync(gzPath).size;
  return zlib.gzipSync(fs.readFileSync(path.join(distDir, fileName))).length;
};

const jsFiles = files
  .filter(f => f.endsWith('.js'))
  .map(f => {
    const stats = fs.statSync(path.join(distDir, f));
    const brPath = path.join(distDir, f + '.br');
    return {
      name: f,
      size: stats.size,
      gzip: gzipOf(f),
      brotli: fs.existsSync(brPath) ? fs.statSync(brPath).size : 0,
    };
  })
  .sort((a, b) => b.size - a.size);

const cssFiles = files
  .filter(f => f.endsWith('.css'))
  .map(f => ({
    name: f,
    size: fs.statSync(path.join(distDir, f)).size,
    gzip: gzipOf(f),
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
  //   근거로 들었는데, **그때 그 gzip 예산은 죽어 있었다**: `f.gzip` 을 디스크의 `.gz` 파일에서만 읽는데
  //   vite 는 `.gz` 를 만들지 않아 totalGzip 이 **항상 0** → `0 > 1.5` 가 영원히 거짓이었다.
  //   ✅ 같은 날 복구 완료 — `gzipOf`(zlib 직접 계산) + 실측 기반 임계값. **이제 두 감지기 모두 살아 있다.**
  //   (그전까지 실제로 작동한 감지기는 critical-path 하나뿐이었다 — 294.5/300, 여유 5.5KB.)
  // 🛡️ 2026-08-01: 8.8 → 8.85 상향(**6번째**). 운영자 몰 세션의 **신규 lazy 라우트 3개**
  //   (`MallHomePage` 5.2KB · `SellerQuickGbPage` 5.8KB · `SellerReturnsPage` 3.7KB = **14.8KB**)로
  //   실측 **8.8032 MB** → 3.3KB 초과. 이번엔 근거를 **둘 다 살아 있는 감지기로** 확인했다:
  //   `check-critical-chunks` **신규 진입 0**(17개 기준 동일) + gzip 예산(2026-07-29 복구분) 통과.
  //   ⇒ 늘어난 건 **라우트 진입 시에만 받는 청크**라 첫 페인트 비용은 그대로다.
  //   ⚠️ 0.1 이 아니라 **0.05 만** 올린다 — 다음 PR 이 또 경계에 닿아야 이 판단을 다시 하게 된다.
  totalRawMB: 8.85,
  // ✅ 2026-07-29 교정 완료 — **CI 실측 2.707 MB**(run 30426592229, main+가드 변경 기준).
  //   ⚠️ 교정 전 추정은 "2.2~2.5MB" 였고 **틀렸다**. 그 추정값으로 켰다면 전 PR 이 red 였다.
  //   숫자를 지어내지 말고 반드시 CI 의 "Bundle size report" 로그에서 읽을 것.
  //   헤드룸 ~7%: 유기적 주간 성장은 통과시키되, eager import 가 새로 하나 들어오는 수준
  //   (gzip 기준 수백 KB)은 잡는다.
  //   📌 이 값을 올릴 때는 **무엇이 늘었는지 한 줄 적을 것.** raw 예산이 5번 올라가는 동안
  //      "gzip 은 여유 있다" 가 근거로 인용됐는데 그 값은 **죽어 있었다**(항상 0). 이제 진짜 값이다.
  totalGzipMB: 2.9,
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
  // ⬇️ 2026-07-29: 300 → 250 **하향**. 이 파일에서 임계값이 내려가는 건 처음이다.
  //   app-components 를 엔트리 preload 에서 들어냈다(vite.config manualChunks 의 app-shell 허용목록 —
  //   그 청크 76 모듈 중 엔트리가 eager 로 쓰는 건 14 개뿐이었고 62 개 280KB 가 얹혀 가고 있었다).
  //   실측 **294.7 → 226.7 KB**(로컬 `npm run build:client`). 로컬↔CI 오차는 0.2KB 수준이라
  //   (직전 CI 294.5 vs 로컬 294.7) 이 값을 그대로 신뢰할 수 있다.
  //   ⬇️ 같은 PR 2단계: 250 → **240**. `cn()`+tailwind-merge(97.1 KB raw)와 도매 훅(15.7 KB)이
  //   app-utils 를 통해 크리티컬에 얹혀 있던 것을 마저 들어냈다(실측 226.7 → **216.0 KB**).
  //   누적 **294.7 → 216.0 KB (−78.7KB, −27%)**. 240 = 실측 + 약 10% 헤드룸(동일 기준).
  //   250 = 실측 + 약 10% 헤드룸. **여유를 300 그대로 두면 안 된다** — 73KB(24%) 짜리 헤드룸은
  //   eager import 가 새로 들어와도 한참 뒤에야 울리는 **둔한 감지기**이고, 그 사이 다시 차오른다.
  //   (실제로 그렇게 차올랐다: app-components 는 2026-05-24·05-27 에 -248KB·-305KB 를 덜어냈는데도
  //    2026-07 에 다시 20% 를 먹고 있었다. 헤드룸을 남기면 규율이 아니라 예산이 소비된다.)
  //   📌 이 값을 **올리려면** 무엇이 왜 늘었는지 한 줄 적을 것. raw 예산은 "gzip 은 여유 있다" 를
  //      근거로 5번 올라갔고 그 gzip 값은 죽어 있었다 — 근거로 인용하는 숫자가 살아있는지부터 볼 것.
  criticalGzipKB: 240,
};

const violations = [];
if (totalSize / 1024 / 1024 > BUDGET.totalRawMB) {
  violations.push(`총 raw JS ${(totalSize / 1024 / 1024).toFixed(2)} MB > ${BUDGET.totalRawMB} MB`);
  // 🔎 2026-07-29: **무엇이 큰지 + 그게 사용자에게 무슨 의미인지까지** 말해준다.
  //   이 예산이 터지면 지금까지 5번 모두 "임계값 상향"으로 끝났다. 그 이유 중 하나는 메시지가
  //   "8.81 > 8.8" 뿐이라 **판단 재료가 없어서** 다. 실측(2026-07-29)으로 성격이 분명해졌다:
  //   상위 3개(sentry·charts·firebase)만 3.5MB(40%)이고 **전부 lazy 청크**다 —
  //   사용자는 이 8.75MB 를 다운로드하지 않는다. 즉 이 값은 **UX 지표가 아니라 성장 지표**이고,
  //   실제 사용자 체감은 `critical path`(이 파일의 다른 예산), 실제 플랫폼 한도는
  //   `_worker.js` gzip 1MB(main.yml) 과 `dist/client` 50MB(실측 36MB) 가 각각 따로 지킨다.
  //   ⇒ 올릴지 줄일지 정하기 전에 **아래 목록이 정말 lazy 인지**부터 볼 것(크리티컬이면 진짜 문제다).
  const topRaw = jsFiles.slice(0, 5);
  const criticalNames = new Set(criticalFiles.map(f => f.name));
  for (const f of topRaw) {
    const tag = criticalNames.has(f.name) ? '⚠️ CRITICAL' : 'lazy';
    violations.push(`    ↳ ${f.name}: ${(f.size / 1024).toFixed(0)} KB raw (${tag})`);
  }
  violations.push('    → lazy 만 커졌다면 사용자 체감은 그대로다(critical path 예산이 그쪽을 지킨다).');
  violations.push('    → 임계값을 올리려면 **무엇이 왜 늘었는지 한 줄** 남길 것. 이 값은 이미 5번 올라갔다.');
}
// 🛡️ 측정 실패는 통과가 아니다 — 이 파일이 정확히 그렇게 몇 달을 통과했다(항상 0).
if (totalGzip === 0) {
  violations.push('총 gzip 을 측정하지 못했다 (js 산출물 0건 또는 압축 실패) — 예산 검사가 무력화된 상태다');
} else if (BUDGET.totalGzipMB == null) {
  // 교정 대기: 위반으로 올리지 않되, 측정값을 눈에 띄게 남겨 다음 커밋이 임계값을 확정하게 한다.
  console.error(`\n🔴 [CALIBRATION PENDING] 총 gzip JS 실측 = ${(totalGzip / 1024 / 1024).toFixed(3)} MB (${(totalGzip / 1024).toFixed(1)} KB)`);
  console.error(`   → scripts/check-bundle-size.mjs 의 BUDGET.totalGzipMB 를 이 값 + 헤드룸으로 설정하세요.`);
} else if (totalGzip / 1024 / 1024 > BUDGET.totalGzipMB) {
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
  // 🔎 2026-07-29: **무엇을 줄여야 하는지까지 말해준다.** 이 예산은 실측 294.5/300 으로 여유가 1.8% 뿐이라
  //   다음에 eager import 하나만 늘어도 터진다. 그때 "몇 KB 초과" 만 알려주면 받는 사람이 처음부터
  //   빌드를 다시 돌려 원인을 찾아야 한다(이 레포는 npm 이 막힌 컨테이너가 흔해 그게 비싸다).
  //   기여도 상위 5개를 함께 찍어 바로 lazy 분할 대상을 고르게 한다.
  const top = criticalFiles
    .map(f => ({ name: f.name, gz: f.gzip > 0 ? f.gzip : zlib.gzipSync(fs.readFileSync(path.join(distDir, f.name))).length }))
    .sort((a, b) => b.gz - a.gz)
    .slice(0, 5);
  for (const f of top) violations.push(`    ↳ ${f.name}: ${(f.gz / 1024).toFixed(1)} KB gzip`);
  violations.push(`    → 위 청크에서 첫 페인트에 불필요한 것을 lazy 로 내리세요(entry 에 새 eager import 가 들어왔는지부터 확인).`);
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
  console.log(`   Total gzip JS: ${(totalGzip / 1024 / 1024).toFixed(3)} / ${BUDGET.totalGzipMB ?? '미교정(CALIBRATION PENDING)'} MB`);
  console.log(`   Single max KB: ${BUDGET.singleRawKB} KB`);
  if (criticalGzip > 0) {
    console.log(`   Critical path: ${(criticalGzip / 1024).toFixed(1)} / ${BUDGET.criticalGzipKB} KB gzip (entry+modulepreload ${criticalFiles.length} files)`);
    // 🔎 2026-07-29: **위반이 아닐 때도** 구성을 찍는다. 이 예산은 실측 294.5/300(여유 1.8%)이라
    //   "언제 터지나"보다 "무엇이 차지하나"가 실질 정보인데, 그동안 총합만 보였다.
    //   npm 이 막힌 컨테이너에서는 이 로그가 구성을 아는 유일한 창이다(빌드를 못 돌린다).
    const criticalTop = criticalFiles
      .map(f => ({ name: f.name, gz: f.gzip > 0 ? f.gzip : zlib.gzipSync(fs.readFileSync(path.join(distDir, f.name))).length }))
      .sort((a, b) => b.gz - a.gz);
    for (const f of criticalTop.slice(0, 8)) {
      console.log(`      ${((f.gz / criticalGzip) * 100).toFixed(0).padStart(3)}%  ${(f.gz / 1024).toFixed(1).padStart(6)} KB  ${f.name}`);
    }
    if (criticalTop.length > 8) {
      const rest = criticalTop.slice(8).reduce((s, f) => s + f.gz, 0);
      console.log(`             ${(rest / 1024).toFixed(1).padStart(6)} KB  (나머지 ${criticalTop.length - 8}개)`);
    }
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
