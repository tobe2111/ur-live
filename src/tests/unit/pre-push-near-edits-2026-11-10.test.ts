/**
 * 🎯 올리기 전 — 고친 줄 근처의 주입만 미리 돈다 (2026-11-10) · 근거: scripts/guard-mutations-near-edits.mjs 머리말
 * (11/9~11/10 PR 검사 실패 8건 중 6건이 '가드 주입 검증(변경분)' — 여섯 다 이 규칙으로 되짚으면 골라진다)
 * ⚠️ 못 보는 것: 앵커와 먼 곳을 고쳐 시험 결과가 바뀌는 경우 — 그건 CI 의 --changed 가 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseHunks, pickNearEdits, NEAR_LINES } from '../../../scripts/guard-mutations-near-edits.mjs'
import { FLAGS, VALUE_FLAGS, unknownArgs } from '../../../scripts/guard-mutations-args.mjs'

const lines = (n: number, at: number, text: string) =>
  Array.from({ length: n }, (_, i) => (i + 1 === at ? text : `line ${i + 1}`)).join('\n')

describe('바뀐 줄 범위 읽기', () => {
  it('새 쪽 줄 번호로 범위를 뽑고, 지우기만 한 덩어리도 한 줄로 친다', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts', '--- a/src/a.ts', '+++ b/src/a.ts',
      '@@ -77,0 +78,15 @@ fn', '+x', '@@ -94 +109 @@ fn', '-y', '+y2', '@@ -200,3 +214,0 @@ fn',
      'diff --git a/src/gone.ts b/src/gone.ts', '--- a/src/gone.ts', '+++ /dev/null', '@@ -1,3 +0,0 @@',
    ].join('\n')
    const h = parseHunks(diff)
    expect(h.get('src/a.ts')).toEqual([[78, 92], [109, 109], [214, 214]])
    expect(h.has('src/gone.ts')).toBe(false)
  })
})

describe('고를 주입', () => {
  const T = 'src/tests/unit/t.test.ts'
  const pick = (m: { name: string; file: string; find: string; test: string }, files: string[], hunks: Array<[number, number]>, src: string | null) =>
    pickNearEdits({ mutations: [m], files: new Set(files), hunks: new Map([[m.file, hunks]]), readSrc: () => src }).has(m.name)

  it('2026-11-09 지도 시드 실패를 고른다 — 앵커가 바뀐 줄에서 15줄 떨어져 있었다', () => {
    const m = { name: '지도시드', file: 'src/hooks/queries/useMapProducts.ts', find: '      if (cancelled || started) return', test: T }
    expect(pick(m, [m.file], [[78, 92], [109, 109], [212, 212]], lines(256, 227, m.find))).toBe(true)
  })
  it('바꾼 줄에서 멀리 있는 앵커는 고르지 않는다(그래야 푸시가 안 느려진다)', () => {
    const m = { name: 'far', file: 'src/a.ts', find: 'ANCHOR', test: T }
    expect(pick(m, [m.file], [[10, 10]], lines(200, 10 + NEAR_LINES + 1, 'ANCHOR'))).toBe(false)
    expect(pick(m, [m.file], [[10, 10]], lines(200, 10 + NEAR_LINES, 'ANCHOR'))).toBe(true)
  })
  it('시험 파일을 바꿨으면 앵커 거리와 무관하게 고른다', () => {
    const m = { name: 'test-changed', file: 'src/a.ts', find: 'ANCHOR', test: T }
    expect(pick(m, [T], [], lines(200, 150, 'ANCHOR'))).toBe(true)
  })
  it('대상 파일을 바꿨는데 앵커가 사라졌으면 고른다(낡은 지도 — 돌려 봐야 수 ms)', () => {
    const m = { name: 'stale', file: 'src/a.ts', find: 'GONE', test: T }
    expect(pick(m, [m.file], [[5, 5]], lines(50, 1, 'x'))).toBe(true)
  })
  it('대상도 시험도 안 바꿨으면 고르지 않는다', () => {
    const m = { name: 'untouched', file: 'src/a.ts', find: 'ANCHOR', test: T }
    expect(pick(m, ['src/b.ts'], [], lines(50, 5, 'ANCHOR'))).toBe(false)
  })
})

describe('배선', () => {
  const runner = readFileSync('scripts/check-guard-mutations.mjs', 'utf8')
  it('러너가 새 인자를 안다 — 모르면 멈춘다(조용히 전수로 떨어지지 않는다)', () => {
    expect(FLAGS).toContain('--near-edits')
    expect(VALUE_FLAGS).toContain('--budget-sec')
    expect(unknownArgs(['--near-edits', '--budget-sec', '300', '-s'])).toEqual([])
  })
  it('러너가 고른 것만 돌고, 다른 거르개와 겹쳐 쓰지 못하게 한다', () => {
    expect(runner).toContain('  if (!inNear(m)) continue\n')
    expect(runner).toMatch(/if \(NEAR && \(ONLY \|\| SHARD \|\| CHANGED\)\) \{/)
  })
  it('푸시 게이트가 strict 로 부르고, 주입이 살아남았을 때(exit 1)만 멈춘다', () => {
    const g = readFileSync('scripts/pre-push-gate.mjs', 'utf8')
    const i = g.indexOf("['scripts/check-guard-mutations.mjs', '--near-edits', '--budget-sec', '300', '-s']")
    expect(i).toBeGreaterThan(0)
    expect(g.slice(i, i + 300)).toMatch(/if \(err && err\.status === 1\) \{/)
  })
})
