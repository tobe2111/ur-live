import { useEffect } from 'react'

/**
 * Android/모바일 뒤로가기 버튼으로 모달을 닫기 위한 훅.
 *
 * 모달이 열리면 history state를 push해서 뒤로가기가 페이지를 이탈시키지
 * 않고 모달만 닫도록 한다. 브라우저 뒤로가기/하드웨어 버튼 모두 처리된다.
 *
 * Usage:
 *   useBackButton(isOpen, onClose)
 */
export function useBackButton(isOpen: boolean, onBack: () => void) {
  useEffect(() => {
    if (!isOpen) return

    // Push state so back doesn't navigate away — it will trigger popstate instead
    try {
      window.history.pushState({ modalOpen: true }, '')
    } catch {
      // Some environments (SSR/tests) lack history — no-op
      return
    }

    const handler = (_e: PopStateEvent) => {
      onBack()
    }

    window.addEventListener('popstate', handler)
    return () => {
      window.removeEventListener('popstate', handler)
    }
  }, [isOpen, onBack])
}
