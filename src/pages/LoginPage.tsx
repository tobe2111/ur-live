import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { isKorea } from '@/config/region'
import api from '@/lib/api'
// ✅ Zustand 직접 사용
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const hasRedirected = useRef(false)
  
  // ✅ Zustand Store 선택 (KR/World)
  const useAuth = isKorea() ? useAuthKR : useAuthWorld
  
  // ✅ Selector로 필요한 상태만 구독 (리렌더 최소화)
  const user = useAuth(state => state.user)
  const isAuthReady = useAuth(state => state.isAuthReady)
  const globalLoading = useAuth(state => state.isLoading)
  
  // ✅ Actions는 함수 참조만 (리렌더 없음)
  const loginWithEmailAction = useAuth(state => state.loginWithEmail)
  const sendPasswordResetEmailAction = useAuth(state => state.sendPasswordResetEmail)
  
  // Local State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [kakaoReady, setKakaoReady] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const returnUrl = searchParams.get('returnUrl') || sessionStorage.getItem('returnUrl') || '/'
  const isLoggedIn = !!user

  // ✅ 로그인 상태 확인 및 리다이렉트
  useEffect(() => {
    if (!isAuthReady) {
      console.log('[LoginPage] ⏳ Auth 초기화 대기 중...')
      return
    }
    
    if (isLoggedIn && !hasRedirected.current) {
      console.log('[LoginPage] ✅ 이미 로그인됨 - returnUrl로 리다이렉트:', returnUrl)
      hasRedirected.current = true
      navigate(returnUrl, { replace: true })
    }
  }, [isAuthReady, isLoggedIn, navigate, returnUrl])

  // ✅ Kakao SDK 초기화 및 returnUrl 저장
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
  }, [searchParams])

  // ✅ Kakao 로그인 핸들러
  async function handleKakaoLogin() {
    if (!kakaoReady) {
      alert(t('auth.kakaoSdkNotReady'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const accessToken = window.Kakao.Auth.getAccessToken()
      
      // 기존 토큰이 있으면 재사용
      if (accessToken) {
        await processKakaoLogin(accessToken)
        return
      }

      // ✅ 환경 변수 검증
      const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY
      
      if (!KAKAO_REST_API_KEY) {
        console.error('[Kakao Login] ❌ VITE_KAKAO_REST_API_KEY 환경 변수가 설정되지 않았습니다')
        console.error('[Kakao Login] 📖 해결 방법: KAKAO_LOGIN_KOE101_FIX.md 파일을 참고하세요')
        setError('카카오 로그인 설정 오류입니다. 관리자에게 문의하세요. (KOE101)')
        setLoading(false)
        return
      }
      
      const REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/sync/callback'
      
      console.log('[Kakao Login] 🔑 REST API Key:', KAKAO_REST_API_KEY.substring(0, 10) + '...')
      console.log('[Kakao Login] 🔗 Redirect URI:', REDIRECT_URI)
      
      // returnUrl을 state로 전달
      const currentReturnUrl = searchParams.get('returnUrl') 
        || sessionStorage.getItem('returnUrl') 
        || '/'
      
      const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=${encodeURIComponent(currentReturnUrl)}`
      
      window.location.href = kakaoAuthUrl
      
    } catch (err: any) {
      console.error('[Kakao Login] ❌ 오류 발생:', err)
      setError(t('auth.kakaoLoginError'))
      setLoading(false)
    }
  }

  // ✅ Kakao accessToken → Firebase customToken 처리
  async function processKakaoLogin(accessToken: string) {
    try {
      console.log('[Kakao Login] 🔥 Firebase Custom Token 요청 시작')
      
      const response = await api.post('/api/auth/kakao/firebase', {
        accessToken: accessToken
      })

      if (response.data.success) {
        const { customToken, user: kakaoUser } = response.data

        console.log('[Kakao Login] ✅ Firebase Custom Token 받기 완료:', {
          userId: kakaoUser.id,
          userName: kakaoUser.name,
          hasCustomToken: !!customToken
        })

        // ✅ Firebase signInWithCustomToken (Zustand가 자동으로 상태 업데이트)
        const credential = await signInWithCustomToken(auth, customToken)
        
        // 🔥 백그라운드에서 토큰 갱신 (await 없이 비동기 실행)
        credential.user.getIdToken(true)
          .then(() => console.log('[Kakao Login] 🔥 ID Token 강제 갱신 완료 (백그라운드)'))
          .catch((err) => console.warn('[Kakao Login] ⚠️ Token 갱신 실패 (무시):', err))
        
        const savedReturnUrl = sessionStorage.getItem('returnUrl') || '/'
        sessionStorage.removeItem('returnUrl')
        
        console.log('[Kakao Login] ✅ Firebase 로그인 성공:', kakaoUser.name)
        
        // Zustand의 onAuthStateChanged가 자동으로 처리하므로 navigate만 호출
        navigate(savedReturnUrl, { replace: true })
      } else {
        throw new Error(response.data.error || t('auth.loginError'))
      }
    } catch (err: any) {
      console.error('[Kakao Login] ❌ 실패:', err)
      setError(t('auth.kakaoLoginError'))
      setLoading(false)
    }
  }

  // ✅ 이메일 로그인 핸들러
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email || !password) {
        setError(t('auth.emailRequired'))
        return
      }

      // ✅ Zustand action 직접 호출
      await loginWithEmailAction(email, password)
      
      sessionStorage.removeItem('returnUrl')
      navigate(returnUrl, { replace: true })
    } catch (err: any) {
      console.error('[Email Login] Error:', err)
      setError(t('auth.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  // ✅ 비밀번호 재설정 핸들러
  async function handleResetPassword() {
    if (!email) {
      setError(t('auth.emailRequired'))
      return
    }

    setLoading(true)
    setError('')
    
    try {
      // ✅ Zustand action 직접 호출
      await sendPasswordResetEmailAction(email)
      setSuccessMessage(t('auth.resetPasswordSuccess'))
      setShowForgotPassword(false)
    } catch (err: any) {
      setError(err.message || t('common.error'))
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
      setError(t('auth.googleLoginError'))
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
            <Play className="h-12 w-12 text-pink-600" />
          </div>
          <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            {t('auth.loginTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {successMessage}
            </div>
          )}

          {!showEmailLogin && !showForgotPassword && (
            <>
              {/* Kakao Login Button (KR only) */}
              {isKorea() && (
                <Button
                  onClick={handleKakaoLogin}
                  disabled={loading || !kakaoReady}
                  className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-gray-900 font-semibold py-6 text-base transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('common.loading')}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12 3c5.5 0 10 3.58 10 8 0 4.42-4.5 8-10 8-1.15 0-2.25-.16-3.28-.45L3 21l1.45-5.72C3.55 14.2 3 12.66 3 11c0-4.42 4.5-8 9-8z"/>
                      </svg>
                      {t('auth.loginWithKakao')}
                    </span>
                  )}
                </Button>
              )}

              {/* Google Login Button (World only) */}
              {!isKorea() && (
                <Button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-white hover:bg-gray-50 text-gray-900 font-semibold py-6 text-base transition-all duration-200 shadow-lg hover:shadow-xl border border-gray-300"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('common.loading')}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {t('auth.loginWithGoogle')}
                    </span>
                  )}
                </Button>
              )}

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">{t('common.or')}</span>
                </div>
              </div>

              <Button
                onClick={() => setShowEmailLogin(true)}
                variant="outline"
                className="w-full py-6 text-base font-semibold border-2 hover:bg-gray-50 transition-all duration-200"
              >
                <Mail className="w-5 h-5 mr-2" />
                {t('auth.loginWithEmail')}
              </Button>

              <div className="text-center text-sm text-gray-600 mt-4">
                {t('auth.noAccount')}{' '}
                <Link to="/register" className="text-pink-600 hover:text-pink-700 font-semibold hover:underline">
                  {t('auth.signUp')}
                </Link>
              </div>
            </>
          )}

          {showEmailLogin && !showForgotPassword && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                    placeholder={t('auth.emailPlaceholder')}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                    placeholder={t('auth.passwordPlaceholder')}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true)
                    setShowEmailLogin(false)
                  }}
                  className="text-sm text-pink-600 hover:text-pink-700 font-medium hover:underline"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-semibold py-6 text-base transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {loading ? t('common.loading') : t('auth.login')}
              </Button>

              <Button
                type="button"
                onClick={() => setShowEmailLogin(false)}
                variant="outline"
                className="w-full py-3 text-sm"
              >
                {t('common.back')}
              </Button>
            </form>
          )}

          {showForgotPassword && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                    placeholder={t('auth.emailPlaceholder')}
                    required
                  />
                </div>
              </div>

              <Button
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-semibold py-6 text-base transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {loading ? t('common.loading') : t('auth.sendResetLink')}
              </Button>

              <Button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false)
                  setShowEmailLogin(true)
                }}
                variant="outline"
                className="w-full py-3 text-sm"
              >
                {t('common.back')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
