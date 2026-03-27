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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[360px]">

        {/* Logo */}
        <div className="text-center mb-16">
          <h1 className="text-[32px] font-bold tracking-[0.08em] text-[#111]">
            UR LIVE
          </h1>
          <p className="text-[14px] text-[#999] mt-3 font-light">
            라이브 쇼핑의 새로운 경험
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

        {/* Main Login */}
        {!showEmailLogin && !showForgotPassword && (
          <div>
            {/* Kakao Login Button */}
            <button
              onClick={() => {
                console.log('[LoginPage] 🚀 카카오 로그인 버튼 클릭됨!')
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
                  <span>로그인 중...</span>
                </div>
              ) : (
                <>
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                    <path fill="#3C1E1E" d="M12 3c5.5 0 10 3.58 10 8 0 4.42-4.5 8-10 8-1.15 0-2.25-.16-3.28-.45L3 21l1.45-5.72C3.55 14.2 3 12.66 3 11c0-4.42 4.5-8 9-8z"/>
                  </svg>
                  <span>카카오로 3초 만에 시작하기</span>
                </>
              )}
            </button>

            {/* Email Login Link */}
            <div className="text-center mt-8">
              <button
                onClick={() => setShowEmailLogin(true)}
                className="text-[13px] text-[#888] hover:text-[#111] underline underline-offset-4 decoration-1 font-light transition-colors"
              >
                이메일로 로그인하기
              </button>
            </div>

            {/* Sign Up Link */}
            <div className="text-center text-[13px] text-[#aaa] mt-5 font-light">
              계정이 없으신가요?{' '}
              <Link to="/register" className="text-[#111] font-medium hover:underline underline-offset-4 decoration-1">
                회원가입
              </Link>
            </div>
          </div>
        )}

        {/* Email Login Form */}
        {showEmailLogin && !showForgotPassword && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#555] mb-1.5">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[48px] px-4 border border-[#E0E0E0] rounded-xl text-[14px] focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-all placeholder:text-[#bbb]"
                placeholder="example@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#555] mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[48px] px-4 pr-12 border border-[#E0E0E0] rounded-xl text-[14px] focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-all placeholder:text-[#bbb]"
                  placeholder="비밀번호를 입력하세요"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#bbb] hover:text-[#555]"
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
                className="text-[12px] text-[#888] hover:text-[#111] underline underline-offset-4 decoration-1 font-light"
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[48px] bg-[#111] hover:bg-black text-white rounded-xl text-[14px] font-semibold tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>

            <button
              type="button"
              onClick={() => setShowEmailLogin(false)}
              className="w-full h-[48px] border border-[#E0E0E0] hover:border-[#999] text-[#555] rounded-xl text-[14px] font-medium tracking-tight transition-all"
            >
              돌아가기
            </button>
          </form>
        )}

        {/* Forgot Password Form */}
        {showForgotPassword && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <p className="text-[14px] text-[#666] font-light leading-relaxed">
                가입한 이메일을 입력하시면<br />비밀번호 재설정 링크를 보내드립니다.
              </p>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#555] mb-1.5">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[48px] px-4 border border-[#E0E0E0] rounded-xl text-[14px] focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-all placeholder:text-[#bbb]"
                placeholder="example@email.com"
                required
              />
            </div>

            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full h-[48px] bg-[#111] hover:bg-black text-white rounded-xl text-[14px] font-semibold tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '전송 중...' : '재설정 링크 보내기'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false)
                setShowEmailLogin(true)
              }}
              className="w-full h-[48px] border border-[#E0E0E0] hover:border-[#999] text-[#555] rounded-xl text-[14px] font-medium tracking-tight transition-all"
            >
              돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
