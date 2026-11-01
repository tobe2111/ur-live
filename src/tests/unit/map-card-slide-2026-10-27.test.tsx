/**
 * 🎞️ 2026-10-27 (대표 "여기 이용권 좌우스크롤 모션 이상해") — 지도 아래 선택 카드 넘김.
 *   종전: 손가락을 ×0.35 만 따라오다 제자리로 튕기고 내용만 바뀜(고무줄처럼 보였다).
 *   지금: 1:1 로 따라가다 그 방향으로 빠지고, 다음 카드가 반대쪽에서 들어온다. 버튼·키보드도 같은 움직임.
 * 못 보는 것: 실제 프레임의 매끄러움(jsdom 에 레이아웃·애니메이션이 없다 — 눈으로 판정).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SelectedDealCard from '@/pages/restaurant-map/SelectedDealCard'
import { readCode } from '../helpers/source-text'

vi.mock('@/pages/restaurant-map/prefetch-detail', () => ({ usePrefetchMapDetail: () => () => {} }))

const deal = (id: number) => ({ id, name: `딜 ${id}`, restaurant_name: '가게', restaurant_address: '서울', price: 1000, original_price: 2000, rating: 0, image_url: '', category: 'meal_voucher' })

function setup(extra: Partial<{ hasPrev: boolean; hasNext: boolean }> = {}) {
  const onNext = vi.fn(); const onPrev = vi.fn()
  render(
    <MemoryRouter>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <SelectedDealCard selected={deal(1) as any} userLoc={null} onClose={() => {}} onPrev={onPrev} onNext={onNext}
        hasPrev={extra.hasPrev ?? true} hasNext={extra.hasNext ?? true} position={2} total={5} />
    </MemoryRouter>,
  )
  return { onNext, onPrev }
}

describe('지도 선택 카드 넘김', () => {
  it('다음 버튼은 카드를 빼낸 뒤에 다음 딜로 간다', () => {
    vi.useFakeTimers()
    const { onNext } = setup()
    fireEvent.click(screen.getByRole('button', { name: '다음 딜' }))
    expect(onNext).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(200) })
    expect(onNext).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
  it('키보드 ← 도 같은 움직임', () => {
    vi.useFakeTimers()
    const { onPrev } = setup()
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(onPrev).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
  it('손가락을 1:1 로 따라간다(끝 카드에서만 저항) — 종전 ×0.35 고무줄 금지', () => {
    const s = readCode('src/pages/restaurant-map/SelectedDealCard.tsx')
    expect(s).not.toMatch(/cur\.dx \* 0\.35/)
    expect(s).toMatch(/edge \? cur\.dx \* 0\.25 : cur\.dx/)
  })
  it('번호가 가격 줄과 겹치지 않는 구석에 있고, 폰에선 사진을 가리는 화살표를 숨긴다', () => {
    const s = readCode('src/pages/restaurant-map/SelectedDealCard.tsx')
    expect(s).not.toMatch(/bottom-1\.5 left-1\/2 -translate-x-1\/2[^"]*"/)
    expect((s.match(/hidden lg:flex absolute (left|right)-1\.5/g) || []).length).toBe(2)
  })
})
