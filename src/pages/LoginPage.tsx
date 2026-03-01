import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Play, Mail, Lock, Eye, EyeOff } from 'lucide-react'

// Kakao SDK 타입 선언
declare global {
  interface Window {
    Kakao: any
  }
}

export default function LoginPage() {
  const { loginWithEmail, loginWithKakao, resetPassword, isLoggedIn, isAuthReady } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [kakaoReady, setKakaoReady] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const hasRedirected = useRef(false) // ⚠️ 중복 리다이렉트 방지
  
  // Get return URL from query params or localStorage
  const returnUrl = searchParams.get('returnUrl') || localStorage.getItem('loginReturnUrl') || '/'

  // ✅ 이미 로그인되어 있으면 홈으로 리다이렉트 (AuthContext가 주도권 가짐)
  // 단, AuthContext 초기화 완료 후에만 체크
  useEffect(() => {
    // Auth 초기화 완료 대기
    if (!isAuthReady) {
      return
    }
    
    // 이미 로그인됨 → 홈으로 리다이렉트
    if (isLoggedIn && !hasRedirected.current) {
      console.log('[LoginPage] 🔄 이미 로그인됨 - 홈으로 리다이렉트')
      hasRedirected.current = true
      navigate('/', { replace: true })  // ✅ 즉시 실행 (setTimeout 제거)
    }
  }, [isAuthReady, isLoggedIn, navigate])

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

  /**
   * 카카오 로그인 - Firebase Custom Token 방식
   */
  async function handleKakaoLogin() {
    if (!kakaoReady) {
      alert('카카오 SDK가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1단계: 이미 로그인되어 있는지 확인
      const accessToken = window.Kakao.Auth.getAccessToken()
      
      if (accessToken) {
        await processKakaoLogin(accessToken)
        return
      }

      // 2단계: REST API OAuth 방식으로 로그인
      const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') 
        || localStorage.getItem('loginReturnUrl') 
        || '/'
      
      // ✅ 환경변수 사용
      const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY || '5dd74bccb797640b0efd070467f3bafd'
      const REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/sync/callback'
      const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=${encodeURIComponent(returnUrl)}`
      
      window.location.href = kakaoAuthUrl
      
    } catch (err: any) {
      setError('카카오 로그인 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  /**
   * 카카오 accessToken으로 Firebase Custom Token 로그인
   */
  async function processKakaoLogin(accessToken: string) {
    try {
      console.log('[Kakao Login] 🔥 Firebase Custom Token 요청 시작')
      
      // 백엔드에서 Firebase Custom Token 받기
      const response = await api.post('/api/auth/kakao/firebase', {
        accessToken: accessToken
      })

      if (response.data.success) {
        const { customToken, user } = response.data

        console.log('[Kakao Login] ✅ Firebase Custom Token 받기 완료:', {
          userId: user.id,
          userName: user.name,
          hasCustomToken: !!customToken
        })

        // Firebase Auth에 Custom Token으로 로그인
        await loginWithKakao(accessToken)
        
        // Clear return URL from localStorage
        const savedReturnUrl = localStorage.getItem('loginReturnUrl') || '/'
        localStorage.removeItem('loginReturnUrl')
        
        console.log('[Kakao Login] ✅ Firebase 로그인 성공:', user.name)
        
        // Navigate to return URL
        navigate(savedReturnUrl, { replace: true })
      } else {
        throw new Error(response.data.error || '로그인에 실패했습니다.')
      }
    } catch (err: any) {
      console.error('[Kakao Login] ❌ 오류:', err)
      setError(err.response?.data?.error || '카카오 로그인 처리 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  /**
   * 이메일/비밀번호 로그인 - Firebase Auth
   */
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      console.log('[Email Login] 🔥 Firebase 이메일 로그인 시도:', email)
      
      // Firebase Auth로 로그인
      await loginWithEmail(email, password)
      
      console.log('[Email Login] ✅ Firebase 로그인 성공')
      
      // Clear return URL from localStorage
      const savedReturnUrl = localStorage.getItem('loginReturnUrl') || '/'
      localStorage.removeItem('loginReturnUrl')
      
      // Navigate to return URL
      navigate(savedReturnUrl, { replace: true })
      
    } catch (err: any) {
      console.error('[Email Login] ❌ 오류:', err)
      
      // Firebase 오류 메시지 한국어 변환
      let errorMessage = '로그인에 실패했습니다.'
      if (err.message.includes('invalid-credential') || err.message.includes('wrong-password')) {
        errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.'
      } else if (err.message.includes('user-not-found')) {
        errorMessage = '등록되지 않은 이메일입니다.'
      } else if (err.message.includes('too-many-requests')) {
        errorMessage = '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.'
      }
      
      setError(errorMessage)
      setLoading(false)
    }
  }

  /**
   * 비밀번호 재설정 이메일 발송
   */
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    
    if (!email) {
      setError('이메일을 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      console.log('[Forgot Password] 📧 비밀번호 재설정 이메일 발송:', email)
      
      await resetPassword(email)
      
      console.log('[Forgot Password] ✅ 이메일 발송 완료')
      setSuccessMessage('비밀번호 재설정 이메일이 발송되었습니다. 이메일을 확인해주세요.')
      setShowForgotPassword(false)
      
    } catch (err: any) {
      console.error('[Forgot Password] ❌ 오류:', err)
      
      let errorMessage = '비밀번호 재설정 이메일 발송에 실패했습니다.'
      if (err.message.includes('user-not-found')) {
        errorMessage = '등록되지 않은 이메일입니다.'
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // ⏳ Auth 초기화 중이면 로딩 표시
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff] mx-auto"></div>
          <p className="mt-4 text-[#6e6e73]">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="apple-glass sticky top-0 z-50 border-b border-[#e5e5ea]">
        <div className="max-w-[980px] mx-auto px-4 sm:px-6">
          <div className="flex h-[52px] items-center justify-between">
            <Link to="/" className="flex items-center space-x-1.5 sm:space-x-2">
              <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#007aff] to-[#0051d5]">
                <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white fill-white" />
              </div>
              <span className="text-[17px] sm:text-[21px] font-semibold tracking-tight text-[#1d1d1f]">
                리스터코퍼레이션
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[480px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="text-[32px] sm:text-[40px] font-bold text-[#1d1d1f] mb-3">
            로그인
          </h1>
          <p className="text-[15px] sm:text-[17px] text-[#6e6e73]">
            라이브 쇼핑의 새로운 경험
          </p>
        </div>

        <div className="apple-card p-6 sm:p-8">
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-[14px] mb-4">
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-[14px] mb-4">
              {error}
            </div>
          )}

          {/* 비밀번호 재설정 폼 */}
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                  이메일
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6e6e73]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="apple-button w-full py-4"
              >
                {loading ? '발송 중...' : '재설정 이메일 발송'}
              </button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-[14px] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
              >
                로그인으로 돌아가기
              </button>
            </form>
          ) : !showEmailLogin ? (
            /* 소셜 로그인 */
            <div className="space-y-4">
              <Button
                onClick={handleKakaoLogin}
                disabled={loading || !kakaoReady}
                className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#000000] font-semibold py-6 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.8-.7 3-.8 3.5 0 .2-.1.5.2.7.2.1.5.1.7 0 .3-.1 3.5-2.3 4.1-2.7.4.1.8.1 1.1.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/>
                </svg>
                {loading ? '로그인 중...' : '카카오로 시작하기'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#e5e5ea]"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-[#6e6e73]">또는</span>
                </div>
              </div>

              <button
                onClick={() => setShowEmailLogin(true)}
                className="w-full py-4 border border-[#e5e5ea] rounded-xl text-[15px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
              >
                이메일로 로그인
              </button>
            </div>
          ) : (
            /* 이메일 로그인 폼 */
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                  이메일
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6e6e73]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                  비밀번호
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6e6e73]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-12 pr-12 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6e6e73] hover:text-[#1d1d1f]"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="apple-button w-full py-4"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>

              <div className="flex justify-between text-[14px]">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-[#007aff] hover:opacity-60 transition-opacity"
                >
                  비밀번호를 잊으셨나요?
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailLogin(false)}
                  className="text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
                >
                  다른 방법으로 로그인
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Sign Up Link */}
        <div className="text-center mt-6">
          <p className="text-[15px] text-[#6e6e73]">
            아직 계정이 없으신가요?
            {' '}
            <Link
              to="/register"
              className="text-[#007aff] font-medium hover:opacity-60 transition-opacity"
            >
              가입하기
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
