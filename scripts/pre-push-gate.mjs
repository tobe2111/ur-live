#!/usr/bin/env node
/**
 * 🛡️ 2026-09-14 — 푸시 직전 게이트: "CI 가 막을 것을 여기서 먼저 막는다"
 *
 * 왜: CI Verify 1회가 실측 **57분**이고, 그중 45분이 가드 주입 검증 한 스텝이다.
 *   그런데 CI 가 차단하는 가드 91개 중 **로컬에서 막는 건 0개**였다(경고이거나 아예 없음).
 *   ⇒ 사소한 위반 하나가 57분을 태운다. 실측: 그 91개 **전부 합쳐 14.5초.**
 *
 * 무엇을: `verify.yml` 에서 strict 가드를 **매번 새로 뽑아** 전부 돌린다(손목록 없음).
 *   제외는 `local-ci-parity.mjs` 의 EXCLUDE 하나뿐이고 이유가 적혀 있다.
 *
 * 우회: `SKIP_PREPUSH_GATE=1 git push …` (긴급 시). 우회해도 CI 가 다시 막는다.
 */
import { execFileSync } from 'node:child_process'
import { localGateGuards, EXCLUDE } from './local-ci-parity.mjs'

if (process.env.SKIP_PREPUSH_GATE === '1') {
  console.log('⏭️  pre-push 게이트 건너뜀 (SKIP_PREPUSH_GATE=1) — CI 가 대신 막는다.')
  process.exit(0)
}

const guards = localGateGuards()
if (guards.length === 0) {
  // 🛡️ 측정 0 = 통과가 아니라 실패. 이 레포가 반복해 당한 "헛도는 가드" 차단.
  console.error('❌ pre-push 게이트: verify.yml 에서 가드를 하나도 못 뽑았다 — 파서가 낡았다.')
  process.exit(1)
}

const t0 = Date.now()
const failed = []
for (const g of guards) {
  const isSh = g.endsWith('.sh')
  try {
    execFileSync(isSh ? 'bash' : 'node', [`scripts/${g}`], { stdio: 'pipe', timeout: 120_000 })
  } catch (err) {
    failed.push({ g, out: `${err.stdout ?? ''}${err.stderr ?? ''}`.trim() })
  }
}
const secs = ((Date.now() - t0) / 1000).toFixed(1)

if (failed.length === 0) {
  console.log(`✅ pre-push 게이트: 가드 ${guards.length}개 통과 (${secs}초). 제외 ${Object.keys(EXCLUDE).length}개는 CI 담당.`)
  process.exit(0)
}

console.error(`\n❌ pre-push 게이트: ${failed.length}개 빨간불 (${secs}초) — 지금 고치면 CI 57분을 아낀다.\n`)
for (const { g, out } of failed) {
  console.error(`── ${g}`)
  console.error(out.split('\n').slice(0, 12).map((l) => `   ${l}`).join('\n'))
  console.error('')
}
console.error('우회가 정말 필요하면: SKIP_PREPUSH_GATE=1 git push …  (CI 가 다시 막는다)')
process.exit(1)
