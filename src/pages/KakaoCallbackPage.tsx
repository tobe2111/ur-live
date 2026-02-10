import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

export default function KakaoCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const handleKakaoCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')

      if (error) {
        console.error('[Kakao OAuth] Error:', error)
        alert('카카오 로그인에 실패했습니다.')
        navigate('/login')
        return
      }

      if (!code) {
        console.error('[Kakao OAuth] No authorization code')
        alert('인증 코드가 없습니다.')
        navigate('/login')
        return
      }

      try {
        console.log('[Kakao OAuth] Processing callback with code')
        
        // 백엔드로 코드 전송하여 액세스 토큰 교환 및 사용자 정보 저장
        // 프로덕션 도메인 고정 사용 (KOE006 에러 방지)
        const response = await axios.post('/api/auth/kakao/callback', {
          code: code,
          redirect_uri: 'https://live.ur-team.com/auth/kakao/callback'
        })

        if (response.data.success) {
          const { user, session_token } = response.data.data

          // localStorage에 저장 (두 가지 키 스타일 모두 저장)
          localStorage.setItem('accessToken', session_token)
          localStorage.setItem('userId', user.id.toString())
          localStorage.setItem('userName', user.name)
          localStorage.setItem('userEmail', user.email || '')
          
          // Alternative keys for compatibility
          localStorage.setItem('user_id', user.id.toString())
          localStorage.setItem('user_name', user.name)
          localStorage.setItem('session', session_token)

          console.log('[Kakao OAuth] Login successful')
          
          // Get return URL from localStorage
          const returnUrl = localStorage.getItem('loginReturnUrl') || '/'
          localStorage.removeItem('loginReturnUrl')
          
          // Check for temporary cart item and restore it
          const tempCartItem = localStorage.getItem('tempCartItem')
          if (tempCartItem) {
            try {
              const cartData = JSON.parse(tempCartItem)
              // Add to cart automatically
              setTimeout(async () => {
                try {
                  await axios.post('/api/cart', {
                    userId: user.id.toString(),
                    productId: cartData.productId,
                    quantity: cartData.quantity,
                    priceSnapshot: cartData.priceSnapshot,
                    liveStreamId: cartData.liveStreamId
                  })
                  
                  localStorage.setItem('hasCartItems', 'true')
                  localStorage.removeItem('tempCartItem')
                  
                  console.log('[Kakao OAuth] Restored cart item:', cartData.productName)
                } catch (error) {
                  console.error('[Kakao OAuth] Failed to restore cart item:', error)
                  localStorage.removeItem('tempCartItem')
                }
              }, 500)
            } catch (error) {
              console.error('[Kakao OAuth] Failed to parse temp cart item:', error)
              localStorage.removeItem('tempCartItem')
            }
          }
          
          // Navigate to return URL
          alert(`환영합니다, ${user.name}님!`)
          navigate(returnUrl)
        } else {
          throw new Error(response.data.error || '로그인에 실패했습니다.')
        }
      } catch (err: any) {
        console.error('[Kakao OAuth] Callback processing failed:', err)
        console.error('[Kakao OAuth] Error response:', err.response?.data)
        
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
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#FEE500] border-r-transparent mb-4"></div>
        <p className="text-lg text-gray-700">카카오 로그인 처리 중...</p>
      </div>
    </div>
  )
}
