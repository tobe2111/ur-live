// deal-card-ok: 카드 목록이 아니라 등록 폼이다 — `.map` 은 종류 칩 다섯 개뿐이고 사진·이동이 없다.
/**
 * ④ 첫 이용권 올리기 — 2026-11-03 대표 확정 4화면 시안 (*"시안대로 해줘. 판매 기간은 제한 없어"*).
 *
 * 매장 등록 바로 뒤의 **한 화면**: 종류 · 이름 · 원래 가격 · 손님 결제가 → [이용권 올리기].
 *  - 가게는 방금 등록한 곳으로 정해져 있다 — 종전 이용권 위저드(`SellerMealVoucherNewPage`)처럼 '매장' 단계를 다시 묻지 않는다.
 *  - **판매 기간 제한 없음**(대표 확정) — `group_buy_deadline: null` · 사용 기한도 무기한(`voucher_expiry: null`, 2026-08-22 정책).
 *  - 사진·사용 조건·예약 방식은 올린 뒤 상품 편집에서 더한다(이 화면에 다 넣으면 첫 이용권에서 그만둔다).
 *  - 숙박(객실 필요)·생활(업종 필요)은 이 한 화면으로 못 끝내므로 **전체 화면**으로 보낸다 — 없는 칸을 지어내지 않는다.
 *  - 저장은 종전 위저드와 **같은 API**(`POST /api/seller/products`)와 같은 최소가 규칙(`voucherMinPriceError`)이다.
 * 🌙 소비자 화면(대시보드 밖)이라 다크모드를 따른다 — 대시보드는 '늘 흰 화면' 규칙이라 그쪽 위저드는 다크가 안 된다.
 * 🎬 종류 칩 누름 톡(`ur-press`) · 틀린 칸 흔들림 · 버튼 처리 중 빛 · 완료 때 유달이 도장.
 */
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import VoucherPhotos, { type PickedPhoto } from './VoucherPhotos'
import FirstVoucherDone from './FirstVoucherDone'
import { voucherMargin } from '@/shared/voucher-margin'
import { getSellerToken, isSellerAuthenticated } from '@/lib/seller-auth'
import { voucherMinPriceError } from '@/shared/constants/voucher-categories'
import { MY_PATH } from '@/lib/seller-return'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) }
injectMotionCss('ur-m-rise', `@keyframes ur-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }.ur-rise { animation: ur-rise .35s cubic-bezier(.16,1,.3,1) both; }@media (prefers-reduced-motion: reduce){.ur-rise{animation:none!important}}`)
injectMotionCss('ur-m-busyring', `@keyframes ur-busy-spin { to { transform: rotate(360deg); } }.ur-busy-ring { position: relative; isolation: isolate; overflow: hidden; }.ur-busy-ring::before { content: ''; position: absolute; inset: -60%; z-index: -2; background: conic-gradient(from 0deg, transparent 0 65%, rgba(255,255,255,.95) 82%, transparent 100%); animation: ur-busy-spin 1.1s linear infinite; }.ur-busy-ring::after { content: ''; position: absolute; inset: 2px; z-index: -1; border-radius: inherit; background: var(--brand); }@media (prefers-reduced-motion: reduce){.ur-busy-ring::before{animation:none!important;opacity:0}}`)
injectMotionCss('ur-m-firstvoucher', `@keyframes ur-fv-shake { 0%,100% { transform: none; } 20% { transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }@keyframes ur-fv-press { 0% { transform: scale(1); } 40% { transform: scale(.92); } 100% { transform: scale(1); } }.ur-fv-field[aria-invalid="true"] { animation: ur-fv-shake .4s ease-out; }.ur-fv-chip[aria-checked="true"] { animation: ur-fv-press .28s cubic-bezier(.3,1.4,.5,1); }@media (prefers-reduced-motion: reduce){.ur-fv-field[aria-invalid="true"],.ur-fv-chip[aria-checked="true"]{animation:none!important}}`)

/** 종류 — 소비자 카테고리 SSOT(`voucher-categories`) 와 같은 키. `full` = 이 한 화면으로 못 끝낸다(전체 화면으로). */
const KINDS = [
  { key: 'meal_voucher', label: '식사' },
  { key: 'beauty_voucher', label: '미용' },
  { key: 'stay_voucher', label: '숙박', full: '숙박은 객실 정보가 필요해요' },
  { key: 'home_voucher', label: '생활', full: '생활은 어떤 일인지(업종) 골라야 해요' },
  { key: 'etc_voucher', label: '기타' },
] as const
type KindKey = (typeof KINDS)[number]['key']

interface StoreCtx { name?: string; address?: string; phone?: string; lat?: string | number; lng?: string | number; kakao_place_url?: string; verify_pin?: string }

const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0

export default function FirstVoucherPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromState = (location.state as { place?: { name?: string; address?: string; phone?: string; lat?: number; lng?: number; place_url?: string } } | null)?.place
  const [store, setStore] = useState<StoreCtx | null>(fromState?.name
    ? { name: fromState.name, address: fromState.address, phone: fromState.phone, lat: fromState.lat, lng: fromState.lng, kakao_place_url: fromState.place_url }
    : null)
  const [kind, setKind] = useState<KindKey>('meal_voucher')
  const [name, setName] = useState('')
  const [orig, setOrig] = useState('')
  const [price, setPrice] = useState('')
  const [tried, setTried] = useState(false)
  // 📷 사진은 필수(2026-11-03 대표 *"사진이 없으면 막자"*) — 첫 장이 대표.
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [createdId, setCreatedId] = useState<number | null>(null)
  const authed = isSellerAuthenticated()
  // 💸 받는 돈 — 수수료율은 **서버가 준 값만** 쓴다(`/api/seller/fee-context` = 결제가 부르는 그 함수). 화면에서 채널로 다시 계산하지 않는다.
  const [feePct, setFeePct] = useState<number | null>(null)

  // 좌석이 없으면(새로고침·직접 진입) 마이로 — 이 화면은 매장 등록 직후의 다리다.
  useEffect(() => { if (!authed) navigate(MY_PATH, { replace: true }) }, [authed, navigate])
  // 가게 정보는 등록 화면이 넘겨준 값 → 없으면 서버의 '내 매장' 에서. 저장 직전에도 서버 값이 이긴다(주소·핀).
  useEffect(() => {
    if (!authed) return
    api.get('/api/seller/stores/context', { headers: { Authorization: `Bearer ${getSellerToken()}` } })
      .then((r) => { const s = r.data?.data?.store as StoreCtx | undefined; if (s?.name) setStore((prev) => ({ ...prev, ...s })) })
      .catch(() => { /* 넘겨받은 값으로 진행 */ })
    api.get('/api/seller/fee-context', { headers: { Authorization: `Bearer ${getSellerToken()}` } })
      .then((r) => { const v = Number(r.data?.data?.platform_fee_pct); if (r.data?.success && Number.isFinite(v)) setFeePct(v) })
      .catch(() => { /* 못 받으면 그 줄을 안 그린다 — 추측한 % 로 채우지 않는다 */ })
  }, [authed])

  const priceN = num(price)
  const origN = num(orig)
  const kindInfo = KINDS.find((k) => k.key === kind)!
  const nameBad = tried && !name.trim()
  const priceErr = tried ? (!priceN ? '손님 결제가를 적어 주세요' : voucherMinPriceError(kind, priceN)) : null
  const origErr = tried && origN > 0 && origN < priceN ? '원래 가격은 결제가보다 같거나 커야 해요' : null
  const pct = origN > priceN && priceN > 0 ? Math.round((1 - priceN / origN) * 100) : 0
  /** 버튼을 끄는 이유 — 회색 버튼만 두지 않는다(이 레포가 반복해 고친 클래스). */
  const blockReason = photos.length === 0 ? '사진을 1장 이상 올려 주세요' : null

  async function submit() {
    setTried(true)
    if (blockReason) return
    if (!name.trim() || !priceN || voucherMinPriceError(kind, priceN) || (origN > 0 && origN < priceN) || submitting) return
    if (!store?.name) { toast.error('가게 정보를 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요'); return }
    setSubmitting(true)
    try {
      const addr = store.address || ''
      const parts = addr.split(/\s+/)
      const res = await api.post('/api/seller/products', {
        name: name.trim(),
        description: `${store.name} 이용권`,
        price: priceN,
        original_price: origN || priceN,
        image_url: photos[0].url, // 대표 = 첫 장(카드·검색·공유가 읽는 컬럼)
        images: JSON.stringify(photos.map((p) => p.url)),
        category: kind,
        product_type: 'featured',
        stock: 100,
        restaurant_name: store.name,
        restaurant_address: addr,
        restaurant_phone: store.phone || '',
        restaurant_lat: store.lat ? Number(store.lat) : null,
        restaurant_lng: store.lng ? Number(store.lng) : null,
        voucher_expiry: null, // 사용 기한 무기한(2026-08-22 정책)
        voucher_terms: null,
        group_buy_target: 0,
        group_buy_deadline: null, // 📅 판매 기간 제한 없음(2026-11-03 대표 확정)
        store_verify_pin: store.verify_pin || null,
        external_booking_url: null,
        region_si: parts[0]?.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '').slice(0, 4) || null,
        region_gu: parts[1] || null,
        max_per_person: 0,
        kakao_place_url: store.kakao_place_url || undefined,
        group_buy_tiers: null,
      }, { headers: { Authorization: `Bearer ${getSellerToken()}` } })
      if (!res.data?.success) throw new Error(res.data?.error)
      setCreatedId(Number(res.data.data?.id) || 0)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || '이용권을 올리지 못했어요. 잠시 뒤 다시 눌러 주세요')
    } finally { setSubmitting(false) }
  }

  const fieldCls = (bad: boolean) => `ur-fv-field flex items-center gap-1 h-[52px] px-4 rounded-xl border-[1.5px] ${bad ? 'border-tone-bad' : 'border-line focus-within:border-brand'}`
  const inputCls = 'flex-1 min-w-0 bg-transparent border-0 outline-none focus-visible:outline-none text-[16px] text-gray-900 dark:text-white placeholder:text-ink-faint'

  return (
    <div className="h-dvh lg:h-auto lg:min-h-dvh bg-warm text-gray-900 dark:text-white flex flex-col">
      <SEO title="첫 이용권 올리기 - 유어딜" description="방금 등록한 가게의 첫 이용권을 올려 보세요." noindex />
      <div className="mx-auto w-full max-w-[480px] flex-1 min-h-0 flex flex-col">
        <div className="h-14 shrink-0 flex items-center px-2">
          <button type="button" aria-label="닫기" onClick={() => navigate(MY_PATH, { replace: true })}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-wash">
            <ArrowLeft size={22} strokeWidth={1.6} />
          </button>
        </div>

        {createdId !== null ? (
          <FirstVoucherDone createdId={createdId} storeName={store?.name || ''} region={(store?.address || '').split(/\s+/).slice(1, 3).join(' ')}
            name={name.trim()} price={priceN} originalPrice={origN || priceN} pct={pct} photo={photos[0]?.url || ''} />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col px-5 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
              <p className="text-[13px] font-medium text-brand-text truncate">{store?.name ? `${store.name} · 첫 이용권` : '첫 이용권'}</p>
              <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] leading-snug">무엇을 얼마에 팔까요?</h1>
              {!('full' in kindInfo) && <VoucherPhotos photos={photos} onChange={setPhotos} storeName={store?.name} storeAddress={store?.address} />}

              <div role="radiogroup" aria-label="이용권 종류" className="mt-5 flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} onClick={() => setKind(k.key)}
                    className={`ur-fv-chip h-10 px-4 rounded-full border-[1.5px] text-[15px] font-medium ${kind === k.key ? 'border-brand bg-brand-tint text-brand-text' : 'border-line text-gray-900 dark:text-white'}`}>
                    {k.label}
                  </button>
                ))}
              </div>

              {'full' in kindInfo ? (
                <div className="ur-rise mt-8 rounded-xl bg-wash p-4">
                  <p className="text-[15px]">{kindInfo.full}. 자세한 화면에서 올려 주세요.</p>
                  <Link to={`/seller/meal-voucher/new?category=${kind}&from=my`} className="ur-btn ur-btn-md ur-btn-primary mt-3 inline-flex">{kindInfo.label} 이용권 만들기</Link>
                </div>
              ) : (
                <>
                  <label className="mt-5 block">
                    <span className="block text-[13px] text-ink-soft mb-2">이용권 이름</span>
                    <span className={fieldCls(nameBad)} aria-invalid={nameBad}>
                      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="예: 김밥 2줄 + 라면 세트" className={inputCls} />
                    </span>
                  </label>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-[13px] text-ink-soft mb-2">원래 가격</span>
                      <span className={fieldCls(!!origErr)} aria-invalid={!!origErr}>
                        <input value={orig ? formatNumber(origN) : ''} onChange={(e) => setOrig(e.target.value)} inputMode="numeric" placeholder="10,000" className={`${inputCls} text-right`} />
                        <span className="text-[15px] text-ink-soft">원</span>
                      </span>
                    </label>
                    <label className="block">
                      <span className="block text-[13px] text-ink-soft mb-2">손님 결제가</span>
                      <span className={fieldCls(!!priceErr)} aria-invalid={!!priceErr}>
                        <input value={price ? formatNumber(priceN) : ''} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="7,000" className={`${inputCls} text-right font-medium`} />
                        <span className="text-[15px] text-ink-soft">원</span>
                      </span>
                    </label>
                  </div>
                  {(nameBad || priceErr || origErr) && <p className="mt-2 text-[13px] text-tone-bad">{nameBad ? '이용권 이름을 적어 주세요' : priceErr || origErr}</p>}

                  <div className="mt-5 rounded-xl bg-wash px-4">
                    <div className="flex items-baseline gap-2 py-3 border-b border-rule">
                      <span className="w-[72px] shrink-0 text-[13px] text-ink-soft">손님 화면</span>
                      {pct > 0 && <span className="text-[16px] font-bold text-sale">{pct}%</span>}
                      <span className="text-[16px] font-bold">{priceN ? `${formatNumber(priceN)}원` : '—'}</span>
                      {pct > 0 && <span className="text-[13px] text-ink-soft line-through">{formatNumber(origN)}원</span>}
                    </div>
                    <div className={`flex items-center py-3${feePct !== null && priceN > 0 ? ' border-b border-rule' : ''}`}>
                      <span className="w-[72px] shrink-0 text-[13px] text-ink-soft">판매 기간</span>
                      <span className="text-[15px]">제한 없음</span>
                    </div>
                    {feePct !== null && priceN > 0 && (
                      <div className="flex items-center py-3" data-testid="first-voucher-net">
                        <span className="w-[72px] shrink-0 text-[13px] text-ink-soft">받는 돈</span>
                        <span className="flex-1 text-[15px] font-medium">{formatNumber(voucherMargin({ price: priceN, originalPrice: origN || priceN, platformFeePct: feePct, influencerPct: 0 }).net)}원</span>
                        <span className="text-[12px] text-ink-soft">수수료 {feePct}% 뺀 값</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-[13px] text-ink-soft">사용 조건·예약 방식은 올린 뒤에 더할 수 있어요.</p>
                </>
              )}
            </div>

            {!('full' in kindInfo) && (
              <div className="shrink-0 pt-3">
                <button type="button" onClick={() => void submit()} disabled={submitting || !!blockReason}
                  className={`ur-btn ur-btn-lg ur-btn-primary w-full disabled:opacity-40${submitting ? ' ur-busy-ring !opacity-100' : ''}`}>
                  {submitting ? '올리는 중…' : '이용권 올리기'}
                </button>
                {blockReason && <p className="mt-2 text-center text-[12px] text-ink-soft" data-testid="first-voucher-block">{blockReason}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
