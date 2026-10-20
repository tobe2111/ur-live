import { describe, it, expect } from 'vitest'
import { weeklySettlementCutoffUtc } from '@/worker/utils/settlement-schedule'

/**
 * 🗓️ 2026-06-23 주간 정산 정책 단위 테스트 — 월~일(KST) 사용분 → 차주 목요일(KST) 정산.
 * cutoff = 정산 대상 상한(UTC). used_at < cutoff 이면 정산.
 * 기준 주 W = 2026-06-22(월)~06-28(일). 차주 목요일 = 2026-07-02.
 * → W 가 정산되려면 cutoff = 2026-06-29 00:00 KST = '2026-06-28 15:00:00' UTC.
 */
const KST = 9 * 3600_000
// KST 벽시계(yyyy,mm,dd,hh) → 실제 epoch ms
const kstMs = (y: number, mo: number, d: number, h = 0) => Date.UTC(y, mo, d, h) - KST

describe('weeklySettlementCutoffUtc — 월~일 → 차주 목요일', () => {
  const W_SETTLED = '2026-06-28 15:00:00' // 주 06-22~06-28 포함(= 06-29 00:00 KST)
  const W_NOT_YET = '2026-06-21 15:00:00' // 주 06-22~06-28 미포함(= 06-22 00:00 KST)

  it('차주 목요일 당일(목 03:00 KST, cron 시각) → 그 주 정산', () => {
    // 2026-07-02(목) 03:00 KST
    expect(weeklySettlementCutoffUtc(kstMs(2026, 6, 2, 3))).toBe(W_SETTLED)
  })

  it('차주 목요일 00:00 KST 정각 → 정산 도래', () => {
    expect(weeklySettlementCutoffUtc(kstMs(2026, 6, 2, 0))).toBe(W_SETTLED)
  })

  it('차주 수요일 23:00 KST(목요일 직전) → 아직 정산 안 함', () => {
    expect(weeklySettlementCutoffUtc(kstMs(2026, 6, 1, 23))).toBe(W_NOT_YET)
  })

  it('차주 월요일 → 아직 정산 안 함(목요일까지 대기)', () => {
    expect(weeklySettlementCutoffUtc(kstMs(2026, 5, 29, 12))).toBe(W_NOT_YET)
  })

  it('cutoff 는 항상 월요일 00:00 KST 경계(=일 15:00 UTC)', () => {
    // 여러 요일에 호출해도 결과는 'YYYY-MM-DD 15:00:00' (KST 월요일 자정)
    for (const h of [0, 6, 12, 18, 23]) {
      const out = weeklySettlementCutoffUtc(kstMs(2026, 6, 2, h))
      expect(out.endsWith(' 15:00:00')).toBe(true)
    }
  })

  it('주 경계가 월을 넘어가도 정규화(2026-07-02 목 → 06-28 일)', () => {
    expect(weeklySettlementCutoffUtc(kstMs(2026, 6, 2, 10))).toBe(W_SETTLED)
  })
})
