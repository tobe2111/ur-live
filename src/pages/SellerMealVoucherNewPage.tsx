/**
 * 🎟️ 이용권 등록 — 3단계 위저드 (2026-08-23 대표 승인 리뉴얼)
 *   대표 요구: "처음에 카카오맵으로 매장 검색하고 최대한 자동입력. 매장 등록이 되어있으면
 *   자동으로. 매장이 여러개면 선택하면 되고. 임시저장도 돼야 해."
 *
 *   [1 매장] 등록 매장 자동 상속(GET /stores/context) · 다매장 칩 선택 · 카카오맵 검색
 *   [2 이용권] 종류·이름·가격·사진·실수령가
 *   [3 판매 설정] 재고·한도·마감 · 유효기간 기본 무기한 · 미리보기 → 등록
 *
 *   임시저장 = localStorage 드래프트(voucher-form.ts) — 자동저장 + 명시 버튼 + 복원 배너.
 *   제출 payload 는 종전과 동일 계약(POST /api/seller/products) — 단 group_buy_target 은
 *   항상 0(즉시판매 단일가 모델에서 목표 인원 입력 제거), voucher_expiry 미설정 = 무기한.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Utensils, CheckCircle, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { kstInputToUTC } from '@/utils/date'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import { SELLER_PROMO_FIELD_ENABLED } from '@/shared/feature-flags'
import SellerLayout from '@/components/SellerLayout'
import KakaoShareButton from '@/components/KakaoShareButton'
import { DashboardPageHeader } from '@/components/dashboard'
import type { KakaoPlace } from '@/components/KakaoMapPicker'
import StoreStep from './seller-meal-voucher/StoreStep'
import VoucherInfoStep from './seller-meal-voucher/VoucherInfoStep'
import SaleSettingsStep from './seller-meal-voucher/SaleSettingsStep'
import {
  emptyVoucherForm, applyStoreContext, isDraftWorthSaving,
  loadVoucherDraft, saveVoucherDraft, clearVoucherDraft, pickNewerDraft,
  type StoreContext, type VoucherDraft, type VoucherForm,
} from './seller-meal-voucher/voucher-form'
import { fetchServerDraft, pushServerDraft, deleteServerDraft } from './seller-meal-voucher/draft-sync'

export default function SellerMealVoucherNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<VoucherForm>(() => emptyVoucherForm())
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [placeSelected, setPlaceSelected] = useState(false)
  const [suggestedImages, setSuggestedImages] = useState<string[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  // 임시저장 복원 배너 — 결정 전에는 자동저장을 멈춰 기존 드래프트를 덮어쓰지 않는다.
  const [pendingDraft, setPendingDraft] = useState<VoucherDraft | null>(null)
  const skipContextPrefill = useRef(false)
  // 🚪 2026-08-24 (대표): 매장 등록이 무조건 선행 — 서버 판정(store_ready). false 면 1단계에서
  //   등록을 완료해야 다음 단계로 넘어갈 수 있다. null(판정 중/실패)은 막지 않는다(fail-open).
  const [storeReady, setStoreReady] = useState<boolean | null>(null)

  // 🧭 재발행 복사: ?copyFrom=<productId> 면 본인 소유 공구를 불러와 프리필(날짜는 리셋).
  useEffect(() => {
    const copyFrom = Number(searchParams.get('copyFrom'))
    if (!Number.isFinite(copyFrom) || copyFrom <= 0) return
    skipContextPrefill.current = true
    const token = getSellerToken()
    api.get(`/api/seller/products/${copyFrom}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => {
        if (!r.data?.success || !r.data.data) return
        const src = r.data.data as Record<string, unknown>
        const str = (v: unknown) => (typeof v === 'string' ? v : '')
        const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
        setForm((f) => ({
          ...f,
          name: str(src.name) || f.name,
          description: str(src.description),
          price: num(src.price) || f.price,
          original_price: num(src.original_price),
          image_url: str(src.image_url),
          category: (str(src.category) || f.category) as VoucherForm['category'],
          restaurant_name: str(src.restaurant_name),
          restaurant_address: str(src.restaurant_address),
          restaurant_phone: str(src.restaurant_phone),
          restaurant_lat: src.restaurant_lat != null ? String(src.restaurant_lat) : '',
          restaurant_lng: src.restaurant_lng != null ? String(src.restaurant_lng) : '',
          voucher_terms: str(src.voucher_terms),
          stock: num(src.stock) || f.stock,
          // 마감(group_buy_deadline)/만료(voucher_expiry)는 기본값 유지 — 새 공구 기준 재계산.
          //   (그래서 여기서는 utcToKstInput 이 필요 없다 — 값을 물려받지 않는다.)
        }))
        toast.success(t('seller.groupBuy.copyLoaded', { defaultValue: '이전 공구 내용을 불러왔어요 — 날짜만 확인하고 발행하세요!' }))
      })
      .catch(() => toast.error(t('seller.groupBuy.copyFailed', { defaultValue: '이전 공구를 불러오지 못했어요' })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 💾 임시저장 감지 (마운트 1회) — 로컬 vs 서버 중 더 최근 것을 복원 배너로.
  //   로컬 드래프트는 마운트 시점에 동기 캡처(클로저) — 서버 응답 전 자동저장이 localStorage 를
  //   덮어써도 복원은 캡처본에서 하므로 안전하다.
  useEffect(() => {
    let alive = true
    const local = loadVoucherDraft()
    fetchServerDraft().then(server => {
      if (!alive) return
      const best = pickNewerDraft(local, server)
      if (best) setPendingDraft(best)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 🏪 등록 매장 자동 상속 — 매장 필드가 비어 있을 때만(드래프트/복사를 덮지 않는다).
  //   + store_ready(매장 등록 선행 게이트 판정)도 같은 응답에서 읽는다.
  useEffect(() => {
    let alive = true
    api.get('/api/seller/stores/context')
      .then(r => {
        if (!alive || !r.data?.success || !r.data.data) return
        if (typeof r.data.data.store_ready === 'boolean') setStoreReady(r.data.data.store_ready)
        if (skipContextPrefill.current) return
        const s = r.data.data.store as StoreContext | undefined
        if (!s?.name) return
        setForm(f => (f.restaurant_name ? f : applyStoreContext(f, s)))
      })
      .catch(() => { /* 프리필 실패는 조용히 — 지도 검색이 언제나 대안 */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 💾 자동저장 (800ms 디바운스) — 복원 결정 전·제출 완료 후에는 쓰지 않는다.
  useEffect(() => {
    if (pendingDraft || done || !isDraftWorthSaving(form)) return
    const id = setTimeout(() => {
      saveVoucherDraft(form, Number(localStorage.getItem('seller_id') || 0))
    }, 800)
    return () => clearTimeout(id)
  }, [form, pendingDraft, done])

  // ☁️ 서버 자동저장 (5s 디바운스) — 기기 간 이어쓰기. 연속 타이핑 중엔 타이머가 리셋되므로
  //   쓰기는 타이핑이 멈춘 뒤 1회만 나간다(fail-soft — 로컬이 1차 방어선).
  useEffect(() => {
    if (pendingDraft || done || !isDraftWorthSaving(form)) return
    const id = setTimeout(() => pushServerDraft(form), 5000)
    return () => clearTimeout(id)
  }, [form, pendingDraft, done])

  if (!isSellerAuthenticated()) { redirectToLogin(navigate); return null }

  const token = getSellerToken()
  const headers = { Authorization: `Bearer ${token}` }
  const KAKAO_JS_KEY = import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || ''
  const update = (key: string, value: string | number) => setForm(f => ({ ...f, [key]: value }))

  function searchImages(query: string) {
    setLoadingImages(true)
    api.get(`/api/naver/image/search?query=${encodeURIComponent(query)}&display=9`)
      .then(res => {
        if (res.data.success && res.data.data?.items) {
          setSuggestedImages(res.data.data.items.map((img: { link?: string }) => (img.link || '').replace(/^http:\/\//, 'https://')).filter(Boolean))
        }
      })
      .catch(() => { /* 추천 실패는 치명적이지 않다 — 직접 업로드/검색이 남는다 */ })
      .finally(() => setLoadingImages(false))
  }

  function selectPlace(place: KakaoPlace) {
    setForm(f => ({
      ...f,
      restaurant_name: place.place_name || f.restaurant_name,
      restaurant_address: place.road_address_name || place.address_name || '',
      restaurant_phone: place.phone || '',
      restaurant_lat: place.y || '',
      restaurant_lng: place.x || '',
      kakao_place_url: place.id ? `https://place.map.kakao.com/${place.id}` : f.kakao_place_url,
    }))
    setPlaceSelected(true)
    toast.success(t('seller.mealVoucher.placeAutoFilled', { name: place.place_name }))
    // 네이버 이미지 검색으로 매장 사진 추천 — place_name 이 가장 specific, 동(洞) 1개만 보조.
    if (place.place_name) {
      const fullAddr = place.road_address_name || place.address_name || ''
      const dongMatch = fullAddr.match(/[가-힣]+(동|읍|면|로|길)\s*\d*/)
      const dong = dongMatch ? dongMatch[0].replace(/\s*\d+/, '') : ''
      searchImages(dong ? `${place.place_name} ${dong}` : place.place_name)
    }
  }

  function validateStep(s: number): boolean {
    // 🚪 매장 등록 선행 — 등록 매장이 없으면(서버 판정) 지도에서 찾아 [매장 등록]을 완료해야 진행.
    if (s === 0 && storeReady === false) {
      toast.error(t('seller.mealVoucher.storeFirst', { defaultValue: '매장 등록이 먼저예요 — 지도에서 매장을 찾아 [매장 등록]을 완료해주세요' }))
      return false
    }
    if (s === 0 && !form.restaurant_name.trim()) {
      toast.error(t('seller.mealVoucher.needStore', { defaultValue: '매장을 먼저 선택하거나 입력해주세요' }))
      return false
    }
    if (s === 1 && (!form.name.trim() || !(form.price > 0))) {
      toast.error(t('seller.mealVoucher.requiredFields'))
      return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.price || !form.restaurant_name) {
      toast.error(t('seller.mealVoucher.requiredFields'))
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || `${form.restaurant_name} ${t('seller.mealVoucher.voucherSuffix')}`,
        price: form.price,
        original_price: form.original_price || form.price,
        image_url: form.image_url,
        category: form.category,
        product_type: 'featured',
        stock: form.stock,
        restaurant_name: form.restaurant_name,
        restaurant_address: form.restaurant_address,
        restaurant_phone: form.restaurant_phone,
        restaurant_lat: form.restaurant_lat ? parseFloat(form.restaurant_lat) : null,
        restaurant_lng: form.restaurant_lng ? parseFloat(form.restaurant_lng) : null,
        // 🗓️ 미설정('') = 무기한(expires_at NULL) — 2026-08-22 대표 정책.
        voucher_expiry: form.voucher_expiry || null,
        voucher_terms: form.voucher_terms || null,
        // 🎯 목표 인원 입력 제거(2026-08-23) — 즉시판매 단일가 모델이라 항상 0(=바로 판매).
        group_buy_target: 0,
        // 🕐 2026-09-02: 칸은 KST 벽시계, 저장은 UTC — 경계에서 한 번만 바꾼다(SSOT `utils/date`).
        //   종전엔 datetime-local 값을 그대로 보내 서버가 UTC 로 읽어 **마감이 9시간 늦게** 걸렸다.
        group_buy_deadline: kstInputToUTC(form.group_buy_deadline) || null,
        store_verify_pin: form.store_verify_pin || null,
        external_booking_url: form.external_booking_url || null,
        // 지역 자동 파싱 — restaurant_address 첫 단어 = region_si.
        region_si: form.region_si || (form.restaurant_address ? form.restaurant_address.split(/\s+/)[0]?.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '').slice(0, 4) : null),
        region_gu: form.region_gu || (form.restaurant_address ? form.restaurant_address.split(/\s+/)[1] || null : null),
        max_per_person: Number(form.max_per_person) > 0 ? Math.floor(Number(form.max_per_person)) : 0,
        kakao_place_url: form.kakao_place_url || undefined,
        // 즉시판매 단일가 모델 — 동적 tier 미사용.
        group_buy_tiers: null,
        // 💰 소개비 → referral_commission_rate(0~0.5) + referral_enabled (게이트 OFF 면 미전송).
        ...(SELLER_PROMO_FIELD_ENABLED && Number(form.promo_pct) > 0
          ? { referral_enabled: true, referral_commission_rate: Math.min(0.5, Number(form.promo_pct) / 100) }
          : {}),
      }

      const res = await api.post('/api/seller/products', payload, { headers })
      if (res.data.success) {
        clearVoucherDraft()
        deleteServerDraft()
        setCreatedId(Number(res.data.data?.id) || null)
        setDone(true)
        toast.success(t('seller.mealVoucher.registered'))
      } else {
        toast.error(res.data.error || t('seller.mealVoucher.registerFailed'))
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast.error(axiosErr?.response?.data?.error || t('seller.mealVoucher.registerFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const steps = [
    t('seller.mealVoucher.stepStore', { defaultValue: '매장' }),
    t('seller.mealVoucher.stepVoucher', { defaultValue: '이용권' }),
    t('seller.mealVoucher.stepSale', { defaultValue: '판매 설정' }),
  ]

  // ✅ 등록 완료 — 다음 행동으로 연결(인플루언서에게 제안).
  if (done) {
    return (
      <SellerLayout title={t('seller.mealVoucher.title')}>
        <div className="mx-auto max-w-xl p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center mt-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900">{t('seller.mealVoucher.doneTitle', { defaultValue: '이용권이 등록됐어요!' })}</h2>
            <p className="text-sm text-gray-500 mt-2">
              {t('seller.mealVoucher.doneDesc', { defaultValue: '소개해 줄 사람에게 제안을 보내면 소개 판매가 시작돼요. 커미션은 팔렸을 때만 발생합니다.' })}
            </p>
            {/* 📣 2026-08-23: 첫 판로는 단골 카톡방 — 등록 즉시 공유(커머스 카드: 정가취소선+할인가). */}
            {createdId && (
              <div className="mt-5 space-y-2">
                <KakaoShareButton
                  title={form.name || t('seller.mealVoucher.title')}
                  description={form.restaurant_name ? `${form.restaurant_name} · ${t('seller.mealVoucher.shareDesc', { defaultValue: '유어딜에서 할인가로 만나요' })}` : t('seller.mealVoucher.shareDesc', { defaultValue: '유어딜에서 할인가로 만나요' })}
                  imageUrl={form.image_url && !form.image_url.startsWith('data:') ? form.image_url : undefined}
                  link={`/group-buy/${createdId}`}
                  regularPrice={form.original_price > form.price ? form.original_price : undefined}
                  salePrice={form.price || undefined}
                />
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`https://urdeal.kr/group-buy/${createdId}`)
                      .then(() => toast.success(t('seller.mealVoucher.linkCopied', { defaultValue: '링크가 복사됐어요 — 단골 채팅방에 붙여넣어 보세요' })))
                      .catch(() => toast.error(t('common.copyFailed', { defaultValue: '복사에 실패했습니다' })))
                  }}
                  className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold"
                >
                  {t('seller.mealVoucher.copyLink', { defaultValue: '판매 링크 복사' })}
                </button>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => navigate('/seller/group-buy')}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm"
              >
                {t('seller.mealVoucher.viewMyProducts', { defaultValue: '내 이용권 보기' })}
              </button>
              <button
                onClick={() => navigate('/seller/influencers')}
                className="flex-[2] py-3 bg-pink-500 text-white rounded-xl font-bold text-sm"
              >
                {t('seller.mealVoucher.findInfluencers', { defaultValue: '소개 파트너 찾기 →' })}
              </button>
            </div>
          </div>
        </div>
      </SellerLayout>
    )
  }

  return (
    <SellerLayout title={t('seller.mealVoucher.title')}>
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('seller.mealVoucher.title')}
          subtitle={t('seller.mealVoucher.subtitle', { defaultValue: '이용권/공동구매 상품 등록' })}
          icon={<Utensils className="h-5 w-5" />}
        />

        {/* 💾 임시저장 복원 배너 */}
        {pendingDraft && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">{t('seller.mealVoucher.draftFound', { defaultValue: '임시저장된 작성 내용이 있어요' })}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                {pendingDraft.form.name || pendingDraft.form.restaurant_name || t('seller.mealVoucher.draftUntitled', { defaultValue: '(제목 없음)' })}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => { clearVoucherDraft(); deleteServerDraft(); setPendingDraft(null) }}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600"
              >
                {t('seller.mealVoucher.draftDiscard', { defaultValue: '새로 작성' })}
              </button>
              <button
                type="button"
                onClick={() => { setForm(pendingDraft.form); setPendingDraft(null); toast.success(t('seller.mealVoucher.draftRestored', { defaultValue: '이어서 작성합니다' })) }}
                className="ur-btn ur-btn-md ur-btn-primary"
              >
                {t('seller.mealVoucher.draftResume', { defaultValue: '이어서 작성' })}
              </button>
            </div>
          </div>
        )}

        {/* 단계 표시 */}
        <div className="flex items-center gap-2">
          {steps.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => { if (i < step || (validateStep(0) && (i < 2 || validateStep(1)))) setStep(i) }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                i === step ? 'bg-gray-900 text-white' : i < step ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 0 && (
            <StoreStep
              form={form}
              update={update}
              onApplyContext={(ctx) => setForm(f => applyStoreContext({ ...f, restaurant_name: '', restaurant_address: '', restaurant_phone: '', restaurant_lat: '', restaurant_lng: '', kakao_place_url: '', store_verify_pin: '' }, ctx))}
              onPlaceSelect={selectPlace}
              placeSelected={placeSelected}
              kakaoJsKey={KAKAO_JS_KEY}
              storeRequired={storeReady === false}
              onStoreReady={() => setStoreReady(true)}
            />
          )}
          {step === 1 && (
            <VoucherInfoStep
              form={form}
              update={update}
              setCategory={(c) => setForm(f => ({ ...f, category: c }))}
              suggestedImages={suggestedImages}
              loadingImages={loadingImages}
              onSearchImages={searchImages}
            />
          )}
          {step === 2 && (
            <SaleSettingsStep form={form} update={update} showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced} />
          )}

          {/* 하단 내비게이션 — 이전/임시저장/다음(또는 등록) */}
          <div className="flex gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(s => Math.max(0, s - 1))}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> {t('common.prev', { defaultValue: '이전' })}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/seller/group-buy')}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm"
              >
                {t('common.cancel')}
              </button>
            )}
            <button
              type="button"
              onClick={() => { saveVoucherDraft(form, Number(localStorage.getItem('seller_id') || 0)); pushServerDraft(form); toast.success(t('seller.mealVoucher.draftSaved', { defaultValue: '임시저장 완료 — 다른 기기에서도 이어서 작성할 수 있어요' })) }}
              className="shrink-0 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> {t('seller.mealVoucher.saveDraft', { defaultValue: '임시저장' })}
            </button>
            {step < 2 ? (
              <button
                type="button"
                onClick={() => { if (validateStep(step)) setStep(s => Math.min(2, s + 1)) }}
                className="flex-[2] py-3 bg-pink-500 text-white rounded-xl font-bold text-sm active:scale-[0.98] flex items-center justify-center gap-1"
              >
                {t('common.next', { defaultValue: '다음' })} <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="flex-[2] py-3 bg-pink-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 active:scale-[0.98]"
              >
                {submitting ? t('seller.registering') : t('seller.mealVoucher.registerSubmit')}
              </button>
            )}
          </div>
        </form>
      </div>
    </SellerLayout>
  )
}
