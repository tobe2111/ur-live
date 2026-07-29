/**
 * 🚰 서브리퀘스트 학습 상한(nextSubreqCap) — 회복 데드락 재발 방지 (2026-07-28).
 *
 *   실사고: 회복 조건이 `exhausted`(예산을 0까지 소진)를 요구해, **예산을 남긴 채 정상 종료하는 레인은
 *   영영 상한을 못 올렸다**. 보강 레인이 63 중 29만 쓰고 완주 → `exhausted=false` → 상한 63 고착 →
 *   다음 회차도 63 → 또 남김. 아무 오류도 안 나서 몇 세션 동안 "왜 안 오르지"로 오진됐다.
 *   ⇒ 아래 "예산을 남기고 완주해도 회복한다"가 그 사고의 회귀 테스트다.
 */
import { describe, it, expect } from 'vitest'
import { nextSubreqCap, resolveSubreqBudget, SUBREQ_CAP_MIN, isSubrequestLimitError, subreqCapKey, platformSubreqCap, SUBREQ_PLATFORM_CAP_DEFAULT } from '@/features/marketing/api/collect-budget'

/** 아래 '회복 비율' 테스트들은 **천장과 무관한 비율 로직**을 검증한다(2026-07-29 천장 도입 후 분리).
 *  천장 자체의 검증은 이 파일 맨 아래 '플랫폼 천장' 블록. 여기서 천장을 넉넉히 열어 두 관심사를 섞지 않는다. */
const NO_CEILING = 1000

describe('nextSubreqCap — 회복', () => {
  it('🔒 예산을 남기고 완주해도 상한을 올린다 (데드락 회귀 테스트)', () => {
    // 실측 그대로: 학습값 63, 예산 63 중 29 소비, 한도 오류 없음 → 예전엔 null(고착)이었다.
    expect(nextSubreqCap(29, false, 63, 300, NO_CEILING)).toBe(79) // ceil(63 * 1.25)
  })

  it('예산을 다 쓴 경우에도 동일하게 회복', () => {
    expect(nextSubreqCap(63, false, 63, 300, NO_CEILING)).toBe(79)
  })

  it('회복은 env 예산을 넘지 않는다', () => {
    expect(nextSubreqCap(10, false, 290, 300, NO_CEILING)).toBe(300)
  })

  it('이미 상한에 도달했으면 쓰지 않는다(null)', () => {
    expect(nextSubreqCap(300, false, 300, 300, NO_CEILING)).toBeNull()
  })

  // 2026-07-29 의도 변경: 예전엔 상한 초과 학습값(400 > env 300)을 null(무시)로 뒀다. 그러면 **잘못된 값이
  //   저장소에 그대로 남는다** — company_enrich=172 드리프트가 눈에 안 띈 이유가 이것이다. 이제 끌어내린다
  //   (쓰기 1회 후 다음 회차부터 null 이라 비용도 1회뿐).
  it('상한을 넘게 저장된 학습값은 상한으로 끌어내린다', () => {
    expect(nextSubreqCap(300, false, 400, 300, NO_CEILING)).toBe(300)
  })

  it('학습값이 없으면(0) 건드리지 않는다 — env 예산이 이미 상한', () => {
    expect(nextSubreqCap(50, false, 0, 300, NO_CEILING)).toBeNull()
  })

  /** 핵심 불변식: 한도 오류가 없는 한 유한 회차 안에 env 예산까지 회복한다(고착 없음). */
  it('한도 오류가 없으면 유한 회차에 env 예산에 도달', () => {
    let cap = SUBREQ_CAP_MIN
    let steps = 0
    while (cap < 300 && steps < 100) {
      const next = nextSubreqCap(1, false, cap, 300, NO_CEILING)
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
    expect(nextSubreqCap(100, true, 300, 300, NO_CEILING)).toBe(80) // floor(100 * 0.8)
  })

  it('백오프는 하한 밑으로 내려가지 않는다', () => {
    expect(nextSubreqCap(1, true, 300, 300, NO_CEILING)).toBe(SUBREQ_CAP_MIN)
  })

  it('백오프가 회복보다 우선한다(같은 라운드에 둘 다 해당해도)', () => {
    expect(nextSubreqCap(100, true, 63, 300, NO_CEILING)).toBe(80)
  })
})

describe('resolveSubreqBudget', () => {
  it('학습값이 있으면 env 와 더 작은 쪽', () => {
    expect(resolveSubreqBudget(300, 63, NO_CEILING)).toBe(63)
    expect(resolveSubreqBudget(50, 63, NO_CEILING)).toBe(50)
  })
  it('학습값이 없으면 env 그대로', () => {
    expect(resolveSubreqBudget(300, 0, NO_CEILING)).toBe(300)
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
 * 🧱 플랫폼 천장 (2026-07-29) — 학습이 넘을 수 없는 절대 상한.
 *
 *   왜: 라이브 학습값이 `influencer=55` · `kakao_sweep=65`(건당 fetch 1, 한도를 **잡을 수 있는 예외**로 만남)
 *   인데 `company_enrich=172`(건당 4~6 fetch, 라운드가 무증거로 죽어 하향이 한 번도 안 걸림)였다.
 *   자기교정 루프는 "실패를 관측할 수 있다"를 전제하는데 그 전제가 깨진 레인에서 상한이 한 방향으로만 드리프트했다.
 *   ⇒ 관측에 의존하지 않는 천장을 둔다. 이 테스트가 깨지면 그 드리프트가 되살아난다.
 */
describe('플랫폼 천장 — 학습 상한이 넘을 수 없다', () => {
  it('학습값이 천장보다 커도 이번 실행 예산은 천장까지만', () => {
    expect(resolveSubreqBudget(300, 172, 45)).toBe(45)
  })

  it('천장보다 작은 학습값은 그대로 존중(천장이 바닥을 올리지 않는다)', () => {
    expect(resolveSubreqBudget(300, 30, 45)).toBe(30)
  })

  it('학습값이 없으면 env 예산과 천장 중 작은 쪽', () => {
    expect(resolveSubreqBudget(300, 0, 45)).toBe(45)
    expect(resolveSubreqBudget(20, 0, 45)).toBe(20)
  })

  it('회복(×1.25)도 천장을 넘지 못한다 — 이게 뚫리면 172 드리프트가 재발한다', () => {
    expect(nextSubreqCap(40, false, 40, 300, 45)).toBe(45)
    expect(nextSubreqCap(40, false, 44, 300, 45)).toBe(45)
  })

  it('이미 천장을 넘게 학습된 과거 값은 천장으로 끌어내린다(방치하면 영영 안 내려온다)', () => {
    expect(nextSubreqCap(14, false, 172, 300, 45)).toBe(45)
  })

  it('천장에 도달해 있으면 더 쓸 말이 없다(null = 쓰기 생략)', () => {
    expect(nextSubreqCap(45, false, 45, 300, 45)).toBeNull()
  })

  it('한도 관측 시 백오프도 천장 아래로', () => {
    const v = nextSubreqCap(200, true, 172, 300, 45)
    expect(v).not.toBeNull()
    expect(v!).toBeLessThanOrEqual(45)
  })

  it('platformSubreqCap — 미설정/이상값은 기본 45, 유료 전환 시 env 로 상향', () => {
    expect(platformSubreqCap(undefined)).toBe(SUBREQ_PLATFORM_CAP_DEFAULT)
    expect(platformSubreqCap('')).toBe(SUBREQ_PLATFORM_CAP_DEFAULT)
    expect(platformSubreqCap('abc')).toBe(SUBREQ_PLATFORM_CAP_DEFAULT)
    expect(platformSubreqCap('900')).toBe(900)
    expect(platformSubreqCap('99999')).toBe(900) // 상한 클램프
    expect(platformSubreqCap('1')).toBe(10)      // 하한 클램프(수확 0 방지)
  })
})
