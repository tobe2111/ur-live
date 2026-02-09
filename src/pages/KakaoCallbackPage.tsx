import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

export default function KakaoCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const handleKakaoCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state') // Original URL to return to
      
      if (!code) {
        alert('카카오 로그인에 실패했습니다.')
        navigate('/')
        return
      }

      try {
        // Call backend to exchange code for token
        const response = await axios.post('/api/auth/kakao/callback', { code })
        
        if (response.data.success) {
          // Save token and user info (consistent with email login)
          localStorage.setItem('accessToken', response.data.data.access_token)
          localStorage.setItem('userId', response.data.data.user.id.toString())
          localStorage.setItem('userName', response.data.data.user.name)
          localStorage.setItem('userEmail', response.data.data.user.email || '')
          
          // Show welcome message
          alert(`환영합니다, ${response.data.data.user.name}님!`)
          
          // Redirect back to original page or home
          if (state) {
            window.location.href = state
          } else {
            navigate('/')
          }
        } else {
          throw new Error(response.data.error || 'Login failed')
        }
      } catch (error) {
        console.error('Kakao login error:', error)
        alert('카카오 로그인 처리 중 오류가 발생했습니다.')
        navigate('/')
      }
    }

    handleKakaoCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-[#FEE500] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#000000] border-t-transparent mx-auto mb-4"></div>
        <p className="text-[#000000] text-[17px] font-semibold">
          카카오 로그인 중...
        </p>
      </div>
    </div>
  )
}
