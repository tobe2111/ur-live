/**
 * KakaoCallbackPage — 카카오 OAuth 콜백 처리
 *
 * 역할: signInWithCustomToken 호출만.
 * 상태 관리(user, isReady 세팅)는 AuthProvider 의 onAuthStateChanged 가 자동 처리.
 *
 * 흐름:
 *   1. URL 에서 code 추출
 *   2. 백엔드 /api/auth/kakao/callback 으로 code 전달 → Firebase Custom Token 수신
 *   3. signInWithCustomToken(customToken) 호출
 *      → Firebase SDK 가 IndexedDB 에 세션 저장
 *      → onAuthStateChanged 가 즉시 발생
 *      → AuthProvider 가 user / isReady 를 자동 세팅
 *   4. navigate(returnUrl) — 이 시점에 이미 useAuth.user 가 세팅되어 있음
 */

import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { signInWithCustomToken } from '@/lib/firebase-auth'
import { getTempCartItem, clearTempCartItem } from '@/utils/auth'

export default function KakaoCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const processingRef = useRef(false)

  useEffect(() => {
    // React StrictMode 이중 실행 방지
    if (processingRef.current) return
    processingRef.current = true

    const run = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const state = searchParams.get('state') // returnUrl 이 담겨 있음

      if (error || !code) {
        console.error('[KakaoCallback] 오류 또는 code 없음:', error)
        navigate('/login', { replace: true })
        return
      }

      try {
        console.log('[KakaoCallback] 처리 시작')

        // 1. 백엔드 → Firebase Custom Token
        const { data } = await api.post('/api/auth/kakao/callback', {
          code,
          redirect_uri: `${window.location.origin}/auth/kakao/sync/callback`,
        })

        if (!data.success) throw new Error(data.error || '로그인 실패')

        const { customToken, user } = data.data

        // 2. localStorage 에 user_type 먼저 설정
        //    AuthProvider.onAuthStateChanged 가 seller/admin 을 건너뛰지 않도록
        localStorage.setItem('user_type', 'user')
        localStorage.setItem('user_name', user.name || '')
        if (user.email) localStorage.setItem('user_email', user.email)

        // 3. Firebase 로그인 — 이후 onAuthStateChanged 가 자동으로 useAuth 를 업데이트
        await signInWithCustomToken(customToken)
        console.log('[KakaoCallback] ✅ Firebase 로그인 완료')

        // 4. displayName 업데이트 (선택적, 실패해도 무시)
        try {
          const { getFirebaseAuth } = await import('@/lib/firebase-auth')
          const { updateProfile } = await import('firebase/auth')
          const auth = await getFirebaseAuth()
          if (auth.currentUser) {
            await updateProfile(auth.currentUser, { displayName: user.name })
            localStorage.setItem('user_id', auth.currentUser.uid)
          }
        } catch (_) {}

        // 5. returnUrl 결정
        let returnUrl = '/'
        if (state && !state.startsWith('/login') && !state.startsWith('/auth/') && state.startsWith('/')) {
          returnUrl = decodeURIComponent(state)
        } else {
          const stored = localStorage.getItem('loginReturnUrl')
          if (stored && !stored.startsWith('/login') && !stored.startsWith('/auth/')) {
            returnUrl = stored
          }
        }
        localStorage.removeItem('loginReturnUrl')
        sessionStorage.removeItem('returnUrl')
        sessionStorage.removeItem('loginReturnUrl')

        // 6. 임시 장바구니 복원 (비동기, 비차단)
        const tempCart = getTempCartItem()
        if (tempCart) {
          setTimeout(async () => {
            try {
              await api.post('/api/cart', {
                product_id: tempCart.productId,
                quantity: tempCart.quantity,
                price_snapshot: tempCart.priceSnapshot,
                live_stream_id: tempCart.liveStreamId,
              })
              localStorage.setItem('hasCartItems', 'true')
            } catch (_) {}
            finally { clearTempCartItem() }
          }, 300)
        }

        console.log('[KakaoCallback] → 이동:', returnUrl)
        navigate(returnUrl, { replace: true })

      } catch (err: any) {
        processingRef.current = false
        console.error('[KakaoCallback] 실패:', err)
        const msg = err.response?.data?.error || err.message || '로그인 오류'
        alert(`로그인 실패: ${msg}`)
        navigate('/login', { replace: true })
      }
    }

    run()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-[#FEE500] border-r-transparent mb-4" />
        <p className="text-gray-700">카카오 로그인 처리 중...</p>
      </div>
    </div>
  )
}
