import { useEffect, useState } from 'react'

/**
 * Tracks the on-screen keyboard height via the VisualViewport API.
 * - Returns 0 when the keyboard is closed (or the API is unavailable).
 * - Also writes the current offset to `--keyboard-height` on <html>
 *   so CSS (e.g. `.adjust-for-keyboard` utility) can react without JS state.
 *
 * Threshold of 50px filters out browser UI noise (address bar show/hide).
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport

    const handler = () => {
      const offset = window.innerHeight - vv.height
      const next = offset > 50 ? offset : 0
      setHeight(next)
      document.documentElement.style.setProperty('--keyboard-height', `${next}px`)
    }

    handler() // initial sync
    vv.addEventListener('resize', handler)
    vv.addEventListener('scroll', handler)
    return () => {
      vv.removeEventListener('resize', handler)
      vv.removeEventListener('scroll', handler)
    }
  }, [])

  return height
}

export default useKeyboardHeight
