import { describe, it, expect } from 'vitest'
import { wholesaleSettlementAvailableAt } from '@/features/supply/api/wholesale-settlement'

// 🗓️ 2026-06-23 (대표 확정): 도매 정산 = "금주(월~일 KST) 발주 → 차주 목요일 00:00 KST".
//   회귀 방지: 주 경계(월~일 묶음)·차주 목요일·KST 오프셋이 바뀌면 CI 가 잡도록.
//   KST 시각 → UTC epoch ms 변환 헬퍼.
const kst = (y: number, m: number, d: number, h = 12) => Date.UTC(y, m - 1, d, h - 9, 0, 0)

describe('wholesaleSettlementAvailableAt — 금주(월~일) → 차주 목요일 KST', () => {
  // 2026-06-22(월)~06-28(일) 발주 → 전부 2026-07-02(목) 00:00 KST = 2026-07-01T15:00:00.000Z(UTC)
  const EXPECTED = '2026-07-01T15:00:00.000Z'

  it('월요일 발주 → 차주 목(10일 뒤)', () => {
    expect(wholesaleSettlementAvailableAt(kst(2026, 6, 22, 10))).toBe(EXPECTED)
  })
  it('일요일 23시 발주 → 같은 차주 목(주 경계 안)', () => {
    expect(wholesaleSettlementAvailableAt(kst(2026, 6, 28, 23))).toBe(EXPECTED)
  })
  it('주 중간(목) 발주 → 차주 목', () => {
    expect(wholesaleSettlementAvailableAt(kst(2026, 6, 25, 15))).toBe(EXPECTED)
  })
  it('같은 주 7개 요일 모두 동일 목요일로 묶임', () => {
    const days = [22, 23, 24, 25, 26, 27, 28].map((d) => wholesaleSettlementAvailableAt(kst(2026, 6, d)))
    expect(new Set(days).size).toBe(1)
    expect(days[0]).toBe(EXPECTED)
  })
  it('다음 주(월) 발주 → 그 다음 목(한 주 뒤)', () => {
    // 2026-06-29(월)~07-05(일) → 2026-07-09(목) 00:00 KST = 2026-07-08T15:00:00.000Z
    expect(wholesaleSettlementAvailableAt(kst(2026, 6, 29, 10))).toBe('2026-07-08T15:00:00.000Z')
  })
  it('결과는 항상 목요일 00:00 KST', () => {
    const iso = wholesaleSettlementAvailableAt(kst(2026, 6, 24, 9))
    const back = new Date(new Date(iso).getTime() + 9 * 3600_000) // UTC → KST 벽시계
    expect(back.getUTCDay()).toBe(4)      // 목요일
    expect(back.getUTCHours()).toBe(0)
    expect(back.getUTCMinutes()).toBe(0)
  })
})
