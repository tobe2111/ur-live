#!/usr/bin/env node

/**
 * 🔍 Post-Build Validation
 * 
 * This script runs AFTER build to verify:
 * 1. React is in ONE chunk only (no duplicates)
 * 2. Chunk sizes are reasonable
 * 3. Critical files exist
 * 
 * Purpose: Catch build output issues before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 [Post-Build Validation] Analyzing build output...\n');

let hasError = false;
let hasWarning = false;

// ============================================
// 1. Check dist directory exists
// ============================================
const distPath = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ ERROR: dist/ directory not found!');
  console.error('   Build may have failed.');
  process.exit(1);
}

// ============================================
// 2. Find all JavaScript chunks
// ============================================
const assetsPath = path.join(distPath, 'assets');
if (!fs.existsSync(assetsPath)) {
  console.error('❌ ERROR: dist/assets/ directory not found!');
  process.exit(1);
}

const jsFiles = fs.readdirSync(assetsPath)
  .filter(f => f.endsWith('.js'))
  .map(f => ({
    name: f,
    path: path.join(assetsPath, f),
    size: fs.statSync(path.join(assetsPath, f)).size
  }));

console.log(`📦 Found ${jsFiles.length} JavaScript chunks\n`);

// ============================================
// 3. Check for React chunks
// ============================================
const reactCoreChunks = jsFiles.filter(f => f.name.includes('react-core'));
const vendorChunks = jsFiles.filter(f => f.name.includes('vendor-') && !f.name.includes('vendor-D') && !f.name.includes('utils'));

if (reactCoreChunks.length === 0) {
  console.error('❌ ERROR: No react-core chunk found!');
  console.error('   Vite config may be broken.');
  hasError = true;
} else if (reactCoreChunks.length > 1) {
  console.error('❌ ERROR: Multiple react-core chunks found!');
  console.error('   This will cause duplicate React instances!');
  reactCoreChunks.forEach(c => console.error(`   - ${c.name}`));
  hasError = true;
} else {
  const chunk = reactCoreChunks[0];
  const sizeKB = (chunk.size / 1024).toFixed(2);
  console.log(`✅ Single react-core chunk: ${chunk.name} (${sizeKB} KB)`);
  
  // Check size is reasonable (React 18 should be ~140-160 KB)
  if (chunk.size > 170 * 1024) {
    console.warn(`⚠️  Warning: react-core is larger than expected (${sizeKB} KB > 170 KB)`);
    console.warn(`   May contain duplicate React code!`);
    hasWarning = true;
  }
}

// ============================================
// 4. Check vendor chunks don't contain React
// ============================================
console.log('\n🔍 Checking vendor chunks for React code...');

vendorChunks.forEach(chunk => {
  const content = fs.readFileSync(chunk.path, 'utf8');
  
  // Look for React-specific code patterns
  const hasReactCode = content.includes('__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED') ||
                       content.includes('Children:') && content.includes('createElement:') ||
                       content.includes('react-dom') && content.includes('createRoot');
  
  if (hasReactCode) {
    console.error(`❌ ERROR: ${chunk.name} contains React code!`);
    console.error(`   This will cause duplicate React instances!`);
    console.error(`   Check vite.config.ts manualChunks configuration.`);
    hasError = true;
  } else {
    const sizeKB = (chunk.size / 1024).toFixed(2);
    console.log(`✅ ${chunk.name} is clean (${sizeKB} KB)`);
  }
});

// ============================================
// 5. Check critical files
// ============================================
console.log('\n🔍 Checking critical files...');

const criticalFiles = [
  'index.html',
  '_worker.js',
  '_routes.json'
];

criticalFiles.forEach(file => {
  const filePath = path.join(distPath, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ERROR: ${file} not found!`);
    hasError = true;
  } else {
    console.log(`✅ ${file} exists`);
  }
});

// ============================================
// 5b. CRITICAL: _worker.js 신선도 검증 (2026-05-12 사고 후 추가)
//   증상: 'npx vite build' 만 실행 → client 만 빌드, _worker.js 미갱신
//        → 모든 worker 코드 fix 가 production 에 반영 안 됨 (405 에러 반복)
//   방어: _worker.js 의 mtime 이 worker 소스 (src/worker/*, src/features/*/api/*)
//        의 최신 mtime 보다 오래되면 빌드 실패. npm run build 강제.
// ============================================
const workerPath = path.join(distPath, '_worker.js');
if (fs.existsSync(workerPath)) {
  const workerMtime = fs.statSync(workerPath).mtimeMs;
  const workerSourceDirs = [
    path.join(process.cwd(), 'src/worker'),
    path.join(process.cwd(), 'src/features'),
    path.join(process.cwd(), 'src/lib'),
    path.join(process.cwd(), 'src/shared/db'),
  ];

  let newestSourceMtime = 0;
  let newestSourcePath = '';
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.(ts|tsx|mjs|cjs)$/.test(entry.name)) {
        const m = fs.statSync(full).mtimeMs;
        if (m > newestSourceMtime) {
          newestSourceMtime = m;
          newestSourcePath = full;
        }
      }
    }
  }
  workerSourceDirs.forEach(walk);

  // 5초 grace period — 빌드 중 동시 저장된 파일 허용
  const STALE_THRESHOLD_MS = 5_000;
  if (newestSourceMtime > workerMtime + STALE_THRESHOLD_MS) {
    console.error('\n❌ ERROR: _worker.js is STALE!');
    console.error(`   _worker.js mtime: ${new Date(workerMtime).toISOString()}`);
    console.error(`   Newer source:     ${new Date(newestSourceMtime).toISOString()}`);
    console.error(`   File:             ${path.relative(process.cwd(), newestSourcePath)}`);
    console.error('\n   진단: worker 소스가 변경됐는데 _worker.js 는 이전 빌드.');
    console.error('   원인: \'npx vite build\' 또는 \'npm run build:client\' 만 실행한 듯.');
    console.error('   해결: 반드시 \'npm run build\' 실행 (worker + client + prepare 모두)');
    console.error('   또는 \'npm run build:worker\' 만 실행해도 가능.');
    hasError = true;
  } else {
    console.log(`✅ _worker.js is fresh (built after latest worker source)`);
  }
}

// ============================================
// 6. Summary
// ============================================
console.log('\n' + '='.repeat(50));

if (hasError) {
  console.error('❌ Post-build validation FAILED!');
  console.error('   DO NOT DEPLOY! Fix errors above first.\n');
  process.exit(1);
} else if (hasWarning) {
  console.warn('⚠️  Post-build validation passed with warnings.');
  console.warn('   Review warnings above.\n');
  process.exit(0);
} else {
  console.log('✅ Post-build validation PASSED!');
  console.log('   Build output is safe to deploy.\n');
  
  // Print chunk summary
  console.log('📊 Chunk Summary:');
  const sortedChunks = jsFiles.sort((a, b) => b.size - a.size).slice(0, 10);
  sortedChunks.forEach(chunk => {
    const sizeKB = (chunk.size / 1024).toFixed(2);
    console.log(`   ${chunk.name.padEnd(40)} ${sizeKB.padStart(8)} KB`);
  });
  console.log('');
  
  process.exit(0);
}
