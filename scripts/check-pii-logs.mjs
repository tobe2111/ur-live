#!/usr/bin/env node
/**
 * 🛡️ 2026-05-19: PII (개인정보) 로그 노출 검사.
 *
 * 한국 개인정보보호법: 이메일/전화/주소/RRN/카드번호 production 로그 노출 금지.
 *
 * 검사:
 *   1. console.log/warn/error 가 `.email` `.phone` `params.to` 등 PII 식별자
 *      필드를 직접 (마스킹 없이) 출력하는지
 *   2. 그게 production 로그인지 (DEV 게이트 / NODE_ENV 체크 없음)
 *
 * 안전 패턴:
 *   if (import.meta.env.DEV) console.log(..., maskEmail(x))
 *   maskPhone(phone) 사용
 *   process.env.NODE_ENV !== 'production' 게이트 + 마스킹
 *
 * 위험 패턴:
 *   console.log('user:', body.email)          ← 게이트 없음
 *   console.warn('phone:', user.phone)         ← 마스킹 없음
 *   console.log(JSON.stringify(body))          ← 전체 dump
 *
 * 사용:
 *   node scripts/check-pii-logs.mjs       # warn-only
 *   node scripts/check-pii-logs.mjs -s    # strict (CI 차단)
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
  path.join(ROOT, 'src/worker'),
  path.join(ROOT, 'src/lib'),
  path.join(ROOT, 'src/services'),
]

// 위험 식별자 — log 호출에 등장하면 의심
const PII_FIELDS = [
  'email', 'mail',
  'phone', 'mobile', 'tel',
  'address', 'addr',
  'ssn', 'rrn', 'jumin',
  'birthday', 'birth',
  'card_number', 'cardNumber',
  'access_token', 'accessToken',
  'refresh_token', 'refreshToken',
  'password', 'pwd',
  'otp', 'code_verifier',
  'recipient_name', 'recipientName',
  'bank_account', 'account_holder',
]

// 마스킹 helper 패턴 — 같은 줄 또는 같은 logger call 안에 있으면 SAFE
const MASK_PATTERNS = [
  /maskEmail/, /maskPhone/, /maskName/, /maskAccount/,
  /\.replace\([^)]*\$1\*+/,   // inline regex mask like "$1****$2"
  /\.slice\(0,\s*\d+\)\s*\+\s*['"]\*+/,
  /redact\(/i,
]

// DEV 게이트 — 같은 if 안에 있으면 SAFE
const DEV_GATE_PATTERNS = [
  /import\.meta\.env\.DEV/,
  /import\.meta\.env\?\.DEV/,
  /NODE_ENV\s*[!=]==\s*['"]production['"]/,
  /NODE_ENV\s*===\s*['"]development['"]/,
  /env\.DEV\b/,
]

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walk(p, out)
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      out.push(p)
    }
  }
  return out
}

const files = []
for (const d of SEARCH_DIRS) walk(d, files)

const issues = []

for (const file of files) {
  if (file.includes('.test.') || file.includes('/tests/')) continue
  const rel = path.relative(ROOT, file)
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/console\.(log|warn|error|info)\s*\(/)
    if (!m) continue

    // 같은 줄에 PII 키워드 있는지
    const piiHit = PII_FIELDS.find((f) => new RegExp(`\\b${f}\\b`).test(line))
    if (!piiHit) continue

    // 같은 줄 또는 위 1줄에 mask helper 가 있으면 SAFE
    const ctx = (lines[i - 1] || '') + '\n' + line + '\n' + (lines[i + 1] || '')
    if (MASK_PATTERNS.some((re) => re.test(ctx))) continue

    // 같은 if 블록 안에 DEV 게이트 있는지 — 위 3줄 검색
    const above = (lines[i - 1] || '') + '\n' + (lines[i - 2] || '') + '\n' + (lines[i - 3] || '')
    const inDevBlock = DEV_GATE_PATTERNS.some((re) => re.test(above)) ||
                       DEV_GATE_PATTERNS.some((re) => re.test(line))

    issues.push({
      file: rel,
      line: i + 1,
      field: piiHit,
      severity: inDevBlock ? 'WARN' : 'CRITICAL',
      snippet: line.trim().slice(0, 120),
    })
  }
}

const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const NC = '\x1b[0m'

const critical = issues.filter((i) => i.severity === 'CRITICAL')
const warn = issues.filter((i) => i.severity === 'WARN')

console.log('🔍 PII log redaction check')
console.log(`   Scanned ${files.length} files`)

if (critical.length > 0) {
  console.log(`\n${RED}❌ CRITICAL: PII in production log: ${critical.length}${NC}`)
  for (const i of critical.slice(0, 30)) {
    console.log(`  ${i.file}:${i.line} — ${i.field}`)
    console.log(`    ${i.snippet}`)
  }
  if (critical.length > 30) console.log(`  ... and ${critical.length - 30} more`)
}

if (warn.length > 0) {
  console.log(`\n${YELLOW}⚠️  WARN: PII in DEV-only log (마스킹 권장): ${warn.length}${NC}`)
  for (const i of warn.slice(0, 10)) {
    console.log(`  ${i.file}:${i.line} — ${i.field}`)
  }
  if (warn.length > 10) console.log(`  ... and ${warn.length - 10} more`)
}

if (issues.length === 0) {
  console.log(`${GREEN}✅ PII 노출 없음${NC}`)
  process.exit(0)
}

if (STRICT && critical.length > 0) {
  console.log(`\n${RED}STRICT mode: failing due to ${critical.length} CRITICAL findings${NC}`)
  process.exit(1)
}

console.log(`\n${YELLOW}⚠️  Total: ${issues.length} (CRITICAL ${critical.length} / WARN ${warn.length})${NC}`)
process.exit(0)
