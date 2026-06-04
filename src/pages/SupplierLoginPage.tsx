/**
 * 🛡️ 2026-06-01 도매몰 INC-6: 공급자(도매상) 로그인.
 *   POST /api/supplier/login → supplier_token 저장 → /supplier 대시보드.
 *   라이트 테마 (대시보드 계열).
 */
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Package } from 'lucide-react'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { toast } from '@/hooks/useToast'
import { setSupplierSession, isSupplierLoggedIn } from '@/lib/supplier-api'

export default function SupplierLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isSupplierLoggedIn()) { navigate('/supplier', { replace: true }); return }
    // 🏭 2026-06-04 카카오 통합: 카카오 유저로 로그인된 채 돌아오면 제조회원 전환/로그인 자동 시도.
    //   승인됨 → supplier 세션 + /supplier. 미승인 → 승인 대기 안내. (세션 쿠키로 인증)
    if (typeof window !== 'undefined' && localStorage.getItem('user_id')) {
      (async () => {
        try {
          const res = await fetch('/api/supplier/become', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          const data = await res.json().catch(() => ({})) as { success?: boolean; status?: string; message?: string; data?: { token: string; supplier: { id: number; business_name: string; email: string } } }
          if (data.success && data.status === 'approved' && data.data) {
            setSupplierSession(data.data.token, data.data.supplier)
            toast.success('제조회원으로 로그인되었습니다')
            navigate('/supplier', { replace: true })
          } else if (data.success && data.status === 'pending') {
            toast.info(data.message || '제조회원 승인 대기 중입니다 — 승인 후 이용할 수 있어요')
          } else if (data.success && data.status === 'needs_registration') {
            // 신규 — 사업자 정보 입점 신청 필요.
            toast.info('제조회원 입점 신청(사업자 정보)을 먼저 진행해주세요')
            navigate('/supplier/register', { replace: true })
          }
        } catch { /* silent — 일반 로그인 폼 유지 */ }
      })()
    }
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/supplier/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      })
      const data = await res.json().catch(() => ({})) as {
        success?: boolean; error?: string;
        data?: { token: string; supplier: { id: number; business_name: string; email: string } }
      }
      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.error || t('supplier.loginFailed', { defaultValue: '로그인에 실패했습니다' }))
      }
      setSupplierSession(data.data.token, data.data.supplier)
      toast.success(t('supplier.loginSuccess', { defaultValue: '로그인되었습니다' }))
      navigate('/supplier', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <SEO title={t('supplier.loginTitle', { defaultValue: '공급자 로그인' }) + ' - 유어딜'} description="유어딜 도매 공급자 대시보드 로그인" url="/supplier/login" />

      {/* Left branding (desktop) */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col bg-[#0A0A0B]">
        <div className="px-10 pt-10">
          <div className="flex items-center gap-2">
            <UrDealLogo size={14} forceDark />
            <span className="text-[9px] font-bold tracking-wider text-[#FF0033]">
              {t('supplier.studio', { defaultValue: 'SUPPLIER' })}
            </span>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center px-10">
          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            {t('supplier.heroTitle', { defaultValue: '도매 공급의 시작' })}
          </h1>
          <p className="text-gray-400 text-base mb-10">
            {t('supplier.heroDesc', { defaultValue: '공급상품을 등록하고 셀러 판매·정산을 한눈에 관리하세요.' })}
          </p>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{t('supplier.heroFeatureTitle', { defaultValue: '공급상품 카탈로그' })}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('supplier.heroFeatureDesc', { defaultValue: '상품 등록부터 정산까지 직접 관리' })}</p>
            </div>
          </div>
        </div>
        <div className="px-10 pb-8">
          <p className="text-xs text-gray-600">&copy; 2026 {t('supplier.copyright', { defaultValue: '유어딜. 도매 공급자 서비스' })}</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="lg:hidden mb-8 flex items-center gap-2">
          <UrDealLogo size={14} forceLight />
          <span className="text-[9px] font-bold tracking-wider text-[#FF0033]">{t('supplier.studio', { defaultValue: 'SUPPLIER' })}</span>
        </div>

        <div className="w-full max-w-sm md:max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900">{t('supplier.loginTitle', { defaultValue: '공급자 로그인' })}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('supplier.loginSubtitle', { defaultValue: '도매 공급자 계정으로 로그인하세요' })}</p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="sup-email" className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.email', { defaultValue: '이메일' })}</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="sup-email" type="email" required autoComplete="email" disabled={loading}
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="supplier@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none transition-all disabled:bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sup-pw" className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.password', { defaultValue: '비밀번호' })}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="sup-pw" type={showPw ? 'text' : 'password'} required autoComplete="current-password" disabled={loading}
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full pl-10 pr-11 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none transition-all disabled:bg-gray-50"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="toggle password">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF0033] to-pink-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
                {loading ? t('common.loading', { defaultValue: '처리 중...' }) : (<>{t('supplier.loginButton', { defaultValue: '로그인' })} <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </form>

            {/* 🏭 2026-06-04 카카오 통합 — 카카오로 제조회원 입점/로그인. 승인 후 이용. */}
            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">또는</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <button type="button" onClick={() => { window.location.href = '/auth/kakao/start?redirect=/supplier/login&intent=user' }}
              className="w-full h-12 rounded-xl font-bold text-sm" style={{ background: '#FEE500', color: '#3C1E1E' }}>
              카카오로 제조회원 입점·로그인
            </button>

            <p className="mt-6 text-center text-sm text-gray-600">
              {t('supplier.noAccount', { defaultValue: '계정이 없으신가요?' })}{' '}
              <Link to="/supplier/register" className="font-bold text-[#FF0033] hover:underline">
                {t('supplier.registerLink', { defaultValue: '공급자 가입' })}
              </Link>
            </p>
            {/* 🛡️ 2026-06-01 도매몰 크로스링크: 셀러 진입 */}
            <p className="mt-2 text-center text-xs text-gray-400">
              {t('supplier.areYouSeller', { defaultValue: '라이브/매장 셀러이신가요?' })}{' '}
              <Link to="/seller/login" className="text-[#FF0033] font-medium hover:underline">
                {t('supplier.goSeller', { defaultValue: '셀러 로그인 →' })}
              </Link>
            </p>
          </div>
          <p className="mt-6 text-center text-xs text-gray-400">
            {t('supplier.support', { defaultValue: '문의' })}: <a href="mailto:support@ur-team.com" className="underline">support@ur-team.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}
