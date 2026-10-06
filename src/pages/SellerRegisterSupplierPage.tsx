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
 * 🏪 2026-09-21 **안 B "가게부터"** (대표 *"응 안 B로 하는데"*):
 *   지도에서 가게를 고르면 상호·주소·전화·업종·좌표·place_id 가 **한 번에** 들어온다.
 *   종전엔 `AddressPickerField` 가 그 여덟 중 **주소 문자열 하나만** 꺼내고 일곱을 버려서,
 *   사장님이 방금 고른 가게의 상호를 바로 위 칸에 손으로 다시 쳤다(그리고 그 주소마저
 *   `description` 안 `[주소: …]` 텍스트로만 남아 **읽는 코드가 0건**이었다 — 라이브 실측).
 *   ⇒ 고르면 [가게명]·[매장 종류]·[매장 주소] 세 칸이 **카드 한 장**이 되고, 남는 칸은
 *     사업자 정보 3칸(등록증 사진이 채운다)과 담당자 연락처뿐이다.
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
import BusinessCertUpload from '@/components/BusinessCertUpload'
import type { OcrPrefill } from '@/shared/ocr-prefill'
import AddressPickerField from './seller-register/AddressPickerField'
import StoreSection from './seller-register/StoreSection'
import { storeCategoryFromKakao, type PickedStore } from '@/shared/store-place'
import ReviewSheet, { type ReviewRow } from './seller-register/ReviewSheet'
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
  // 🪪 2026-09-16 앞문 등록증 사본 — **선택**(대표 *"복잡해서도 안되긴 하는데"*).
  //   국세청은 번호·대표자·개업일만 확인하므로 **상호·주소가 진짜인지는 사람이 사진과 대조**해야 한다.
  //   그런데 여기서 막을 이유가 없다: 승인 전엔 어차피 못 판다(`status='pending'`) + 사후 업로드
  //   경로가 이미 있다(`POST /api/seller/settlements/business-registration/submit`).
  //   ⇒ 막는 대신 **가장 좋은 순간에 권한다** — 지금 사장님은 등록증을 손에 들고 번호를 옮겨 적는 중이다.
  const [certUrl, setCertUrl] = useState('')
  // 🔍 2026-09-16 (대표 참고 시안 ⑤) — 등록증 사진에서 **읽어서 채운 칸**의 이름.
  //   한 곳에 모아 두는 이유: ① 그 칸에 "사진에서" 라고 표시해 사장님이 꼭 확인하게 하고
  //   ② 제출 전 확인 시트가 무엇이 자동인지 말할 수 있다. 값 자체는 평범한 `form` 이라
  //   사장님이 고치는 순간 그냥 사장님 값이 된다(아래 `set` 이 이 집합에서 빼 준다).
  const [autoFilled, setAutoFilled] = useState<Set<keyof SignupForm>>(new Set())
  // 🏪 지도에서 고른 가게. 있으면 상호·주소·업종은 **묻는 것이 아니라 확인하는 것**이라
  //   입력 칸 대신 카드로 보여 준다. 좌표·place_id 는 화면에 안 보이지만 제출 payload 로 간다.
  const [place, setPlace] = useState<PickedStore | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
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
    // 사장님이 손을 댄 칸은 더 이상 '사진에서' 가 아니다
    setAutoFilled(prev => {
      if (!prev.has(k)) return prev
      const next = new Set(prev); next.delete(k); return next
    })
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

  /**
   * 🔍 2026-09-16 (대표 참고 시안 ⑤ *"정보를 확인해 주세요"*) — 등록증 사진에서 읽은 값으로 폼을 채운다.
   *
   * ⚠️ **빈 칸에만 채운다.** 사장님이 이미 친 값을 덮으면, 모델이 잘못 읽은 순간
   * 사장님이 고쳐 놓은 걸 되돌리는 셈이다(그리고 아무도 그 사실을 모른다).
   * 같은 이유로 `?prospect=` 대리 등록 prefill 도 빈 칸만 채운다 — 규칙이 하나다.
   *
   * ⚠️ 읽었다고 **맞는 게 아니다**(`fill` 은 정확도가 아니라 충실도다). 그래서 채운 칸에
   * '사진에서' 딱지를 남기고, 제출 직전 확인 시트가 글자로 한 번 더 보여 준다.
   */
  function applyOcr(ocr: OcrPrefill) {
    const touched: (keyof SignupForm)[] = []
    setForm(f => {
      const next = { ...f }
      const put = <K extends keyof SignupForm>(k: K, v: string) => {
        if (!v || String(next[k]).trim()) return
        next[k] = v as SignupForm[K]
        touched.push(k)
      }
      put('business_number', ocr.bizNumber ? formatBusinessNumber(ocr.bizNumber) : '')
      put('representative_name', ocr.ownerName || '')
      // YYYYMMDD → YYYY-MM-DD (`<input type="date">` 가 받는 유일한 모양)
      put('business_start_date', ocr.permitDate && /^\d{8}$/.test(ocr.permitDate)
        ? `${ocr.permitDate.slice(0, 4)}-${ocr.permitDate.slice(4, 6)}-${ocr.permitDate.slice(6, 8)}` : '')
      put('business_name', ocr.bizName || '')
      put('address', ocr.address || '')
      return next
    })
    if (touched.length === 0) {
      toast.success(t('seller.signup.ocrNone', { defaultValue: '사업자등록증이 업로드됐어요' }))
      return
    }
    setAutoFilled(prev => { const n = new Set(prev); touched.forEach(k => n.add(k)); return n })
    setErrors(e => { const n = { ...e }; touched.forEach(k => { n[k] = undefined }); return n })
    toast.success(t('seller.signup.ocrFilled', { defaultValue: '{{n}}칸을 사진에서 채웠어요 — 맞는지 확인해 주세요', n: touched.length }))
  }

  /**
   * 🏪 지도에서 가게를 고르면 — 또는 지도 없이 주소만 치면 — 여기로 온다.
   *
   * ⚠️ 상호는 **지도값이 이긴다**(빈 칸일 때만 채우지 않는다). 사장님이 보고 있는 것은 방금 고른
   *   카드이고, 그 카드와 제출값이 다르면 아무도 그 사실을 모른다. 등록증 OCR 이 읽은 상호가
   *   있더라도 마찬가지다 — 등록증의 법인명과 간판 이름은 흔히 다르고, **손님에게 보이는 이름**은
   *   간판 쪽이다. 그래서 `autoFilled` 에서도 빼 준다(더 이상 '사진에서' 가 아니다).
   * ⚠️ 매장 종류는 **빈 칸일 때만** 채운다 — 사장님이 칩을 골라 뒀다면 그게 더 정확하다.
   */
  function pickStore(address: string, p?: PickedStore) {
    if (!p) { set('address')(address); return }
    setPlace(p)
    setForm(f => ({
      ...f,
      address: p.address || f.address,
      business_name: p.name || f.business_name,
      store_category: f.store_category || storeCategoryFromKakao(p.category),
    }))
    setErrors(e => ({ ...e, business_name: undefined, address: undefined }))
    setAutoFilled(prev => {
      if (!prev.has('business_name')) return prev
      const next = new Set(prev); next.delete('business_name'); return next
    })
  }

  /** 제출 버튼 — 보내기 전에 검사하고, 통과하면 **확인 시트**를 연다(시안 ④). */
  function review() {
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
    setReviewOpen(true)
  }

  async function submit() {
    setLoading(true)
    try {
      // 🏪 2026-09-21 (안 B) — 종전엔 주소·카테고리를 `description` 안에 `[주소: …]` **텍스트**로
      //   밀어 넣었다. 그 문자열을 **읽는 코드가 레포 전체에 0건**이었고(라이브 실측: 셀러 전원
      //   `description` 비어 있음), 그래서 가입 문으로 들어온 가게는 지도에 뜨지도 않았다.
      //   ⇒ 이제 제 자리로 보낸다: 주소는 `sellers.address`, 좌표·업종·place_id 는 `seller_meta`
      //     (매장 등록 문이 쓰는 키와 **같은 이름**). `description` 은 매장 소개 그대로.
      const res = await api.post('/api/seller/register-from-user', {
        business_name: form.business_name,
        business_number: form.business_number,
        representative_name: form.representative_name || undefined,
        business_start_date: form.business_start_date || undefined,
        phone: form.phone,
        seller_type: 'store_owner',
        description: form.description || undefined,
        address: form.address || undefined,
        store_category: form.store_category || undefined,
        ...(place ? {
          store_phone: place.phone || undefined,
          kakao_place_id: place.placeId || undefined,
          kakao_place_url: place.placeUrl || undefined,
          kakao_category: place.category || undefined,
          lat: place.lat || undefined,
          lng: place.lng || undefined,
        } : {}),
        business_cert_url: certUrl || undefined,
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
  // 🎨 시안 C — 묶음별 진행. 채운 값이 굵게 보이는 것과 같은 정보를 숫자로 한 번 더 준다.
  //   `filledRequired` 와 같은 5칸을 쪼갠 것이라 합이 항상 `filled` 와 맞는다(따로 세지 않는다).
  const bizDone = [form.business_number, form.representative_name, form.business_start_date].filter(v => v.trim()).length
  const storeDone = [form.business_name, form.phone].filter(v => v.trim()).length
  // 🔍 사진에서 채운 칸은 **원래 힌트 대신** 확인을 요청한다. 딱지를 따로 그리지 않는 이유는
  //   힌트 자리가 이미 그 칸 밑이고, 배지를 하나 더 얹으면 칸마다 요소가 늘어난다(시각 C 는 밀도를 지킨다).
  const hint = (k: keyof SignupForm, base?: string) =>
    autoFilled.has(k) ? t('seller.signup.fromPhoto', { defaultValue: '사진에서 읽었어요 — 맞는지 확인해 주세요' }) : base
  const reviewRows: ReviewRow[] = [
    { label: '사업자번호', value: form.business_number },
    { label: '대표자명', value: form.representative_name },
    { label: '개업일', value: form.business_start_date },
    { label: '가게명', value: form.business_name },
    { label: '연락처', value: form.phone },
    { label: '매장 종류', value: STORE_CATEGORIES.find(c => c.value === form.store_category)?.label || '', muted: !form.store_category },
    { label: '매장 주소', value: form.address, muted: !form.address },
    ...(place?.phone ? [{ label: '가게 전화', value: place.phone }] : []),
    ...(certUrl ? [{ label: '사업자등록증', value: '첨부됨' }] : []),
  ]
  const laterItems = [
    ...(certUrl ? [] : ['사업자등록증']),
    '영업신고증(음식점)',
    '정산 계좌',
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

        {/*
          🎨 2026-09-16 대표 확정 **시안 C** — 시안: docs/design/seller-signup-documents.md
          종전엔 티켓 카드 안에 [제목 + 3단계 사다리(정보 입력 → 심사 → 판매 시작)] 가 있었다.
          그 사다리를 지운다: **사장님이 지금 할 일을 하나도 알려 주지 않으면서** 첫 화면의
          절반을 먹었다(심사·판매 시작은 여기서 할 수 있는 일이 아니다). 진행은 아래
          '승인까지 남은 것' 이 훨씬 정확하게 말한다 — 그건 실제로 사장님이 채울 수 있는 목록이다.
          🎫 티켓도 걷는다 — 티켓은 **손님이 받는 것**이고 여기선 사장님이 내는 서류라 은유가 어긋난다.
        */}
        <header className="px-1 pb-1 pt-3">
          <h2 className="text-[24px] font-extrabold leading-[1.26] tracking-[-.03em] text-gray-900">
            {t('seller.signup.heroTitle', { defaultValue: '사업자번호만 맞으면 대시보드에 바로 들어가요' })}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
            {t('seller.signup.heroDesc', { defaultValue: '서류는 들어가서 채워도 됩니다. 승인 전까지 손님에게는 안 보여요.' })}
          </p>
        </header>

        {/* 🏁 탈출구: 크리에이터(추천·커미션만)는 가입 불필요 — JoinChoice 모델과 동일 안내 */}
        <p className="px-1 text-center text-[12px] text-gray-500">
          {t('seller.gateway.escape', { defaultValue: '상품 추천·커미션만 원하시나요? 가입 없이' })}{' '}
          <button onClick={() => navigate('/u/me')} className="font-bold text-brand-text underline underline-offset-2">
            {t('seller.gateway.escapeLink', { defaultValue: '내 유어샵' })}
          </button>
          {t('seller.gateway.escapeSuffix', { defaultValue: '에서 바로 시작할 수 있어요.' })}
        </p>

        {/* 카드 1 — 국세청 확인용 3칸. 사업자등록증을 꺼내는 순간이 한 번이게 묶는다. */}
        <section className="rounded-[var(--dash-radius,16px)] border border-rule bg-white px-4 pb-3 pt-4 sm:px-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-extrabold text-gray-900">{t('seller.signup.bizSection', { defaultValue: '사업자 정보' })}</h3>
            <span className="dash-num shrink-0 text-[12px] font-bold text-brand-text">{bizDone} / 3</span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-gray-500">{t('seller.signup.bizSectionSub', { defaultValue: '사업자등록증에 적힌 그대로. 국세청 정보와 일치하면 심사 없이 바로 승인돼요.' })}</p>
          <div className="mt-3">
            {/* 🔍 2026-09-16 — **맨 위가 맞는 자리다.** 렌더해 보고 옮겼다: 종전엔 이 칸이 세 칸
                *밑*에 있어서, 사장님이 세 칸을 손으로 다 친 뒤에야 *"사진을 올리면 채워 드려요"* 를
                읽었다. 채워 줄 칸보다 뒤에 있는 자동 채움은 아무도 안 쓴다.
                대표 참고 시안도 같은 순서다 — ③ 서류를 먼저 내고 ⑤ 채워진 값을 확인한다.

                못 읽으면 아무 일도 안 일어난다(= 손으로 치는 현행 동작). 실패를 알리지 않는 이유는
                "읽기 실패" 라고 하면 사장님이 사진을 다시 찍으려 들기 때문이다. */}
            <Field id="f-cert" label={t('seller.signup.cert', { defaultValue: '사업자등록증 사본' })}
              hint={certUrl
                ? t('seller.signup.certHintDone', { defaultValue: '심사에 쓰입니다. 아래 값이 맞는지 확인해 주세요.' })
                : t('seller.signup.certHint', { defaultValue: '사진 한 장이면 아래 칸을 읽어서 채워 드려요. 나중에 올려도 괜찮아요.' })}>
              <BusinessCertUpload value={certUrl} onChange={setCertUrl} hideLabel onRead={applyOcr} />
            </Field>
            <Field id="f-business_number" label="사업자번호" required hint={hint('business_number')} error={errors.business_number}>
              <input id="f-business_number" value={form.business_number}
                onChange={e => set('business_number')(formatBusinessNumber(e.target.value))}
                inputMode="numeric" autoComplete="off" maxLength={12} placeholder="000-00-00000"
                aria-invalid={!!errors.business_number}
                className={`${cls('business_number')} dash-num`} />
            </Field>
            {/* 🛡️ 2026-05-27 (사용자 결정): 국세청 진위확인 — 대표자 + 개업일 함께 입력 시 자동 승인 */}
            <Field id="f-representative_name" label="대표자명" required hint={hint('representative_name', '사업자등록증 기재 명의자')} error={errors.representative_name}>
              <input id="f-representative_name" value={form.representative_name}
                onChange={e => set('representative_name')(e.target.value)}
                maxLength={20} placeholder="예: 홍길동" autoComplete="name"
                aria-invalid={!!errors.representative_name}
                className={cls('representative_name')} />
            </Field>
            <Field id="f-business_start_date" label="개업일" required hint={hint('business_start_date', '사업자등록증의 개업연월일')} error={errors.business_start_date}>
              <input id="f-business_start_date" type="date" value={form.business_start_date}
                onChange={e => set('business_start_date')(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                aria-invalid={!!errors.business_start_date}
                className={cls('business_start_date')} />
            </Field>
            {/* 🪪 등록증 사본 — 어드민이 위 세 칸·아래 가게 정보와 **눈으로 대조**하는 유일한 근거.
                국세청 API 는 상호·주소를 주지 않는다(실측) — 기계로는 못 잡는 자리다. */}
            {/* 🔴 2026-09-16 대표 확정: 라벨에서 **`(선택)` 을 뺀다.** 승인에 실제로 필요한 서류를
                선택이라고 쓰면 대부분 건너뛰고, 그다음 왜 승인이 안 나는지 아무도 모른다.
                지금 안 내도 진행은 되지만(당근 모델) 그건 문구가 말하지 '선택' 이라는 라벨이 아니다. */}
          </div>
        </section>

        <StoreSection
          form={form} errors={errors} place={place} cls={cls} hint={hint} storeDone={storeDone}
          set={set} pickStore={pickStore} clearPlace={() => setPlace(null)}
        />

        {/*
          🔴 2026-09-16 대표 신고 *"이 페이지에 전체적으로 다 떠야하는거 아니야? 어디서 뜨는건데?"*
          — 맞는 지적이었다. 영업신고증과 정산 계좌는 **가입을 끝내고 대시보드
          (`/seller/business-info` 의 탭)** 에 들어가야 나온다. 사장님은 그런 탭이 있다는 걸
          알 방법이 없어, 필수 5칸을 다 채워 제출하고도 **왜 승인이 안 나는지 화면이 한 마디도 안 했다.**

          ⚠️ 그렇다고 여기서 **첨부를 강제하지는 않는다** — 같은 날 확정한 당근 모델
          (`switch-to-seller` 가 대기·반려도 통과)과 정면으로 어긋난다. 이름만 먼저 보여 준다.
          시안·근거: docs/design/seller-signup-documents.md (대표 확정 안 2 + 시각 C)
        */}
        <section className="rounded-[var(--dash-radius,16px)] border border-rule bg-white px-4 pb-3 pt-4 sm:px-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-extrabold text-gray-900">{t('seller.signup.laterSection', { defaultValue: '승인까지 남은 것' })}</h3>
            <span className="dash-num shrink-0 text-[12px] font-bold text-tone-warn">{t('seller.signup.laterCount', { defaultValue: '{{n}} 남음', n: certUrl ? 2 : 3 })}</span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-gray-500">{t('seller.signup.laterSub', { defaultValue: '들어가서 채워도 됩니다. 다 채우면 심사가 시작돼요.' })}</p>
          <dl className="mt-3">
            {[
              { k: t('seller.signup.laterCert', { defaultValue: '사업자등록증' }),
                v: certUrl ? t('seller.signup.laterDone', { defaultValue: '첨부됨' }) : t('seller.signup.laterCertNote', { defaultValue: '위에서 첨부' }),
                done: !!certUrl },
              { k: t('seller.signup.laterPermit', { defaultValue: '영업신고증' }),
                v: t('seller.signup.laterPermitNote', { defaultValue: '음식점 필수' }), done: false },
              { k: t('seller.signup.laterBank', { defaultValue: '정산 계좌' }),
                v: t('seller.signup.laterBankNote', { defaultValue: '정산 전까지' }), done: false },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between gap-3 border-t border-rule py-2.5 first:border-t-0">
                <dt className="text-[13.5px] font-semibold text-gray-900">{r.k}</dt>
                <dd className={`shrink-0 text-[11.5px] font-bold ${r.done ? 'text-tone-ok' : 'text-gray-500'}`}>{r.v}</dd>
              </div>
            ))}
          </dl>
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
          <button onClick={review} disabled={loading}
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

      {/* 🧾 시안 ④ — 보내기 직전에 무엇이 나가는지 글자로 한 번. 사진에서 채운 칸은
          사장님이 한 번도 안 읽었을 수 있고, 그걸 잡을 자리가 여기뿐이다. */}
      <ReviewSheet
        open={reviewOpen}
        rows={reviewRows}
        later={laterItems}
        loading={loading}
        fromPhoto={autoFilled.size}
        onClose={() => setReviewOpen(false)}
        onConfirm={submit}
      />
    </div>
  )
}
