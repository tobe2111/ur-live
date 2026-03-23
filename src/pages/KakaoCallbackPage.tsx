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
        alert('카카오 로그인에 실패했습니다.')
        navigate('/login', { replace: true })
        return
      }

      if (!code) {
        console.error('[KakaoCallback] ❌ code 파라미터 없음')
        alert('인증 코드가 없습니다.')
        navigate('/login', { replace: true })
        return
      }

      try {
        console.log('[KakaoCallback] 🔄 카카오 콜백 처리 시작')

        // 1. 백엔드로 code 전송 → Firebase Custom Token 수신
        const response = await api.post('/api/auth/kakao/callback', {
          code,
          redirect_uri: `${window.location.origin}/auth/kakao/sync/callback`,
        })

        if (!response.data.success) {
          throw new Error(response.data.error || '로그인에 실패했습니다.')
        }

        const { customToken, user } = response.data.data
        console.log('[KakaoCallback] ✅ Custom Token 수신:', { userId: user.id, userName: user.name })

        // 2. Firebase Custom Token으로 로그인
        const userCredential = await signInWithCustomToken(customToken)
        console.log('[KakaoCallback] ✅ Firebase 로그인 성공:', userCredential.user.uid)

        // ✅ 중복 처리 방지: signInWithCustomToken 직후 즉시 설정
        // (이후 getIdToken/updateProfile 중 onAuthStateChanged가 fired되어도 fast path 처리)
        sessionStorage.setItem('auth_processed_uid', userCredential.user.uid);

        // 3. ID Token 갱신 (Custom Claims 로드)
        const idToken = await userCredential.user.getIdToken(false)  // ✅ 캐시 사용 (이미 최신)
        console.log('[KakaoCallback] ✅ ID Token 갱신 완료')

        // 3.5 ✅ Firebase User의 displayName 업데이트 (사용자 이름 표시용)
        try {
          const { updateProfile } = await import('firebase/auth');
          await updateProfile(userCredential.user, {
            displayName: user.name
          });
          console.log('[KakaoCallback] ✅ Firebase User displayName 업데이트:', user.name);
        } catch (e) {
          console.warn('[KakaoCallback] ⚠️ displayName 업데이트 실패 (무시):', e);
        }

        // 4. localStorage 설정
        localStorage.setItem('user_type', 'user')
        localStorage.setItem('user_name', user.name)
        localStorage.setItem('user_id', String(user.id))
        if (user.email) localStorage.setItem('user_email', user.email)

        // 5. Zustand Store 업데이트 (ID Token 포함)
        const authStore = getAuthStore()
        authStore.setUser(userCredential.user)
        authStore.setAuthReady(true)
        
        // ✅ API 요청용 accessToken 저장 (Firebase ID Token)
        const { useAuthStore } = await import('@/client/stores/auth.store')
        useAuthStore.getState().setAuth(
          {
            id: userCredential.user.uid,
            email: user.email || '',
            name: user.name,
            role: 'user',
          },
          idToken,
          '' // refreshToken은 Firebase에서 자동 관리
        )
        console.log('[KakaoCallback] ✅ Store 업데이트 완료 (accessToken 설정됨)')

        // 6. returnUrl 결정 (state > localStorage > '/')
        let returnUrl = '/'
        if (state && state !== '/login' && state.startsWith('/')) {
          returnUrl = decodeURIComponent(state)
        } else {
          const stored = localStorage.getItem('loginReturnUrl')
          if (stored && stored !== '/login') returnUrl = stored
        }
        localStorage.removeItem('loginReturnUrl')
        console.log('[KakaoCallback] 🔀 이동:', returnUrl)

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

        // 8. replace: true → 뒤로가기 시 콜백 페이지 재방문 방지
        navigate(returnUrl, { replace: true })
      } catch (err: any) {
        console.error('[KakaoCallback] ❌ 처리 실패:', err)
        processingRef.current = false // 재시도 허용
        const msg = err.response?.data?.error || err.message || '로그인 처리 중 오류가 발생했습니다.'
        const detail = err.response?.data?.details || ''
        alert(`로그인 실패: ${msg}${detail ? '\n\n상세: ' + detail : ''}`)
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
