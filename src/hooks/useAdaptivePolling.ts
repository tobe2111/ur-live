import { useEffect, useRef, useCallback } from 'react'

/**
 * 적응형 폴링 훅 — 실패 시 지수 백오프, 성공 시 원래 간격 복원
 */
export function useAdaptivePolling(
  fetchFn: () => Promise<void>,
  baseInterval: number = 5000,
  enabled: boolean = true
) {
  const failureCount = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poll = useCallback(async () => {
    if (!enabled) return
    try {
      await fetchFn()
      failureCount.current = 0
    } catch {
      failureCount.current++
    }

    // 다음 폴링: 실패 시 백오프 (최대 60초)
    const nextInterval = failureCount.current > 0
      ? Math.min(baseInterval * Math.pow(2, failureCount.current), 60000)
      : baseInterval

    // 약간의 지터 추가 (±10%)
    const jitter = nextInterval * (0.9 + Math.random() * 0.2)

    timerRef.current = setTimeout(poll, jitter)
  }, [fetchFn, baseInterval, enabled])

  useEffect(() => {
    if (!enabled) return
    poll()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [poll, enabled])
}
