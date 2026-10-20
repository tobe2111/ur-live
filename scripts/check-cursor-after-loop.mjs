#!/usr/bin/env node
/**
 * 🩸 **커서 저장이 루프 뒤에 있는데 루프에 시간 상한이 없다** — 조용한 "전진 0" 차단.
 *
 * ## 이 레포에서 실제로 두 번 났다
 * ```
 *   commerce (2026-08-02)  루프가 CPU 한도로 죽음 → 뒤의 커서 저장 미도달 → 같은 페이지 반복 → 전진 0
 *   quality  (2026-08-03)  상한이 행 수(8,000)뿐 → ok=false ms=3649 CPU → 커서 미저장 → 전진 0
 * ```
 * 둘 다 **에러가 안 보였다.** 하트비트는 빨간불이지만 "느린가 보다"로 읽히고, 저장이 0 인 이유가
 * 커서 미전진이라는 것은 코드를 열어야 안다. `ads-cpu-deadline.test.ts` 가 이 실패 모양을 문서로
 * 확정해 뒀는데도 **다음 레인에서 그대로 재발**했다 — 문서로는 못 막는다는 증거다.
 *
 * ## 무엇을 보는가
 * 커서를 `platform_settings` 에 저장하는 지점 **앞쪽 창(120줄)** 에 루프 헤더가 있는데,
 * 그 창 안에 **시간 상한**(`Date.now() - t0`·`deadline`·`shouldStop`·`elapsed`)이 하나도 없으면 신고한다.
 *
 * ## ⚠️ 못 보는 것 (과신 금지)
 * - **함수 경계를 모른다.** 120줄 창 휴리스틱이라 남의 함수 루프를 같은 창으로 볼 수 있다.
 * - 루프가 **CPU 를 실제로 많이 쓰는지**는 판단하지 않는다 — fetch 대기가 대부분인 루프는 안전한데도 잡힌다.
 * - 그래서 **래칫**이다: 기존 목록은 통과시키고 **새로 생기는 것만** 막는다. 줄이는 건 언제나 환영.
 *
 * 정리 후 갱신: `node scripts/check-cursor-after-loop.mjs --rebaseline`
 * 예외: 해당 줄 근처에 `cursor-after-loop-ok` 주석.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')
const REBASE = process.argv.includes('--rebaseline')
const BASELINE = path.join(ROOT, 'scripts/cursor-after-loop-baseline.json')

const DIRS = ['src/features/marketing/api', 'src/worker-ads']
const WINDOW = 120

/** 커서 저장으로 보이는 줄 — `platform_settings` 에 `*CURSOR*` / `*_cursor` 키를 쓴다. */
const PERSIST = /INSERT OR REPLACE INTO platform_settings/i
const CURSOR_KEYISH = /CURSOR|_cursor|cursorKey/i
const LOOP = /\b(while|for)\s*\(/
// ⚠️ 마감선이 **헬퍼에 감싸여** 있는 경우도 알아봐야 한다(`outOfBudget(budget)` 안에 `budget.deadline` 비교가 있다).
//   못 알아보면 **이미 마감선을 가진 레인**을 신고해, 사람들이 중복 검사를 넣게 만든다 — 오경보는 가드를 죽인다.
//   (이 누락을 `ads-cursor-after-loop-guard.test.ts` 가 작성 즉시 잡았다.)
const TIME_BOUND = /Date\.now\(\)\s*-\s*\w+|deadline|shouldStop|elapsed|outOfBudget|AbortSignal\.timeout/i

function scanFile(rel) {
  const abs = path.join(ROOT, rel)
  const lines = fs.readFileSync(abs, 'utf8').split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (!PERSIST.test(lines[i])) continue
    // 키가 커서인지 — 같은 줄이나 다음 줄의 `.bind(...)` 에서 본다.
    const near = `${lines[i]}\n${lines[i + 1] || ''}`
    if (!CURSOR_KEYISH.test(near)) continue
    const start = Math.max(0, i - WINDOW)
    const win = lines.slice(start, i)
    const loopAt = win.findIndex(l => LOOP.test(l))
    if (loopAt === -1) continue                       // 루프 뒤가 아니다 — 무관
    const body = win.slice(loopAt).join('\n')
    if (TIME_BOUND.test(body)) continue               // 시간 상한이 있다 — 통과
    if (/cursor-after-loop-ok/.test(body) || /cursor-after-loop-ok/.test(near)) continue
    // 키 이름을 뽑아 안정적인 식별자로 쓴다(줄 번호는 드리프트한다).
    const key = (near.match(/([A-Z0-9_]*CURSOR[A-Z0-9_]*)/) || near.match(/'([a-z0-9_]*_cursor[a-z0-9_]*)'/) || [, 'cursor'])[1]
    hits.push({ id: `${rel}::${key}`, line: i + 1 })
  }
  return hits
}

const files = DIRS.flatMap(d => {
  const abs = path.join(ROOT, d)
  if (!fs.existsSync(abs)) return []
  return fs.readdirSync(abs).filter(f => f.endsWith('.ts')).map(f => path.join(d, f))
})

// 🛡️ 측정 0 = 실패 — 경로가 낡아 조용히 비는 것을 통과로 다루지 않는다(이 레포의 가드 규율).
if (files.length < 10) {
  console.error(`❌ cursor-after-loop: 검사 대상이 ${files.length}개뿐이다 — 경로가 낡았나(${DIRS.join(', ')})`)
  process.exit(1)
}

const found = files.flatMap(scanFile)
const ids = [...new Set(found.map(h => h.id))].sort()

if (REBASE) {
  fs.writeFileSync(BASELINE, `${JSON.stringify({ known: ids }, null, 2)}\n`)
  console.log(`✅ cursor-after-loop: 기준선 갱신 — ${ids.length}건`)
  process.exit(0)
}

const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')).known || [] : []
const added = ids.filter(x => !base.includes(x))
const fixed = base.filter(x => !ids.includes(x))

if (fixed.length) console.log(`ℹ️  cursor-after-loop: ${fixed.length}건 해소됨 — \`--rebaseline\` 로 기준선을 낮춰 주세요\n   ${fixed.join('\n   ')}`)

if (!added.length) {
  console.log(`✅ cursor-after-loop: 신규 0건 (기준선 ${base.length}건)`)
  process.exit(0)
}
console.log(`⚠️  cursor-after-loop: 시간 상한 없는 루프 **뒤**에서 커서를 저장하는 신규 지점 ${added.length}건`)
for (const id of added) console.log(`   ${id}  (line ${found.find(h => h.id === id)?.line})`)
console.log('   → 루프가 CPU/시간 한도로 죽으면 **커서 저장에 도달하지 못해** 다음 회차가 같은 지점을 또 훑는다(전진 0).')
console.log('   → 루프 조건에 벽시계 마감선을 넣고, 마감선 중단은 `done` 을 **false** 로 남길 것(true 면 커서가 리셋된다).')
process.exit(STRICT ? 1 : 0)
