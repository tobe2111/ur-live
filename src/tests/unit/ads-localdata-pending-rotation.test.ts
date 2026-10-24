/**
 * 🔁 **인허가 수집 미완 일자 큐 — 한 날이 모든 회차를 독식하지 않는다** (2026-10-24 라이브 실측).
 *
 *   대표 신고: *"파트너풀 (B2B) 지금 완벽하지 않음. 업종 구별도 완벽하지 않음."*
 *   재니 매장후보 19업종 중 **11업종이 2026-10-16 04:00 그 한 분에 각 10건**씩 들어온 뒤 멈춰 있었고
 *   (정확히 같은 수는 데이터가 아니라 **고장의 지문**이다) 최근 7일 수집은 6업종뿐이었다.
 *
 *   원인: 일일 레인이 미완 일자 큐를 **앞에서부터** 드레인하는데, 실패한 날이 **그 자리에 그대로**
 *   저장돼 다음 회차도 같은 날부터 시작했다. 요청당 타임아웃 20초 × 회차 마감 ~40초 =
 *   **회차당 2요청**이라 그 하나가 전부를 막았다. 라이브 지문: `ads_localdata_pending` 이
 *   **14일 전부 `idx: 0`**(= 한 번도 첫 업종을 못 넘겼다) · 예산은 `spent 5 / 240` 으로 남아 있었다.
 *
 *   ⚠️ 이 검사가 **못 막는 것**: 상대 서버가 죽어 있는 동안의 0건은 못 막는다(그건 외부 장애다).
 *   막는 것은 "장애가 끝났을 때도 밀린 날들이 차례를 받지 못하는" 구조다. 실제 유입 회복은
 *   라이브 `diag.pending_days` 와 업종별 신규 건수로 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { rotatePending, MAX_PENDING_DAYS, MAX_CONSEC_UPJONG_FAILS, type PendingDay } from '@/features/marketing/api/localdata-pending'

const d = (day: string, idx = 0): PendingDay => ({ day, idx })

describe('미완 일자 큐 회전', () => {
  it('못 끝낸 날은 꼬리로 간다 — 다음 회차의 머리가 **다른 날**이 된다', () => {
    const untouched = [d('20261011'), d('20261012')]
    const retried = [d('20261010')] // 이번 회차에 손댔지만 실패
    const next = rotatePending(untouched, retried)
    expect(next.map(x => x.day)).toEqual(['20261011', '20261012', '20261010'])
    expect(next[0].day, '다음 회차는 실패한 날이 아닌 다른 날부터').not.toBe('20261010')
  })

  it('손대지 않은 날끼리의 순서는 보존된다(오래된 것 먼저)', () => {
    const next = rotatePending([d('20261011'), d('20261012'), d('20261013')], [])
    expect(next.map(x => x.day)).toEqual(['20261011', '20261012', '20261013'])
  })

  it('이어받을 업종 지점(idx)은 그대로 실린다', () => {
    const next = rotatePending([d('20261011', 4)], [d('20261010', 7)])
    expect(next).toEqual([{ day: '20261011', idx: 4 }, { day: '20261010', idx: 7 }])
  })

  it('🩸 라이브 재현 — 14일 전부 idx 0 에서 머리가 실패하면 교착이 풀린다', () => {
    // 2026-10-24 실측 상태: 20261010..20261023 (14일) 전부 idx 0.
    const days = Array.from({ length: 14 }, (_, i) => `202610${String(10 + i).padStart(2, '0')}`)
    let queue = days.map(x => d(x))
    // 회차마다 머리 하나만 손대고 실패한다고 가정(요청당 20초 × 마감 40초).
    const heads: string[] = []
    for (let run = 0; run < 4; run++) {
      heads.push(queue[0].day)
      queue = rotatePending(queue.slice(1), [queue[0]])
    }
    expect(heads, '네 회차가 서로 다른 날을 집는다').toEqual(['20261010', '20261011', '20261012', '20261013'])
    expect(new Set(heads).size).toBe(4)
    expect(queue).toHaveLength(14) // 아무 날도 잃지 않았다
  })

  it('🔒 상한을 넘으면 **오래된 날짜**를 버리고 순서는 건드리지 않는다', () => {
    const untouched = Array.from({ length: 14 }, (_, i) => d(`202610${String(10 + i).padStart(2, '0')}`))
    const retried = [d('20261009')] // 가장 오래된 날이 꼬리에 있다
    const next = rotatePending(untouched, retried)
    expect(next).toHaveLength(MAX_PENDING_DAYS)
    expect(next.map(x => x.day), '버린 것은 가장 오래된 20261009 뿐이고 나머지 순서는 그대로')
      .toEqual(untouched.map(x => x.day))
  })

  it('🔒 옛 `slice(-N)` 으로 되돌아가지 않는다 — 그건 회전시킨 **오래된** 날을 살리고 미착수 날을 버린다', () => {
    // 현실 모양: 실패해서 꼬리로 돈 날은 보통 **가장 오래된** 날(큐 머리였으니까)이다.
    //   옛 `slice(-N)` 은 배열 꼬리를 남기므로 **그 오래된 실패 날을 살리고** 더 새로운 미착수 날을
    //   떨어뜨린다 = 회전으로 양보한 차례를 그 자리에서 되돌린다.
    const untouched = Array.from({ length: 14 }, (_, i) => d(`202610${String(11 + i).padStart(2, '0')}`)) // 11..24
    const retried = [d('20261010')]
    const next = rotatePending(untouched, retried).map(x => x.day)
    const naiveTail = [...untouched, ...retried].slice(-MAX_PENDING_DAYS).map(x => x.day)
    expect(next).toHaveLength(MAX_PENDING_DAYS)
    expect(next, '순수 꼬리 자르기와 결과가 같으면 회전 보호가 없는 것').not.toEqual(naiveTail)
    expect(naiveTail, '옛 방식은 오래된 실패 날을 남기고 20261011 을 버린다').toContain('20261010')
    expect(naiveTail).not.toContain('20261011')
    expect(next, '새 방식은 가장 오래된 날짜를 버린다').not.toContain('20261010')
    expect(next[0], '미착수 날은 오래된 것부터 그대로 남는다').toBe('20261011')
  })

  it('빈 입력은 빈 큐', () => {
    expect(rotatePending([], [])).toEqual([])
  })

  it('검사 대상이 실제로 존재한다 — 0건 통과를 성공으로 오인하지 않게', () => {
    expect(MAX_PENDING_DAYS).toBe(14)
    expect(MAX_CONSEC_UPJONG_FAILS).toBeGreaterThanOrEqual(2) // 전역 장애 안전판이 살아 있다
    expect(typeof rotatePending).toBe('function')
  })
})
