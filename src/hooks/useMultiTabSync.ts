import { useEffect, useRef } from 'react'

/**
 * Multi-Tab Synchronization Hook
 *
 * 여러 탭 간의 localStorage 변경사항을 동기화하여 일관된 사용자 경험을 제공합니다.
 *
 * ✅ 무한 루프 방지:
 *   - window.storage 이벤트는 동일 탭에서는 발생하지 않음 (브라우저 사양)
 *   - 로그인/로그아웃 페이지에서는 절대 reload/redirect 하지 않음
 *   - 중복 이벤트 처리 방지를 위해 debounce(200ms) 적용
 *   - seller_token / admin_token 키를 직접 감시 (session_token 키 대신)
 *
 * 사용 예시:
 * ```typescript
 * function App() {
 *   useMultiTabSync()
 *   return <Router>...</Router>
 * }
 * ```
 */
export function useMultiTabSync() {
  const lastHandled = useRef<{ key: string; ts: number }>({ key: '', ts: 0 })

  useEffect(() => {
    const isLoginPage = () => {
      const p = window.location.pathname
      return (
        p === '/login' ||
        p === '/seller/login' ||
        p === '/admin/login' ||
        p === '/register' ||
        p === '/seller/register' ||
        p.startsWith('/auth/')
      )
    }

    const debounce = (key: string): boolean => {
      const now = Date.now()
      // Auth storage keys can be written multiple times during a single login flow
      // (setUser, setAuthReady, onAuthStateChanged) — use a longer window to treat
      // all writes within 3 seconds as a single login event.
      const window_ms =
        key === 'auth-kr-storage' || key === 'auth-world-storage' ? 3000 : 200
      if (lastHandled.current.key === key && now - lastHandled.current.ts < window_ms) {
        return false // 중복 이벤트, 무시
      }
      lastHandled.current = { key, ts: now }
      return true
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key) return

      // ─── 1. Firebase Auth (User 전용) ───────────────────────────────────
      if (
        (event.key === 'auth-kr-storage' || event.key === 'auth-world-storage') &&
        event.oldValue !== event.newValue
      ) {
        if (!debounce(event.key)) return
        if (isLoginPage()) return // 로그인 페이지에서는 무시

        if (event.oldValue && !event.newValue) {
          // 로그아웃 감지 → 홈으로
          window.location.href = '/'
          return
        }

        if (!event.oldValue && event.newValue) {
          // 로그인 감지 → 현재 페이지가 보호 경로면 reload
          window.location.reload()
          return
        }

        // 사용자 전환 감지
        if (event.oldValue && event.newValue) {
          window.location.reload()
          return
        }
      }

      // ─── 2. Seller JWT 토큰 (seller_token) ───────────────────────────────
      if (event.key === 'seller_token') {
        if (!debounce(event.key)) return
        if (isLoginPage()) return

        if (event.oldValue && !event.newValue) {
          window.location.href = '/seller/login'
          return
        }
        if (!event.oldValue && event.newValue) {
          window.location.reload()
          return
        }
      }

      // ─── 3. Admin JWT 토큰 (admin_token) ─────────────────────────────────
      if (event.key === 'admin_token') {
        if (!debounce(event.key)) return
        if (isLoginPage()) return

        if (event.oldValue && !event.newValue) {
          window.location.href = '/admin/login'
          return
        }
        if (!event.oldValue && event.newValue) {
          window.location.reload()
          return
        }
      }

      // ─── 4. user_type 전환 감지 (user ↔ seller ↔ admin) ─────────────────
      // ⚠️ 초기 로그인(null → value)은 무시, 기존 값이 있을 때의 전환만 처리
      if (
        event.key === 'user_type' &&
        event.oldValue && // 이전 값 존재
        event.newValue &&
        event.oldValue !== event.newValue
      ) {
        if (!debounce(event.key)) return
        if (isLoginPage()) return

        // ✅ 현재 탭이 seller 세션이면 다른 탭의 user_type 변경 무시
        // (seller 로그인 시 Firebase signOut이 다른 탭의 user_type을 'user'로 바꿔 리로드 유발하는 버그 방지)
        const currentSellerToken = localStorage.getItem('seller_token')
        const currentUserType = localStorage.getItem('user_type')
        if (currentSellerToken && currentUserType === 'seller') {
          return
        }

        // ✅ 현재 탭이 admin 세션이면 동일하게 무시
        const currentAdminToken = localStorage.getItem('admin_token')
        if (currentAdminToken && currentUserType === 'admin') {
          return
        }

        window.location.reload()
        return
      }

      // ─── 5. 앱 버전 변경 ─────────────────────────────────────────────────
      if (event.key === 'app_version' && event.oldValue !== event.newValue) {
        if (!debounce(event.key)) return
        if (isLoginPage()) return

        window.location.reload()
        return
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])
}
