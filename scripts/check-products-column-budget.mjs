#!/usr/bin/env node
/**
 * 🛡️ 2026-06-10: 컬럼 예산제 — god-table 증식 차단 (교환권 500 사고 구조적 후속).
 *
 * 사고: products 컬럼이 90+ 까지 무감시 증식 → SELECT p.* 가 D1 결과셋 한도(100) 초과로 전사 500.
 * star-select 는 별도 CI 가 차단하지만, 테이블 자체가 계속 넓어지면 row 읽기 비용·스키마 혼란·
 * NULL 스프롤이 누적된다. 이 검사는 "새 컬럼"을 의식적 결정으로 강제한다.
 *
 * 🔐 2026-06-15: sellers 도 동일 위험(배포 로그상 100컬럼 = D1 한도 도달)이라 멀티테이블로 확장.
 *   products 와 동일 규칙을 sellers 에도 적용 — 한 컬럼만 더 늘면 SELECT s.* JOIN 이 500.
 *
 * 룰: 새 ALTER TABLE <table> ADD COLUMN 은 기본 차단.
 *   - 도매/브랜드/전시성·부가 메타 → 사이드테이블(K-V) 사용
 *   - 정말 본체 컬럼이 맞으면 baseline JSON 에 컬럼명 추가 + PR 에 사유.
 * Bypass: 커밋 메시지 [SKIP_COLUMN_BUDGET]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** 감시 대상 테이블 + baseline + 권장 대안(에러 메시지용). */
const TABLES = [
  {
    table: 'products',
    baselineFile: 'scripts/products-column-baseline.json',
    sideHint: '도매/브랜드/전시성 메타면 product_supply_meta 사이드테이블(src/worker/utils/product-supply-meta.ts)을 사용하세요.',
  },
  {
    table: 'sellers',
    baselineFile: 'scripts/sellers-column-baseline.json',
    sideHint: '부가 메타면 별도 사이드테이블(K-V)로 빼세요 — sellers 는 이미 D1 결과셋 한도(100)에 도달했습니다.',
  },
]

/** 모든 .ts/.sql 파일을 한 번만 읽어 캐시(테이블마다 재스캔 방지). */
const files = []
function collect(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { if (!/node_modules|dist|\.git/.test(p)) collect(p); continue }
    if (!/\.(ts|sql)$/.test(name)) continue
    files.push(p)
  }
}
collect('src')
try { collect('migrations') } catch { /* 없으면 skip */ }
const fileTexts = files.map((p) => [p, readFileSync(p, 'utf-8')])

let failed = false
for (const { table, baselineFile, sideHint } of TABLES) {
  const baseline = new Set(JSON.parse(readFileSync(baselineFile, 'utf-8')))
  const found = new Map() // col -> file:line
  const re = new RegExp(`ALTER TABLE ${table} ADD COLUMN ([a-zA-Z_0-9]+)`, 'g')
  for (const [p, text] of fileTexts) {
    let m
    re.lastIndex = 0
    while ((m = re.exec(text))) {
      if (!baseline.has(m[1]) && !found.has(m[1])) {
        const line = text.slice(0, m.index).split('\n').length
        found.set(m[1], `${p}:${line}`)
      }
    }
  }

  if (found.size > 0) {
    failed = true
    console.error(`❌ ${table} 새 컬럼 감지 — 예산제 위반 (god-table 증식 차단):`)
    for (const [col, loc] of found) console.error(`   ${col}  (${loc})`)
    console.error(`→ ${sideHint}`)
    console.error(`→ 정말 ${table} 본체 컬럼이 맞으면 ${baselineFile} 에 추가 + PR 사유 명시.`)
    console.error('')
  } else {
    console.log(`✅ ${table} 컬럼 예산 준수 (baseline ${baseline.size}개, 신규 0)`)
  }
}

if (failed) process.exit(1)
