import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Play } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post('/api/auth/user/login', {
        email,
        password
      })

      if (response.data.success) {
        const { access_token, user } = response.data.data

        // localStorage에 저장
        localStorage.setItem('userId', user.id.toString())
        localStorage.setItem('userName', user.name)
        localStorage.setItem('userEmail', user.email)
        localStorage.setItem('accessToken', access_token)

        // 메인 페이지로 이동
        alert(`환영합니다, ${user.name}님!`)
        navigate('/')
      } else {
        setError(response.data.error || '로그인에 실패했습니다.')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.response?.data?.error || '로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post('/api/auth/user/register', {
        email,
        password,
        name: email.split('@')[0], // 이메일 앞부분을 이름으로 사용
        phone: ''
      })

      if (response.data.success) {
        const { access_token, user } = response.data.data

        // localStorage에 저장
        localStorage.setItem('userId', user.id.toString())
        localStorage.setItem('userName', user.name)
        localStorage.setItem('userEmail', user.email)
        localStorage.setItem('accessToken', access_token)

        // 메인 페이지로 이동
        alert(`회원가입 완료! 환영합니다, ${user.name}님!`)
        navigate('/')
      } else {
        setError(response.data.error || '회원가입에 실패했습니다.')
      }
    } catch (err: any) {
      console.error('Register error:', err)
      setError(err.response?.data?.error || '회원가입 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handleKakaoLogin() {
    // Kakao 로그인 URL로 리다이렉트
    const KAKAO_REST_API_KEY = '5dd74bccb797640b0efd070467f3bafd'
    const REDIRECT_URI = `${window.location.origin}/auth/kakao/callback`
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code`
    
    window.location.href = kakaoAuthUrl
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbfbfd] to-white flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <Link to="/" className="flex items-center space-x-2 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#007aff] to-[#0051d5]">
          <Play className="h-5 w-5 text-white fill-white" />
        </div>
        <span className="text-[24px] font-semibold tracking-tight text-[#1d1d1f]">
          유어 라이브
        </span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-[24px] text-center">로그인</CardTitle>
        </CardHeader>
        <CardContent>
          {!showEmailLogin ? (
            // 카카오 로그인 우선 화면
            <div className="space-y-4">
              {/* 카카오 로그인 버튼 */}
              <Button
                onClick={handleKakaoLogin}
                className="w-full h-12 bg-[#FEE500] hover:bg-[#FDD835] text-[#000000] text-[16px] font-semibold rounded-lg flex items-center justify-center space-x-2"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3C5.58172 3 2 5.89543 2 9.5C2 11.6484 3.2832 13.5234 5.25 14.6094L4.4375 17.5938C4.375 17.8203 4.60937 18 4.8125 17.875L8.25 15.7578C8.82813 15.8516 9.40625 15.9219 10 15.9219C14.4183 15.9219 18 13.0547 18 9.5C18 5.89543 14.4183 3 10 3Z" fill="currentColor"/>
                </svg>
                <span>카카오 로그인</span>
              </Button>

              {/* 구분선 */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">또는</span>
                </div>
              </div>

              {/* 이메일 로그인 버튼 */}
              <Button
                onClick={() => setShowEmailLogin(true)}
                variant="outline"
                className="w-full h-12 text-[16px] border-gray-300 hover:bg-gray-50"
              >
                이메일로 로그인
              </Button>
            </div>
          ) : (
            // 이메일 로그인/회원가입 폼
            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  비밀번호
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff] transition-all"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full apple-button h-11 text-[16px]"
              >
                {loading ? '처리 중...' : (isRegistering ? '회원가입' : '로그인')}
              </Button>

              {/* 로그인/회원가입 전환 */}
              <div className="text-center text-sm">
                <span className="text-gray-600">
                  {isRegistering ? '이미 계정이 있으신가요?' : '계정이 없으신가요?'}
                </span>
                {' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering)
                    setError('')
                  }}
                  className="text-[#007aff] hover:text-[#0051d5] font-medium"
                >
                  {isRegistering ? '로그인' : '회원가입'}
                </button>
              </div>

              {/* 뒤로가기 */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailLogin(false)
                    setError('')
                    setEmail('')
                    setPassword('')
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  ← 다른 방법으로 로그인
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <Link to="/" className="text-sm text-[#007aff] hover:text-[#0051d5] transition-colors">
          ← 메인으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
