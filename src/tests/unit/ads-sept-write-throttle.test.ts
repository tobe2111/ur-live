/**
 * 🚨 2026년 9월 한시 쓰기 스로틀 — **스스로 풀리는지**가 이 시험의 핵심이다.
 *
 * 9/2 하루 4,554만 행 폭주가 월 포함분(5,000만)을 통째로 먹어, 9월 남은 기간은 누가 쓰든
 * 과금 구간이 됐다. 대표 지시 "이번 달은 과금 안 되게" 로 하루 120만 → 3만.
 *
 * ⚠️ **이 시험이 지키는 것 중 제일 중요한 것은 ③ 자동 해제**다. 되돌리는 것을 잊으면
 *   10월에도 수집이 3만에 묶이는데, 그건 에러가 안 나서 아무도 모른다 — 이 레포가 반복해
 *   만난 "실패가 아니라 조용한 부재" 다.
 *
 * ⚠️ **이 시험이 못 막는 것**: 라이브 env 에 `ADS_DAILY_WRITE_BUDGET` 가 설정되면 코드값은
 *   무시된다(그게 ②의 의도다). 실제 적용 여부는 하트비트의 `wbudget` 으로만 판정된다.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveWriteBudget, DEFAULT_DAILY_WRITE_BUDGET,
  SEPT_2026_WRITE_THROTTLE, SEPT_2026_THROTTLE_UNTIL_MS,
} from '@/worker-ads/read-budget'

const DURING = Date.parse('2026-09-15T00:00:00Z')
const AFTER = Date.parse('2026-10-01T00:00:00Z')

describe('9월 한시 쓰기 스로틀', () => {
  it('① 9월에는 3만으로 조인다', () => {
    expect(resolveWriteBudget({}, DURING)).toBe(SEPT_2026_WRITE_THROTTLE)
    expect(SEPT_2026_WRITE_THROTTLE).toBe(30_000)
  })

  it('② env 를 명시하면 그 값이 이긴다 — 대표가 언제든 되돌릴 수 있어야 한다', () => {
    expect(resolveWriteBudget({ ADS_DAILY_WRITE_BUDGET: '500000' }, DURING)).toBe(500_000)
    // 0 은 "끔"(무제한) — 스로틀 창 안에서도 그 규약은 그대로다(놀라지 않게).
    expect(resolveWriteBudget({ ADS_DAILY_WRITE_BUDGET: '0' }, DURING)).toBe(0)
  })

  it('③ 10/1 UTC 에 스스로 풀린다 (되돌림을 잊어도 안전하다)', () => {
    expect(resolveWriteBudget({}, AFTER)).toBe(DEFAULT_DAILY_WRITE_BUDGET)
    expect(resolveWriteBudget({}, AFTER + 86_400_000)).toBe(DEFAULT_DAILY_WRITE_BUDGET)
    // 경계 바로 앞은 아직 조여 있다 — 부등호가 뒤집히면 한 달 일찍 풀린다.
    expect(resolveWriteBudget({}, SEPT_2026_THROTTLE_UNTIL_MS - 1)).toBe(SEPT_2026_WRITE_THROTTLE)
  })

  it('④ 해제 시각이 10/1 00:00 UTC 다 (KST 로 10/1 09:00 — 포함분 리셋과 같은 경계)', () => {
    expect(new Date(SEPT_2026_THROTTLE_UNTIL_MS).toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('⑤ 스로틀이 0 이 아니다 — 0 은 "끔"이라 정반대가 된다', () => {
    expect(SEPT_2026_WRITE_THROTTLE).toBeGreaterThan(0)
  })

  it('⑥ 기본값(해제 후 값)은 건드리지 않았다 — 10월 정상 수집이 그 값에 달려 있다', () => {
    expect(DEFAULT_DAILY_WRITE_BUDGET).toBe(1_200_000)
  })
})
