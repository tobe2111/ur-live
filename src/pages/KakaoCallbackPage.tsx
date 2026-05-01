/**
 * KakaoCallbackPage - 카카오 OAuth 콜백 처리
 *
 * 🛡️ 2026-05-01: Firebase 100% 제거 — 한국·글로벌 모두 세션 쿠키 only.
 *
 * Flow:
 *   백엔드 POST /api/auth/kakao/callback → localStorage 설정 + httpOnly 세션 쿠키 발급
 *   → 리다이렉트.
 */
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { isKorea } from '@/config/region'
import { getTempCartItem, clearTempCartItem } from '@/utils/auth'
import { toast } from '@/hooks/useToast'
import { safeInternalPath } from '@/utils/safe-internal-path'

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

        const { user, seller_token, agency_token, seller, agency } = res.data.data

        // ── localStorage 설정 (공통) ──
        localStorage.setItem('user_type', 'user')
        localStorage.setItem('user_id', String(user.id))
        localStorage.setItem('user_name', user.name || '')
        localStorage.setItem('session_login', 'true')
        if (user.email) localStorage.setItem('user_email', user.email)
        if (user.profile_image) localStorage.setItem('user_profile_image', user.profile_image)

        // ── 카카오 계정에 연결된 셀러/에이전시 권한 자동 복원 ──
        // (백엔드가 linked_user_id 기반으로 JWT 를 이미 발급해서 보내줌)
        if (seller_token) {
          localStorage.setItem('seller_token', seller_token)
          if (seller?.id) localStorage.setItem('seller_id', String(seller.id))
          if (seller?.business_name) localStorage.setItem('seller_name', seller.business_name)
        }
        if (agency_token) {
          localStorage.setItem('agency_token', agency_token)
          if (agency?.id) localStorage.setItem('agency_id', String(agency.id))
          if (agency?.name) localStorage.setItem('agency_name', agency.name)
        }

        // 🛡️ 2026-05-01: Firebase customToken 로그인 경로 제거.
        //   세션 쿠키만으로 한국·글로벌 모두 인증 처리.
        if (!isKorea()) {
          try {
            const { useAuthWorld } = await import('@/shared/stores/useAuthWorld')
            useAuthWorld.getState().setAuthReady(true)
          } catch { /* ignore */ }
        }

        // ── 장바구니 복원 ──
        const tempCart = getTempCartItem()
        if (tempCart) {
          api.post('/api/cart', {
            product_id: tempCart.productId, quantity: tempCart.quantity,
            price_snapshot: tempCart.priceSnapshot, live_stream_id: tempCart.liveStreamId,
          }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }).finally(() => clearTempCartItem())
        }

        // ── returnUrl 결정 & 이동 ──
        // 🛡️ 2026-04-29: safeInternalPath 로 통일 — /auth/*, /login 자기참조 차단
        const stored = localStorage.getItem('loginReturnUrl')
        const returnUrl = safeInternalPath(state, safeInternalPath(stored, '/'))
        localStorage.removeItem('loginReturnUrl')
        navigate(returnUrl, { replace: true })

      } catch (err: unknown) {
        const err_ = err as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string };
        if (import.meta.env.DEV) console.error('[KakaoCallback] 실패:', err)
        toast.error(err_.response?.data?.error || err_.message || '로그인 실패')
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
