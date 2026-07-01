#!/usr/bin/env node
/**
 * 🛡️ 2026-07-01: pagination parseInt/Number NaN 크래시 자동 탐지.
 *
 * 배경(도매몰 라이브 전수조사): GET /api/wholesale/catalog?page=abc&limit=xyz → HTTP 500.
 *   `const page = Math.max(1, parseInt(q('page') || '1', 10))` 에서 q='abc' → parseInt=NaN →
 *   Math.max(1, NaN)=NaN → offset=(NaN-1)*limit=NaN → D1 .bind(NaN) 크래시.
 *   문자열 기본값('1')은 query 부재 시에만 쓰이고 비숫자 입력의 NaN 은 못 막음.
 *   음수/거대값/빈값은 정상(200)이고 **비숫자 문자열만** 500 → 봇/스크래퍼/오염 링크가 목록을 크래시.
 *
 * 안전 관용구 (아래 중 하나면 통과):
 *   - `parseInt(...) || <숫자>`  또는  `Number.parseInt(...) || <숫자>`  (닫는 괄호 뒤 숫자 폴백)
 *   - 같은/인접 라인에 `Number.isFinite(...)` 또는 `isNaN(...)` NaN 가드
 *   - 라인에 `pagination-nan-ok` 주석 (의도적 예외)
 *
 * 대상: pagination 변수(page/limit/offset/size/perPage/pageNum/pageSize/pageLimit/days/take/skip)
 *   를 assign 하며 parseInt/Number(request) 로 값을 뽑는 라인. (ID 해석용 numId/numericUid 등은
 *   변수명이 pagination 이 아니라 자동 제외 — 그들은 이미 isNaN 가드 보유.)
 *
 * 사용:
 *   node scripts/check-pagination-nan.mjs       # warn-only
 *   node scripts/check-pagination-nan.mjs -s    # strict (CI 차단)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

// pagination 변수명 (ID 해석용 numId/numericUid 등은 미포함 → 자동 제외)
const VAR = /(?:const|let|var)\s+\w*(?:page|limit|offset|perpage|per_page|pagenum|pagesize|pagelimit|pagelimit|days|take|skip|pagesize)\w*\s*=/i
// parseInt / Number.parseInt / Number 로 값을 뽑는지
const HAS_PARSE = /\b(?:Number\.)?parseInt\s*\(|\bNumber\s*\(/

// 닫는 괄호 뒤 `|| <숫자>` 폴백이 최소 1개 있는지 (parseInt(...) || 24 형태)
const HAS_NUM_FALLBACK = /\)\s*\|\|\s*\d/
const HAS_NAN_GUARD = /Number\.isFinite|isNaN/
// 삼항 리터럴: `Number(q) === 30 ? 30 : 7` — 결과가 항상 숫자 리터럴이라 NaN 전파 불가(안전)
const TERNARY_LITERAL = /\?\s*\d+\s*:\s*\d+/

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p)
  }
  return acc
}

// 라우트/핸들러 파일만 (request pagination 이 사는 곳)
const files = walk(path.join(ROOT, 'src')).filter(f =>
  /\.routes\.ts$/.test(f) || /\/api\//.test(f) || /\/worker\/routes\//.test(f)
)

const violations = []
let scanned = 0, safe = 0

for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (!VAR.test(ln) || !HAS_PARSE.test(ln)) continue
    // Number(...) 는 request 입력을 뽑을 때만(상수 Number(x) 오탐 줄이기): c.req / query / param / body 참조
    if (!/parseInt/.test(ln) && !/req\.|query|param|body|\.get\(/.test(ln)) continue
    scanned++
    const ctx = (lines[i - 1] || '') + '\n' + ln + '\n' + (lines[i + 1] || '')
    if (/pagination-nan-ok/.test(ctx)) { safe++; continue }
    if (HAS_NAN_GUARD.test(ctx)) { safe++; continue }
    if (TERNARY_LITERAL.test(ln)) { safe++; continue }
    if (HAS_NUM_FALLBACK.test(ln)) { safe++; continue }
    violations.push({ file: path.relative(ROOT, f), line: i + 1, code: ln.trim() })
  }
}

if (violations.length === 0) {
  console.log(`✅ pagination NaN 크래시 없음. (scanned=${scanned}, safe=${safe})`)
  process.exit(0)
}

console.log(`\n${STRICT ? '❌' : '⚠️ '} pagination parseInt/Number 에 NaN 폴백 누락 ${violations.length}건:`)
console.log('   비숫자 query(page=abc)가 NaN→SQL .bind(NaN)→500 크래시. `parseInt(...) || <기본값>` 로 감싸세요.\n')
for (const v of violations) console.log(`   ${v.file}:${v.line}\n      ${v.code}`)
console.log(`\n   (의도적 예외는 라인에 \`pagination-nan-ok\` 주석. scanned=${scanned}, safe=${safe})`)
process.exit(STRICT ? 1 : 0)
