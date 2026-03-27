import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
// Firebase Auth will be lazy loaded when needed
import { isKorea } from '@/config/region'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
// ✅ Zustand 직접 사용
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { Eye, EyeOff } from 'lucide-react'

// Kakao SDK 타입 선언
declare global {
  interface Window {
    Kakao: any
  }
}

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const hasRedirected = useRef(false)
  
  // ✅ Zustand Store 선택 (KR/World)
  // Region-based auth (see below)
  
  // ✅ Region-based auth store 선택 (hooks 규칙 준수)
  const isKR = isKorea()
  const krUser = useAuthKR(state => state.user)
  const krIsAuthReady = useAuthKR(state => state.isAuthReady)
  const krGlobalLoading = useAuthKR(state => state.isLoading)
  const krLoginWithEmail = useAuthKR(state => state.loginWithEmail)
  const krSendPasswordReset = useAuthKR(state => state.sendPasswordResetEmail)
  const worldUser = useAuthWorld(state => state.user)
  const worldIsAuthReady = useAuthWorld(state => state.isAuthReady)
  const worldGlobalLoading = useAuthWorld(state => state.isLoading)
  
  const user = isKR ? krUser : worldUser
  const isAuthReady = isKR ? krIsAuthReady : worldIsAuthReady
  const globalLoading = isKR ? krGlobalLoading : worldGlobalLoading
  const loginWithEmailAction = krLoginWithEmail
  const sendPasswordResetEmailAction = krSendPasswordReset
  
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
  
  // ✅ 무한루프 방지: returnUrl은 마운트 시 1회만 계산 (useRef로 고정)
  const returnUrlRef = useRef<string | null>(null)
  if (returnUrlRef.current === null) {
    const _rawReturnUrl = searchParams.get('returnUrl')
      ? decodeURIComponent(searchParams.get('returnUrl')!)
      : sessionStorage.getItem('returnUrl') || '/'
    returnUrlRef.current = (_rawReturnUrl.startsWith('/login') || _rawReturnUrl.startsWith('/auth/'))
      ? '/'
      : _rawReturnUrl
  }
  const returnUrl = returnUrlRef.current
  const isLoggedIn = !!user

  // ✅ 로그인 상태 확인 및 리다이렉트
  // 의존성에서 returnUrl 제거 → searchParams 변경으로 인한 무한 루프 차단
  useEffect(() => {
    if (!isAuthReady) {
      console.log('[LoginPage] ⏳ Auth 초기화 대기 중...')
      return
    }

    if (isLoggedIn && !hasRedirected.current) {
      console.log('[LoginPage] ✅ 이미 로그인됨 - returnUrl로 리다이렉트:', returnUrlRef.current)
      hasRedirected.current = true
      navigate(returnUrlRef.current!, { replace: true })
    }
  }, [isAuthReady, isLoggedIn, navigate])

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
      toast.error(t('auth.kakaoSdkNotReady'))
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

        // ✅ Lazy load Firebase Auth
        const { signInWithCustomToken } = await import('@/lib/firebase-auth')
        
        // Firebase signInWithCustomToken
        const credential = await signInWithCustomToken(customToken)

        // ✅ ID Token 가져오기 (캐시 우선)
        const idToken = await credential.user.getIdToken(false)

        // ✅ 중복 처리 방지 플래그 먼저 설정 (onAuthStateChanged race condition 방지)
        sessionStorage.setItem('auth_processed_uid', credential.user.uid)

        // ✅ localStorage 설정
        localStorage.setItem('user_type', 'user')
        localStorage.setItem('user_name', kakaoUser.name)
        localStorage.setItem('user_id', String(kakaoUser.id))
        if (kakaoUser.email) localStorage.setItem('user_email', kakaoUser.email)

        // ✅ Zustand store 직접 업데이트 (onAuthStateChanged 대기 없이 즉시 인증)
        const authStore = isKR ? useAuthKR.getState() : useAuthWorld.getState()
        authStore.setUser(credential.user)
        authStore.setAuthReady(true)

        // ✅ API 요청용 accessToken 저장
        try {
          const { useAuthStore } = await import('@/client/stores/auth.store')
          useAuthStore.getState().setAuth(
            {
              id: credential.user.uid,
              email: kakaoUser.email || '',
              name: kakaoUser.name,
              role: 'user',
            },
            idToken,
            ''
          )
        } catch (_) {}
        
        const savedReturnUrl = sessionStorage.getItem('returnUrl') || '/'
        sessionStorage.removeItem('returnUrl')
        
        console.log('[Kakao Login] ✅ Firebase 로그인 성공:', kakaoUser.name, '→', savedReturnUrl)
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
      
      // ✅ role에 따라 리다이렉트 경로 결정
      const { userRole } = isKR ? useAuthKR.getState() : useAuthWorld.getState()
      console.log('[Email Login] ✅ 로그인 성공 - Role:', userRole)
      
      sessionStorage.removeItem('returnUrl')
      
      // role별 리다이렉트
      if (userRole === 'seller') {
        console.log('[Email Login] 📍 Seller 대시보드로 이동')
        navigate('/seller/dashboard', { replace: true })
      } else if (userRole === 'admin') {
        console.log('[Email Login] 📍 Admin 대시보드로 이동')
        navigate('/admin', { replace: true })
      } else {
        // 기본값: user → returnUrl 또는 홈
        console.log('[Email Login] 📍 User 페이지로 이동:', returnUrl)
        navigate(returnUrl, { replace: true })
      }
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
      // Lazy load Firebase Auth
      const { signInWithGoogle } = await import('@/lib/firebase-auth')
      
      const result = await signInWithGoogle()
      
      // ✅ localStorage에 user_type 설정 (API Interceptor를 위해 필수)
      localStorage.setItem('user_type', 'user')
      localStorage.setItem('user_name', result.user.displayName || result.user.email?.split('@')[0] || 'User')
      console.log('[Google Login] ✅ localStorage에 user_type 설정: user')
      
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600">Redirecting...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        {/* Logo - 29CM Style: Ultra minimal */}
        <div className="text-center mb-14">
          <h1 className="text-[28px] font-extralight tracking-[0.02em] text-[#111] mb-1">
            UR LIVE
          </h1>
          <p className="text-[12px] font-light text-[#666] tracking-wide mt-3">
            {t('auth.loginTitle')}
          </p>
        </div>

        {/* Error/Success Messages - 29CM Style */}
        {error && (
          <div className="mb-6 p-4 bg-[#FFF8F8] border border-[#FFEBEB] text-[13px] text-[#D32F2F] font-light">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="mb-6 p-4 bg-[#F0F8F4] border border-[#D4EDDA] text-[13px] text-[#2E7D32] font-light">
            {successMessage}
          </div>
        )}

        {/* Main Login Form */}
        {!showEmailLogin && !showForgotPassword && (
          <div className="space-y-3">
            {/* Kakao Login Button (KR only) - 29CM Style: Minimal, clean lines */}
            {isKorea() && (
              <button
                onClick={() => {
                  console.log('[LoginPage] 🚀 카카오 로그인 버튼 클릭됨!')
                  console.log('[LoginPage] Kakao Ready:', kakaoReady)
                  console.log('[LoginPage] Kakao SDK Initialized:', window.Kakao?.isInitialized())
                  console.log('[LoginPage] Loading:', loading)
                  handleKakaoLogin()
                }}
                disabled={loading || !kakaoReady}
                className="w-full h-[48px] bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] text-[13px] font-normal tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-transparent hover:border-[#F9D900]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('common.loading')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M12 3c5.5 0 10 3.58 10 8 0 4.42-4.5 8-10 8-1.15 0-2.25-.16-3.28-.45L3 21l1.45-5.72C3.55 14.2 3 12.66 3 11c0-4.42 4.5-8 9-8z"/>
                    </svg>
                    {t('auth.loginWithKakao')}
                  </>
                )}
              </button>
            )}

            {/* Google Login Button (World only) - 29CM Style */}
            {!isKorea() && (
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-[48px] bg-white hover:bg-[#FAFAFA] text-[#111] text-[13px] font-normal tracking-wide border border-[#E0E0E0] hover:border-[#111] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('common.loading')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {t('auth.loginWithGoogle')}
                  </>
                )}
              </button>
            )}

            {/* Divider - 29CM Style: Ultra minimal */}
            <div className="relative py-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#F0F0F0]"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 text-[11px] text-[#999] bg-white font-light tracking-widest">OR</span>
              </div>
            </div>

            {/* Email Login Button - 29CM Style: Black minimal button */}
            <button
              onClick={() => setShowEmailLogin(true)}
              className="w-full h-[48px] bg-[#111] hover:bg-black text-white text-[13px] font-normal tracking-wide flex items-center justify-center transition-all"
            >
              {t('auth.loginWithEmail')}
            </button>

            {/* Sign Up Link - 29CM Style: Minimal, understated */}
            <div className="text-center text-[12px] text-[#666] mt-8 font-light">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="text-[#111] font-normal hover:underline underline-offset-4 decoration-1">
                {t('auth.signUp')}
              </Link>
            </div>
          </div>
        )}

        {/* Email Login Form - 29CM Style */}
        {showEmailLogin && !showForgotPassword && (
          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div>
              <label className="block text-[11px] font-normal text-[#666] mb-2 tracking-wide uppercase">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[48px] px-4 border border-[#E0E0E0] text-[13px] font-light focus:outline-none focus:border-[#111] transition-colors placeholder:text-[#999]"
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-normal text-[#666] mb-2 tracking-wide uppercase">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[48px] px-4 pr-12 border border-[#E0E0E0] text-[13px] font-light focus:outline-none focus:border-[#111] transition-colors placeholder:text-[#999]"
                  placeholder={t('auth.passwordPlaceholder')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#999] hover:text-[#111]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                className="text-[11px] text-[#666] hover:text-[#111] underline underline-offset-4 decoration-1 font-light"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[48px] bg-[#111] hover:bg-black text-white text-[13px] font-normal tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('auth.login')}
            </button>

            <button
              type="button"
              onClick={() => setShowEmailLogin(false)}
              className="w-full h-[48px] border border-[#E0E0E0] hover:border-[#111] text-[#111] text-[13px] font-normal tracking-wide transition-all"
            >
              {t('common.back')}
            </button>
          </form>
        )}

        {/* Forgot Password Form - 29CM Style */}
        {showForgotPassword && (
          <div className="space-y-5">
            <div className="text-center mb-8">
              <p className="text-[13px] text-[#666] font-light leading-relaxed">
                Enter your email to receive a password reset link
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-normal text-[#666] mb-2 tracking-wide uppercase">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[48px] px-4 border border-[#E0E0E0] text-[13px] font-light focus:outline-none focus:border-[#111] transition-colors placeholder:text-[#999]"
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </div>

            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full h-[48px] bg-[#111] hover:bg-black text-white text-[13px] font-normal tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('auth.sendResetLink')}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false)
                setShowEmailLogin(true)
              }}
              className="w-full h-[48px] border border-[#E0E0E0] hover:border-[#111] text-[#111] text-[13px] font-normal tracking-wide transition-all"
            >
              {t('common.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
