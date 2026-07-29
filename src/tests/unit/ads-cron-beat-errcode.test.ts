import { describe, it, expect } from 'vitest'
import { summarizeResult } from '@/worker/utils/cron-heartbeat'

/**
 * 🏷️ 2026-07-29 — 실패 하트비트에 사유가 없던 갭의 회귀 방지.
 *
 *   06:00 회차에 ur-ads 4개 레인이 **동시에** `ok:false` 로 죽었는데 어드민에는 `result: null` 뿐이었다.
 *   전부 2~6초 만에 끝난 초기 사망인데 예산 고갈인지 다른 예외인지 화면에서 구분되지 않았다.
 *
 *   ⚠️ 핵심 함정: `summarizeResult` 는 **24자 초과 문자열을 버린다**.
 *   `Too many subrequests by single Worker invocation`(47자)을 그대로 넘기면 통째로 사라진다 —
 *   그래서 호출부(worker-ads `errCode`)가 짧은 분류 코드로 줄인다. 이 테스트는 그 계약을 잠근다.
 */
describe('summarizeResult — 실패 사유가 실제로 남는가', () => {
  it('🔒 짧은 분류 코드는 보존된다(호출부가 이 형태로 넘긴다)', () => {
    expect(summarizeResult({ err: 'limit' })).toBe('err=limit')
    expect(summarizeResult({ err: 'timeout' })).toBe('err=timeout')
    expect(summarizeResult({ err: 'TypeError' })).toBe('err=TypeError')
  })

  it('🐛 원문 그대로는 24자 제한에 걸려 사라진다 — 그래서 코드로 줄여야 한다', () => {
    const raw = 'Too many subrequests by single Worker invocation'
    expect(raw.length).toBeGreaterThan(24)
    expect(summarizeResult({ err: raw })).toBeNull() // 이 동작이 바뀌면 호출부 전제가 깨진다
  })

  it('성공 회차(undefined)는 요약을 만들지 않는다', () => {
    expect(summarizeResult(undefined)).toBeNull()
    expect(summarizeResult(null)).toBeNull()
  })

  it('숫자·불리언 결과는 그대로 요약된다(기존 계약 보존)', () => {
    expect(summarizeResult({ saved: 12, done: true })).toBe('saved=12 done=true')
  })

  it('요약 길이는 상한을 넘지 않는다(스탬프 오염 방지)', () => {
    const big: Record<string, number> = {}
    for (let i = 0; i < 100; i++) big[`k${i}`] = i
    expect((summarizeResult(big) || '').length).toBeLessThanOrEqual(160)
  })
})
