import { useEffect, useState } from 'react'

/**
 * 🖥️ 2026-07-15: 뷰포트 미디어쿼리 훅 (SSR-safe).
 *   - 초기값: 클라이언트면 즉시 `matchMedia` 결과(첫 렌더부터 정확 — createRoot 비-hydrate 라 미스매치 0),
 *     SSR/window 없음이면 `fallback`(기본 false).
 *   - 변경 구독(addEventListener) — 리사이즈/뷰포트 전환 시 리렌더.
 *
 * 사용: `const isDesktop = useMediaQuery('(min-width: 1024px)')`
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return fallback
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange() // 마운트 시점 값 동기화(초기값과 뷰포트 변화 사이 갭 방어)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export default useMediaQuery
