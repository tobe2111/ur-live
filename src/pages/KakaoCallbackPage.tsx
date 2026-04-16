/**
 * KakaoCallbackPage - 카카오 OAuth 콜백 처리
 *
 * 무한 루프 방지 핵심:
 * 1. useRef(false) 플래그로 중복 실행 완전 차단 (React StrictMode 이중 마운트 대응)
 * 2. 처리 완료 후 navigate(returnUrl, { replace: true }) → 뒤로가기 방지
 * 3. onAuthStateChanged는 App.tsx에서만 구독 (여기서 중복 구독 없음)
 */

import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { signInWithCustomToken } from '@/lib/firebase-auth'
import { getTempCartItem, clearTempCartItem } from '@/utils/auth'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'
import { toast } from '@/hooks/useToast'

export default function KakaoCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // ✅ 처리 중 플래그: React StrictMode 이중 마운트 + 리렌더 시 중복 실행 방지
  const processingRef = useRef(false)

  // ✅ 스토어 직접 접근 (훅 사용 차단 회피)
  const getAuthStore = () => isKorea() ? useAuthKR.getState() : useAuthWorld.getState()

  useEffect(() => {
    // ✅ 이미 처리 중이면 즉시 종료
    if (processingRef.current) return
    processingRef.current = true

    const handleKakaoCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const state = searchParams.get('state')

      if (error) {
        console.error('[KakaoCallback] ❌ 카카오 에러:', error)
        toast.error('카카오 로그인에 실패했습니다.')
        navigate('/login', { replace: true })
        return
      }

      if (!code) {
        console.error('[KakaoCallback] ❌ code 파라미터 없음')
        toast.error('인증 코드가 없습니다.')
        navigate('/login', { replace: true })
        return
      }

      try {
        // 1. 백엔드로 code 전송 → Firebase Custom Token 수신
        const response = await api.post('/api/auth/kakao/callback', {
          code,
          redirect_uri: `${window.location.origin}/auth/kakao/sync/callback`,
        })

        if (!response.data.success) {
          throw new Error(response.data.error || '로그인에 실패했습니다.')
        }

        const { customToken, session_ready, user } = response.data.data

        // ── Session cookie flow (preferred): skip Firebase entirely ──────
        if (session_ready) {
          // Cookie was set by the server response (Set-Cookie header).
          // Use the user data from the response directly (cookie might not be
          // available for /api/auth/me yet in the same request cycle).

          // localStorage + Zustand 업데이트 (동기, 즉시)
          localStorage.setItem('user_type', 'user')
          localStorage.setItem('user_name', user.name)
          localStorage.setItem('user_id', String(user.id))
          localStorage.setItem('lastLoginUid', String(user.id))
          if (user.email) localStorage.setItem('user_email', user.email)
          if (user.profile_image) {
            localStorage.setItem('user_profile_image', user.profile_image)
          } else {
            localStorage.removeItem('user_profile_image')
          }

          // Zustand AuthStore 업데이트 (클라이언트 스토어)
          const { useAuthStore } = await import('@/client/stores/auth.store')
          useAuthStore.getState().setAuth(
            { id: String(user.id), email: user.email || '', name: user.name, role: 'user' },
            '', // no Bearer token needed — cookie handles auth
            ''
          )

          // ProtectedRoute가 확인하는 스토어에도 user 설정
          const authStore = getAuthStore()
          authStore.setUser({ uid: String(user.id), displayName: user.name, email: user.email } as any)
          authStore.setAuthReady(true)
        } else {
          // ── Legacy Firebase flow (fallback) ─────────────────────────────
          // 2. Firebase Custom Token으로 로그인
          // ⚠️ auth_processing 플래그: useMultiTabSync의 reload를 차단
          sessionStorage.setItem('auth_processing', 'true')
          const userCredential = await signInWithCustomToken(customToken)

          // ✅ 중복 처리 방지
          sessionStorage.setItem('auth_processed_uid', userCredential.user.uid);

          // 3. ID Token + 프로필 업데이트 병렬 실행 (순차→병렬로 1-2초 단축)
          const [idToken] = await Promise.all([
            userCredential.user.getIdToken(false),
            // 프로필 업데이트 (실패해도 로그인에 영향 없음)
            import('firebase/auth').then(({ updateProfile }) =>
              updateProfile(userCredential.user, {
                displayName: user.name,
                ...(user.profile_image ? { photoURL: user.profile_image } : {}),
              })
            ).catch(() => {}),
          ]);

          // 4. localStorage + Zustand 업데이트 (동기, 즉시)
          localStorage.setItem('user_type', 'user')
          localStorage.setItem('user_name', user.name)
          localStorage.setItem('user_id', String(user.id))
          localStorage.setItem('lastLoginUid', userCredential.user.uid)
          if (user.email) localStorage.setItem('user_email', user.email)
          if (user.profile_image) {
            localStorage.setItem('user_profile_image', user.profile_image)
          } else {
            localStorage.removeItem('user_profile_image')
          }

          // 5. Zustand Store + AuthStore 동시 업데이트
          const authStore = getAuthStore()
          authStore.setUser(userCredential.user)
          authStore.setAuthReady(true)

          const { useAuthStore } = await import('@/client/stores/auth.store')
          useAuthStore.getState().setAuth(
            { id: userCredential.user.uid, email: user.email || '', name: user.name, role: 'user' },
            idToken,
            ''
          )

          // 8. auth_processing 플래그 해제 (1초 후 — Zustand persist 완료 대기)
          setTimeout(() => sessionStorage.removeItem('auth_processing'), 1000)
        }
        // 6. returnUrl 결정 (state > localStorage > '/')
        let returnUrl = '/'
        if (state && state !== '/login' && state.startsWith('/')) {
          returnUrl = decodeURIComponent(state)
        } else {
          const stored = localStorage.getItem('loginReturnUrl')
          if (stored && stored !== '/login') returnUrl = stored
        }
        localStorage.removeItem('loginReturnUrl')

        // 7. 임시 장바구니 복원 (비동기, 비차단)
        const tempCartItem = getTempCartItem()
        if (tempCartItem) {
          setTimeout(async () => {
            try {
              await api.post('/api/cart', {
                product_id: tempCartItem.productId,
                quantity: tempCartItem.quantity,
                price_snapshot: tempCartItem.priceSnapshot,
                live_stream_id: tempCartItem.liveStreamId,
              })
              localStorage.setItem('hasCartItems', 'true')
            } catch (_) {
              // 장바구니 복원 실패는 로그인 실패가 아님
            } finally {
              clearTempCartItem()
            }
          }, 300)
        }

        // 9. replace: true → 뒤로가기 시 콜백 페이지 재방문 방지
        navigate(returnUrl, { replace: true })
      } catch (err: any) {
        console.error('[KakaoCallback] ❌ 처리 실패:', err)
        processingRef.current = false // 재시도 허용
        const msg = err.response?.data?.error || err.message || '로그인 처리 중 오류가 발생했습니다.'
        const detail = err.response?.data?.details || ''
        toast.error(`로그인 실패: ${msg}${detail ? '\n\n상세: ' + detail : ''}`)
        navigate('/login', { replace: true })
      }
    }

    handleKakaoCallback()
  }, []) // ✅ 의존성 배열 비움: 마운트 시 1회만 실행

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbfbfd] to-white flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-[#FEE500] border-r-transparent mb-4"></div>
        <p className="text-lg text-gray-700">카카오 로그인 처리 중...</p>
      </div>
    </div>
  )
}
