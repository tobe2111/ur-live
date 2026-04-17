/**
 * KakaoCallbackPage - 카카오 OAuth 콜백 처리
 *
 * 한국: 백엔드 API 호출 → localStorage 설정 → 리다이렉트. Firebase 0.
 * 글로벌: 백엔드 API 호출 → Firebase customToken → localStorage → 리다이렉트.
 */
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { isKorea } from '@/config/region'
import { getTempCartItem, clearTempCartItem } from '@/utils/auth'
import { toast } from '@/hooks/useToast'

export default function KakaoCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const processingRef = useRef(false)

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

        const { customToken, user } = res.data.data

        // ── localStorage 설정 (공통) ──
        localStorage.setItem('user_type', 'user')
        localStorage.setItem('user_id', String(user.id))
        localStorage.setItem('user_name', user.name || '')
        localStorage.setItem('session_login', 'true')
        if (user.email) localStorage.setItem('user_email', user.email)
        if (user.profile_image) localStorage.setItem('user_profile_image', user.profile_image)

        // ── 글로벌 전용: Firebase customToken 로그인 ──
        if (!isKorea() && customToken) {
          try {
            const { signInWithCustomToken } = await import('@/lib/firebase-auth')
            const cred = await signInWithCustomToken(customToken)
            const { useAuthWorld } = await import('@/shared/stores/useAuthWorld')
            useAuthWorld.getState().setUser(cred.user)
            useAuthWorld.getState().setAuthReady(true)
          } catch (e) {
            console.warn('[KakaoCallback] Firebase failed (세션 쿠키로 진행):', e)
          }
        }

        // ── 장바구니 복원 ──
        const tempCart = getTempCartItem()
        if (tempCart) {
          api.post('/api/cart', {
            product_id: tempCart.productId, quantity: tempCart.quantity,
            price_snapshot: tempCart.priceSnapshot, live_stream_id: tempCart.liveStreamId,
          }).catch(() => {}).finally(() => clearTempCartItem())
        }

        // ── returnUrl 결정 & 이동 ──
        let returnUrl = '/'
        if (state && state !== '/login' && state.startsWith('/')) {
          returnUrl = decodeURIComponent(state)
        } else {
          const stored = localStorage.getItem('loginReturnUrl')
          if (stored && stored !== '/login') returnUrl = stored
        }
        localStorage.removeItem('loginReturnUrl')
        navigate(returnUrl, { replace: true })

      } catch (err: unknown) {
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
