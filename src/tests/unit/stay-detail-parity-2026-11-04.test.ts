/**
 * 🏨 숙소 상세 = 이용권 상세와 같은 기록 (2026-11-04, 대표 "합쳐줘" · "계속")
 * 숙소 상세에만 빠져 있던 것: 조회수(사장님 분석·인기순) · 최근 본 · 구매 흐름 · 결제 뒤 내 이용권 새로고침.
 * ⚠️ 못 보는 것: 서버가 그 기록을 실제로 받는지(엔드포인트 쪽 시험이 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const page = readFileSync('src/pages/StayDetailPage.tsx', 'utf-8')
const ret = readFileSync('src/pages/StayCheckoutReturnPage.tsx', 'utf-8')
describe('숙소 상세 기록', () => {
  it('조회수·최근 본·구매 흐름', () => {
    expect(page).toContain('useProductViewBeacon(productId)')
    expect(page).toContain("m.reportFunnel('view', productId)")
    expect(page).toContain('m.recordRecentlyViewed({ id: sp.id')
  })
  it('결제 확정 뒤 내 이용권을 새로 받는다(지갑 이용권이 생기므로)', () => {
    expect(ret).toContain("invalidateVouchers(); reportFunnel('success')")
  })
})
describe('숙소 폰 머리 = 이용권 폰 머리 (대표 "왜 서로 다른거야" → "합쳐줘")', () => {
  const head = readFileSync('src/pages/stay-detail/StayHeadCard.tsx', 'utf-8')
  it('[유형 · 성급 · 지역] → 제목 → 별점 → 가격, 이용권과 같은 순서', () => {
    const order = ['staySubLine(stay)', 'STAY_HEAD.h1', '<StarRating', 'formatNumber(minPrice)']
    const at = order.map((k) => head.indexOf(k))
    expect(at.every((n) => n > 0), `빠진 줄: ${order.filter((_, i) => at[i] < 0).join(', ')}`).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(page).toContain('<StayHeadCard stay={stay}')
  })
  it('폰 머리에 주소 원문 줄이 다시 서지 않는다 — 아래 위치 구역이 같은 말을 한다(이용권과 같다)', () => {
    expect(head).not.toContain('PinIcon')
    expect(page).not.toContain('<PinIcon')
  })
})
