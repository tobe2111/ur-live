/**
 * 🛡️ 2026-05-18: 사용자 숙소 상세 + 예약 (PR 3/6).
 *
 * - 헤더 이미지 + 정보 + 위치 + 평점
 * - 객실 목록 (가용/가격/총액 자동 계산)
 * - 객실 선택 → 게스트 정보 입력 → 예약 생성 → /checkout 으로 이동
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { MapPin, Calendar, Users, Star, Wifi, Coffee, Car, Waves, Sparkles, ChevronLeft, Shield } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import BrandLoader from '@/components/brand/BrandLoader'

interface StayDetail {
  id: number
  name: string
  restaurant_name?: string | null  // 🏨 숙소명(오퍼명 name 과 별도) — h1 우선
  description: string
  image_url?: string
  property_type: string
  star_rating: number | null
  region_sido: string
  region_sigungu: string
  address: string
  check_in_time: string
  check_out_time: string
  cancellation_policy: string
  custom_cancellation_text: string | null
  house_rules: string | null
  check_in_instructions: string | null
  amenities: string | null
  description_full: string | null
  min_nights: number
  seller_id: number
  seller_name: string
  avg_rating: number | null
  review_count: number
  // 🛡️ 2026-05-18: 판매 모드 + voucher 옵션 + referral.
  sale_mode?: 'date' | 'voucher' | 'both'
  voucher_validity_days?: number
  voucher_weekday_only?: number
  voucher_weekend_only?: number
  referral_enabled?: number
  influencer_discount_pct?: number
}

interface AvailRoom {
  room_id: number
  name: string
  bed_config: string | null
  base_guests: number
  max_guests: number
  extra_guest_fee: number
  amenities: string | null
  image_urls: string | null
  available: boolean
  available_count: number
  total_price: number
  discounted_price?: number
  discount_pct?: number
  avg_per_night_discounted?: number
  nights: number
  avg_per_night: number
}

const AMENITY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  wifi: { label: '와이파이', icon: <Wifi className="w-4 h-4" /> },
  parking: { label: '주차', icon: <Car className="w-4 h-4" /> },
  parking_free: { label: '무료주차', icon: <Car className="w-4 h-4" /> },
  breakfast: { label: '조식', icon: <Coffee className="w-4 h-4" /> },
  pool: { label: '수영장', icon: <Waves className="w-4 h-4" /> },
  spa: { label: '스파', icon: <Sparkles className="w-4 h-4" /> },
}

function todayIso() { return new Date().toISOString().slice(0, 10) }
function tomorrowIso() { return new Date(Date.now() + 86400000).toISOString().slice(0, 10) }

// 🏨 2026-07-20 (숙소 상세 SSR/OG): worker 가 __SSR_INITIAL_STAYDETAIL__ 로 주입한 payload 를
//   첫 렌더에 동기 소비 → 로더 1프레임 생략(정체성 id 일치 검증 — SPA 로 다른 숙소 이동 시 오소비 방지).
function readStaySeed(productId: number): StayDetail | null {
  try {
    const el = document.getElementById('__SSR_INITIAL_STAYDETAIL__')
    if (!el?.textContent) return null
    const p = (JSON.parse(el.textContent) as { data?: { product?: StayDetail } })?.data?.product
    return p && Number(p.id) === productId ? p : null
  } catch { return null }
}

export default function StayDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const productId = Number(id)

  const [stay, setStay] = useState<StayDetail | null>(() => readStaySeed(productId))
  const [loading, setLoading] = useState(() => !readStaySeed(productId))
  const [rooms, setRooms] = useState<AvailRoom[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)

  const [checkIn, setCheckIn] = useState(params.get('check_in') || todayIso())
  const [checkOut, setCheckOut] = useState(params.get('check_out') || tomorrowIso())
  const [guests, setGuests] = useState(Number(params.get('guests')) || 2)

  const [bookingOpen, setBookingOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<AvailRoom | null>(null)

  // 🛡️ 2026-05-19: 다객실 한 결제 — 객실 ID → 수량 map.
  const [cartQty, setCartQty] = useState<Record<number, number>>({})
  const [multiBookingOpen, setMultiBookingOpen] = useState(false)

  // 🛡️ 2026-05-18: 인플 referral — URL ?ref=USER_ID 유지.
  const referrerId = params.get('ref') || ''

  // 판매 모드 탭 (both 일 때만 사용자 선택).
  const [activeMode, setActiveMode] = useState<'date' | 'voucher'>(
    (params.get('mode') as 'date' | 'voucher') || 'date'
  )

  // voucher 모드 입력.
  const [voucherType, setVoucherType] = useState<'weekday' | 'weekend'>('weekday')
  const [voucherNights, setVoucherNights] = useState(1)

  useEffect(() => {
    if (!Number.isFinite(productId)) { navigate('/stays'); return }
    api.get(`/api/group-buy/stays/${productId}`)
      .then((r) => {
        if (r.data?.success) setStay(r.data.data.product as StayDetail)
        // 🏨 2026-07-20 (숙소 상세 SSOT 안전판): stay_info 미보유 stay_voucher(구형 딜 등)는
        //   죽은 화면 대신 일반 딜 상세로 폴백 — canonicalDetailPath 가 숙소를 /stays 로 보내는
        //   단방향 정규화의 역방향 안전판(딜 상세는 숙소로 재리다이렉트 안 하므로 루프 0).
        else navigate(`/group-buy/${productId}`, { replace: true })
      })
      .catch((err) => {
        const st = (err as { response?: { status?: number } }).response?.status
        if (st && st >= 400 && st < 500) navigate(`/group-buy/${productId}`, { replace: true })
      })
      .finally(() => setLoading(false))
  }, [productId, navigate])

  useEffect(() => {
    if (!Number.isFinite(productId)) return
    setRoomsLoading(true)
    // 🛡️ 2026-05-18: ref 도 함께 전송 → backend 가 할인 가격 계산.
    const refQs = referrerId ? `&ref=${encodeURIComponent(referrerId)}` : ''
    api.get(`/api/group-buy/stays/${productId}/availability?check_in=${checkIn}&check_out=${checkOut}${refQs}`)
      .then((r) => { if (r.data?.success) setRooms(r.data.data.rooms || []) })
      .catch(() => setRooms([]))
      .finally(() => setRoomsLoading(false))
    const p = new URLSearchParams(params)
    p.set('check_in', checkIn); p.set('check_out', checkOut); p.set('guests', String(guests))
    if (referrerId) p.set('ref', referrerId)
    if (activeMode === 'voucher') p.set('mode', 'voucher')
    setParams(p, { replace: true })
  }, [productId, checkIn, checkOut, guests, referrerId, activeMode]) // eslint-disable-line

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
  const amenitiesArr: string[] = (() => {
    if (!stay?.amenities) return []
    try { const v = JSON.parse(stay.amenities); return Array.isArray(v) ? v : [] } catch { return [] }
  })()

  // 🚑 2026-07-10 (로딩 전수조사 — 로더 전면 통일) + 2026-07-20 테마 정합: 테마-가변 BrandLoader.
  if (loading) return <BrandLoader fullScreen />
  if (!stay) return <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#0F151D] text-gray-900 dark:text-white flex items-center justify-center">숙소를 찾을 수 없습니다</div>

  // 🎨 2026-07-20 (대표 — "테마 설정이 제대로 안된 것 같아" + "PC 버전으로는 보여지지가 않네"):
  //   하드코딩 다크(#0F151D) 전면 → 라이트-first + dark: variants(소비자 토글 표면 정합).
  //   PC(lg+)는 pc-fullbleed 등재 + [좌 콘텐츠 / 우 sticky 예약 박스] 2단(딜 상세와 동일 패턴).
  //   선택자/탭은 JSX const 로 1회 정의해 모바일 인라인 + PC 아사이드 두 위치에 렌더(상태 공유).
  const isVoucherMode = stay.sale_mode === 'voucher' || (stay.sale_mode === 'both' && activeMode === 'voucher')
  const cartItems = rooms.filter((r) => (cartQty[r.room_id] || 0) > 0)
  const cartTotalQty = cartItems.reduce((s, r) => s + (cartQty[r.room_id] || 0), 0)
  const cartSubtotal = cartItems.reduce((s, r) => s + r.total_price * (cartQty[r.room_id] || 0), 0)

  const modeTabs = stay.sale_mode === 'both' ? (
    <div className="flex gap-1.5">
      {[
        { v: 'date' as const, label: '📅 날짜 지정 예약' },
        { v: 'voucher' as const, label: '🎫 숙소 이용권 (날짜 협의)' },
      ].map((m) => (
        <button
          key={m.v}
          type="button"
          onClick={() => setActiveMode(m.v)}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeMode === m.v
              ? 'bg-brand text-white'
              : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
          }`}
        >{m.label}</button>
      ))}
    </div>
  ) : null

  const inputCls = 'w-full px-3 py-2 bg-white dark:bg-[#1A2334] border border-gray-300 dark:border-[#2A3446] rounded-lg text-sm text-gray-900 dark:text-white'
  const selectorBox = (
    <div className="bg-white dark:bg-[#0F151D] border border-gray-200 dark:border-[#2A3446] rounded-xl p-4 shadow-sm">
      {isVoucherMode ? (
        <>
          {/* voucher 모드: 평일/주말 + 박수 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {!stay.voucher_weekend_only && (
              <button onClick={() => setVoucherType('weekday')}
                className={`p-3 rounded-lg text-xs font-bold ${voucherType === 'weekday' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-[#1A2334] text-gray-600 dark:text-gray-300'}`}>
                🌅 평일권 (월-목)
              </button>
            )}
            {!stay.voucher_weekday_only && (
              <button onClick={() => setVoucherType('weekend')}
                className={`p-3 rounded-lg text-xs font-bold ${voucherType === 'weekend' ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-[#1A2334] text-gray-600 dark:text-gray-300'}`}>
                🌇 주말권 (금-토)
              </button>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">박수</label>
            <input type="number" min={1} max={7} value={voucherNights}
              onChange={(e) => setVoucherNights(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
              className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 mt-2">인원</label>
            <input type="number" min={1} max={20} value={guests}
              onChange={(e) => setGuests(Number(e.target.value) || 1)}
              className={inputCls} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            ℹ️ 결제 후 매장과 직접 일정 협의 — 유효기간 {stay.voucher_validity_days || 180}일
          </p>
        </>
      ) : (
        <>
          {/* date 모드 (기존) */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">체크인</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">체크아웃</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">인원</label>
            <input type="number" min={1} max={20} value={guests} onChange={(e) => setGuests(Number(e.target.value) || 1)} className={inputCls} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{nights}박 · 체크인 {stay.check_in_time} / 체크아웃 {stay.check_out_time}</p>
        </>
      )}
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#0F151D] text-gray-900 dark:text-white pb-32 lg:pb-16">
      <SEO title={`${stay.restaurant_name || stay.name} - 유어딜`} description={stay.description} url={`/stays/${stay.id}`} />

      <div className="lg:max-w-[1200px] lg:mx-auto lg:px-8 lg:pt-5">
      {/* Hero */}
      <div className="relative aspect-[16/10] sm:aspect-[21/9] bg-gray-100 dark:bg-[#1A2334] lg:rounded-2xl lg:overflow-hidden">
        {stay.image_url && <img src={stay.image_url} alt={stay.name} className="w-full h-full object-cover" />}
        <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white lg:hidden">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-5 lg:px-0 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:items-start">
        <div className="min-w-0">
        {/* Title + meta */}
        <div className="mb-5">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mb-1">
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-white/[0.06] rounded font-semibold">{stay.property_type}</span>
            {stay.star_rating ? (
              <span className="flex items-center gap-0.5">
                {Array.from({ length: stay.star_rating }).map((_, i) => <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
              </span>
            ) : null}
          </div>
          <h1 className="text-xl lg:text-2xl font-extrabold">{stay.restaurant_name || stay.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <MapPin className="w-3 h-3" />
            <span>{stay.region_sido} {stay.region_sigungu} · {stay.address}</span>
          </div>
          {stay.avg_rating ? (
            <div className="flex items-center gap-1.5 mt-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-sm font-bold">{stay.avg_rating.toFixed(1)}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">({stay.review_count}개 리뷰)</span>
            </div>
          ) : null}
        </div>

        {/* 🛡️ 2026-05-18: 인플 referral 배너 — ref 진입 시 표시. */}
        {referrerId && stay.referral_enabled === 1 && (stay.influencer_discount_pct || 0) > 0 && (
          <div className="bg-pink-50 dark:bg-gray-800/[0.15] border border-pink-300 dark:border-pink-500/30 rounded-xl p-3 mb-3 flex items-center gap-2.5">
            <span className="text-xl">💸</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-pink-600 dark:text-pink-300">인플루언서 추천 — {stay.influencer_discount_pct}% 할인 적용</p>
              <p className="text-[10px] text-pink-500/80 dark:text-pink-200/70 mt-0.5">결제 시 자동 적용됩니다</p>
            </div>
          </div>
        )}

        {/* 모드 탭 + 날짜/인원 선택 — 모바일 인라인 (PC 는 우측 아사이드가 동일 JSX 렌더) */}
        <div className="lg:hidden space-y-3 mb-5">
          {modeTabs}
          {selectorBox}
        </div>

        {/* Description */}
        {stay.description_full && (
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-2">숙소 소개</h2>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">{stay.description_full}</p>
          </div>
        )}

        {/* Amenities */}
        {amenitiesArr.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-2">시설</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {amenitiesArr.map((a) => {
                const m = AMENITY_LABELS[a]
                return (
                  <div key={a} className="flex flex-col items-center gap-1 p-2 bg-white dark:bg-[#0F151D] rounded-lg border border-gray-200 dark:border-[#2A3446]">
                    {m?.icon || <span className="text-base">•</span>}
                    <span className="text-[10px] text-gray-600 dark:text-gray-300">{m?.label || a}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Rooms */}
        <div className="mb-5">
          <h2 className="text-sm font-bold mb-3">객실 선택 ({rooms.length})</h2>
          {roomsLoading ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">가용 객실 조회 중...</p>
          ) : rooms.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">해당 기간 가용 객실이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {rooms.map((r) => (
                <div key={r.room_id} className={`bg-white dark:bg-[#0F151D] border rounded-xl p-4 shadow-sm ${r.available ? 'border-gray-200 dark:border-[#2A3446]' : 'border-red-200 dark:border-red-900/30 opacity-60'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold">{r.name}</h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {r.bed_config && `${r.bed_config} · `}
                        기준 {r.base_guests}인 / 최대 {r.max_guests}인
                      </p>
                      {r.available ? (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                          잔여 {r.available_count}객실
                        </p>
                      ) : (
                        <p className="text-[11px] text-red-500 dark:text-red-400 mt-1">매진</p>
                      )}
                      {r.extra_guest_fee > 0 && guests > r.base_guests && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                          + 추가 {guests - r.base_guests}명 × ₩{formatNumber(r.extra_guest_fee)} × {nights}박
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-extrabold text-brand dark:text-pink-400">₩{formatNumber(r.total_price)}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{r.nights}박 총액</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">평균 ₩{formatNumber(r.avg_per_night)}/박</p>
                      {r.available && (
                        <div className="mt-2 space-y-1.5">
                          <button
                            onClick={() => { setSelectedRoom(r); setBookingOpen(true) }}
                            disabled={guests > r.max_guests}
                            className="block w-full px-3 py-1.5 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {guests > r.max_guests ? `최대 ${r.max_guests}인` : '1객실 즉시 예약'}
                          </button>
                          {/* 🛡️ 2026-05-19: 다객실 묶음 결제 — 수량 +/- */}
                          <div className="flex items-center justify-end gap-2 text-xs">
                            <span className="text-gray-500 dark:text-gray-400">묶기</span>
                            <button
                              type="button"
                              onClick={() => setCartQty((q) => ({ ...q, [r.room_id]: Math.max(0, (q[r.room_id] || 0) - 1) }))}
                              disabled={(cartQty[r.room_id] || 0) === 0}
                              className="w-6 h-6 rounded-full bg-gray-200 dark:bg-[#1A2334] text-gray-700 dark:text-white disabled:opacity-30 font-bold"
                            >−</button>
                            <span className="w-6 text-center font-bold text-gray-900 dark:text-white">{cartQty[r.room_id] || 0}</span>
                            <button
                              type="button"
                              onClick={() => setCartQty((q) => ({ ...q, [r.room_id]: Math.min(r.available_count, (q[r.room_id] || 0) + 1) }))}
                              disabled={(cartQty[r.room_id] || 0) >= Math.min(r.available_count, 10)}
                              className="w-6 h-6 rounded-full bg-brand text-white disabled:opacity-30 font-bold"
                            >+</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cancellation + House Rules */}
        <div className="space-y-4">
          <PolicyCard
            icon={<Shield className="w-4 h-4 text-amber-400" />}
            title="취소 정책"
            content={
              <>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {stay.cancellation_policy === 'flexible' && '체크인 24시간 전까지 무료 취소'}
                  {stay.cancellation_policy === 'standard' && '체크인 48시간 전 100% 환불 · 24시간 전 50% 환불'}
                  {stay.cancellation_policy === 'strict' && '체크인 72시간 전 50% 환불 · 이후 환불 불가'}
                  {stay.cancellation_policy === 'non_refundable' && '환불 불가 (대신 가격 할인)'}
                </p>
                {stay.custom_cancellation_text && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{stay.custom_cancellation_text}</p>
                )}
              </>
            }
          />
          {stay.house_rules && (
            <PolicyCard icon={<span className="text-base">📋</span>} title="하우스 룰" content={<p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">{stay.house_rules}</p>} />
          )}
          {stay.check_in_instructions && (
            <PolicyCard icon={<span className="text-base">🔑</span>} title="체크인 안내" content={<p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">{stay.check_in_instructions}</p>} />
          )}
        </div>

        </div>{/* /좌측 콘텐츠 */}

        {/* 🖥️ PC 우측 sticky 예약 박스 — 딜 상세(DealPurchaseBox)와 동일 패턴. 모바일은 인라인 + 하단바. */}
        <aside className="hidden lg:block lg:sticky lg:top-[116px] space-y-3">
          {modeTabs}
          {selectorBox}
          {cartItems.length > 0 && (
            <div className="bg-white dark:bg-[#0F151D] border border-gray-200 dark:border-[#2A3446] rounded-xl p-4 shadow-sm">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">묶음 예약 — {cartItems.length}종 / {cartTotalQty}객실</p>
              <div className="space-y-1 mb-2">
                {cartItems.map((r) => (
                  <div key={r.room_id} className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-300 truncate">{r.name} × {cartQty[r.room_id]}</span>
                    <span className="font-semibold shrink-0">₩{formatNumber(r.total_price * (cartQty[r.room_id] || 0))}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 dark:border-white/10 pt-2 mb-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">총액</span>
                <span className="text-lg font-extrabold text-brand dark:text-pink-400">₩{formatNumber(cartSubtotal)}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCartQty({})}
                  className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">비우기</button>
                <button onClick={() => setMultiBookingOpen(true)}
                  className="flex-1 py-2.5 bg-brand text-white text-sm font-bold rounded-lg hover:bg-brand-dark">
                  묶음 예약 →
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
      </div>{/* /lg 컨테이너 */}

      {bookingOpen && selectedRoom && (
        <BookingModal
          stay={stay}
          room={selectedRoom}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          nights={(stay.sale_mode === 'voucher' || (stay.sale_mode === 'both' && activeMode === 'voucher')) ? voucherNights : nights}
          saleMode={(stay.sale_mode === 'voucher' || (stay.sale_mode === 'both' && activeMode === 'voucher')) ? 'voucher' : 'date'}
          voucherType={voucherType}
          voucherNights={voucherNights}
          referrerId={referrerId}
          onClose={() => setBookingOpen(false)}
        />
      )}

      {/* 🛡️ 2026-05-19: 다객실 묶음 결제 sticky bar — 모바일 전용(PC 는 아사이드 요약이 담당).
          ⚠️ app-frame-bar 미사용(pc-fullbleed 가 숨김) + lg:hidden — pc-fullbleed 등재 전제조건. */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur border-t border-gray-200 dark:border-pink-500/30 p-3">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{cartItems.length}종 객실 / {cartTotalQty}객실</p>
              <p className="text-base font-extrabold text-brand dark:text-pink-400">₩{formatNumber(cartSubtotal)}</p>
            </div>
            <button onClick={() => setCartQty({})}
              className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">비우기</button>
            <button onClick={() => setMultiBookingOpen(true)}
              className="px-4 py-2.5 bg-brand text-white text-sm font-bold rounded-lg hover:bg-brand-dark">
              묶음 예약 →
            </button>
          </div>
        </div>
      )}

      {multiBookingOpen && (
        <MultiBookingModal
          stay={stay}
          rooms={rooms}
          cartQty={cartQty}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          nights={(stay.sale_mode === 'voucher' || (stay.sale_mode === 'both' && activeMode === 'voucher')) ? voucherNights : nights}
          saleMode={(stay.sale_mode === 'voucher' || (stay.sale_mode === 'both' && activeMode === 'voucher')) ? 'voucher' : 'date'}
          voucherType={voucherType}
          voucherNights={voucherNights}
          referrerId={referrerId}
          onClose={() => setMultiBookingOpen(false)}
        />
      )}
    </div>
  )
}

function PolicyCard({ icon, title, content }: { icon: React.ReactNode; title: string; content: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#0F151D] border border-gray-200 dark:border-[#2A3446] rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">{icon}<h3 className="text-sm font-bold">{title}</h3></div>
      {content}
    </div>
  )
}

function BookingModal({ stay, room, checkIn, checkOut, guests, nights, saleMode, voucherType, voucherNights, referrerId, onClose }: {
  stay: StayDetail; room: AvailRoom; checkIn: string; checkOut: string; guests: number; nights: number;
  saleMode: 'date' | 'voucher'; voucherType: 'weekday' | 'weekend'; voucherNights: number; referrerId: string;
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    guest_name: localStorage.getItem('user_name') || '',
    guest_phone: localStorage.getItem('user_phone') || '',
    guest_email: localStorage.getItem('user_email') || '',
    special_request: '',
  })

  async function submit() {
    if (form.guest_name.trim().length < 2) { toast.error('이름을 입력해주세요'); return }
    if (!/^\d{10,11}$/.test(form.guest_phone.replace(/\D/g, ''))) { toast.error('올바른 전화번호를 입력해주세요'); return }
    setSubmitting(true)
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('firebase_token')
      const payload: Record<string, unknown> = {
        product_id: stay.id,
        room_id: room.room_id,
        sale_mode: saleMode,
        guest_count: guests,
        guest_name: form.guest_name.trim(),
        guest_phone: form.guest_phone.trim(),
        guest_email: form.guest_email.trim() || undefined,
        special_request: form.special_request.trim() || undefined,
      }
      if (saleMode === 'date') {
        payload.check_in_date = checkIn
        payload.check_out_date = checkOut
      } else {
        payload.voucher_type = voucherType
        payload.voucher_nights = voucherNights
      }
      if (referrerId) payload.referrer_id = referrerId

      const res = await api.post('/api/group-buy/stays/bookings/create', payload,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      if (res.data?.success) {
        const { order_id } = res.data.data
        toast.success('예약 생성됨 — 결제로 이동')
        navigate(`/checkout?order_id=${order_id}&stay=1`)
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string }; status?: number } }
      if (ax.response?.status === 401) {
        toast.error('로그인이 필요합니다')
        navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      } else {
        toast.error(ax.response?.data?.error || '예약 실패')
      }
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-[10600] bg-black/60 dark:bg-black/80 backdrop-blur flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-[#0F151D] text-gray-900 dark:text-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-gray-200 dark:border-[#2A3446] max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#0F151D] px-5 py-4 border-b border-gray-200 dark:border-[#2A3446]">
          <h3 className="text-base font-bold">예약 정보</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{(stay.restaurant_name || stay.name)} · {room.name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 dark:bg-white/[0.04] rounded-lg p-3 text-xs">
            {saleMode === 'date' ? (
              <p className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">기간</span><span className="font-semibold">{checkIn} → {checkOut} ({nights}박)</span></p>
            ) : (
              <>
                <p className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">숙소 이용권</span><span className="font-semibold">{voucherType === 'weekday' ? '평일권 (월-목)' : '주말권 (금-토)'} × {voucherNights}박</span></p>
                <p className="flex justify-between mt-1"><span className="text-gray-500 dark:text-gray-400">유효기간</span><span className="font-semibold">{stay.voucher_validity_days || 180}일</span></p>
              </>
            )}
            <p className="flex justify-between mt-1"><span className="text-gray-500 dark:text-gray-400">인원</span><span className="font-semibold">{guests}명</span></p>
            {referrerId && (room.discount_pct || 0) > 0 && (
              <>
                <p className="flex justify-between mt-1"><span className="text-gray-500 dark:text-gray-400">정가</span><span className="line-through text-gray-400 dark:text-gray-500">₩{formatNumber(room.total_price)}</span></p>
                <p className="flex justify-between mt-1"><span className="text-pink-600 dark:text-pink-300">인플 할인 -{room.discount_pct}%</span><span className="font-semibold text-pink-600 dark:text-pink-300">-₩{formatNumber(room.total_price - (room.discounted_price || room.total_price))}</span></p>
              </>
            )}
            <p className="flex justify-between mt-2 pt-2 border-t border-gray-200 dark:border-white/10"><span className="text-gray-500 dark:text-gray-400">총 결제 금액</span><span className="font-extrabold text-brand dark:text-pink-400">₩{formatNumber(room.discounted_price || room.total_price)}</span></p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">예약자 이름 *</label>
            <input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-[#1A2334] border border-gray-300 dark:border-[#2A3446] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">전화번호 *</label>
            <input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} placeholder="010-1234-5678" className="w-full px-3 py-2 bg-white dark:bg-[#1A2334] border border-gray-300 dark:border-[#2A3446] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">이메일</label>
            <input type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-[#1A2334] border border-gray-300 dark:border-[#2A3446] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">특이 요청</label>
            <textarea value={form.special_request} onChange={(e) => setForm({ ...form, special_request: e.target.value })} rows={3} placeholder="예) 늦은 체크인 / 유아 침구 요청" className="w-full px-3 py-2 bg-white dark:bg-[#1A2334] border border-gray-300 dark:border-[#2A3446] rounded-lg text-sm text-gray-900 dark:text-white resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={submitting} className="flex-1 py-3 bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-white text-sm font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-white/[0.1] disabled:opacity-50">취소</button>
            <button onClick={submit} disabled={submitting} className="flex-1 py-3 bg-brand text-white text-sm font-bold rounded-lg hover:bg-brand-dark disabled:opacity-50">
              {submitting ? '예약 중...' : '결제로 →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 🛡️ 2026-05-19: 다객실 묶음 결제 모달.
function MultiBookingModal({
  stay, rooms, cartQty, checkIn, checkOut, guests, nights, saleMode, voucherType, voucherNights, referrerId, onClose,
}: {
  stay: StayDetail; rooms: AvailRoom[]; cartQty: Record<number, number>;
  checkIn: string; checkOut: string; guests: number; nights: number;
  saleMode: 'date' | 'voucher'; voucherType: 'weekday' | 'weekend'; voucherNights: number;
  referrerId: string; onClose: () => void
}) {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    guest_name: localStorage.getItem('user_name') || '',
    guest_phone: localStorage.getItem('user_phone') || '',
    guest_email: localStorage.getItem('user_email') || '',
    special_request: '',
  })

  // cart 를 (room, qty) 배열로 전개.
  const cartEntries: Array<{ room: AvailRoom; qty: number }> = []
  for (const r of rooms) {
    const q = cartQty[r.room_id] || 0
    if (q > 0) cartEntries.push({ room: r, qty: q })
  }
  const totalQty = cartEntries.reduce((s, e) => s + e.qty, 0)
  const cartSubtotal = cartEntries.reduce((s, e) => s + e.room.total_price * e.qty, 0)

  async function submit() {
    if (form.guest_name.trim().length < 2) { toast.error('이름을 입력해주세요'); return }
    if (!/^\d{10,11}$/.test(form.guest_phone.replace(/\D/g, ''))) { toast.error('올바른 전화번호'); return }
    setSubmitting(true)
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('firebase_token')
      // 각 객실 × qty 만큼 item 생성.
      const items: Record<string, unknown>[] = []
      for (const { room, qty } of cartEntries) {
        for (let i = 0; i < qty; i++) {
          const it: Record<string, unknown> = {
            room_id: room.room_id,
            guest_count: Math.min(guests, room.max_guests),
          }
          if (saleMode === 'date') {
            it.check_in_date = checkIn
            it.check_out_date = checkOut
          } else {
            it.voucher_type = voucherType
            it.voucher_nights = voucherNights
          }
          items.push(it)
        }
      }
      const payload: Record<string, unknown> = {
        product_id: stay.id,
        sale_mode: saleMode,
        guest_name: form.guest_name.trim(),
        guest_phone: form.guest_phone.trim(),
        guest_email: form.guest_email.trim() || undefined,
        special_request: form.special_request.trim() || undefined,
        items,
      }
      if (referrerId) payload.referrer_id = referrerId

      const res = await api.post('/api/group-buy/stays/bookings/create-multi', payload,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      if (res.data?.success) {
        const { order_id, items_count } = res.data.data
        toast.success(`${items_count}객실 묶음 예약 생성 — 결제로 이동`)
        navigate(`/checkout?order_id=${order_id}&stay=1&multi=1`)
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string }; status?: number } }
      if (ax.response?.status === 401) {
        toast.error('로그인이 필요합니다')
        navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      } else {
        toast.error(ax.response?.data?.error || '예약 실패')
      }
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-[10600] bg-black/60 dark:bg-black/80 backdrop-blur flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-[#0F151D] text-gray-900 dark:text-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-gray-200 dark:border-[#2A3446] max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#0F151D] px-5 py-4 border-b border-gray-200 dark:border-[#2A3446]">
          <h3 className="text-base font-bold">묶음 예약 ({totalQty}객실)</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{stay.restaurant_name || stay.name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 dark:bg-white/[0.04] rounded-lg p-3 text-xs space-y-1.5">
            {cartEntries.map(({ room, qty }) => (
              <div key={room.room_id} className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">{room.name} × {qty}</span>
                <span className="font-semibold">₩{formatNumber(room.total_price * qty)}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 dark:border-white/10 mt-2 pt-2 flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">총 금액 (할인 전)</span>
              <span className="font-extrabold text-brand dark:text-pink-400">₩{formatNumber(cartSubtotal)}</span>
            </div>
            {saleMode === 'date' ? (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">기간: {checkIn} → {checkOut} ({nights}박)</p>
            ) : (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">숙소 이용권 {voucherType === 'weekday' ? '평일권' : '주말권'} × {voucherNights}박</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">대표 예약자 이름 *</label>
            <input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-[#1A2334] border border-gray-300 dark:border-[#2A3446] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">전화번호 *</label>
            <input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} placeholder="010-1234-5678" className="w-full px-3 py-2 bg-white dark:bg-[#1A2334] border border-gray-300 dark:border-[#2A3446] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">이메일</label>
            <input type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-[#1A2334] border border-gray-300 dark:border-[#2A3446] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">특이 요청 (전체 객실 공통)</label>
            <textarea value={form.special_request} onChange={(e) => setForm({ ...form, special_request: e.target.value })} rows={3} placeholder="예) 인접 객실 배정 요청" className="w-full px-3 py-2 bg-white dark:bg-[#1A2334] border border-gray-300 dark:border-[#2A3446] rounded-lg text-sm text-gray-900 dark:text-white resize-none" />
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            ⓘ {totalQty}객실 모두 같은 sale_mode / 기간으로 예약됩니다. 인원은 객실별 최대 인원까지 자동 분배.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={submitting} className="flex-1 py-3 bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-white text-sm font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-white/[0.1] disabled:opacity-50">취소</button>
            <button onClick={submit} disabled={submitting} className="flex-1 py-3 bg-brand text-white text-sm font-bold rounded-lg hover:bg-brand-dark disabled:opacity-50">
              {submitting ? '예약 중...' : `결제로 → ₩${formatNumber(cartSubtotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
