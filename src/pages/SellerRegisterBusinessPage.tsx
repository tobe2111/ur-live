/**
 * 카카오 유저 → 셀러 권한 확장 (Business info 입력)
 *
 * 1) 카카오 로그인 필수 (세션 쿠키 기반)
 * 2) 사업자명/사업자번호/연락처 등 입력
 * 3) POST /api/seller/register-from-user 호출
 * 4) 'pending' 상태로 관리자 승인 대기
 *
 * 기존 /seller/register 는 username/password 직접 가입 (레거시)
 * 이 페이지는 **카카오 유저가 같은 계정에 셀러 role 을 추가** 하는 곳
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { ChevronLeft, Loader2, Store, CheckCircle2, MessageCircle } from 'lucide-react'

export default function SellerRegisterBusinessPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromKakao = searchParams.get('from') === 'kakao'
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user_name') : null
  const [loading, setLoading] = useState(false)
  const [statusChecked, setStatusChecked] = useState(false)
  const [existingStatus, setExistingStatus] = useState<'none' | 'pending' | 'active' | 'suspended'>('none')
  const [form, setForm] = useState({
    business_name: '',
    business_number: '',
    phone: '',
    youtube_email: '',
    description: '',
  })

  // 🛡️ 2026-05-07: 자동 포맷터 (사업자번호 000-00-00000 / 휴대폰 010-XXXX-XXXX)
  const formatBusinessNumber = (input: string) => {
    const d = input.replace(/\D/g, '').slice(0, 10)
    if (d.length <= 3) return d
    if (d.length <= 5) return `${d.slice(0,3)}-${d.slice(3)}`
    return `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`
  }
  const formatPhone = (input: string) => {
    const d = input.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`
    return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`
  }

  // 이미 셀러 신청 했는지 확인
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/seller/my-seller-status')
        if (res.data?.success && res.data.data?.linked) {
          setExistingStatus(res.data.data.seller?.status || 'pending')
        }
      } catch { /* 미로그인 시 error — 폼은 보여주되 submit 시 401 */ }
      finally { setStatusChecked(true) }
    })()
  }, [])

  async function submit() {
    if (!form.business_name.trim() || !form.business_number.trim() || !form.phone.trim()) {
      toast.error(t('seller.register.requiredFields', { defaultValue: '필수 항목을 입력해주세요' }))
      return
    }
    if (!/^\d{3}-\d{2}-\d{5}$/.test(form.business_number)) {
      toast.error(t('seller.register.businessNumberFormat', { defaultValue: '사업자번호 형식: XXX-XX-XXXXX' }))
      return
    }

    setLoading(true)
    try {
      // seller_type 은 백엔드 default 'influencer' 사용 (UI 에선 제거)
      const res = await api.post('/api/seller/register-from-user', { ...form, seller_type: 'influencer' })
      if (res.data?.success) {
        toast.success(t('seller.register.applied', { defaultValue: '셀러 전환 신청이 완료됐어요. 관리자 승인을 기다려주세요.' }))
        setExistingStatus('pending')
      } else {
        // 🛡️ React #31 방지: error 가 객체 ({message, code}) 일 수 있음 → string 변환
        const rawErr = res.data?.error as string | { message?: string } | undefined
        const errMsg = typeof rawErr === 'string' ? rawErr : (rawErr?.message || '신청 실패')
        toast.error(errMsg)
      }
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string | { message?: string } } } }
      if (err.response?.status === 401 || err.response?.status === 403) {
        toast.error(t('seller.register.loginRequired', { defaultValue: '로그인이 필요합니다. 카카오 로그인 후 다시 시도해주세요.' }))
        navigate('/login?returnUrl=' + encodeURIComponent('/seller/register/business'))
        return
      }
      // 🛡️ React #31 방지: error 가 객체일 수 있음 → string 변환
      const rawErr = err.response?.data?.error
      const errMsg = typeof rawErr === 'string' ? rawErr : (typeof rawErr === 'object' && rawErr?.message) ? rawErr.message : '신청 실패'
      toast.error(errMsg)
    } finally { setLoading(false) }
  }

  if (!statusChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    )
  }

  // 이미 pending/active 상태면 안내만
  if (existingStatus === 'pending' || existingStatus === 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <SEO title="셀러 전환 - 유어딜" description="카카오 계정으로 셀러 권한 신청" url="/seller/register/business" noindex />
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-sm">
          <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
            existingStatus === 'active' ? 'bg-green-100' : 'bg-amber-100'
          }`}>
            {existingStatus === 'active'
              ? <CheckCircle2 className="w-8 h-8 text-green-600" />
              : <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {existingStatus === 'active' ? t('sellerRegisterBusiness.alreadyActive') : t('sellerRegisterBusiness.statusPending')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {existingStatus === 'active'
                ? t('sellerRegisterBusiness.activeDesc')
                : t('sellerRegisterBusiness.pendingDesc')}
            </p>
          </div>
          <button
            onClick={() => navigate(existingStatus === 'active' ? '/seller' : '/')}
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-sm">
            {existingStatus === 'active' ? t('sellerRegisterBusiness.toDashboard') : t('common.home')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEO title={`${t('sellerRegisterBusiness.title')} - 유어딜`} description={t('sellerRegisterBusiness.description')} url="/seller/register/business" noindex />

      {/* 헤더 */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900 flex-1">{t('sellerRegisterBusiness.headerTitle')}</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {fromKakao && (
          <div className="bg-[#FEE500]/50 border border-[#FEE500] rounded-xl p-3 flex items-start gap-2">
            <MessageCircle className="w-4 h-4 text-[#3C1E1E] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-[#3C1E1E]">{t('sellerRegisterBusiness.kakaoBanner')} {userName && <>· {userName}</>}</p>
              <p className="text-[11px] text-[#3C1E1E]/70 mt-0.5">{t('sellerRegisterBusiness.kakaoBannerDesc')}</p>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-5 text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-white rounded-full flex items-center justify-center">
            <Store className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-base font-bold text-gray-900">{t('sellerRegisterBusiness.heroTitle')}</h2>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            {t('sellerRegisterBusiness.heroDesc')}
          </p>
        </div>

        {/* 폼 */}
        <div className="bg-white rounded-2xl p-5 space-y-4 border border-gray-100">
          <Field label={t('sellerRegisterBusiness.fieldBusinessName')} required>
            <input value={form.business_name}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              placeholder={t('sellerRegisterBusiness.phBusinessName')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>

          <Field label={t('sellerRegisterBusiness.fieldBusinessNumber')} required>
            <input value={form.business_number}
              onChange={e => setForm(f => ({ ...f, business_number: formatBusinessNumber(e.target.value) }))}
              inputMode="numeric"
              maxLength={12}
              placeholder="000-00-00000"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono" />
          </Field>

          <Field label={t('sellerRegisterBusiness.fieldPhone')} required>
            <input type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
              inputMode="numeric"
              maxLength={13}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>

          {/* 🛡️ 2026-05-07: 셀러 유형 (인플루언서/매장사장님/둘다) 제거 — 사용자에게 무의미.
              백엔드 default 'influencer' 사용. */}

          <Field label={t('sellerRegisterBusiness.fieldYoutubeEmail')}>
            <input type="email" value={form.youtube_email}
              onChange={e => setForm(f => ({ ...f, youtube_email: e.target.value }))}
              placeholder={t('sellerRegisterBusiness.phYoutubeEmail')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>

          <Field label={t('sellerRegisterBusiness.fieldDescription')}>
            <textarea value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t('sellerRegisterBusiness.phDescription')} rows={2} maxLength={500}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none" />
          </Field>
        </div>

        <p className="text-[11px] text-gray-500 text-center leading-relaxed">
          {t('sellerRegisterBusiness.submitNote')}
        </p>

        <button onClick={submit} disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-red-500 to-pink-500 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {loading ? t('sellerRegisterBusiness.submitting') : t('sellerRegisterBusiness.submitBtn')}
        </button>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
