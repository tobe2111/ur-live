/**
 * KakaoCallbackPage - 카카오 OAuth 콜백 처리
 * 세션 쿠키 우선, Firebase 폴백
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
  const processingRef = useRef(false)
  const getAuthStore = () => isKorea() ? useAuthKR.getState() : useAuthWorld.getState()

  useEffect(() => {
    if (processingRef.current) return
    processingRef.current = true

    const handleCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const state = searchParams.get('state')

      if (error || !code) {
        toast.error('카카오 로그인에 실패했습니다.')
        navigate('/login', { replace: true })
        return
      }

      try {
        const res = await api.post('/api/auth/kakao/callback', {
          code,
          redirect_uri: `${window.location.origin}/auth/kakao/sync/callback`,
        })

        if (!res.data.success) throw new Error(res.data.error || '로그인 실패')

        const { customToken, session_ready, user } = res.data.data

        // localStorage 공통 설정
        localStorage.setItem('user_type', 'user')
        localStorage.setItem('user_id', String(user.id))
        localStorage.setItem('user_name', user.name || '')
        localStorage.setItem('lastLoginUid', String(user.id))
        localStorage.setItem('session_login', 'true')
        if (user.email) localStorage.setItem('user_email', user.email)
        if (user.profile_image) localStorage.setItem('user_profile_image', user.profile_image)

        // 한국: Firebase 완전 건너뜀 (세션 쿠키만 사용)
        // 글로벌: Firebase customToken 로그인 (Google/Apple 등 호환)
        if (isKorea()) {
          getAuthStore().setAuthReady(true)
        } else if (customToken) {
          try {
            sessionStorage.setItem('auth_processing', 'true')
            const cred = await signInWithCustomToken(customToken)
            sessionStorage.setItem('auth_processed_uid', cred.user.uid)
            localStorage.setItem('lastLoginUid', cred.user.uid)
            const authStore = getAuthStore()
            authStore.setUser(cred.user)
            authStore.setAuthReady(true)
            const { useAuthStore } = await import('@/client/stores/auth.store')
            const idToken = await cred.user.getIdToken(false)
            useAuthStore.getState().setAuth(
              { id: cred.user.uid, email: user.email || '', name: user.name, role: 'user' },
              idToken, ''
            )
            setTimeout(() => sessionStorage.removeItem('auth_processing'), 1000)
          } catch (e) {
            console.error('[KakaoCallback] Firebase failed, using session cookie:', e)
            getAuthStore().setAuthReady(true)
          }
        } else {
          getAuthStore().setAuthReady(true)
        }

        // 장바구니 복원
        const tempCart = getTempCartItem()
        if (tempCart) {
          api.post('/api/cart', {
            product_id: tempCart.productId, quantity: tempCart.quantity,
            price_snapshot: tempCart.priceSnapshot, live_stream_id: tempCart.liveStreamId,
          }).catch(() => {}).finally(() => clearTempCartItem())
        }

        // returnUrl 이동
        let returnUrl = '/'
        if (state && state !== '/login' && state.startsWith('/')) returnUrl = decodeURIComponent(state)
        else {
          const stored = localStorage.getItem('loginReturnUrl')
          if (stored && stored !== '/login') returnUrl = stored
        }
        localStorage.removeItem('loginReturnUrl')
        navigate(returnUrl, { replace: true })

      } catch (err: any) {
        console.error('[KakaoCallback] 실패:', err)
        toast.error(err.response?.data?.error || err.message || '로그인 실패')
        navigate('/login', { replace: true })
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-3" />
        <p className="text-gray-400 text-sm">로그인 처리 중...</p>
      </div>
    </div>
  )
}
