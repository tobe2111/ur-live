/**
 * 📈 **YT 우선 배분 + 중복 발송 제거** — 2026-08-04 대표 승인 *"2,3 진행"*.
 *
 * ## 왜 이 두 개가 한 파일인가
 * 둘 다 **"같은 예산으로 더 많은 이메일"** 이라는 하나의 목적함수를 다르게 민다:
 * ②는 *새 이메일을 더 싸게 얻는 쪽*, ③은 *이미 얻은 이메일을 두 번 쓰지 않는 쪽*.
 *
 * ## ⚠️ 이 테스트가 못 보는 것
 * 실제 수율(YT 26.7% vs 블로거 21.2%)은 **라이브 값**이라 여기서 검증할 수 없다. 여기서 고정하는 건
 * *배분 규칙이 그 판단대로 동작하는가* 뿐이다. 수율이 뒤집히면 이 테스트는 여전히 초록이므로,
 * `planInfluencerEnrich` docblock 의 **"다시 잴 것"** 조건을 사람이 지켜야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  planInfluencerEnrich, naverRoomFromRemaining, naverRoomWithYtReserve,
} from '@/features/marketing/api/influencer-enrich-lane'
import { dedupeByEmail } from '@/features/marketing/api/outreach-queue'

/** 라이브 실측 예산(2026-08-04 `budget_total: 45`). 여기서 배분이 실제로 어떻게 되는지가 관심사다. */
const LIVE_BUDGET = 45

describe('② YT 몫 — 서브리퀘스트당 이메일이 높은 쪽에 예산을 준다', () => {
  /**
   * ⚠️ **행 수로 비교하면 안 된다** — 주입 검증이 이걸 잡았다. 옛 비율(0.35)에서도 `ytMax(14) > naverMax(10)`
   *   이라 "YT 가 더 많은 행"은 **양쪽 다 참**이고 테스트가 헛돌았다. 정책의 실체는 행이 아니라
   *   **예산 배분**이다(YT 1 fetch/행, 블로거 2 fetch/행): 0.55 → YT 20 vs 블로거 14, 0.35 → 14 vs 20 로 뒤집힌다.
   */
  it('🔒 라이브 예산에서 YT 가 블로거보다 많은 **예산**(fetch)을 받는다', () => {
    const { ytMax, naverMax } = planInfluencerEnrich(LIVE_BUDGET)
    expect(ytMax).toBeGreaterThan(naverMax * 2)
  })

  it('🔒 배분 총합이 예산을 넘지 않는다 — YT 1 fetch/행, 블로거 2 fetch/행', () => {
    for (const b of [20, 30, 45, 60]) {
      const { bioMax, naverMax, ytMax } = planInfluencerEnrich(b)
      expect(bioMax + ytMax + naverMax * 2, `budget ${b}`).toBeLessThanOrEqual(b)
    }
  })

  it('🔒 예산이 커져도 YT 상한 20 을 안 넘는다 — 그 위는 enrich 함수 내부 LIMIT 이 잘라 헛배정이 된다', () => {
    expect(planInfluencerEnrich(200).ytMax).toBe(20)
  })

  it('🔒 예산 0/음수에서 음수 배정이 나오지 않는다', () => {
    for (const b of [0, -5, 3]) {
      const p = planInfluencerEnrich(b)
      expect(Math.min(p.bioMax, p.naverMax, p.ytMax), `budget ${b}`).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('② 블로거 선두 회차 — YT 몫을 떼어 놓는다(안 그러면 그 회차 YT 는 0행)', () => {
  it('🔒 예약분만큼 블로거 방이 줄어든다', () => {
    const noReserve = naverRoomFromRemaining(45, 7)
    const withReserve = naverRoomWithYtReserve(45, 7, 21)
    expect(withReserve).toBeLessThan(noReserve)
  })

  it('🔒 예약 후에도 YT 가 쓸 예산이 남는다 — 이게 이 함수의 존재 이유다', () => {
    const reserve = 21
    const rows = naverRoomWithYtReserve(45, 7, reserve)
    expect(45 - rows * 2).toBeGreaterThanOrEqual(reserve)
  })

  it('🔒 예약 0(=블로거가 선두가 아님)이면 기존 동작과 완전히 같다', () => {
    for (const left of [10, 30, 45, 80]) {
      expect(naverRoomWithYtReserve(left, 7, 0), `left ${left}`).toBe(naverRoomFromRemaining(left, 7))
    }
  })

  it('🔒 예약이 예산보다 커도 음수가 아니라 0 으로 수렴한다', () => {
    expect(naverRoomWithYtReserve(10, 0, 999)).toBe(0)
  })

  it('🔒 NaN 을 0 으로 다룬다 — 스냅샷/env 가 깨져도 배분이 폭주하지 않는다', () => {
    expect(naverRoomWithYtReserve(45, 7, NaN)).toBe(naverRoomFromRemaining(45, 7))
  })
})

/**
 * 🔌 **배선** — 순수 함수만 테스트하면 "함수는 맞는데 아무도 안 부른다"를 못 본다.
 *   주입 검증이 실제로 이걸 잡았다: `naverRoomWithYtReserve` 를 옛 함수로 되돌려도 위 순수 테스트는
 *   전부 초록이었다(그 함수 자체는 여전히 옳으니까). 레인이 **그걸 쓰는지**를 따로 봐야 한다.
 */
describe('② 배선 — 레인이 실제로 예약분을 쓴다', () => {
  const LANE = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-enrich-lane.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')   // 주석 제거(주석에만 남아도 통과 방지)

  it('🔒 블로거 방 계산이 예약분을 받는 함수를 쓴다', () => {
    expect(LANE).toMatch(/enrichNaverActivity\(DB, budget, naverRoomWithYtReserve\(budget\.left, naverMax, ytReserve\)/)
  })

  it('🔒 블로거가 선두일 때만 예약분을 넘긴다 — 뒤에 돌 땐 YT 가 이미 썼으므로 또 빼면 예산을 버린다', () => {
    expect(LANE).toMatch(/await runNaver\(ytPlanned\)/)   // 선두
    expect(LANE).toMatch(/await runNaver\(\)/)            // 후행(기본 0)
  })

  it('🔒 예약분은 YT 가 실제로 쓸 수 있을 때만 잡는다(키·일일 units 없으면 0)', () => {
    expect(LANE).toMatch(/const ytPlanned = \(ytMax > 0 && ytRoom > 0 && env\.YOUTUBE_API_KEY\)/)
  })
})

describe('③ 같은 주소에 두 번 보내지 않는다', () => {
  it('🔒 중복 주소는 **먼저 나온 것**만 남는다 — 목록은 이미 좋은 순서로 정렬돼 있다', () => {
    const out = dedupeByEmail([
      { id: 1, email: 'a@b.com' }, { id: 2, email: 'c@d.com' }, { id: 3, email: 'A@B.com' },
    ])
    expect(out.map(r => r.id)).toEqual([1, 2])
  })

  it('🔒 대소문자·공백이 달라도 같은 사람으로 본다(DB 에 섞여 있다)', () => {
    expect(dedupeByEmail([{ email: ' Foo@Bar.COM ' }, { email: 'foo@bar.com' }])).toHaveLength(1)
  })

  it('🔒 이메일 없는 행은 **묶지 않는다** — 묶으면 전체 내보내기에서 무연락 리드가 한 명만 남는다', () => {
    const out = dedupeByEmail([{ id: 1, email: null }, { id: 2, email: '' }, { id: 3, email: undefined }])
    expect(out).toHaveLength(3)
  })

  it('🔒 순서를 바꾸지 않는다 — 점수순 정렬이 곧 "누구부터 보낼까"의 답이다', () => {
    const out = dedupeByEmail([{ id: 9, email: 'x@y.com' }, { id: 8, email: 'z@y.com' }, { id: 7, email: 'x@y.com' }])
    expect(out.map(r => r.id)).toEqual([9, 8])
  })
})
