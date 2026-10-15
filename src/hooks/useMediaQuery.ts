import { useCallback, useSyncExternalStore } from 'react'

/**
 * 🖥️ 2026-07-15: 뷰포트 미디어쿼리 훅 (SSR-safe).
 *   - 브라우저 렌더(createRoot): 첫 렌더부터 실제 `matchMedia` 결과 — 늦게 끼어들지 않는다.
 *   - 서버 렌더·hydrate 첫 렌더: `fallback`(기본 false) — 서버와 같은 값을 그린 뒤 hydrate 직후 실제 값으로 다시 그린다.
 *   - 변경 구독 — 리사이즈/뷰포트 전환 시 리렌더.
 *
 * 🧊 2026-10-15 서버 렌더 2단계: `useState` 초기값 → `useSyncExternalStore`. 종전엔 서버가 `fallback` 을,
 *   hydrate 하는 브라우저가 실제 값을 **같은 첫 렌더**에 그려 결과가 갈렸다(데스크톱 상세 갤러리의 감시 `<img>`).
 *   서버 스냅샷이 그 갈림을 없앤다. 보통의 브라우저 렌더는 종전과 같다(첫 렌더부터 정확 — 시험이 고정).
 *
 * 사용: `const isDesktop = useMediaQuery('(min-width: 1024px)')`
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback((cb: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {}
    const mql = window.matchMedia(query)
    mql.addEventListener('change', cb)
    return () => mql.removeEventListener('change', cb)
  }, [query])
  const get = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return fallback
    return window.matchMedia(query).matches
  }, [query, fallback])
  const getServer = useCallback(() => fallback, [fallback])
  return useSyncExternalStore(subscribe, get, getServer)
}

export default useMediaQuery
