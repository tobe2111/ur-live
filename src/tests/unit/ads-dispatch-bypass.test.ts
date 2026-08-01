/**
 * 🚦 **예산 우회 래칫이 실제로 잡는가** — 가드의 가드.
 *
 * `check-ads-dispatch-bypass.mjs` 는 생 `ctx.waitUntil(await import(…))` 레인을 센다.
 * 그 레인들은 **부모 CPU 를 직접 태우면서 예산 분산엔 안 잡힌다**(`kick` 은 SELF.fetch =
 * 자식 인보케이션 = 자기 예산이라 정반대다).
 *
 * ⚠️ 이 유닛은 **래칫이 무력화되는 것**을 잡는다(주입 매니페스트가 이 파일을 겨눈다).
 *   라이브에서 우회가 *무거워지는* 것은 못 본다 — 그건 하트비트로만 보인다.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'src/worker-ads/index.ts'
const GUARD = 'scripts/check-ads-dispatch-bypass.mjs'

function runGuard(): number {
  try { execFileSync('node', [GUARD, '-s'], { stdio: 'pipe' }); return 0 } catch (e) { return (e as { status?: number }).status ?? 1 }
}

describe('예산 우회 래칫', () => {
  it('현재 코드는 통과한다(동결값 이하)', () => {
    expect(runGuard()).toBe(0)
  })

  it('🔒 새 우회 레인을 추가하면 차단한다', () => {
    const original = readFileSync(SRC, 'utf8')
    const anchor = '  ctx.waitUntil(recordKnownLanes(env, laneReg.list()))'
    expect(original, '앵커가 사라졌다 — 가드가 낡은 지도가 됐는지 확인할 것').toContain(anchor)
    try {
      writeFileSync(SRC, original.replace(anchor, anchor +
        `\n  ctx.waitUntil((async () => { const { x } = await import('@/features/marketing/api/__probe-lane'); await x() })())`))
      expect(runGuard(), '새 우회를 추가했는데 래칫이 통과시켰다').toBe(1)
    } finally { writeFileSync(SRC, original) }
    expect(runGuard()).toBe(0)   // 복원 확인
  })

  it('🔒 의도적 인라인은 dispatch-bypass-ok 주석으로 면제된다(코드 위 줄)', () => {
    const original = readFileSync(SRC, 'utf8')
    const anchor = '  ctx.waitUntil(recordKnownLanes(env, laneReg.list()))'
    try {
      writeFileSync(SRC, original.replace(anchor, anchor +
        `\n  // dispatch-bypass-ok — 검증용\n  ctx.waitUntil((async () => { const { x } = await import('@/features/marketing/api/__probe-lane'); await x() })())`))
      expect(runGuard(), '면제 주석이 있는데 차단했다').toBe(0)
    } finally { writeFileSync(SRC, original) }
  })
})
