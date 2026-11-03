/**
 * ⏱️ main 배포의 단위 시험을 네 대로 — 그리고 시험이 전부 통과해야 배포한다 (2026-11-03 대표 *"다 하자"*)
 *
 * 실측: 배포 한 번 14.1분 중 9.4분이 단위 시험(한 대가 차례로). 이 시험이 지키는 것:
 *   ① 시험은 별도 잡에서 4조각 · fail-fast 없음  ② deploy 가 그 잡을 기다린다(합친 결과가 깨졌으면 라이브에 안 올린다)
 *   ③ deploy 안에서 시험을 또 돌지 않는다  ④ 시험이 깨져 deploy 가 건너뛰어져도 어드민에 기록이 남는다
 * ⚠️ 못 보는 것: GitHub 이 실제로 `needs` 를 지키는지 — 머지 후 첫 배포 run 의 잡 순서로 확인한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const WF = readFileSync('.github/workflows/main.yml', 'utf8')
function job(name: string): string {
  const i = WF.indexOf(`\n  ${name}:\n`)
  expect(i, `${name} 잡이 없다`).toBeGreaterThan(-1)
  const rest = WF.slice(i + 1)
  const next = rest.slice(1).search(/\n  [a-z][a-z0-9-]*:\n/)
  return next === -1 ? rest : rest.slice(0, next + 1)
}

describe('main 배포', () => {
  it('① 단위 시험은 4조각 · fail-fast 없음', () => {
    const u = job('unit-tests')
    expect(u).toContain('shard: [1, 2, 3, 4]')
    expect(u).toContain('fail-fast: false')
    expect(u).toContain('run: npx vitest run --shard=${{ matrix.shard }}/4')
  })
  it('② deploy 는 시험 잡을 기다린다', () => {
    expect(job('deploy')).toMatch(/^  deploy:\n    needs: unit-tests\n/)
  })
  it('③ deploy 안에서 시험을 또 돌지 않는다', () => {
    expect(job('deploy')).not.toMatch(/npm test|vitest run/)
  })
  it('④ 시험이 깨지면 어드민에 기록한다(deploy 가 건너뛰어져 그 잡의 기록 단계가 안 돈다)', () => {
    const r = job('report-tests-failed')
    expect(r).toContain("if: failure() && needs.unit-tests.result == 'failure'")
    expect(r).toContain('bash scripts/report-deploy-failure.sh')
  })
  it('⑤ 돌고 있는 배포를 새 머지가 죽이지 않는다 — 머지가 촘촘하면 라이브가 굶는다(실측 연속 취소 5번)', () => {
    expect(WF).toMatch(/concurrency:\n  group: deploy-pages\n  cancel-in-progress: false\n/)
  })
})

