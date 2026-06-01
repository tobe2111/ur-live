/**
 * 🛡️ 2026-06-01 도매몰 INC-6: 공급자(도매상) 가입.
 *   POST /api/supplier/register → status='pending' (어드민 승인 후 로그인 가능).
 *   라이트 테마.
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { toast } from '@/hooks/useToast'

export default function SupplierRegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    business_name: '', business_number: '', representative: '',
    email: '', phone: '', password: '',
    bank_name: '', bank_account: '', account_holder: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.business_name.trim()) { setError(t('supplier.errBizName', { defaultValue: '상호(사업자명)를 입력해주세요' })); return }
    if (form.password.length < 8) { setError(t('supplier.errPwLen', { defaultValue: '비밀번호는 8자 이상이어야 합니다' })); return }
    setLoading(true)
    try {
      const res = await fetch('/api/supplier/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: form.business_name.trim(),
          business_number: form.business_number.trim() || undefined,
          representative: form.representative.trim() || undefined,
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          bank_name: form.bank_name.trim() || undefined,
          bank_account: form.bank_account.trim() || undefined,
          account_holder: form.account_holder.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({})) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error || t('supplier.registerFailed', { defaultValue: '가입에 실패했습니다' }))
      setDone(true)
      toast.success(t('supplier.registerSubmitted', { defaultValue: '가입 신청이 완료되었습니다' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <SEO title={t('supplier.registerTitle', { defaultValue: '공급자 가입' }) + ' - 유어딜'} description="유어딜 도매 공급자 가입" url="/supplier/register" />
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('supplier.registerSubmitted', { defaultValue: '가입 신청이 완료되었습니다' })}</h2>
          <p className="text-sm text-gray-600 mb-6">{t('supplier.registerPendingDesc', { defaultValue: '관리자 승인 후 로그인할 수 있습니다. 승인까지 영업일 기준 1~2일 소요될 수 있습니다.' })}</p>
          <Link to="/supplier/login" className="inline-block w-full py-3 rounded-xl bg-[#FF0033] text-white font-semibold text-sm">
            {t('supplier.goLogin', { defaultValue: '로그인 페이지로' })}
          </Link>
        </div>
      </div>
    )
  }

  const inputCls = "w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none transition-all disabled:bg-gray-50"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5"

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6">
      <SEO title={t('supplier.registerTitle', { defaultValue: '공급자 가입' }) + ' - 유어딜'} description="유어딜 도매 공급자 가입" url="/supplier/register" />
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> {t('common.back', { defaultValue: '뒤로' })}
        </button>

        <div className="flex items-center gap-2 mb-6">
          <UrDealLogo size={16} forceLight />
          <span className="text-[10px] font-bold tracking-wider text-[#FF0033]">{t('supplier.studio', { defaultValue: 'SUPPLIER' })}</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('supplier.registerTitle', { defaultValue: '공급자 가입' })}</h1>
          <p className="text-sm text-gray-500 mb-6">{t('supplier.registerSubtitle', { defaultValue: '도매 공급상품을 등록하고 정산받으세요. 관리자 승인 후 이용 가능합니다.' })}</p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>{t('supplier.fieldBizName', { defaultValue: '상호(사업자명)' })} <span className="text-red-500">*</span></label>
              <input required disabled={loading} value={form.business_name} onChange={set('business_name')} className={inputCls} placeholder={t('supplier.phBizName', { defaultValue: '예: (주)유어딜무역' })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('supplier.fieldBizNumber', { defaultValue: '사업자등록번호' })}</label>
                <input disabled={loading} value={form.business_number} onChange={set('business_number')} className={inputCls} placeholder="000-00-00000" />
              </div>
              <div>
                <label className={labelCls}>{t('supplier.fieldRepresentative', { defaultValue: '대표자명' })}</label>
                <input disabled={loading} value={form.representative} onChange={set('representative')} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('common.email', { defaultValue: '이메일' })} <span className="text-red-500">*</span></label>
              <input required type="email" disabled={loading} value={form.email} onChange={set('email')} className={inputCls} placeholder="supplier@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('supplier.fieldPhone', { defaultValue: '연락처' })}</label>
                <input disabled={loading} value={form.phone} onChange={set('phone')} className={inputCls} placeholder="010-0000-0000" />
              </div>
              <div>
                <label className={labelCls}>{t('common.password', { defaultValue: '비밀번호' })} <span className="text-red-500">*</span></label>
                <input required type="password" disabled={loading} value={form.password} onChange={set('password')} className={inputCls} placeholder={t('supplier.phPw', { defaultValue: '8자 이상' })} />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-3 mt-3">{t('supplier.settlementInfo', { defaultValue: '정산 계좌 (선택 — 나중에 등록 가능)' })}</p>
              <div className="grid grid-cols-3 gap-3">
                <input disabled={loading} value={form.bank_name} onChange={set('bank_name')} className={inputCls} placeholder={t('supplier.phBank', { defaultValue: '은행' })} />
                <input disabled={loading} value={form.bank_account} onChange={set('bank_account')} className={`${inputCls} col-span-2`} placeholder={t('supplier.phAccount', { defaultValue: '계좌번호' })} />
              </div>
              <input disabled={loading} value={form.account_holder} onChange={set('account_holder')} className={`${inputCls} mt-3`} placeholder={t('supplier.phHolder', { defaultValue: '예금주' })} />
            </div>

            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF0033] to-pink-500 text-white font-semibold text-sm disabled:opacity-60 mt-2">
              {loading ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.registerButton', { defaultValue: '가입 신청' })}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            {t('supplier.haveAccount', { defaultValue: '이미 계정이 있으신가요?' })}{' '}
            <Link to="/supplier/login" className="font-bold text-[#FF0033] hover:underline">{t('supplier.loginButton', { defaultValue: '로그인' })}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
