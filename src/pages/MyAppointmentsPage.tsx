/**
 * 🛡️ 2026-05-21: 유저 — 내 예약 (뷰티/액티비티/건강/펫 시간 슬롯 기반).
 *   URL: /my-appointments
 *   숙소 예약은 별도 /my-stays 페이지.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Phone, X } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'

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
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-600' },
  no_show: { label: '노쇼', cls: 'bg-red-100 text-red-700' },
  completed: { label: '이용 완료', cls: 'bg-blue-100 text-blue-700' },
}

export default function MyAppointmentsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true)
      const res = await api.get('/api/appointments/my')
      if (res.data?.success) setItems(res.data.data || [])
    } finally { setLoading(false) }
  }

  async function cancel(a: Appointment) {
    const reason = window.prompt('취소 사유를 입력하세요:')
    if (!reason) return
    try {
      const res = await api.patch(`/api/appointments/${a.id}/cancel`, { cancel_reason: reason })
      if (res.data?.success) { toast.success('취소 완료'); load() }
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
    </div>
  )
}
