import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEscapeKey } from '@/hooks/useEscapeKey'

/**
 * 🛡️ 2026-04-29: useEscapeKey hook 단위 테스트
 *
 * 검증:
 *   1. ESC keydown 시 callback 호출
 *   2. 다른 키는 호출 안 함
 *   3. unmount 시 listener 자동 해제
 *   4. callback 변경 시 listener 매번 재등록 안 됨 (ref 패턴)
 */
describe('useEscapeKey', () => {
  afterEach(() => {
    // jsdom 의 document 에 남은 listener 정리는 removeEventListener 로 자동.
  })

  it('Escape 키 누르면 callback 호출', () => {
    const cb = vi.fn()
    renderHook(() => useEscapeKey(cb))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('다른 키는 callback 호출 안 함', () => {
    const cb = vi.fn()
    renderHook(() => useEscapeKey(cb))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(cb).not.toHaveBeenCalled()
  })

  it('unmount 후 ESC 누르면 callback 호출 안 함', () => {
    const cb = vi.fn()
    const { unmount } = renderHook(() => useEscapeKey(cb))

    unmount()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cb).not.toHaveBeenCalled()
  })

  it('callback 갱신되어도 최신 callback 호출 (ref 패턴)', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useEscapeKey(cb),
      { initialProps: { cb: cb1 } }
    )

    rerender({ cb: cb2 })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cb1).not.toHaveBeenCalled()
    expect(cb2).toHaveBeenCalledTimes(1)
  })

  it('여러 번 ESC 호출 시 매번 callback 트리거', () => {
    const cb = vi.fn()
    renderHook(() => useEscapeKey(cb))

    for (let i = 0; i < 5; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    }
    expect(cb).toHaveBeenCalledTimes(5)
  })
})
