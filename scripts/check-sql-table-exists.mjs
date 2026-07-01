#!/usr/bin/env node
/**
 * 🛡️ 2026-07-01: 존재하지 않는 '테이블' 참조 자동 탐지 (check-sql-column-exists 의 테이블판).
 *
 * 배경: admin 리뷰 관리가 없는 `reviews` 테이블(실제=`product_reviews`)을 SELECT/JOIN →
 *   D1 `no such table: reviews` → 항상 500 (대표 "에러 너무 많아", 2026-07-01).
 *   기존 check-sql-column-exists 는 INSERT/UPDATE '컬럼'만 검사 — FROM/JOIN '테이블명'은 미검사였음.
 *   이 클래스(오타·리네임 누락으로 없는 테이블 참조 → 런타임 500)를 커밋/CI 에서 사전 차단.
 *
 * 동작:
 * 1. 알려진 테이블 집합 수집:
 *    - migrations/*.sql 의 CREATE TABLE / ALTER RENAME TO
 *    - src 전역(repair-schema 포함) 의 CREATE TABLE [IF NOT EXISTS] <name>
 *    - KNOWN_TABLES_EXTRA (파서가 못 잡는 실제 테이블 수동 등록)
 * 2. src 워커 코드의 SQL 문자열(백틱/prepare 인자)에서
 *    FROM / JOIN / INTO / UPDATE ... SET / DELETE FROM <table> 추출.
 * 3. 알려진 테이블·동일쿼리 CTE(WITH x AS)·서브쿼리((SELECT..))·보간(dollar-brace)·
 *    sqlite 내장(sqlite_ · pragma_ · json_each 등) 제외 후, 미지 테이블 참조를 flag.
 *
 * 한계: 순수 정적 분석 — 동적 테이블명(${t})·희귀 문법은 skip(false negative 허용).
 *   목표는 'reviews vs product_reviews' 같은 하드코딩 오타를 잡는 것(false positive 0 우선).
 *
 * 사용:
 *   node scripts/check-sql-table-exists.mjs        # warn-only (기본)
 *   node scripts/check-sql-table-exists.mjs -s     # strict (위반 시 exit 1 — CI)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

/**
 * 파서가 CREATE 문을 못 잡는 실제 테이블 수동 등록.
 *   이 레포는 마이그레이션 기록이 불완전(CLAUDE.md — D1 마이그레이션 CI 미작동, repair-schema 로 응급)
 *   → 아래 테이블들은 프로덕션 D1 에 존재하나 레포에 `CREATE TABLE <name>` 리터럴이 없음
 *   (여러 파일/크론에서 일관 사용 = 실재 확인). 신규 오타 테이블은 이 목록에 없으므로 flag 됨.
 *   ⚠️ 새 실제 테이블은 repair-schema/마이그레이션에 CREATE 를 추가하면 자동 인식(여기 등록 불필요).
 */
const KNOWN_TABLES_EXTRA = new Set([
  'products_fts',        // FTS5 virtual table (migration 0080, CREATE VIRTUAL TABLE)
  'sqlite_master', 'sqlite_sequence', 'sqlite_temp_master',
  // ── 프로덕션 존재(레포 CREATE 미기록) — 다중 파일 일관 사용으로 실재 확인 ──
  'user_sessions', 'sessions',           // 세션 추적 (admin-metrics / reconciliation)
  'interest_list',                       // 관심상품 (group-buy)
  'ad_searchad_connections',             // 네이버 검색광고 연동 (searchad)
  'live_chat',                           // 라이브 채팅 (live-notify / viewer-loyalty / metrics)
  'product_views',                       // 상품 조회수 (seller-analytics / delete-account)
  'social_follows', 'user_follows',      // 팔로우 (notifications / push)
  'search_history',                      // 검색 이력 (delete-account)
  'schema_repair_history',               // repair-schema 실행 이력 (internal-admin-tools)
  'refund_history',                      // 레거시 감사 write-only(읽기 0, swallow 처리) — 존재무관 무해(refund.ts recordRefundHistory)
  // 참고: admin_notifications·admin_dashboard_notifications 는 오타였음(실제=dashboard_notifications).
  //   2026-07-01 교정 완료 → 더는 참조 없음(여기 등록 불필요).
])

/** SQLite 내장/테이블-값 함수 — 테이블 아님, 무시. */
const SQLITE_BUILTINS = new Set([
  'json_each', 'json_tree', 'pragma_table_info', 'pragma_index_list',
  'pragma_foreign_key_list', 'generate_series',
])

/** @type {Set<string>} */
const tables = new Set([...KNOWN_TABLES_EXTRA])

function addTable(name) {
  if (name) tables.add(name.toLowerCase())
}

// ── 1) 알려진 테이블 수집 ────────────────────────────────────────
const CREATE_RE = /CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?/gi
const CREATE_VIEW_RE = /CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?/gi
const RENAME_RE = /ALTER\s+TABLE\s+[`"]?\w+[`"]?\s+RENAME\s+TO\s+[`"]?(\w+)[`"]?/gi

function collectCreates(src) {
  let m
  while ((m = CREATE_RE.exec(src))) addTable(m[1])
  while ((m = CREATE_VIEW_RE.exec(src))) addTable(m[1])
  while ((m = RENAME_RE.exec(src))) addTable(m[1])
}

// ── 파일 워크 ───────────────────────────────────────────────────
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.wrangler'])
function walk(dir, exts, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) walk(full, exts, out) }
    else if (exts.some((x) => e.name.endsWith(x))) out.push(full)
  }
  return out
}

// migrations
const migDir = path.join(ROOT, 'migrations')
if (fs.existsSync(migDir)) {
  for (const f of fs.readdirSync(migDir).filter((f) => f.endsWith('.sql'))) {
    collectCreates(fs.readFileSync(path.join(migDir, f), 'utf8'))
  }
}
// src (repair-schema + 인라인 CREATE TABLE 포함)
const srcFiles = walk(path.join(ROOT, 'src'), ['.ts', '.tsx'])
for (const f of srcFiles) collectCreates(fs.readFileSync(f, 'utf8'))

// ── 2) SQL 문자열 추출 + 3) 테이블 참조 검증 ────────────────────
const violations = []
let refChecks = 0

/** 소스에서 SQL 로 보이는 문자열 리터럴만 추출(JS 의 `from` 오탐 방지). */
function extractSqlStrings(src) {
  const out = []
  // 백틱 템플릿 리터럴 (다중행 SQL 의 주 컨테이너)
  const bt = /`([^`\\]*(?:\\.[^`\\]*)*)`/gs
  let m
  while ((m = bt.exec(src))) {
    if (/\b(SELECT|INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE)\b/i.test(m[1])) {
      out.push({ text: m[1], index: m.index })
    }
  }
  // 단일/이중 인용 문자열 (prepare('...') 짧은 SQL)
  const q = /(['"])((?:\\.|(?!\1).)*)\1/g
  while ((m = q.exec(src))) {
    if (/\b(SELECT|INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i.test(m[2])) {
      out.push({ text: m[2], index: m.index })
    }
  }
  return out
}

/** SQL 문자열 내 CTE(WITH x AS, , y AS) 이름 수집 — 로컬 별칭이라 미지테이블 오탐 방지. */
function cteNames(sql) {
  const names = new Set()
  const re = /(?:\bWITH\s+(?:RECURSIVE\s+)?|,\s*)[`"]?(\w+)[`"]?\s+AS\s*\(/gi
  let m
  while ((m = re.exec(sql))) names.add(m[1].toLowerCase())
  return names
}

const REFS = [
  { re: /\bFROM\s+([`"]?)(\w+)\1(?!\s*\()/gi, op: 'FROM' },
  { re: /\bJOIN\s+([`"]?)(\w+)\1/gi, op: 'JOIN' },
  { re: /\bINSERT\s+(?:OR\s+\w+\s+)?INTO\s+([`"]?)(\w+)\1/gi, op: 'INTO' },
  { re: /\bUPDATE\s+([`"]?)(\w+)\1\s+SET/gi, op: 'UPDATE' },
  { re: /\bDELETE\s+FROM\s+([`"]?)(\w+)\1/gi, op: 'DELETE' },
]

function checkRef(name, sql, ctes) {
  const t = name.toLowerCase()
  if (tables.has(t) || ctes.has(t) || SQLITE_BUILTINS.has(t)) return true
  if (t.startsWith('pragma_') || t.startsWith('sqlite_')) return true
  return false
}

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  for (const { text, index } of extractSqlStrings(src)) {
    // 보간된 테이블명(${t}) 은 정적판정 불가 → 문자열 전체 skip 하지 않고, 개별 ref 만 skip.
    const ctes = cteNames(text)
    for (const { re, op } of REFS) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(text))) {
        const name = m[2]
        // 바로 앞이 ${ 보간(동적) 이면 skip
        const before = text.slice(Math.max(0, m.index - 2), m.index)
        if (before.includes('$')) continue
        refChecks++
        if (!checkRef(name, text, ctes)) {
          const line = src.slice(0, index).split('\n').length
          violations.push({ file: path.relative(ROOT, file), line, op, table: name })
        }
      }
    }
  }
}

for (const f of srcFiles) scanFile(f)

// ── 리포트 ──────────────────────────────────────────────────────
// 중복 제거
const seen = new Set()
const uniq = violations.filter((v) => {
  const k = `${v.file}:${v.line}:${v.op}:${v.table}`
  if (seen.has(k)) return false
  seen.add(k)
  return true
})

if (uniq.length === 0) {
  console.log(`✅ check-sql-table-exists: 미지 테이블 참조 0 (알려진 테이블 ${tables.size}개, ${refChecks} refs 검사)`)
  process.exit(0)
}

console.error(`\n🚨 존재하지 않는 테이블 참조 ${uniq.length}건 (스키마에 CREATE TABLE 없음):`)
for (const v of uniq) {
  console.error(`  ${v.file}:${v.line}  ${v.op} ${v.table}`)
}
console.error(`\n→ 테이블명 오타이거나(예: reviews → product_reviews), 실제 존재하면`)
console.error(`  scripts/check-sql-table-exists.mjs 의 KNOWN_TABLES_EXTRA 에 등록하세요.`)
console.error(`  (알려진 테이블 ${tables.size}개 기준)`)

process.exit(STRICT ? 1 : 0)
