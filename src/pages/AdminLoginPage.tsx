import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { clearAuthData } from '@/utils/auth'
import { clearFirebaseTokenCache } from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Mail, Lock, Eye, EyeOff, Shield, BarChart2, Settings } from 'lucide-react'
import TurnstileWidget from '@/components/auth/TurnstileWidget'
import UrDealLogo from '@/components/brand/UrDealLogo'

export default function AdminLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // 🛡️ 2026-05-03: Turnstile token (TURNSTILE_SITE_KEY 미설정 시 'disabled' 자동 통과)
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  // 🆕 2026-06-17 보안 PIN: PIN 칸은 처음부터 노출(한 번에 입력). needPin=true 면 강조(서버가 pin_required 반환).
  const [needPin, setNeedPin] = useState(false)
  const [pin, setPin] = useState('')

  // Remember Me 이메일 불러오기 (리다이렉트는 PublicRoute(forAdmin)에서 처리)
  useEffect(() => {
    const savedEmail = localStorage.getItem('admin_remember_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  // 🛡️ 2026-04-29: 401 인터셉터가 ?error=session_expired 로 redirect 시 toast 표시
  useEffect(() => {
    const _err = searchParams.get('error')
    if (_err === 'session_expired' || _err === 'session_superseded') {
      toast.error(_err === 'session_superseded'
        ? t('auth.sessionSuperseded', { defaultValue: '다른 기기 또는 브라우저에서 로그인되어 자동 로그아웃되었습니다.' })
        : t('auth.sessionExpired'))
      const next = new URLSearchParams(searchParams)
      next.delete('error')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, t])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 🛡️ 2026-06-26 (대표 신고 — 유저↔어드민 상호 로그아웃 근본수정):
      //   기존엔 어드민 로그인 시작 시 무조건 clearAuthData('user') 로 소비자 세션을 파괴했음.
      //   KR 에선 clearAuthData 가 /api/auth/logout-cookies 까지 호출해 httpOnly ur_session 쿠키를
      //   없애므로 "어드민 로그인 = 유저 강제 로그아웃". 코드베이스의 이중 로그인 '공존' 설계
      //   (RouteGuards 토큰존재 기반 + 아래 line 'User 세션 보호' 주석)와 정면 모순이었다.
      //   KR 소비자 세션(쿠키)은 어드민 Bearer 와 독립이라 공존 가능 → 파괴하지 않는다.
      //   글로벌(Firebase)만 기존대로 정리 + signOut (Bearer 공간/토큰 일관성 유지).
      clearFirebaseTokenCache()
      try {
        const { isKorea } = await import('@/config/region')
        if (!isKorea()) {
          clearAuthData('user')
          const signOutPromise = import('@/lib/firebase-auth').then(m => m.signOut())
          await Promise.race([
            signOutPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
          ])
        }
      } catch (_) {} // non-critical: best-effort signOut before admin login

      // JWT-based Login (NO Firebase!)
      // 🆕 보안 PIN: 처음부터 함께 전송 → PIN 설정 계정도 한 번에 로그인(2단계 제거). 비우면 미전송.
      const response = await api.post('/api/admin/login', {
        email,
        password,
        turnstile_token: turnstileToken,
        pin: pin.trim() || undefined,
      })

      // 🆕 보안 PIN: 서버가 PIN 요구(미입력/형식오류) → PIN 입력 단계로.
      if (!response.data.success && response.data.pin_required) {
        setNeedPin(true)
        setError(response.data.error || response.data.message || '6자리 보안 PIN을 입력하세요')
        setLoading(false)
        return
      }

      if (response.data.success) {
        // Save email if "Remember Me" is checked
        if (rememberMe) {
          localStorage.setItem('admin_remember_email', email)
        } else {
          localStorage.removeItem('admin_remember_email')
        }

        // 선택적 삭제: Admin 관련 키만 삭제 (User 세션 보호)
        clearAuthData('admin')

        const { admin, accessToken, refreshToken } = response.data.data

        // Store JWT tokens (PRIMARY: admin_token)
        localStorage.setItem('admin_token', accessToken)
        localStorage.setItem('access_token', accessToken) // Fallback compatibility
        localStorage.setItem('admin_refresh_token', refreshToken)

        // Store user info
        localStorage.setItem('user_type', 'admin')
        localStorage.setItem('active_role', 'admin')  // 🛡️ 2026-05-01: DISPLAY = admin
        localStorage.setItem('admin_id', admin.id.toString())
        localStorage.setItem('admin_name', admin.name || '')
        localStorage.setItem('admin_email', admin.email || '')
        localStorage.setItem('admin_role', admin.role || 'admin') // 🛡️ RBAC — 네비/UI 역할 게이트(권한 강제는 서버)

        // 🆕 보안 PIN 강제 대상(도매 파트너/슈퍼)인데 미설정 → PIN 설정 페이지로 강제 유도.
        if (response.data.data.must_set_pin) {
          localStorage.setItem('admin_must_set_pin', '1')
          navigate('/admin/set-pin', { replace: true })
          return
        }
        localStorage.removeItem('admin_must_set_pin')

        // 🆕 도매 파트너(wholesale)는 소비자 어드민 홈(/admin) 접근 불가 → 도매 통합 현황으로 랜딩.
        const landing = String(admin.role || '').toLowerCase() === 'wholesale' ? '/admin/wholesale-overview' : '/admin'
        navigate(landing, { replace: true })
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[AdminLogin] Error:', err)
      // 🆕 보안 PIN: 잘못된 PIN(401)도 pin_required → PIN 단계 유지.
      if (err.response?.data?.pin_required) setNeedPin(true)
      setError(err.response?.data?.message || err.response?.data?.error || t('admin.login.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="force-light-theme min-h-screen bg-[#F4F5F7] text-gray-900 flex">
      {/* Left branding panel (desktop) */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col bg-[#0A0A0B]">
        <div className="px-10 pt-10">
          <div className="flex items-center gap-3">
            <UrDealLogo size={22} forceDark />
            <span className="text-xs font-bold tracking-widest text-[#e5e7eb] uppercase">Admin Console</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-10">
          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            {t('admin.login.heroTitle')}
          </h1>
          <p className="text-gray-400 text-base mb-10">
            {t('admin.login.heroDesc')}
          </p>

          <div className="space-y-5">
            {[
              { icon: Shield, title: t('admin.login.feature1Title'), desc: t('admin.login.feature1Desc') },
              { icon: BarChart2, title: t('admin.login.feature2Title'), desc: t('admin.login.feature2Desc') },
              { icon: Settings, title: t('admin.login.feature3Title'), desc: t('admin.login.feature3Desc') },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#e5e7eb]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#e5e7eb]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-10 pb-8">
          <p className="text-xs text-gray-600">{t('admin.login.copyright')}</p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <UrDealLogo size={22} forceLight />
            <span className="text-xs font-bold tracking-widest text-[#9ca3af] uppercase">Admin</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('admin.login.title')}</h2>
            <p className="text-gray-500 text-sm mb-8">{t('admin.login.subtitle')}</p>

            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder={t('admin.login.emailPlaceholder')}
                    aria-label={t('auth.email')}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9ca3af] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="admin-password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder={t('auth.passwordPlaceholder')}
                    aria-label={t('auth.password')}
                    className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9ca3af] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 🆕 보안 PIN — 처음부터 노출(아이디/비번과 함께 한 번에 입력). 설정한 계정만 입력, 미설정은 비워둠. */}
              <div>
                <label htmlFor="admin-pin" className="block text-sm font-medium text-gray-700 mb-1.5">
                  6자리 보안 PIN <span className="font-normal text-gray-400">(설정한 경우)</span>
                </label>
                <input
                  id="admin-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  aria-label="보안 PIN"
                  className={`w-full px-4 py-3 border rounded-xl text-center text-lg tracking-[0.4em] font-mono text-gray-900 bg-white [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-[#9ca3af] focus:border-transparent ${needPin ? 'border-[#9ca3af]' : 'border-gray-200'}`}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  {needPin ? '이 계정은 보안 PIN이 필요합니다. 6자리 PIN을 입력하세요.' : 'PIN을 설정한 계정만 입력하세요. 미설정 계정은 비워두면 됩니다.'}
                </p>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="adminRememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 border-gray-300 text-[#9ca3af] focus:ring-[#9ca3af] cursor-pointer rounded"
                />
                <label
                  htmlFor="adminRememberMe"
                  className="text-sm text-gray-600 cursor-pointer select-none"
                >
                  {t('admin.login.rememberEmail')}
                </label>
              </div>

              {/* 🛡️ Cloudflare Turnstile — invisible bot challenge (VITE_TURNSTILE_SITE_KEY 미설정 시 자동 통과) */}
              <TurnstileWidget onVerify={setTurnstileToken} size="invisible" />

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-[#e5e7eb] to-[#9ca3af] hover:opacity-90 disabled:opacity-50 text-[#0A0A0B] font-semibold rounded-xl text-sm transition-all"
              >
                {loading ? t('admin.login.loggingIn') : t('common.login')}
              </button>
            </form>
          </div>

          {/* Back to Home */}
          <div className="text-center mt-6">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
            >
              &larr; {t('admin.login.backToHome')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
