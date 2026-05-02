/**
 * 🛡️ 2026-05-02: 시스템 prefers-color-scheme 변화에 반응하는 ThemeProvider.
 *   사용자 mode === 'system' 일 때만 OS 변화를 따라간다.
 *   useTheme 스토어 import 만으로 첫 적용은 끝나 있으나 (모듈 평가 시 자동),
 *   런타임 동안 OS 다크/라이트 토글에 반응하려면 listener 필요.
 */
import { useEffect } from 'react'
import { useTheme } from '@/shared/stores/useTheme'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const refreshSystem = useTheme(s => s.refreshSystem)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => refreshSystem()
    mq.addEventListener?.('change', handler)
    return () => { mq.removeEventListener?.('change', handler) }
  }, [refreshSystem])

  return <>{children}</>
}
