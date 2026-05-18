#!/usr/bin/env node
/**
 * 🛡️ 2026-05-17: SQL prepare(?) vs bind(args) 개수 mismatch 자동 탐지.
 *
 * 배경: D1/SQLite 가 'X arguments passed but query has Y placeholders' 런타임 에러 발생.
 *   사용자 클릭 시 500 → 사용자가 직접 테스트해야 발견.
 *
 * 동작:
 * 1. src/**\/*.ts(x) 스캔.
 * 2. 다음 패턴 매칭:
 *    a) prepare(`<sql>`).bind(<args>).run()/all()/first()
 *    b) prepare('<sql>').bind(<args>).run()/all()/first()
 *    c) prepare(<sql>).bind(<args>) (단순 변수에서 부담스러우니 backtick/single-quote 만)
 * 3. SQL 안의 ? 개수 vs bind args 개수 비교.
 * 4. 불일치 시 보고.
 *
 * 한계:
 * - prepare 와 bind 가 같은 expression chain 일 때만 매칭.
 * - bind 인자 안에 함수 호출 ( foo(x, y) ) 이 있으면 top-level comma split 이 안전 (간단한 stack parser).
 * - ?,? 같은 IN 절 동적 placeholder (Array(n).fill('?').join(',')) 는 무시.
 * - SQL 안에 ${var} 보간이 있으면 그 부분은 정확히 ? 개수 못 셈 → skip.
 *
 * 사용:
 *   node scripts/check-sql-bind-params.mjs       # warn-only
 *   node scripts/check-sql-bind-params.mjs -s    # strict (CI 차단)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

const violations = []
const skipped = []
const stats = { prepareCalls: 0, withBind: 0, interpolated: 0, analyzed: 0 }

/**
 * Top-level comma split — 괄호/대괄호/문자열 안의 콤마는 무시.
 * 예: 'foo(a, b), c' → ['foo(a, b)', 'c']
 */
function splitArgs(s) {
  const args = []
  let depth = 0
  let inStr = null  // 'string char or null'
  let buf = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (ch === '\\') { buf += ch + (s[i + 1] || ''); i++; continue }
      buf += ch
      if (ch === inStr) inStr = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch
      buf += ch
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; buf += ch; continue }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; buf += ch; continue }
    if (ch === ',' && depth === 0) {
      args.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) args.push(buf.trim())
  return args
}

/**
 * SQL 문자열의 ? 개수 카운트. 단, 다음은 제외:
 * - 문자열 리터럴 안의 ?  ('hello?')
 * - ${...} 보간 안의 ?
 * - ?? (D1 미지원이지만 안전 차원)
 */
function countPlaceholders(sql) {
  // 보간 ${...} 가 있으면 정확히 카운트 불가능 — null 반환해 skip 처리.
  if (/\$\{[^}]*\}/.test(sql)) return null

  let count = 0
  let inStr = null
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    // 🛡️ JS escape `\X` 는 source 에서 2-char 지만 실제 SQL 은 1-char.
    //   상태 관계없이 `\` 만나면 다음 1글자 skip → JS escape 가 false string-enter 트리거 안 함.
    if (ch === '\\') { i++; continue }
    if (inStr) {
      if (ch === inStr) inStr = null
      continue
    }
    if (ch === "'" || ch === '"') { inStr = ch; continue }
    if (ch === '?') {
      // ?? 는 skip (D1 미지원이지만 안전 차원)
      if (sql[i + 1] === '?') { i++; continue }
      count++
    }
  }
  return count
}

/**
 * 파일 내 prepare(SQL).bind(args) 체인 찾기.
 *   prepare 인자가 backtick/single-quote/double-quote 문자열 리터럴인 경우만 처리.
 *   prepare 와 bind 사이 .stmts (예: .prepare(...).withFoo().bind(...)) 도 허용.
 */
function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8')

  // prepare(`...`) 형태 — 백틱 (가장 흔함, 멀티라인 가능)
  //   prepare 호출의 닫는 paren 까지 캡쳐: prepare\(`([^`]*)`\)
  //   그 뒤에 .<...>.bind(<args>)
  //
  // 멀티라인 백틱은 [^`] 가 줄바꿈 포함하므로 OK.
  // bind args 는 paren depth 0 까지: [^)]+ 가 아니라 균형 잡힌 매칭 필요.
  //   여기선 보수적으로: bind\((.*?)\)\.(run|all|first|raw)\(
  //   .*? 가 lazy 라서 함수 인자 안의 `)` 만나면 종료 — false negative 발생 가능.
  //
  // 정확한 매칭을 위해 직접 paren-depth 파서 작성.

  let i = 0
  while (i < src.length) {
    // prepare( 찾기
    const prepIdx = src.indexOf('prepare(', i)
    if (prepIdx < 0) break

    // prepare( 다음에 백틱/싱글/더블 quote 인지 확인
    const afterPrep = prepIdx + 'prepare('.length
    let cursor = afterPrep
    // skip whitespace
    while (cursor < src.length && /\s/.test(src[cursor])) cursor++
    const quote = src[cursor]
    if (quote !== '`' && quote !== "'" && quote !== '"') {
      i = prepIdx + 1
      continue
    }
    // 문자열 끝 찾기
    const sqlStart = cursor + 1
    let sqlEnd = sqlStart
    while (sqlEnd < src.length) {
      const ch = src[sqlEnd]
      if (ch === '\\') { sqlEnd += 2; continue }
      if (ch === quote) break
      sqlEnd++
    }
    if (sqlEnd >= src.length) { i = prepIdx + 1; continue }

    stats.prepareCalls++
    const sql = src.slice(sqlStart, sqlEnd)
    // prepare 닫는 ) 확인
    let prepClose = sqlEnd + 1
    while (prepClose < src.length && /\s/.test(src[prepClose])) prepClose++
    if (src[prepClose] !== ')') { i = sqlEnd + 1; continue }

    // 그 뒤에 .bind( 까지 (.<method>(...).bind(... 가능)
    // 더 간단히: prepClose+1 부터 .bind( 찾기. 단 다른 prepare/세미콜론 만나면 중단.
    let chainCursor = prepClose + 1
    let bindStart = -1
    while (chainCursor < src.length) {
      // 다음 token 까지 skip
      while (chainCursor < src.length && /[\s\n]/.test(src[chainCursor])) chainCursor++
      if (src[chainCursor] !== '.') break
      // method 이름 읽기
      chainCursor++
      const methodStart = chainCursor
      while (chainCursor < src.length && /[a-zA-Z_]/.test(src[chainCursor])) chainCursor++
      const method = src.slice(methodStart, chainCursor)
      // ( 만나야 함
      if (src[chainCursor] !== '(') break

      if (method === 'bind') {
        bindStart = chainCursor + 1
        break
      }
      // method() 의 인자 skip — 균형 paren
      let depth = 1
      chainCursor++
      while (chainCursor < src.length && depth > 0) {
        if (src[chainCursor] === '(') depth++
        else if (src[chainCursor] === ')') depth--
        chainCursor++
      }
      if (depth !== 0) break
    }

    if (bindStart < 0) {
      // prepare 만 있고 bind 없음 (인자 0개 SQL) — 체크 대상 아님
      i = sqlEnd + 1
      continue
    }
    stats.withBind++

    // bind 닫는 paren 찾기 (균형)
    let depth = 1
    let bindEnd = bindStart
    let inStrInBind = null
    while (bindEnd < src.length && depth > 0) {
      const ch = src[bindEnd]
      if (inStrInBind) {
        if (ch === '\\') { bindEnd += 2; continue }
        if (ch === inStrInBind) inStrInBind = null
      } else {
        if (ch === '"' || ch === "'" || ch === '`') inStrInBind = ch
        else if (ch === '(') depth++
        else if (ch === ')') depth--
      }
      bindEnd++
    }

    if (depth !== 0) { i = sqlEnd + 1; continue }
    const bindStr = src.slice(bindStart, bindEnd - 1)

    // ? 개수 카운트
    const placeholders = countPlaceholders(sql)
    if (placeholders === null) {
      stats.interpolated++
      i = bindEnd
      continue
    }
    stats.analyzed++

    // bind args 개수
    const args = bindStr.trim() === '' ? [] : splitArgs(bindStr)

    // ...args spread 가 있으면 정확히 카운트 불가능 → skip
    if (args.some((a) => a.startsWith('...'))) {
      skipped.push({ file: path.relative(ROOT, file), line: lineOf(src, prepIdx), reason: 'spread args' })
      i = bindEnd
      continue
    }

    if (placeholders !== args.length) {
      violations.push({
        file: path.relative(ROOT, file),
        line: lineOf(src, prepIdx),
        placeholders,
        bindCount: args.length,
        sqlSnippet: sql.replace(/\s+/g, ' ').slice(0, 100),
      })
    }

    i = bindEnd
  }
}

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length
}

function walk(dir) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
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

walk(path.join(ROOT, 'src'))

const summary = `prepare=${stats.prepareCalls}, with-bind=${stats.withBind}, analyzed=${stats.analyzed}, interpolated-skip=${stats.interpolated}, spread-skip=${skipped.length}`

if (violations.length === 0) {
  console.log(`✅ SQL bind param mismatch 없음.\n   ${summary}`)
  process.exit(0)
}

console.error('\n🚨 SQL prepare(?) ≠ bind(args) 개수 불일치:')
for (const v of violations) {
  console.error(
    `  ${v.file}:${v.line}\n` +
      `    placeholders=${v.placeholders}, bind args=${v.bindCount}\n` +
      `    SQL: ${v.sqlSnippet}${v.sqlSnippet.length === 100 ? '...' : ''}`,
  )
}
console.error(
  `\n총 ${violations.length}건. 런타임 시 'wrong number of bindings' SqlError → 500.\n` +
    `해결책: 누락 bind 추가 or 불필요 ? 제거.\n`,
)

if (STRICT) process.exit(1)
console.warn('⚠️  warn-only 모드. CI 차단은 -s.')
process.exit(0)
