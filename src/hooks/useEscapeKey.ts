import { useEffect, useRef } from 'react'

/**
 * 🛡️ 2026-04-28: ESC 키로 modal/dialog 닫기 — a11y (키보드 사용자).
 *
 * 사용:
 *   useEscapeKey(onClose)
 *   useEscapeKey(() => setShowModal(false))   // inline 함수도 OK
 *
 * 등록/해제는 mount/unmount 자동. ref 패턴으로 inline callback 도 listener 1회만 등록.
 */
export function useEscapeKey(callback: () => void): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') callbackRef.current()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}
