/**
 * 카카오 유저 → 에이전시 권한 확장 (Business info 입력)
 * POST /api/agency/register-from-user 호출 → pending 상태로 관리자 승인 대기.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { ChevronLeft, Loader2, Briefcase, CheckCircle2, MessageCircle } from 'lucide-react'

export default function AgencyRegisterBusinessPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromKakao = searchParams.get('from') === 'kakao'
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user_name') : null
  const [loading, setLoading] = useState(false)
  const [statusChecked, setStatusChecked] = useState(false)
  const [existingStatus, setExistingStatus] = useState<'none' | 'pending' | 'active' | 'suspended'>('none')
  const [form, setForm] = useState({
    name: '',
    contact_name: userName || '',
    phone: '',
  })

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/agency/my-agency-status')
        if (res.data?.success && res.data.data?.linked) {
          setExistingStatus(res.data.data.agency?.status || 'pending')
        }
      } catch { /* 미로그인 시 error — 폼은 보여주되 submit 시 401 */ }
      finally { setStatusChecked(true) }
    })()
  }, [])

  async function submit() {
    if (!form.name.trim() || !form.contact_name.trim()) {
      toast.error('에이전시명과 담당자명은 필수입니다')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/api/agency/register-from-user', form)
      if (res.data?.success) {
        toast.success('에이전시 가입 신청이 완료됐어요. 관리자 승인을 기다려주세요.')
        setExistingStatus('pending')
      } else {
        toast.error(res.data?.error || '신청 실패')
      }
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } }
      if (err.response?.status === 401) {
        toast.error('로그인이 필요합니다')
        navigate('/login?returnUrl=' + encodeURIComponent('/agency/register/business'))
        return
      }
      toast.error(err.response?.data?.error || '신청 실패')
    } finally { setLoading(false) }
  }

  if (!statusChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (existingStatus === 'pending' || existingStatus === 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <SEO title="에이전시 가입 - 유어딜" description="카카오 계정으로 에이전시 권한 신청" url="/agency/register/business" noindex />
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
              {existingStatus === 'active' ? t('agency.registerBusiness.alreadyActive', { defaultValue: '이미 에이전시 권한 활성화됨' }) : t('agency.registerBusiness.pending', { defaultValue: '승인 대기 중' })}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {existingStatus === 'active'
                ? t('agency.registerBusiness.activeDesc', { defaultValue: '에이전시 대시보드에서 소속 셀러를 관리하세요' })
                : t('agency.registerBusiness.pendingDesc', { defaultValue: '관리자 승인 후 에이전시 기능을 이용할 수 있어요' })}
            </p>
          </div>
          <button
            onClick={() => navigate(existingStatus === 'active' ? '/agency' : '/')}
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-sm">
            {existingStatus === 'active' ? t('agency.registerBusiness.goToDashboard', { defaultValue: '에이전시 대시보드로' }) : t('agency.registerBusiness.goHome', { defaultValue: '홈으로' })}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEO title="에이전시 가입 - 유어딜" description="카카오 계정으로 에이전시 권한 신청" url="/agency/register/business" noindex />

      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900 flex-1">{t('agency.registerBusiness.pageTitle', { defaultValue: '에이전시로 시작하기' })}</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {fromKakao && (
          <div className="bg-[#FEE500]/50 border border-[#FEE500] rounded-xl p-3 flex items-start gap-2">
            <MessageCircle className="w-4 h-4 text-[#3C1E1E] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-[#3C1E1E]">{t('agency.registerBusiness.kakaoDone', { defaultValue: '카카오 로그인 완료' })} {userName && <>· {userName}</>}</p>
              <p className="text-[11px] text-[#3C1E1E]/70 mt-0.5">{t('agency.registerBusiness.kakaoHint', { defaultValue: '아래 에이전시 정보만 입력하면 신청이 끝나요' })}</p>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-5 text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-white rounded-full flex items-center justify-center">
            <Briefcase className="w-7 h-7 text-purple-500" />
          </div>
          <h2 className="text-base font-bold text-gray-900">{t('agency.registerBusiness.formTitle', { defaultValue: '카카오 계정에 에이전시 권한 추가' })}</h2>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            {t('agency.registerBusiness.formDesc', { defaultValue: '현재 카카오 계정으로 에이전시 권한을 신청합니다. 별도 가입/로그인 없이 한 번에 연동돼요.' })}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 space-y-4 border border-gray-100">
          <Field label={t('agency.registerBusiness.labelAgencyName', { defaultValue: '에이전시명 / 회사명' })} required>
            <input value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="예: 유어딜 에이전시"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>

          <Field label={t('agency.registerBusiness.labelContactName', { defaultValue: '담당자명' })} required>
            <input value={form.contact_name}
              onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              placeholder="예: 홍길동"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>

          <Field label={t('agency.registerBusiness.labelPhone', { defaultValue: '연락처 (선택)' })}>
            <input type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>
        </div>

        <p className="text-[11px] text-gray-500 text-center leading-relaxed">
          {t('agency.registerBusiness.approvalNote', { defaultValue: '신청 후 관리자 승인까지 보통 1~2일 소요됩니다. 승인 완료 시 카카오 로그인으로 바로 에이전시 기능 이용 가능.' })}
        </p>

        <button onClick={submit} disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {loading ? t('agency.registerBusiness.submitting', { defaultValue: '신청 중...' }) : t('agency.registerBusiness.submitBtn', { defaultValue: '에이전시 신청하기' })}
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
