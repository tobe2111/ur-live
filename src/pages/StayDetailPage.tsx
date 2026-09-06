/**
 * 🛡️ 2026-05-18: 사용자 숙소 상세 + 예약 (PR 3/6).
 *
 * - 헤더 이미지 + 정보 + 위치 + 평점
 * - 객실 목록 (가용/가격/총액 자동 계산)
 * - 객실 선택 → 게스트 정보 입력 → 예약 생성 → /checkout 으로 이동
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { MapPin, Calendar, Users, Star, Wifi, Coffee, Car, Waves, Sparkles, Flame, Utensils, Wind, Bath, Dumbbell, Check, PawPrint, CigaretteOff, Hotel, TicketPercent } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { SectionTitle, AmenityFlow, InfoBlock, propertyTypeLabel } from './stay-detail/StayInfoSections'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import DetailGallery from './group-buy/DetailGallery'
import DetailTitleHeader from './group-buy/DetailTitleHeader'
import DetailBreadcrumb, { stayCrumbs } from '@/components/deal/DetailBreadcrumb'
import DetailFloatingHeader from '@/components/deal/DetailFloatingHeader'
import StayDateGuestPicker, { type DayPrice } from './stay-detail/StayDateGuestPicker'
import StayBookingPanel, { cancellationLabel } from './stay-detail/StayBookingPanel'
import BrandLoader from '@/components/brand/BrandLoader'

// 🗺️ 2026-07-21 (대표 "숙소 카카오맵 연결 무조건 되게"): 딜 상세와 동일한 잠금 lazy 패턴 —
//   IntersectionObserver 게이트(RestaurantMiniMap 내부)라 스크롤 도달 전 Kakao SDK 0 fetch.
const RestaurantMiniMap = lazy(() => import('@/components/RestaurantMiniMap'))

interface StayDetail {
  id: number
  name: string
  restaurant_name?: string | null  // 🏨 숙소명(오퍼명 name 과 별도) — h1 우선
  description: string
  image_url?: string
  // 🖼️ 2026-07-21: 데모 시드가 저장하는 실사진 3~5장(products.images JSON) — 스와이프 갤러리 소비.
  images?: string | null
  // 🗺️ 2026-07-21: 위치(product_stay_info psi.* 로 이미 응답에 포함) + 카카오 장소 페이지 URL(supply_meta 동봉).
  latitude?: number | null
  longitude?: number | null
  kakao_place_url?: string | null
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
  /** 🗓️ 날짜별 1박 요금/재고 — 달력에 그대로 쓴다(서버가 주는 값만). */
  dates?: Array<{ date: string; price?: number; available?: boolean }>
  discounted_price?: number
  discount_pct?: number
  avg_per_night_discounted?: number
  nights: number
  avg_per_night: number
}

// 🏨 2026-07-21 (대표 "시설 아이콘이 점으로만 뜸"): 시드가 시설을 **한글**(무료 주차/와이파이/조식 등)로
//   저장하는데 기존 매핑은 영문 키(wifi/parking)만 알아 매칭 실패 → 점(•) 폴백. 한글/영문 **키워드 매칭**으로
//   교체(부분일치) — 시드/수기/미래 표현 다 인식. 미매칭도 점 대신 체크 아이콘(설정된 시설로 보이게).
const AMENITY_ICON_CLS = 'w-4 h-4 text-gray-500 dark:text-gray-400'

function amenityMeta(a: string): { label: string; icon: React.ReactNode } {
  const s = String(a || '').toLowerCase()
  const has = (...keys: string[]) => keys.some((k) => s.includes(k))
  let icon: React.ReactNode = <Check className={AMENITY_ICON_CLS} />
  if (has('주차', 'parking')) icon = <Car className={AMENITY_ICON_CLS} />
  else if (has('와이파이', '와이', 'wifi', 'wi-fi', '인터넷')) icon = <Wifi className={AMENITY_ICON_CLS} />
  else if (has('조식', '아침', 'breakfast')) icon = <Coffee className={AMENITY_ICON_CLS} />
  else if (has('수영', '풀', 'pool')) icon = <Waves className={AMENITY_ICON_CLS} />
  else if (has('스파', '사우나', '온천', '온수풀', 'spa', 'sauna', '자쿠지', '욕조', 'bath')) icon = <Bath className={AMENITY_ICON_CLS} />
  else if (has('화로', '바비큐', 'bbq', '불멍', '캠프파이어', 'grill')) icon = <Flame className={AMENITY_ICON_CLS} />
  else if (has('취사', '주방', '조리', '키친', 'kitchen', '요리')) icon = <Utensils className={AMENITY_ICON_CLS} />
  else if (has('에어컨', '냉난방', '냉방', '난방', 'air')) icon = <Wind className={AMENITY_ICON_CLS} />
  else if (has('헬스', '피트니스', 'gym', 'fitness')) icon = <Dumbbell className={AMENITY_ICON_CLS} />
  else if (has('반려', '애견', '펫', 'pet')) icon = <PawPrint className={AMENITY_ICON_CLS} />
  else if (has('금연', 'non-smoking', 'no smoking')) icon = <CigaretteOff className={AMENITY_ICON_CLS} />
  return { label: a, icon }
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

  const heroRef = useRef<HTMLDivElement | null>(null)
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

  /**
   * 🗓️ 달력에 채울 **두 달치** 날짜별 요금. 예약 조회(availability)는 고른 기간만 주므로,
   *   달력을 채우려면 넓은 범위로 한 번 더 물어야 한다. 실패하면 빈 배열 → 달력은 요금 없이 뜬다
   *   (모르는 값을 "최저가"처럼 지어내지 않는다).
   */
  const [dayPrices, setDayPrices] = useState<DayPrice[]>([])
  useEffect(() => {
    if (!Number.isFinite(productId)) return
    const from = todayIso()
    const to = new Date(); to.setDate(to.getDate() + 62)
    const toIso = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`
    api.get(`/api/group-buy/stays/${productId}/availability?check_in=${from}&check_out=${toIso}`)
      .then((r) => {
        const rooms = (r.data?.data?.rooms || []) as AvailRoom[]
        // 여러 객실이면 그 날의 **최저가**를 쓴다(야놀자 "1박 기준 최저가"와 같은 의미).
        const best = new Map<string, DayPrice>()
        for (const room of rooms) for (const d of room.dates || []) {
          if (!d?.date) continue
          const cur = best.get(d.date)
          const price = Number(d.price) || 0
          if (!cur || (price > 0 && (!cur.price || price < cur.price))) {
            best.set(d.date, { date: d.date, price: price || cur?.price, available: (cur?.available ?? false) || d.available !== false })
          }
        }
        setDayPrices([...best.values()])
      })
      .catch(() => setDayPrices([]))
  }, [productId])

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

  // 🖼️ 2026-07-21 (대표 "사진 3~5장"): 딜 상세와 동일 병합 — image_url + images(JSON) 중복제거.
  const galleryImages: string[] = (() => {
    if (!stay) return []
    const out: string[] = []
    if (stay.image_url) out.push(stay.image_url)
    if (stay.images) {
      try {
        const arr = JSON.parse(stay.images)
        if (Array.isArray(arr)) for (const u of arr) if (typeof u === 'string' && u) out.push(u)
      } catch { /* not json */ }
    }
    return Array.from(new Set(out)).slice(0, 8)
  })()
  // 🖼️ 2026-08-19: 스와이프/화살표/도트 상태는 전부 `DetailGallery`(공용) 안으로 옮겼다 —
  //   숙소만 자체 갤러리를 갖고 있어서 이용권 상세 개편이 여기 안 닿던 문제의 근본 수리.

  // 🚑 2026-07-10 (로딩 전수조사 — 로더 전면 통일) + 2026-07-20 테마 정합: 테마-가변 BrandLoader.
  if (loading) return <BrandLoader fullScreen />
  if (!stay) return <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#11141C] text-gray-900 dark:text-white flex items-center justify-center">숙소를 찾을 수 없습니다</div>

  // 🎨 2026-07-20 (대표 — "테마 설정이 제대로 안된 것 같아" + "PC 버전으로는 보여지지가 않네"):
  //   하드코딩 다크(#11141C) 전면 → 라이트-first + dark: variants(소비자 토글 표면 정합).
  //   PC(lg+)는 pc-fullbleed 등재 + [좌 콘텐츠 / 우 sticky 예약 박스] 2단(딜 상세와 동일 패턴).
  //   선택자/탭은 JSX const 로 1회 정의해 모바일 인라인 + PC 아사이드 두 위치에 렌더(상태 공유).
  const isVoucherMode = stay.sale_mode === 'voucher' || (stay.sale_mode === 'both' && activeMode === 'voucher')
  const cartItems = rooms.filter((r) => (cartQty[r.room_id] || 0) > 0)
  const cartTotalQty = cartItems.reduce((s, r) => s + (cartQty[r.room_id] || 0), 0)
  const cartSubtotal = cartItems.reduce((s, r) => s + r.total_price * (cartQty[r.room_id] || 0), 0)

  const modeTabs = stay.sale_mode === 'both' ? (
    <div className="flex gap-1.5">
      {[
        { v: 'date' as const, label: '날짜 지정 예약' },
        { v: 'voucher' as const, label: '숙소 이용권 (날짜 협의)' },
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

  const inputCls = 'w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white'
  const selectorBox = (
    <div className="bg-white dark:bg-[#11141C] border border-gray-200 dark:border-[#2C2F35] rounded-xl p-4 shadow-sm">
      {isVoucherMode ? (
        <>
          {/* voucher 모드: 평일/주말 + 박수 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {!stay.voucher_weekend_only && (
              <button onClick={() => setVoucherType('weekday')}
                className={`p-3 rounded-lg text-xs font-bold ${voucherType === 'weekday' ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-[#1D1F29] text-gray-600 dark:text-gray-300'}`}>
                평일권 (월-목)
              </button>
            )}
            {!stay.voucher_weekday_only && (
              <button onClick={() => setVoucherType('weekend')}
                className={`p-3 rounded-lg text-xs font-bold ${voucherType === 'weekend' ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-[#1D1F29] text-gray-600 dark:text-gray-300'}`}>
                주말권 (금-토)
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
          {/* 🏨 2026-08-19 (대표 — "nol 처럼 숙소 일자 정하는 UI"): `<input type="date">` 두 개(=OS 기본
              피커)를 야놀자식 [기간·인원 트리거 → 달력/스테퍼 패널]로 교체. 며칠 묵는지와 그날 요금을
              한 화면에서 고른다. 날짜별 요금은 서버가 준 값만 쓴다(없으면 표시 안 함). */}
          <StayDateGuestPicker
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            dayPrices={dayPrices}
            maxGuests={rooms.reduce((m, r) => Math.max(m, r.max_guests || 0), 0) || 20}
            baseGuests={rooms.reduce((m, r) => Math.max(m, r.base_guests || 0), 0) || undefined}
            onApply={({ checkIn: ci, checkOut: co, guests: g }) => { setCheckIn(ci); setCheckOut(co); setGuests(g) }}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{nights}박 · 체크인 {stay.check_in_time} / 체크아웃 {stay.check_out_time}</p>
        </>
      )}
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#11141C] text-gray-900 dark:text-white pb-32 lg:pb-16">
      <SEO title={`${stay.restaurant_name || stay.name} - 유어딜`} description={stay.description} url={`/stays/${stay.id}`} />

      <div className="lg:max-w-[1200px] lg:mx-auto lg:px-8 lg:pt-5">
      {/* 🏷️ 2026-08-19 (대표 — "숙소 이용권은 이용권 상세페이지가 함께 개선이 안됐네.
          앞으로는 이런 개선은 다른 카테고리와 함께 개선이 되어야 해"):
          제목·별점·주소를 사진 **위**로 올리고(이용권 상세와 동일), 갤러리도 **같은 컴포넌트**를 쓴다.
          그 전까지 숙소는 자체 스와이프 갤러리라, 이용권 상세를 그루폰식으로 고쳐도 여기엔 안 닿았다. */}
      {/* 🔘 이용권 상세와 **같은 컴포넌트**(대표 "왜 계속 다르게 하는거지?"). 경위는 detail-hero-crop.test.ts */}
      <DetailFloatingHeader
        productId={stay.id} title={stay.restaurant_name || stay.name}
        shareDescription={[stay.region_sido, stay.region_sigungu].filter(Boolean).join(' ') || '숙소 이용권'}
        shareImageUrl={stay.image_url || ''} shareLink={`https://urdeal.kr/stays/${stay.id}`}
        myUserId={localStorage.getItem('user_id') || ''} heroRef={heroRef} onBack={() => navigate(-1)}
      />
      <DetailBreadcrumb items={stayCrumbs(propertyTypeLabel(stay.property_type))} overlayHeader />
      <DetailTitleHeader
        name={stay.restaurant_name || stay.name}
        storeName={propertyTypeLabel(stay.property_type)}
        address={[stay.region_sido, stay.region_sigungu, stay.address].filter(Boolean).join(' ')}
        rating={stay.avg_rating ?? undefined}
        reviewCount={stay.review_count ?? undefined}
      />


      <div className="px-4 py-5 lg:px-0 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:items-start">
        <div className="min-w-0">
        {/* 🖼️ 갤러리는 **좌측 컬럼 안** — 그리드 밖 풀폭이면 폭 1140px 이라 사진만 640px 로 커진다. */}
        {/* 📱 음수 마진 = 부모 `px-4 py-5` 를 모바일에서만 빠져나가기(공구 상세와 같은 풀블리드).
            `lg:` 되돌림까지가 한 쌍 — 경위는 `stay-detail-gallery-bleed.test.ts`. */}
        <div ref={heroRef} className="relative -mx-4 -mt-5 lg:mx-0 lg:mt-0 bg-gray-100 dark:bg-[#1D1F29] lg:rounded-2xl lg:overflow-hidden lg:border lg:border-gray-100 dark:lg:border-[#2C2F35]">
          <DetailGallery
            images={galleryImages}
            alt={stay.restaurant_name || stay.name}
            fallback={<Hotel className="w-14 h-14 text-gray-300 dark:text-gray-600" strokeWidth={1.4} aria-hidden />}
          />
        </div>

        {/* Title + meta — 📱 모바일 전용. PC 는 위 `DetailTitleHeader`(둘 다 그리면 제목이 두 번).
            📏 `mt-5` = 사진↔배지 간격(경위는 stay-detail-gallery-bleed.test.ts — 없으면 2px 로 붙는다). */}
        <div className="mt-5 mb-5 lg:mt-0 lg:hidden">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mb-1">
            {/* 🧭 2026-08-30: 유형 배지('호텔')를 뺐다 — 바로 위 빵부스러기의 마지막 칸이 같은 말이다. */}
            {/* ⭐ 등급을 별 아이콘 N개로 그렸었다. 브랜드 팔레트에서 amber 는 무채색으로
                리매핑돼 회색 별이 됐고(등급인지 비활성인지 안 읽힌다), 바로 아래 리뷰 평점의
                별과 두 벌이 돼 눈이 헷갈렸다. 등급은 글자가 정확하다. */}
            {stay.star_rating ? <span>{stay.star_rating}성급</span> : null}
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
          <div className="bg-brand-tint dark:bg-gray-800/[0.15] border border-rule rounded-xl p-3 mb-3 flex items-center gap-2.5">
            <TicketPercent className="w-5 h-5 shrink-0 text-brand-text " strokeWidth={1.8} aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-brand-text ">추천 할인 {stay.influencer_discount_pct}% 적용</p>
              <p className="text-[10px] text-brand-text/80 mt-0.5">결제 시 자동 적용됩니다</p>
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
          <div className="mb-6">
            <SectionTitle>숙소 소개</SectionTitle>
            <p className="mt-3 text-[14.5px] leading-[1.72] text-gray-600 dark:text-gray-300 whitespace-pre-line">{stay.description_full}</p>
          </div>
        )}

        {/* Amenities */}
        {amenitiesArr.length > 0 && (
          <div className="mb-6">
            <SectionTitle>시설</SectionTitle>
            {/* 🧾 카드 3분할이었다 — "무료 주차" 세 글자에 테두리를 하나씩 쓰던 꼴이라 화면이 시끄러웠다. */}
            <div className="mt-3">
              <AmenityFlow items={amenitiesArr.map((a) => ({ key: a, ...amenityMeta(a) }))} />
            </div>
          </div>
        )}

        {/* Rooms — 📱 모바일 카드. 🖥️ PC(lg+)는 우측 `StayBookingPanel` 의 객실 행이 담당(B안) → 여기 숨김. */}
        <div className="mb-5 lg:hidden">
          <SectionTitle className="mb-3">객실 선택 ({rooms.length})</SectionTitle>
          {roomsLoading ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">가용 객실 조회 중...</p>
          ) : rooms.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">해당 기간 가용 객실이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {rooms.map((r) => (
                /* 🛏️ 2026-08-30 (대표 "AI 티 안나는 디자인으로") — 객실 카드 재구성.
                   이전엔 카드 오른쪽 절반에 [가격 → 작은 로즈 버튼 → "묶기 − 0 +" 스테퍼]가
                   세로로 쌓여 있었다. 한 카드에 누를 것이 둘이라 무엇이 주 행동인지 안 읽히고,
                   버튼이 오른쪽에만 걸쳐 균형도 깨졌다. ⇒ 위: 정보↔가격, 아래: 전폭 CTA + 스테퍼. */
                <div key={r.room_id} className={`bg-white dark:bg-[#11141C] border rounded-xl p-4 ${r.available ? 'border-gray-200 dark:border-[#2C2F35]' : 'border-gray-200 dark:border-[#2C2F35] opacity-55'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-bold tracking-tight">{r.name}</h3>
                      <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-1">
                        {r.bed_config && `${r.bed_config} · `}
                        기준 {r.base_guests}인 / 최대 {r.max_guests}인
                      </p>
                      <p className={`text-[12.5px] mt-0.5 ${r.available ? 'text-gray-500 dark:text-gray-400' : 'text-red-500 dark:text-red-400 font-semibold'}`}>
                        {r.available ? `잔여 ${r.available_count}객실` : '매진'}
                      </p>
                      {r.extra_guest_fee > 0 && guests > r.base_guests && (
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                          추가 {guests - r.base_guests}명 × ₩{formatNumber(r.extra_guest_fee)} × {nights}박 포함
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {/* 💰 가격은 잉크. 로즈는 '행동'(CTA)에만 — 가격까지 로즈면 강조가 소음이 된다. */}
                      <p className="text-[19px] font-extrabold tracking-tight text-gray-900 dark:text-white leading-none">₩{formatNumber(r.total_price)}</p>
                      <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1.5">{r.nights}박 총액</p>
                      <p className="text-[12px] text-gray-500 dark:text-gray-400">1박 평균 ₩{formatNumber(r.avg_per_night)}</p>
                    </div>
                  </div>
                  {r.available && (
                    <div className="flex items-stretch gap-2 mt-3.5">
                      <button
                        onClick={() => { setSelectedRoom(r); setBookingOpen(true) }}
                        disabled={guests > r.max_guests}
                        className="flex-1 h-11 rounded-xl bg-brand text-white text-[14px] font-bold hover:bg-brand-dark disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        {guests > r.max_guests ? `최대 ${r.max_guests}인까지` : '이 객실 예약'}
                      </button>
                      {/* 여러 객실을 한 번에 담는 보조 경로 — 주 CTA 와 나란히 두되 무게는 낮춘다. */}
                      <div className="flex items-center gap-1 h-11 px-2 rounded-xl border border-gray-200 dark:border-[#2C2F35]">
                        <button
                          type="button"
                          aria-label="객실 수 줄이기"
                          onClick={() => setCartQty((q) => ({ ...q, [r.room_id]: Math.max(0, (q[r.room_id] || 0) - 1) }))}
                          disabled={(cartQty[r.room_id] || 0) === 0}
                          className="w-7 h-7 rounded-full text-gray-600 dark:text-gray-300 disabled:opacity-25 font-bold"
                        >−</button>
                        <span className="w-5 text-center text-[14px] font-bold tabular-nums text-gray-900 dark:text-white">{cartQty[r.room_id] || 0}</span>
                        <button
                          type="button"
                          aria-label="객실 수 늘리기"
                          onClick={() => setCartQty((q) => ({ ...q, [r.room_id]: Math.min(r.available_count, (q[r.room_id] || 0) + 1) }))}
                          disabled={(cartQty[r.room_id] || 0) >= Math.min(r.available_count, 10)}
                          className="w-7 h-7 rounded-full text-gray-600 dark:text-gray-300 disabled:opacity-25 font-bold"
                        >+</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 🗺️ 위치 — 카카오맵 미니맵 + 매장(숙소) 페이지 연결 (딜 상세 RestaurantMiniMap 재사용).
            좌표(psi.latitude/longitude) 있으면 즉시 마커, 없어도 주소 지오코딩 폴백 → 항상 연결. */}
        {(stay.address || (stay.latitude != null && stay.longitude != null)) && (
          <div className="mb-5">
            <SectionTitle className="mb-3">위치</SectionTitle>
            {/* 🩸 `isolate`: 카카오맵 내부 레이어(z≥1)가 루트 스택에 참여해 우측 달력 팝오버 위로 올라왔다.
                지도를 자기 스택 컨텍스트에 가두고, 아사이드엔 z 를 준다(둘이 한 쌍). */}
            <Suspense fallback={<div className="h-[220px] rounded-2xl bg-gray-100 dark:bg-[#1D1F29]" />}>
              <div className="relative isolate z-0">
              <RestaurantMiniMap
                name={stay.restaurant_name || stay.name}
                address={stay.address}
                lat={stay.latitude}
                lng={stay.longitude}
                placeUrl={stay.kakao_place_url}
              />
              </div>
            </Suspense>
          </div>
        )}

        {/* 이용 안내 — 🧾 2026-08-30: 카드 3장(취소/하우스룰/체크인, 이모지 📋🔑 머리)이 각각
            테두리를 갖고 있었다. 공구 상세 '이용 안내'와 같은 헤어라인 표 하나로 합친다 —
            상세끼리 문법이 갈리는 것 자체가 티가 난다. */}
        <div className="mb-6">
          <SectionTitle>이용 안내</SectionTitle>
          <div className="mt-4">
            <InfoBlock label="취소 정책">
              {cancellationLabel(stay.cancellation_policy)}
              {stay.custom_cancellation_text && (
                <span className="block mt-1 text-[13px] text-gray-500 dark:text-gray-400">{stay.custom_cancellation_text}</span>
              )}
            </InfoBlock>
            {stay.house_rules && (
              <InfoBlock label="하우스 룰">
                <span className="whitespace-pre-line">{stay.house_rules}</span>
              </InfoBlock>
            )}
            {stay.check_in_instructions && (
              <InfoBlock label="체크인 안내">
                <span className="whitespace-pre-line">{stay.check_in_instructions}</span>
              </InfoBlock>
            )}
          </div>
        </div>

        </div>{/* /좌측 콘텐츠 */}

        {/* 🖥️ PC 우측 sticky 예약 패널 — B안(2026-09-02). `lg:z-20`: sticky 는 스택 컨텍스트를 만드는데
            z 가 없으면 지도 레이어 아래로 깔린다(달력이 지도에 가려지던 사고). */}
        <aside className="hidden lg:block lg:sticky lg:top-[116px] lg:z-20">
          <StayBookingPanel
            modeTabs={modeTabs}
            selector={selectorBox}
            rooms={rooms}
            roomsLoading={roomsLoading}
            cartQty={cartQty}
            setCartQty={setCartQty}
            guests={guests}
            nights={isVoucherMode ? voucherNights : nights}
            cancellation={cancellationLabel(stay.cancellation_policy)}
            onBook={() => setMultiBookingOpen(true)}
          />
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
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur border-t border-gray-200 p-3">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{cartItems.length}종 객실 / {cartTotalQty}객실</p>
              <p className="text-base font-extrabold text-brand ">₩{formatNumber(cartSubtotal)}</p>
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
      <div className="bg-white dark:bg-[#11141C] text-gray-900 dark:text-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-gray-200 dark:border-[#2C2F35] max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#11141C] px-5 py-4 border-b border-gray-200 dark:border-[#2C2F35]">
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
                <p className="flex justify-between mt-1"><span className="text-brand-text ">추천 할인 -{room.discount_pct}%</span><span className="font-semibold text-brand-text ">-₩{formatNumber(room.total_price - (room.discounted_price || room.total_price))}</span></p>
              </>
            )}
            <p className="flex justify-between mt-2 pt-2 border-t border-gray-200 dark:border-white/10"><span className="text-gray-500 dark:text-gray-400">총 결제 금액</span><span className="font-extrabold text-brand ">₩{formatNumber(room.discounted_price || room.total_price)}</span></p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">예약자 이름 *</label>
            <input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">전화번호 *</label>
            <input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} placeholder="010-1234-5678" className="w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">이메일</label>
            <input type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">특이 요청</label>
            <textarea value={form.special_request} onChange={(e) => setForm({ ...form, special_request: e.target.value })} rows={3} placeholder="예) 늦은 체크인 / 유아 침구 요청" className="w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white resize-none" />
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
      <div className="bg-white dark:bg-[#11141C] text-gray-900 dark:text-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-gray-200 dark:border-[#2C2F35] max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#11141C] px-5 py-4 border-b border-gray-200 dark:border-[#2C2F35]">
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
              <span className="font-extrabold text-brand ">₩{formatNumber(cartSubtotal)}</span>
            </div>
            {saleMode === 'date' ? (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">기간: {checkIn} → {checkOut} ({nights}박)</p>
            ) : (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">숙소 이용권 {voucherType === 'weekday' ? '평일권' : '주말권'} × {voucherNights}박</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">대표 예약자 이름 *</label>
            <input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">전화번호 *</label>
            <input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} placeholder="010-1234-5678" className="w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">이메일</label>
            <input type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">특이 요청 (전체 객실 공통)</label>
            <textarea value={form.special_request} onChange={(e) => setForm({ ...form, special_request: e.target.value })} rows={3} placeholder="예) 인접 객실 배정 요청" className="w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white resize-none" />
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
