import { useEffect } from 'react'

/**
 * 🛡️ 2026-04-28: ESC 키로 modal/dialog 닫기 — a11y (키보드 사용자).
 *
 * 사용:
 *   useEscapeKey(onClose)
 *
 * 등록/해제는 mount/unmount 자동 처리. callback 변경 시 listener 갱신.
 */
export function useEscapeKey(callback: () => void): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') callback()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [callback])
}
