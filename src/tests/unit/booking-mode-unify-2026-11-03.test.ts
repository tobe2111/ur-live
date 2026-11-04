/**
 * 🗓️ 이용권 등록 하나에서 예약 방식까지 (2026-11-03 숙소·예약 통일 ①)
 * 대표: *"처음에 이용권 등록, 매장 등록 이런 것 할 때도 통일감이 있어야 할텐데?"* → *"모두 해줘"*.
 *
 * 고정하는 것:
 *  - 숙박 판매가 = 객실 평일가 최저(카드 '1박 N원~'), 객실·시간표 판정
 *  - 숙소 정보는 **이용권과 같은 상품**에 붙는다(`/stays/:id/info`) — 옛 숙소 소개 할인·수수료는 받지 않는다
 *  - 예약 받는 화면이 주문 옆 탭에 있다(시간 예약 · 숙소 예약)
 * ⚠️ 못 보는 것: 실제 API 왕복(서버 INSERT 결과), 화면 모양 — 그건 그려서/스테이징에서 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stayFromPrice, stayRoomsError, slotsError, regionFromAddress, emptyRoom } from '@/pages/seller-meal-voucher/booking-mode'
import { emptyVoucherForm } from '@/pages/seller-meal-voucher/voucher-form'

const read = (p: string) => readFileSync(p, 'utf-8')

describe('예약 방식 판정', () => {
  it('숙박 판매가는 객실 평일가 최저, 0 은 빼고 본다', () => {
    expect(stayFromPrice([{ ...emptyRoom(), price_weekday: 90000 }, { ...emptyRoom(), price_weekday: 70000 }, emptyRoom()])).toBe(70000)
    expect(stayFromPrice([emptyRoom()])).toBe(0)
  })
  it('객실 판정 — 이름·요금·객실 수·인원', () => {
    expect(stayRoomsError([])).toMatch(/1개 이상/)
    expect(stayRoomsError([emptyRoom()])).toMatch(/이름/)
    const ok = { ...emptyRoom(), name: '더블', price_weekday: 1, price_weekend: 1 }
    expect(stayRoomsError([ok])).toBeNull()
    expect(stayRoomsError([{ ...ok, max_guests: 1, base_guests: 2 }])).toMatch(/최대 인원/)
  })
  it('시간표 판정 — 끝이 시작보다 늦어야', () => {
    expect(slotsError([])).toMatch(/1개 이상/)
    expect(slotsError([{ day_of_week: 1, start_time: '11:00', end_time: '10:00', capacity: 1 }])).toMatch(/늦어야/)
    expect(slotsError([{ day_of_week: 1, start_time: '10:00', end_time: '11:00', capacity: 1 }])).toBeNull()
  })
  it('매장 주소에서 지역을 뽑는다(다시 안 친다)', () => {
    expect(regionFromAddress('제주특별자치도 서귀포시 중문관광로 72')).toEqual({ sido: '제주특별자치도', sigungu: '서귀포시' })
  })
  it('새 폼의 기본값 — 바로 사용 · 객실 1칸 · 평일 시간표', () => {
    const f = emptyVoucherForm()
    expect(f.booking_mode).toBe('none')
    expect(f.stay_rooms).toHaveLength(1)
    expect(f.time_slots.length).toBeGreaterThan(0)
  })
})

describe('배선', () => {
  it('숙소 정보는 이용권과 같은 상품에 붙고, 옛 소개 할인·수수료는 0 으로 막는다', () => {
    const r = read('src/features/seller/api/seller-stays.routes.ts')
    expect(r).toContain("sellerStaysRoutes.post('/stays/:productId/info'")
    expect(r).toContain("referral_enabled: 0, influencer_discount_pct: 0, influencer_commission_pct: 0")
    expect(r).toContain("if (cat?.category !== 'stay_voucher')")
    expect(r).toContain('await insertStayInfo(c.env.DB, productId, body)')
  })
  it('외부 예약 링크는 외부 예약을 고른 때만 저장', () => {
    const page = read('src/pages/SellerMealVoucherNewPage.tsx')
    expect(page).toContain("external_booking_url: form.booking_mode === 'external' && form.category !== 'stay_voucher'")
  })
  it('예약 받는 화면이 주문 옆 탭에 있다', () => {
    const g = read('src/components/seller/seller-tab-groups.ts')
    const orders = g.slice(g.indexOf("labelKey: 'seller.orders'"), g.indexOf("labelKey: 'seller.revenue'"))
    // 🗓️ 2026-11-04 (대표 "합쳐"): 두 칸 → 예약 화면 하나. 안에서 [시간 예약 | 숙소 예약] (`SellerBookingsPage`).
    expect(orders).toContain("path: '/seller/bookings'")
    expect(orders).not.toContain("path: '/seller/stays/bookings'")
    expect(read('src/pages/SellerBookingsPage.tsx')).toContain("{tab === 'stay' ? <SellerStaysBookingsPage embedded /> : <SellerAppointmentsPage embedded />}")
  })
})
