/**
 * KakaoCallbackPage - 카카오 OAuth 콜백 처리
 *
 * 플로우: 카카오 인증 → 서버 세션 쿠키 발급 → localStorage 설정 → 완료
 * Firebase 불필요 (세션 쿠키로 인증)
 */
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { getTempCartItem, clearTempCartItem } from '@/utils/auth'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'
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

      if (error) {
        toast.error('카카오 로그인에 실패했습니다.')
        navigate('/login', { replace: true })
        return
      }
      if (!code) {
        toast.error('인증 코드가 없습니다.')
        navigate('/login', { replace: true })
        return
      }

      try {
        // 1. 서버에 code 전송 → 세션 쿠키 발급
        const res = await api.post('/api/auth/kakao/callback', {
          code,
          redirect_uri: `${window.location.origin}/auth/kakao/sync/callback`,
        })

        if (!res.data.success) {
          throw new Error(res.data.error || '로그인에 실패했습니다.')
        }

        const { user } = res.data.data

        // 2. localStorage 설정
        localStorage.setItem('user_type', 'user')
        localStorage.setItem('user_id', String(user.id))
        localStorage.setItem('user_name', user.name || '')
        localStorage.setItem('lastLoginUid', String(user.id))
        localStorage.setItem('session_login', 'true')
        if (user.email) localStorage.setItem('user_email', user.email)
        if (user.profile_image) localStorage.setItem('user_profile_image', user.profile_image)
        else localStorage.removeItem('user_profile_image')

        // 3. Zustand 스토어 업데이트
        const authStore = isKorea() ? useAuthKR.getState() : useAuthWorld.getState()
        authStore.setAuthReady(true)
        try {
          const { useAuthStore } = await import('@/client/stores/auth.store')
          useAuthStore.getState().setAuth(
            { id: String(user.id), email: user.email || '', name: user.name, role: 'user' },
            '', ''
          )
        } catch {}

        // 4. 임시 장바구니 복원
        const tempCart = getTempCartItem()
        if (tempCart) {
          api.post('/api/cart', {
            product_id: tempCart.productId,
            quantity: tempCart.quantity,
            price_snapshot: tempCart.priceSnapshot,
            live_stream_id: tempCart.liveStreamId,
          }).catch(() => {}).finally(() => clearTempCartItem())
        }

        // 5. returnUrl로 이동
        let returnUrl = '/'
        if (state && state !== '/login' && state.startsWith('/')) {
          returnUrl = decodeURIComponent(state)
        } else {
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
