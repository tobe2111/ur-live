import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { saveJwtTokens, getTempCartItem, clearTempCartItem } from '@/utils/auth'

export default function KakaoCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

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
        
        // 백엔드로 코드 전송하여 액세스 토큰 교환 및 사용자 정보 저장
        // 프로덕션 도메인 고정 사용 (KOE006 에러 방지)
        const response = await api.post('/api/auth/kakao/callback', {
          code: code,
          redirect_uri: 'https://live.ur-team.com/auth/kakao/sync/callback'
        })

        if (response.data.success) {
          const { user, accessToken, refreshToken } = response.data.data

          // JWT 토큰 저장 (localStorage 키 통일)
          console.log('[KakaoCallback] 💾 JWT 토큰 저장 시작:', {
            userId: user.id,
            userName: user.name,
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            email: user.email
          })
          
          saveJwtTokens(
            accessToken,
            refreshToken,
            user.id.toString(),
            user.name,
            'user',
            user.email
          )
          
          // 저장 확인
          console.log('[KakaoCallback] ✅ localStorage 저장 완료:', {
            access_token: localStorage.getItem('access_token') ? '있음' : '없음',
            refresh_token: localStorage.getItem('refresh_token') ? '있음' : '없음',
            user_id: localStorage.getItem('user_id'),
            user_name: localStorage.getItem('user_name'),
            user_type: localStorage.getItem('user_type'),
            isLoggedIn: !!localStorage.getItem('access_token') && !!localStorage.getItem('user_id')
          })

          
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
          // Removed blocking alert for faster navigation
          navigate(returnUrl, { replace: true })
        } else {
          throw new Error(response.data.error || '로그인에 실패했습니다.')
        }
      } catch (err: any) {
        
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
