#!/usr/bin/env node
/**
 * 🛡️ 2026-05-19: border-gray-50/100/200 → 자동으로 `dark:border-[#1A1A1A]` 추가.
 *
 * 사용:
 *   node scripts/dark-border-migrate.mjs        # dry-run (변경 미리보기)
 *   node scripts/dark-border-migrate.mjs --write # 실제 수정
 *
 * 동작:
 *   className 문자열 안에서 `border-gray-50` / `border-gray-100` / `border-gray-200` 발견 시,
 *   그 className 안에 `dark:border-` 가 이미 있으면 skip,
 *   없으면 해당 토큰 바로 뒤에 ` dark:border-[#1A1A1A]` 삽입.
 *
 *   border-gray-50  → 가장 미세  → dark:border-[#1A1A1A]
 *   border-gray-100 → 일반       → dark:border-[#1A1A1A]
 *   border-gray-200 → 강조       → dark:border-[#2A2A2A]
 *
 * 제외:
 *   - 셀러/어드민/에이전시 대시보드 (화이트 고정 정책)
 *   - 이미 dark: border 매핑 있는 className
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')
const WRITE = process.argv.includes('--write')

const DASHBOARD_PATHS = [
  /\/pages\/Seller/, /\/pages\/Admin/, /\/pages\/Agency/,
  /\/components\/Seller/, /\/components\/Admin/, /\/components\/Agency/,
  /\/features\/admin\//, /\/features\/agency\//,
  /\/components\/seller\//, /\/components\/agency\//,
  /\/components\/DashboardNotificationBell/,
]

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

let touched = 0
let inserts = 0

const SHADE_MAP = { '50': '#1A1A1A', '100': '#1A1A1A', '200': '#2A2A2A' }

// className="..."  /  className={`...`} 두 형태 처리
const CLASS_ATTR_RE = /className=(?:\{?["'`])([^"'`]+)(?:["'`]\}?)/g

for (const file of files) {
  const rel = path.relative(ROOT, file)
  if (DASHBOARD_PATHS.some((re) => re.test(rel))) continue

  const src = fs.readFileSync(file, 'utf8')
  let modified = src
  let fileInserts = 0

  modified = modified.replace(CLASS_ATTR_RE, (full, classStr) => {
    // 이미 dark:border 있으면 skip
    if (/dark:border-/.test(classStr)) return full
    // light border 가 있나?
    const m = classStr.match(/\bborder-gray-(50|100|200)\b/)
    if (!m) return full
    const shade = m[1]
    const darkColor = SHADE_MAP[shade]
    // 해당 토큰 바로 뒤에 dark variant 삽입
    const newClassStr = classStr.replace(
      new RegExp(`\\bborder-gray-${shade}\\b`),
      `border-gray-${shade} dark:border-[${darkColor}]`,
    )
    fileInserts++
    return full.replace(classStr, newClassStr)
  })

  if (fileInserts > 0) {
    if (WRITE) fs.writeFileSync(file, modified, 'utf8')
    console.log(`  ${rel}: +${fileInserts} dark border${fileInserts > 1 ? 's' : ''}`)
    touched++
    inserts += fileInserts
  }
}

console.log('')
console.log(`총 ${touched} 파일 / ${inserts} 보더 추가`)
if (!WRITE) console.log('(dry-run — 실제 적용은 --write 플래그)')
