#!/usr/bin/env npx ts-node --project tsconfig.node.json
/**
 * ============================================================
 * Route Validation Script — 3종 자동 안전망
 * ============================================================
 *
 * 실행: npx ts-node scripts/validate-routes.ts
 *   또는 npm run validate:routes
 *
 * 검사 항목:
 *   1. Fullpath Hardcoding — routes 파일 내부에서 '/api/'로 시작하는 경로 금지
 *   2. 이중 등록 — worker/index.ts 에서 동일 경로 app.route() 중복 감지
 *   3. 프론트-백엔드 불일치 — 프론트가 호출하는 경로가 백엔드에 등록됐는지 확인
 * ============================================================
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

// ── ANSI colors ───────────────────────────────────────────────────────────────
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

let totalErrors = 0;
let totalWarnings = 0;

function error(msg: string) { console.error(`${RED}✖ ERROR${RESET} ${msg}`); totalErrors++; }
function warn(msg: string)  { console.warn (`${YELLOW}⚠ WARN${RESET}  ${msg}`); totalWarnings++; }
function ok(msg: string)    { console.log  (`${GREEN}✔ OK${RESET}    ${msg}`); }
function info(msg: string)  { console.log  (`${CYAN}ℹ${RESET}       ${msg}`); }

// ── Helper: recursively read files ────────────────────────────────────────────
function readFilesRecursively(dir: string, ext: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', 'dist', '.git', '.wrangler'].includes(entry.name)) {
      results.push(...readFilesRecursively(full, ext));
    } else if (entry.isFile() && ext.some(e => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 1: Fullpath Hardcoding in routes files
// ─────────────────────────────────────────────────────────────────────────────
function checkFullpathHardcoding() {
  console.log(`\n${BOLD}[Check 1] Fullpath Hardcoding in routes files${RESET}`);

  const routeFiles = [
    ...readFilesRecursively(path.join(ROOT, 'src/features'), ['.ts']).filter(f => f.includes('/api/')),
    ...readFilesRecursively(path.join(ROOT, 'src/worker/routes'), ['.ts']),
  ];

  // push.routes.ts 는 의도적으로 fullpath 사용 (app.route('/', pushRoutes) 방식)
  const ALLOWLIST = ['push.routes.ts'];

  let found = false;
  for (const file of routeFiles) {
    const basename = path.basename(file);
    if (ALLOWLIST.some(a => basename.endsWith(a))) continue;

    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, i) => {
      // HTTP 메서드 호출에서 '/api/'로 시작하는 문자열 리터럴 감지
      const match = line.match(/\.(get|post|put|patch|delete|all)\s*\(\s*['"`](\/api\/[^'"`]*)/i);
      if (match) {
        error(`Fullpath in route handler: ${path.relative(ROOT, file)}:${i+1}`);
        info(`  Found: ${match[0].slice(0, 80)}`);
        info(`  Fix: 상대경로로 변경하세요. '/api/xxx/yyy' → '/yyy'`);
        found = true;
      }
    });
  }
  if (!found) ok('No fullpath hardcoding detected');
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 2: Duplicate route registrations in worker/index.ts
// ─────────────────────────────────────────────────────────────────────────────
function checkDuplicateRoutes() {
  console.log(`\n${BOLD}[Check 2] Duplicate app.route() registrations${RESET}`);

  const indexTs = path.join(ROOT, 'src/worker/index.ts');
  if (!fs.existsSync(indexTs)) {
    warn('src/worker/index.ts not found');
    return;
  }

  const content = fs.readFileSync(indexTs, 'utf-8');
  const routeMatches = [...content.matchAll(/app\.route\s*\(\s*['"`]([^'"`]+)['"`]/g)];
  const prefixCounts: Record<string, number> = {};

  for (const match of routeMatches) {
    const prefix = match[1];
    prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
  }

  // 허용된 이중 등록 목록 (의도적 중복: 첫 번째가 먼저 처리됨을 알고 있는 경우)
  const ALLOWED_DUPLICATES = new Set([
    '/api/orders',   // ordersRouter(인증+재고) + featureOrdersRoutes(확장쿼리)
    '/api/payments', // paymentsRouter(confirm+checkout) + featurePaymentRoutes(rollback)
    '/api/seller',   // sellerAuthRoutes + sellerManagementRoutes + sellerOrdersRoutes + sellerStreamsRoutes
    '/api/admin',    // adminAuthRoutes + adminManagementRoutes
    '/api/auth/kakao', // kakaoRoutes 두 번 (path alias)
    '/api/products', // featureProductsRoutes + /api/search alias 모두 동일 라우터
  ]);

  let found = false;
  for (const [prefix, count] of Object.entries(prefixCounts)) {
    if (count > 1 && !ALLOWED_DUPLICATES.has(prefix)) {
      error(`Unexpected duplicate registration: app.route('${prefix}', ...) appears ${count} times`);
      info(`  Fix: 동일 prefix에 라우터를 하나만 등록하거나, ALLOWED_DUPLICATES에 추가하세요`);
      found = true;
    } else if (count > 1 && ALLOWED_DUPLICATES.has(prefix)) {
      info(`Allowed duplicate: '${prefix}' × ${count} (documented intent)`);
    }
  }
  if (!found) ok('No unexpected duplicate registrations');
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 3: Frontend-Backend path mismatch
// ─────────────────────────────────────────────────────────────────────────────
function checkFrontendBackendMismatch() {
  console.log(`\n${BOLD}[Check 3] Frontend ↔ Backend path mismatch${RESET}`);

  // 백엔드 등록 prefix 수집
  const indexTs = path.join(ROOT, 'src/worker/index.ts');
  const content = fs.readFileSync(indexTs, 'utf-8');
  const backendPrefixes: string[] = [...content.matchAll(/app\.route\s*\(\s*['"`]([^'"`]+)['"`]/g)]
    .map(m => m[1])
    .filter(p => p.startsWith('/api'));

  // 프론트엔드 API 호출 경로 수집
  const frontendFiles = [
    ...readFilesRecursively(path.join(ROOT, 'src/pages'), ['.ts', '.tsx']),
    ...readFilesRecursively(path.join(ROOT, 'src/components'), ['.ts', '.tsx']),
    ...readFilesRecursively(path.join(ROOT, 'src/hooks'), ['.ts', '.tsx']),
    ...readFilesRecursively(path.join(ROOT, 'src/shared/stores'), ['.ts', '.tsx']),
    ...readFilesRecursively(path.join(ROOT, 'src/features'), ['.ts', '.tsx'])
      .filter(f => !f.includes('/api/')), // feature 의 route 파일 제외, 프론트 코드만
  ];

  // 의도적으로 백엔드 없는 경로 (P3 구현 예정 또는 외부 서비스)
  const KNOWN_MISSING = new Set([
    '/api/debug/kv-usage',  // 개발 전용 디버그 엔드포인트
  ]);

  const calledPaths = new Set<string>();
  const pathCallSites: Record<string, string[]> = {};

  for (const file of frontendFiles) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, i) => {
      const matches = line.matchAll(/['"`](\/api\/[a-zA-Z0-9_\-/]+)/g);
      for (const match of matches) {
        const apiPath = match[1].replace(/\/\$\{[^}]+\}/g, '/:param'); // 템플릿 변수 정규화
        calledPaths.add(apiPath);
        if (!pathCallSites[apiPath]) pathCallSites[apiPath] = [];
        pathCallSites[apiPath].push(`${path.relative(ROOT, file)}:${i+1}`);
      }
    });
  }

  let found = false;
  for (const calledPath of [...calledPaths].sort()) {
    if (KNOWN_MISSING.has(calledPath)) {
      info(`Known missing (intentional): ${calledPath}`);
      continue;
    }

    // 백엔드에 해당 prefix가 등록됐는지 확인
    const covered = backendPrefixes.some(prefix => calledPath.startsWith(prefix));
    if (!covered) {
      warn(`Frontend calls '${calledPath}' but no matching backend prefix`);
      const sites = pathCallSites[calledPath];
      if (sites && sites.length <= 3) {
        sites.forEach(s => info(`  Called at: ${s}`));
      }
      found = true;
    }
  }
  if (!found) ok('All frontend paths have matching backend prefixes');
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 4: index.js legacy file
// ─────────────────────────────────────────────────────────────────────────────
function checkLegacyIndexJs() {
  console.log(`\n${BOLD}[Check 4] Legacy index.js file${RESET}`);
  const legacyFiles = [
    path.join(ROOT, 'src/worker/index.js'),
    ...readFilesRecursively(path.join(ROOT, 'src/worker/routes'), ['.js']),
    ...readFilesRecursively(path.join(ROOT, 'src/features'), ['.js'])
      .filter(f => f.includes('/api/')),
  ];

  let found = false;
  for (const f of legacyFiles) {
    warn(`Legacy .js file exists (should be .ts only): ${path.relative(ROOT, f)}`);
    found = true;
  }
  if (!found) ok('No legacy .js route files');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${BOLD}${CYAN}
╔══════════════════════════════════════════════╗
║   ur-live Route Validation Script v1.0       ║
║   3-layer safety net for API consistency     ║
╚══════════════════════════════════════════════╝${RESET}`);

checkFullpathHardcoding();
checkDuplicateRoutes();
checkFrontendBackendMismatch();
checkLegacyIndexJs();

console.log(`\n${BOLD}── Summary ──────────────────────────────────────${RESET}`);
if (totalErrors > 0) {
  console.log(`${RED}${BOLD}✖ ${totalErrors} error(s) found — fix before deploying${RESET}`);
} else {
  console.log(`${GREEN}${BOLD}✔ No errors${RESET}`);
}
if (totalWarnings > 0) {
  console.log(`${YELLOW}⚠ ${totalWarnings} warning(s) — review recommended${RESET}`);
}

process.exit(totalErrors > 0 ? 1 : 0);
