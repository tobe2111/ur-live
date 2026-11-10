/**
 * 🚦 주입 전수(main push)가 검사 기계를 독차지하지 않는다 (2026-11-10)
 * 근거: .github/workflows/guard-mutations-full.yml 의 concurrency · max-parallel 주석
 * (11/10 하루: 이 워크플로가 기계 시간 65% · 그중 1,186분이 취소된 run · PR 검사 조각 20~30분 대기)
 * ⚠️ 못 보는 것: GitHub 의 실제 동시 실행 한도(무료 20대)가 바뀌는 것 — 그때는 이 숫자를 다시 잰다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const code = readFileSync('.github/workflows/guard-mutations-full.yml', 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n')

describe('주입 전수가 PR 검사·배포를 굶기지 않는다', () => {
  it('돌던 전수를 버리지 않는다 — 대기는 최신 하나만(GitHub 기본)', () => {
    expect(code).toMatch(/concurrency:\n {2}group: guard-mutations-full-\$\{\{ github\.ref_name \}\}\n {2}cancel-in-progress: false/)
  })
  it('한 번에 잡는 기계 수에 상한이 있다(무료 계정 전체 20대 중 절반 이하)', () => {
    const m = /\n {6}max-parallel: (\d+)\n/.exec(code)
    expect(m, 'max-parallel 이 없으면 전수가 16대를 한꺼번에 잡는다').not.toBeNull()
    expect(Number(m![1])).toBeGreaterThan(0)
    expect(Number(m![1])).toBeLessThanOrEqual(10)
  })
})
