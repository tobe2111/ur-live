import { useEffect, useRef } from 'react'

/**
 * 화면 잠금 방지 훅 (Screen Wake Lock API)
 *
 * 방송 중 모바일 화면이 꺼지는 것을 막음.
 * - 탭 숨김 시 자동 해제됨 (브라우저 정책) → visibilitychange 에서 재요청
 * - 미지원 브라우저 (Safari < 16.4) 는 조용히 무시
 * - enabled=false 시 lock 해제
 */
export function useScreenWakeLock(enabled: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let cancelled = false

    async function acquire() {
      if (cancelled) return
      try {
        lockRef.current = await (navigator as Navigator & { wakeLock: { request(type: 'screen'): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
        lockRef.current.addEventListener('release', () => {
          lockRef.current = null
        })
      } catch {
        // 권한 거부 or 배터리 부족 — 조용히 무시
      }
    }

    acquire()

    // 탭이 다시 보일 때 재요청 (브라우저가 자동 해제하므로)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      try { lockRef.current?.release() } catch {}
      lockRef.current = null
    }
  }, [enabled])
}
