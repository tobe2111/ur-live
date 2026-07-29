#!/usr/bin/env node
/**
 * 🛡️ 2026-07-01: pagination 정수 파싱 NaN 크래시 자동 탐지.
 *
 * 배경(도매몰 라이브 전수조사): GET /api/wholesale/catalog?page=abc&limit=xyz → HTTP 500.
 *   `Math.max(1, parseInt(q('page')||'1',10))` 에서 q='abc' → parseInt=NaN → Math.max(1,NaN)=NaN →
 *   offset=(NaN-1)*limit=NaN → D1 .bind(NaN) 크래시. 문자열/숫자 기본값('1'/1)이 query 안(||) 에 있어도
 *   비숫자 입력의 NaN 은 못 막고, `parseInt(...) || N` 바깥 폴백은 0 을 삼켜 min-클램프(limit=0→1)를 깬다.
 *
 * 규칙(강): pagination 변수(page/limit/offset/size/perPage/pageNum/pageSize/days/take/skip)를
 *   parseInt/Number 로 파싱하면 **반드시 `intParam(raw, def)`(src/shared/pagination) 경유** 하거나
 *   같은/인접 라인에 `Number.isFinite`/`isNaN` NaN 가드, 또는 삼항 리터럴(`Number(x)===30 ? 30 : 7`)일 것.
 *   raw `parseInt(...) || N` / `Number(x || N)` 형태는 0-삼킴·inner/outer 폴백 혼동으로 금지.
 *
 * ID 해석용 parseInt(numId/numericUid 등)은 변수명이 pagination 이 아니라 자동 제외(이미 isNaN 가드 보유).
 *
 * 사용: node scripts/check-pagination-nan.mjs [-s]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

const VAR = /(?:const|let|var)\s+\w*(?:page|limit|offset|perpage|per_page|pagenum|pagesize|pagelimit|days|take|skip)\w*\s*=/i
const HAS_PARSE = /\b(?:Number\.)?parseInt\s*\(|\bNumber\s*\(/
const SAFE_HELPER = /\bintParam\s*\(/
const HAS_NAN_GUARD = /Number\.isFinite|isNaN/
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
    // request 입력을 파싱하는 경우만(상수 Number(x) 오탐 방지)
    if (!/req\.|query|param|body|\.get\(/.test(ln)) continue
    scanned++
    const ctx = (lines[i - 1] || '') + '\n' + ln + '\n' + (lines[i + 1] || '')
    if (/pagination-nan-ok/.test(ctx)) { safe++; continue }
    if (SAFE_HELPER.test(ln)) { safe++; continue }
    if (HAS_NAN_GUARD.test(ctx)) { safe++; continue }
    if (TERNARY_LITERAL.test(ln)) { safe++; continue }
    violations.push({ file: path.relative(ROOT, f), line: i + 1, code: ln.trim() })
  }
}

if (violations.length === 0) {
  console.log(`✅ pagination NaN 크래시 없음. (scanned=${scanned}, safe=${safe})`)
  process.exit(0)
}

console.log(`\n${STRICT ? '❌' : '⚠️ '} pagination 정수 파싱 NaN 폴백 누락 ${violations.length}건:`)
console.log('   비숫자 query(page=abc)가 NaN→SQL .bind(NaN)→500. `intParam(raw, 기본값)` 경유하세요.\n')
for (const v of violations) console.log(`   ${v.file}:${v.line}\n      ${v.code}`)
console.log(`\n   (의도적 예외는 라인에 \`pagination-nan-ok\` 주석. scanned=${scanned}, safe=${safe})`)
process.exit(STRICT ? 1 : 0)
