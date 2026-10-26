#!/usr/bin/env node
/**
 * 🧮 D1 바인딩 한도 — 손으로 만든 `IN (?,?,…)` 목록 래칫
 *
 * 왜 있나(2026-10-26 실사고 둘): `stampExported` 가 청크당 **id 100개 + 도장 1 = 101 바인딩**을
 * 보냈다. 라이브 D1 의 한도는 **정확히 100**(실측 99 OK · 100 OK · 101 ERR 7500
 * `too many SQL variables`)이고, 그 실패를 `.catch(() => null)` 이 삼켜 **에러도 로그도 없이**
 * 도장이 한 건도 안 찍혔다. 그리고 같은 날 `/api/fcfs/active` 는 **이미 터져 있었다** —
 * `fcfs_enabled='1'` 상품이 라이브에 **395개**라 두 쿼리가 모두 한도에서 터지고 `.catch` 가
 * 빈 배열로 삼켜 **`success:true, data:[]`** 를 돌려줬다(지도 선착순 배지·상권관 체험단 목록이
 * 통째로 비어 있었고 **HTTP 200 이라 아무도 몰랐다**).
 *
 * 🩸 그때 시험이 통과한 이유: 그 가드는 *진짜 SQLite*(`node:sqlite`)로 동작 판정을 하는데
 *   **그쪽 한도는 32,766** 이다. **진짜 DB 로 쟀다는 것이 D1 과 같은 제약이라는 뜻은 아니다.**
 *
 * 이 가드가 보는 것: 소스에서 `X.map(() => '?')` 류로 **플레이스홀더 목록을 손으로 조립**하는
 * 자리의 **파일별 개수**를 `scripts/d1-bind-baseline.json` 에 동결한다.
 *   - 늘면 실패 → 새 IN-목록은 `chunkForBinds`(`src/shared/db/d1-binds.ts`) 를 거쳐라.
 *   - `chunkForBinds` 를 거치는 자리는 **세지 않는다** → SSOT 로 옮기면 카운트가 줄어든다.
 *   - 줄면 통과(그리고 `--rebaseline` 로 조이라고 알린다).
 *
 * ⚠️ 이 가드가 **못 보는 것**: 배열 길이가 실제로 100을 넘는지(정적으로 알 수 없다 — 요청 본문·
 *   페이지 크기·cron 배치·DB 행 수에 달렸다) · SQL 길이 한도 · `prepare` 를 안 거치는 경로.
 *   그래서 "위험/안전" 을 판정하지 않고 **표면 자체를 동결**한다. 그 자리가 실제로 100을 넘을 수
 *   있는지는 **사람이 그 자리를 읽어서** 판정한다(지금 동결분 171자리는 그 감사가 범위 밖이다 —
 *   `docs/handoff/2026-10-26-d1-bind-limit-stamp.md` §6).
 *
 * 우회: 그 줄에 `d1-bind-ok` 주석(이유와 함께) · 조이기: `node scripts/check-d1-bind-limit.mjs --rebaseline`
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { countBindSites, totalOf, diffAgainst } from './d1-bind-scan.mjs'

const BASE = 'scripts/d1-bind-baseline.json'
const files = execSync("git ls-files 'src/*.ts' 'src/**/*.ts'", { encoding: 'utf-8' })
  .split('\n').filter((f) => f && !f.includes('/tests/'))

// 🕳️ 경로가 낡아 조용히 비는 것은 **통과가 아니라 실패**다(이 레포가 반복해 당한 헛도는 가드).
if (files.length < 500) {
  console.error(`❌ 검사 대상 파일 ${files.length}개 — 경로가 낡아 조용히 비었다.`)
  process.exit(1)
}
const counts = countBindSites(files, (f) => readFileSync(f, 'utf-8'))
const total = totalOf(counts)
if (total === 0) {
  console.error('❌ 플레이스홀더 자리 0건 — 패턴이 낡았다(이 레포엔 분명히 있다). 헛도는 가드 차단.')
  process.exit(1)
}

if (process.argv.includes('--rebaseline')) {
  writeFileSync(BASE, JSON.stringify({ _total: total, counts }, null, 2) + '\n')
  console.log(`✅ 재기준: ${Object.keys(counts).length}파일 · ${total}자리`)
  process.exit(0)
}
if (!existsSync(BASE)) {
  console.error(`❌ ${BASE} 없음 — \`--rebaseline\` 로 먼저 동결할 것.`)
  process.exit(1)
}
const base = JSON.parse(readFileSync(BASE, 'utf-8'))
const { grew, shrank } = diffAgainst(counts, base.counts || {})
if (grew.length) {
  console.error('❌ 손으로 만든 `IN (?,?,…)` 자리가 늘었다 — D1 바인딩 한도는 **100**이다.')
  console.error('   새 IN-목록은 `chunkForBinds(items, extraBinds)`(src/shared/db/d1-binds.ts) 를 거쳐라.')
  console.error('   같은 문장에 바인딩이 하나 더 붙는 날 조용히 넘치는 것이 2026-10-26 사고의 모양이다.')
  for (const g of grew) console.error(`   - ${g.file}: ${g.from} → ${g.to}`)
  console.error('   의도한 추가면 그 줄에 `d1-bind-ok` 주석(이유와 함께) 또는 `--rebaseline`.')
  process.exit(1)
}
console.log(`✅ D1 바인딩 표면 ${total}자리 (동결 ${base._total}) · 파일 ${Object.keys(counts).length}개`)
if (shrank.length) {
  console.log(`   ↓ 줄어든 파일 ${shrank.length}개 — \`--rebaseline\` 로 조일 것:`)
  for (const s of shrank.slice(0, 8)) console.log(`     - ${s.file}: ${s.from} → ${s.to}`)
}
