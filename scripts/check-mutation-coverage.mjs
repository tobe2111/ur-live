#!/usr/bin/env node
/**
 * 🛡️ 2026-05-19: POST/PATCH/PUT/DELETE 핸들러의 권한·rate-limit·IDOR 커버리지 검사.
 *
 * 배경:
 *   - 변경성 엔드포인트는 (1) 인증, (2) rate limit, (3) ownership 체크 필요.
 *   - 누락 시: brute-force, abuse, IDOR 데이터 유출 위험.
 *   - 기존 `check-api-auth.sh` 는 worker/ 만 검사 → src/features/*\/api/ 빠짐.
 *
 * 검사 대상:
 *   - src/features/*\/api/*.routes.ts
 *   - src/worker/routes/*.ts
 *
 * 검사 항목:
 *   1. POST/PATCH/PUT/DELETE 핸들러에 인증 미들웨어 (requireAuth/requireSeller/requireAdmin/requireAgency
 *      또는 파일 단위 app.use('*', requireXXX)) 가 있는가?
 *   2. 민감 endpoint (login/signup/password/refund/2fa/transfer/withdraw/payout/donation/cron/refresh)
 *      에 rateLimit() 호출이 있는가?
 *   3. 핸들러가 :id 파라미터 + body 의 user_id/seller_id 만 신뢰하는데
 *      DB 의 ownership 검증 ('WHERE seller_id =' / 'WHERE user_id =' / 'WHERE agency_id =')
 *      이 없으면 IDOR 의심으로 표시.
 *
 * 출력: warn-only by default. -s/--strict → CI 차단.
 *
 * 면제 (intentional public mutation):
 *   - webhook / callback / public / signup / register / kakao / oauth / health
 *   - DEV mode debug routes (DEV 가드 명시)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

const SEARCH_DIRS = [
  path.join(ROOT, 'src/features'),
  path.join(ROOT, 'src/worker/routes'),
]

const EXEMPT_FILE_PATTERNS = [
  /\.test\./,
  /webhook/i,
  /callback/i,
  /\/auth\/api\/kakao/i,
  /oauth/i,
]

// 🛡️ 2026-05-19: 마운트 위치별 auth 가드 — worker/index.ts 의 app.use('*', requireXxx)
//   가 적용되는 라우터 파일들. 파일 자체에 requireXxx 가 없어도 안전.
//   변경 시 worker/index.ts 도 함께 점검할 것.
const MOUNT_PROTECTED_PATHS = [
  /^src\/features\/admin\/api\//,           // adminApp.use('*', requireAdmin())
  /^src\/features\/agency\/api\//,          // 각 파일이 자체 app.use('*', requireAgency) 보유
  /^src\/features\/seller\/api\//,          // 대부분 Bearer 토큰 자체 검증
  /^src\/features\/community-group-buy\//,  // requireAuth() 자체 적용
  /^src\/worker\/routes\/admin-/,           // adminApp 내부
]

const SENSITIVE_ACTIONS = [
  'login', 'signup', 'register',
  'password', 'reset-password', 'forgot-password',
  'refund', '2fa', 'totp',
  'transfer', 'withdraw', 'payout', 'donation', 'donate',
  'cron', 'refresh', 'change-password',
  'invite', 'execute', 'batch-complete',
]

const AUTH_KEYWORDS = /requireAuth|requireSeller|requireAdmin|requireAgency|requireUser|requireAdminRole|requireRole|authMiddleware|verifyToken|verifyAdminAuth|getSellerIdFromToken|getCurrentUser|getSellerId\(|verify\(.*JWT_SECRET|parseSessionCookie/

const OWNERSHIP_HINTS = [
  /WHERE\s+(seller_id|user_id|agency_id|owner_id|created_by)\s*=\s*\?/i,
  /AND\s+(seller_id|user_id|agency_id|owner_id|created_by)\s*=\s*\?/i,
  /seller_id\s*===?\s*\w+\.(seller_id|id)/,
  /user_id\s*===?\s*\w+\.(user_id|id)/,
  /agency_id\s*===?\s*\w+\.(agency_id|id)/,
  /\.id\s*===?\s*Number\(\w+\.id\)/,
  /agencyId.*ownership|ownership.*check/i,
  // 🛡️ 2026-05-19: 추가 패턴 — admin-only, dbHelper.findOne, type !== 'admin' 등.
  /user\.type\s*!==?\s*['"]admin['"]/,
  /findOne\(['"]\w+['"]\s*,\s*\{[^}]*user_id/,
  /findOne\(['"]\w+['"]\s*,\s*\{[^}]*seller_id/,
  /findOne\(['"]\w+['"]\s*,\s*\{[^}]*agency_id/,
  /requireAdminRole/,
  /isAdmin\s*\(/,
]

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) walk(p, out)
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(p)
  }
  return out
}

const files = []
for (const d of SEARCH_DIRS) walk(d, files)

const issues = {
  noAuth: [],
  noRateLimit: [],
  idorSuspect: [],
}

const MUTATION_RE = /\.(post|patch|put|delete|on\(\s*\[?\s*['"`](POST|PATCH|PUT|DELETE))\s*\(\s*['"`]([^'"`]+)['"`]/gi

for (const file of files) {
  const rel = path.relative(ROOT, file)
  if (EXEMPT_FILE_PATTERNS.some((re) => re.test(rel))) continue
  if (!rel.includes('routes')) continue

  const src = fs.readFileSync(file, 'utf8')

  const fileHasAuth = AUTH_KEYWORDS.test(src)
  const fileMountProtected = MOUNT_PROTECTED_PATHS.some((re) => re.test(rel))
  const fileGlobalAuth = fileMountProtected || /app\.use\(\s*['"`]\*['"`]\s*,\s*require(Auth|Seller|Admin|Agency|User|AdminRole)/.test(src)
  const fileHasOwnership = OWNERSHIP_HINTS.some((re) => re.test(src))

  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/\.(post|patch|put|delete)\s*\(\s*['"`]([^'"`]+)['"`]/i)
    if (!m) continue
    const method = m[1].toUpperCase()
    const route = m[2]

    // Look at the handler block (this line + the chained middleware tokens up to `async`)
    let block = line
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      block += '\n' + lines[j]
      if (/async\s*\(/.test(lines[j])) break
    }

    const hasAuthOnLine = AUTH_KEYWORDS.test(block)
    const hasRateLimit = /rateLimit\s*\(/.test(block)

    // 1. Auth check — needs file-level auth or per-route auth
    if (!fileGlobalAuth && !hasAuthOnLine && !route.match(/^\/?(webhook|callback|public|health|login|signup|register|forgot-password|reset-password|kakao|naver|google|verify|otp|toss|internal|version)\b/i)) {
      issues.noAuth.push({ file: rel, line: i + 1, method, route })
    }

    // 2. Rate limit on sensitive actions
    const isSensitive = SENSITIVE_ACTIONS.some((kw) => route.toLowerCase().includes(kw) || rel.toLowerCase().includes(kw))
    if (isSensitive && !hasRateLimit) {
      issues.noRateLimit.push({ file: rel, line: i + 1, method, route })
    }

    // 3. IDOR suspect — route has :id param but no ownership check anywhere in file
    if (route.includes(':id') && !fileHasOwnership && !fileGlobalAuth && method !== 'GET') {
      // skip admin files (already require admin role)
      if (!/admin/i.test(rel)) {
        issues.idorSuspect.push({ file: rel, line: i + 1, method, route })
      }
    }
  }
}

const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const NC = '\x1b[0m'

let total = 0
function report(title, list, color = YELLOW) {
  if (list.length === 0) return
  total += list.length
  console.log(`\n${color}${title}: ${list.length}${NC}`)
  for (const i of list.slice(0, 30)) {
    console.log(`  ${i.file}:${i.line} — ${i.method} ${i.route}`)
  }
  if (list.length > 30) console.log(`  ... and ${list.length - 30} more`)
}

console.log('🔍 Mutation endpoint coverage check')
console.log(`   Scanned ${files.length} files in ${SEARCH_DIRS.map((d) => path.relative(ROOT, d)).join(', ')}`)

report('❌ Missing auth middleware', issues.noAuth, RED)
report('⚠️  Sensitive endpoint without rateLimit()', issues.noRateLimit, YELLOW)
report('⚠️  IDOR suspect (:id mutation, no ownership check in file)', issues.idorSuspect, YELLOW)

console.log('')
if (total === 0) {
  console.log(`${GREEN}✅ All mutation endpoints look covered${NC}`)
  process.exit(0)
}

if (STRICT && issues.noAuth.length > 0) {
  console.log(`${RED}STRICT mode: failing due to ${issues.noAuth.length} missing-auth findings${NC}`)
  process.exit(1)
}

console.log(`${YELLOW}⚠️  ${total} findings — review and fix${NC}`)
process.exit(0)
