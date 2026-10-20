#!/usr/bin/env node
/**
 * 🛡️ 2026-05-17: CHECK 제약 위반 자동 탐지.
 *
 * 배경: admin live-monitor delete 라우트가 'UPDATE live_streams SET status=\"deleted\"'
 * 실행 → live_streams.status 컬럼이 CHECK(IN 'scheduled','live','ended') 제약 보유
 * → SQL 런타임에러 → 500. 사용자가 직접 테스트하지 않으면 발견 어려움.
 *
 * 동작:
 * 1. migrations/*.sql 파싱 → { table: { column: Set<allowed_values> } } 인덱스 구축.
 *    'CHECK(<col> IN ('a','b','c'))' 패턴 추출.
 *    ALTER TABLE ADD COLUMN ... CHECK(...) 도 동일하게 처리.
 * 2. src/features/, src/worker/ 의 TS 파일 스캔.
 *    'UPDATE <table> SET <col> = '<value>'' 또는 'SET <col> = ?' (바인드) 추출.
 *    리터럴 값이 허용값 집합에 없으면 위반으로 보고.
 * 3. 위반 발견 시 stderr 출력 + exit 1 (STRICT 모드).
 *    warn 모드: exit 0 + 경고만 출력.
 *
 * 사용:
 *   node scripts/check-status-constraints.mjs       # warn-only (기본)
 *   node scripts/check-status-constraints.mjs -s    # strict: 위반 시 fail
 *
 * 한계:
 * - 복잡한 SQL (dynamic table 이름, 변수 보간) 은 탐지 못 함 → 명백한 리터럴만 잡음.
 * - 다른 file 에서 정의된 상수로 값 전달하는 케이스는 놓침.
 * - CHECK constraint 가 ALTER ADD COLUMN 으로 추가된 경우도 포착.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

// ─────────────────────────────────────────────
// 1. migrations 파싱 → CHECK 인덱스 구축
// ─────────────────────────────────────────────
/** @type {Map<string, Map<string, Set<string>>>} */
const checkMap = new Map()

function addCheck(table, column, values) {
  const t = table.toLowerCase()
  const c = column.toLowerCase()
  if (!checkMap.has(t)) checkMap.set(t, new Map())
  const colMap = checkMap.get(t)
  if (!colMap.has(c)) colMap.set(c, new Set())
  const set = colMap.get(c)
  for (const v of values) set.add(v)
}

function removeCheck(table, column) {
  const t = table.toLowerCase()
  const c = column.toLowerCase()
  const colMap = checkMap.get(t)
  if (colMap) colMap.delete(c)
}

function parseMigrations() {
  const migDir = path.join(ROOT, 'migrations')
  if (!fs.existsSync(migDir)) return
  // 🛡️ 2026-05-17 v2: 마이그레이션을 파일명 순서대로 적용 (DROP COLUMN / ADD COLUMN 순서 의존).
  //   예: 0001 이 CHECK 추가 → 0118 이 DROP COLUMN + ADD COLUMN (CHECK 없음) → 제약 사라짐.
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migDir, f), 'utf8')

    // 🛡️ (z) DROP TABLE — 모든 CHECK 무효화. 'DROP TABLE IF EXISTS notifications;' 다음의
    //   'CREATE TABLE IF NOT EXISTS notifications (...)' 가 새 CHECK 정의 가능.
    const dropTableRegex = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*;/gi
    let m
    while ((m = dropTableRegex.exec(sql))) {
      checkMap.delete(m[1].toLowerCase())
    }

    // (a) CREATE TABLE ... ( ... col TEXT ... CHECK(col IN (...)) ... )
    const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(([\s\S]*?)\);/gi
    while ((m = createRegex.exec(sql))) {
      const table = m[1]
      const body = m[2]
      const lines = body.split(/,(?![^()]*\))/g)
      for (const line of lines) {
        const checkRegex = /CHECK\s*\(\s*[`"]?(\w+)[`"]?\s+IN\s*\(([^)]+)\)\s*\)/i
        const cm = line.match(checkRegex)
        if (cm) {
          const col = cm[1]
          const values = [...cm[2].matchAll(/'([^']*)'/g)].map((x) => x[1])
          if (values.length > 0) addCheck(table, col, values)
        }
      }
    }

    // (b) ALTER TABLE <t> ADD COLUMN <c> ... CHECK(<c> IN (...))
    const alterAddCheckRegex = /ALTER\s+TABLE\s+[`"]?(\w+)[`"]?\s+ADD\s+COLUMN\s+[`"]?(\w+)[`"]?[^;]*?CHECK\s*\(\s*[`"]?\w+[`"]?\s+IN\s*\(([^)]+)\)\s*\)\s*;/gi
    while ((m = alterAddCheckRegex.exec(sql))) {
      const table = m[1]
      const col = m[2]
      const values = [...m[3].matchAll(/'([^']*)'/g)].map((x) => x[1])
      if (values.length > 0) addCheck(table, col, values)
    }

    // (c) ALTER TABLE <t> DROP COLUMN <c> — 기존 CHECK 무효화.
    //   D1/SQLite 는 DROP COLUMN 시 컬럼+CHECK 모두 제거. 후속 ADD COLUMN 이 CHECK 없으면
    //   복원 안 됨 (0118 의 orders.status 케이스).
    //   ⚠️ 같은 ADD/DROP 이 idempotent 하지 않은 SQLite 특성 상,
    //   ADD COLUMN 중복 호출은 fail 만 하고 기존 CHECK 영향 없음 → rule (d) 추가 안 함.
    const dropRegex = /ALTER\s+TABLE\s+[`"]?(\w+)[`"]?\s+DROP\s+COLUMN\s+[`"]?(\w+)[`"]?\s*;/gi
    while ((m = dropRegex.exec(sql))) {
      removeCheck(m[1], m[2])
    }
  }
}

// ─────────────────────────────────────────────
// 2. 소스 스캔 → UPDATE ... SET status = '<v>' 추출
// ─────────────────────────────────────────────
const violations = []

/**
 * Paren-depth aware comma split — VALUES (a, b, foo(x, y)) 같은 nested 정확히 처리.
 */
function splitTopLevel(s, delim = ',') {
  const out = []
  let depth = 0
  let inStr = null
  let buf = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (ch === '\\') { buf += ch + (s[i + 1] || ''); i++; continue }
      buf += ch
      if (ch === inStr) inStr = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; buf += ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; buf += ch; continue }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; buf += ch; continue }
    if (ch === delim && depth === 0) { out.push(buf.trim()); buf = ''; continue }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8')

  // ──────────────────────────────────────────
  // (A) UPDATE <table> SET <col> = '<value>'
  // ──────────────────────────────────────────
  const updateRegex = /UPDATE\s+[`"]?(\w+)[`"]?(?:\s+\w+)?\s+SET\s+([\s\S]*?)(?:\s+WHERE\b|\s+RETURNING\b|\s+ON\s+CONFLICT\b|;|\n\s*`)/gi

  let m
  while ((m = updateRegex.exec(src))) {
    const table = m[1].toLowerCase()
    const setClause = m[2]
    const colMap = checkMap.get(table)
    if (!colMap) continue

    const assignRegex = /[`"]?(\w+)[`"]?\s*=\s*'([^']*)'/g
    let a
    while ((a = assignRegex.exec(setClause))) {
      const col = a[1].toLowerCase()
      const val = a[2]
      const allowed = colMap.get(col)
      if (!allowed) continue
      if (!allowed.has(val)) {
        const before = src.slice(0, m.index + a.index)
        const line = before.split('\n').length
        violations.push({
          file: path.relative(ROOT, file),
          line,
          op: 'UPDATE',
          table,
          column: col,
          value: val,
          allowed: [...allowed],
        })
      }
    }
  }

  // ──────────────────────────────────────────
  // (B) INSERT INTO <t> (<cols>) VALUES (<vals>)
  //   - 컬럼-값 위치 매핑.
  //   - VALUES (...), (...) multi-row 도 처리.
  //   - VALUES 안의 SELECT / 함수 호출은 paren-balanced split 으로 분리.
  //   - 리터럴 '<val>' 만 비교. placeholder ?, 함수 호출, 변수 (${...}) 는 skip.
  // ──────────────────────────────────────────
  const insertHeaderRegex = /INSERT\s+(?:OR\s+(?:IGNORE|REPLACE|ABORT|FAIL|ROLLBACK)\s+)?INTO\s+[`"]?(\w+)[`"]?\s*\(([^)]*)\)\s*VALUES\s*/gi

  while ((m = insertHeaderRegex.exec(src))) {
    const table = m[1].toLowerCase()
    const colsStr = m[2]
    const colMap = checkMap.get(table)
    if (!colMap) continue

    // 컬럼 리스트
    if (colsStr.includes('${')) continue  // dynamic — skip
    const cols = colsStr.split(',').map((c) => c.trim().replace(/^[`"]?|[`"]?$/g, '').toLowerCase()).filter(Boolean)
    if (cols.length === 0) continue

    // 컬럼들 중 CHECK 가 있는 것만 검증 대상
    const checkedCols = cols.map((c, i) => ({ name: c, idx: i, allowed: colMap.get(c) })).filter((x) => x.allowed)
    if (checkedCols.length === 0) continue

    // VALUES 절: 헤더 뒤부터 paren-balanced parsing.
    //   여러 행 ((a,b),(c,d)) 가능. 각 행 처리.
    const valuesStart = m.index + m[0].length
    let cursor = valuesStart
    let rowIndex = 0
    while (cursor < src.length) {
      // skip whitespace
      while (cursor < src.length && /\s/.test(src[cursor])) cursor++
      if (src[cursor] !== '(') break
      // balanced extract
      let depth = 1
      let inStr = null
      let i = cursor + 1
      while (i < src.length && depth > 0) {
        const ch = src[i]
        if (inStr) {
          if (ch === '\\') { i += 2; continue }
          if (ch === inStr) inStr = null
        } else {
          if (ch === "'" || ch === '"' || ch === '`') inStr = ch
          else if (ch === '(') depth++
          else if (ch === ')') depth--
        }
        if (depth === 0) break
        i++
      }
      if (depth !== 0) break
      const valsStr = src.slice(cursor + 1, i)
      // dynamic 보간 있으면 skip
      if (!valsStr.includes('${')) {
        const vals = splitTopLevel(valsStr)
        if (vals.length === cols.length) {
          for (const ck of checkedCols) {
            const raw = vals[ck.idx]
            // 리터럴 '<val>' 인 경우만 검증 (placeholder/함수/식별자 skip)
            const litMatch = raw && raw.match(/^'([^']*)'$/)
            if (!litMatch) continue
            const val = litMatch[1]
            if (!ck.allowed.has(val)) {
              const before = src.slice(0, cursor + 1)
              const line = before.split('\n').length
              violations.push({
                file: path.relative(ROOT, file),
                line,
                op: 'INSERT',
                table,
                column: ck.name,
                value: val,
                allowed: [...ck.allowed],
                rowIndex,
              })
            }
          }
        }
      }
      cursor = i + 1
      rowIndex++
      // 다음 row 가능성 (comma)
      while (cursor < src.length && /\s/.test(src[cursor])) cursor++
      if (src[cursor] !== ',') break
      cursor++
    }
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue
      walk(full)
    } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
      scanFile(full)
    }
  }
}

// ─────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────
parseMigrations()
walk(path.join(ROOT, 'src/features'))
walk(path.join(ROOT, 'src/worker'))

if (violations.length === 0) {
  console.log('✅ CHECK 제약 위반 없음 (스캔된 routes/worker 코드).')
  process.exit(0)
}

console.error('\n🚨 CHECK 제약 위반 후보 발견:')
for (const v of violations) {
  const sigil = v.op === 'INSERT' ? `INSERT INTO ${v.table} → (${v.column} = '${v.value}')${v.rowIndex ? ` [row ${v.rowIndex}]` : ''}` : `UPDATE ${v.table} SET ${v.column} = '${v.value}'`
  console.error(
    `  ${v.file}:${v.line}\n` +
      `    ${sigil}\n` +
      `    허용값: ${v.allowed.map((x) => `'${x}'`).join(', ')}`,
  )
}
console.error(
  `\n총 ${violations.length}건. SQL 실행 시 SqlError 발생 → 500 응답.\n` +
    `해결책: 허용된 값으로 변경하거나, 마이그레이션 추가 후 CHECK 제약 갱신.\n`,
)

if (STRICT) process.exit(1)
console.warn('⚠️  warn-only 모드. STRICT 차단은 -s 옵션.')
process.exit(0)
