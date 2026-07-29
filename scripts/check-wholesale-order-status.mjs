#!/usr/bin/env node
/**
 * 🛡️ 2026-06-27: 도매주문(wholesale_orders) 상태 무결성 가드.
 *
 * 배경 (대표 — B2B 플로우 상태머신): wholesale_orders.status 는 free-form TEXT(CHECK 제약 없음)라
 *   오타/정의 밖 상태가 조용히 써질 수 있다(고아 상태). canonical 상태 집합(wholesale-order-status.ts
 *   WHOLESALE_ORDER_STATUSES) 밖의 값을 `wholesale_orders SET status='X'` 로 쓰면 위반.
 *
 * 룰: `UPDATE wholesale_orders SET ... status = 'X'` 또는 transitionWholesaleOrder(..., 'X', ...) 의
 *   X 가 canonical 집합에 있어야 한다.
 *
 * 자동 제외: 줄에 `wholesale-status-ok` 주석.
 * 동작: 기본 warn-only. 차단: `-s` 또는 STRICT_WHS_STATUS=1 (exit 1).
 */
import fs from 'fs'
import path from 'path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_WHS_STATUS === '1'
const ROOT = process.cwd()

// SSOT: wholesale-order-status.ts 의 WHOLESALE_ORDER_STATUSES 와 일치해야 함.
const CANONICAL = new Set([
  'PENDING', 'PAID', 'ACCEPTED', 'SHIPPED', 'DONE',
  'REJECTED', 'CANCELLED', 'PARTIAL_REFUNDED', 'REFUNDED', 'FAILED', 'EXPIRED', 'ON_CREDIT',
])

const TARGET_DIR = path.join(ROOT, 'src', 'features', 'supply', 'api')
const EXTRA_FILES = [path.join(ROOT, 'src', 'worker', 'routes', 'repair-schema.routes.ts')]

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (name.endsWith('.ts')) out.push(full)
  }
  return out
}

const files = [...walk(TARGET_DIR), ...EXTRA_FILES.filter(f => fs.existsSync(f))]

// `wholesale_orders SET ... status = 'X'` (UPDATE 문, 멀티라인 가능) 의 status 리터럴.
const SET_STATUS = /wholesale_orders\s+SET\b[\s\S]{0,200}?status\s*=\s*'([A-Z_]+)'/g
// transitionWholesaleOrder(DB, id, 'X', ...) 의 to 리터럴.
const TRANSITION = /transitionWholesaleOrder\s*\([^,]+,[^,]+,\s*'([A-Z_]+)'/g

const violations = []
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8')
  const lines = code.split('\n')
  for (const re of [SET_STATUS, TRANSITION]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(code)) !== null) {
      const status = m[1]
      if (CANONICAL.has(status)) continue
      const lineNo = code.slice(0, m.index).split('\n').length
      if (/wholesale-status-ok/.test(lines[lineNo - 1] || '')) continue
      const rel = path.relative(ROOT, file).split(path.sep).join('/')
      violations.push(`${rel}:${lineNo} — 정의 밖 도매주문 상태 '${status}' (canonical 아님)`)
    }
  }
}

if (violations.length === 0) {
  console.log('✅ 도매주문 상태 — wholesale_orders.status write 전부 canonical 집합 내(고아/오타 0).')
  process.exit(0)
}

console.error(`${STRICT ? '❌' : '⚠️'} 정의 밖 도매주문 상태 ${violations.length}건:`)
for (const v of violations) console.error('   ' + v)
console.error('\n   수정: wholesale-order-status.ts WHOLESALE_ORDER_STATUSES 의 상태만 사용(전이는 transitionWholesaleOrder).')
console.error('   예외: 줄에 `wholesale-status-ok` 주석.')
process.exit(STRICT ? 1 : 0)
