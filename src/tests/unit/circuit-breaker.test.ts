import { describe, it, expect, beforeEach } from 'vitest'
import { withCircuitBreaker, getCircuitState, resetCircuit, fetchWithFallback } from '@/worker/utils/circuit-breaker'

/**
 * 🛡️ 2026-06-01 circuit-breaker 테스트 (외부서비스 회복탄력성, 테스트 0개였음).
 * toss-gateway 등 결제-critical 경로가 의존 — 깨지면 장애 시 cascade timeout/quota 소진.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('withCircuitBreaker', () => {
  beforeEach(() => { resetCircuit('t') })

  it('성공 시 결과 반환 + 실패카운트 리셋', async () => {
    const r = await withCircuitBreaker({ name: 't' }, async () => 42)
    expect(r).toBe(42)
    expect(getCircuitState('t')?.state).toBe('closed')
  })

  it('maxFailures 연속 실패 → 회로 OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      await withCircuitBreaker({ name: 't', maxFailures: 3 }, async () => { throw new Error('x') }).catch(() => {})
    }
    expect(getCircuitState('t')?.state).toBe('open')
  })

  it('OPEN 상태에선 operation 호출 없이 fallback 반환', async () => {
    for (let i = 0; i < 2; i++) {
      await withCircuitBreaker({ name: 't', maxFailures: 2 }, async () => { throw new Error('x') }, () => 'fb').catch(() => {})
    }
    let called = false
    const r = await withCircuitBreaker({ name: 't', maxFailures: 2 }, async () => { called = true; return 'live' }, () => 'fb')
    expect(r).toBe('fb')
    expect(called).toBe(false) // 회로 OPEN → 실제 operation 안 탐
  })

  it('OPEN + resetTimeout 경과 → half-open 후 성공하면 closed 복구', async () => {
    for (let i = 0; i < 2; i++) {
      await withCircuitBreaker({ name: 't', maxFailures: 2, resetTimeoutMs: 10 }, async () => { throw new Error('x') }).catch(() => {})
    }
    expect(getCircuitState('t')?.state).toBe('open')
    await sleep(20)
    const r = await withCircuitBreaker({ name: 't', maxFailures: 2, resetTimeoutMs: 10 }, async () => 'recovered')
    expect(r).toBe('recovered')
    expect(getCircuitState('t')?.state).toBe('closed')
  })

  it('성공 시 누적 실패가 리셋되어 OPEN 안 됨', async () => {
    await withCircuitBreaker({ name: 't', maxFailures: 3 }, async () => { throw new Error('x') }).catch(() => {})
    await withCircuitBreaker({ name: 't', maxFailures: 3 }, async () => 'ok') // 성공 → 리셋
    expect(getCircuitState('t')?.failures).toBe(0)
  })
})

describe('fetchWithFallback', () => {
  it('성공 시 결과, 예외 시 fallback', async () => {
    expect(await fetchWithFallback(async () => 'live', 'fb')).toBe('live')
    expect(await fetchWithFallback(async () => { throw new Error('x') }, 'fb')).toBe('fb')
  })
  it('timeout 시 fallback', async () => {
    const r = await fetchWithFallback(async () => { await sleep(50); return 'slow' }, 'fb', 10)
    expect(r).toBe('fb')
  })
})
