/**
 * 🔁 **놀고 있는 몫을 굶는 도메인에** — 처리량 수리 (2026-08-11 대표 *"처리량 문제도 해결해줘"*).
 *
 * ## 근거는 라이브 스냅샷 하나다 (`ads_dispatch_last`, 2026-08-11 02:00 UTC)
 * ```
 *   per_tick 12  plan free
 *   influencer  몫 5  run 3          → 2 놀고 있다
 *   company     몫 5  run 1          → 4 놀고 있다
 *   prospect    몫 1  run 1  미룸 1  ← enrich-prospects 가 여기서 밀린다(실측 주기 2시간)
 *   wholesale   몫 1  run 1  미룸 0
 * ```
 * **여섯 자리가 비었는데 한 레인이 밀렸다.** 예산이 모자란 게 아니라 배분이 낭비하고 있었다 —
 * 비율(3:3:1:1)은 *경쟁이 있을 때* 나누는 규칙인데 경쟁 없는 도메인의 몫까지 붙잡고 있었다.
 *
 * ## ⚠️ 이 테스트가 지키는 절대선: **총량 불변**
 * 총량은 CPU 한도가 정한다(`FREE_LANES_PER_TICK` docblock 의 실측 — 8 로 두면 절반이 죽었다).
 * 재분배는 **같은 총량 안에서 자리를 옮기는 것**이지 늘리는 게 아니다. 늘리는 순간 그 실측을
 * 무시하고 부모를 죽이던 자리로 되돌아간다.
 */
import { describe, it, expect } from 'vitest'
import { redistributeSlack, selectLanesByDomain, type LaneCandidate } from '@/worker-ads/dispatch-budget'
import { ADS_DOMAINS, type AdsDomain } from '@/worker-ads/lane-domains'

const sum = (b: Record<AdsDomain, number>): number => ADS_DOMAINS.reduce((a, d) => a + (b[d] || 0), 0)

describe('redistributeSlack — 총량은 그대로, 자리만 옮긴다', () => {
  /** 🩸 라이브 스냅샷 그 자체. 고치기 전엔 prospect 가 1 이라 한 레인이 매 회차 밀렸다. */
  it('🔒 라이브 사례: 노는 6자리 중 1을 굶는 도메인이 받는다', () => {
    const budgets = { influencer: 5, company: 5, prospect: 1, wholesale: 1 }
    const need = { influencer: 3, company: 1, prospect: 2, wholesale: 1 }
    const got = redistributeSlack(budgets, need)
    expect(got.prospect).toBeGreaterThanOrEqual(2)   // 미뤄지지 않는다
    expect(sum(got)).toBe(sum(budgets))              // 총량 불변
  })

  it('🔒 총량은 어떤 입력에서도 안 늘어난다', () => {
    const cases: Array<[Record<AdsDomain, number>, Record<AdsDomain, number>]> = [
      [{ influencer: 5, company: 5, prospect: 1, wholesale: 1 }, { influencer: 0, company: 0, prospect: 9, wholesale: 9 }],
      [{ influencer: 1, company: 1, prospect: 1, wholesale: 1 }, { influencer: 4, company: 4, prospect: 4, wholesale: 4 }],
      [{ influencer: 3, company: 0, prospect: 0, wholesale: 0 }, { influencer: 0, company: 0, prospect: 0, wholesale: 0 }],
    ]
    for (const [b, n] of cases) expect(sum(redistributeSlack(b, n)), JSON.stringify(b)).toBe(sum(b))
  })

  /** 전부 자기 몫을 다 쓰면 대표가 정한 비율이 그대로다 — 그때가 비율이 의미를 갖는 유일한 상태다. */
  it('🔒 경쟁이 있으면 아무것도 안 옮긴다 (비율 보존)', () => {
    const b = { influencer: 5, company: 5, prospect: 1, wholesale: 1 }
    expect(redistributeSlack(b, { influencer: 9, company: 9, prospect: 9, wholesale: 9 })).toEqual(b)
  })

  it('🔒 필요 이상 주지 않는다 (받아도 노는 자리는 안 만든다)', () => {
    const got = redistributeSlack({ influencer: 8, company: 0, prospect: 0, wholesale: 0 }, { influencer: 1, company: 1, prospect: 0, wholesale: 0 })
    expect(got.company).toBe(1)
    expect(sum(got)).toBe(8)
  })

  /** 한 도메인이 잉여를 독식하면 다른 굶는 도메인이 그대로 남는다 — 라운드로빈이어야 한다. */
  it('🔒 잉여를 한 도메인이 독식하지 않는다', () => {
    const got = redistributeSlack({ influencer: 6, company: 0, prospect: 0, wholesale: 0 }, { influencer: 0, company: 3, prospect: 3, wholesale: 3 })
    expect(got.company).toBeGreaterThan(0)
    expect(got.prospect).toBeGreaterThan(0)
    expect(got.wholesale).toBeGreaterThan(0)
    expect(sum(got)).toBe(6)
  })

  it('결정론 — 같은 입력이면 같은 답(회차마다 흔들리면 예측할 수 없다)', () => {
    const b = { influencer: 5, company: 5, prospect: 1, wholesale: 1 }
    const n = { influencer: 3, company: 1, prospect: 4, wholesale: 2 }
    expect(redistributeSlack(b, n)).toEqual(redistributeSlack(b, n))
  })
})

describe('배선 — selectLanesByDomain 이 실제로 재분배를 쓴다', () => {
  const lane = (beat: string, periodMin = 60): LaneCandidate => ({ beat, path: `/__ads/${beat}`, periodMin, gapMin: 150 } as LaneCandidate)

  /**
   * 🩸 계산해 놓고 안 쓰면 스냅샷은 그대로다 — 이 레포가 반복해 만난 클래스라 배선을 결과로 고정한다.
   *   라이브와 같은 구성(influencer 3 · company 1 · prospect 2 · wholesale 1, per_tick 12).
   */
  it('🔒 라이브와 같은 구성에서 미뤄지는 레인이 없다', () => {
    const lanes = [
      lane('consented-reminder'), lane('inbound-onboarding'), lane('social-maintenance'),
      lane('enrich-company'),
      lane('collect-localdata'), lane('enrich-prospects'),
      lane('collect-maker'),
    ]
    const sel = selectLanesByDomain(lanes, 12, {}, 0)
    expect(sel.deferred.map(l => l.beat)).toEqual([])
    expect(sel.run.length).toBe(lanes.length)
  })

  /** 총량을 넘겨선 안 된다 — 재분배가 상한을 뚫으면 부모가 죽는다(그게 이 예산의 존재 이유다). */
  it('🔒 레인이 몫보다 많으면 여전히 미룬다 (상한을 뚫지 않는다)', () => {
    const many = Array.from({ length: 20 }, (_, i) => lane(`collect-localdata-${i}`))
    const sel = selectLanesByDomain(many, 4, {}, 0)
    expect(sel.run.length).toBeLessThanOrEqual(4)
    expect(sel.deferred.length).toBeGreaterThan(0)
  })
})
