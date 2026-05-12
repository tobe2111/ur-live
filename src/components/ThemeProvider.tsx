/**
 * 🛡️ 2026-05-02: 시스템 prefers-color-scheme 변화에 반응하는 ThemeProvider.
 * 🛡️ 2026-05-12: 다중 방어 추가 — 크로스탭 동기화, 외부 mutation 복구, 포그라운드 재적용.
 *   "테마가 사용자마다 깨지는" 문제 영구 해결.
 *
 * 방어 메커니즘:
 *   1. OS prefers-color-scheme 변화 (기존)
 *   2. storage 이벤트 — 다른 탭에서 테마 변경 시 동기화
 *   3. visibilitychange — 백그라운드 → 포그라운드 복귀 시 localStorage 재로딩
 *   4. MutationObserver — 외부 코드가 <html class="dark"> 건드릴 시 복구
 */
import { useEffect } from 'react'
import { useTheme, syncFromStorage, reapplyCurrentTheme } from '@/shared/stores/useTheme'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const refreshSystem = useTheme(s => s.refreshSystem)

  // 1) OS prefers-color-scheme 변화
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => refreshSystem()
    mq.addEventListener?.('change', handler)
    return () => { mq.removeEventListener?.('change', handler) }
  }, [refreshSystem])

  // 2) 크로스탭 동기화 + 3) 포그라운드 복귀 재로딩
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ur_theme_mode_v1' || e.key === null) syncFromStorage()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') syncFromStorage() }
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // 4) <html> class 외부 mutation 감지 → 복구
  useEffect(() => {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return
    const root = document.documentElement
    let suppress = false
    const observer = new MutationObserver(() => {
      if (suppress) return
      suppress = true
      reapplyCurrentTheme()
      // 같은 tick 안 self-mutation 무시 (무한 loop 방지)
      setTimeout(() => { suppress = false }, 0)
    })
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return <>{children}</>
}
