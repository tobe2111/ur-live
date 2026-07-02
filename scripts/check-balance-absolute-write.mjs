#!/usr/bin/env node
/**
 * 🛡️ 2026-07-01: 잔액 컬럼 "절대값 write"(비원자 read-modify-write) 방지.
 *
 * 배경(도매 3표면 감사): 미수금 상환이 `SELECT outstanding` → JS 계산 → `UPDATE SET
 *   outstanding_balance = ?`(절대값 write) 였음. 동시 상환 2건이 같은 prevOut 을 읽어 하나가
 *   덮어써 미수금 과대계상(플랫폼 채권 부풀림·판매사 손해) 가능(CLAUDE.md 머니 룰 #1 위배).
 *
 * 규칙: `*balance*` 컬럼은 절대값(`SET x = ?`)으로 쓰지 말 것. 다음 중 하나여야 안전:
 *   ① 산술 증감: `SET x = x ± ?` (또는 MAX/MIN/COALESCE(x,..) 로 x 참조) — 원자적.
 *   ② CAS: `SET x = ? ... WHERE ... x = ?` (같은 컬럼을 WHERE 로 선점) — 원자적.
 *   판정: 한 UPDATE 문 안에서 그 balance 컬럼이 2회 이상 등장하면 안전(RHS 참조 또는 WHERE CAS).
 *   1회(SET 뿐)면 순수 절대값 write → 위반.
 *
 * 예외: `*_after` 스냅샷 컬럼(balance_after 등 = 거래 시점 잔액 기록, 절대값이 정상),
 *   테스트, `balance-write-ok` 주석.
 *
 * 사용: node scripts/check-balance-absolute-write.mjs [-s]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p)
  }
  return acc
}

// 파일에서 SQL 문자열 리터럴(backtick/'/") 중 UPDATE...SET 포함분 추출 → {sql, line}
function extractUpdateLiterals(src) {
  const out = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '`' || ch === "'" || ch === '"') {
      let j = i + 1
      while (j < src.length && src[j] !== ch) { if (src[j] === '\\') j++; j++ }
      const body = src.slice(i + 1, j)
      if (/\bUPDATE\b/i.test(body) && /\bSET\b/i.test(body)) {
        out.push({ sql: body, line: src.slice(0, i).split('\n').length })
      }
      i = j + 1
    } else i++
  }
  return out
}

const BAL_SET = /\b(\w*balance\w*)\s*=\s*\?/gi
const violations = []
for (const f of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, f)
  if (/\.test\.|(^|\/)tests\//.test(rel)) continue
  const src = fs.readFileSync(f, 'utf8')
  if (!/balance/i.test(src)) continue
  for (const { sql, line } of extractUpdateLiterals(src)) {
    BAL_SET.lastIndex = 0
    let m
    while ((m = BAL_SET.exec(sql))) {
      const col = m[1]
      if (/_after$/i.test(col)) continue // 스냅샷 컬럼(정상 절대값)
      // 같은 SQL 문에서 col 등장 횟수 — 2회+ 면 RHS 산술/WHERE CAS(안전), 1회면 순수 절대값 write.
      const occ = (sql.match(new RegExp(`\\b${col}\\b`, 'gi')) || []).length
      if (occ <= 1) violations.push({ file: rel, line, col, sql: sql.replace(/\s+/g, ' ').trim().slice(0, 120) })
    }
  }
}
// `balance-write-ok` 주석 예외: 해당 파일에 마커 있으면 그 파일 위반 제외(간이).
const filtered = violations.filter(v => {
  const txt = fs.readFileSync(path.join(ROOT, v.file), 'utf8')
  return !txt.includes('balance-write-ok')
})

if (!filtered.length) {
  console.log('✅ 잔액 컬럼 절대값 write 없음 (원자 증감/CAS 로만 갱신).')
  process.exit(0)
}
console.log(`\n${STRICT ? '❌' : '⚠️ '} 잔액 절대값 write ${filtered.length}건 — 원자 증감(x=x±?) 또는 CAS(WHERE x=?) 로 바꾸세요:`)
for (const v of filtered) console.log(`   ${v.file}:${v.line} [${v.col}]\n      ${v.sql}`)
console.log('\n   (스냅샷 *_after·테스트·`balance-write-ok` 주석은 예외)')
process.exit(STRICT ? 1 : 0)
