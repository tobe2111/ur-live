/**
 * 🛡️ 2026-05-18: 어드민 숙소 모니터링 + 분쟁 관리 (PR 5/6).
 *
 * - KPI 카드 (전체 숙소 / 객실 / 예약 / 매출 / 평점)
 * - 숙소 목록 (셀러별)
 * - 예약 테이블 + 환불/분쟁 처리
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Building2, TrendingUp, Users, Star, AlertTriangle, RefreshCw, MessageSquare, DollarSign } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface Kpi {
  total_properties: number
  active_properties: number
  total_rooms: number
  total_bookings: number
  confirmed_bookings: number
  no_show_bookings: number
  total_revenue: number
  avg_rating: number | null
}

interface StayItem {
  id: number
  name: string
  image_url?: string
  seller_id: number
  seller_name: string
  business_registration_status: string | null
  property_type?: string
  region_sido?: string
  region_sigungu?: string
  star_rating?: number | null
  room_count?: number
  active_bookings?: number
  no_show_count?: number
  avg_rating?: number | null
}

interface AdminBooking {
  id: number
  product_id: number
  product_name: string
  room_name: string
  seller_id: number
  seller_name: string
  user_name: string
  user_phone: string
  check_in_date: string
  check_out_date: string
  nights: number
  guest_count: number
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

export default function AdminStaysPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'stays' | 'bookings'>('stays')
  const [kpi, setKpi] = useState<Kpi | null>(null)
  const [stays, setStays] = useState<StayItem[]>([])
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadBookings() }, [statusFilter]) // eslint-disable-line

  function header() {
    return { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [kpiR, staysR] = await Promise.all([
        api.get('/api/admin/stays/kpi', { headers: header() }),
        api.get('/api/admin/stays', { headers: header() }),
      ])
      if (kpiR.data?.success) setKpi(kpiR.data.data)
      if (staysR.data?.success) setStays(staysR.data.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }

  async function loadBookings() {
    try {
      const r = await api.get(`/api/admin/stays/bookings${statusFilter ? `?status=${statusFilter}` : ''}`, { headers: header() })
      if (r.data?.success) setBookings(r.data.data || [])
    } catch { /* noop */ }
  }

  async function refund(id: number) {
    const reason = prompt('환불 사유 (필수):')
    if (!reason?.trim()) return
    const amountStr = prompt('환불 금액 (비워두면 전액):')
    const payload: { reason: string; refund_amount?: number } = { reason: reason.trim() }
    if (amountStr) {
      const n = Number(amountStr)
      if (Number.isFinite(n) && n > 0) payload.refund_amount = n
    }
    try {
      const r = await api.patch(`/api/admin/stays/bookings/${id}/refund`, payload, { headers: header() })
      if (r.data?.success) { toast.success(r.data.message || '환불 처리'); loadBookings() }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '실패')
    }
  }

  async function markDispute(id: number) {
    const reason = prompt('분쟁 사유:')
    if (!reason?.trim()) return
    try {
      const r = await api.patch(`/api/admin/stays/bookings/${id}/dispute`, { reason: reason.trim() }, { headers: header() })
      if (r.data?.success) { toast.success('분쟁 마킹됨'); loadBookings() }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '실패')
    }
  }

  return (
    <AdminLayout title="숙소 운영">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="숙소 공구 운영"
          subtitle="전체 숙소 모니터링 + 환불/분쟁 처리"
          icon={<Building2 className="h-5 w-5" />}
          actions={
            <button onClick={loadAll} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <RefreshCw className="w-3.5 h-3.5" /> 새로고침
            </button>
          }
        />

        {/* KPI */}
        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <KpiCard label="활성 숙소" value={`${formatNumber(kpi.active_properties)}/${formatNumber(kpi.total_properties)}`} icon={<Building2 className="w-5 h-5" />} color="text-blue-600 bg-blue-50" />
            <KpiCard label="총 객실" value={formatNumber(kpi.total_rooms)} icon={<Users className="w-5 h-5" />} color="text-emerald-600 bg-emerald-50" />
            <KpiCard label="예약" value={`${formatNumber(kpi.confirmed_bookings)}/${formatNumber(kpi.total_bookings)}`} icon={<TrendingUp className="w-5 h-5" />} color="text-violet-600 bg-violet-50" />
            <KpiCard label="누적 매출" value={`₩${formatNumber(kpi.total_revenue)}`} icon={<DollarSign className="w-5 h-5" />} color="text-pink-600 bg-pink-50" />
            <KpiCard
              label="평균 평점"
              value={kpi.avg_rating ? kpi.avg_rating.toFixed(1) : '-'}
              icon={<Star className="w-5 h-5" />}
              color="text-amber-600 bg-amber-50"
              sub={kpi.no_show_bookings > 0 ? `노쇼 ${kpi.no_show_bookings}건` : undefined}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {[
            { k: 'stays' as const, l: `숙소 (${stays.length})` },
            { k: 'bookings' as const, l: '예약' },
          ].map((tb) => (
            <button
              key={tb.k}
              onClick={() => setTab(tb.k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === tb.k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >{tb.l}</button>
          ))}
        </div>

        {loading ? <DashboardLoading /> : (
          tab === 'stays' ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                      {['숙소', '셀러', '사업자등록', '타입', '지역', '객실', '예약', '평점', '노쇼'].map(h => (
                        <th key={h} className="px-3 py-3 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stays.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 text-xs">
                        <td className="px-3 py-3 max-w-[200px]">
                          <p className="font-medium text-gray-900 line-clamp-1">{s.name}</p>
                          {s.star_rating ? <p className="text-[10px] text-amber-500">{'★'.repeat(s.star_rating)}</p> : null}
                        </td>
                        <td className="px-3 py-3 text-gray-700">{s.seller_name}</td>
                        <td className="px-3 py-3">
                          {s.business_registration_status === 'verified' ? (
                            <span className="inline-flex px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 rounded">검증</span>
                          ) : s.business_registration_status === 'pending' ? (
                            <span className="inline-flex px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded">대기</span>
                          ) : (
                            <span className="inline-flex px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded">미등록</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-700">{s.property_type || '-'}</td>
                        <td className="px-3 py-3 text-gray-700">{s.region_sido} {s.region_sigungu}</td>
                        <td className="px-3 py-3 text-gray-700 text-center">{s.room_count || 0}</td>
                        <td className="px-3 py-3 font-semibold text-gray-900 text-center">{s.active_bookings || 0}</td>
                        <td className="px-3 py-3 text-gray-700">{s.avg_rating ? s.avg_rating.toFixed(1) : '-'}</td>
                        <td className="px-3 py-3">
                          {(s.no_show_count || 0) > 0 ? <span className="text-red-600 font-semibold">{s.no_show_count}건</span> : '-'}
                        </td>
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
                  { v: 'cancelled', l: '취소' },
                  { v: 'refunded', l: '환불됨' },
                  { v: 'dispute', l: '분쟁' },
                ].map(s => (
                  <button key={s.v} onClick={() => setStatusFilter(s.v)} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${statusFilter === s.v ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
                    {s.l}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                        {['숙소', '셀러', '게스트', '기간', '금액', '상태', '액션'].map(h => (
                          <th key={h} className="px-3 py-3 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {bookings.map(b => {
                        const st = STATUS_LABELS[b.status] || { label: b.status, color: 'bg-gray-100' }
                        return (
                          <tr key={b.id} className="hover:bg-gray-50 text-xs">
                            <td className="px-3 py-3 max-w-[180px]">
                              <p className="font-medium text-gray-900 line-clamp-1">{b.product_name}</p>
                              <p className="text-[10px] text-gray-500">{b.room_name}</p>
                            </td>
                            <td className="px-3 py-3 text-gray-700">{b.seller_name}</td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-gray-900">{b.user_name}</p>
                              <p className="text-[10px] text-gray-500">{b.user_phone}</p>
                            </td>
                            <td className="px-3 py-3 text-gray-700">
                              {b.check_in_date} ~ {b.check_out_date}
                              <p className="text-[10px] text-gray-500">{b.nights}박 · {b.guest_count}명</p>
                            </td>
                            <td className="px-3 py-3 font-bold">₩{formatNumber(b.total_amount)}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${st.color}`}>{st.label}</span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex gap-1">
                                {['confirmed', 'checked_in', 'no_show'].includes(b.status) && (
                                  <button onClick={() => refund(b.id)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="환불">
                                    <DollarSign className="w-4 h-4" />
                                  </button>
                                )}
                                {b.status !== 'dispute' && !['cancelled', 'refunded'].includes(b.status) && (
                                  <button onClick={() => markDispute(b.id)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="분쟁 마킹">
                                    <MessageSquare className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
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
    </AdminLayout>
  )
}

function KpiCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] sm:text-xs font-medium text-gray-500">{label}</span>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${color} flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-base sm:text-lg font-extrabold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-red-600 mt-0.5 font-semibold">⚠ {sub}</p>}
    </div>
  )
}
