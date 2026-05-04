import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '@/lib/api'
import { clearAuthData } from '@/utils/auth'
import { clearFirebaseTokenCache } from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Mail, Lock, Eye, EyeOff, Play, Package, TrendingUp, ArrowRight } from 'lucide-react'
import TurnstileWidget from '@/components/auth/TurnstileWidget'
import UrDealLogo from '@/components/brand/UrDealLogo'

export default function SellerLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  // 🛡️ 2026-05-03: Turnstile token (분산 봇 brute-force 방어)
  const [turnstileToken, setTurnstileToken] = useState<string>('')

  useEffect(() => {
    const saved = localStorage.getItem('seller_remember_email')
    if (saved) { setFormData(prev => ({ ...prev, email: saved })); setRememberMe(true) }
  }, [])

  // 🛡️ 2026-04-29: 401 인터셉터가 ?error=session_expired 로 redirect 시 toast 표시
  useEffect(() => {
    if (searchParams.get('error') === 'session_expired') {
      toast.error(t('auth.sessionExpired'))
      const next = new URLSearchParams(searchParams)
      next.delete('error')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, t])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await api.post('/api/seller/login', {
        email: formData.email,
        password: formData.password,
        turnstile_token: turnstileToken,
      })
      if (response.data.success) {
        if (rememberMe) {
          localStorage.setItem('seller_remember_email', formData.email)
        } else {
          localStorage.removeItem('seller_remember_email')
        }
        const { seller, accessToken, refreshToken } = response.data.data
        clearFirebaseTokenCache()
        clearAuthData('user')
        // 🛡️ 2026-05-01: KR Firebase 100% 미사용 — signOut 호출 안 함.
        //   KR 한정으로 Firebase SDK 로드 방지. 글로벌은 기존 동작 유지.
        try {
          const { isKorea } = await import('@/config/region')
          if (!isKorea()) {
            import('@/lib/firebase-auth').then(({ signOut }) => signOut()).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
          }
        } catch { /* region detect 실패 시 안전 — Firebase 호출 안 함 */ }
        localStorage.setItem('seller_token', accessToken)
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('seller_refresh_token', refreshToken)
        localStorage.setItem('user_type', 'seller')
        localStorage.setItem('active_role', 'seller')  // 🛡️ 2026-05-01: 명시 셀러 로그인 → DISPLAY = seller
        localStorage.setItem('seller_id', seller.id.toString())
        localStorage.setItem('seller_name', seller.name || '')
        localStorage.setItem('seller_email', seller.email || '')
        localStorage.setItem('seller_username', seller.username || seller.slug || '')
        localStorage.setItem('seller_type', seller.seller_type || 'influencer')
        navigate('/seller', { replace: true })
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      setError(err_.response?.data?.error || t('seller.loginErrorDefault'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex">
      {/* Left branding panel (desktop only) */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col bg-[#0A0A0B]">
        <div className="px-10 pt-10">
          <div className="flex items-center gap-2">
            <UrDealLogo size={14} forceDark />
            <span className="text-[9px] font-bold tracking-wider text-[#FF0033]">
              SELLER STUDIO
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-10">
          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            {t('seller.loginHeroTitle')}
          </h1>
          <p className="text-gray-400 text-base mb-10">
            {t('seller.loginHeroDesc')}
          </p>

          <div className="space-y-5">
            {[
              { icon: Play, title: t('seller.loginFeature1Title'), desc: t('seller.loginFeature1Desc') },
              { icon: Package, title: t('seller.loginFeature2Title'), desc: t('seller.loginFeature2Desc') },
              { icon: TrendingUp, title: t('seller.loginFeature3Title'), desc: t('seller.loginFeature3Desc') },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-white" />
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
          <p className="text-xs text-gray-600">&copy; 2026 {t('seller.loginCopyright')}</p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2">
          <UrDealLogo size={14} forceLight />
          <span className="text-[9px] font-bold tracking-wider text-[#FF0033]">
            SELLER STUDIO
          </span>
        </div>

        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900">{t('seller.sellerLogin')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('seller.loginSubtitle')}</p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="seller-email" className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="seller-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={e => setFormData(d => ({ ...d, email: e.target.value }))}
                    required
                    autoComplete="email"
                    disabled={loading}
                    placeholder="seller@example.com"
                    aria-label={t('common.email')}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none transition-all disabled:bg-gray-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="seller-password" className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="seller-password"
                    type={showPw ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={e => setFormData(d => ({ ...d, password: e.target.value }))}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    placeholder={t('seller.passwordPlaceholder')}
                    aria-label={t('auth.password')}
                    className="w-full pl-10 pr-11 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none transition-all disabled:bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPw ? t('seller.hidePassword') : t('seller.showPassword')}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember email + Forgot password */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRememberMe(v => !v)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                      rememberMe ? 'bg-[#FF0033] border-[#FF0033]' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {rememberMe && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                        <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span
                    onClick={() => setRememberMe(v => !v)}
                    className="text-sm text-gray-600 cursor-pointer select-none"
                  >
                    {t('seller.rememberEmail')}
                  </span>
                </div>
                <Link
                  to="/seller/forgot-password"
                  className="text-sm text-[#FF0033] hover:text-[#cc0029] font-medium"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>

              {/* 🛡️ Cloudflare Turnstile — invisible bot challenge */}
              <TurnstileWidget onVerify={setTurnstileToken} size="invisible" />

              {/* Login button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-gradient-to-r from-[#FF0033] to-[#EC4899] text-white text-sm font-semibold rounded-2xl hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('seller.loggingIn')}
                  </>
                ) : (
                  <>{t('seller.loginButton')} <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            {/* 카카오 로그인 — 카카오 연동된 셀러는 한 번 로그인으로 셀러 권한 자동 복원 */}
            <div className="mt-4">
              <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span>또는</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <a
                href={`/auth/kakao/start?redirect=${encodeURIComponent('/seller')}&intent=seller`}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#FEE500] hover:bg-[#FDD800] text-[#3C1E1E] text-sm font-semibold rounded-2xl transition-colors no-underline"
              >
                <span className="text-base">💬</span>
                카카오로 셀러 시작하기
              </a>
              <p className="text-[10px] text-gray-400 text-center mt-2">
                카카오 로그인 후 안내에 따라 셀러 권한을 신청할 수 있어요
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                {t('auth.noAccount')}{' '}
                <Link to="/seller/signup" className="text-[#FF0033] font-medium hover:text-[#cc0029] transition-colors">
                  {t('seller.sellerRegister')}
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-gray-400">
            {t('seller.contactInquiry')}:{' '}
            <a href="mailto:support@ur-team.com" className="hover:text-gray-600 underline transition-colors">
              support@ur-team.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
