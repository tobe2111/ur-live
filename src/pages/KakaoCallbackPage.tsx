import { useEffect } from 'react'
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
  
  // Zustand Store 선택 (KR/World)
  const useAuth = isKorea() ? useAuthKR : useAuthWorld
  const setUser = useAuth(state => state.setUser)
  const setAuthReady = useAuth(state => state.setAuthReady)

  useEffect(() => {
    const handleKakaoCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const state = searchParams.get('state')  // ✅ state 파라미터 읽기

      if (error) {
        alert('카카오 로그인에 실패했습니다.')
        navigate('/login')
        return
      }

      if (!code) {
        alert('인증 코드가 없습니다.')
        navigate('/login')
        return
      }

      try {
        console.log('[KakaoCallback] 🔥 Firebase Auth 방식으로 카카오 로그인 처리')
        
        // 백엔드로 코드 전송하여 Firebase Custom Token 받기
        const response = await api.post('/api/auth/kakao/callback', {
          code: code,
          redirect_uri: 'https://live.ur-team.com/auth/kakao/sync/callback'
        })

        if (response.data.success) {
          const { customToken, user } = response.data.data

          console.log('[KakaoCallback] ✅ Firebase Custom Token 받기 완료:', {
            userId: user.id,
            userName: user.name,
            firebaseUID: user.firebaseUID
          })

          // 🔥 Firebase Auth에 Custom Token으로 로그인
          const userCredential = await signInWithCustomToken(customToken)
          console.log('[KakaoCallback] ✅ Firebase 로그인 성공:', userCredential.user.uid)
          
          // 🔥 중요: ID Token 강제 갱신하여 Custom Claims 로드
          console.log('[KakaoCallback] 🔄 ID Token 강제 갱신 중...')
          const idToken = await userCredential.user.getIdToken(true)
          console.log('[KakaoCallback] ✅ ID Token 갱신 완료:', idToken.substring(0, 30) + '...')
          
          // 🔥 Custom Claims 확인 (userName 포함)
          const decodedToken = await userCredential.user.getIdTokenResult()
          console.log('[KakaoCallback] 📊 Custom Claims:', {
            role: decodedToken.claims.role,
            userId: decodedToken.claims.userId,
            userName: decodedToken.claims.userName,
            email: decodedToken.claims.email
          })
          
          // 🔥 추가 대기: Firebase Auth State가 완전히 업데이트되도록 100ms 대기
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // ✅ Zustand Store 업데이트 (사용자 정보 동기화)
          setUser(userCredential.user)
          setAuthReady(true)
          console.log('[KakaoCallback] ✅ Zustand Store 업데이트 완료')
          
          // ✅ returnUrl 우선순위: state > localStorage > default
          let returnUrl = '/'
          
          if (state && state !== '/login') {
            // state 파라미터가 있으면 우선 사용
            returnUrl = decodeURIComponent(state)
            console.log('[KakaoCallback] Using returnUrl from state:', returnUrl)
          } else {
            // state가 없으면 localStorage에서 가져오기
            returnUrl = localStorage.getItem('loginReturnUrl') || '/'
            console.log('[KakaoCallback] Using returnUrl from localStorage:', returnUrl)
          }
          
          localStorage.removeItem('loginReturnUrl')
          
          // 표준 함수로 임시 장바구니 복원
          const tempCartItem = getTempCartItem()
          if (tempCartItem) {
            setTimeout(async () => {
              try {
                await api.post('/api/cart', {
                  userId: user.id.toString(),
                  productId: tempCartItem.productId,
                  quantity: tempCartItem.quantity,
                  priceSnapshot: tempCartItem.priceSnapshot,
                  liveStreamId: tempCartItem.liveStreamId
                })
                
                localStorage.setItem('hasCartItems', 'true')
                clearTempCartItem()
                
              } catch (error) {
                clearTempCartItem()
              }
            }, 500)
          }
          
          // Navigate to return URL
          navigate(returnUrl, { replace: true })
        } else {
          throw new Error(response.data.error || '로그인에 실패했습니다.')
        }
      } catch (err: any) {
        console.error('[KakaoCallback] ❌ 로그인 실패:', err)
        
        const errorMessage = err.response?.data?.error || err.message || '로그인 처리 중 오류가 발생했습니다.'
        const errorDetails = err.response?.data?.details || ''
        
        alert(`로그인 실패: ${errorMessage}${errorDetails ? '\n\n상세: ' + errorDetails : ''}`)
        navigate('/login')
      }
    }

    handleKakaoCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbfbfd] to-white flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-[#FEE500] border-r-transparent mb-4"></div>
        <p className="text-lg text-gray-700">카카오 로그인 처리 중...</p>
      </div>
    </div>
  )
}
