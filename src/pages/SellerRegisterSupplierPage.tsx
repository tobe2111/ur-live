/**
 * 🛡️ 2026-05-20: 공급자 (가게 사장님) 자체 onboarding 페이지.
 *
 * 기존 /seller/register/business 는 인플루언서 (라이브 송출자) 용.
 * 본 페이지는 매장 운영자 — 라이브 안 함, 상품/공구권만 등록 + 정산 받음.
 *
 * 흐름:
 *   1. 카카오 로그인 필수 (세션 쿠키 기반 — SellerRegisterBusinessPage 와 동일)
 *   2. 매장 정보 (가게명, 사업자번호, 연락처, 매장 카테고리, 주소) 입력
 *   3. POST /api/seller/register-from-user 에 seller_type='store_owner' 로 전송
 *   4. 'pending' 상태로 어드민 승인 대기 → 승인 시 /seller 진입 (라이브 메뉴 자동 숨김)
 *
 * 어드민 quick-register (handleStoreOwnerQuickAdd) 대신 셀프 가입 제공으로 확장성 ↑.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { ChevronLeft, Loader2, Store, CheckCircle2 } from 'lucide-react'

const STORE_CATEGORIES = [
  { value: 'restaurant', label: '음식점' },
  { value: 'cafe', label: '카페/베이커리' },
  { value: 'beauty', label: '뷰티/네일' },
  { value: 'fitness', label: '피트니스/요가' },
  { value: 'retail', label: '소매/매장' },
  { value: 'service', label: '서비스 (마사지/세탁 등)' },
  { value: 'stay', label: '숙박' },
  { value: 'etc', label: '기타' },
] as const

export default function SellerRegisterSupplierPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🛡️ 2026-05-20: 에이전시 가입 링크 (/seller/register/supplier?agency=AG-XXXXXXXX) 자동 prefill.
  const [searchParams] = useSearchParams()
  const agencyFromUrl = (searchParams.get('agency') || '').toUpperCase().slice(0, 12)
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user_name') : null
  const [loading, setLoading] = useState(false)
  const [statusChecked, setStatusChecked] = useState(false)
  const [existingStatus, setExistingStatus] = useState<'none' | 'pending' | 'active' | 'suspended'>('none')
  const [form, setForm] = useState({
    business_name: '',
    business_number: '',
    phone: '',
    store_category: '',
    address: '',
    description: '',
    // 🛡️ 2026-05-20: 에이전시 (입점 영업) 가 가게에 추천 코드 전달 → 가입 시 입력.
    //   서버는 agency_intro_code 로 에이전시 매칭 + sellers.introduced_by_agency_id 자동 채움.
    //   URL ?agency=AG-XXXXXXXX 가 있으면 useEffect 에서 자동 prefill.
    agency_intro_code: agencyFromUrl,
  })

  // URL query 변경 시 (drag-n-drop, copy 링크) prefill 갱신.
  useEffect(() => {
    if (agencyFromUrl && agencyFromUrl !== '') {
      setForm(f => f.agency_intro_code === agencyFromUrl ? f : { ...f, agency_intro_code: agencyFromUrl })
    }
  }, [agencyFromUrl])

  const formatBusinessNumber = (input: string) => {
    const d = input.replace(/\D/g, '').slice(0, 10)
    if (d.length <= 3) return d
    if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
    return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
  }
  const formatPhone = (input: string) => {
    const d = input.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/seller/my-seller-status')
        if (res.data?.success && res.data.data?.linked) {
          setExistingStatus(res.data.data.seller?.status || 'pending')
        }
      } catch { /* 미로그인 — submit 시 401 */ }
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
      // store_category/address 는 description 에 메타로 첨부 (DB 추가 컬럼 없이 운영 가능).
      //   추후 sellers 테이블에 store_category 컬럼 추가 시 raw 전송으로 변경.
      const descWithMeta = [
        form.store_category && `[카테고리: ${STORE_CATEGORIES.find(c => c.value === form.store_category)?.label || form.store_category}]`,
        form.address && `[주소: ${form.address}]`,
        form.description,
      ].filter(Boolean).join('\n')

      const res = await api.post('/api/seller/register-from-user', {
        business_name: form.business_name,
        business_number: form.business_number,
        phone: form.phone,
        seller_type: 'store_owner',
        description: descWithMeta,
        agency_intro_code: form.agency_intro_code.trim() || undefined,
      })
      if (res.data?.success) {
        toast.success(t('supplier.applied', {
          defaultValue: '공급자 가입 신청 완료. 관리자 승인을 기다려주세요.',
        }))
        setExistingStatus('pending')
      } else {
        const rawErr = res.data?.error as string | { message?: string } | undefined
        const errMsg = typeof rawErr === 'string' ? rawErr : (rawErr?.message || '신청 실패')
        toast.error(errMsg)
      }
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string | { message?: string } } } }
      if (err.response?.status === 401 || err.response?.status === 403) {
        toast.error(t('seller.register.loginRequired', { defaultValue: '로그인이 필요합니다. 카카오 로그인 후 다시 시도해주세요.' }))
        navigate('/login?returnUrl=' + encodeURIComponent('/seller/register/supplier'))
        return
      }
      const rawErr = err.response?.data?.error
      const errMsg = typeof rawErr === 'string' ? rawErr : (typeof rawErr === 'object' && rawErr?.message) ? rawErr.message : '신청 실패'
      toast.error(errMsg)
    } finally { setLoading(false) }
  }

  if (!statusChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      </div>
    )
  }

  if (existingStatus === 'pending' || existingStatus === 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <SEO title="공급자 가입 - 유어딜" description="가게 사장님 자체 가입" url="/seller/register/supplier" noindex />
        <div className="bg-white rounded-2xl ur-content-narrow w-full p-6 text-center space-y-4 shadow-sm">
          <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
            existingStatus === 'active' ? 'bg-emerald-100' : 'bg-amber-100'
          }`}>
            {existingStatus === 'active'
              ? <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              : <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {existingStatus === 'active' ? '이미 활성 셀러' : '승인 대기 중'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {existingStatus === 'active'
                ? '셀러 대시보드로 바로 이동할 수 있습니다.'
                : '관리자가 검토 후 알림톡으로 안내드립니다 (1-2 영업일).'}
            </p>
          </div>
          <button
            onClick={() => navigate(existingStatus === 'active' ? '/seller' : '/')}
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-sm">
            {existingStatus === 'active' ? '셀러 대시보드' : '홈으로'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEO title="공급자 가입 - 유어딜" description="가게 사장님 자체 가입 — 공동구매 제휴" url="/seller/register/supplier" noindex />

      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900 flex-1">공급자 가입 (가게 사장님)</h1>
        </div>
      </div>

      <div className="ur-content-narrow px-4 lg:px-8 py-4 lg:py-6 space-y-4">
        {userName && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900">
            <strong>{userName}</strong> 카카오 계정으로 가입합니다. 다른 계정이면 먼저 로그아웃 후 진행하세요.
          </div>
        )}

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-white rounded-full flex items-center justify-center">
            <Store className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">매장 공동구매 시작하기</h2>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            라이브 방송 없이도 OK. 공구권을 발행하면 인플루언서가 자동 추천 + 손님 모객 → 매출 ↑
            <br />
            플랫폼 수수료 5% (기본) — 인플 수수료 별도 협상.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 space-y-4 border border-gray-100">
          <Field label="가게명" required>
            <input value={form.business_name}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              placeholder="예: 홍대 매운돈까스"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>

          <Field label="사업자번호" required>
            <input value={form.business_number}
              onChange={e => setForm(f => ({ ...f, business_number: formatBusinessNumber(e.target.value) }))}
              inputMode="numeric"
              maxLength={12}
              placeholder="000-00-00000"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono" />
          </Field>

          <Field label="연락처 (담당자 휴대폰)" required>
            <input type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
              inputMode="numeric"
              maxLength={13}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>

          <Field label="매장 카테고리">
            <select value={form.store_category}
              onChange={e => setForm(f => ({ ...f, store_category: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white">
              <option value="">선택해주세요</option>
              {STORE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="매장 주소">
            <input value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="예: 서울 마포구 양화로 162"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </Field>

          <Field label="매장 소개 (선택)">
            <textarea value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="매장 분위기, 대표 메뉴, 운영 시간 등"
              rows={3} maxLength={500}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none" />
          </Field>

          {/* 🛡️ 2026-05-20: 에이전시 추천 코드 — 입점 영업 에이전시가 가게에 알려준 코드.
              URL query 로 자동 prefill 시 emerald 배지로 시각 강조. */}
          <Field label={
            agencyFromUrl
              ? '에이전시 추천 코드 ✓ 자동 입력됨'
              : '에이전시 추천 코드 (선택)'
          }>
            <input value={form.agency_intro_code}
              onChange={e => setForm(f => ({ ...f, agency_intro_code: e.target.value.toUpperCase().slice(0, 12) }))}
              placeholder="예: AG-A8K3F1 (없으면 비워두세요)"
              className={`w-full px-3 py-2.5 border rounded-lg text-sm text-gray-900 font-mono uppercase ${
                agencyFromUrl
                  ? 'bg-emerald-50 border-emerald-300 focus:border-emerald-500'
                  : 'border-gray-300'
              }`} />
            <p className="text-[10px] mt-1">
              {agencyFromUrl ? (
                <span className="text-emerald-600 font-bold">
                  ✓ 추천 링크로 들어오셨어요. 에이전시 코드가 자동 입력됐습니다.
                </span>
              ) : (
                <span className="text-gray-500">
                  영업 에이전시가 직접 추천해서 가입하시는 경우만 입력하세요.
                </span>
              )}
            </p>
          </Field>
        </div>

        <p className="text-[11px] text-gray-500 text-center leading-relaxed">
          신청 후 1-2 영업일 내 관리자가 검토 → 알림톡으로 결과 안내.
          <br />
          승인 시 셀러 대시보드 (/seller) 에서 상품/공구권 등록 가능.
        </p>

        <button onClick={submit} disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
          {loading ? '신청 중...' : '공급자 가입 신청'}
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
