#!/usr/bin/env node
/**
 * 🛡️ 2026-05-17: NOT NULL 컬럼 미포함 INSERT 자동 탐지.
 *
 * 배경: 'NOT NULL constraint failed: <table>.<col>' D1 SqlError → 500.
 *   특히 신규 라우트 추가 시 DEFAULT 없는 NOT NULL 컬럼을 빠뜨려 발견됨.
 *
 * 동작:
 * 1. migrations/*.sql 파싱 → { table: { column: { notNull, hasDefault } } } 인덱스.
 *    - CREATE TABLE 컬럼 정의 + ALTER TABLE ADD COLUMN 둘 다 추적.
 *    - DROP COLUMN → 인덱스에서 제거.
 *    - DEFAULT 표현은 NULL 도 hasDefault=true 로 처리 (SQLite 가 NULL 도 명시 DEFAULT 로 인식).
 *
 * 2. src/**\/*.ts 스캔 → INSERT INTO <table> (<cols>) VALUES (...) 추출.
 *    - 컬럼 목록 추출 (괄호 안 식별자).
 *    - VALUES 절은 무시 (placeholder/값 검증은 별도 가드).
 *    - INSERT...SELECT 는 동적 → skip.
 *    - ON CONFLICT/UPSERT 절은 INSERT 컬럼 분석에 영향 없으므로 무시.
 *
 * 3. NOT NULL AND !hasDefault 컬럼이 INSERT 목록에 없으면 보고.
 *
 * 한계:
 * - 컬럼 목록 없이 'INSERT INTO foo VALUES (...)' 는 분석 불가 (모든 컬럼 필요) → skip.
 * - ${columnList} 같은 동적 컬럼은 skip.
 * - CHECK / FOREIGN KEY 등 다른 제약은 별도 체커 (check-status-constraints.mjs).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

/** @type {Map<string, Map<string, { notNull: boolean, hasDefault: boolean, type: string }>>} */
const schema = new Map()

function setCol(table, col, info) {
  const t = table.toLowerCase()
  const c = col.toLowerCase()
  if (!schema.has(t)) schema.set(t, new Map())
  schema.get(t).set(c, info)
}

function dropCol(table, col) {
  const t = table.toLowerCase()
  const c = col.toLowerCase()
  schema.get(t)?.delete(c)
}

/**
 * 컬럼 정의 라인에서 NOT NULL / DEFAULT 추출.
 * 예: "user_id INTEGER NOT NULL DEFAULT 0" → { notNull: true, hasDefault: true }
 */
function parseColumnDef(line) {
  // PRIMARY KEY AUTOINCREMENT 는 자동으로 NULL 허용 + 자동 생성 → hasDefault=true 취급
  const isPk = /PRIMARY\s+KEY/i.test(line) && /AUTOINCREMENT|INTEGER\s+PRIMARY\s+KEY/i.test(line)
  const notNull = /\bNOT\s+NULL\b/i.test(line)
  const hasDefault = /\bDEFAULT\s+/i.test(line) || isPk
  // 컬럼명 / 타입 추출 (선택적)
  const m = line.match(/^\s*[`"]?(\w+)[`"]?\s+(\w+)/)
  const col = m?.[1]
  const type = m?.[2] || 'TEXT'
  return { col, notNull, hasDefault, type }
}

function parseMigrations() {
  const migDir = path.join(ROOT, 'migrations')
  if (!fs.existsSync(migDir)) return
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migDir, f), 'utf8')

    // 🛡️ SQL `-- comment` 제거 — 'admin\n  endpoint' 가 단일 컬럼 정의로 잘못 해석되는 사고 방지.
    //   참고: 마이그레이션의 'user_type TEXT NOT NULL,              -- user, seller, admin' 같은 패턴.
    const stripComments = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

    // CREATE TABLE
    //   🛡️ IF NOT EXISTS 는 D1 에서 이미 존재 시 no-op → 후속 migration 의 같은 CREATE 가
    //     기존 스키마를 덮어쓰지 못함. 본 parser 도 동일 시맨틱 적용 (첫 정의만 유효).
    //   IF NOT EXISTS 없는 CREATE 는 실제로는 ALTER 동작이거나 정상 (예: 0001 등 초기).
    const createRegex = /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(([\s\S]*?)\);/gi
    let m
    while ((m = createRegex.exec(sql))) {
      const hasIfNotExists = !!m[1]
      const table = m[2]
      if (hasIfNotExists && schema.has(table.toLowerCase())) continue  // 이미 존재 → skip
      const body = stripComments(m[3])
      const lines = body.split(/,(?![^()]*\))/g)
      for (const line of lines) {
        const trimmed = line.trim()
        // table-level constraint (PRIMARY KEY, FOREIGN KEY, UNIQUE 등) skip
        if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(trimmed)) continue
        const { col, notNull, hasDefault, type } = parseColumnDef(trimmed)
        if (!col) continue
        setCol(table, col, { notNull, hasDefault, type })
      }
    }

    // ALTER TABLE ADD COLUMN
    const alterAddRegex = /ALTER\s+TABLE\s+[`"]?(\w+)[`"]?\s+ADD\s+COLUMN\s+([^;]+);/gi
    while ((m = alterAddRegex.exec(sql))) {
      const table = m[1]
      const def = stripComments(m[2])
      const { col, notNull, hasDefault, type } = parseColumnDef(def)
      if (!col) continue
      // ADD COLUMN with NOT NULL but no DEFAULT — SQLite refuses on tables with rows.
      //   이런 케이스가 있어도 일단 schema 에는 반영하되, 코드 검사 시 누락 보고.
      setCol(table, col, { notNull, hasDefault, type })
    }

    // ALTER TABLE DROP COLUMN
    const dropRegex = /ALTER\s+TABLE\s+[`"]?(\w+)[`"]?\s+DROP\s+COLUMN\s+[`"]?(\w+)[`"]?\s*;/gi
    while ((m = dropRegex.exec(sql))) {
      dropCol(m[1], m[2])
    }
  }
}

// ─────────────────────────────────────────────
// 소스 스캔
// ─────────────────────────────────────────────
const violations = []
const stats = { inserted: 0, withCols: 0, analyzed: 0, dynamicSkip: 0, noColListSkip: 0 }

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8')

  // INSERT INTO <table> (<cols>) ...
  //   single-line / multi-line 모두 매치.
  //   대소문자 무관.
  //   <cols> 안에 ${...} 보간 있으면 dynamic 으로 skip.
  const insertRegex = /INSERT\s+(?:OR\s+(?:IGNORE|REPLACE|ABORT|FAIL|ROLLBACK)\s+)?INTO\s+[`"]?(\w+)[`"]?(\s*\([^)]*\))?/gi
  let m
  while ((m = insertRegex.exec(src))) {
    stats.inserted++
    const table = m[1].toLowerCase()
    const colParen = m[2]
    const colMap = schema.get(table)
    if (!colMap) continue

    if (!colParen) {
      stats.noColListSkip++
      // 컬럼 목록 없이 INSERT INTO foo VALUES — 모든 컬럼 명시 필요한데
      //   D1 코드에서 흔치 않으므로 그냥 skip (별도 가드)
      continue
    }
    stats.withCols++

    // 컬럼 목록 추출 — colParen 은 ' (col1, col2)' 형태 (leading whitespace 가능).
    const inner = colParen.trim().slice(1, -1)
    if (inner.includes('${')) {
      stats.dynamicSkip++
      continue
    }
    const cols = inner.split(',').map((c) => c.trim().replace(/^[`"]?|[`"]?$/g, '').toLowerCase()).filter(Boolean)
    if (cols.length === 0) {
      stats.dynamicSkip++
      continue
    }
    stats.analyzed++

    // NOT NULL && !hasDefault 컬럼 중 INSERT 에 없는 것 찾기
    const missing = []
    for (const [colName, info] of colMap) {
      if (info.notNull && !info.hasDefault && !cols.includes(colName)) {
        missing.push(colName)
      }
    }

    if (missing.length > 0) {
      const line = src.slice(0, m.index).split('\n').length
      violations.push({
        file: path.relative(ROOT, file),
        line,
        table,
        missing,
        insertedCols: cols,
      })
    }
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'tests', '__tests__'].includes(e.name)) continue
      walk(full)
    } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
      try {
        scanFile(full)
      } catch (err) {
        console.warn(`[warn] parse failed: ${path.relative(ROOT, full)}: ${err.message}`)
      }
    }
  }
}

parseMigrations()
walk(path.join(ROOT, 'src'))

const summary = `inserts=${stats.inserted}, with-col-list=${stats.withCols}, analyzed=${stats.analyzed}, dynamic-skip=${stats.dynamicSkip}, no-col-list-skip=${stats.noColListSkip}`

if (violations.length === 0) {
  console.log(`✅ NOT NULL 컬럼 미포함 INSERT 없음.\n   ${summary}`)
  process.exit(0)
}

console.error('\n🚨 NOT NULL 컬럼 미포함 INSERT 발견:')
for (const v of violations) {
  console.error(
    `  ${v.file}:${v.line}\n` +
      `    INSERT INTO ${v.table} (${v.insertedCols.slice(0, 5).join(', ')}${v.insertedCols.length > 5 ? ', ...' : ''})\n` +
      `    누락 NOT NULL: ${v.missing.map((c) => `'${c}'`).join(', ')}`,
  )
}
console.error(
  `\n총 ${violations.length}건. 런타임 시 'NOT NULL constraint failed' SqlError → 500.\n` +
    `해결책: 누락 컬럼을 INSERT 에 포함 or 마이그레이션으로 DEFAULT 추가.\n`,
)

if (STRICT) process.exit(1)
console.warn('⚠️  warn-only 모드. CI 차단은 -s.')
process.exit(0)
