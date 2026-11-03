/**
 * ⏳ 이 브랜치의 PR 검사가 돌고 있으면 푸시 직전에 멈춰 알린다 (2026-11-03) · 근거: scripts/check-verify-in-flight.mjs 머리말
 * ⚠️ 못 보는 것: 실제 GitHub 응답 — 조회 실패는 통과(안내이지 가드가 아니다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { judgeInFlight, MIN_MINUTES } from '../../../scripts/check-verify-in-flight.mjs'

const now = new Date('2026-11-03T12:00:00Z')
const ago = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()

describe('검사 진행 중 푸시', () => {
  it('5분 넘게 돈 검사가 있으면 멈춘다', () => {
    const v = judgeInFlight({ runs: [{ status: 'in_progress', run_started_at: ago(25), created_at: ago(25), html_url: 'u' }], now })
    expect(v).toEqual({ block: true, minutes: 25, url: 'u' })
  })
  it('막 시작했거나 끝난 검사는 통과', () => {
    expect(judgeInFlight({ runs: [{ status: 'in_progress', run_started_at: ago(MIN_MINUTES - 1), created_at: ago(4) }], now }).block).toBe(false)
    expect(judgeInFlight({ runs: [{ status: 'completed', run_started_at: ago(60), created_at: ago(60) }], now }).block).toBe(false)
    expect(judgeInFlight({ runs: [], now }).block).toBe(false)
  })
  it('푸시 게이트가 실제로 부르고, 판정이 멈추라고 할 때만 멈춘다(시간 초과로 막지 않는다)', () => {
    const g = readFileSync('scripts/pre-push-gate.mjs', 'utf8')
    expect(g).toContain("execFileSync('node', ['scripts/check-verify-in-flight.mjs']")
    expect(g).toMatch(/if \(err\?\.status === 1\) process\.exit\(1\)/)
  })
})
