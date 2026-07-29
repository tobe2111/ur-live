/**
 * 🚰 서브리퀘스트 학습 상한(nextSubreqCap) — 회복 데드락 재발 방지 (2026-07-28).
 *
 *   실사고: 회복 조건이 `exhausted`(예산을 0까지 소진)를 요구해, **예산을 남긴 채 정상 종료하는 레인은
 *   영영 상한을 못 올렸다**. 보강 레인이 63 중 29만 쓰고 완주 → `exhausted=false` → 상한 63 고착 →
 *   다음 회차도 63 → 또 남김. 아무 오류도 안 나서 몇 세션 동안 "왜 안 오르지"로 오진됐다.
 *   ⇒ 아래 "예산을 남기고 완주해도 회복한다"가 그 사고의 회귀 테스트다.
 */
import { describe, it, expect } from 'vitest'
import { nextSubreqCap, resolveSubreqBudget, SUBREQ_CAP_MIN, isSubrequestLimitError, subreqCapKey } from '@/features/marketing/api/collect-budget'

describe('nextSubreqCap — 회복', () => {
  it('🔒 예산을 남기고 완주해도 상한을 올린다 (데드락 회귀 테스트)', () => {
    // 실측 그대로: 학습값 63, 예산 63 중 29 소비, 한도 오류 없음 → 예전엔 null(고착)이었다.
    expect(nextSubreqCap(29, false, 63, 300)).toBe(79) // ceil(63 * 1.25)
  })

  it('예산을 다 쓴 경우에도 동일하게 회복', () => {
    expect(nextSubreqCap(63, false, 63, 300)).toBe(79)
  })

  it('회복은 env 예산을 넘지 않는다', () => {
    expect(nextSubreqCap(10, false, 290, 300)).toBe(300)
  })

  it('이미 env 예산에 도달했으면 쓰지 않는다(null)', () => {
    expect(nextSubreqCap(300, false, 300, 300)).toBeNull()
    expect(nextSubreqCap(300, false, 400, 300)).toBeNull()
  })

  it('학습값이 없으면(0) 건드리지 않는다 — env 예산이 이미 상한', () => {
    expect(nextSubreqCap(50, false, 0, 300)).toBeNull()
  })

  /** 핵심 불변식: 한도 오류가 없는 한 유한 회차 안에 env 예산까지 회복한다(고착 없음). */
  it('한도 오류가 없으면 유한 회차에 env 예산에 도달', () => {
    let cap = SUBREQ_CAP_MIN
    let steps = 0
    while (cap < 300 && steps < 100) {
      const next = nextSubreqCap(1, false, cap, 300)
      if (next == null) break
      expect(next).toBeGreaterThan(cap) // 매 회차 전진(무한 루프 불가)
      cap = next; steps++
    }
    expect(cap).toBe(300)
    expect(steps).toBeLessThan(20)
  })
})

describe('nextSubreqCap — 백오프', () => {
  it('한도 오류를 보면 소비량 기준으로 내린다', () => {
    expect(nextSubreqCap(100, true, 300, 300)).toBe(80) // floor(100 * 0.8)
  })

  it('백오프는 하한 밑으로 내려가지 않는다', () => {
    expect(nextSubreqCap(1, true, 300, 300)).toBe(SUBREQ_CAP_MIN)
  })

  it('백오프가 회복보다 우선한다(같은 라운드에 둘 다 해당해도)', () => {
    expect(nextSubreqCap(100, true, 63, 300)).toBe(80)
  })
})

describe('resolveSubreqBudget', () => {
  it('학습값이 있으면 env 와 더 작은 쪽', () => {
    expect(resolveSubreqBudget(300, 63)).toBe(63)
    expect(resolveSubreqBudget(50, 63)).toBe(50)
  })
  it('학습값이 없으면 env 그대로', () => {
    expect(resolveSubreqBudget(300, 0)).toBe(300)
  })
})

describe('레인 격리 · 한도 신호', () => {
  it('레인마다 키가 다르다(공유하면 서로의 관측을 덮어쓴다)', () => {
    const keys = ['company_enrich', 'influencer', 'kakao_sweep'].map(l => subreqCapKey(l as Parameters<typeof subreqCapKey>[0]))
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('플랫폼 한도 문구를 인식한다', () => {
    expect(isSubrequestLimitError('Too many subrequests.')).toBe(true)
    expect(isSubrequestLimitError('network error')).toBe(false)
    expect(isSubrequestLimitError(null)).toBe(false)
  })
})
