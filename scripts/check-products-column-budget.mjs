#!/usr/bin/env node
/**
 * 🛡️ 2026-06-10: products 컬럼 예산제 — god-table 증식 차단 (교환권 500 사고 구조적 후속).
 *
 * 사고: products 컬럼이 90+ 까지 무감시 증식 → SELECT p.* 가 D1 결과셋 한도(100) 초과로 전사 500.
 * star-select 는 별도 CI 가 차단하지만, 테이블 자체가 계속 넓어지면 row 읽기 비용·스키마 혼란·
 * NULL 스프롤이 누적된다. 이 검사는 "새 products 컬럼"을 의식적 결정으로 강제한다.
 *
 * 룰: 새 ALTER TABLE products ADD COLUMN 은 기본 차단.
 *   - 도매/브랜드/전시성 메타 → `product_supply_meta` 사이드테이블 사용 (src/worker/utils/product-supply-meta.ts)
 *   - 정말 products 본체가 맞으면 scripts/products-column-baseline.json 에 컬럼명 추가 + PR 에 사유.
 * Bypass: 커밋 메시지 [SKIP_COLUMN_BUDGET]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const baseline = new Set(JSON.parse(readFileSync('scripts/products-column-baseline.json', 'utf-8')))
const found = new Map() // col -> file:line

function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { if (!/node_modules|dist|\.git/.test(p)) scan(p); continue }
    if (!/\.(ts|sql)$/.test(name)) continue
    const text = readFileSync(p, 'utf-8')
    let m
    const re = /ALTER TABLE products ADD COLUMN ([a-zA-Z_0-9]+)/g
    while ((m = re.exec(text))) {
      if (!baseline.has(m[1]) && !found.has(m[1])) {
        const line = text.slice(0, m.index).split('\n').length
        found.set(m[1], `${p}:${line}`)
      }
    }
  }
}
scan('src')
try { scan('migrations') } catch { /* 없으면 skip */ }

if (found.size > 0) {
  console.error('❌ products 새 컬럼 감지 — 예산제 위반 (god-table 증식 차단):')
  for (const [col, loc] of found) console.error(`   ${col}  (${loc})`)
  console.error('')
  console.error('→ 도매/브랜드/전시성 메타면 product_supply_meta 사이드테이블을 사용하세요.')
  console.error('→ 정말 products 본체가 맞으면 scripts/products-column-baseline.json 에 추가 + PR 사유 명시.')
  process.exit(1)
}
console.log(`✅ products 컬럼 예산 준수 (baseline ${baseline.size}개, 신규 0)`)
