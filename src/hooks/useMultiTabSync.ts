import { useEffect, useRef } from 'react'

/**
 * Multi-Tab Synchronization Hook
 *
 * 여러 탭 간의 localStorage 변경사항을 동기화합니다.
 *
 * ⚠️ 무한 reload 방지:
 * - 로그인/콜백 페이지에서는 무시
 * - 같은 탭의 auth 변경은 무시 (sessionStorage 플래그)
 * - 10초 쿨다운으로 연속 reload 차단
 */
export function useMultiTabSync() {
  const lastReloadTime = useRef(0)

  useEffect(() => {
    const isAuthPage = () => {
      const p = window.location.pathname
      return (
        p === '/login' || p === '/seller/login' || p === '/admin/login' ||
        p === '/register' || p === '/seller/register' ||
        p.startsWith('/auth/') || p.startsWith('/kakao')
      )
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || isAuthPage()) return

      // Auth storage 변경 감지
      if (event.key === 'auth-kr-storage' || event.key === 'auth-world-storage') {
        // 같은 탭에서 로그인 처리 중이면 무시 (sessionStorage 플래그)
        if (sessionStorage.getItem('auth_processing')) return

        // 10초 쿨다운 — 연속 reload 완전 차단
        const now = Date.now()
        if (now - lastReloadTime.current < 10000) return
        lastReloadTime.current = now

        // 로그아웃 감지 (값이 사라짐)
        if (event.oldValue && !event.newValue) {
          window.location.href = '/'
          return
        }

        // 로그인/사용자 전환은 reload 하지 않음
        // (React 상태가 자동으로 업데이트됨 — Zustand persist가 처리)
        return
      }

      // Seller/Admin 토큰 변경
      if (event.key === 'seller_token' || event.key === 'admin_token') {
        if (!event.oldValue && event.newValue) return // 새 로그인, 무시
        if (event.oldValue && !event.newValue) {
          // 로그아웃
          if (event.key === 'seller_token' && window.location.pathname.startsWith('/seller')) {
            window.location.href = '/seller/login'
          }
          if (event.key === 'admin_token' && window.location.pathname.startsWith('/admin')) {
            window.location.href = '/admin/login'
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])
}
