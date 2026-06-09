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
import BusinessCertUpload from '@/components/BusinessCertUpload'
import { isSupplierLoggedIn } from '@/lib/supplier-api'
import { useWholesaleMall } from '@/hooks/queries/useWholesale'

export default function SupplierRegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🏬 2026-06-09 멀티-몰 브랜딩 — host → mall (기본 몰 → 유통스타트/#FF0033 → byte-identical).
  const { displayName: mallName, brandColor: mallBrand, logoUrl: mallLogo } = useWholesaleMall()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [licenseUrl, setLicenseUrl] = useState('')
  // 🏭 2026-06-08 카카오 통합 (유통회원 WholesaleJoinPage 와 대칭):
  //   카카오로 로그인된 유저(아직 제조회원 아님) → 이메일/비번 없이 사업자 정보만 입력 후 /api/supplier/become.
  const kakaoUser = typeof window !== 'undefined' && !isSupplierLoggedIn() && !!localStorage.getItem('user_id')
  const loginEmail = (typeof window !== 'undefined' && localStorage.getItem('user_email')) || ''
  const [form, setForm] = useState({
    business_name: '', business_number: '', representative: '',
    email: loginEmail,
    phone: '', password: '',
    bank_name: '', bank_account: '', account_holder: '',
    // 🏭 2026-06-09 대표자/담당자 분리 — 대표자 연락처 + 담당자(성명/연락처/이메일).
    representative_phone: '',
    manager_name: (typeof window !== 'undefined' && localStorage.getItem('user_name')) || '',
    manager_phone: '',
    manager_email: loginEmail,
  })
  // 담당자가 대표자와 동일 — 체크 시 대표자(성명/연락처)를 담당자에 즉시 복사.
  const [sameAsRep, setSameAsRep] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))
  // 대표자 → 담당자 복사(성명+연락처). 토글 ON 이면 대표자 입력이 담당자에 실시간 반영.
  const setRep = (k: 'representative' | 'representative_phone') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setForm(f => {
      const next = { ...f, [k]: v }
      if (sameAsRep) {
        if (k === 'representative') next.manager_name = v
        if (k === 'representative_phone') next.manager_phone = v
      }
      return next
    })
  }
  const toggleSame = (on: boolean) => {
    setSameAsRep(on)
    if (on) setForm(f => ({ ...f, manager_name: f.representative, manager_phone: f.representative_phone }))
  }

  // 🏭 2026-06-08: 에러를 상단 박스 + 토스트 팝업 동시 노출(상단 박스만 있으면 스크롤 위라 못 봄 — 사용자 신고).
  const fail = (m: string) => { setError(m); toast.error(m) }
  // 사업자등록번호 자동 양식(000-00-00000) — 숫자만 추출 후 하이픈 자동 삽입.
  const onBizNum = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 10)
    const v = d.length <= 3 ? d : d.length <= 5 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
    setForm(f => ({ ...f, business_number: v }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.business_name.trim()) { fail(t('supplier.errBizName', { defaultValue: '상호(사업자명)를 입력해주세요' })); return }
    if (!/^\d{3}-\d{2}-\d{5}$/.test(form.business_number.trim())) { fail(t('supplier.errBizNum', { defaultValue: '사업자등록번호를 정확히 입력해주세요 (000-00-00000)' })); return }
    if (!licenseUrl) { fail(t('supplier.errBizLicense', { defaultValue: '사업자등록증 이미지를 업로드해주세요' })); return }
    // 🏭 2026-06-09 대표자/담당자 필수 검증 (연락처 양식은 lenient).
    if (!form.representative.trim() || !form.representative_phone.trim()) { fail(t('supplier.errRep', { defaultValue: '대표자 성명·연락처를 입력해주세요' })); return }
    if (!form.manager_name.trim() || !form.manager_phone.trim()) { fail(t('supplier.errManager', { defaultValue: '담당자 성명·연락처를 입력해주세요' })); return }
    // 카카오 가입은 이메일/비번 불필요 — 일반(이메일) 가입만 비번 검증.
    if (!kakaoUser) {
      if (form.password.length < 8) { fail(t('supplier.errPwLen', { defaultValue: '비밀번호는 8자 이상이어야 합니다' })); return }
      if (!/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password)) { fail(t('supplier.errPwClass', { defaultValue: '비밀번호는 영문과 숫자를 포함해야 합니다' })); return }
    }
    setLoading(true)
    try {
      // 카카오 유저 → /become(세션 인증, 사업자 정보만), 그 외 → /register(이메일/비번).
      const url = kakaoUser ? '/api/supplier/become' : '/api/supplier/register'
      // 담당자 이메일 — 미입력 시 로그인 이메일을 비즈니스 연락 이메일로 사용.
      const managerEmail = (form.manager_email.trim() || form.email.trim()) || undefined
      // 대표자/담당자 공통 필드 (양 모드 동일).
      const repFields = {
        representative_phone: form.representative_phone.trim() || undefined,
        manager_name: form.manager_name.trim() || undefined,
        manager_phone: form.manager_phone.trim() || undefined,
        manager_email: managerEmail,
      }
      const payload = kakaoUser
        ? {
            business_name: form.business_name.trim(),
            business_number: form.business_number.trim(),
            representative: form.representative.trim() || undefined,
            phone: form.phone.trim() || form.representative_phone.trim() || undefined,
            business_license_url: licenseUrl || undefined,
            ...repFields,
          }
        : {
            business_name: form.business_name.trim(),
            business_number: form.business_number.trim(),
            representative: form.representative.trim() || undefined,
            email: form.email.trim(),
            phone: form.phone.trim() || form.representative_phone.trim() || undefined,
            password: form.password,
            bank_name: form.bank_name.trim() || undefined,
            bank_account: form.bank_account.trim() || undefined,
            account_holder: form.account_holder.trim() || undefined,
            business_license_url: licenseUrl || undefined,
            ...repFields,
          }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      // /become 는 requireAuth — 카카오 유저 세션 토큰(있으면) 첨부.
      if (kakaoUser && typeof window !== 'undefined') {
        const tok = localStorage.getItem('access_token') || localStorage.getItem('token')
        if (tok) headers.Authorization = `Bearer ${tok}`
      }
      const res = await fetch(url, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({})) as { success?: boolean; error?: string; status?: string }
      if (!res.ok || !data.success) throw new Error(data.error || t('supplier.registerFailed', { defaultValue: '가입에 실패했습니다' }))
      // 카카오 가입(/become) 신규 신청 → status==='pending'. (needs_registration 은 빈 body probe 응답이라 여기 안 옴.)
      setDone(true)
      toast.success(t('supplier.registerSubmitted', { defaultValue: '가입 신청이 완료되었습니다' }))
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err))
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
          <Link to="/supplier/login" className="inline-block w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: mallBrand }}>
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
          {mallLogo
            ? <img src={mallLogo} alt={mallName} className="w-7 h-7 rounded object-cover" />
            : <UrDealLogo size={16} forceLight />}
          <span className="text-[10px] font-bold tracking-wider" style={{ color: mallBrand }}>
            {t('supplier.studio', { defaultValue: 'SUPPLIER' })}
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('supplier.registerTitle', { defaultValue: '공급자 가입' })}</h1>
          <p className="text-sm text-gray-500 mb-6">{t('supplier.registerSubtitle', { defaultValue: '도매 공급상품을 등록하고 정산받으세요. 관리자 승인 후 이용 가능합니다.' })}</p>

          {/* 🏭 2026-06-08 카카오 통합 (WholesaleJoinPage 와 대칭): 카카오로 로그인된 유저는 사업자 정보만 입력. */}
          {kakaoUser && (
            <div className="mb-5 rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF6D9', color: '#7A5C00' }}>
              {t('supplier.kakaoModeNotice', { defaultValue: '카카오 계정으로 진행 중 — 사업자 정보만 입력하면 승인 심사로 넘어갑니다.' })}
            </div>
          )}

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
            <div>
              <label className={labelCls}>{t('supplier.fieldBizNumber', { defaultValue: '사업자등록번호' })} <span className="text-[#FF0033]">*</span></label>
              <input required disabled={loading} value={form.business_number} onChange={onBizNum} inputMode="numeric" maxLength={12} className={inputCls} placeholder="000-00-00000" />
            </div>
            {/* 🏭 2026-06-04 사업자등록증 이미지 (승인 심사용) */}
            <BusinessCertUpload value={licenseUrl} onChange={setLicenseUrl} required />

            {/* 🏭 2026-06-09 대표자 정보 */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm font-bold text-gray-900 mb-3">{t('supplier.repSection', { defaultValue: '대표자 정보' })}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('supplier.fieldRepName', { defaultValue: '대표자 성명' })} <span className="text-red-500">*</span></label>
                  <input disabled={loading} value={form.representative} onChange={setRep('representative')} className={inputCls} placeholder={t('supplier.phName', { defaultValue: '예: 홍길동' })} />
                </div>
                <div>
                  <label className={labelCls}>{t('supplier.fieldRepPhone', { defaultValue: '대표자 연락처' })} <span className="text-red-500">*</span></label>
                  <input disabled={loading} value={form.representative_phone} onChange={setRep('representative_phone')} className={inputCls} placeholder="010-0000-0000" />
                </div>
              </div>
            </div>

            {/* 🏭 2026-06-09 담당자 정보 (+ 대표자와 동일 원클릭 복사) */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-900">{t('supplier.managerSection', { defaultValue: '담당자 정보' })}</p>
                <label className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" checked={sameAsRep} onChange={(e) => toggleSame(e.target.checked)} disabled={loading} className="w-4 h-4 rounded accent-[#FF0033]" />
                  {t('supplier.sameAsRep', { defaultValue: '대표자와 동일' })}
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('supplier.fieldManagerName', { defaultValue: '담당자 성명' })} <span className="text-red-500">*</span></label>
                  <input disabled={loading || sameAsRep} value={form.manager_name} onChange={set('manager_name')} className={`${inputCls} ${sameAsRep ? 'bg-gray-100 text-gray-400' : ''}`} placeholder={t('supplier.phManagerName', { defaultValue: '예: 김담당' })} />
                </div>
                <div>
                  <label className={labelCls}>{t('supplier.fieldManagerPhone', { defaultValue: '담당자 연락처' })} <span className="text-red-500">*</span></label>
                  <input disabled={loading || sameAsRep} value={form.manager_phone} onChange={set('manager_phone')} className={`${inputCls} ${sameAsRep ? 'bg-gray-100 text-gray-400' : ''}`} placeholder="010-0000-0000" />
                </div>
              </div>
              <div className="mt-3">
                <label className={labelCls}>{t('supplier.fieldManagerEmail', { defaultValue: '담당자 이메일' })} <span className="text-gray-400 font-normal">({t('common.optional', { defaultValue: '선택' })})</span></label>
                <input type="email" disabled={loading} value={form.manager_email} onChange={set('manager_email')} className={inputCls} placeholder={kakaoUser ? t('supplier.phManagerEmailKakao', { defaultValue: '연락용 이메일' }) : t('supplier.phManagerEmail', { defaultValue: '미입력 시 로그인 이메일' })} autoComplete="off" />
              </div>
            </div>
            {/* 카카오 유저는 이메일/비번/정산계좌 불필요 (세션 인증 + 나중 등록). 일반 가입만 노출. */}
            {!kakaoUser && (
              <>
                <div>
                  <label className={labelCls}>{t('common.email', { defaultValue: '이메일' })} <span className="text-red-500">*</span></label>
                  <input required type="email" disabled={loading} value={form.email} onChange={set('email')} className={inputCls} placeholder="supplier@example.com" />
                </div>
                <div>
                  <label className={labelCls}>{t('common.password', { defaultValue: '비밀번호' })} <span className="text-red-500">*</span></label>
                  <input required type="password" disabled={loading} value={form.password} onChange={set('password')} className={inputCls} placeholder={t('supplier.phPw', { defaultValue: '영문+숫자 8자 이상' })} />
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-3 mt-3">{t('supplier.settlementInfo', { defaultValue: '정산 계좌 (선택 — 나중에 등록 가능)' })}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <input disabled={loading} value={form.bank_name} onChange={set('bank_name')} className={inputCls} placeholder={t('supplier.phBank', { defaultValue: '은행' })} />
                    <input disabled={loading} value={form.bank_account} onChange={set('bank_account')} className={`${inputCls} col-span-2`} placeholder={t('supplier.phAccount', { defaultValue: '계좌번호' })} />
                  </div>
                  <input disabled={loading} value={form.account_holder} onChange={set('account_holder')} className={`${inputCls} mt-3`} placeholder={t('supplier.phHolder', { defaultValue: '예금주' })} />
                </div>
              </>
            )}
            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-60 mt-2" style={{ background: mallBrand }}>
              {loading ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.registerButton', { defaultValue: '가입 신청' })}
            </button>
          </form>

          {/* 🏭 2026-06-08 카카오로 간편 가입 — 비-카카오 사용자에게만 노출 (사업자 정보는 동일 입력). WholesaleJoinPage 와 대칭. */}
          {!kakaoUser && (
            <>
              <div className="relative my-5 flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{t('common.or', { defaultValue: '또는' })}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <button type="button" onClick={() => { window.location.href = '/auth/kakao/start?redirect=/supplier/register&intent=user' }}
                className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm" style={{ background: '#FEE500', color: '#3C1E1E' }}>
                {t('supplier.kakaoStart', { defaultValue: '카카오로 시작하기' })}
              </button>
            </>
          )}

          <p className="mt-6 text-center text-sm text-gray-600">
            {t('supplier.haveAccount', { defaultValue: '이미 계정이 있으신가요?' })}{' '}
            <Link to="/supplier/login" className="font-bold hover:underline" style={{ color: mallBrand }}>{t('supplier.loginButton', { defaultValue: '로그인' })}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
