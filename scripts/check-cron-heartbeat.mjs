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
/**
 * 🌆 2026-08-25: 디스패치가 **한 파일에만 있다는 전제가 깨졌다.** 일간 블록 16개를
 *   `cron/daily-lane.ts` 로 분리(인보케이션 쪼개기)했더니 이 가드가 보는 작업 수가
 *   **41 → 25 로 줄었고, 그래도 초록이었다.** 즉 그 16개가 소리 없이 검사 밖으로 나갔다 —
 *   이 레포가 반복해 만난 "가드가 지키는 척만 한다" 그 자리다.
 *   ⇒ **디스패치 파일 목록**으로 보고, 하한도 함께 강제한다(아래 MIN_REGISTERED).
 */
const DISPATCH_FILES = [SCHEDULED, 'src/worker/cron/daily-lane.ts']
/** 등록 수가 이보다 적으면 "구조가 또 바뀌었다"는 뜻 — 통과가 아니라 실패다. */
const MIN_REGISTERED = 35
const HEARTBEAT = 'src/worker/utils/cron-heartbeat.ts'
const ALLOW_MARK = 'cron-heartbeat-ok'

let fail = 0
const err = (m) => { console.error(`   ❌ ${m}`); fail++ }

if (!existsSync(SCHEDULED)) {
  console.log('⏭️  scheduled.ts 없음 — 검사 생략')
  process.exit(0)
}
const src = readFileSync(SCHEDULED, 'utf8')
/** 파일별 원문 — 위반 위치를 정확히 찍기 위해 경로를 함께 들고 다닌다. */
const DISPATCH_SRC = DISPATCH_FILES
  .filter((f) => existsSync(f))
  .map((f) => ({ file: f, lines: readFileSync(f, 'utf8').split('\n') }))
if (DISPATCH_SRC.length !== DISPATCH_FILES.length) {
  console.error(`❌ 디스패치 파일이 없다(경로가 낡았다 — 통과 아님): ${DISPATCH_FILES.filter((f) => !existsSync(f)).join(', ')}`)
  process.exit(1)
}

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
// ⏰ 2026-08-13: `slotCron('<식>')('이름', …)` 도 등록으로 센다 — safeCron 을 감싼 **얇은 바인딩**이라
//   하트비트를 그대로 남기고, 자기 주기(gapMin)까지 넘겨 하루 1회 작업의 매일 오탐을 없앤다.
//   ⚠️ 이름만 비슷한 다른 래퍼를 여기 추가하지 말 것 — 진짜로 recordCronBeat 에 닿는 것만.
const REGISTER_RE = /(?:safeCron|slotCron\([^)]*\))\(\s*'/
// 🌆 분리된 디스패치 파일은 `run('이름', …)` 로 주입받은 래퍼를 부른다 — 그 래퍼가 곧 safeCron/slotCron 이다.
//   ⚠️ 이름이 `run` 이라고 다 세면 안 된다: **호출부에서 safeCron/slotCron 을 넘긴 것**이어야 한다.
//   그 배선은 아래 R3 가 따로 검사한다(여기선 등록 수만 센다).
const RUN_RE = /\brun\(\s*'/
const registeredCount = DISPATCH_SRC.reduce(
  (n, f) => n + f.lines.filter((l) => {
    const code = l.replace(/\/\/.*$/, '')
    return REGISTER_RE.test(code) || RUN_RE.test(code)
  }).length, 0)
if (registeredCount < MIN_REGISTERED) {
  console.error(`❌ 등록된 cron 작업이 ${registeredCount}개뿐이다(하한 ${MIN_REGISTERED}) — 디스패치가 또 다른 파일로 나갔나?`)
  console.error(`   본 파일: ${DISPATCH_FILES.join(', ')}`)
  console.error(`   ⚠️ 0 이 아니라 '줄었다' 를 잡는다 — 2026-08-25 에 41→25 로 줄었는데도 초록이었다.`)
  process.exit(1)
}
const bypass = []
for (const f of DISPATCH_SRC) {
  f.lines.forEach((l, i) => {
    if (!l.includes('ctx.waitUntil(')) return
    if (REGISTER_RE.test(l) || RUN_RE.test(l) || l.includes('safeCron(') || l.includes(ALLOW_MARK)) return
    bypass.push(`${f.file}:${i + 1}  ${l.trim().slice(0, 100)}`)
  })
}

// ── R3. 분리된 레인에 **진짜 기록 래퍼**가 주입되는가 ──────────────────────
//   `run` 은 이름일 뿐이다. 호출부가 safeCron/slotCron 이 아닌 것을 넘기면 그 레인 전체가
//   조용히 관측 밖으로 나간다 — 분리가 만든 새 사각지대라 배선 자체를 못박는다.
if (existsSync('src/worker/cron/daily-lane.ts')) {
  const wiring = [...src.matchAll(/runDailyLane\(\s*'([^']+)'[\s\S]{0,200}?run:\s*([A-Za-z]+)/g)]
  if (wiring.length === 0) {
    console.error('❌ daily-lane 이 있는데 scheduled.ts 에 배선(runDailyLane ... run:)이 없다 — 그 레인 전체가 안 돈다.')
    process.exit(1)
  }
  for (const [, group, fn] of wiring) {
    if (fn !== 'safeCron' && fn !== 'slotCron') {
      err(`daily-lane '${group}' 에 기록 래퍼가 아닌 '${fn}' 이 주입됐다 — 그 그룹은 하트비트를 안 남긴다.`)
    }
  }
}
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
// ── R4. **머니 작업은 이름으로 못박는다** ─────────────────────────────────
//   총 개수 하한은 "크게 줄었나"만 본다. 정작 위험한 건 *특정 작업*이 스캔 밖으로 나가는 것이고,
//   그건 개수로는 안 보인다(2026-08-25: 16개가 빠졌는데 남은 25개로도 하한을 넘겼다).
//   ⇒ 돈이 걸린 작업은 **이름이 여기 있는지**로 검사한다. 파일을 어디로 옮기든 이 목록이 따라간다.
const CRITICAL_JOBS = [
  'auto-settlement',              // 정산 확정
  'expired-voucher-refund',       // 만료 이용권 환불
  'supplier-settlement-mature',   // 공급자 정산 성숙
  'affiliate-mature',             // 추천 적립 성숙(T+7)
  'referral-mature',              // 추천 트리 적립 성숙
  'ledger-reconcile',             // 원장 Σdebit=Σcredit
  'ledger-integrity-check',       // 원장 고아 엔트리
  'payouts-generate',             // 주간 지급 대상 생성
  'd1-backup-chunked',            // 재해복구
]
const allDispatch = DISPATCH_SRC.map((f) => f.lines.join('\n')).join('\n')
const missing = CRITICAL_JOBS.filter((n) => !allDispatch.includes(`'${n}'`))
if (missing.length) {
  err(`머니/복구 작업이 디스패치 스캔 밖으로 나갔다 — 하트비트가 안 남는다: ${missing.join(', ')}`)
  console.error(`      본 파일: ${DISPATCH_FILES.join(', ')}`)
  console.error(`      ⚠️ 옮겼다면 DISPATCH_FILES 에 그 파일을 추가할 것(이 목록이 낡으면 가드가 헛돈다).`)
}

if (fail) process.exit(1)
console.log(`✅ cron 하트비트 커버리지 — 등록 ${registeredCount}개 · 머니/복구 ${CRITICAL_JOBS.length}개 전부 확인 (파일 ${DISPATCH_SRC.length}개)`)
