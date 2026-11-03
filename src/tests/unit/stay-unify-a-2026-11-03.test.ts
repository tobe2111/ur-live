/**
 * 🏨 숙소 통일 A (2026-11-03) — 대표 *"숙소이용권 상세페이지는 왜 다르지? … 사장님 계정, 에이전시 계정 등
 * 볼게 많지 않아? 왜 분리가 되어있지?"* → *"1,2 다 해야지"*.
 *
 * A(돈 안 닿는 화면 통일) 세 가지를 고정한다:
 *  ① 유어샵에 담긴 숙소를 누르면 **숙소 상세**로 간다 — 종전엔 이용권 상세(/pass)로 가서 객실·날짜 없이 열렸다.
 *  ② PC 숙소 상세에도 찜·담기·공유가 있다 — 폰 머리(`DetailFloatingHeader`)는 lg:hidden 이라 PC 엔 0개였다.
 *  ③ 사장님 이용권 탭(에이전시도 같은 화면)에서 숙소 행의 [수정]은 숙소 편집으로, 재발행·지점 복사 대신 예약 현황.
 *     등록 폼에서 '숙박' 을 누르면 숙소 등록 화면으로 간다 — 그 폼으로는 **객실 없는 숙소**가 만들어졌다.
 *
 * ⚠️ 이 시험이 못 보는 것: 숙소 소개 적립(?aff → 딜 N%)과 '팔아보기' — 그건 머니 경로라 결재 B
 *   (`docs/decisions/2026-11-03-stay-referral-unify.md`)에서 한다. 화면이 실제로 보기 좋은지는 그려서 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')

describe('숙소 통일 A', () => {
  it('① 담긴 숙소 클릭은 /stays 로 — 이용권 분기보다 먼저', () => {
    const s = read('src/worker/routes/curator.routes.ts')
    const stay = s.indexOf("prod.category === 'stay_voucher') return c.redirect(`/stays/${productId}?aff=")
    const pass = s.indexOf("'/vouchers' : '/pass'}/${productId}?aff=")
    expect(stay).toBeGreaterThan(0)
    expect(pass).toBeGreaterThan(stay)
  })

  it('② PC 숙소 상세에 찜·담기·공유 — 주인에게는 안 보인다', () => {
    const page = read('src/pages/StayDetailPage.tsx')
    expect(page).toMatch(/\{!own && <StayPcActions /)
    const comp = read('src/pages/stay-detail/StayPcActions.tsx')
    for (const c of ['<WishlistButton', '<PinButton', '<KakaoShareButton']) expect(comp).toContain(c)
  })

  it('③ 이용권 탭의 숙소 행 — 숙소 편집 · 예약 현황, 재발행 없음', () => {
    const row = read('src/pages/seller-group-buy/VoucherRow.tsx')
    expect(row).toContain("const isStay = v.category === 'stay_voucher'")
    expect(row).toContain('navigate(isStay ? `/seller/stays/${v.id}` : `/seller/products/${v.id}/edit`)')
    expect(row).toMatch(/\{isStay \? \(\s*<button[^\n]*navigate\('\/seller\/stays\/bookings'\)/)
  })

  it('③ 등록 폼의 숙박은 숙소 등록 화면으로', () => {
    const step = read('src/pages/seller-meal-voucher/VoucherInfoStep.tsx')
    expect(step).toContain("if (c === 'stay_voucher') { navigate('/seller/stays/new'); return }")
    expect(step).toContain('onClick={() => pick(c.key)}')
    expect(step).not.toContain('onClick={() => setCategory(c.key)}')
  })
})
