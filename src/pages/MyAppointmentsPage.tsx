/**
 * 🛡️ 2026-05-21: 유저 — 내 예약 (뷰티/액티비티/건강/펫 시간 슬롯 기반).
 *   URL: /my-appointments
 *   숙소 예약은 별도 /my-stays 페이지.
 * 🛡️ 2026-06-12 (전수조사 4차 B-5): 예약 생성 플로우 추가 — 결제한 booking_required 상품의
 *   예약 가능 목록(/api/appointments/bookable) → 날짜별 슬롯(/api/products/:id/available-slots)
 *   → POST /api/appointments/book. ?from_payment=<orderId|order_number> 진입 시 해당 주문 자동 선택.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Calendar, CalendarPlus, MapPin, Phone, X } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { useMyAppointments } from '@/hooks/queries/useMyData'

interface Appointment {
  id: number
  product_id: number
  product_name: string
  image_url: string | null
  restaurant_name: string | null
  restaurant_address: string | null
  restaurant_phone: string | null
  booking_date: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'cancelled' | 'no_show' | 'completed'
  notes: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  confirmed: { label: '예약 확정', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300' },
  no_show: { label: '노쇼', cls: 'bg-red-100 text-red-700' },
  completed: { label: '이용 완료', cls: 'bg-blue-100 text-blue-700' },
}

// 🛡️ 2026-06-12 (B-5): 예약 가능(결제 완료 + booking_required + 미예약) 구매 항목.
interface BookableItem {
  order_id: number
  order_number: string | null
  order_date: string | null
  product_id: number
  product_name: string
  image_url: string | null
  restaurant_name: string | null
  booking_duration_min: number | null
}

interface AvailableSlot {
  id: number
  start_time: string
  end_time: string
  capacity: number
  booked_count: number
  remaining: number
}

export default function MyAppointmentsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  // 🛡️ 2026-06-01 Tier2: 수동 페칭 → 기존 useMyAppointments 재사용(/api/appointments/my 동일).
  const { data: appts = [], isLoading: loading, refetch } = useMyAppointments()
  const items = appts as unknown as Appointment[]

  // 🛡️ 2026-06-12 (B-5): 예약 생성 플로우 — bookable 목록 + 생성 모달.
  const [bookable, setBookable] = useState<BookableItem[]>([])
  const [bookingTarget, setBookingTarget] = useState<BookableItem | null>(null)
  const [autoSelected, setAutoSelected] = useState(false)

  async function loadBookable(): Promise<BookableItem[]> {
    try {
      const res = await api.get('/api/appointments/bookable')
      const list: BookableItem[] = res.data?.success ? (res.data.data || []) : []
      setBookable(list)
      return list
    } catch { return [] }
  }

  useEffect(() => {
    loadBookable().then((list) => {
      // ?from_payment=<orderId|order_number> — 결제 직후 진입 시 해당 주문 자동 선택.
      const fp = searchParams.get('from_payment')
      if (!fp || autoSelected) return
      const match = list.find((b) => String(b.order_id) === fp || b.order_number === fp)
      if (match) {
        setBookingTarget(match)
        setAutoSelected(true)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cancel(a: Appointment) {
    const reason = window.prompt('취소 사유를 입력하세요:')
    if (!reason) return
    try {
      const res = await api.patch(`/api/appointments/${a.id}/cancel`, { cancel_reason: reason })
      if (res.data?.success) { toast.success('취소 완료'); refetch() }
      else toast.error(res.data?.error || '취소 실패')
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '취소 실패')
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A]">
      <SEO title="내 예약 - 유어딜" description="뷰티/액티비티 예약 관리" url="/my-appointments" noindex />
      <header className="sticky top-0 md:top-14 z-40 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center justify-between px-4 lg:px-8 h-[52px]">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center" aria-label="뒤로가기">
            <ArrowLeft className="h-5 w-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">내 예약</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 lg:px-8 pb-20 pt-4">
        {/* 🛡️ 2026-06-12 (B-5): 예약 가능한 구매 — 예약 생성 입구 (기존엔 백엔드만 있고 UI 0). */}
        {bookable.length > 0 && (
          <section className="mb-5">
            <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
              <CalendarPlus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              {t('myAppointments.bookableTitle', { defaultValue: '예약을 잡아주세요' })}
              <span className="text-purple-600 dark:text-purple-400">({bookable.length})</span>
            </h2>
            <div className="space-y-2">
              {bookable.map((b) => (
                <div key={`${b.order_id}-${b.product_id}`} className="rounded-2xl border border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-900/10 p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden shrink-0">
                    {b.image_url ? <img src={b.image_url} alt={b.product_name} className="w-full h-full object-cover" loading="lazy" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white line-clamp-1">{b.product_name}</p>
                    {b.restaurant_name && <p className="text-[11px] text-gray-500 dark:text-gray-400">🏪 {b.restaurant_name}</p>}
                  </div>
                  <button
                    onClick={() => setBookingTarget(b)}
                    className="shrink-0 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg"
                  >
                    {t('myAppointments.bookCta', { defaultValue: '예약 잡기' })}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-16">불러오는 중...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">아직 예약이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(a => {
              const meta = STATUS_LABEL[a.status]
              return (
                <div key={a.id} className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden flex-shrink-0">
                      {a.image_url ? (
                        <img src={a.image_url} alt={a.product_name} className="w-full h-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{a.product_name}</p>
                        <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <p className="text-[12px] text-gray-700 dark:text-gray-300 mt-1 font-mono">
                        📅 {a.booking_date} {a.start_time} ~ {a.end_time}
                      </p>
                      {a.restaurant_name && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">🏪 {a.restaurant_name}</p>
                      )}
                      {a.restaurant_address && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {a.restaurant_address}
                        </p>
                      )}
                      {a.restaurant_phone && (
                        <a href={`tel:${a.restaurant_phone}`} className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {a.restaurant_phone}
                        </a>
                      )}
                    </div>
                  </div>
                  {a.status === 'confirmed' && (
                    <button
                      onClick={() => cancel(a)}
                      className="mt-3 w-full py-2 bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300 text-xs font-medium rounded-lg flex items-center justify-center gap-1"
                    >
                      <X className="w-3 h-3" /> 예약 취소
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {bookingTarget && (
        <AppointmentBookingModal
          item={bookingTarget}
          onClose={() => setBookingTarget(null)}
          onBooked={() => {
            setBookingTarget(null)
            refetch()
            loadBookable()
          }}
        />
      )}
    </div>
  )
}

// 🛡️ 2026-06-12 (B-5): 예약 생성 모달 — 날짜 선택 → 슬롯 조회 → 슬롯 선택 → 예약 확정.
function AppointmentBookingModal({ item, onClose, onBooked }: {
  item: BookableItem
  onClose: () => void
  onBooked: () => void
}) {
  const { t } = useTranslation()
  const todayIso = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(todayIso)
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    user_name: localStorage.getItem('user_name') || '',
    user_phone: localStorage.getItem('user_phone') || '',
    notes: '',
  })

  useEffect(() => {
    setSlotsLoading(true)
    setSelectedSlot(null)
    api.get(`/api/products/${item.product_id}/available-slots`, { params: { date } })
      .then((r) => setSlots(r.data?.success ? (r.data.data?.slots || []) : []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [item.product_id, date])

  async function submit() {
    if (!selectedSlot) return
    if (form.user_name.trim().length < 2) {
      toast.error(t('myAppointments.nameRequired', { defaultValue: '이름을 입력해주세요' }))
      return
    }
    if (!/^\d{10,11}$/.test(form.user_phone.replace(/\D/g, ''))) {
      toast.error(t('myAppointments.phoneRequired', { defaultValue: '올바른 전화번호를 입력해주세요' }))
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post('/api/appointments/book', {
        product_id: item.product_id,
        order_id: item.order_id,
        booking_date: date,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        user_name: form.user_name.trim(),
        user_phone: form.user_phone.trim(),
        notes: form.notes.trim() || undefined,
      })
      if (res.data?.success) {
        toast.success(t('myAppointments.booked', { defaultValue: '예약이 확정되었습니다' }))
        onBooked()
      } else {
        toast.error(res.data?.error || t('myAppointments.bookFailed', { defaultValue: '예약에 실패했습니다' }))
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || t('myAppointments.bookFailed', { defaultValue: '예약에 실패했습니다' }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#0A0A0A] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-gray-100 dark:border-[#1A1A1A] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-[#0A0A0A] px-5 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {t('myAppointments.modalTitle', { defaultValue: '예약 날짜·시간 선택' })}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{item.product_name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
              {t('myAppointments.dateLabel', { defaultValue: '날짜' })}
            </label>
            <input
              type="date"
              value={date}
              min={todayIso}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
              {t('myAppointments.slotLabel', { defaultValue: '시간' })}
            </label>
            {slotsLoading ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-3">
                {t('myAppointments.loadingSlots', { defaultValue: '예약 가능 시간 조회 중...' })}
              </p>
            ) : slots.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-3">
                {t('myAppointments.slotsEmpty', { defaultValue: '해당 날짜에 예약 가능한 시간이 없습니다. 다른 날짜를 선택해주세요.' })}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => (
                  <button
                    key={`${s.start_time}-${s.end_time}`}
                    type="button"
                    onClick={() => setSelectedSlot(s)}
                    className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                      selectedSlot?.start_time === s.start_time
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-[#2A2A2A] hover:border-purple-400'
                    }`}
                  >
                    {s.start_time}
                    <span className="block text-[9px] font-normal opacity-70">
                      {t('myAppointments.remaining', { defaultValue: '잔여 {{n}}', n: s.remaining })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
              {t('myAppointments.nameLabel', { defaultValue: '예약자 이름' })} *
            </label>
            <input
              value={form.user_name}
              onChange={(e) => setForm({ ...form, user_name: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
              {t('myAppointments.phoneLabel', { defaultValue: '전화번호' })} *
            </label>
            <input
              value={form.user_phone}
              onChange={(e) => setForm({ ...form, user_phone: e.target.value })}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
              {t('myAppointments.notesLabel', { defaultValue: '요청사항' })}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 dark:text-white resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {t('common.cancel', { defaultValue: '취소' })}
            </button>
            <button
              onClick={submit}
              disabled={submitting || !selectedSlot}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg disabled:opacity-50"
            >
              {submitting
                ? t('myAppointments.submitting', { defaultValue: '예약 중...' })
                : t('myAppointments.submit', { defaultValue: '예약 확정' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
