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
    expect(nextSubreqCap(29, false, 63, 300)).toBe(65) // 63 + RECOVER_STEP(2) — 가산 회복(2026-07-29)
  })

  it('예산을 다 쓴 경우에도 동일하게 회복', () => {
    expect(nextSubreqCap(63, false, 63, 300)).toBe(65)
  })

  it('회복은 env 예산을 넘지 않는다', () => {
    expect(nextSubreqCap(10, false, 290, 300)).toBeLessThanOrEqual(300) // 가산이라 292 — 중요한 건 상한 준수
    expect(nextSubreqCap(10, false, 299, 300)).toBe(300)                // 상한 직전엔 정확히 상한에서 멈춘다
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
    while (cap < 300 && steps < 200) {
      const next = nextSubreqCap(1, false, cap, 300)
      if (next == null) break
      expect(next).toBeGreaterThan(cap) // 매 회차 전진(무한 루프 불가)
      cap = next; steps++
    }
    expect(cap).toBe(300)
    expect(steps).toBeLessThan(150) // 가산(+2)이라 회차는 늘지만 여전히 유한 — 고착 없음이 불변식
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

/**
 * 🌀 2026-07-29 — 진동(oscillation) 회귀 방지. **이번 세션의 라이브 실사고.**
 *   회복이 배율(×1.25)이었고 백오프(×0.8)의 정확한 역수라 `55 → 44 → 55 → 44 …` 2주기로 맴돌았다
 *   (실측 `learned_cap: 55` · `spent: 55` · `limit_hit: true`). 2회마다 1회씩 그 회차 수확을 통째로
 *   버렸고, 발굴을 끝낸 뒤 저장 직전에 끊기므로 외부 API 쿼터까지 함께 태웠다.
 */
describe('nextSubreqCap — 한도 근처에서 진동하지 않는다', () => {
  /** 실제 플랫폼 한도(무료 ≈50)를 가진 환경을 모사해 여러 회차 돌린다. */
  function simulate(startCap: number, hardLimit: number, rounds: number): number[] {
    const caps: number[] = []
    let cap = startCap
    for (let i = 0; i < rounds; i++) {
      const spent = Math.min(cap, hardLimit)      // 한도까지만 쓰이고 그 지점에서 끊긴다
      const hit = cap > hardLimit                  // 예산이 한도를 넘으면 그 회차는 실패
      caps.push(hit ? 1 : 0)                       // 1 = 수확 버림
      cap = nextSubreqCap(spent, hit, cap, 300) ?? cap
    }
    return caps
  }

  it('🔒 실패 비율이 낮다 — 배율 회복(1/0.8=1.25)이면 2회마다 1회 실패했다', () => {
    const fails = simulate(55, 50, 30).reduce((a, b) => a + b, 0)
    expect(fails).toBeLessThanOrEqual(6) // 30회 중 6회 이하(구 로직은 15회)
  })

  it('회복 배율이 백오프의 역수면 안 된다 — 그 조합이 완벽한 2주기 진동을 만든다', () => {
    // 44 에서 회복해도 55(=44/0.8)로 되돌아가면 안 된다.
    expect(nextSubreqCap(44, false, 44, 300)).toBeLessThan(Math.ceil(44 / 0.8))
  })

  it('백오프 후 회복이 같은 실패 지점으로 곧장 복귀하지 않는다', () => {
    const afterBackoff = nextSubreqCap(55, true, 55, 300)! // 44
    const afterRecover = nextSubreqCap(afterBackoff, false, afterBackoff, 300)!
    expect(afterRecover).toBeLessThan(55)
  })
})
