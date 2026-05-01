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
import SEO from '@/components/SEO'
import { addBreadcrumb, maskEmail } from '@/lib/sentry'
import { safeInternalPath } from '@/utils/safe-internal-path'

// Kakao SDK 타입 선언
interface KakaoAuth {
  getAccessToken(): string | null
  setAccessToken(token: string): void
}

interface KakaoChannel {
  addChannel(params: { channelPublicId: string }): void
  chat(params: { channelPublicId: string }): void
}

interface KakaoSDK {
  init(appKey: string): void
  isInitialized(): boolean
  Auth: KakaoAuth
  Channel: KakaoChannel
  _appKey?: string
  [key: string]: unknown
}

declare global {
  interface Window {
    Kakao: KakaoSDK
  }
}

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const hasRedirected = useRef(false)

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
  // 🛡️ 2026-04-29: 검증 로직을 safeInternalPath 헬퍼로 통일
  const returnUrlRef = useRef<string | null>(null)
  if (returnUrlRef.current === null) {
    const raw = searchParams.get('returnUrl') || sessionStorage.getItem('returnUrl') || '/'
    returnUrlRef.current = safeInternalPath(raw, '/')
  }
  const returnUrl = returnUrlRef.current
  const isLoggedIn = !!user || (localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id'))
  // 🛡️ 2026-05-01: ?switch=1 query — 명시적 계정 전환 의도 (다른 사람 디바이스 등).
  //   localStorage 청소 + auto-redirect skip → 로그인 UI 표시.
  const wantsSwitch = searchParams.get('switch') === '1'
  const currentUserName = (typeof window !== 'undefined' && localStorage.getItem('user_name')) || ''

  // ✅ 로그인 상태 확인 및 리다이렉트 (isAuthReady 대기 불필요 — KR은 즉시 true)
  useEffect(() => {
    if (wantsSwitch) {
      // 명시 전환: localStorage 청소만 (cookie 는 백엔드 logout 호출 권유)
      try {
        const KEEP = ['ur_pwa_', 'ur_kakao_external_', 'i18n', 'feature_flags', 'theme', 'dark', 'light', 'affiliate_ref']
        const keys: string[] = []
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) keys.push(k) }
        for (const k of keys) {
          if (KEEP.some(p => k.startsWith(p)) || k === 'feature_flags') continue
          try { localStorage.removeItem(k) } catch { /* */ }
        }
        // 백엔드 cookie 도 무효화
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => null)
      } catch { /* */ }
      return
    }
    if (isLoggedIn && !hasRedirected.current) {
      hasRedirected.current = true
      navigate(returnUrlRef.current!, { replace: true })
    }
  }, [isLoggedIn, navigate, wantsSwitch])

  // ✅ Kakao SDK 초기화 및 returnUrl 저장 (KR만)
  useEffect(() => {
    const urlParam = searchParams.get('returnUrl')
    if (urlParam) {
      sessionStorage.setItem('returnUrl', urlParam)
    }

    if (!isKR) return

    import('@/lib/kakao-sdk').then(({ ensureKakaoSdk }) => {
      ensureKakaoSdk()
        .then(() => setKakaoReady(true))
        .catch((e) => { if (import.meta.env.DEV) console.error('[LoginPage] Kakao SDK init failed:', e) })
    })
  }, [searchParams, isKR])

  // ✅ Kakao 로그인 핸들러
  async function handleKakaoLogin() {
    if (!kakaoReady) {
      toast.error(t('auth.kakaoSdkNotReady'))
      return
    }

    setLoading(true)
    setError('')

    try {
      // 🛡️ 2026-05-01: Firebase 100% 제거 — 항상 server-side OAuth redirect 만 사용.
      //   기존엔 Kakao SDK accessToken 이 있으면 /api/auth/kakao/firebase 로 우회했지만,
      //   Firebase 의존성을 완전히 제거하기 위해 server-side flow 로 통일.
      //   /auth/kakao/start → 카카오 authorize → /auth/kakao/callback → 세션 쿠키 발급.
      const rawReturnUrl = searchParams.get('returnUrl')
        || sessionStorage.getItem('returnUrl')
        || '/'
      const currentReturnUrl = safeInternalPath(rawReturnUrl, '/')
      const params = new URLSearchParams({ redirect: currentReturnUrl })
      // 🛡️ 2026-05-01: ?switch=1 진입 (다른 계정 전환) 시 prompt=login 강제로 전달 →
      //   Kakao 가 매번 인증 화면 표시 (silent auto-approve 차단).
      //   일반 로그인은 빠른 흐름 유지.
      if (wantsSwitch) {
        params.set('force_account', '1')
      }
      window.location.href = `/auth/kakao/start?${params.toString()}`

    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error('[Kakao Login] ❌ 오류 발생:', err)
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

      addBreadcrumb('auth', 'login attempt', { email: maskEmail(email), method: 'email' })

      // ✅ Zustand action 직접 호출
      await loginWithEmailAction(email, password)

      // ✅ role에 따라 리다이렉트 경로 결정
      const { userRole } = isKR ? useAuthKR.getState() : useAuthWorld.getState()
      sessionStorage.removeItem('returnUrl')

      // role별 리다이렉트
      if (userRole === 'seller') {
        navigate('/seller/dashboard', { replace: true })
      } else if (userRole === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate(returnUrl, { replace: true })
      }
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error('[Email Login] Error:', err)
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
      await sendPasswordResetEmailAction(email)
      setSuccessMessage(t('auth.resetPasswordSuccess'))
      setShowForgotPassword(false)
    } catch (err: unknown) {
      const err_ = err as { message?: string };
      const msg = err instanceof Error ? err.message : t('common.error')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ✅ Google 로그인 핸들러 (GLOBAL 전용)
  async function handleGoogleLogin() {
    setLoading(true)
    setError('')

    try {
      const { signInWithGoogle } = await import('@/lib/firebase-auth')

      const result = await signInWithGoogle()

      // ✅ localStorage에 user_type 설정 (API Interceptor를 위해 필수)
      localStorage.setItem('user_type', 'user')
      localStorage.setItem('user_name', result.user.displayName || result.user.email?.split('@')[0] || 'User')
      localStorage.setItem('user_id', result.user.uid)
      if (result.user.email) localStorage.setItem('user_email', result.user.email)

      // ✅ Zustand store 업데이트
      const authStore = useAuthWorld.getState()
      authStore.setUser(result.user)
      authStore.setAuthReady(true)

      // 백엔드에 사용자 정보 저장 (D1 DB)
      await api.post('/api/auth/google/register', {
        uid: result.user.uid,
        email: result.user.email,
        name: result.user.displayName,
        photoURL: result.user.photoURL
      })

      sessionStorage.removeItem('returnUrl')
      navigate(returnUrl, { replace: true })

    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('[Google Login] ❌ 실패:', error)
      const firebaseError = error as { code?: string }
      if (firebaseError?.code === 'auth/popup-closed-by-user') {
        // 사용자가 팝업을 닫은 경우 — 에러 표시하지 않음
      } else {
        setError(t('auth.googleLoginError'))
      }
    } finally {
      setLoading(false)
    }
  }

  // 🔥 Early return: Prevent rendering while redirecting
  if (isLoggedIn && hasRedirected.current) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="text-gray-400">Redirecting...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020202] flex flex-col items-center justify-center px-5 py-12">
      <SEO title="로그인 - 유어딜" description="유어딜에 로그인하세요." url="/login" noindex />
      <div className="w-full max-w-[360px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-16">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 40 36" fill="none" className="h-10 w-auto">
              <path d="M8 8h2l1.5 3H34a1 1 0 01.96 1.28l-3.5 12A1 1 0 0130.5 25H14.5a1 1 0 01-.96-.72L9.8 10H8V8z" stroke="#EF4444" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="16" cy="31" r="2.5" fill="#EF4444"/>
              <circle cx="29" cy="31" r="2.5" fill="#EF4444"/>
              <path d="M19.5 13.5v8l6-4z" fill="#EF4444"/>
            </svg>
            <span className="text-[28px] font-extrabold text-white tracking-tight">유어딜</span>
          </div>
          <p className="text-[14px] text-gray-500 mt-3 font-light">
            {t('auth.tagline')}
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600 text-center">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-[13px] text-green-700 text-center">
            {successMessage}
          </div>
        )}

        {/* 🛡️ 2026-05-01: ?switch=1 진입 시 안내 — 다른 사람 디바이스에서 본인 계정으로 로그인 */}
        {wantsSwitch && (
          <div className="mb-5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-[13px] text-blue-700 text-center">
            이전 사용자 데이터를 청소했어요. 본인 계정으로 로그인해주세요.
          </div>
        )}

        {/* Main Login */}
        {!showEmailLogin && !showForgotPassword && (
          <div>
            {/* ✅ Region-based Primary Login Button */}
            {isKR ? (
              /* Kakao Login Button (KR) */
              <button
                onClick={() => {
                  handleKakaoLogin()
                }}
                disabled={loading || !kakaoReady}
                className="w-full h-[52px] bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] rounded-xl text-[15px] font-semibold tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 border border-[#F5DC00]"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('common.loading')}</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                      <path fill="#3C1E1E" d="M12 3c5.5 0 10 3.58 10 8 0 4.42-4.5 8-10 8-1.15 0-2.25-.16-3.28-.45L3 21l1.45-5.72C3.55 14.2 3 12.66 3 11c0-4.42 4.5-8 9-8z"/>
                    </svg>
                    <span>{t('auth.kakaoQuickStart')}</span>
                  </>
                )}
              </button>
            ) : (
              /* Google Login Button (GLOBAL) */
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-[52px] bg-white hover:bg-gray-50 text-[#3c4043] rounded-xl text-[15px] font-semibold tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-3 border border-gray-300"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('common.loading')}</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>{t('auth.loginWithGoogle')}</span>
                  </>
                )}
              </button>
            )}

            {/* Email Login Link */}
            <div className="text-center mt-8">
              <button
                onClick={() => setShowEmailLogin(true)}
                className="text-[13px] text-gray-500 hover:text-white underline underline-offset-4 decoration-1 font-light transition-colors"
              >
                {t('auth.loginWithEmail')}
              </button>
            </div>

            {/* Sign Up Link */}
            <div className="text-center text-[13px] text-[#aaa] mt-5 font-light">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="text-white font-medium hover:underline underline-offset-4 decoration-1">
                {t('common.signup')}
              </Link>
            </div>
          </div>
        )}

        {/* Email Login Form */}
        {showEmailLogin && !showForgotPassword && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-[12px] font-medium text-[#555] mb-1.5">
                {t('auth.email')}
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[48px] px-4 border border-[#333] rounded-xl text-[14px] text-gray-900 focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-all placeholder:text-[#bbb]"
                placeholder={t('auth.emailPlaceholder')}
                aria-label={t('auth.email')}
                required
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-[12px] font-medium text-[#555] mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[48px] px-4 pr-12 border border-[#333] rounded-xl text-[14px] text-gray-900 focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-all placeholder:text-[#bbb]"
                  placeholder={t('auth.passwordPlaceholder')}
                  aria-label={t('auth.password')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#bbb] hover:text-[#555]"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
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
                className="text-[12px] text-gray-500 hover:text-white underline underline-offset-4 decoration-1 font-light"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[48px] bg-[#111] hover:bg-black text-white rounded-xl text-[14px] font-semibold tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('common.login')}
            </button>

            <button
              type="button"
              onClick={() => setShowEmailLogin(false)}
              className="w-full h-[48px] border border-[#333] hover:border-[#999] text-[#555] rounded-xl text-[14px] font-medium tracking-tight transition-all"
            >
              {t('common.back')}
            </button>
          </form>
        )}

        {/* Forgot Password Form */}
        {showForgotPassword && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <p className="text-[14px] text-gray-400 font-light leading-relaxed">
                {t('auth.resetPasswordDesc')}
              </p>
            </div>

            <div>
              <label htmlFor="reset-email" className="block text-[12px] font-medium text-[#555] mb-1.5">
                {t('auth.email')}
              </label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[48px] px-4 border border-[#333] rounded-xl text-[14px] text-gray-900 focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-all placeholder:text-[#bbb]"
                placeholder={t('auth.emailPlaceholder')}
                aria-label={t('auth.email')}
                required
              />
            </div>

            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full h-[48px] bg-[#111] hover:bg-black text-white rounded-xl text-[14px] font-semibold tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('auth.resetPasswordButton')}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false)
                setShowEmailLogin(true)
              }}
              className="w-full h-[48px] border border-[#333] hover:border-[#999] text-[#555] rounded-xl text-[14px] font-medium tracking-tight transition-all"
            >
              {t('common.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
