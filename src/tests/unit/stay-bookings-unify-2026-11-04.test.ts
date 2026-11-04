/**
 * 🗓️ 숙소 예약 창 = 이용권 구매 창 움직임 · 사장님 예약 화면 하나 (2026-11-04 대표 "응 다 해줘 합쳐")
 *
 * 고정하는 것:
 *  ① 숙소 예약 창(객실 하나·여러 객실) 줄이 차례로 올라오고 결제 금액이 톡 튄다 — 이용권 구매 창과 **같은 CSS**(같은 id)
 *  ② 예약 창이 주지 않는 할인을 보여 주지 않는다 — 결제 금액 = 객실 총액(소개 할인은 통일 뒤 언제나 0)
 *  ③ 사장님 예약 = 화면 하나(`/seller/bookings`, 안에서 시간 예약 | 숙소 예약), 옛 두 주소는 그리로, 탭 칸 하나
 * ⚠️ 못 보는 것: 움직임이 보기 좋은지(그려서 본다) · 실제 사장님 계정에서 두 목록이 다 뜨는지(라이브 판정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const read = (p: string) => readFileSync(p, 'utf-8')

describe('숙소 예약 창 움직임', () => {
  const m = read('src/pages/stay-detail/StayBookingModals.tsx')
  it('① 이용권 구매 창과 같은 움직임 CSS', () => {
    const bar = read('src/pages/group-buy/DealBottomBar.tsx')
    const css = (s: string) => /injectMotionCss\('ur-m-buysheet', `([^`]+)`\)/.exec(s)?.[1]
    expect(css(m), '숙소 창에 움직임이 없다').toBeTruthy()
    expect(css(m)).toBe(css(bar)) // 같은 id 라 먼저 불린 쪽 한 벌만 꽂힌다 — 내용이 갈리면 화면마다 다르게 움직인다
    expect((m.match(/\{\.\.\.row\(\d\)\}/g) || []).length).toBe(6) // 두 창 × (요약 · 손님 정보 · 요청)
    expect((m.match(/ur-buy-save/g) || []).length).toBeGreaterThanOrEqual(2)
  })
  it('② 할인가가 아니라 객실 총액', () => {
    expect(m).not.toContain('추천 할인 -{room.discount_pct}%')
    expect(m).not.toContain('room.discounted_price || room.total_price')
    expect(m).not.toContain('(할인 전)')
  })
})

describe('사장님 예약 화면 하나', () => {
  it('③ 한 화면 · 옛 주소는 그리로 · 탭 칸 하나', () => {
    const r = read('src/routes/seller.routes.tsx')
    expect(r).toContain('<Route path="/seller/bookings" element={')
    expect(r).toContain('<Route path="/seller/appointments" element={<Navigate to="/seller/bookings" replace />} />')
    expect(r).toContain('<Route path="/seller/stays/bookings" element={<Navigate to="/seller/bookings?tab=stay" replace />} />')
    const page = read('src/pages/SellerBookingsPage.tsx')
    expect(page).toContain("const tab: BookingsTab = params.get('tab') === 'stay' ? 'stay' : 'time'")
    for (const f of ['src/pages/SellerAppointmentsPage.tsx', 'src/pages/SellerStaysBookingsPage.tsx']) {
      expect(read(f), `${f} 가 안에 들어가도 바깥 틀을 또 그린다`).toContain('const Frame = embedded ? EmbeddedFrame : SellerLayout')
    }
    const g = read('src/components/seller/seller-tab-groups.ts')
    const orders = g.slice(g.indexOf("labelKey: 'seller.orders'"), g.indexOf("labelKey: 'seller.revenue'"))
    expect((orders.match(/path: '\/seller\/bookings'/g) || []).length).toBe(1)
  })
})
