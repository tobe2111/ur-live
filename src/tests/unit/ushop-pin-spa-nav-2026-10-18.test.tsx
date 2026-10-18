/**
 * 📌 유어샵 진열 카드 → 상세 **앱 안 이동**(2026-10-18 대표 결재 `2026-10-15-ushop-pin-spa-nav` 안 1).
 *
 * 지키는 것 넷:
 *   ① 누르면 **소개 값이 저장된다**(커미션의 근거) — 빠지면 화면은 같은데 귀속만 조용히 사라진다
 *   ② 클릭 기록 비콘이 **같은 상품**으로 간다(유어샵 통계)
 *   ③ 목적지는 정본 상세 SSOT — 숙소는 `/stays`
 *   ④ 바깥 공유 링크(`/u/:handle/p/:id`)는 그대로 서버 경유 + 서버의 클릭 기록은 한 함수
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 실제 결제에서 커미션이 적립되는지(머니 경로 — staging 실결제 1건이 판정한다)
 * - 비콘이 라이브에서 유실되는 비율(통계가 조금 모자랄 수 있다 — 커미션 무관)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { stripComments } from '../helpers/source-text'
import { pinHref, onPinClick } from '@/pages/curator-page/pin-nav'
import PinRow from '@/pages/curator-page/PinRow'

const PIN = (o: Record<string, unknown> = {}) => ({
  id: 1, product_id: 2887, position: 0, note: null, click_count: 0, product_name: '스탠다드 텐트', image_url: null,
  thumbnail: null, price: 149000, original_price: 199000, category: 'stay_voucher', deal_only: 0, is_active: 1,
  commission_rate: null, ...o,
})

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), configurable: true, writable: true })
})

describe('③ 목적지 = 정본 상세 SSOT', () => {
  it('숙소 /stays · 교환권 /vouchers · 식사 /pass · 쇼핑 /products', () => {
    expect(pinHref(PIN())).toBe('/stays/2887')
    expect(pinHref(PIN({ deal_only: 1, category: '커피/음료' }))).toBe('/vouchers/2887')
    expect(pinHref(PIN({ category: 'meal_voucher' }))).toBe('/pass/2887')
    expect(pinHref(PIN({ category: 'general' }))).toBe('/products/2887')
  })
})

describe('①② 누르는 순간 — 소개 값 저장 + 클릭 비콘', () => {
  it('손님이 누르면 주인 id 가 소개 값으로 남고 비콘이 그 상품으로 간다', () => {
    onPinClick('jiwon1228', 3, 2887)
    expect(localStorage.getItem('affiliate_ref')).toBe('3')
    expect(navigator.sendBeacon).toHaveBeenCalledWith('/api/curator/jiwon1228/p/2887/click')
  })
  it('주인 자신이 누르면 소개 값을 남기지 않는다(자기 적립 금지) — 클릭은 센다', () => {
    localStorage.setItem('user_id', '3')
    onPinClick('jiwon1228', 3, 2887)
    expect(localStorage.getItem('affiliate_ref')).toBeNull()
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1)
  })
  it('진짜 PinRow 를 눌러도 같은 일이 일어난다(배선)', () => {
    const { container } = render(
      <MemoryRouter>
        <PinRow pin={PIN() as never} handle="jiwon1228" curatorUserId={3} order={1} />
      </MemoryRouter>,
    )
    const a = container.querySelector('a')!
    expect(a.getAttribute('href')).toBe('/stays/2887')
    fireEvent.click(a)
    expect(localStorage.getItem('affiliate_ref')).toBe('3')
    expect(navigator.sendBeacon).toHaveBeenCalledWith('/api/curator/jiwon1228/p/2887/click')
  })
})

describe('④ 바깥 공유 링크는 서버 경유 그대로 · 클릭 기록은 한 함수', () => {
  const routes = stripComments(readFileSync('src/worker/routes/curator.routes.ts', 'utf8'))
  it('리다이렉트와 비콘 둘 다 logPinClick 하나로 기록한다', () => {
    expect(routes).toMatch(/curatorRoutes\.get\('\/:handle\/p\/:productId\/redirect'/)
    expect(routes).toMatch(/curatorRoutes\.post\('\/:handle\/p\/:productId\/click'/)
    expect(routes.match(/logPinClick\(/g)?.length).toBe(2)
    expect(routes, '클릭 INSERT 를 다시 손으로 적지 않는다').not.toMatch(/INSERT INTO pin_click_logs/)
  })
  it('앱 라우트 /u/:handle/p/:productId 는 남는다(카톡·SNS 로 공유된 링크)', () => {
    const app = stripComments(readFileSync('src/App.tsx', 'utf8'))
    expect(app).toMatch(/<Route path="\/u\/:handle\/p\/:productId" element=\{<CuratorPinClientRedirect \/>\} \/>/)
  })
})
