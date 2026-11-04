/**
 * 🛟 2026-11-04 대표 *"대기업급 안정성"* — 조회 재시도는 **일시적 실패만**(네트워크·시간 초과·5xx·429·408), 최대 2번, 지수 간격.
 * 404·401·403 은 다시 해도 같아 즉시 보여 준다.
 */
import { describe, it, expect } from 'vitest'
import { shouldRetryQuery, queryClient } from '@/lib/react-query'

describe('조회 재시도 정책', () => {
  it('네트워크(상태 없음)·5xx·429 는 2번까지', () => {
    expect(shouldRetryQuery(0, { code: 'ERR_NETWORK' })).toBe(true)
    expect(shouldRetryQuery(1, { status: 503 })).toBe(true)
    expect(shouldRetryQuery(0, { response: { status: 429 } })).toBe(true)
    expect(shouldRetryQuery(2, { status: 503 })).toBe(false)
  })
  it('4xx 는 다시 하지 않는다', () => {
    for (const s of [400, 401, 403, 404, 422]) expect(shouldRetryQuery(0, { status: s })).toBe(false)
  })
  it('전역 기본값에 걸려 있고 간격은 늘어난다', () => {
    const q = queryClient.getDefaultOptions().queries!
    expect(q.retry).toBe(shouldRetryQuery)
    const d = q.retryDelay as (n: number) => number
    expect(d(0)).toBe(600); expect(d(1)).toBe(1800); expect(d(5)).toBe(4000)
  })
  it('쓰기(mutation)는 자동으로 다시 보내지 않는다 — 두 번 처리 방지', () => {
    expect(queryClient.getDefaultOptions().mutations!.retry).toBe(0)
  })
})
