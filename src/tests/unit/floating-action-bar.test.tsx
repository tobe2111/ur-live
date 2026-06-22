import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { FloatingActionBar } from '@/components/product/floating-action-bar'

/**
 * 🧭 2026-06-22: 상품 하단 CTA 바 단위 테스트 (사용자 권장 ② CTA 부분 자동화).
 *
 * 검증:
 *   - 일반 상품: '바로 구매' + '장바구니' 노출, 오인 소지 '공구 참여' 부제 제거됨
 *   - 클릭 → 핸들러 호출
 *   - dealOnly: '딜로 교환' + 장바구니 숨김
 *   - disabled: 버튼 비활성
 *   - 주요 CTA 가 실제 그라데이션 (이전 같은 색 2번 평평한 회색 회귀 방지)
 */
describe('FloatingActionBar', () => {
  const baseProps = {
    onAddToCart: () => {},
    onBuyNow: () => {},
  }

  it('일반 상품: "바로 구매" + "장바구니" 노출, "공구 참여" 부제 없음', () => {
    const { getByText, queryByText } = render(<FloatingActionBar {...baseProps} />)
    expect(getByText('바로 구매')).toBeTruthy()
    expect(getByText('장바구니')).toBeTruthy()
    expect(queryByText('공구 참여')).toBeNull()
  })

  it('"바로 구매" 클릭 → onBuyNow, "장바구니" 클릭 → onAddToCart', () => {
    const onBuyNow = vi.fn()
    const onAddToCart = vi.fn()
    const { getByText } = render(<FloatingActionBar {...baseProps} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />)
    fireEvent.click(getByText('바로 구매'))
    fireEvent.click(getByText('장바구니'))
    expect(onBuyNow).toHaveBeenCalledTimes(1)
    expect(onAddToCart).toHaveBeenCalledTimes(1)
  })

  it('dealOnly: "딜로 교환" 노출 + "장바구니" 숨김', () => {
    const { getByText, queryByText } = render(<FloatingActionBar {...baseProps} dealOnly />)
    expect(getByText('🎁 딜로 교환')).toBeTruthy()
    expect(queryByText('장바구니')).toBeNull()
  })

  it('disabled: 주요 CTA 비활성', () => {
    const onBuyNow = vi.fn()
    const { getByText } = render(<FloatingActionBar {...baseProps} onBuyNow={onBuyNow} disabled />)
    const btn = getByText('바로 구매').closest('button')!
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onBuyNow).not.toHaveBeenCalled()
  })

  it('주요 CTA 는 평평한 단색이 아닌 실제 그라데이션', () => {
    const { getByText } = render(<FloatingActionBar {...baseProps} />)
    const btn = getByText('바로 구매').closest('button')!
    const bg = btn.style.background
    expect(bg).toMatch(/linear-gradient/)
    // 이전 회귀: 'linear-gradient(135deg, #6b7280, #6b7280)' — 같은 색 2번.
    expect(bg).not.toMatch(/#6b7280.*#6b7280/)
  })
})
