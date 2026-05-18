/**
 * 🛡️ 2026-05-18: 에이전시 숙소 모니터링 (PR 5/6).
 *
 * 담당 셀러들의 숙소 + 예약 + KPI.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Building2, TrendingUp, Users, DollarSign, Star } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface Kpi {
  total_properties: number
  total_rooms: number
  total_bookings: number
  total_revenue: number
  avg_rating: number | null
}

interface StayItem {
  id: number
  name: string
  image_url?: string
  seller_id: number
  seller_name: string
  property_type?: string
  region_sido?: string
  region_sigungu?: string
  room_count?: number
  active_bookings?: number
  total_revenue?: number
  avg_rating?: number | null
}

interface AgencyBooking {
  id: number
  product_id: number
  product_name: string
  room_name: string
  seller_id: number
  seller_name: string
  user_id: number
  check_in_date: string
  check_out_date: string
  nights: number
  guest_count: number
  guest_name: string
  total_amount: number
  status: string
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-gray-100 text-gray-700' },
  confirmed: { label: '확정', color: 'bg-blue-100 text-blue-700' },
  checked_in: { label: '체크인', color: 'bg-emerald-100 text-emerald-700' },
  checked_out: { label: '완료', color: 'bg-purple-100 text-purple-700' },
  cancelled: { label: '취소', color: 'bg-gray-100 text-gray-500' },
  no_show: { label: '노쇼', color: 'bg-red-100 text-red-700' },
  refunded: { label: '환불됨', color: 'bg-amber-100 text-amber-700' },
  dispute: { label: '분쟁', color: 'bg-orange-100 text-orange-800' },
}

export default function AgencyStaysPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'stays' | 'bookings'>('stays')
  const [kpi, setKpi] = useState<Kpi | null>(null)
  const [stays, setStays] = useState<StayItem[]>([])
  const [bookings, setBookings] = useState<AgencyBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('agency_token')) { navigate('/agency/login'); return }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadBookings() }, [statusFilter]) // eslint-disable-line

  function h() { return { Authorization: `Bearer ${localStorage.getItem('agency_token')}` } }

  async function loadAll() {
    setLoading(true)
    try {
      const [kpiR, staysR] = await Promise.all([
        api.get('/api/agency/stays/kpi', { headers: h() }),
        api.get('/api/agency/stays', { headers: h() }),
      ])
      if (kpiR.data?.success) setKpi(kpiR.data.data)
      if (staysR.data?.success) setStays(staysR.data.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }

  async function loadBookings() {
    try {
      const r = await api.get(`/api/agency/stays/bookings${statusFilter ? `?status=${statusFilter}` : ''}`, { headers: h() })
      if (r.data?.success) setBookings(r.data.data || [])
    } catch { /* noop */ }
  }

  return (
    <AgencyLayout title="담당 셀러 숙소">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="담당 셀러 숙소"
          subtitle="에이전시 담당 셀러들의 숙소 운영 현황 + 예약 통계"
          icon={<Building2 className="h-5 w-5" />}
        />

        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="숙소" value={formatNumber(kpi.total_properties)} icon={<Building2 className="w-5 h-5" />} color="text-blue-600 bg-blue-50" />
            <KpiCard label="총 객실" value={formatNumber(kpi.total_rooms)} icon={<Users className="w-5 h-5" />} color="text-emerald-600 bg-emerald-50" />
            <KpiCard label="예약" value={formatNumber(kpi.total_bookings)} icon={<TrendingUp className="w-5 h-5" />} color="text-violet-600 bg-violet-50" />
            <KpiCard label="누적 매출" value={`₩${formatNumber(kpi.total_revenue)}`} icon={<DollarSign className="w-5 h-5" />} color="text-pink-600 bg-pink-50" />
            <KpiCard label="평균 평점" value={kpi.avg_rating ? kpi.avg_rating.toFixed(1) : '-'} icon={<Star className="w-5 h-5" />} color="text-amber-600 bg-amber-50" />
          </div>
        )}

        <div className="flex gap-1 border-b border-gray-200">
          {[
            { k: 'stays' as const, l: `숙소 (${stays.length})` },
            { k: 'bookings' as const, l: '예약' },
          ].map(tb => (
            <button key={tb.k} onClick={() => setTab(tb.k)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === tb.k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tb.l}</button>
          ))}
        </div>

        {loading ? <DashboardLoading /> : (
          tab === 'stays' ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                      {['숙소', '셀러', '타입', '지역', '객실', '예약', '매출', '평점'].map(h => (
                        <th key={h} className="px-3 py-3 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stays.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 text-xs">
                        <td className="px-3 py-3 max-w-[200px] font-medium text-gray-900">{s.name}</td>
                        <td className="px-3 py-3 text-gray-700">{s.seller_name}</td>
                        <td className="px-3 py-3 text-gray-700">{s.property_type || '-'}</td>
                        <td className="px-3 py-3 text-gray-700">{s.region_sido} {s.region_sigungu}</td>
                        <td className="px-3 py-3 text-gray-700 text-center">{s.room_count || 0}</td>
                        <td className="px-3 py-3 font-semibold text-gray-900 text-center">{s.active_bookings || 0}</td>
                        <td className="px-3 py-3 font-bold">₩{formatNumber(s.total_revenue || 0)}</td>
                        <td className="px-3 py-3 text-gray-700">{s.avg_rating ? s.avg_rating.toFixed(1) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {[
                  { v: '', l: '전체' },
                  { v: 'confirmed', l: '확정' },
                  { v: 'checked_out', l: '완료' },
                  { v: 'no_show', l: '노쇼' },
                  { v: 'dispute', l: '분쟁' },
                ].map(s => (
                  <button key={s.v} onClick={() => setStatusFilter(s.v)} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${statusFilter === s.v ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
                    {s.l}
                  </button>
                ))}
              </div>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                        {['숙소', '셀러', '게스트', '기간', '금액', '상태'].map(h => (
                          <th key={h} className="px-3 py-3 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {bookings.map(b => {
                        const st = STATUS_LABELS[b.status] || { label: b.status, color: 'bg-gray-100' }
                        return (
                          <tr key={b.id} className="hover:bg-gray-50 text-xs">
                            <td className="px-3 py-3 max-w-[160px]">
                              <p className="font-medium text-gray-900 line-clamp-1">{b.product_name}</p>
                              <p className="text-[10px] text-gray-500">{b.room_name}</p>
                            </td>
                            <td className="px-3 py-3 text-gray-700">{b.seller_name}</td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-gray-900">{b.guest_name}</p>
                              <p className="text-[10px] text-gray-500">{b.guest_count}명</p>
                            </td>
                            <td className="px-3 py-3 text-gray-700">
                              {b.check_in_date} ~ {b.check_out_date}
                              <p className="text-[10px] text-gray-500">{b.nights}박</p>
                            </td>
                            <td className="px-3 py-3 font-bold">₩{formatNumber(b.total_amount)}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${st.color}`}>{st.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </AgencyLayout>
  )
}

function KpiCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] sm:text-xs font-medium text-gray-500">{label}</span>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${color} flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-base sm:text-lg font-extrabold text-gray-900">{value}</p>
    </div>
  )
}
