import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '@/lib/api'
import { clearAuthData } from '@/utils/auth'
import { clearFirebaseTokenCache } from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Mail, Lock, Eye, EyeOff, Users, Package, TrendingUp, ArrowRight, ChevronDown } from 'lucide-react'
import TurnstileWidget from '@/components/auth/TurnstileWidget'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { safeInternalPath } from '@/utils/safe-internal-path'

export default function SellerLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // 🆕 2026-06-28 로그인 후 복귀 경로(예: 유어애즈 /ads/dashboard). 없으면 기존 /seller·/wholesale.
  const rawReturn = searchParams.get('returnUrl') || searchParams.get('redirect')
  const returnUrl = rawReturn ? safeInternalPath(rawReturn, '') : ''
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  // 🛡️ 2026-05-03: Turnstile token (분산 봇 brute-force 방어)
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  // 🔗 2026-06-26 카카오 단일로그인 통일 (Step 2a): 카카오 우선, 이메일 폼은 기존 셀러용 fallback.
  //   저장된 remember_email 이 있으면(=기존 이메일 셀러) 폼을 자동으로 펼쳐 회귀 0.
  const [showEmailLogin, setShowEmailLogin] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('seller_remember_email')
    if (saved) { setFormData(prev => ({ ...prev, email: saved })); setRememberMe(true); setShowEmailLogin(true) }
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
        // 🛡️ 2026-06-26 (유저↔셀러 상호 로그아웃 근본수정 — 어드민 로그인과 동일):
        //   KR 소비자 세션(httpOnly ur_session 쿠키)은 셀러 Bearer 와 독립 → 셀러 로그인이 유저를
        //   강제 로그아웃하지 않게 파괴 금지(공존: 유저→사업자등록→사업자 유저는 같은 사람).
        //   글로벌(Firebase)만 기존대로 정리 + signOut.
        try {
          const { isKorea } = await import('@/config/region')
          if (!isKorea()) {
            clearAuthData('user')
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
        // 🏭 2026-06-04 판매사 분리: 도매 접근권(capability) hint — 도매 채팅/배지 등에서 사용.
        if (seller.is_distributor) localStorage.setItem('is_distributor', '1')
        else localStorage.removeItem('is_distributor')
        // 🏭 2026-06-30 [서비스 분리] 새 로그인 = SellerLayout 표면 판정 세션 상태 리셋(이전 계정 잔존 방지).
        try { ['ur_seller_surface', 'ur_seller_bounced', 'ur_force_seller'].forEach(k => sessionStorage.removeItem(k)) } catch { /* noop */ }
        // 🏭 2026-06-30 [서비스 분리] 라우팅은 '도매 전용'(wholesale_only) 기준 — 겸업(소비자 셀러+판매사)은
        //   is_distributor=1 이어도 셀러 대시보드로(서버 권위 computeWholesaleOnly 결과). is_distributor 하나로
        //   분기하던 옛 코드는 겸업을 도매몰로 잘못 보냈다. wholesale_only 없으면(구버전 응답) 셀러로 폴백.
        // 🆕 returnUrl 있으면 거기로(유어애즈 등).
        navigate(returnUrl || (seller.wholesale_only ? '/wholesale' : '/seller'), { replace: true })
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      setError(err_.response?.data?.error || t('seller.loginErrorDefault'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="force-light-theme min-h-screen bg-[#F4F5F7] text-gray-900 flex">
      {/* Left branding panel (desktop only) */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col bg-[#0A0A0B]">
        <div className="px-10 pt-10">
          <div className="flex items-center gap-2">
            <UrDealLogo size={14} forceDark />
            <span className="text-[9px] font-bold tracking-wider text-[#111827]">
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
              { icon: Users, title: t('seller.loginFeature1Title'), desc: t('seller.loginFeature1Desc') },
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
          <span className="text-[9px] font-bold tracking-wider text-[#111827]">
            SELLER STUDIO
          </span>
        </div>

        <div className="w-full max-w-sm md:max-w-md">
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

            {/* 🔗 카카오 로그인 = 기본(권장). 카카오 한 번으로 셀러 권한 자동 복원/신청 */}
            <a
              href={`/auth/kakao/start?redirect=${encodeURIComponent(returnUrl || '/seller')}&intent=seller`}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#FEE500] hover:bg-[#FDD800] active:opacity-90 text-[#191600] text-[15px] font-bold rounded-2xl transition-colors no-underline shadow-sm"
            >
              <span className="text-lg">💬</span>
              {t('seller.kakaoLoginPrimary', { defaultValue: '카카오로 로그인 / 시작하기' })}
            </a>
            <p className="text-[11px] text-gray-400 text-center mt-2 leading-relaxed">
              {t('seller.kakaoLoginPrimaryHint', { defaultValue: '카카오 계정 하나로 로그인하면 셀러 권한이 자동으로 연결돼요.' })}
            </p>

            {/* 기존 이메일 셀러 로그인 (fallback) */}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowEmailLogin(v => !v)}
                className="w-full flex items-center justify-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
                aria-expanded={showEmailLogin}
              >
                {t('seller.emailLoginToggle', { defaultValue: '기존 이메일로 로그인' })}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showEmailLogin ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* 조건부 렌더(=display:none 아님) — invisible Turnstile 이 숨겨진 컨테이너에서 미실행되는 문제 방지.
                폼 상태(formData/turnstileToken)는 부모 useState 라 토글해도 유지. */}
            {showEmailLogin && (
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#111827]/30 focus:border-[#111827] outline-none transition-all disabled:bg-gray-50"
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
                    className="w-full pl-10 pr-11 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#111827]/30 focus:border-[#111827] outline-none transition-all disabled:bg-gray-50"
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
                      rememberMe ? 'bg-[#111827] border-[#111827]' : 'border-gray-300 bg-white'
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
                  className="text-sm text-[#111827] hover:text-[#cc0029] font-medium"
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
                className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-gradient-to-r from-[#111827] to-[#6b7280] text-white text-sm font-semibold rounded-2xl hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
            )}

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                {t('auth.noAccount')}{' '}
                <Link to="/seller/signup" className="text-[#111827] font-medium hover:text-[#cc0029] transition-colors">
                  {t('seller.sellerRegister')}
                </Link>
              </p>
              {/* 🛡️ 2026-06-01 도매몰 크로스링크: 도매 공급사 진입 */}
              <p className="text-xs text-gray-400 mt-2">
                {t('seller.areYouSupplier', { defaultValue: '도매 공급사이신가요?' })}{' '}
                <Link to="/supplier/login" className="text-amber-600 font-medium hover:underline">
                  {t('seller.goWholesale', { defaultValue: '도매몰 →' })}
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
