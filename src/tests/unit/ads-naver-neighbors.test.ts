import { describe, it, expect } from 'vitest'
import { parseNaverNeighborCount } from '@/features/marketing/api/influencer-performance'

/**
 * 🏠 네이버 블로그 이웃수(규모 프록시) 파싱 — 네이버 오픈API 미제공이라 홈 HTML 에서 best-effort 추출.
 *   여러 레이아웃(JSON blob / "이웃 N명" / "N명의 이웃")을 커버하는지 + 오탐 0 검증.
 */
describe('parseNaverNeighborCount', () => {
  it('JSON blob buddyCount', () => {
    expect(parseNaverNeighborCount('...{"buddyCount":"1234","x":1}...')).toBe(1234)
    expect(parseNaverNeighborCount('buddyCount: 987 ')).toBe(987)
  })
  it('"이웃 <em>1,234</em>" 마크업', () => {
    expect(parseNaverNeighborCount('<span>이웃 <em>1,234</em></span>')).toBe(1234)
  })
  it('"이웃 5,678명" / "9,000명의 이웃"', () => {
    expect(parseNaverNeighborCount('이웃 5,678명')).toBe(5678)
    expect(parseNaverNeighborCount('9,000명의 이웃')).toBe(9000)
  })
  it('없거나 비정상이면 0(오탐 방지)', () => {
    expect(parseNaverNeighborCount('')).toBe(0)
    expect(parseNaverNeighborCount('<html>연락처 없음</html>')).toBe(0)
    expect(parseNaverNeighborCount('이웃 0명')).toBe(0)           // 0 은 미채움 취급
    expect(parseNaverNeighborCount('방문자 12,345명')).toBe(0)    // 이웃 아님 → 미매칭
  })
})
