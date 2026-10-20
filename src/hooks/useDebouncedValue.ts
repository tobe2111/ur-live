import { useEffect, useState } from 'react'

/**
 * ⏱️ 값 디바운스 — 입력은 즉시 반영하되, 소비(서버 검색 등)는 잠잠해진 뒤 1회만.
 *   배경(2026-07-27 유어애즈 검색 최적화): 풀 페이지들이 검색어 state 를 fetch 의존성에 직접 걸어
 *   **키 입력(한글 조합 포함)마다 서버 왕복** — "방배맛집" 타이핑에 요청 7~8회 × 수백 행 JSON.
 *   사용: const dq = useDebouncedValue(q, 350) → fetch 는 dq 에만 의존.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
