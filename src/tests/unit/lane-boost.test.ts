import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  planBoostRuns, laneCanAbsorb, readBoost, COMPENSATORS,
  MAX_BOOST_RUNS_PER_HOUR, BOOST_TTL_MS,
} from '@/worker-ads/lane-boost'
import type { LaneRunEntry } from '@/worker-ads/lane-run-history'

/**
 * 📈 **부족분 자동 보강** — "한 곳이 덜 나오면 다른 곳을 더 돌린다"(2026-08-19 대표).
 *
 * ## 이 테스트가 지키는 것의 대부분은 **안 올리는 조건**이다
 * 보강은 외부 API 를 더 두드리는 일이라, 잘못 켜지면 상대에게도 우리에게도 손해다.
 *
 * ## 못 막는 것
 * - 보강이 실제로 수확을 늘리는지 — 라이브 추이로만 안다(기대치 +500/일, 부족분의 10% 안팎).
 * - 3배가 적정한지 — 네이버 쿼터는 0.7% 사용이라 여유가 크지만, 우리 CPU 는 라이브로 봐야 한다.
 */
const ok = (n = 100): LaneRunEntry => ({ t: '2026-08-19T00:00', ok: true, n, f: n })
const bad = (): LaneRunEntry => ({ t: '2026-08-19T00:00', ok: false, n: 0, f: 0, e: '네트워크 오류' })

describe('planBoostRuns — 부족할 때만, 계단으로', () => {
  it('정상이면 그대로', () => {
    expect(planBoostRuns(1.0)).toBe(1)
    expect(planBoostRuns(0.75)).toBe(1)
  })
  it('주의(70% 미만)면 한 단계', () => expect(planBoostRuns(0.6)).toBe(2))
  it('🩸 라이브 형상(반토막 미만)이면 최대', () => {
    expect(planBoostRuns(0.34)).toBe(MAX_BOOST_RUNS_PER_HOUR)
  })
  it('🔒 근거가 없으면 안 올린다', () => {
    expect(planBoostRuns(null)).toBe(1)
    expect(planBoostRuns(Number.NaN)).toBe(1)
  })
  it('🔒 상한을 넘지 않는다 — 외부 API 예의와 우리 CPU 양쪽의 안전선', () => {
    expect(planBoostRuns(0.01)).toBeLessThanOrEqual(MAX_BOOST_RUNS_PER_HOUR)
  })
  it('계단이라 매일 미세하게 흔들리지 않는다', () => {
    expect(new Set([0.69, 0.6, 0.51].map(r => planBoostRuns(r))).size).toBe(1)
  })
})

describe('laneCanAbsorb — 실패 중인 레인을 3배로 돌리지 않는다', () => {
  it('🩸 최근에 실패가 있으면 거부 — 실패만 3배가 된다', () => {
    expect(laneCanAbsorb([ok(), bad(), ok(), ok()])).toBe(false)
  })
  it('🔒 아무것도 못 캐고 있으면 거부(마른 레인을 더 돌려도 0×3=0)', () => {
    expect(laneCanAbsorb([ok(0), ok(0), ok(0), ok(0)])).toBe(false)
  })
  it('🔒 근거가 얇으면 거부', () => {
    expect(laneCanAbsorb([ok()])).toBe(false)
    expect(laneCanAbsorb([])).toBe(false)
  })
  it('건강하고 실제로 캐고 있으면 허용', () => {
    expect(laneCanAbsorb([ok(25), ok(30), ok(20)])).toBe(true)
  })
})

describe('readBoost — 켜진 채 잊히지 않는다', () => {
  const now = 1_000_000
  it('🔒 기한이 지나면 없는 것 — 감시가 멎으면 보강도 자동으로 풀린다', () => {
    expect(readBoost({ runs: 3, until: now - 1 }, now)).toBe(0)
  })
  it('유효하면 그 값', () => expect(readBoost({ runs: 3, until: now + 1000 }, now)).toBe(3))
  it('🔒 저장값이 깨져 있어도 0', () => {
    expect(readBoost(null, now)).toBe(0)
    expect(readBoost('x', now)).toBe(0)
    expect(readBoost({ runs: 'a', until: now + 1 }, now)).toBe(0)
  })
  it('🔒 저장값이 상한을 넘겨도 잘라 읽는다', () => {
    expect(readBoost({ runs: 99, until: now + 1000 }, now)).toBe(MAX_BOOST_RUNS_PER_HOUR)
  })
  it('기한은 하루 판정 주기보다 넉넉하다(한 번 걸렀다고 꺼지면 진동한다)', () => {
    expect(BOOST_TTL_MS).toBeGreaterThan(24 * 3600 * 1000)
  })
})

describe('🔒 인플루언서 collect 는 보강 대상이 아니다 — 대표 확인 사항이다', () => {
  it('COMPENSATORS 에 collect 가 없다', () => {
    const all = Object.values(COMPENSATORS).flat()
    expect(all).not.toContain('collect')
    expect(all).toContain('collect-company')
  })
  it('왜 제외인지가 코드에 남아 있다(다음 세션이 무심코 넣지 않게)', () => {
    const src = readFileSync('src/worker-ads/lane-boost.ts', 'utf8')
    expect(src).toContain('네이버 차단 리스크')
  })
})

describe('🔌 배선', () => {
  const alarm = readFileSync('src/worker-ads/lane-alarm.ts', 'utf8')
  const apply = readFileSync('src/worker-ads/lane-boost-apply.ts', 'utf8')
  it('🩸 핫패스에 D1 읽기를 안 얹는다 — 러너가 같은 인보케이션의 예산을 쓴다', () => {
    const block = alarm.slice(alarm.indexOf('const baseCap'), alarm.indexOf('const bucket'))
    expect(block).toContain("this.ctx.storage.get<unknown>('boost')")
    expect(block).not.toContain('DB.prepare')
  })
  it('보강은 자기 건강 검사를 통과해야 저장된다', () => {
    expect(alarm).toContain('const accept = runs > 0 && laneCanAbsorb(hist)')
  })
  it('회복 시 보강을 걷어 준다(올리기만 하고 안 내리면 영구 증설이 된다)', () => {
    expect(apply).toContain('runs > 1 ? runs : 0')
  })
  it('판정이 실제로 돈 회차에서만 적용한다(매시간 밀어 넣으면 진동한다)', () => {
    const runners = readFileSync('src/worker-ads/lane-alarm-runners.ts', 'utf8')
    expect(runners).toContain('if (r.ran && r.verdicts)')
  })
})
