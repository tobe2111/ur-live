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

interface StayDetail {
  id: number
  name: string
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

export default function StayDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const productId = Number(id)

  const [stay, setStay] = useState<StayDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [rooms, setRooms] = useState<AvailRoom[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)

  const [checkIn, setCheckIn] = useState(params.get('check_in') || todayIso())
  const [checkOut, setCheckOut] = useState(params.get('check_out') || tomorrowIso())
  const [guests, setGuests] = useState(Number(params.get('guests')) || 2)

  const [bookingOpen, setBookingOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<AvailRoom | null>(null)

  useEffect(() => {
    if (!Number.isFinite(productId)) { navigate('/stays'); return }
    api.get(`/api/group-buy/stays/${productId}`)
      .then((r) => { if (r.data?.success) setStay(r.data.data.product as StayDetail) })
      .finally(() => setLoading(false))
  }, [productId, navigate])

  useEffect(() => {
    if (!Number.isFinite(productId)) return
    setRoomsLoading(true)
    api.get(`/api/group-buy/stays/${productId}/availability?check_in=${checkIn}&check_out=${checkOut}`)
      .then((r) => { if (r.data?.success) setRooms(r.data.data.rooms || []) })
      .catch(() => setRooms([]))
      .finally(() => setRoomsLoading(false))
    const p = new URLSearchParams(params)
    p.set('check_in', checkIn); p.set('check_out', checkOut); p.set('guests', String(guests))
    setParams(p, { replace: true })
  }, [productId, checkIn, checkOut, guests]) // eslint-disable-line

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
  const amenitiesArr: string[] = (() => {
    if (!stay?.amenities) return []
    try { return JSON.parse(stay.amenities) } catch { return [] }
  })()

  if (loading) return <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center">로딩 중...</div>
  if (!stay) return <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center">숙소를 찾을 수 없습니다</div>

  return (
    <div className="min-h-screen bg-[#020202] text-white pb-32">
      <SEO title={`${stay.name} - 유어딜`} description={stay.description} url={`/stays/${stay.id}`} />

      {/* Hero */}
      <div className="relative aspect-[16/10] sm:aspect-[21/9] bg-[#1A1A1A]">
        {stay.image_url && <img src={stay.image_url} alt={stay.name} className="w-full h-full object-cover" />}
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="ur-content-wide px-4 lg:px-8 py-5">
        {/* Title + meta */}
        <div className="mb-5">
          <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-1">
            <span className="px-2 py-0.5 bg-white/[0.06] rounded font-semibold">{stay.property_type}</span>
            {stay.star_rating ? (
              <span className="flex items-center gap-0.5">
                {Array.from({ length: stay.star_rating }).map((_, i) => <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
              </span>
            ) : null}
          </div>
          <h1 className="text-xl font-extrabold">{stay.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            <MapPin className="w-3 h-3" />
            <span>{stay.region_sido} {stay.region_sigungu} · {stay.address}</span>
          </div>
          {stay.avg_rating ? (
            <div className="flex items-center gap-1.5 mt-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-sm font-bold">{stay.avg_rating.toFixed(1)}</span>
              <span className="text-xs text-gray-500">({stay.review_count}개 리뷰)</span>
            </div>
          ) : null}
        </div>

        {/* Date/guest selector */}
        <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4 mb-5">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">체크인</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">체크아웃</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1">인원</label>
            <input type="number" min={1} max={20} value={guests} onChange={(e) => setGuests(Number(e.target.value) || 1)} className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm" />
          </div>
          <p className="text-xs text-gray-500 mt-2">{nights}박 · 체크인 {stay.check_in_time} / 체크아웃 {stay.check_out_time}</p>
        </div>

        {/* Description */}
        {stay.description_full && (
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-2">숙소 소개</h2>
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{stay.description_full}</p>
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
                  <div key={a} className="flex flex-col items-center gap-1 p-2 bg-[#0A0A0A] rounded-lg border border-[#1A1A1A]">
                    {m?.icon || <span className="text-base">•</span>}
                    <span className="text-[10px] text-gray-300">{m?.label || a}</span>
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
            <p className="text-xs text-gray-500">가용 객실 조회 중...</p>
          ) : rooms.length === 0 ? (
            <p className="text-xs text-gray-500">해당 기간 가용 객실이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {rooms.map((r) => (
                <div key={r.room_id} className={`bg-[#0A0A0A] border rounded-xl p-4 ${r.available ? 'border-[#1A1A1A]' : 'border-red-900/30 opacity-60'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold">{r.name}</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {r.bed_config && `${r.bed_config} · `}
                        기준 {r.base_guests}인 / 최대 {r.max_guests}인
                      </p>
                      {r.available ? (
                        <p className="text-[11px] text-emerald-400 mt-1">
                          잔여 {r.available_count}객실
                        </p>
                      ) : (
                        <p className="text-[11px] text-red-400 mt-1">매진</p>
                      )}
                      {r.extra_guest_fee > 0 && guests > r.base_guests && (
                        <p className="text-[10px] text-amber-400 mt-1">
                          + 추가 {guests - r.base_guests}명 × ₩{formatNumber(r.extra_guest_fee)} × {nights}박
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-extrabold text-pink-400">₩{formatNumber(r.total_price)}</p>
                      <p className="text-[10px] text-gray-500">{r.nights}박 총액</p>
                      <p className="text-[10px] text-gray-400">평균 ₩{formatNumber(r.avg_per_night)}/박</p>
                      {r.available && (
                        <button
                          onClick={() => { setSelectedRoom(r); setBookingOpen(true) }}
                          disabled={guests > r.max_guests}
                          className="mt-2 px-3 py-1.5 bg-pink-500 text-white text-xs font-bold rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {guests > r.max_guests ? `최대 ${r.max_guests}인` : '예약하기'}
                        </button>
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
                <p className="text-xs text-gray-300">
                  {stay.cancellation_policy === 'flexible' && '체크인 24시간 전까지 무료 취소'}
                  {stay.cancellation_policy === 'standard' && '체크인 48시간 전 100% 환불 · 24시간 전 50% 환불'}
                  {stay.cancellation_policy === 'strict' && '체크인 72시간 전 50% 환불 · 이후 환불 불가'}
                  {stay.cancellation_policy === 'non_refundable' && '환불 불가 (대신 가격 할인)'}
                </p>
                {stay.custom_cancellation_text && (
                  <p className="text-[11px] text-gray-400 mt-1">{stay.custom_cancellation_text}</p>
                )}
              </>
            }
          />
          {stay.house_rules && (
            <PolicyCard icon={<span className="text-base">📋</span>} title="하우스 룰" content={<p className="text-xs text-gray-300 whitespace-pre-line">{stay.house_rules}</p>} />
          )}
          {stay.check_in_instructions && (
            <PolicyCard icon={<span className="text-base">🔑</span>} title="체크인 안내" content={<p className="text-xs text-gray-300 whitespace-pre-line">{stay.check_in_instructions}</p>} />
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-[#1A1A1A]">
          <Link to={`/stays/${stay.id}/reviews`} className="text-xs text-blue-400 hover:underline">
            전체 리뷰 보기 →
          </Link>
        </div>
      </div>

      {bookingOpen && selectedRoom && (
        <BookingModal
          stay={stay}
          room={selectedRoom}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          nights={nights}
          onClose={() => setBookingOpen(false)}
        />
      )}
    </div>
  )
}

function PolicyCard({ icon, title, content }: { icon: React.ReactNode; title: string; content: React.ReactNode }) {
  return (
    <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<h3 className="text-sm font-bold">{title}</h3></div>
      {content}
    </div>
  )
}

function BookingModal({ stay, room, checkIn, checkOut, guests, nights, onClose }: {
  stay: StayDetail; room: AvailRoom; checkIn: string; checkOut: string; guests: number; nights: number; onClose: () => void
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
      const res = await api.post('/api/group-buy/stays/bookings/create', {
        product_id: stay.id,
        room_id: room.room_id,
        check_in_date: checkIn,
        check_out_date: checkOut,
        guest_count: guests,
        guest_name: form.guest_name.trim(),
        guest_phone: form.guest_phone.trim(),
        guest_email: form.guest_email.trim() || undefined,
        special_request: form.special_request.trim() || undefined,
      }, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
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
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-[#0A0A0A] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-[#1A1A1A] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#0A0A0A] px-5 py-4 border-b border-[#1A1A1A]">
          <h3 className="text-base font-bold">예약 정보</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{stay.name} · {room.name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-white/[0.04] rounded-lg p-3 text-xs">
            <p className="flex justify-between"><span className="text-gray-400">기간</span><span className="font-semibold">{checkIn} → {checkOut} ({nights}박)</span></p>
            <p className="flex justify-between mt-1"><span className="text-gray-400">인원</span><span className="font-semibold">{guests}명</span></p>
            <p className="flex justify-between mt-2 pt-2 border-t border-white/10"><span className="text-gray-400">총 결제 금액</span><span className="font-extrabold text-pink-400">₩{formatNumber(room.total_price)}</span></p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">예약자 이름 *</label>
            <input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">전화번호 *</label>
            <input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} placeholder="010-1234-5678" className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">이메일</label>
            <input type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">특이 요청</label>
            <textarea value={form.special_request} onChange={(e) => setForm({ ...form, special_request: e.target.value })} rows={3} placeholder="예) 늦은 체크인 / 유아 침구 요청" className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={submitting} className="flex-1 py-3 bg-white/[0.06] text-white text-sm font-semibold rounded-lg hover:bg-white/[0.1] disabled:opacity-50">취소</button>
            <button onClick={submit} disabled={submitting} className="flex-1 py-3 bg-pink-500 text-white text-sm font-bold rounded-lg hover:bg-pink-600 disabled:opacity-50">
              {submitting ? '예약 중...' : '결제로 →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
