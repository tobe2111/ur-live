/**
 * 🔇 화면 전환(View Transition)의 거절을 아무도 안 받아 오류 보고가 나가던 것 (2026-11-12 대표 Sentry 메일
 *   JAVASCRIPT-REACT-37 — `Transition was aborted because of invalid state. Snapshot capture failed`, /stays/:id).
 *   고정: ① `quietVt` 가 세 약속의 거절을 받는다(실제로 unhandledrejection 이 안 난다)
 *        ② 전환을 시작하는 소스는 전부 `quietVt(…startViewTransition(` 으로 감싼다(새 호출부가 빠지면 빨간불).
 *   못 보는 것: 이동 콜백 안의 진짜 오류(각 호출부의 try/폴백이 맡는다) · 브라우저가 실제로 건너뛰는 조건.
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { quietVt } from '@/lib/vt-quiet'

describe('① 거절을 받는다', () => {
  it('ready·updateCallbackDone·finished 가 거절돼도 unhandledrejection 이 없다', async () => {
    const seen: unknown[] = []
    const on = (r: unknown) => seen.push(r)
    process.on('unhandledRejection', on)
    const err = new Error('InvalidStateError: Transition was aborted because of invalid state. Snapshot capture failed')
    quietVt({ ready: Promise.reject(err), updateCallbackDone: Promise.reject(err), finished: Promise.reject(err) })
    await new Promise((r) => setTimeout(r, 20))
    process.off('unhandledRejection', on)
    expect(seen).toEqual([])
  })
  it('없는 약속(구형 브라우저 모양)도 괜찮다', () => { expect(() => quietVt({})).not.toThrow() })
})

describe('② 모든 호출부가 감싼다', () => {
  const files = execSync("git grep -l 'startViewTransition' -- 'src/**/*.ts' 'src/**/*.tsx' 'src/*.ts' 'src/*.tsx'", { encoding: 'utf8' })
    .split('\n').filter((f) => f && !f.includes('/tests/') && !f.endsWith('vt-quiet.ts'))
  it('호출부가 있다(0 이면 검사가 헛돈다)', () => expect(files.length).toBeGreaterThanOrEqual(3))
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(f, 'utf8')
      const calls = src.match(/startViewTransition!?\(/g) ?? []
      const wrapped = src.match(/quietVt\(\s*doc\.startViewTransition!?\(/g) ?? []
      expect(wrapped.length).toBe(calls.length)
    })
  }
})
