/**
 * 🏁 2026-07-02 (대표 "B — 단일 퍼널"): 유저 → 사업자 유저 전환의 **단일 관문**.
 *
 * 이전엔 진입점 5곳이 서로 다른 3개 가입 화면(레거시 별도계정 /seller/register ·
 * 막다른 /seller/register/business · 본 페이지)으로 흩어져 유저가 헷갈렸음 → 전부 여기로 통일.
 * 명칭 SSOT: "사업자 유저"(유저 + 사업자등록·판매승인) / 타겟 언어 "내 쇼핑몰".
 * 크리에이터(추천·커미션만)는 가입 불필요 — 상단 탈출구로 링크샵 안내(JoinChoice 모델).
 *
 * 흐름:
 *   1. 카카오 로그인 필수 — 미로그인 시 마운트에서 즉시 /login?returnUrl (제출 401 발견 X)
 *   2. 사업자 정보 입력 (국세청 진위확인용 대표자명+개업일 포함 — 일치 시 자동 승인)
 *   3. POST /api/seller/register-from-user, seller_type='store_owner' (같은 계정 업그레이드,
 *      linked_user_id 즉시 연결 + 큐레이터 프로필 승계)
 *   4. 'pending' → /seller/waiting (자동 갱신) → 승인 시 소비자 알림 + 대시보드 진입
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
    representative_name: '',     // 🛡️ 2026-05-27 (사용자 결정): 국세청 진위확인용
    business_start_date: '',     // 🛡️ 2026-05-27 (사용자 결정): YYYY-MM-DD
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
    // 🏁 2026-07-02 단일 퍼널: 로그인 게이트를 마운트로 — 폼 다 채운 뒤 401 로 발견하는 좌절 제거.
    //   토큰 존재 검사만(로그인 유도는 !token 으로만 — login-gate 룰). returnUrl 로 쿼리(?agency=) 보존.
    if (typeof window !== 'undefined' && !localStorage.getItem('user_id')) {
      navigate('/login?returnUrl=' + encodeURIComponent('/seller/register/supplier' + window.location.search), { replace: true })
      return
    }
    (async () => {
      try {
        const res = await api.get('/api/seller/my-seller-status')
        if (res.data?.success && res.data.data?.linked) {
          setExistingStatus(res.data.data.seller?.status || 'pending')
        }
      } catch { /* 상태조회 실패 — submit 시 재확인 */ }
      finally { setStatusChecked(true) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 🏁 2026-06-17 (#1 이중입력 제거): 크리에이터 콘솔에서 진입(?from=curator) 시 큐레이터 사업자
  //   정보(이미 입력한 상호/사업자번호)로 매장 등록 폼 자동채움 — 같은 정보 두 번 입력 방지.
  //   curator /me/business 는 representative/start_date 미저장 → 겹치는 2필드만. 빈 필드에만 채워
  //   사용자 입력 보존. 무인증/사업자정보 없으면 조용히 skip(매장 폼 그대로).
  // 🏁 2026-07-02 (에이전시 대리 등록): ?prospect=ID&pt=TOKEN — 에이전시가 미리 등록한 매장 정보로
  //   폼 자동완성(빈 필드만). 사장님은 확인·제출만. 배너로 "OO 에이전시가 준비" 명시(신뢰+투명).
  const prospectId = searchParams.get('prospect')
  const prospectPt = searchParams.get('pt')
  const [prospectIntro, setProspectIntro] = useState<string | null>(null)
  useEffect(() => {
    if (!prospectId || !prospectPt) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get(`/api/prospects/prefill/${encodeURIComponent(prospectId)}?pt=${encodeURIComponent(prospectPt)}`)
        const d = res.data?.data as { store_name?: string; contact_name?: string; contact_phone?: string; business_address?: string; introducer_name?: string } | undefined
        if (!d || cancelled) return
        setForm(f => ({
          ...f,
          business_name: f.business_name || (d.store_name || ''),
          representative_name: f.representative_name || (d.contact_name || ''),
          phone: f.phone || (d.contact_phone ? formatPhone(d.contact_phone) : ''),
          address: f.address || (d.business_address || ''),
        }))
        if (d.introducer_name) setProspectIntro(d.introducer_name)
      } catch { /* 무효 링크 — 빈 폼 그대로 */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId, prospectPt])

  const fromCurator = searchParams.get('from') === 'curator'
  useEffect(() => {
    if (!fromCurator) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get('/api/curator/me/business')
        const biz = res.data?.data as { business_name?: string; business_number?: string } | undefined
        if (!biz || cancelled) return
        setForm(f => ({
          ...f,
          business_name: f.business_name || (biz.business_name ? String(biz.business_name) : ''),
          business_number: f.business_number || (biz.business_number ? formatBusinessNumber(String(biz.business_number)) : ''),
        }))
      } catch { /* 사업자 정보 없음/미인증 — skip */ }
    })()
    return () => { cancelled = true }
  }, [fromCurator])

  async function submit() {
    if (!form.business_name.trim() || !form.business_number.trim() || !form.phone.trim() || !form.representative_name.trim() || !form.business_start_date) {
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
        representative_name: form.representative_name || undefined,
        business_start_date: form.business_start_date || undefined,
        phone: form.phone,
        seller_type: 'store_owner',
        description: descWithMeta,
        agency_intro_code: form.agency_intro_code.trim() || undefined,
      })
      if (res.data?.success) {
        toast.success(t('seller.gateway.applied', {
          defaultValue: '사업자 가입 신청 완료! 심사 상태 페이지로 이동합니다.',
        }))
        // 🏁 단일 퍼널: 신청 후 상태의 정본은 /seller/waiting (자동 갱신 + 승인 시 대시보드 자동 진입).
        navigate('/seller/waiting', { replace: true })
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
      <div className="force-light-theme min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      </div>
    )
  }

  if (existingStatus === 'pending' || existingStatus === 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <SEO title="사업자 유저 가입 - 유어딜" description="내 쇼핑몰 열기 — 사업자 인증" url="/seller/register/supplier" noindex />
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
              {existingStatus === 'active'
                ? t('seller.gateway.alreadyActive', { defaultValue: '이미 사업자 유저예요' })
                : t('seller.gateway.pendingTitle', { defaultValue: '승인 대기 중' })}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {existingStatus === 'active'
                ? t('seller.gateway.alreadyActiveDesc', { defaultValue: '셀러 대시보드로 바로 이동할 수 있습니다.' })
                : t('seller.gateway.pendingDesc', { defaultValue: '관리자가 검토 후 앱 알림·알림톡으로 안내드립니다 (1-2 영업일).' })}
            </p>
          </div>
          <button
            onClick={() => navigate(existingStatus === 'active' ? '/seller' : '/seller/waiting')}
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-sm">
            {existingStatus === 'active'
              ? t('seller.gateway.goDashboard', { defaultValue: '셀러 대시보드' })
              : t('seller.gateway.viewStatus', { defaultValue: '심사 상태 보기' })}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="force-light-theme min-h-screen bg-gray-50 pb-20">
      <SEO title="사업자 유저 가입 - 유어딜" description="내 쇼핑몰 열기 — 사업자 인증 후 상품·이용권 판매" url="/seller/register/supplier" noindex />

      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="p-1 -ml-1">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900 flex-1">{t('seller.gateway.title', { defaultValue: '사업자 유저 가입 — 내 쇼핑몰 열기' })}</h1>
        </div>
      </div>

      <div className="ur-content-narrow px-4 lg:px-8 py-4 lg:py-6 space-y-4">
        {userName && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900">
            <strong>{userName}</strong> {t('seller.gateway.kakaoBanner', { defaultValue: '카카오 계정에 판매 기능이 추가됩니다. 링크샵·구매내역은 그대로 유지돼요.' })}
          </div>
        )}

        {prospectIntro && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
            🤝 <strong>{prospectIntro}</strong>{t('seller.gateway.prospectBanner', { defaultValue: ' 에이전시가 매장 정보를 미리 준비했어요. 내용 확인 후 제출만 하면 됩니다.' })}
          </div>
        )}

        <div className="bg-gradient-to-br from-gray-50 to-gray-50 rounded-2xl p-5 text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-white rounded-full flex items-center justify-center">
            <Store className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">{t('seller.gateway.heroTitle', { defaultValue: '내 쇼핑몰에서 직접 판매하기' })}</h2>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            {t('seller.gateway.heroDesc', { defaultValue: '사업자 인증 한 번이면 내 링크샵이 진짜 쇼핑몰이 됩니다. 상품·이용권 등록 + 현금 정산 (플랫폼 수수료 기본 5%).' })}
          </p>
        </div>

        {/* 🏁 탈출구: 크리에이터(추천·커미션만)는 가입 불필요 — JoinChoice 모델과 동일 안내 */}
        <p className="text-[11px] text-gray-500 text-center">
          {t('seller.gateway.escape', { defaultValue: '상품 추천·커미션만 원하시나요? 가입 없이' })}{' '}
          <button onClick={() => navigate('/u/me')} className="font-bold text-emerald-700 underline underline-offset-2">
            {t('seller.gateway.escapeLink', { defaultValue: '내 링크샵' })}
          </button>
          {t('seller.gateway.escapeSuffix', { defaultValue: '에서 바로 시작할 수 있어요.' })}
        </p>

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

          {/* 🛡️ 2026-05-27 (사용자 결정): 국세청 진위확인 — 대표자 + 개업일 함께 입력 시 자동 승인 */}
          <Field label="대표자명" required>
            <input value={form.representative_name}
              onChange={e => setForm(f => ({ ...f, representative_name: e.target.value }))}
              maxLength={20}
              placeholder="예: 홍길동"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
            <p className="text-[11px] text-gray-500 mt-1">사업자등록증 기재 명의자</p>
          </Field>

          <Field label="개업일" required>
            <input type="date" value={form.business_start_date}
              onChange={e => setForm(f => ({ ...f, business_start_date: e.target.value }))}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
            <p className="text-[11px] text-gray-500 mt-1">국세청 등록 정보와 일치 시 자동 승인</p>
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
          {t('seller.gateway.reviewNote', { defaultValue: '신청 후 1-2 영업일 내 관리자 검토 → 앱 알림·알림톡으로 결과 안내. 국세청 정보 일치 시 자동 승인.' })}
          <br />
          {t('seller.gateway.reviewNote2', { defaultValue: '승인되면 셀러 대시보드에서 상품·이용권을 등록할 수 있어요.' })}
          <br />
          {/* 🏁 2026-07-02 (#3 2단계 심사 투명화): 정산 직전에야 벽을 만나던 것 → 가입 시점에 고지 */}
          {t('seller.gateway.secondGate', { defaultValue: '💳 현금 정산에는 승인 후 사업자등록증 인증 1회가 추가로 필요해요 (대시보드 → 사업자 정보).' })}
        </p>

        <button onClick={submit} disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-gray-800 to-gray-800 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
          {loading
            ? t('seller.gateway.submitting', { defaultValue: '신청 중...' })
            : t('seller.gateway.submit', { defaultValue: '사업자 가입 신청' })}
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
