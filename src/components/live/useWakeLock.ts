/**
 * 🛡️ 2026-05-22: ReelCard hook 추출 — 화면 꺼짐 방지 (Wake Lock API).
 *
 * 활성 라이브 시청 중 화면이 자동으로 꺼지지 않도록 유지.
 * 라이브 종료 시 자동 해제.
 *
 * 동작:
 *   - active=true && status!='ended' 일 때 wakeLock 획득
 *   - visibilitychange → 다시 가시화될 때 재획득 (release-on-blur 우회)
 *   - cleanup 시 release
 *   - WakeLock API 미지원 / 거부 시 graceful (no-op)
 */

import { useEffect, useRef } from 'react'

export function useWakeLock(active: boolean, ended: boolean): void {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || ended) return
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
        }
      } catch { /* 거부 또는 미지원 — 무시 */ }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      try { wakeLockRef.current?.release() } catch { /* ignore */ }
      wakeLockRef.current = null
    }
  }, [active, ended])
}
