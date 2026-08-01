#!/usr/bin/env node
/**
 * 💓 cron 하트비트 커버리지 가드 (2026-07-28 신설)
 *
 * 지키는 불변식 — **모든 스케줄 작업은 실행 사실을 남긴다.**
 *
 * 배경: `safeCron` 은 작업이 **예외를 던질 때만** 기록했다(cron_failures + 어드민 벨 + Discord).
 *   그런데 실제로 아픈 정지는 예외가 없다:
 *     ① cron 미발화 ② 게이트 OFF 로 조기 return ③ 내부 `.catch(() => null)` 로 전부 삼킴
 *   2026-07-28 유어애즈 자동 정비가 ③ 이었고, 예외가 없어 **07-26 부터 멈춘 걸 아무도 몰랐다**(#793).
 *   당시 cron 70개 중 실행 기록을 남기는 건 3개뿐이었다.
 *
 * 그래서 safeCron 에 성공·실패 무관 하트비트를 넣었다. 이 가드는 그 커버리지가 새는 것을 막는다:
 *   - 새 cron 을 safeCron 없이 waitUntil 로 직접 걸면 → 그 작업만 조용히 관측 밖으로 나간다
 *   - safeCron 에서 하트비트 호출이 빠지면 → 68개 전부가 한 번에 관측 밖으로 나간다
 *
 * 예외가 정말 필요하면 해당 줄에 `cron-heartbeat-ok` 주석.
 */
import { readFileSync, existsSync } from 'node:fs'

const SCHEDULED = 'src/worker/scheduled.ts'
const HEARTBEAT = 'src/worker/utils/cron-heartbeat.ts'
const ALLOW_MARK = 'cron-heartbeat-ok'

let fail = 0
const err = (m) => { console.error(`   ❌ ${m}`); fail++ }

if (!existsSync(SCHEDULED)) {
  console.log('⏭️  scheduled.ts 없음 — 검사 생략')
  process.exit(0)
}
const src = readFileSync(SCHEDULED, 'utf8')

// ── R1. 하트비트 유틸이 존재하고 safeCron 이 실제로 호출할 것 ──────────────
if (!existsSync(HEARTBEAT)) {
  err(`${HEARTBEAT} 가 없다 — cron 실행 기록이 사라진다.`)
} else if (!/recordCronBeat\s*\(/.test(src)) {
  err(`${SCHEDULED} 의 safeCron 이 recordCronBeat 을 호출하지 않는다. `
    + `예외가 안 나는 정지(미발화/게이트 OFF/내부 .catch)가 전부 무음이 된다.`)
}

// ── R2. 모든 waitUntil 스케줄 작업이 safeCron 을 거칠 것 ────────────────────
//   safeCron 이 유일한 기록 지점이므로, 우회하면 그 작업만 관측 밖으로 빠진다.
const lines = src.split('\n')

// 🛡️ 2026-07-29: **측정 0 = 통과가 아니라 실패.** scheduled.ts 에서 safeCron 등록을 하나도 못 찾으면
//   "우회 0건" 이 당연해지고 그 초록은 아무것도 보장하지 않는다(파일 구조가 바뀌면 조용히 그렇게 된다).
const registeredCount = lines.filter((l) => /safeCron\(\s*'/.test(l.replace(/\/\/.*$/, ''))).length
if (registeredCount === 0) {
  console.error(`❌ ${SCHEDULED} 에서 safeCron 등록을 하나도 못 찾았다 — 추출이 깨졌다(통과 아님).`)
  process.exit(1)
}
const bypass = []
lines.forEach((l, i) => {
  if (!l.includes('ctx.waitUntil(')) return
  if (l.includes('safeCron(') || l.includes(ALLOW_MARK)) return
  bypass.push(`${SCHEDULED}:${i + 1}  ${l.trim().slice(0, 100)}`)
})
if (bypass.length) {
  err(`safeCron 을 거치지 않는 스케줄 작업 ${bypass.length}건 — 실행 기록이 안 남는다:`)
  for (const b of bypass) console.error(`      ${b}`)
}

if (fail) {
  console.error(`
  🔧 고치는 법:
     - 새 cron 은 반드시 \`ctx.waitUntil(safeCron('이름', () => 작업(env)))\` 형태로 등록할 것.
     - 의도적 예외라면 그 줄에 '${ALLOW_MARK}' 주석(관측 밖으로 나가는 이유를 함께 적을 것).
     - 확인: 어드민 GET /api/admin/cron-heartbeats (오래된 순 = 멈췄을 가능성 높은 순)
`)
  process.exit(1)
}
const total = lines.filter(l => l.includes('ctx.waitUntil(safeCron(')).length
console.log(`✅ cron 하트비트 커버리지 — 스케줄 작업 ${total}개 전부 safeCron 경유(실행 기록 남김)`)
