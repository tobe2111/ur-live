import { useEffect } from 'react'

/**
 * Multi-Tab Synchronization Hook
 * 
 * 여러 탭 간의 localStorage 변경사항을 동기화하여 일관된 사용자 경험을 제공합니다.
 * 
 * 기능:
 * - 다른 탭에서 로그아웃 시 현재 탭도 자동 로그아웃
 * - 다른 탭에서 로그인 시 현재 탭도 자동 새로고침
 * - Firebase Auth 상태 변경 감지 (auth-kr-storage, auth-world-storage)
 * - 세션 토큰 변경 감지 및 동기화
 * 
 * 작동 방식:
 * - window.addEventListener('storage') 이벤트 사용
 * - 주의: 같은 탭 내의 변경은 감지 안 됨 (다른 탭의 변경만 감지)
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
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // event.key: 변경된 localStorage 키
      // event.oldValue: 이전 값
      // event.newValue: 새 값
      // event.url: 변경이 발생한 페이지 URL

      // 1. Firebase Auth 상태 변경 감지 (Zustand persist)
      if (
        (event.key === 'auth-kr-storage' || event.key === 'auth-world-storage') &&
        event.oldValue !== event.newValue
      ) {
        console.log('[MultiTabSync] 🔥 다른 탭에서 Firebase Auth 상태 변경 감지')
        console.log('[MultiTabSync] Key:', event.key)
        console.log('[MultiTabSync] Old:', event.oldValue?.substring(0, 50))
        console.log('[MultiTabSync] New:', event.newValue?.substring(0, 50))
        
        // 로그아웃 감지: Zustand persist가 삭제됨
        if (event.oldValue && !event.newValue) {
          console.log('[MultiTabSync] 🔴 로그아웃 감지 → 페이지 새로고침')
          window.location.href = '/'
          return
        }
        
        // 로그인 감지: Zustand persist가 새로 생성됨
        if (!event.oldValue && event.newValue) {
          console.log('[MultiTabSync] 🟢 로그인 감지 → 페이지 새로고침')
          window.location.reload()
          return
        }
        
        // 사용자 변경 감지: 다른 계정으로 전환
        if (event.oldValue && event.newValue) {
          console.log('[MultiTabSync] 🔄 사용자 변경 감지 → 페이지 새로고침')
          window.location.reload()
          return
        }
      }

      // 2. 로그아웃 감지 (세션 토큰이 삭제됨) - Seller/Admin용
      if (
        (event.key === 'user_session_token' || 
         event.key === 'seller_session_token' || 
         event.key === 'admin_session_token') &&
        event.oldValue && // 이전에 값이 있었고
        !event.newValue   // 지금은 값이 없음 (삭제됨)
      ) {
        console.log('[MultiTabSync] 🔴 다른 탭에서 로그아웃 감지 (JWT)')
        console.log('[MultiTabSync] 현재 탭도 로그아웃 처리 중...')
        
        // 모든 인증 관련 데이터 삭제
        localStorage.removeItem('user_session_token')
        localStorage.removeItem('seller_session_token')
        localStorage.removeItem('admin_session_token')
        localStorage.removeItem('user_id')
        localStorage.removeItem('seller_id')
        localStorage.removeItem('admin_id')
        localStorage.removeItem('user_name')
        localStorage.removeItem('seller_name')
        localStorage.removeItem('admin_name')
        localStorage.removeItem('user_type')
        localStorage.removeItem('user_email')
        localStorage.removeItem('user_profile_image')
        
        // 로그인 페이지로 리다이렉트
        const currentPath = window.location.pathname
        
        if (currentPath.includes('/seller')) {
          window.location.href = '/seller/login'
        } else if (currentPath.includes('/admin')) {
          window.location.href = '/admin/login'
        } else if (!currentPath.includes('/login')) {
          // 이미 로그인 페이지가 아닌 경우만 리다이렉트
          window.location.href = '/login'
        }
        
        return
      }

      // 3. 로그인 감지 (세션 토큰이 새로 생성됨) - Seller/Admin용
      if (
        (event.key === 'user_session_token' || 
         event.key === 'seller_session_token' || 
         event.key === 'admin_session_token') &&
        !event.oldValue && // 이전에 값이 없었고
        event.newValue     // 지금은 값이 있음 (새로 생성됨)
      ) {
        console.log('[MultiTabSync] 🟢 다른 탭에서 로그인 감지 (JWT)')
        console.log('[MultiTabSync] 현재 탭 새로고침 중...')
        
        // 페이지 새로고침하여 로그인 상태 반영
        window.location.reload()
        
        return
      }

      // 4. 세션 토큰 변경 감지 (로그인 상태에서 다른 계정으로 전환)
      if (
        (event.key === 'user_session_token' || 
         event.key === 'seller_session_token' || 
         event.key === 'admin_session_token') &&
        event.oldValue && // 이전 토큰 있음
        event.newValue && // 새 토큰 있음
        event.oldValue !== event.newValue // 토큰이 변경됨
      ) {
        console.log('[MultiTabSync] 🔄 다른 탭에서 세션 토큰 변경 감지')
        console.log('[MultiTabSync] 현재 탭 새로고침 중...')
        
        // 페이지 새로고침하여 새 세션 반영
        window.location.reload()
        
        return
      }

      // 5. user_type 변경 감지 (user ↔ seller ↔ admin 전환)
      // ⚠️ 중요: 초기 로그인 시 (null → user) 새로고침 방지
      if (
        event.key === 'user_type' && 
        event.oldValue && // 이전 값이 존재해야 함 (null이 아님)
        event.newValue && 
        event.oldValue !== event.newValue
      ) {
        console.log('[MultiTabSync] 🔄 다른 탭에서 사용자 타입 변경 감지')
        console.log('[MultiTabSync] Old:', event.oldValue, '→ New:', event.newValue)
        console.log('[MultiTabSync] 현재 탭 새로고침 중...')
        
        // 페이지 새로고침하여 새 사용자 타입 반영
        window.location.reload()
        
        return
      }

      // 6. 버전 변경 감지 (다른 탭에서 앱 업데이트)
      if (event.key === 'app_version' && event.oldValue !== event.newValue) {
        console.log('[MultiTabSync] 🆕 다른 탭에서 앱 버전 변경 감지')
        console.log('[MultiTabSync] Old:', event.oldValue, '→ New:', event.newValue)
        console.log('[MultiTabSync] 현재 탭 새로고침 중...')
        
        // 페이지 새로고침하여 새 버전 반영
        window.location.reload()
        
        return
      }
    }

    // storage 이벤트 리스너 등록
    window.addEventListener('storage', handleStorageChange)

    console.log('[MultiTabSync] ✅ 다중 탭 동기화 활성화됨')

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      console.log('[MultiTabSync] 다중 탭 동기화 비활성화됨')
    }
  }, [])
}
