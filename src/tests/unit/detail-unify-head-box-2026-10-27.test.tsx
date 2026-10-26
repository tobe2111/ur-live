/**
 * 🧱 2026-10-27 (대표 "통일할 건 통일" → "모두 이상적으로") 통일 3·4단계:
 *   ③ 숙소 섹션 띠가 이용권과 같은 흰 면 + 8px 띠(`STAY_BAND` 한 상수 — 종전 7곳 사본) · 제목 24px.
 *   ④ PC 오른쪽 상자 — 숙소 패널이 이용권 상자와 같은 숫자(반경 18 · 여백 18 · 버튼 50/14),
 *      그리고 추첨 상품이면 PC 에서도 예약 대신 응모(폰 하단 바와 같은 값).
 * 못 보는 것: 실제 색·간격(그려서 본다).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readCode } from '../helpers/source-text'
import { STAY_HEAD, STAY_BAND } from '@/shared/stay-head'
import { PASS_HEAD } from '@/shared/pass-head'
import { PURCHASE_BOX_CLS, PURCHASE_CTA_CLS } from '@/components/deal/BuyBar'
import StayBookingPanel from '@/pages/stay-detail/StayBookingPanel'

const panel = (raffle?: { label: string; disabled: boolean; onApply: () => void } | null) => (
  <StayBookingPanel modeTabs={null} selector={null} rooms={[]} roomsLoading={false} cartQty={{}} setCartQty={() => {}}
    guests={2} nights={1} cancellation="" onBook={() => {}} raffle={raffle} />
)

describe('③ 머리·섹션 띠', () => {
  it('숙소 제목 크기 = 이용권 제목 크기', () => {
    expect(STAY_HEAD.h1.split(' '), '폰 크기(접두 없는 토큰)가 24px 이 아니다').toContain('text-[24px]')
    expect(PASS_HEAD.h1).toContain('text-[24px]')
  })
  it('섹션 띠는 흰 면이고, 손으로 적은 사본이 없다', () => {
    expect(STAY_BAND).toContain('bg-surface')
    expect(STAY_BAND).toContain('border-t-8')
    for (const f of ['src/pages/StayDetailPage.tsx', 'src/pages/stay-detail/SimilarStays.tsx', 'src/pages/stay-detail/StayInfoSections.tsx'])
      expect(readCode(f), f).not.toContain('border-t-8 border-gray-100')
  })
})

describe('④ PC 상자', () => {
  it('숙소 패널 숫자 = 이용권 상자 숫자', () => {
    const box = readCode('src/pages/group-buy/DealPurchaseBox.tsx')
    expect(box).toMatch(/borderRadius: 18, padding: 18/)
    expect(box).toMatch(/height: 50, border: 'none', borderRadius: 14/)
    expect(PURCHASE_BOX_CLS).toMatch(/rounded-\[18px\].*p-\[18px\]/)
    expect(PURCHASE_CTA_CLS).toMatch(/h-\[50px\] rounded-\[14px\]/)
    expect(readCode('src/pages/stay-detail/StayBookingPanel.tsx')).toContain('${PURCHASE_BOX_CLS}')
  })
  it('추첨 상품이면 예약 대신 응모 버튼', () => {
    render(panel({ label: '응모하기 (무료)', disabled: false, onApply: () => {} }))
    expect(screen.getByRole('button', { name: '응모하기 (무료)' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /예약하기/ })).toBeNull()
  })
  it('페이지가 PC 패널에도 추첨 값을 넘긴다', () => {
    const page = readCode('src/pages/StayDetailPage.tsx')
    expect(page).toMatch(/onBook=\{\(\) => setMultiBookingOpen\(true\)\}\s*raffle=\{fcfs\.gate/)
  })
})
