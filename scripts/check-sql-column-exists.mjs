#!/usr/bin/env node
/**
 * 🛡️ 2026-05-17: 존재하지 않는 컬럼 참조 자동 탐지.
 *
 * 배경: INSERT INTO notifications (body, link, ...) — 'body' 컬럼이 schema 에 없는데 사용.
 *   D1 에러 'no such column: body' → .catch(swallow) 로 silent fail → 알림 누락 사고 (2026-05-17 발견).
 *   기존 check-schema-refs.sh 는 4개 테이블(orders/order_items/live_streams/donations) 만 검사.
 *
 * 동작:
 * 1. 마이그레이션 파싱 → { table: Set<column> } 인덱스 (CREATE TABLE + ALTER ADD/DROP COLUMN).
 * 2. src/**\/*.ts 의 INSERT INTO <t> (<cols>) 추출 → 각 컬럼이 스키마에 존재하는지 검증.
 * 3. UPDATE <t> SET <col> = ... 도 동일 검증.
 *
 * 한계:
 * - SELECT 절은 너무 복잡 (JOIN/alias/expression) — skip.
 * - 동적 컬럼 ${col} 보간 → skip.
 * - 마이그레이션이 누락된 production 변경은 false positive 발생 → ignore list 지원.
 *
 * 사용:
 *   node scripts/check-sql-column-exists.mjs       # warn-only
 *   node scripts/check-sql-column-exists.mjs -s    # strict (CI)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

/** @type {Map<string, Set<string>>} */
const schema = new Map()

/**
 * 🛡️ Known legacy: production 에서 manually drop 된 컬럼들.
 *   코드는 try/catch 로 best-effort sync 시도 — silent fail 의도된 케이스.
 *   이런 컬럼은 reporting 에서 제외 (false positive 차단).
 */
const KNOWN_DROPPED_COLUMNS = new Set([
  'users.deal_balance',      // 2026-05 user_points 테이블로 마이그레이션 후 drop
  'users.status',            // 동일
  'users.google_id',         // 다중 OAuth 통합 후 drop
])

function addCol(table, col) {
  const t = table.toLowerCase()
  const c = col.toLowerCase()
  if (!schema.has(t)) schema.set(t, new Set())
  schema.get(t).add(c)
}

function dropCol(table, col) {
  schema.get(table.toLowerCase())?.delete(col.toLowerCase())
}

function parseMigrations() {
  const migDir = path.join(ROOT, 'migrations')
  if (!fs.existsSync(migDir)) return
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
  const stripComments = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

  for (const f of files) {
    const sql = fs.readFileSync(path.join(migDir, f), 'utf8')

    // DROP TABLE — schema 에서 제거 (subsequent CREATE 가 fresh 시작 가능).
    //   특히 'DROP TABLE IF EXISTS x; CREATE TABLE IF NOT EXISTS x ...' 패턴은 reset semantics.
    const dropTableRegex = /DROP\s+TABLE\s+(IF\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*;/gi
    let m
    while ((m = dropTableRegex.exec(sql))) {
      schema.delete(m[2].toLowerCase())
    }

    // CREATE TABLE (IF NOT EXISTS 첫 정의 우선) — paren-balance 추출.
    const createHeaderRegex = /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(/gi
    while ((m = createHeaderRegex.exec(sql))) {
      const ifNotExists = !!m[1]
      const table = m[2]
      if (ifNotExists && schema.has(table.toLowerCase())) continue
      const openIdx = m.index + m[0].length - 1
      const body = extractBalancedBody(sql, openIdx)
      if (!body) continue
      const stripped = stripComments(body)
      const lines = stripped.split(/,(?![^()]*\))/g)
      for (const line of lines) {
        const trimmed = line.trim()
        if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(trimmed)) continue
        const mc = trimmed.match(/^[`"]?(\w+)[`"]?\s+\w+/)
        if (mc) addCol(table, mc[1])
      }
    }

    // 🛡️ ALTER 들을 소스 위치(인덱스) 기준으로 정렬 후 처리.
    //   안 그러면 'DROP COLUMN x; ADD COLUMN x' 같은 시퀀스에서 ADD 가 먼저 처리되어
    //   최종 상태가 잘못됨 (settlement_status 사고 케이스).
    const alters = []
    const addRegex = /ALTER\s+TABLE\s+[`"]?(\w+)[`"]?\s+ADD\s+COLUMN\s+[`"]?(\w+)[`"]?/gi
    while ((m = addRegex.exec(sql))) alters.push({ idx: m.index, kind: 'add', table: m[1], col: m[2] })
    const dropRegex = /ALTER\s+TABLE\s+[`"]?(\w+)[`"]?\s+DROP\s+COLUMN\s+[`"]?(\w+)[`"]?\s*;/gi
    while ((m = dropRegex.exec(sql))) alters.push({ idx: m.index, kind: 'drop', table: m[1], col: m[2] })
    const renameTableRegex = /ALTER\s+TABLE\s+[`"]?(\w+)[`"]?\s+RENAME\s+TO\s+[`"]?(\w+)[`"]?\s*;/gi
    while ((m = renameTableRegex.exec(sql))) alters.push({ idx: m.index, kind: 'renameTable', old: m[1], fresh: m[2] })
    const renameColRegex = /ALTER\s+TABLE\s+[`"]?(\w+)[`"]?\s+RENAME\s+COLUMN\s+[`"]?(\w+)[`"]?\s+TO\s+[`"]?(\w+)[`"]?\s*;/gi
    while ((m = renameColRegex.exec(sql))) alters.push({ idx: m.index, kind: 'renameCol', table: m[1], oldCol: m[2], newCol: m[3] })

    alters.sort((a, b) => a.idx - b.idx)
    for (const a of alters) {
      if (a.kind === 'add') addCol(a.table, a.col)
      else if (a.kind === 'drop') dropCol(a.table, a.col)
      else if (a.kind === 'renameTable') {
        const old = a.old.toLowerCase()
        const fresh = a.fresh.toLowerCase()
        if (schema.has(old)) { schema.set(fresh, schema.get(old)); schema.delete(old) }
      } else if (a.kind === 'renameCol') {
        const cols = schema.get(a.table.toLowerCase())
        if (cols) { cols.delete(a.oldCol.toLowerCase()); cols.add(a.newCol.toLowerCase()) }
      }
    }
  }
}

// ─────────────────────────────────────────────
// 소스 스캔
// ─────────────────────────────────────────────
const violations = []
const stats = { insertChecks: 0, updateChecks: 0, selectChecks: 0, dynamicSkip: 0 }

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8')

  // INSERT INTO <t> (<cols>) — 컬럼 존재 검증
  const insertRegex = /INSERT\s+(?:OR\s+(?:IGNORE|REPLACE|ABORT|FAIL|ROLLBACK)\s+)?INTO\s+[`"]?(\w+)[`"]?(\s*\([^)]*\))?/gi
  let m
  while ((m = insertRegex.exec(src))) {
    const table = m[1].toLowerCase()
    const colParen = m[2]
    const cols = schema.get(table)
    if (!cols) continue // unknown table — skip (table 미정의 케이스)
    if (!colParen) continue
    const inner = colParen.trim().slice(1, -1)
    if (inner.includes('${')) { stats.dynamicSkip++; continue }
    const colList = inner.split(',').map((c) => c.trim().replace(/^[`"]?|[`"]?$/g, '').toLowerCase()).filter(Boolean)
    if (colList.length === 0) continue
    stats.insertChecks++
    for (const col of colList) {
      if (!cols.has(col)) {
        if (KNOWN_DROPPED_COLUMNS.has(`${table}.${col}`)) continue
        const line = src.slice(0, m.index).split('\n').length
        violations.push({
          file: path.relative(ROOT, file),
          line,
          op: 'INSERT',
          table,
          missingCol: col,
          knownCols: [...cols].slice(0, 10),
        })
      }
    }
  }

  // UPDATE <t> SET <col> = ... — 각 컬럼이 존재하는지 검증
  //   prepare 내 SQL 만 검증 (template literal 의 동적 컬럼 ${} 는 skip)
  const updateRegex = /UPDATE\s+[`"]?(\w+)[`"]?(?:\s+\w+)?\s+SET\s+([\s\S]*?)(?:\s+WHERE\b|\s+RETURNING\b|\s+ON\s+CONFLICT\b|;|\n\s*`)/gi
  while ((m = updateRegex.exec(src))) {
    const table = m[1].toLowerCase()
    const setClause = m[2]
    const cols = schema.get(table)
    if (!cols) continue
    if (setClause.includes('${')) { stats.dynamicSkip++; continue }
    // 'col = X' 패턴에서 col 만 추출 (X 는 무시)
    // 멀티 SET: col1 = X, col2 = Y, ...
    const assigns = setClause.split(/,(?![^(]*\))/g)
    for (const assign of assigns) {
      const am = assign.match(/^\s*[`"]?(\w+)[`"]?\s*=/)
      if (!am) continue
      const col = am[1].toLowerCase()
      stats.updateChecks++
      if (!cols.has(col)) {
        if (KNOWN_DROPPED_COLUMNS.has(`${table}.${col}`)) continue
        const line = src.slice(0, m.index).split('\n').length
        violations.push({
          file: path.relative(ROOT, file),
          line,
          op: 'UPDATE',
          table,
          missingCol: col,
          knownCols: [...cols].slice(0, 10),
        })
      }
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
      try { scanFile(full) } catch (err) {
        console.warn(`[warn] ${path.relative(ROOT, full)}: ${err.message}`)
      }
    }
  }
}

/**
 * src/**\/*.ts 안에 inline CREATE TABLE / ALTER TABLE 가 있으면 schema 에 반영.
 * 런타임에 D1 가 실행하는 DDL — 마이그레이션 파일에 없는 테이블/컬럼 추적.
 */
/**
 * 🛡️ paren-depth aware body extractor — CHECK(...) 같은 내부 paren 을 정확히 통과.
 *   `CREATE TABLE foo (col1, col2 CHECK(x IN ('a','b')), col3)` 의 body 는
 *   `col1, col2 CHECK(x IN ('a','b')), col3` (모든 paren 균형).
 */
function extractBalancedBody(src, openParenIdx) {
  let depth = 1
  let i = openParenIdx + 1
  let inStr = null
  while (i < src.length && depth > 0) {
    const ch = src[i]
    if (inStr) {
      if (ch === '\\') { i += 2; continue }
      if (ch === inStr) inStr = null
    } else {
      if (ch === "'" || ch === '"') inStr = ch
      else if (ch === '(') depth++
      else if (ch === ')') depth--
    }
    if (depth === 0) return src.slice(openParenIdx + 1, i)
    i++
  }
  return null
}

function scanInlineDdl(file) {
  const src = fs.readFileSync(file, 'utf8')
  // CREATE TABLE — header 까지만 regex 로 찾고 body 는 paren-balance 로 추출.
  //   schema.has 가드 제거: ALTER ADD COLUMN 으로 빈 entry 가 미리 생겨있을 수 있음 (e.g. 0211).
  //   addCol 은 Set 기반 idempotent — 중복 호출 안전.
  const createHeaderRegex = /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(/gi
  let m
  while ((m = createHeaderRegex.exec(src))) {
    const table = m[2]
    const openIdx = m.index + m[0].length - 1
    const body = extractBalancedBody(src, openIdx)
    if (!body) continue
    const stripped = body.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')
    const lines = stripped.split(/,(?![^()]*\))/g)
    for (const line of lines) {
      const trimmed = line.trim()
      if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(trimmed)) continue
      const mc = trimmed.match(/^[`"]?(\w+)[`"]?\s+\w+/)
      if (mc) addCol(table, mc[1])
    }
  }
  // ALTER TABLE ADD COLUMN inline
  const addRegex = /ALTER\s+TABLE\s+[`"]?(\w+)[`"]?\s+ADD\s+COLUMN\s+[`"]?(\w+)[`"]?/gi
  while ((m = addRegex.exec(src))) addCol(m[1], m[2])
}

function walkDdl(dir) {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'tests', '__tests__'].includes(e.name)) continue
      walkDdl(full)
    } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
      try { scanInlineDdl(full) } catch { /* skip */ }
    }
  }
}

/**
 * 🔍 **SELECT/WHERE 의 alias-한정 컬럼** — 이 파일 헤더가 "복잡해서 skip" 이라 적어 둔 사각지대.
 *
 * ## 왜 뒤늦게 여는가 (2026-08-02 실측)
 *
 * 그 skip 뒤에서 **8건이 살아 있었다.** 전부 프로덕션 D1 에 실제로 없는 컬럼이고, 전부
 * `no such column` 으로 **쿼리 전체를 던진다**. SQLite 는 없는 컬럼을 NULL 로 봐주지 않는다.
 *
 * | 사이트 | 죽어 있던 것 |
 * |---|---|
 * | `cron/auto-settlement.ts` `p.commission_rate` | 이용권 정산 회차 **전체**가 매일 03:00 KST 에 죽음 |
 * | `utils/affiliate-credit.ts` `s.user_id` | 자기구매·SELF_SELLER **이중지급 가드**가 한 번도 발동 못 함 |
 * | `group-buy-voucher.routes.ts` `p.consigned_from_seller_id` | `recordVoucherUsedLedger`(실제 지급 레일) 미실행 |
 * | 그 외 5건 | 라이브 티커 · 셀러 주문 이미지 · 단골 목록 · 도매 세금 · 반품 목록 |
 *
 * 공통점은 **전부 `try/catch` 또는 `.catch(...)` 안**이라는 것이다. 예외가 사람에게 도달하지
 * 않으니 "기능이 조용히 없는" 상태로 남는다. 이 레포가 반복해 만난 *"실패가 아니라 부재"* 클래스.
 *
 * ## 판정 범위 (좁게 — 오탐이 나면 아무도 안 켠다)
 *
 * - `FROM <t> <a>` / `JOIN <t> [AS] <a>` 로 **명시 바인딩된 alias** 만 본다.
 * - 그 테이블이 스키마 인덱스에 **3컬럼 이상** 있을 때만(=인덱스가 그 테이블을 안다고 믿을 때만).
 * - `${...}` 보간은 **그 조각만 지우고 나머지 리터럴은 검사한다**(문장을 통째로 skip 하지 않는다).
 *   🔴 여기서 한 번 물렸다: 처음엔 보간이 보이면 statement 를 건너뛰게 짰는데, **이 사건의 원본**
 *   (`auto-settlement` 의 `${ledgerSkipClause}`)이 정확히 그 형태라 **주입 검증에서 초록이 떴다.**
 *   가드를 만들고 반드시 깨뜨려 봐야 하는 이유가 이것이다 — 안 해봤으면 "막았다"고 적었을 것이다.
 * - `NULL AS x` 같은 리터럴 별칭·SQL 함수는 `alias.col` 형태가 아니라 자연히 제외된다.
 *
 * ⚠️ **못 잡는 것**: alias 없는 컬럼(`SELECT foo FROM t`) · 서브쿼리에서 같은 alias 를 재바인딩하는
 *   경우 · 동적 SQL · 프로덕션에만 있고 레포엔 기록이 없는 컬럼(→ `SELECT_ALIAS_OK` 로 면제).
 */
const SELECT_ALIAS_OK = new Set([
  // 프로덕션 D1 실측으로 **존재 확인**했으나 레포 DDL 파서가 못 잡는 것들(2026-08-02 확인).
  'settlements.period_start',
  'settlements.period_end',
  'user_coupons.claimed_at',
  'ad_access_requests.plan',   // 유어애즈 별도 DB — 이 인덱스 범위 밖
  'live_streams.viewer_count',
  'products.thumbnail_url',
])

/**
 * 주석을 **공백으로 치환**(길이 보존 → 줄 번호가 안 흔들린다).
 *
 * 🔴 이것 없이 돌렸다가 **내가 방금 쓴 설명 주석**(`p.commission_rate` 라고 적은 그 문장)을
 *   코드로 읽어 위반으로 신고했다. `check-lock-table-symbols` 가 경고한 *"주석에만 남아도"* 함정의
 *   거울상이다 — 그쪽은 주석 때문에 **통과**했고 이쪽은 주석 때문에 **걸렸다**.
 * ⚠️ `//` 는 URL(`https://`)을 깨뜨리므로 **줄 전체가 주석인 경우만** 지운다.
 */
function blankComments(src) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  s = s.split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? ' '.repeat(l.length) : l)).join('\n')
  s = s.replace(/--[^\n]*/g, (m) => ' '.repeat(m.length))   // SQL 주석
  return s
}

function scanSelectAliases(file) {
  const raw = fs.readFileSync(file, 'utf8')
  const src = blankComments(raw)
  const seen = new Set()
  for (const m of src.matchAll(/SELECT\b[\s\S]{0,1500}?\bFROM\s+(\w+)\s+(?:AS\s+)?(\w+)\b([\s\S]{0,1200}?)(?=`|;|\)\s*\.)/gi)) {
    // 보간 조각만 제거 — 남은 리터럴은 그대로 검사한다(중첩 대비 반복 치환).
    let stmt = m[0]
    if (stmt.includes('${')) {
      stats.dynamicSkip++
      let prev
      do { prev = stmt; stmt = stmt.replace(/\$\{[^{}]*\}/g, ' ') } while (stmt !== prev)
      stmt = stmt.replace(/\$\{[\s\S]*?\}/g, ' ')   // 그래도 남으면(중첩 템플릿) 통째로 지운다
    }
    const aliases = new Map([[m[2].toLowerCase(), m[1].toLowerCase()]])
    for (const j of stmt.matchAll(/JOIN\s+(\w+)\s+(?:AS\s+)?(\w+)\s+ON\b/gi)) {
      aliases.set(j[2].toLowerCase(), j[1].toLowerCase())
    }
    for (const ref of stmt.matchAll(/\b([A-Za-z_]\w{0,3})\.(\w+)\b/g)) {
      const table = aliases.get(ref[1].toLowerCase())
      if (!table) continue
      const cols = schema.get(table)
      if (!cols || cols.size < 3) continue          // 인덱스가 그 테이블을 모르면 판단하지 않는다
      const col = ref[2].toLowerCase()
      if (cols.has(col)) continue
      if (KNOWN_DROPPED_COLUMNS.has(`${table}.${col}`)) continue
      if (SELECT_ALIAS_OK.has(`${table}.${col}`)) continue
      const at = src.indexOf(ref[0], m.index)
      const line = at < 0 ? 1 : src.slice(0, at).split('\n').length
      const key = `${table}.${col}@${line}`
      if (seen.has(key)) continue          // 겹치는 statement 창에서 같은 위반이 여러 번 잡힌다
      seen.add(key)
      stats.selectChecks++
      violations.push({
        file: path.relative(ROOT, file), line, op: 'SELECT', table,
        missingCol: ref[2], knownCols: [...cols].slice(0, 10),
      })
    }
  }
}

function walkSelect(dir) {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'tests', '__tests__'].includes(e.name)) continue
      walkSelect(full)
    } else if (e.isFile() && e.name.endsWith('.ts')) {
      try { scanSelectAliases(full) } catch { /* skip */ }
    }
  }
}

parseMigrations()
walkDdl(path.join(ROOT, 'src'))  // 런타임 DDL 도 schema 에 반영
walk(path.join(ROOT, 'src'))
walkSelect(path.join(ROOT, 'src'))

// 🛡️ 측정 0건은 통과가 아니라 **검사가 사라진 것**이다(guard-registry 교훈).
if (schema.size < 20) {
  console.error(`🚨 스키마 인덱스가 비었다(tables=${schema.size}) — 검사가 아니라 파서가 깨진 것이다.`)
  process.exit(1)
}

const summary = `tables=${schema.size}, insert-checks=${stats.insertChecks}, update-checks=${stats.updateChecks}, select-hits=${stats.selectChecks}, dynamic-skip=${stats.dynamicSkip}`

if (violations.length === 0) {
  console.log(`✅ 존재하지 않는 컬럼 참조 없음.\n   ${summary}`)
  process.exit(0)
}

console.error('\n🚨 존재하지 않는 컬럼 참조:')
for (const v of violations) {
  console.error(
    `  ${v.file}:${v.line}\n` +
      `    ${v.op} ${v.table}: '${v.missingCol}' 컬럼 없음\n` +
      `    known cols: ${v.knownCols.join(', ')}${v.knownCols.length === 10 ? ', ...' : ''}`,
  )
}
console.error(
  `\n총 ${violations.length}건. 런타임 'no such column' SqlError → 500.\n` +
    `해결책: 컬럼명 수정 or 마이그레이션 추가.\n`,
)
console.error(`stats: ${summary}\n`)

if (STRICT) process.exit(1)
console.warn('⚠️  warn-only 모드. CI 차단은 -s.')
process.exit(0)
