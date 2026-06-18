#!/usr/bin/env node
/**
 * 🛡️ 2026-06-18: "group_buy_status 로 상품 종류(교환권/공구 vs 쇼핑) 판별·라우팅" 버그 클래스 방어.
 *
 * 배경 (실제 사고 — 대표 신고): 큐레이터 핀 redirect(curator.routes)가
 *   `isVoucherFlow = ... || prod.group_buy_status === 'active'` 로 종류를 판별했는데,
 *   `group_buy_status` 는 migration 0146 에서 **모든 상품 DEFAULT 'active'** → 일반 쇼핑
 *   상품까지 voucher 흐름으로 오분류 → /group-buy(교환권 chrome)로 떨어져 "쇼핑 상품이
 *   교환권으로 보임". SSOT(order-type.ts)는 종류 판별에 group_buy_status 사용 금지 명시.
 *
 * 룰 (종류 판별/라우팅은 deal_only=1 + isVoucherCategory(category) 만 사용):
 *   - R1: `...voucher... = (...group_buy_status...)` — voucher 이름 boolean 을 status 로 세팅.
 *   - R2: 같은 줄에 group_buy_status(코드 참조) + 라우팅 리터럴(`/group-buy`·`/vouchers`).
 *   ⇒ "이게 voucher 냐"를 group_buy_status 로 결정하는 패턴.
 *
 * 정당한 용도는 통과: 공구 수명주기 체크(joinable/deadline/milestone), 활성 공구 카운트 등
 *   (voucher 이름 대입도, voucher 라우팅도 아님). SQL 문자열 속 `group_buy_status = 'active'`
 *   필터는 stripNoise 로 제거되어 미검사.
 *
 * 동작: 기본 warn-only. 차단: `-s` 또는 STRICT_GB_CLASSIFY=1 (exit 1). verify.yml CI 는 -s.
 * 예외: 해당 줄/근처에 `groupbuy-classify-ok` 주석.
 */
import fs from 'fs'
import path from 'path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_GB_CLASSIFY === '1'
const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')

/** 주석/문자열 "내용"을 공백 치환 (줄/인덱스 보존). → SQL 문자열 속 group_buy_status·route 리터럴 제거. */
function stripNoise(code) {
  const out = code.split('')
  const n = code.length
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ' }
  let i = 0
  while (i < n) {
    const ch = code[i], nx = code[i + 1]
    if (ch === '/' && nx === '/') { let j = i; while (j < n && code[j] !== '\n') j++; blank(i, j); i = j; continue }
    if (ch === '/' && nx === '*') { let j = i + 2; while (j < n && !(code[j] === '*' && code[j + 1] === '/')) j++; j = Math.min(n, j + 2); blank(i, j); i = j; continue }
    if (ch === '"' || ch === "'" || ch === '`') { const q = ch; let j = i + 1; while (j < n) { if (code[j] === '\\') { j += 2; continue } if (code[j] === q) break; j++ } blank(i + 1, j); i = j + 1; continue }
    i++
  }
  return out.join('')
}

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(full)
  }
  return acc
}

// R1: voucher 이름 식별자에 대입(`=`, `==`/`=>` 제외) — voucher 여부를 코드로 세팅.
const R1 = /\b[A-Za-z_$][\w$]*voucher[\w$]*\s*=(?![=>])/i
// R2: voucher 흐름 라우팅 리터럴 (group_buy_status 로 이 경로를 고르면 버그).
const R2 = /\/(group-buy|vouchers)\b/

const files = walk(SRC, [])
const violations = []

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8')
  if (!raw.includes('group_buy_status')) continue
  const rawLines = raw.split('\n')
  const strippedLines = stripNoise(raw).split('\n')
  for (let i = 0; i < strippedLines.length; i++) {
    const s = strippedLines[i]
    if (!s.includes('group_buy_status')) continue // 코드 참조만 (SQL/주석 제외)
    const rawLine = rawLines[i]
    const near = `${rawLines[i - 1] || ''}\n${rawLine}\n${rawLines[i + 1] || ''}`
    if (/groupbuy-classify-ok/i.test(near)) continue // 명시 예외
    let rule = null
    // R1 은 코드(stripped)에서, R2 의 라우팅 리터럴은 문자열 안에 있으므로 raw 에서 검사.
    if (R1.test(s)) rule = 'R1: voucher 판별 boolean 을 group_buy_status 로 세팅'
    else if (R2.test(rawLine)) rule = 'R2: group_buy_status 로 /group-buy·/vouchers 라우팅'
    if (rule) violations.push({ file: path.relative(ROOT, file), line: i + 1, rule, text: rawLine.trim().slice(0, 100) })
  }
}

if (violations.length === 0) {
  console.log('✅ 종류판별 검사 — group_buy_status 로 교환권/상품 종류 판별·라우팅 없음')
  process.exit(0)
}

console.log(`${STRICT ? '❌' : '⚠️'}  group_buy_status 로 상품 "종류"를 판별/라우팅 ${violations.length}건 (모든 상품 기본 'active' 라 오분류):`)
for (const v of violations) console.log(`   - ${v.file}:${v.line}  [${v.rule}]\n       ${v.text}`)
console.log('')
console.log('   fix: 종류 판별은 SSOT 만 사용 → deal_only===1 (교환권) || isVoucherCategory(category) (오프라인 공구).')
console.log('        (src/shared/constants/voucher-categories.ts · src/shared/order-type.ts)')
console.log('   의도적 예외면 해당 줄/근처에 `groupbuy-classify-ok` 주석.')
console.log('   배경: 쇼핑 상품 핀이 /group-buy(교환권)로 오라우팅된 사고 (2026-06-18).')

process.exit(STRICT ? 1 : 0)
