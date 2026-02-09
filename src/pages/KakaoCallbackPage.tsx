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

          // localStorage에 저장
          localStorage.setItem('accessToken', session_token)
          localStorage.setItem('userId', user.id.toString())
          localStorage.setItem('userName', user.name)
          localStorage.setItem('userEmail', user.email || '')

          console.log('[Kakao OAuth] Login successful')
          
          // 메인 페이지로 이동
          alert(`환영합니다, ${user.name}님!`)
          navigate('/')
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
