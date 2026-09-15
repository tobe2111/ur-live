/**
 * 🏁 2026-07-02 (대표 "B — 단일 퍼널"): 유저 → 사업자 유저 전환의 **단일 관문**.
 *
 * 이전엔 진입점 5곳이 서로 다른 3개 가입 화면(레거시 별도계정 /seller/register ·
 * 막다른 /seller/register/business · 본 페이지)으로 흩어져 유저가 헷갈렸음 → 전부 여기로 통일.
 * 명칭 SSOT: "사업자 유저"(유저 + 사업자등록·판매승인) / 타겟 언어 "내 유어샵".
 * 크리에이터(추천·커미션만)는 가입 불필요 — 상단 탈출구로 유어샵 안내(JoinChoice 모델).
 *
 * 흐름:
 *   1. 카카오 로그인 필수 — 미로그인 시 마운트에서 즉시 /login?returnUrl (제출 401 발견 X)
 *   2. 사업자 정보 입력 (국세청 진위확인용 대표자명+개업일 포함 — 일치 시 자동 승인)
 *   3. POST /api/seller/register-from-user, seller_type='store_owner' (같은 계정 업그레이드,
 *      linked_user_id 즉시 연결 + 큐레이터 프로필 승계)
 *   4. 'pending' → /seller/waiting (자동 갱신) → 승인 시 소비자 알림 + 대시보드 진입
 *
 * 📱 2026-09-15 개편 (대표 *"여기도 개편해야 해. 셀러 계정을 만드는 부분이니까 가장 중요해"*):
 *   - 티켓 카드(블루 밴드)로 **3단계 중 어디인지** 먼저 보여 준다(정보 입력 → 심사 → 판매 시작).
 *   - 폼을 두 카드로 나눴다: [사업자 정보 = 국세청 확인용 3칸] / [가게 정보]. 사장님이 사업자등록증을 꺼내 드는 순간이 한 번이다.
 *   - 입력 44px·16px(iOS 확대 방지) · 카테고리 칩 · 오류는 칸 밑 + 첫 오류 칸으로 포커스 · 하단 고정 제출 바(필수 N/5).
 *   - 이모지 0 · 색깔 정보상자 0 · 초록(emerald) 0 — 🎫 규칙 ⑥. 제출 payload·prefill·라우팅은 종전과 **byte-동일**.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { ChevronLeft, Loader2, CheckCircle2, Handshake, UserRound } from 'lucide-react'
import TermsConsentBox from '@/components/terms/TermsConsentBox'
import BrandLoader from '@/components/brand/BrandLoader'
import { TicketCard } from '@/components/ticket/TicketCard'
import { TERMS_CURRENT_VERSION } from './terms/terms-types'
import {
  STORE_CATEGORIES, INPUT, INPUT_BAD, Field, ChipGroup, formatBusinessNumber, formatPhone,
  validateSignup, filledRequired, type SignupForm, type SignupErrors,
} from './seller-register/RegisterFields'

export default function SellerRegisterSupplierPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🌇 2026-09-05 에이전시 일몰 — `?agency=AG-XXXXXXXX` 자동 prefill + 추천코드 입력칸 삭제.
  //   코드를 발급하던 대시보드·초대 링크가 전부 없어져 **아무도 채울 수 없는 칸**이 남아 있었고,
  //   그 값이 요금(직접 10% / 중개 5%)을 갈랐다. 이 문은 이제 언제나 직접 입점이다.
  const [searchParams] = useSearchParams()
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user_name') : null
  const [loading, setLoading] = useState(false)
  // 📜 2026-07-05 판매자 이용약관 v1.0: 가입 시 동의 필수
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [statusChecked, setStatusChecked] = useState(false)
  const [existingStatus, setExistingStatus] = useState<'none' | 'pending' | 'active' | 'suspended'>('none')
  const [errors, setErrors] = useState<SignupErrors>({})
  const [form, setForm] = useState<SignupForm>({
    business_name: '',
    business_number: '',
    representative_name: '',     // 🛡️ 2026-05-27 (사용자 결정): 국세청 진위확인용
    business_start_date: '',     // 🛡️ 2026-05-27 (사용자 결정): YYYY-MM-DD
    phone: '',
    store_category: '',
    address: '',
    description: '',
  })
  const set = <K extends keyof SignupForm>(k: K) => (v: SignupForm[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }))
  }
  const termsRef = useRef<HTMLDivElement>(null)

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

  // 🏁 2026-06-17 (#1 이중입력 제거): 소개 콘솔에서 진입(?from=curator) 시 큐레이터 사업자
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
    // 📱 오류는 칸 밑에 적고 첫 오류 칸으로 간다 — 토스트 한 줄로는 어느 칸인지 모른다.
    const errs = validateSignup(form)
    setErrors(errs)
    const first = (Object.keys(errs) as (keyof SignupForm)[]).find(k => errs[k])
    if (first) {
      const el = document.getElementById(`f-${first}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      ;(el as HTMLElement | null)?.focus?.()
      return
    }
    if (!termsAgreed) {
      toast.error(t('seller.gateway.termsRequired', { defaultValue: '판매자 이용약관에 동의해주세요' }))
      termsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
        terms_agreed_version: TERMS_CURRENT_VERSION,
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
    return <div className="force-light-theme"><BrandLoader fullScreen forceLight /></div>
  }

  if (existingStatus === 'pending' || existingStatus === 'active') {
    const active = existingStatus === 'active'
    return (
      <div className="force-light-theme flex min-h-[100dvh] items-center justify-center bg-warm p-4">
        <SEO title="사업자 유저 가입 - 유어딜" description="사업자 인증 — 내 상품·이용권 판매" url="/seller/register/supplier" noindex />
        <TicketCard
          className="w-full max-w-[480px]"
          bandLeft={active ? t('seller.signup.bandActive', { defaultValue: '사업자 유저' }) : t('seller.signup.bandPending', { defaultValue: '심사 중' })}
          bandRight={active ? '3 / 3' : '2 / 3'}
        >
          <div className="p-6 text-center">
            {active
              ? <CheckCircle2 className="mx-auto h-10 w-10 text-brand-text" />
              : <Loader2 className="mx-auto h-10 w-10 animate-spin text-gray-400" />}
            <h2 className="mt-3 text-[18px] font-extrabold text-gray-900">
              {active
                ? t('seller.gateway.alreadyActive', { defaultValue: '이미 사업자 유저예요' })
                : t('seller.gateway.pendingTitle', { defaultValue: '승인 대기 중' })}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
              {active
                ? t('seller.gateway.alreadyActiveDesc', { defaultValue: '셀러 대시보드로 바로 이동할 수 있습니다.' })
                : t('seller.gateway.pendingDesc', { defaultValue: '관리자가 검토 후 앱 알림·알림톡으로 안내드립니다 (1-2 영업일).' })}
            </p>
            <button onClick={() => navigate(active ? '/seller' : '/seller/waiting')} className="ur-btn ur-btn-lg ur-btn-primary mt-5 w-full">
              {active
                ? t('seller.gateway.goDashboard', { defaultValue: '셀러 대시보드' })
                : t('seller.gateway.viewStatus', { defaultValue: '심사 상태 보기' })}
            </button>
          </div>
        </TicketCard>
      </div>
    )
  }

  const filled = filledRequired(form)
  const cls = (k: keyof SignupForm) => `${INPUT} ${errors[k] ? INPUT_BAD : ''}`
  const steps = [
    { n: 1, label: t('seller.signup.step1', { defaultValue: '정보 입력' }), sub: t('seller.signup.step1Sub', { defaultValue: '지금 이 화면' }) },
    { n: 2, label: t('seller.signup.step2', { defaultValue: '심사' }), sub: t('seller.signup.step2Sub', { defaultValue: '국세청 정보와 일치하면 바로, 아니면 1~2 영업일' }) },
    { n: 3, label: t('seller.signup.step3', { defaultValue: '판매 시작' }), sub: t('seller.signup.step3Sub', { defaultValue: '승인 알림 후 셀러 대시보드에서 이용권 등록' }) },
  ]

  return (
    <div className="force-light-theme min-h-[100dvh] bg-warm" style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}>
      <SEO title="사업자 유저 가입 - 유어딜" description="사업자 인증 후 내 상품·이용권 판매" url="/seller/register/supplier" noindex />

      <div className="sticky top-0 z-20 border-b border-rule bg-white">
        <div className="mx-auto flex h-12 max-w-[560px] items-center gap-2 px-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 truncate text-[15px] font-bold text-gray-900">{t('seller.signup.title', { defaultValue: '사업자 유저 가입' })}</h1>
          <span className="dash-num text-[12px] font-semibold text-gray-400">1 / 3</span>
        </div>
      </div>

      <div className="mx-auto max-w-[560px] space-y-3 px-3 py-3 sm:px-4 sm:py-5">
        {/* 계정 한 줄 — 색깔 상자 대신 흰 카드. 누구 계정에 붙는지 한 번만. */}
        {userName && (
          <div className="flex items-center gap-3 rounded-[var(--dash-radius,16px)] border border-rule bg-white px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-text"><UserRound size={18} /></span>
            <p className="min-w-0 text-[13px] leading-snug text-gray-600">
              <strong className="text-gray-900">{userName}</strong> {t('seller.gateway.kakaoBanner', { defaultValue: '카카오 계정에 판매 기능이 추가됩니다. 유어샵·구매내역은 그대로 유지돼요.' })}
            </p>
          </div>
        )}

        {prospectIntro && (
          <div className="flex items-center gap-3 rounded-[var(--dash-radius,16px)] border border-rule bg-white px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"><Handshake size={18} /></span>
            <p className="min-w-0 text-[13px] leading-snug text-gray-600"><strong className="text-gray-900">{prospectIntro}</strong>{t('seller.gateway.prospectBanner', { defaultValue: ' 에이전시가 매장 정보를 미리 준비했어요. 내용 확인 후 제출만 하면 됩니다.' })}</p>
          </div>
        )}

        {/* 🎫 티켓 — 어디까지 왔는지. 밴드 하나가 강조색을 다 맡는다. */}
        <TicketCard bandLeft={t('seller.signup.band', { defaultValue: '내 가게 등록' })} bandRight={t('seller.signup.bandStep', { defaultValue: '1단계 / 3' })}>
          <div className="p-4 sm:p-5">
            <h2 className="text-[18px] font-extrabold leading-snug text-gray-900">{t('seller.signup.heroTitle', { defaultValue: '가게를 등록하면 내 유어샵에서 이용권을 팔 수 있어요' })}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-gray-500">{t('seller.signup.heroDesc', { defaultValue: '판매 대금은 매주 자동으로 계좌에 정산돼요. 사업자등록증 한 장이면 3분이면 끝나요.' })}</p>
            <ol className="mt-4 space-y-2.5">
              {steps.map((s) => (
                <li key={s.n} className="flex items-start gap-3">
                  <span className={`dash-num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${s.n === 1 ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}>{s.n}</span>
                  <span className="min-w-0">
                    <span className={`block text-[13.5px] font-bold ${s.n === 1 ? 'text-gray-900' : 'text-gray-600'}`}>{s.label}</span>
                    <span className="block text-[12px] text-gray-500">{s.sub}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </TicketCard>

        {/* 🏁 탈출구: 크리에이터(추천·커미션만)는 가입 불필요 — JoinChoice 모델과 동일 안내 */}
        <p className="px-1 text-center text-[12px] text-gray-500">
          {t('seller.gateway.escape', { defaultValue: '상품 추천·커미션만 원하시나요? 가입 없이' })}{' '}
          <button onClick={() => navigate('/u/me')} className="font-bold text-brand-text underline underline-offset-2">
            {t('seller.gateway.escapeLink', { defaultValue: '내 유어샵' })}
          </button>
          {t('seller.gateway.escapeSuffix', { defaultValue: '에서 바로 시작할 수 있어요.' })}
        </p>

        {/* 카드 1 — 국세청 확인용 3칸. 사업자등록증을 꺼내는 순간이 한 번이게 묶는다. */}
        <section className="rounded-[var(--dash-radius,16px)] border border-rule bg-white p-4 sm:p-5">
          <h3 className="text-[15px] font-extrabold text-gray-900">{t('seller.signup.bizSection', { defaultValue: '사업자 정보' })}</h3>
          <p className="mt-0.5 text-[12.5px] text-gray-500">{t('seller.signup.bizSectionSub', { defaultValue: '사업자등록증에 적힌 그대로. 국세청 정보와 일치하면 심사 없이 바로 승인돼요.' })}</p>
          <div className="mt-4 space-y-4">
            <Field id="f-business_number" label="사업자번호" required error={errors.business_number}>
              <input id="f-business_number" value={form.business_number}
                onChange={e => set('business_number')(formatBusinessNumber(e.target.value))}
                inputMode="numeric" autoComplete="off" maxLength={12} placeholder="000-00-00000"
                aria-invalid={!!errors.business_number}
                className={`${cls('business_number')} dash-num`} />
            </Field>
            {/* 🛡️ 2026-05-27 (사용자 결정): 국세청 진위확인 — 대표자 + 개업일 함께 입력 시 자동 승인 */}
            <Field id="f-representative_name" label="대표자명" required hint="사업자등록증 기재 명의자" error={errors.representative_name}>
              <input id="f-representative_name" value={form.representative_name}
                onChange={e => set('representative_name')(e.target.value)}
                maxLength={20} placeholder="예: 홍길동" autoComplete="name"
                aria-invalid={!!errors.representative_name}
                className={cls('representative_name')} />
            </Field>
            <Field id="f-business_start_date" label="개업일" required hint="사업자등록증의 개업연월일" error={errors.business_start_date}>
              <input id="f-business_start_date" type="date" value={form.business_start_date}
                onChange={e => set('business_start_date')(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                aria-invalid={!!errors.business_start_date}
                className={cls('business_start_date')} />
            </Field>
          </div>
        </section>

        {/* 카드 2 — 손님이 보는 가게 정보 */}
        <section className="rounded-[var(--dash-radius,16px)] border border-rule bg-white p-4 sm:p-5">
          <h3 className="text-[15px] font-extrabold text-gray-900">{t('seller.signup.storeSection', { defaultValue: '가게 정보' })}</h3>
          <p className="mt-0.5 text-[12.5px] text-gray-500">{t('seller.signup.storeSectionSub', { defaultValue: '유어샵과 이용권에 그대로 보여요. 나중에 대시보드에서 바꿀 수 있어요.' })}</p>
          <div className="mt-4 space-y-4">
            <Field id="f-business_name" label="가게명" required error={errors.business_name}>
              <input id="f-business_name" value={form.business_name}
                onChange={e => set('business_name')(e.target.value)}
                placeholder="예: 홍대 매운돈까스" autoComplete="organization"
                aria-invalid={!!errors.business_name}
                className={cls('business_name')} />
            </Field>
            <Field id="f-phone" label="연락처 (담당자 휴대폰)" required hint="주문·정산 알림톡을 받는 번호" error={errors.phone}>
              <input id="f-phone" type="tel" value={form.phone}
                onChange={e => set('phone')(formatPhone(e.target.value))}
                inputMode="numeric" autoComplete="tel" maxLength={13} placeholder="010-1234-5678"
                aria-invalid={!!errors.phone}
                className={`${cls('phone')} dash-num`} />
            </Field>
            <Field id="f-store_category" label="매장 종류">
              <ChipGroup name="매장 종류" value={form.store_category} onChange={set('store_category')} options={STORE_CATEGORIES} />
            </Field>
            <Field id="f-address" label="매장 주소">
              <input id="f-address" value={form.address}
                onChange={e => set('address')(e.target.value)}
                placeholder="예: 서울 마포구 양화로 162" autoComplete="street-address"
                className={cls('address')} />
            </Field>
            <Field id="f-description" label="매장 소개 (선택)">
              <textarea id="f-description" value={form.description}
                onChange={e => set('description')(e.target.value)}
                placeholder="매장 분위기, 대표 메뉴, 운영 시간 등"
                rows={3} maxLength={500}
                className={`${INPUT} h-auto resize-none py-2.5`} />
            </Field>
          </div>
        </section>

        <div ref={termsRef}>
          <TermsConsentBox
            termsLabel={t('seller.gateway.termsAgree', { defaultValue: '유어딜 판매자 이용약관(v1.0)에 동의합니다' })}
            termsPath="/terms/seller"
            agreed={termsAgreed}
            onAgreedChange={setTermsAgreed}
          />
        </div>

        <ul className="space-y-1 px-1 text-[12px] leading-relaxed text-gray-500">
          <li>{t('seller.signup.note1', { defaultValue: '결과는 앱 알림과 알림톡으로 알려드려요. 국세청 정보와 일치하면 바로 승인돼요.' })}</li>
          {/* 🏁 2026-07-02 (#3 2단계 심사 투명화): 정산 직전에야 벽을 만나던 것 → 가입 시점에 고지 */}
          <li>{t('seller.signup.note2', { defaultValue: '현금 정산에는 승인 뒤 사업자등록증 사진 인증이 한 번 더 필요해요 (대시보드 › 사업자 정보).' })}</li>
        </ul>
      </div>

      {/* 📱 하단 고정 제출 바 — 엄지 자리. 필수 5칸 진행을 같이 보여 준다. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto flex max-w-[560px] items-center gap-3 px-3 py-3 sm:px-4">
          <p className="hidden shrink-0 text-[12px] text-gray-500 sm:block">
            {t('seller.signup.progress', { defaultValue: '필수 {{filled}} / 5', filled })}
          </p>
          <button onClick={submit} disabled={loading}
            className="ur-btn ur-btn-lg ur-btn-primary w-full disabled:opacity-50">
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {loading
              ? t('seller.gateway.submitting', { defaultValue: '신청 중...' })
              : filled < 5
                ? t('seller.signup.submitProgress', { defaultValue: '가입 신청 (필수 {{filled}}/5)', filled })
                : t('seller.signup.submit', { defaultValue: '가입 신청하기' })}
          </button>
        </div>
      </div>
    </div>
  )
}
