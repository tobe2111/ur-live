/**
 * AuthProvider — 앱 전체 Firebase Auth 초기화 컴포넌트
 *
 * 여기서 onAuthStateChanged 를 딱 1번 구독한다.
 * 콜백이 발생하면:
 *   - 로그인: /api/users/role 에서 역할 조회 후 useAuth._setUser() 호출
 *   - 로그아웃: useAuth._setUser(null, null) 호출
 *   - 두 경우 모두 useAuth._setReady() 로 초기화 완료 표시
 *
 * Seller / Admin 은 Firebase를 전혀 건드리지 않는다.
 * localStorage 에 seller_token / admin_token 이 있으면 Firebase 초기화 스킵.
 */

import { useEffect } from 'react'
import { useAuth } from '@/shared/stores/useAuth'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const _setUser = useAuth((s) => s._setUser)
  const _setReady = useAuth((s) => s._setReady)

  useEffect(() => {
    // ── Seller / Admin: Firebase 초기화 불필요 ──────────────────────────
    const userType = localStorage.getItem('user_type')
    if (userType === 'seller' || userType === 'admin') {
      console.log(`[AuthProvider] ${userType} 세션 감지 - Firebase 초기화 스킵`)
      _setReady()
      return
    }

    // ── Firebase User: onAuthStateChanged 구독 ─────────────────────────
    let unsubscribe: (() => void) | null = null

    const init = async () => {
      try {
        const { onAuthStateChanged } = await import('@/lib/firebase-auth')

        unsubscribe = await onAuthStateChanged(async (firebaseUser) => {
          if (firebaseUser) {
            console.log('[AuthProvider] 🔑 Firebase user 감지:', firebaseUser.uid)

            // seller / admin 이 Firebase 에도 로그인되어 있는 경우 무시
            const currentType = localStorage.getItem('user_type')
            if (currentType === 'seller' || currentType === 'admin') {
              _setReady()
              return
            }

            // DB 에서 역할 조회 (seller / admin 계정이 일반 경로로 오는 것 차단)
            let role: 'user' | 'seller' | 'admin' = 'user'
            try {
              const idToken = await firebaseUser.getIdToken(false)
              const res = await fetch('/api/users/role', {
                headers: { Authorization: `Bearer ${idToken}` },
              })
              const body = await res.json().catch(() => ({ role: 'user' })) as { role?: string }
              const fetchedRole = (body.role || 'user') as string
              if (fetchedRole === 'seller' || fetchedRole === 'admin' || fetchedRole === 'user') {
                role = fetchedRole
              }
            } catch (err) {
              console.warn('[AuthProvider] role 조회 실패, user 로 fallback:', err)
            }

            // seller / admin 이 일반 로그인 경로로 들어온 경우 거부
            if (role === 'seller' || role === 'admin') {
              console.warn('[AuthProvider] seller/admin Firebase 로그인 차단')
              const { signOut } = await import('@/lib/firebase-auth')
              await signOut().catch(() => {})
              _setUser(null, null)
              _setReady()
              return
            }

            // localStorage 동기화 (api.ts 인터셉터용)
            localStorage.setItem('user_type', 'user')
            localStorage.setItem('user_name', firebaseUser.displayName || '')
            localStorage.setItem('user_id', firebaseUser.uid)
            if (firebaseUser.email) localStorage.setItem('user_email', firebaseUser.email)

            _setUser(firebaseUser, 'user')
            _setReady()
            console.log('[AuthProvider] ✅ 인증 완료:', firebaseUser.uid)
          } else {
            console.log('[AuthProvider] 👋 비로그인 상태')
            localStorage.removeItem('user_type')
            localStorage.removeItem('user_name')
            localStorage.removeItem('user_id')
            localStorage.removeItem('user_email')
            _setUser(null, null)
            _setReady()
          }
        })
      } catch (err) {
        console.error('[AuthProvider] Firebase 초기화 실패:', err)
        // 실패해도 isReady = true 로 설정해 무한 스피너 방지
        _setReady()
      }
    }

    init()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [_setUser, _setReady])

  return <>{children}</>
}
