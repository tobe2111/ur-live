#!/usr/bin/env node
/**
 * 🛡️ 2026-07-01: 도매 공급가 "모델 드리프트" 방지.
 *
 * 배경(도매 3표면 감사): 상품 엑셀 내보내기가 **폐기된** `distributorPriceFromRetail`
 *   (판매가×(1−보장마진)·등급차등)을 써, 라이브 결제가(`resolveDistributorPrice` cost-plus·
 *   전등급동일, 2026-06-17 대표확정)와 **전혀 다른 A/B/C 가격**을 제안문서로 냈음(상거래 분쟁).
 *   같은 "판매사 공급가"를 두 함수로 계산하니 시간이 지나며 어긋남 = 모델 드리프트.
 *
 * 규칙: 도매 공급가는 **`resolveDistributorPrice`(SSOT) 하나로만** 계산한다.
 *   `@deprecated` 함수 `distributorPriceFromRetail` / `distributorPrice` 직접 호출 금지
 *   (정의 파일 `distributor-pricing.ts` + 테스트 + `deprecated-pricing-ok` 주석 제외).
 *
 * 사용: node scripts/check-deprecated-pricing.mjs [-s]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')
const CALL = /\b(distributorPriceFromRetail|distributorPrice)\s*\(/

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p)
  }
  return acc
}

const violations = []
for (const f of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, f)
  if (rel.endsWith('lib/distributor-pricing.ts')) continue // 정의 파일
  if (/\.test\.|(^|\/)tests\//.test(rel)) continue         // 테스트
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    const m = CALL.exec(ln)
    if (!m) continue
    // 주석 라인 스킵(호출 앞에 // 있거나 주석/JSDoc 라인)
    const trimmed = ln.trimStart()
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
    const before = ln.slice(0, m.index)
    if (before.includes('//')) continue
    if (/deprecated-pricing-ok/.test(ln + (lines[i - 1] || ''))) continue
    violations.push({ file: rel, line: i + 1, code: ln.trim() })
  }
}

if (!violations.length) {
  console.log('✅ 폐기 가격함수 직접 호출 없음 (도매 공급가 = resolveDistributorPrice SSOT).')
  process.exit(0)
}
console.log(`\n${STRICT ? '❌' : '⚠️ '} 폐기 가격함수 직접 호출 ${violations.length}건 — resolveDistributorPrice 로 통일하세요:`)
for (const v of violations) console.log(`   ${v.file}:${v.line}\n      ${v.code}`)
console.log('\n   (정의부 distributor-pricing.ts·테스트·`deprecated-pricing-ok` 주석은 예외)')
process.exit(STRICT ? 1 : 0)
