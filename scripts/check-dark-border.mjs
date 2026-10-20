#!/usr/bin/env node
/**
 * 🛡️ 2026-05-19: 다크 모드 보더 누락 검사.
 *
 * 배경: 사용자 신고 "장바구니 다크 모드에서 흰 선이 보임".
 *   `border-gray-50/100/200` 같은 라이트 모드 색이 다크 배경 위에 도드라짐.
 *   CLAUDE.md 테마 가이드: light 보더에는 반드시 `dark:border-[#1A1A1A]` 매핑.
 *
 * 검사 대상:
 *   user-facing pages/components — 셀러/어드민/에이전시 대시보드는 화이트 고정 (제외)
 *
 * 위험 패턴:
 *   <div className="border-b border-gray-50">      ← BAD (다크 override 없음)
 *   <div className="border border-gray-100">       ← BAD
 *
 * 안전 패턴:
 *   <div className="border-b border-gray-50 dark:border-[#1A1A1A]">  ← OK
 *
 * 사용:
 *   node scripts/check-dark-border.mjs        # warn-only
 *   node scripts/check-dark-border.mjs -s     # strict (CI 차단)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

// 화이트 고정 영역 (CLAUDE.md): dark: variant 금지 — 검사 제외.
const DASHBOARD_PATHS = [
  /\/pages\/Seller/, /\/pages\/Admin/, /\/pages\/Agency/,
  /\/components\/Seller/, /\/components\/Admin/, /\/components\/Agency/,
  /\/features\/admin\//, /\/features\/agency\//,
  /\/components\/seller\//, /\/components\/agency\//,
  /\/components\/DashboardNotificationBell/,
]

// 라이트 모드 보더 색 — dark: override 없으면 위험.
const LIGHT_BORDER_RE = /\bborder-gray-(50|100|200)\b/

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.wrangler') continue
      walk(p, out)
    } else if (name.endsWith('.tsx')) {
      out.push(p)
    }
  }
}

const files = []
walk(path.join(ROOT, 'src/pages'), files)
walk(path.join(ROOT, 'src/components'), files)

const issues = []

for (const file of files) {
  const rel = path.relative(ROOT, file)
  // 화이트 고정 영역 제외
  if (DASHBOARD_PATHS.some((re) => re.test(rel))) continue

  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // className 안의 light border 추출
    if (!LIGHT_BORDER_RE.test(line)) continue
    // 같은 라인 또는 인근 (multi-line className 대응) 에 dark:border 가 있으면 SAFE
    const ctx = line + (lines[i + 1] || '') + (lines[i + 2] || '') + (lines[i - 1] || '')
    if (/dark:border-/.test(ctx)) continue
    issues.push({
      file: rel,
      line: i + 1,
      snippet: line.trim().slice(0, 160),
    })
  }
}

const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const NC = '\x1b[0m'

console.log('🔍 Dark mode border check (user-facing pages)')
console.log(`   Scanned ${files.length} tsx files`)

if (issues.length === 0) {
  console.log(`${GREEN}✅ 다크 모드 보더 누락 없음${NC}`)
  process.exit(0)
}

console.log(`\n${YELLOW}⚠️  border-gray-50/100/200 without dark: override: ${issues.length}${NC}`)
console.log(`   다크 모드에서 흰 선처럼 보임. dark:border-[#1A1A1A] (또는 [#2A2A2A]) 매핑 필요.\n`)
for (const i of issues.slice(0, 40)) {
  console.log(`  ${i.file}:${i.line}`)
  console.log(`    ${i.snippet}`)
}
if (issues.length > 40) console.log(`  ... and ${issues.length - 40} more`)

if (STRICT) process.exit(1)
process.exit(0)
