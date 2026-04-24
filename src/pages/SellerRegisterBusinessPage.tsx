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
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { ChevronLeft, Loader2, Store, CheckCircle2 } from 'lucide-react'

export default function SellerRegisterBusinessPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [statusChecked, setStatusChecked] = useState(false)
  const [existingStatus, setExistingStatus] = useState<'none' | 'pending' | 'active' | 'suspended'>('none')
  const [form, setForm] = useState({
    business_name: '',
    business_number: '',
    phone: '',
    seller_type: 'influencer' as 'influencer' | 'store_owner' | 'both',
    youtube_email: '',
    description: '',
  })

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
      toast.error('필수 항목을 입력해주세요')
      return
    }
    if (!/^\d{3}-\d{2}-\d{5}$/.test(form.business_number)) {
      toast.error('사업자번호 형식: XXX-XX-XXXXX')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/api/seller/register-from-user', form)
      if (res.data?.success) {
        toast.success('셀러 전환 신청이 완료됐어요. 관리자 승인을 기다려주세요.')
        setExistingStatus('pending')
      } else {
        toast.error(res.data?.error || '신청 실패')
      }
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } }
      if (err.response?.status === 401) {
        toast.error('로그인이 필요합니다. 카카오 로그인 후 다시 시도해주세요.')
        navigate('/login?returnUrl=' + encodeURIComponent('/seller/register/business'))
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
              {existingStatus === 'active' ? '이미 셀러 권한이 활성화됨' : '승인 대기 중'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {existingStatus === 'active'
                ? '셀러 대시보드에서 방송을 시작하세요'
                : '관리자 승인 후 셀러 기능을 이용할 수 있어요'}
            </p>
          </div>
          <button
            onClick={() => navigate(existingStatus === 'active' ? '/seller' : '/')}
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-sm">
            {existingStatus === 'active' ? '셀러 대시보드로' : '홈으로'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEO title="셀러 전환 - 유어딜" description="카카오 계정으로 셀러 권한 신청" url="/seller/register/business" noindex />

      {/* 헤더 */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900 flex-1">셀러로 시작하기</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-5 text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-white rounded-full flex items-center justify-center">
            <Store className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-base font-bold text-gray-900">카카오 계정에 셀러 권한 추가</h2>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            현재 카카오 계정으로 셀러 권한을 신청합니다.<br />
            별도 가입/로그인 없이 한 번에 연동돼요.
          </p>
        </div>

        {/* 폼 */}
        <div className="bg-white rounded-2xl p-5 space-y-4 border border-gray-100">
          <Field label="사업자명 / 스토어명" required>
            <input value={form.business_name}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              placeholder="예: 유어딜 컴퍼니"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>

          <Field label="사업자등록번호" required>
            <input value={form.business_number}
              onChange={e => setForm(f => ({ ...f, business_number: e.target.value }))}
              placeholder="XXX-XX-XXXXX"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono" />
          </Field>

          <Field label="연락처" required>
            <input type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>

          <Field label="셀러 유형">
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'influencer', label: '인플루언서' },
                { key: 'store_owner', label: '스토어' },
                { key: 'both', label: '둘 다' },
              ].map(t => (
                <button key={t.key}
                  onClick={() => setForm(f => ({ ...f, seller_type: t.key as any }))}
                  className={`py-2 rounded-lg text-xs font-semibold border ${
                    form.seller_type === t.key
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="YouTube 이메일 (선택)">
            <input type="email" value={form.youtube_email}
              onChange={e => setForm(f => ({ ...f, youtube_email: e.target.value }))}
              placeholder="라이브 방송용 YouTube 계정"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>

          <Field label="소개 (선택)">
            <textarea value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="간단한 자기 소개" rows={2} maxLength={500}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none" />
          </Field>
        </div>

        <p className="text-[11px] text-gray-500 text-center leading-relaxed">
          신청 후 관리자 승인까지 보통 1~2일 소요됩니다.<br />
          승인 완료 시 카카오 로그인으로 바로 셀러 기능 이용 가능.
        </p>

        <button onClick={submit} disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-red-500 to-pink-500 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {loading ? '신청 중...' : '셀러 신청하기'}
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
