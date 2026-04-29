import { useEffect, useRef } from 'react'

/**
 * 🛡️ 2026-04-29: Focus trap hook for modals/dialogs (a11y).
 *
 * 모달이 열려 있을 때 Tab/Shift+Tab 이 모달 내부에서만 순환하도록 제한.
 * 모달이 닫히면 트리거 element 로 focus 복원.
 *
 * 사용:
 *   const ref = useFocusTrap<HTMLDivElement>(isOpen)
 *   return <div ref={ref} role="dialog" aria-modal="true">...</div>
 *
 * - 마운트 시 첫 focusable 에 focus
 * - Tab key: 마지막 → 첫 / Shift+Tab: 첫 → 마지막
 * - 언마운트 시 이전 focus 복원
 *
 * focusable selectors: 흔히 쓰이는 패턴 + tabindex="0"
 * disabled / hidden / aria-hidden / inert 안에 있는 요소는 자동 제외 (focus 시도 시 실패).
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return

    // 1) 이전 focus 보존 + 첫 focusable 에 focus
    previouslyFocused.current = (document.activeElement as HTMLElement) || null
    const container = containerRef.current
    if (container) {
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusables.length > 0) {
        focusables[0].focus()
      } else {
        container.setAttribute('tabindex', '-1')
        container.focus()
      }
    }

    // 2) Tab 키 cycle handler
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const c = containerRef.current
      if (!c) return
      const focusables = Array.from(c.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const activeEl = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        if (activeEl === first || !c.contains(activeEl)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (activeEl === last || !c.contains(activeEl)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // 3) 언마운트 시 이전 focus 복원 (가능할 때만)
      try {
        previouslyFocused.current?.focus()
      } catch { /* element 가 사라졌을 수 있음 */ }
    }
  }, [active])

  return containerRef
}
