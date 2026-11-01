/**
 * 🧾 pre-push 실패 요약이 진짜 실패를 먼저 보여 준다 — 2026-11-01.
 * 같은 로그 한 줄(`Error: no such table …`)이 30줄을 채워 `FAIL` 을 가렸고, 요약만 보고는 무엇이
 * 빨간지 몰라 시험 목록을 따로 뽑아 다시 돌려야 했다(원인을 가리는 메시지 = 결함, 개발 룰 3-1).
 */
import { describe, it, expect } from 'vitest'
import { summarizeFailure } from '../../../scripts/pre-push-failure-summary.mjs'
import { readCode } from '../helpers/source-text'

const NOISE = Array.from({ length: 40 }, () => '     err: Error: no such table: rate_limit_attempts').join('\n')
const REAL = ' FAIL  src/tests/unit/x.test.ts > 계약 > 선언이 빠졌다\n     × 선언이 빠졌다 5ms'

describe('진짜 실패 줄이 먼저 온다', () => {
  it('🔴 잡음 40줄 뒤에 있어도 FAIL·× 가 맨 앞이다', () => {
    const s = summarizeFailure(`${NOISE}\n${REAL}`)
    expect(s[0]).toContain('FAIL')
    expect(s[1]).toContain('×')
  })
  it('같은 잡음 줄은 한 번만 남는다', () => {
    const s = summarizeFailure(`${NOISE}\n${REAL}`)
    expect(s.filter((l) => l.includes('no such table')).length).toBe(1)
  })
  it('실패 줄이 없으면 원문을 그대로(빈 요약 금지)', () => {
    expect(summarizeFailure('그냥 출력\n둘째 줄')).toEqual(['그냥 출력', '둘째 줄'])
  })
  it('pre-push 시험 러너가 이 요약을 실제로 쓴다', () => {
    const r = readCode('scripts/pre-push-tests.mjs')
    expect(r).toContain("import { summarizeFailure } from './pre-push-failure-summary.mjs'")
    expect(r).toMatch(/summarizeFailure\(out\)/)
  })
})
