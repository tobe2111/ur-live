#!/usr/bin/env node
/**
 * 🛡️ 2026-06-26: CSV/엑셀 수식 인젝션 버그 클래스 방어.
 *
 * 배경 (전수조사 보안): 도매 CSV 내보내기 헬퍼 `csvEscape` 가 따옴표/개행만 이스케이프하고
 *   `= + - @ 탭/CR` 로 시작하는 셀을 무력화하지 않아, 셀러-제어 free-text(상품명/회사명/바코드)가
 *   `=cmd|'/c calc'!A1` / `=HYPERLINK(...)` 로 들어가면 판매사/어드민이 파일 열 때 실행됐다.
 *
 * 룰: 이름이 `csvEscape` (또는 `*CsvEscape`/`escapeCsv`) 인 함수 정의의 본문에는 반드시
 *   선행 수식문자 가드(`/^[=+...]/` 또는 동등 startsWith/charAt 가드)가 있어야 한다.
 *   (셀이 = + - @ 탭/CR 로 시작하면 선행 작은따옴표 등으로 무력화 후 기존 quote-escape.)
 *
 * 자동 제외: 함수 바로 위 줄 또는 본문에 `csv-injection-ok` 주석.
 *
 * 동작: 기본 warn-only. 차단: `-s` 또는 STRICT_CSV=1 (exit 1).
 */
import fs from 'fs'
import path from 'path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_CSV === '1'
const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')

const EXTS = new Set(['.ts', '.tsx'])
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage'])

/** 재귀 파일 수집. */
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (EXTS.has(path.extname(name))) out.push(full)
  }
  return out
}

/** `name` 으로 시작하는 함수 정의의 본문({}) 을 brace 매칭으로 추출. 반환: [{ index, body }]. */
function findFunctionBodies(code, nameRe) {
  const results = []
  const declRe = new RegExp(
    // function csvEscape(...) {   |   const csvEscape = (...) => {   |   csvEscape(...) {  (메서드)
    `(?:function\\s+${nameRe}\\s*\\([^)]*\\)|(?:const|let|var)\\s+${nameRe}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*(?::[^=>]+)?=>|\\b${nameRe}\\s*\\([^)]*\\)\\s*(?::[^={]+)?)\\s*\\{`,
    'g',
  )
  let m
  while ((m = declRe.exec(code)) !== null) {
    // 본문 시작 { 위치 = 매치 끝 직전의 '{'
    let i = code.indexOf('{', m.index + m[0].length - 1)
    if (i < 0) continue
    let depth = 0
    let j = i
    for (; j < code.length; j++) {
      const ch = code[j]
      if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) { j++; break } }
    }
    results.push({ index: m.index, body: code.slice(i, j) })
  }
  return results
}

/** 본문에 선행 수식문자 가드가 있는가. */
function hasFormulaGuard(body) {
  // 가장 흔한 형태: /^[=+\-@...]/ 정규식 (= 와 + 를 포함하는 leading char class)
  if (/\/\^\[[^\]]*=[^\]]*\+|\/\^\[[^\]]*\+[^\]]*=/.test(body)) return true
  // startsWith / charAt(0) / [0] 로 = + - @ 검사
  if (/(startsWith|charAt\(\s*0\s*\)|\[\s*0\s*\])/.test(body) && /['"`][=+\-@]/.test(body)) return true
  return false
}

const files = fs.existsSync(SRC) ? walk(SRC) : []
const NAME_RE = '(?:csvEscape|escapeCsv|\\w*CsvEscape)'
const violations = []

for (const file of files) {
  if (file.includes(`${path.sep}tests${path.sep}`)) continue
  const code = fs.readFileSync(file, 'utf8')
  if (!/csvEscape|escapeCsv|CsvEscape/.test(code)) continue
  const bodies = findFunctionBodies(code, NAME_RE)
  for (const { index, body } of bodies) {
    // 바로 위 ~2줄 또는 본문에 bypass 주석
    const before = code.slice(Math.max(0, index - 160), index)
    if (/csv-injection-ok/.test(before) || /csv-injection-ok/.test(body)) continue
    if (!hasFormulaGuard(body)) {
      const line = code.slice(0, index).split('\n').length
      violations.push(`${path.relative(ROOT, file)}:${line} — csvEscape 류 함수에 선행 수식문자(= + - @ 탭/CR) 가드 없음`)
    }
  }
}

if (violations.length === 0) {
  console.log('✅ CSV 수식 인젝션 — csvEscape 류 함수 전부 선행 수식문자 가드 보유.')
  process.exit(0)
}

console.error(`${STRICT ? '❌' : '⚠️'} CSV 수식 인젝션 가드 누락 ${violations.length}건:`)
for (const v of violations) console.error('   ' + v)
console.error("\n   수정: 셀이 = + - @ 탭/CR 로 시작하면 선행 작은따옴표로 무력화 후 quote-escape.")
console.error('   예외: 함수 위/본문에 `csv-injection-ok` 주석.')
process.exit(STRICT ? 1 : 0)
