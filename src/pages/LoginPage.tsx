/**
 * LoginPage — 완전 리팩토링 버전
 *
 * 설계 원칙:
 * - useAuth 단일 스토어만 사용 (useAuthKR / useAuthWorld 제거)
 * - 카카오 로그인: OAuth redirect → KakaoCallbackPage → Firebase signIn → onAuthStateChanged
 * - 이메일 로그인: loginWithEmail() → Firebase signIn → onAuthStateChanged
 * - 무한루프 방지: returnUrl 이 /login 이나 /auth/ 이면 '/' 로 강제 변환
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isKorea } from '@/config/region'
import { useAuth } from '@/shared/stores/useAuth'
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
  const [searchParams] = useSearchParams()
  const hasRedirected = useRef(false)

  // ✅ 단일 스토어
  const user = useAuth((s) => s.user)
  const isReady = useAuth((s) => s.isReady)
  const isLoading = useAuth((s) => s.isLoading)
  const authError = useAuth((s) => s.error)
  const loginWithEmail = useAuth((s) => s.loginWithEmail)
  const sendPasswordReset = useAuth((s) => s.sendPasswordReset)
  const clearError = useAuth((s) => s.clearError)

  // ✅ returnUrl 안전 처리 — /login 이나 /auth/ 로 시작하면 '/'
  const _rawReturnUrl = searchParams.get('returnUrl')
    ? decodeURIComponent(searchParams.get('returnUrl')!)
    : sessionStorage.getItem('returnUrl') || '/'
  const returnUrl =
    _rawReturnUrl.startsWith('/login') || _rawReturnUrl.startsWith('/auth/')
      ? '/'
      : _rawReturnUrl

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

  // ✅ auth 에러 반영
  useEffect(() => {
    if (authError) setError(authError)
  }, [authError])

  // ✅ 이미 로그인되어 있으면 returnUrl 로 이동
  useEffect(() => {
    if (!isReady) return
    if (user && !hasRedirected.current) {
      hasRedirected.current = true
      console.log('[LoginPage] 이미 로그인됨 → ', returnUrl)
      navigate(returnUrl, { replace: true })
    }
  }, [isReady, user, navigate, returnUrl])

  // ✅ Kakao SDK 초기화 + returnUrl 저장
  useEffect(() => {
    // sessionStorage 에 returnUrl 저장 (카카오 redirect 후 복원용)
    const urlParam = searchParams.get('returnUrl')
    const safeParam = urlParam
      ? decodeURIComponent(urlParam).startsWith('/login') || decodeURIComponent(urlParam).startsWith('/auth/')
        ? '/'
        : urlParam
      : null
    if (safeParam) {
      sessionStorage.setItem('returnUrl', safeParam)
      sessionStorage.setItem('loginReturnUrl', decodeURIComponent(safeParam))
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

  // ✅ 카카오 로그인 — OAuth redirect 방식
  function handleKakaoLogin() {
    if (!kakaoReady) {
      alert(t('auth.kakaoSdkNotReady'))
      return
    }

    const KAKAO_REST_API_KEY = (import.meta as any).env?.VITE_KAKAO_REST_API_KEY
    if (!KAKAO_REST_API_KEY) {
      setError('카카오 로그인 설정 오류입니다. 관리자에게 문의하세요. (KOE101)')
      return
    }

    setLoading(true)
    clearError()
    setError('')

    // returnUrl 을 state 파라미터로 전달 (KakaoCallbackPage 에서 복원)
    const currentReturnUrl =
      searchParams.get('returnUrl')
        ? decodeURIComponent(searchParams.get('returnUrl')!)
        : sessionStorage.getItem('loginReturnUrl') || '/'

    const REDIRECT_URI = `${window.location.origin}/auth/kakao/sync/callback`
    const kakaoAuthUrl =
      `https://kauth.kakao.com/oauth/authorize` +
      `?client_id=${KAKAO_REST_API_KEY}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(currentReturnUrl)}`

    window.location.href = kakaoAuthUrl
  }

  // ✅ 이메일 로그인 — onAuthStateChanged 가 user/isReady 자동 업데이트
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    clearError()
    setLoading(true)

    try {
      if (!email || !password) {
        setError(t('auth.emailRequired'))
        return
      }

      await loginWithEmail(email, password)

      // loginWithEmail 성공 후 onAuthStateChanged 가 user 를 세팅
      // PublicRoute 가 user 를 감지해 returnUrl 로 자동 리다이렉트
      // (아래 navigate 는 더 빠른 UX 를 위한 명시적 이동)
      sessionStorage.removeItem('returnUrl')
      sessionStorage.removeItem('loginReturnUrl')
      navigate(returnUrl, { replace: true })
    } catch (err: any) {
      setError(err.message || t('auth.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  // ✅ 비밀번호 재설정
  async function handleResetPassword() {
    if (!email) {
      setError(t('auth.emailRequired'))
      return
    }
    setLoading(true)
    setError('')
    try {
      await sendPasswordReset(email)
      setSuccessMessage(t('auth.resetPasswordSuccess'))
      setShowForgotPassword(false)
    } catch (err: any) {
      setError(err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  // ✅ Google 로그인 (글로벌 전용)
  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      const { signInWithGoogle } = await import('@/lib/firebase-auth')
      const result = await signInWithGoogle()

      localStorage.setItem('user_type', 'user')
      localStorage.setItem('user_name', result.user.displayName || result.user.email?.split('@')[0] || 'User')

      // 백엔드에 사용자 정보 저장
      try {
        const api = (await import('@/lib/api')).default
        await api.post('/api/auth/google/register', {
          uid: result.user.uid,
          email: result.user.email,
          name: result.user.displayName,
          photoURL: result.user.photoURL,
        })
      } catch (_) {}

      sessionStorage.removeItem('returnUrl')
      sessionStorage.removeItem('loginReturnUrl')
      navigate(returnUrl, { replace: true })
    } catch (error: any) {
      setError(t('auth.googleLoginError'))
    } finally {
      setLoading(false)
    }
  }

  // Auth 대기 중 혹은 이미 리다이렉트 중이면 빈 화면
  if (isReady && user && hasRedirected.current) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600">Redirecting...</div>
      </div>
    )
  }

  const combinedLoading = loading || isLoading

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="text-center mb-14">
          <h1 className="text-[28px] font-extralight tracking-[0.02em] text-[#111] mb-1">
            UR LIVE
          </h1>
          <p className="text-[12px] font-light text-[#666] tracking-wide mt-3">
            {t('auth.loginTitle')}
          </p>
        </div>

        {/* Error/Success Messages */}
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
            {/* Kakao Login Button (KR only) */}
            {isKorea() && (
              <button
                onClick={handleKakaoLogin}
                disabled={combinedLoading || !kakaoReady}
                className="w-full h-[48px] bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] text-[13px] font-normal tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-transparent hover:border-[#F9D900] flex items-center justify-center gap-2"
              >
                {combinedLoading ? (
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

            {/* Google Login Button (World only) */}
            {!isKorea() && (
              <button
                onClick={handleGoogleLogin}
                disabled={combinedLoading}
                className="w-full h-[48px] bg-white hover:bg-[#FAFAFA] text-[#111] text-[13px] font-normal tracking-wide border border-[#E0E0E0] hover:border-[#111] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {combinedLoading ? (
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

            {/* Divider */}
            <div className="relative py-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#F0F0F0]"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 text-[11px] text-[#999] bg-white font-light tracking-widest">OR</span>
              </div>
            </div>

            {/* Email Login Button */}
            <button
              onClick={() => setShowEmailLogin(true)}
              className="w-full h-[48px] bg-[#111] hover:bg-black text-white text-[13px] font-normal tracking-wide flex items-center justify-center transition-all"
            >
              {t('auth.loginWithEmail')}
            </button>

            {/* Sign Up Link */}
            <div className="text-center text-[12px] text-[#666] mt-8 font-light">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="text-[#111] font-normal hover:underline underline-offset-4 decoration-1">
                {t('auth.signUp')}
              </Link>
            </div>
          </div>
        )}

        {/* Email Login Form */}
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
                onClick={() => { setShowForgotPassword(true); setShowEmailLogin(false) }}
                className="text-[11px] text-[#666] hover:text-[#111] underline underline-offset-4 decoration-1 font-light"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>

            <button
              type="submit"
              disabled={combinedLoading}
              className="w-full h-[48px] bg-[#111] hover:bg-black text-white text-[13px] font-normal tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {combinedLoading ? t('common.loading') : t('auth.login')}
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

        {/* Forgot Password Form */}
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
              disabled={combinedLoading}
              className="w-full h-[48px] bg-[#111] hover:bg-black text-white text-[13px] font-normal tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {combinedLoading ? t('common.loading') : t('auth.sendResetLink')}
            </button>

            <button
              type="button"
              onClick={() => { setShowForgotPassword(false); setShowEmailLogin(true) }}
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
