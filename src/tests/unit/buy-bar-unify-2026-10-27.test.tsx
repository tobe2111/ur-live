/**
 * 🧾 2026-10-27 (대표 "통일할 건 통일" → "모두 이상적으로") 통일 2단계:
 *   이용권 하단 바와 숙소 하단 바가 **같은 틀·가격 칸·주 버튼**(`components/deal/BuyBar`)을 쓴다.
 *   종전엔 각자 마크업이라 숙소만 가격 17px · 작은 버튼으로 따로 놀았다.
 * 못 보는 것: 실제 화면 높이(브라우저로만).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readCode } from '../helpers/source-text'
import StayStickyBar from '@/pages/stay-detail/StayStickyBar'

describe('하단 바 통일', () => {
  it('두 바 모두 공용 부품을 쓰고, 자기 틀을 따로 그리지 않는다', () => {
    for (const f of ['src/pages/group-buy/DealBottomBar.tsx', 'src/pages/stay-detail/StayStickyBar.tsx']) {
      const s = readCode(f)
      expect(s, f).toContain('<BuyBarFrame>')
      expect(s, f).toContain('<BuyBarPrice')
      expect(s, f).toContain('<BuyBarCta')
      expect(s, `${f} 가 바 틀을 직접 그린다`).not.toMatch(/fixed bottom-0/)
    }
  })
  it('숙소 바 — 이용권 바와 같은 큰 가격(24px)·큰 버튼(52px)', () => {
    render(<StayStickyBar minPrice={149000} nightsLabel="1박" cartCount={0} cartTotalQty={0} cartSubtotal={0} onClear={() => {}} onBook={() => {}} onPickRoom={() => {}} />)
    const btn = screen.getByRole('button', { name: '객실 고르기' })
    expect(btn.className).toContain('h-[52px]')
    expect(screen.getByText(/149,000원/).className).toContain('text-[24px]')
  })
})
