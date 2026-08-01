#!/usr/bin/env node
/**
 * 🧾 **예산 루프가 자기 기록을 쓸 몫을 남기는가** — 래칫 (2026-07-30 신설).
 *
 * ## 왜 (하루에 세 번 만난 실패 양식)
 * 수집/보강 레인은 서브리퀘스트 예산을 들고 루프를 돈다. 그런데 루프 **뒤에** 반드시 D1 쓰기가 있다:
 * 커서 전진 · 학습 상한 갱신 · **그 레인의 자기 스탬프**. D1 도 서브리퀘스트라 예산을 다 쓰고 나면
 * 그 쓰기들이 던지고, 호출부는 전부 `.catch(() => null)` 이라 **조용히 사라진다.**
 * 하필 마지막이 자기 스탬프여서 — **레인이 돌았는데 "안 돈 것"처럼 보인다.**
 *
 * 실측(2026-07-29~30):
 *   · 카카오 전화 스윕  : 루프가 2만 남기는데 뒤에 5회 → `last_run` 이 13:01 에 17시간 고착
 *   · 통신판매 수집     : `budget.left > 0` 까지 소진 → 하트비트는 남았는데(완주) 스탬프는 전날 것
 *     ⇒ 우리가 기다리던 `diag.error` 원문이 매 회차 유실됐다(원인 규명이 하루 늦어짐)
 *
 * ## 규칙
 * 루프 조건에 `budget.left > 0`(= 예약 0)을 쓰지 않는다. 남길 몫을 **명시**하라:
 *   `budget.left > RESERVE` · `budget.left > services.length + 1` · `budget.left <= RESERVE → break`
 *
 * ## 한계 (과신 금지)
 * - **형태만 본다.** 예약 숫자가 실제 뒤따르는 쓰기 수보다 작아도 이 검사는 통과한다
 *   (그 정합은 레인별 단위 시험이 맡는다 — 예: `ads-sweep-bookkeeping.test.ts`).
 * - **플랫폼 한도를 실제로 친 회차**는 예약으로도 못 살린다(그 뒤 모든 서브리퀘스트가 던진다).
 * - 루프 뒤에 D1 쓰기가 정말 없다면 예약이 불필요하다 → 그 줄에 `zero-reserve-ok` 주석.
 *
 * 래칫: `scripts/budget-bookkeeping-baseline.json` 에 등재된 기존 위반은 통과(줄이는 건 자유).
 * 새 위반은 차단. 정리 후 `--rebaseline` 로 동결값 갱신.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIRS = ['src/features/marketing/api', 'src/features/supply/api', 'src/worker-ads']
const BASELINE = 'scripts/budget-bookkeeping-baseline.json'
const STRICT = process.env.STRICT_BUDGET_BOOKKEEPING === '1' || process.argv.includes('-s')
const REBASE = process.argv.includes('--rebaseline')

/** 루프 헤더에서만 잡는다 — 스냅샷 필드(`deadline_hit: ... && budget.left > 0`)는 루프가 아니다. */
const LOOP_ZERO_RESERVE = /\b(for|while)\s*\([^)]*\bbudget\.left\s*>\s*0\b/

const files = []
for (const d of DIRS) {
  if (!existsSync(d)) continue
  for (const f of readdirSync(d)) if (f.endsWith('.ts') && !f.endsWith('.d.ts')) files.push(join(d, f))
}

// 🔍 측정 대상이 0이면 **통과가 아니라 실패**다 — 경로가 낡으면 위반도 0이라 초록이 뜨는데
//   그 초록은 아무것도 보장하지 않는다(이 레포가 한 달 넘게 눈먼 가드를 세 개 안고 있었다).
if (files.length === 0) {
  console.error('❌ 예산 부기 검사 — 검사 대상 0개(경로가 낡았다). 통과가 아니라 실패로 본다.')
  process.exit(1)
}

const found = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    if (!LOOP_ZERO_RESERVE.test(line)) return
    if (line.includes('zero-reserve-ok')) return
    // 루프 뒤에 D1 접근이 없으면 예약이 필요 없다.
    const after = lines.slice(i + 1).join('\n')
    if (!/DB\.(prepare|batch)\(/.test(after)) return
    found.push(`${f}:${i + 1}`)
  })
}

if (REBASE) {
  writeFileSync(BASELINE, JSON.stringify({ known: found.sort() }, null, 2) + '\n')
  console.log(`✅ 예산 부기 — 베이스라인 갱신(${found.length}건)`)
  process.exit(0)
}

let known = []
try { known = JSON.parse(readFileSync(BASELINE, 'utf8')).known || [] } catch { known = [] }
const fresh = found.filter(x => !known.includes(x))

if (!fresh.length) {
  console.log(`✅ 예산 부기 검사 — 신규 위반 0 (동결 ${known.length}건)`)
  process.exit(0)
}

console.log('⚠️  예산 루프가 자기 기록을 쓸 몫을 안 남긴다 — 그 레인은 "돌았는데 안 돈 것"처럼 보인다:')
for (const x of fresh) console.log(`   - ${x}`)
console.log('')
console.log('   고치는 법: 루프 조건을 `budget.left > RESERVE` 로(RESERVE = 루프 뒤 D1 접근 수).')
console.log('   루프 뒤에 쓰기가 정말 없으면 그 줄에 `zero-reserve-ok` 주석.')
console.log('   기존 위반을 정리했으면 → node scripts/check-budget-bookkeeping.mjs --rebaseline')
if (STRICT) { console.log('\n❌ STRICT_BUDGET_BOOKKEEPING — 차단.'); process.exit(1) }
