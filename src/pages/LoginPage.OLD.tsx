import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isKorea } from '@/config/region'
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
  const { t } = useTranslation() // ✅ i18n 추가
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
  const hasRedirected = useRef(false)
  
  const returnUrl = searchParams.get('returnUrl') || sessionStorage.getItem('returnUrl') || '/'

  // ... 기존 useEffect와 로직들은 그대로 유지 ...
  
  useEffect(() => {
    if (!isAuthReady) {
      console.log('[LoginPage] ⏳ Auth 초기화 대기 중...')
      return
    }
    
    if (isLoggedIn && !hasRedirected.current) {
      console.log('[LoginPage] ✅ 이미 로그인됨 - returnUrl로 리다이렉트:', returnUrl)
      hasRedirected.current = true
      navigate(returnUrl, { replace: true })
      return // 🔥 Early return after navigation
    }
  }, [isAuthReady, isLoggedIn]) // 🔥 Remove navigate and returnUrl from deps

  useEffect(() => {
    const urlParam = searchParams.get('returnUrl')
    if (urlParam) {
      sessionStorage.setItem('returnUrl', urlParam)
      console.log('[LoginPage] 🎯 returnUrl 저장:', urlParam)
    }
    
    const checkKakaoSDK = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init('975a2e7f97254b08f15dba4d177a2865')
      }
      
      if (window.Kakao && window.Kakao.isInitialized()) {
        setKakaoReady(true)
      } else {
        setTimeout(checkKakaoSDK, 100)
      }
    }

    checkKakaoSDK()
  }, [])

  async function handleKakaoLogin() {
    if (!kakaoReady) {
      alert(t('auth.kakaoSdkNotReady')) // ✅ 번역
      return
    }

    setLoading(true)
    setError('')

    try {
      const accessToken = window.Kakao.Auth.getAccessToken()
      
      if (accessToken) {
        await processKakaoLogin(accessToken)
        return
      }

      const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') 
        || localStorage.getItem('loginReturnUrl') 
        || '/'
      
      // ✅ 환경 변수 검증 추가
      const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY
      
      if (!KAKAO_REST_API_KEY) {
        console.error('[Kakao Login] ❌ VITE_KAKAO_REST_API_KEY 환경 변수가 설정되지 않았습니다')
        console.error('[Kakao Login] 📝 해결 방법: KAKAO_LOGIN_KOE101_FIX.md 파일을 참고하세요')
        setError('카카오 로그인 설정 오류입니다. 관리자에게 문의하세요. (KOE101)')
        setLoading(false)
        return
      }
      
      const REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/sync/callback'
      
      console.log('[Kakao Login] 🔑 REST API Key:', KAKAO_REST_API_KEY.substring(0, 10) + '...')
      console.log('[Kakao Login] 🔗 Redirect URI:', REDIRECT_URI)
      
      const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=${encodeURIComponent(returnUrl)}`
      
      window.location.href = kakaoAuthUrl
      
    } catch (err: any) {
      console.error('[Kakao Login] ❌ 오류 발생:', err)
      setError(t('auth.kakaoLoginError')) // ✅ 번역
      setLoading(false)
    }
  }

  async function processKakaoLogin(accessToken: string) {
    try {
      console.log('[Kakao Login] 🔥 Firebase Custom Token 요청 시작')
      
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

        await loginWithKakao(accessToken)
        
        const savedReturnUrl = localStorage.getItem('loginReturnUrl') || '/'
        localStorage.removeItem('loginReturnUrl')
        
        console.log('[Kakao Login] ✅ Firebase 로그인 성공:', user.name)
        
        navigate(savedReturnUrl, { replace: true })
      } else {
        throw new Error(response.data.error || t('auth.loginError')) // ✅ 번역
      }
    } catch (err: any) {
      console.error('[Kakao Login] ❌ 실패:', err)
      setError(t('auth.kakaoLoginError')) // ✅ 번역
      setLoading(false)
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email || !password) {
        setError(t('auth.emailRequired')) // ✅ 번역
        return
      }

      await loginWithEmail(email, password)
      
      sessionStorage.removeItem('returnUrl')
      navigate(returnUrl, { replace: true })
    } catch (err: any) {
      console.error('[Email Login] Error:', err)
      setError(t('auth.invalidCredentials')) // ✅ 번역
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError(t('auth.emailRequired')) // ✅ 번역
      return
    }

    setLoading(true)
    setError('')
    
    try {
      await resetPassword(email)
      setSuccessMessage(t('auth.resetPasswordSuccess')) // ✅ 번역
      setShowForgotPassword(false)
    } catch (err: any) {
      setError(err.message || t('common.error')) // ✅ 번역
    } finally {
      setLoading(false)
    }
  }

  // ✅ Google 로그인 핸들러 (글로벌 전용)
  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
      const { auth } = await import('@/lib/firebase')
      
      const provider = new GoogleAuthProvider()
      provider.addScope('email')
      provider.addScope('profile')
      
      const result = await signInWithPopup(auth, provider)
      
      // 백엔드에 사용자 정보 저장 (D1 DB)
      await api.post('/api/auth/google/register', {
        uid: result.user.uid,
        email: result.user.email,
        name: result.user.displayName,
        photoURL: result.user.photoURL
      })
      
      console.log('[Google Login] ✅ 성공:', result.user.email)
      
      sessionStorage.removeItem('returnUrl')
      navigate(returnUrl, { replace: true })
      
    } catch (error: any) {
      console.error('[Google Login] ❌ 실패:', error)
      setError(t('auth.googleLoginError')) // ✅ 번역
    } finally {
      setLoading(false)
    }
  }

  // 🔥 Early return: Prevent rendering while redirecting
  if (isAuthReady && isLoggedIn && hasRedirected.current) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="text-white text-xl">Redirecting...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex items-center justify-center mb-4">
            <Play className="h-12 w-12 text-pink-500" />
          </div>
          <CardTitle className="text-2xl text-center font-bold">
            {t('common.login')} {/* ✅ 번역 */}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Region 기반 로그인 버튼 */}
          {isKorea() ? (
            // 한국: 카카오 로그인
            <Button
              onClick={handleKakaoLogin}
              disabled={loading || !kakaoReady}
              className="w-full bg-[#FEE500] text-[#000000] hover:bg-[#FDD835] h-12 text-base font-semibold"
            >
              {t('auth.loginWithKakao')}
            </Button>
          ) : (
            // 글로벌: Google 로그인
            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 h-12 text-base font-semibold flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t('auth.loginWithGoogle')}
            </Button>
          )}

          {/* 이메일 로그인 토글 */}
          <Button
            onClick={() => setShowEmailLogin(!showEmailLogin)}
            variant="outline"
            className="w-full h-12 text-base"
          >
            <Mail className="mr-2 h-4 w-4" />
            {t('auth.loginWithEmail')} {/* ✅ 번역 */}
          </Button>

          {/* 이메일 로그인 폼 */}
          {showEmailLogin && !showForgotPassword && (
            <form onSubmit={handleEmailLogin} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('auth.email')} {/* ✅ 번역 */}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-md"
                    placeholder={t('auth.emailPlaceholder')} // ✅ 번역
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('auth.password')} {/* ✅ 번역 */}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border rounded-md"
                    placeholder={t('auth.passwordPlaceholder')} // ✅ 번역
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')} // ✅ 번역
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                {loading ? t('common.loading') : t('common.login')} {/* ✅ 번역 */}
              </Button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                {t('auth.forgotPassword')} {/* ✅ 번역 */}
              </button>
            </form>
          )}

          {/* 비밀번호 재설정 폼 */}
          {showForgotPassword && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('auth.email')} {/* ✅ 번역 */}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md"
                  placeholder={t('auth.emailPlaceholder')} // ✅ 번역
                />
              </div>
              <Button onClick={handleResetPassword} className="w-full" disabled={loading}>
                {t('auth.resetPasswordButton')} {/* ✅ 번역 */}
              </Button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="text-sm text-blue-600 hover:underline"
              >
                {t('common.back')} {/* ✅ 번역 */}
              </button>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {/* 성공 메시지 */}
          {successMessage && (
            <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
              {successMessage}
            </div>
          )}

          {/* 회원가입 링크 */}
          <div className="text-center text-sm text-gray-600 space-y-2">
            <div>
              {t('auth.noAccount')} {/* ✅ 번역 */}
              {' '}
              <Link to="/signup" className="text-blue-600 hover:underline font-medium">
                {t('common.signup')} {/* ✅ 번역 */}
              </Link>
            </div>
            
            {/* 셀러 로그인 링크 */}
            <div className="pt-4 border-t">
              <Link to="/seller/login" className="text-blue-600 hover:underline font-medium">
                {t('seller.dashboard')} {t('common.login')} →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
