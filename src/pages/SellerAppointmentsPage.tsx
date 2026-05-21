/**
 * 🛡️ 2026-05-21: 셀러 — 받은 예약 관리 (뷰티/액티비티/건강/펫).
 *   URL: /seller/appointments
 *   완료 / 노쇼 처리 가능.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { CalendarCheck, CheckCircle, XCircle, Phone } from 'lucide-react'

interface Appointment {
  id: number
  product_id: number
  product_name: string
  restaurant_name: string | null
  user_id: string
  user_name: string | null
  user_phone: string | null
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

export default function SellerAppointmentsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'>('confirmed')

  useEffect(() => {
    if (!localStorage.getItem('seller_token')) { navigate('/seller/login'); return }
    load()
  }, [filter])

  async function load() {
    try {
      setLoading(true)
      const status = filter === 'all' ? '' : filter
      const res = await api.get(`/api/seller/appointments${status ? '?status=' + status : ''}`)
      if (res.data?.success) setItems(res.data.data || [])
    } finally {
      setLoading(false)
    }
  }

  async function markComplete(a: Appointment) {
    if (!confirm(`${a.user_name || a.user_id} 님 이용 완료 처리하시겠습니까?`)) return
    try {
      const res = await api.patch(`/api/seller/appointments/${a.id}/complete`)
      if (res.data?.success) { toast.success('완료 처리'); load() }
      else toast.error(res.data?.error || '실패')
    } catch { toast.error('실패') }
  }

  async function markNoShow(a: Appointment) {
    if (!confirm(`${a.user_name || a.user_id} 님 노쇼 처리하시겠습니까? (취소 불가)`)) return
    try {
      const res = await api.patch(`/api/seller/appointments/${a.id}/no-show`)
      if (res.data?.success) { toast.success('노쇼 처리'); load() }
      else toast.error(res.data?.error || '실패')
    } catch { toast.error('실패') }
  }

  return (
    <SellerLayout title="예약 관리">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          icon={<CalendarCheck className="h-5 w-5" />}
          title="예약 관리"
          subtitle="고객이 잡은 예약을 확인하고 완료 / 노쇼 처리하세요."
        />

        {/* 필터 */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-2 flex-wrap">
          {(['confirmed', 'completed', 'no_show', 'cancelled', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {s === 'confirmed' ? '확정' : s === 'completed' ? '완료' : s === 'no_show' ? '노쇼' : s === 'cancelled' ? '취소' : '전체'}
            </button>
          ))}
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="p-12 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : items.length === 0 ? (
            <p className="p-12 text-center text-sm text-gray-400">해당 상태의 예약이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500">
                  <th className="px-4 py-3 text-left font-medium">일시</th>
                  <th className="px-4 py-3 text-left font-medium">상품</th>
                  <th className="px-4 py-3 text-left font-medium">고객</th>
                  <th className="px-4 py-3 text-center font-medium">상태</th>
                  <th className="px-4 py-3 text-center font-medium">처리</th>
                </tr>
              </thead>
              <tbody>
                {items.map(a => {
                  const meta = STATUS_LABEL[a.status]
                  return (
                    <tr key={a.id} className="border-t border-gray-100 text-xs">
                      <td className="px-4 py-3 font-mono text-gray-700">
                        {a.booking_date}<br />
                        <span className="text-gray-500">{a.start_time}~{a.end_time}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{a.product_name}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {a.user_name || a.user_id}
                        {a.user_phone && (
                          <a href={`tel:${a.user_phone}`} className="flex items-center gap-1 text-blue-600 mt-0.5">
                            <Phone className="w-3 h-3" /> {a.user_phone}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.status === 'confirmed' && (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => markComplete(a)} className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> 완료
                            </button>
                            <button onClick={() => markNoShow(a)} className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-medium flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> 노쇼
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </SellerLayout>
  )
}
