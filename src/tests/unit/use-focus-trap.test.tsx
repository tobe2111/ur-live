import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

/**
 * 🛡️ 2026-04-29: useFocusTrap hook 단위 테스트
 *
 * 검증:
 *   1. 마운트 시 첫 focusable 에 자동 focus
 *   2. Tab 키 cycle: 마지막 → 첫
 *   3. Shift+Tab cycle: 첫 → 마지막
 *   4. active=false 면 효과 없음
 *   5. focusable 0개일 때 container 자체에 focus
 */

function TestModal({ active }: { active: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(active)
  return (
    <div ref={ref} data-testid="modal" role="dialog">
      <button data-testid="btn1">First</button>
      <input data-testid="input1" />
      <button data-testid="btn2">Last</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('마운트 시 첫 focusable 에 focus', () => {
    const { getByTestId } = render(<TestModal active={true} />)
    expect(document.activeElement).toBe(getByTestId('btn1'))
  })

  it('Tab from 마지막 → 첫 cycle', () => {
    const { getByTestId } = render(<TestModal active={true} />)
    const btn2 = getByTestId('btn2')
    btn2.focus()
    expect(document.activeElement).toBe(btn2)

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(getByTestId('btn1'))
  })

  it('Shift+Tab from 첫 → 마지막 cycle', () => {
    const { getByTestId } = render(<TestModal active={true} />)
    const btn1 = getByTestId('btn1')
    btn1.focus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(getByTestId('btn2'))
  })

  it('active=false 면 자동 focus 안 함', () => {
    const previousFocus = document.createElement('button')
    document.body.appendChild(previousFocus)
    previousFocus.focus()

    render(<TestModal active={false} />)
    // focus 가 변경되지 않아야 함
    expect(document.activeElement).toBe(previousFocus)
    document.body.removeChild(previousFocus)
  })

  it('focusable 0개 컨테이너 에 focus', () => {
    function EmptyModal() {
      const ref = useFocusTrap<HTMLDivElement>(true)
      return <div ref={ref} data-testid="empty">텍스트만</div>
    }
    const { getByTestId } = render(<EmptyModal />)
    const el = getByTestId('empty')
    // tabindex=-1 가 적용되었는지 + focus 됨
    expect(el.getAttribute('tabindex')).toBe('-1')
  })
})
