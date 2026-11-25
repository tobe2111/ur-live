/**
 * 💰 주간 정산 최소 금액(어드민) + 월말 상한 — 2026-11-25 대표 *"고치면 좋은 점 두가지도 해줘. 매장의 경우에는 정산을 해줘야"*
 *
 * 고정하는 것: ① 최소 금액은 설정값(비었거나 이상값이면 1만 원, 0 = 최소 없음)
 *   ② 그달 마지막 목요일 회차는 금액과 상관없이(1원 이상) — 판매가 적은 매장도 한 달 넘게 기다리지 않는다
 *   ③ 주간 정산 cron 이 이 판정을 쓴다 · 사장님 안내가 같은 규칙을 말한다.
 * ⚠️ 못 보는 것: 실제 은행 이체(사람이 한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolvePayoutMin, upcomingPayoutThursday, isLastThursdayOfMonth, effectivePayoutMin, payoutMinLabel } from '@/shared/store-payout-min'

const read = (p: string) => readFileSync(p, 'utf8')

describe('① 최소 금액', () => {
  it('비었거나 이상값이면 1만 원 · 0 은 최소 없음 · 값은 그대로', () => {
    for (const v of [undefined, '', 'abc', '-1', '99999999']) expect(resolvePayoutMin(v)).toBe(10000)
    expect(resolvePayoutMin('0')).toBe(0)
    expect(resolvePayoutMin('30000')).toBe(30000)
  })
})

describe('② 월말 상한', () => {
  it('월요일 09:45 KST 회차의 정산 목요일은 같은 주 목요일', () => {
    expect(upcomingPayoutThursday(Date.parse('2026-11-23T00:45:00Z'))).toBe('2026-11-26') // 11-23(월) KST
  })
  it('마지막 목요일 판정 — 11-26 은 11월 마지막, 11-19 는 아님, 12-31 은 12월 마지막', () => {
    expect(isLastThursdayOfMonth('2026-11-26')).toBe(true)
    expect(isLastThursdayOfMonth('2026-11-19')).toBe(false)
    expect(isLastThursdayOfMonth('2026-12-31')).toBe(true)
  })
  it('월말 회차면 최소 1원, 아니면 설정값', () => {
    expect(effectivePayoutMin(10000, Date.parse('2026-11-23T00:45:00Z'))).toMatchObject({ min: 1, monthEnd: true })
    expect(effectivePayoutMin(10000, Date.parse('2026-11-16T00:45:00Z'))).toMatchObject({ min: 10000, monthEnd: false })
    expect(effectivePayoutMin(0, Date.parse('2026-11-16T00:45:00Z')).min).toBe(1)
    expect(payoutMinLabel(10000)).toBe('1만 원 이상이면 매주 목요일, 그보다 적으면 그달 마지막 목요일')
  })
})

describe('③ 배선 · 안내', () => {
  it('주간 정산 cron 이 설정 + 월말 판정을 쓴다(상수 직접 사용 아님)', () => {
    const src = read('src/worker/cron/payouts-generate.ts')
    expect(src).toMatch(/effectivePayoutMin\(resolvePayoutMin\(minRow\?\.value\), now\.getTime\(\)\)/)
    expect(src).toMatch(/if \(pending < MIN_AMOUNT\) continue/)
    expect(src).not.toMatch(/const MIN_AMOUNT = REFUND_POLICY\.COMMISSION_MIN_WITHDRAWAL/)
  })
  it('사장님 정산 화면 · FAQ · 가이드가 이월과 월말 규칙을 말한다', () => {
    expect(read('src/pages/user-profile/seller-section/PayoutSheet.tsx')).toMatch(/그달 마지막 목요일에는 금액과 상관없이/)
    expect(read('src/shared/landing-faq.ts')).toMatch(/F\.minPayoutRule/)
    expect(read('src/features/guides/api/guide-seed-settlement.ts')).toMatch(/그달 마지막 목요일엔 금액과 상관없이/)
  })
})
