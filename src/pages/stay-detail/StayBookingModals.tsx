/**
 * 🏨 숙소 예약 창 — 객실 하나(`BookingModal`) · 여러 객실 한 결제(`MultiBookingModal`)
 * (2026-11-03 상세 합치기 1단계 — `StayDetailPage` 에서 그대로 옮겼다. 동작 무변경.)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { PeopleIcon, CouponIcon } from '@/components/icons/urdeal-icons'
import GuestIdentityFields, { type GuestIdentity } from './GuestIdentityFields'
import type { StayDetail, AvailRoom } from './stay-detail-types'

export function BookingModal({ stay, room, checkIn, checkOut, guests, nights, saleMode, voucherType, voucherNights, referrerId, onClose }: {
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
    <div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center ur-veil p-2 sm:p-4" onClick={onClose}>
      <div className="ur-glass text-gray-900 dark:text-white w-full sm:max-w-md ur-pop-card max-h-[90dvh] overflow-y-auto ur-dialog-in" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-warm px-5 py-4 border-b border-line">
          <h3 className="text-[15px] font-bold">예약 정보</h3>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">{(stay.restaurant_name || stay.name)} · {room.name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 dark:bg-white/[0.04] rounded-lg p-3 text-[12px]">
            {saleMode === 'date' ? (
              <p className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">기간</span><span className="font-medium">{checkIn} → {checkOut} ({nights}박)</span></p>
            ) : (
              <>
                <p className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">숙소 이용권</span><span className="font-medium">{voucherType === 'weekday' ? '평일권 (월-목)' : '주말권 (금-토)'} × {voucherNights}박</span></p>
                <p className="flex justify-between mt-1"><span className="text-gray-500 dark:text-gray-400">유효기간</span><span className="font-medium">{stay.voucher_validity_days || 180}일</span></p>
              </>
            )}
            <p className="flex justify-between mt-1"><span className="text-gray-500 dark:text-gray-400">인원</span><span className="font-medium">{guests}명</span></p>
            {referrerId && (room.discount_pct || 0) > 0 && (
              <>
                <p className="flex justify-between mt-1"><span className="text-gray-500 dark:text-gray-400">정가</span><span className="line-through text-gray-400 dark:text-gray-500">₩{formatNumber(room.total_price)}</span></p>
                <p className="flex justify-between mt-1"><span className="text-brand-text ">추천 할인 -{room.discount_pct}%</span><span className="font-medium text-brand-text ">-₩{formatNumber(room.total_price - (room.discounted_price || room.total_price))}</span></p>
              </>
            )}
            <p className="flex justify-between mt-2 pt-2 border-t border-gray-200 dark:border-white/10"><span className="text-gray-500 dark:text-gray-400">총 결제 금액</span><span className="font-bold text-brand ">₩{formatNumber(room.discounted_price || room.total_price)}</span></p>
          </div>
          {/* 🧍 아는 것은 묻지 않는다 — 사유·규칙은 `./stay-detail/GuestIdentityFields` 머리주석. */}
          <GuestIdentityFields
            value={{ guest_name: form.guest_name, guest_phone: form.guest_phone, guest_email: form.guest_email }}
            onChange={(g: GuestIdentity) => setForm({ ...form, ...g })}
          />
          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">특이 요청</label>
            <textarea value={form.special_request} onChange={(e) => setForm({ ...form, special_request: e.target.value })} rows={3} placeholder="예) 늦은 체크인 / 유아 침구 요청" className="w-full px-3 py-2 bg-surface border border-rule-strong rounded-lg text-[15px] text-gray-900 dark:text-white resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={submitting} className="flex-1 py-3 bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-white text-[15px] font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-white/[0.1] disabled:opacity-50">취소</button>
            <button onClick={submit} disabled={submitting} className="flex-1 py-3 bg-brand text-white text-[15px] font-bold rounded-lg hover:bg-brand-dark disabled:opacity-50">
              {submitting ? '예약 중...' : '결제로 →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 🛡️ 2026-05-19: 다객실 묶음 결제 모달.
export function MultiBookingModal({
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
    <div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center ur-veil p-2 sm:p-4" onClick={onClose}>
      <div className="ur-glass text-gray-900 dark:text-white w-full sm:max-w-md ur-pop-card max-h-[90dvh] overflow-y-auto ur-dialog-in" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-warm px-5 py-4 border-b border-line">
          <h3 className="text-[15px] font-bold">묶음 예약 ({totalQty}객실)</h3>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">{stay.restaurant_name || stay.name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 dark:bg-white/[0.04] rounded-lg p-3 text-[12px] space-y-2">
            {cartEntries.map(({ room, qty }) => (
              <div key={room.room_id} className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">{room.name} × {qty}</span>
                <span className="font-medium">₩{formatNumber(room.total_price * qty)}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 dark:border-white/10 mt-2 pt-2 flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">총 금액 (할인 전)</span>
              <span className="font-bold text-brand ">₩{formatNumber(cartSubtotal)}</span>
            </div>
            {saleMode === 'date' ? (
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">기간: {checkIn} → {checkOut} ({nights}박)</p>
            ) : (
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">숙소 이용권 {voucherType === 'weekday' ? '평일권' : '주말권'} × {voucherNights}박</p>
            )}
          </div>
          {/* 🧍 아는 것은 묻지 않는다 — 사유·규칙은 `./stay-detail/GuestIdentityFields` 머리주석. */}
          <GuestIdentityFields nameLabel="대표 예약자 이름"
            value={{ guest_name: form.guest_name, guest_phone: form.guest_phone, guest_email: form.guest_email }}
            onChange={(g: GuestIdentity) => setForm({ ...form, ...g })}
          />
          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">특이 요청 (전체 객실 공통)</label>
            <textarea value={form.special_request} onChange={(e) => setForm({ ...form, special_request: e.target.value })} rows={3} placeholder="예) 인접 객실 배정 요청" className="w-full px-3 py-2 bg-surface border border-rule-strong rounded-lg text-[15px] text-gray-900 dark:text-white resize-none" />
          </div>
          {/* 🗑️ 2026-09-15 (대표 — "유저가 보면 어색하잖아"): 안내문 제거.
              `sale_mode` 는 **코드 식별자**인데 소비자 화면에 그대로 새어 나와 있었다. 게다가 이 모달은
              애초에 같은 상품·같은 기간으로만 담기므로(위 요약 카드가 기간을 이미 보여 준다) 그 문장은
              **사실을 새로 알려 주지도 않았다.** 인원 자동 분배도 마찬가지 — 객실별 최대 인원은 고를 때
              이미 정해졌다. ⚠️ 되살릴 거면 사용자 말로 쓸 것(예: "선택한 기간으로 함께 예약됩니다"). */}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={submitting} className="flex-1 py-3 bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-white text-[15px] font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-white/[0.1] disabled:opacity-50">취소</button>
            <button onClick={submit} disabled={submitting} className="flex-1 py-3 bg-brand text-white text-[15px] font-bold rounded-lg hover:bg-brand-dark disabled:opacity-50">
              {submitting ? '예약 중...' : `결제로 → ₩${formatNumber(cartSubtotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
