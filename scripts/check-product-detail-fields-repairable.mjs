#!/usr/bin/env node
/**
 * 🛡️ 2026-06-10 (상품 상세 500 전수조사 — 영구 수렴 보장):
 *   PRODUCT_DETAIL_FIELDS(소비자 상세/목록 명시 컬럼 목록)의 모든 컬럼이
 *   프로덕션에서 "복구 가능"해야 한다 — 즉 아래 둘 중 하나여야 함:
 *     (a) 베이스 CREATE TABLE products (migrations/0001 — 프로덕션이 확실히 보유)
 *     (b) repair-schema 의 `ALTER TABLE products ADD COLUMN ...` 등록분
 *   둘 다 아니면: 프로덕션 D1 은 마이그레이션 CI 가 없으므로(TD-001) 그 컬럼은 영원히
 *   없을 수 있고 → 'no such column' → 상세 500 (자가치유 prune 이 막아주지만 데이터 결손).
 *
 * CI: verify.yml strict. 위반 시 → repair-schema.routes.ts 에 ADD COLUMN 등록할 것.
 */
import { readFileSync } from 'node:fs'

const colsSrc = readFileSync('src/shared/db/product-columns.ts', 'utf8')
const arrMatch = colsSrc.match(/PRODUCT_DETAIL_FIELDS\s*=\s*\[([\s\S]*?)\]\s*as const/)
if (!arrMatch) { console.error('❌ PRODUCT_DETAIL_FIELDS 파싱 실패'); process.exit(1) }
const fields = [...arrMatch[1].matchAll(/'([A-Za-z_0-9]+)'/g)].map(m => m[1])

// (a) 베이스 스키마 (0001)
const baseSql = readFileSync('migrations/0001_initial_schema.sql', 'utf8')
const tableMatch = baseSql.match(/CREATE TABLE IF NOT EXISTS products\s*\(([\s\S]*?)\n\);/)
const baseCols = new Set(
  (tableMatch ? tableMatch[1] : '').split('\n')
    .map(l => l.trim().match(/^([A-Za-z_0-9]+)\s+(?:INTEGER|TEXT|REAL|BOOLEAN|DATETIME|BLOB|NUMERIC)/i))
    .filter(Boolean).map(m => m[1]),
)

// (b) repair-schema 등록분
const repairSrc = readFileSync('src/worker/routes/repair-schema.routes.ts', 'utf8')
const repairCols = new Set(
  [...repairSrc.matchAll(/ALTER TABLE products ADD COLUMN ([A-Za-z_0-9]+)/g)].map(m => m[1]),
)

const missing = fields.filter(f => !baseCols.has(f) && !repairCols.has(f))
if (missing.length > 0) {
  console.error('❌ PRODUCT_DETAIL_FIELDS 중 프로덕션 복구 불가 컬럼 (repair-schema 미등록):')
  for (const f of missing) console.error(`   - ${f}`)
  console.error('\n→ src/worker/routes/repair-schema.routes.ts 에 ALTER TABLE products ADD COLUMN 등록하세요.')
  console.error('   (등록 후 프로덕션 /admin/health 스키마 복구 1회로 수렴)')
  process.exit(1)
}
console.log(`✅ PRODUCT_DETAIL_FIELDS ${fields.length}개 전부 복구 가능 (base ${baseCols.size} + repair ${repairCols.size})`)
