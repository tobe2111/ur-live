import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Play } from 'lucide-react'

// Kakao SDK 타입 선언
declare global {
  interface Window {
    Kakao: any
  }
}

export default function LoginPage() {
  const { loginWithCredentials } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [kakaoReady, setKakaoReady] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // Get return URL from query params or localStorage
  const returnUrl = searchParams.get('returnUrl') || localStorage.getItem('loginReturnUrl') || '/'

  useEffect(() => {
    // Save returnUrl to localStorage if provided
    const urlParam = searchParams.get('returnUrl')
    if (urlParam) {
      localStorage.setItem('loginReturnUrl', urlParam)
    }
    
    // Kakao SDK 초기화 확인
    const checkKakaoSDK = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init('975a2e7f97254b08f15dba4d177a2865')
      }
      
      if (window.Kakao && window.Kakao.isInitialized()) {
        setKakaoReady(true)
      } else {
        // SDK가 로드되지 않았으면 재시도
        setTimeout(checkKakaoSDK, 100)
      }
    }

    checkKakaoSDK()
  }, [])

  async function handleKakaoLogin() {
    if (!kakaoReady) {
      alert('카카오 SDK가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      
      // 1단계: 이미 로그인되어 있는지 확인 (카카오톡 앱 내부에서 자동 로그인된 경우)
      const accessToken = window.Kakao.Auth.getAccessToken()
      
      if (accessToken) {
        await processKakaoLogin(accessToken)
        return
      }

      // 2단계: 로그인되지 않은 경우, REST API OAuth 방식으로 로그인
      
      // returnUrl 파라미터 또는 localStorage에서 읽기
      const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') 
        || localStorage.getItem('loginReturnUrl') 
        || '/'
      
      // ✅ 환경변수 사용 (없으면 fallback)
      const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY || '5dd74bccb797640b0efd070467f3bafd'
      // 프로덕션 도메인 고정 사용 (KOE006 에러 방지)
      const REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/sync/callback'
      const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=${encodeURIComponent(returnUrl)}`
      
      window.location.href = kakaoAuthUrl
      
    } catch (err: any) {
      setError('로그인 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  async function processKakaoLogin(accessToken: string) {
    try {
      
      // 백엔드로 액세스 토큰 전송하여 검증 및 JWT 발급
      const response = await api.post('/api/auth/kakao/sync', {
        accessToken: accessToken
      })

      if (response.data.success) {
        const { user, accessToken: jwtAccessToken, refreshToken } = response.data.data

        console.log('[Kakao Login] JWT 토큰 받기 완료:', {
          userId: user.id,
          userName: user.name,
          hasAccessToken: !!jwtAccessToken,
          hasRefreshToken: !!refreshToken
        })

        // ✅ JWT 토큰 저장 (saveJwtTokens 사용)
        const { saveJwtTokens } = await import('@/utils/auth')
        saveJwtTokens(
          jwtAccessToken,
          refreshToken,
          user.id.toString(),
          user.name,
          'user',
          user.email
        )

        // Sentry 사용자 설정
        try {
          const { setSentryUser } = await import('@/lib/sentry')
          setSentryUser({
            id: user.id.toString(),
            email: user.email || undefined,
            username: user.name,
            userType: 'user'
          })
        } catch (e) {
          // Sentry 초기화 실패 시 무시
        }
        
        // Clear return URL from localStorage
        const savedReturnUrl = localStorage.getItem('loginReturnUrl') || '/'
        localStorage.removeItem('loginReturnUrl')
        
        // ✅ 로그인 성공
        console.log('[Kakao Login] Success:', user.name)
        
        // Navigate to return URL
        navigate(savedReturnUrl, { replace: true })
      } else {
        throw new Error(response.data.error || '로그인에 실패했습니다.')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '로그인 처리 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await api.post('/api/auth/user/login', {
        email,
        password
      })

      if (response.data.success) {
        const { user, access_token, session_token } = response.data.data
        const token = session_token || access_token  // 토큰 우선순위

        // ✅ AuthContext를 통한 통합 로그인 처리
        loginWithCredentials(
          user.id.toString(),
          user.name,
          token,
          'user'
        )
        
        // Clear return URL from localStorage
        const savedReturnUrl = localStorage.getItem('loginReturnUrl') || '/'
        localStorage.removeItem('loginReturnUrl')

        // ✅ 로그인 성공 - alert 제거로 UX 개선
        console.log('[Login] Success:', user.name)
        
        // Navigate to return URL
        navigate(savedReturnUrl)
      } else {
        throw new Error(response.data.error || '로그인에 실패했습니다.')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '로그인 처리 중 오류가 발생했습니다.')
      setLoading(false)
    }
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
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {!showEmailLogin ? (
              <>
                {/* 카카오 로그인 버튼 */}
                <Button
                  onClick={handleKakaoLogin}
                  disabled={loading || !kakaoReady}
                  className="w-full h-12 bg-[#FEE500] hover:bg-[#FDD835] text-[#000000] text-[16px] font-semibold rounded-lg flex items-center justify-center space-x-2"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3C5.58172 3 2 5.89543 2 9.5C2 11.6484 3.2832 13.5234 5.25 14.6094L4.4375 17.5938C4.375 17.8203 4.60937 18 4.8125 17.875L8.25 15.7578C8.82813 15.8516 9.40625 15.9219 10 15.9219C14.4183 15.9219 18 13.0547 18 9.5C18 5.89543 14.4183 3 10 3Z" fill="currentColor"/>
                  </svg>
                  <span>{loading ? '로그인 중...' : '카카오 로그인'}</span>
                </Button>

                {!kakaoReady && (
                  <p className="text-sm text-gray-500 text-center">
                    카카오 SDK를 로드하는 중...
                  </p>
                )}

                {/* 구분선 */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">또는</span>
                  </div>
                </div>

                {/* 이메일 로그인 버튼 */}
                <Button
                  onClick={() => setShowEmailLogin(true)}
                  variant="outline"
                  className="w-full h-12 text-[16px] font-medium rounded-lg"
                >
                  이메일로 로그인
                </Button>
              </>
            ) : (
              <>
                {/* 이메일 로그인 폼 */}
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      이메일
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                      placeholder="user@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      비밀번호
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-[#007aff] hover:bg-[#0051d5] text-white text-[16px] font-semibold rounded-lg"
                  >
                    {loading ? '로그인 중...' : '로그인'}
                  </Button>

                  <Button
                    type="button"
                    onClick={() => {
                      setShowEmailLogin(false)
                      setError('')
                      setEmail('')
                      setPassword('')
                    }}
                    variant="ghost"
                    className="w-full text-sm text-gray-600"
                  >
                    ← 카카오 로그인으로 돌아가기
                  </Button>
                </form>

                {/* 테스트 계정 안내 */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800 font-medium mb-1">테스트 계정</p>
                  <p className="text-xs text-blue-700">
                    이메일: user@example.com<br/>
                    비밀번호: user123
                  </p>
                </div>
              </>
            )}

            {!kakaoReady && (
              <p className="text-sm text-gray-500 text-center">
                카카오 SDK를 로드하는 중...
              </p>
            )}

            <div className="pt-4 text-center text-sm text-gray-600">
              <p>카카오 계정으로 간편하게 로그인하세요</p>
            </div>
          </div>
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
