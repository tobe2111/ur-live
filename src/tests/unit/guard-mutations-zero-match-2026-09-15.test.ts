/**
 * 🚨 검사기 자신이 "실패할 수 없는" 구멍을 갖고 있었다 〔2026-09-15〕
 *
 * `check-guard-mutations.mjs` 는 "가드가 실패할 수 있는가"를 확인하려고 있는 도구다.
 * 그런데 `--only` 가 **아무것도 못 고르면 실패**라는 그 판정이 `--map-only` **조기 종료 뒤에**
 * 있었다. 그래서:
 *
 *   node scripts/check-guard-mutations.mjs --map-only --only <오타>
 *     → "✅ 주입 지도 0건 성함"  exit 0     ← 아무것도 안 돌았는데 초록불
 *
 * 하필 `--map-only` 가 **커밋 전에 돌리는 모드**라, 가짜 초록불이 가장 필요한 순간에 떴다.
 * (이 세션에서 실제로 파일명으로 불러서 그 초록불을 받았다 — 필터는 이름 부분일치다.)
 *
 * ## 이 시험은 러너를 **실제로 실행**한다
 * 종료 코드를 잰다. 소스를 읽는 게 아니라 동작을 재는 것 — 안 그러면 이 시험도 같은 병에 걸린다.
 *
 * ## 못 막는 것
 * - 필터가 "의도한 항목"을 골랐는지(이름을 잘못 지으면 엉뚱한 게 걸린다)
 * - 되돌려-검증 자체의 정확성(그건 러너 본체가 한다)
 */
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../..')
const RUNNER = 'scripts/check-guard-mutations.mjs'

/** 러너를 실제로 돌리고 종료 코드만 본다(출력은 버린다 — 느려지지 않게). */
function run(...args: string[]): number {
  const r = spawnSync('node', [RUNNER, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 })
  return r.status ?? -1
}

describe('--only 가 아무것도 못 고르면 실패다 — --map-only 에서도', () => {
  it('🔴 --map-only + 안 걸리는 필터 → exit 1 (예전엔 0 이었다)', () => {
    // 파일명으로 부르는 것이 가장 흔한 실수다. 필터는 **주입 이름** 부분일치다.
    expect(run('--map-only', '--only', 'cache-error-rethrow'),
      '0건을 돌고도 초록불이면 커밋 전 점검이 아무 의미가 없다').toBe(1)
  })

  it('🔴 되돌려-검증 모드 + 안 걸리는 필터 → exit 1 (원래 있던 방어, 깨지지 않았다)', () => {
    expect(run('--only', '존재하지않는이름zzz')).toBe(1)
  })

  it('걸리는 필터는 --map-only 에서 통과한다 (새 검사가 정상 사용을 막지 않는다)', () => {
    expect(run('--map-only', '--only', '[푸시]'),
      '정상 필터까지 막으면 아무도 이 모드를 안 쓴다').toBe(0)
  })

  it('🔴 필터 없는 전체 지도 점검은 통과한다 — 여기서 막으면 pre-commit 이 통째로 멎는다', () => {
    // ⚠️ 새 검사가 `ONLY` 없을 때도 발화하면 모든 커밋이 막힌다. 그 경우를 명시적으로 잠근다.
    expect(run('--map-only')).toBe(0)
  })
})
