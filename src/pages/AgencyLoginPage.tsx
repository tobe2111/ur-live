import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Mail, Lock, Eye, EyeOff, BarChart2, Users, TrendingUp } from 'lucide-react'
import TurnstileWidget from '@/components/auth/TurnstileWidget'
import UrDealLogo from '@/components/brand/UrDealLogo'

export default function AgencyLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  // 🛡️ 2026-05-03: Turnstile token (분산 봇 brute-force 방어)
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const [rememberMe, setRememberMe] = useState(false)

  // 🛡️ 2026-06-17: 이메일 기억하기 — 저장된 이메일 자동 채움 (admin/seller 와 동형).
  useEffect(() => {
    const saved = localStorage.getItem('agency_remember_email')
    if (saved) { setFormData(p => ({ ...p, email: saved })); setRememberMe(true) }
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
      const res = await api.post('/api/agency/login', { ...formData, turnstile_token: turnstileToken })
      if (res.data.success) {
        // 🛡️ 2026-06-17: 이메일 기억하기 저장/삭제.
        if (rememberMe) localStorage.setItem('agency_remember_email', formData.email)
        else localStorage.removeItem('agency_remember_email')
        const { token, refreshToken, agency } = res.data
        localStorage.setItem('agency_token', token)
        // 🏁 2026-06-13: refresh token 저장 — 자동 로그아웃 근본수정(admin/seller 와 동형)
        if (refreshToken) localStorage.setItem('agency_refresh_token', refreshToken)
        localStorage.setItem('agency_id', String(agency.id))
        localStorage.setItem('agency_name', agency.name)
        localStorage.setItem('agency_email', agency.email)
        // 🛡️ 2026-06-12 (감사 1단계): BottomNav 등이 active_role 로 표시 분기 — agency 도 설정
        //   (SellerLoginPage 의 'seller' 설정과 동일 패턴, dead flag 해소).
        localStorage.setItem('active_role', 'agency')
        navigate('/agency', { replace: true })
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      setError(err_.response?.data?.error || t('auth.invalidCredentials'))
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
            <span className="text-xs font-bold tracking-widest text-[#8B5CF6] uppercase">Agency Partner</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-10">
          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            {t('agency.login.heroTitle')}
          </h1>
          <p className="text-gray-400 text-base mb-10">
            {t('agency.login.heroDesc')}
          </p>

          <div className="space-y-5">
            {[
              { icon: Users, title: t('agency.login.feature1Title'), desc: t('agency.login.feature1Desc') },
              { icon: BarChart2, title: t('agency.login.feature2Title'), desc: t('agency.login.feature2Desc') },
              { icon: TrendingUp, title: t('agency.login.feature3Title'), desc: t('agency.login.feature3Desc') },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#8B5CF6]" />
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
          <p className="text-xs text-gray-600">{t('agency.login.copyright')}</p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <UrDealLogo size={22} forceLight />
            <span className="text-xs font-bold tracking-widest text-[#8B5CF6] uppercase">Agency</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('agency.login.title')}</h2>
            <p className="text-gray-500 text-sm mb-8">{t('agency.login.subtitle')}</p>

            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="agency-email" className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="agency-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="agency@example.com"
                    aria-label={t('auth.email')}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="agency-password" className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="agency-password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                    placeholder={t('auth.passwordPlaceholder')}
                    aria-label={t('auth.password')}
                    className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent transition-all"
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

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                  />
                  <span className="text-sm text-gray-600">{t('auth.rememberEmail', { defaultValue: '이메일 기억하기' })}</span>
                </label>
                <Link
                  to="/agency/forgot-password"
                  className="text-sm text-[#8B5CF6] hover:text-[#7C3AED] font-medium"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>

              {/* 🛡️ Cloudflare Turnstile — invisible bot challenge */}
              <TurnstileWidget onVerify={setTurnstileToken} size="invisible" />

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-[#8B5CF6] to-[#6b7280] hover:opacity-90 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
              >
                {loading ? t('admin.login.loggingIn') : t('common.login')}
              </button>
            </form>

            {/* 카카오 로그인 — 연동된 에이전시는 한 번 로그인으로 권한 복원 */}
            <div className="mt-4">
              <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span>또는</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <a
                href={`/auth/kakao/start?redirect=${encodeURIComponent('/agency')}&intent=agency`}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#FEE500] hover:bg-[#FDD800] text-[#3C1E1E] text-sm font-semibold rounded-xl transition-colors no-underline"
              >
                <span className="text-base">💬</span>
                카카오로 에이전시 시작하기
              </a>
              <p className="text-[10px] text-gray-400 text-center mt-2">
                카카오 로그인 후 안내에 따라 에이전시 권한을 신청할 수 있어요
              </p>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t('auth.noAccount')}{' '}
            <Link to="/agency/register" className="text-[#8B5CF6] hover:underline font-medium">
              {t('agency.login.registerLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
