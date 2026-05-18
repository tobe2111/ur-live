/**
 * 🛡️ 2026-05-18: 셀러 숙소 예약 관리 + KPI 대시보드 (PR 4/6).
 *
 * - 상단: KPI 카드 (OCC / ADR / RevPAR / 매출)
 * - 예약 목록 (필터: 상태/기간) + 체크인/체크아웃/노쇼 처리
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Building2, TrendingUp, Calendar, Users, AlertTriangle, CheckCircle, XCircle, LogIn, LogOut as LogOutIcon, Phone } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface KPI {
  period_days: number
  total_rooms: number
  available_room_nights: number
  bookings: number
  room_nights: number
  revenue: number
  occupancy_rate: number
  adr: number
  revpar: number
  no_show_count: number
  cancelled_count: number
  refunded_count: number
  dispute_count: number
  avg_rating: number | null
  review_count: number
}

interface Booking {
  id: number
  product_id: number
  product_name: string
  room_id: number
  room_name: string
  check_in_date: string
  check_out_date: string
  nights: number
  guest_count: number
  guest_name: string
  guest_phone: string
  guest_email: string | null
  special_request: string | null
  total_amount: number
  status: string
  check_in_code: string | null
  created_at: string
  checked_in_at: string | null
  checked_out_at: string | null
  // 🛡️ 2026-05-18: voucher 모드 필드.
  sale_mode?: 'date' | 'voucher'
  voucher_type?: 'weekday' | 'weekend' | null
  voucher_expires_at?: string | null
  voucher_used_at?: string | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '결제 대기', color: 'bg-gray-100 text-gray-700' },
  confirmed: { label: '결제 완료', color: 'bg-blue-100 text-blue-700' },
  checked_in: { label: '체크인 완료', color: 'bg-emerald-100 text-emerald-700' },
  checked_out: { label: '체크아웃 완료', color: 'bg-purple-100 text-purple-700' },
  cancelled: { label: '취소됨', color: 'bg-gray-100 text-gray-500' },
  no_show: { label: '노쇼', color: 'bg-red-100 text-red-700' },
  refunded: { label: '환불됨', color: 'bg-amber-100 text-amber-700' },
  dispute: { label: '분쟁 중', color: 'bg-orange-100 text-orange-800' },
}

export default function SellerStaysBookingsPage() {
  const navigate = useNavigate()
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [days, setDays] = useState(30)

  useEffect(() => {
    const token = localStorage.getItem('seller_token')
    if (!token) { navigate('/seller/login'); return }
    loadKpi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  useEffect(() => {
    loadBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  async function loadKpi() {
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.get(`/api/seller/stays-kpi?days=${days}`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) setKpi(r.data.data as KPI)
    } catch { /* noop */ }
  }

  async function loadBookings() {
    setLoading(true)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.get(`/api/seller/stays-bookings${statusFilter ? `?status=${statusFilter}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.data?.success) setBookings(r.data.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }

  // 🛡️ 2026-05-18: voucher 사용 처리 — 매장에서 게스트가 voucher 코드 제시 시 호출.
  async function useVoucher(b: Booking) {
    const checkIn = prompt(`실제 체크인 날짜 (YYYY-MM-DD)\n게스트: ${b.guest_name}\nvoucher: ${b.check_in_code}`)
    if (!checkIn || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) { toast.error('YYYY-MM-DD 형식 필요'); return }
    const checkOut = prompt(`실제 체크아웃 날짜 (YYYY-MM-DD, ${b.nights}박 기준 ${addDays(checkIn, b.nights)})`,
      addDays(checkIn, b.nights))
    if (!checkOut || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) { toast.error('YYYY-MM-DD 형식 필요'); return }
    if (!confirm(`voucher 사용 처리\n· ${checkIn} → ${checkOut}\n게스트와 협의 완료 후 진행`)) return
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.patch(`/api/seller/stays/bookings/${b.id}/use-voucher`,
        { check_in_date: checkIn, check_out_date: checkOut },
        { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) { toast.success('voucher 사용 처리됨'); loadBookings(); loadKpi() }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '처리 실패')
    }
  }

  async function transition(bookingId: number, action: 'check-in' | 'check-out' | 'no-show') {
    const labels = { 'check-in': '체크인', 'check-out': '체크아웃', 'no-show': '노쇼' } as const
    if (!confirm(`이 예약을 ${labels[action]} 처리하시겠습니까?`)) return
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.patch(`/api/seller/stays/bookings/${bookingId}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.data?.success) { toast.success(`${labels[action]} 처리됨`); loadBookings(); loadKpi() }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '처리 실패')
    }
  }

  return (
    <SellerLayout title="숙소 예약 관리">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="숙소 예약 관리"
          subtitle="KPI 분석 + 예약 처리 (체크인 / 체크아웃 / 노쇼)"
          icon={<Building2 className="h-5 w-5" />}
          actions={
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg">
              <option value={7}>최근 7일</option>
              <option value={30}>최근 30일</option>
              <option value={90}>최근 90일</option>
            </select>
          }
        />

        {/* KPI Cards */}
        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="예약률 (OCC)"
              value={`${kpi.occupancy_rate}%`}
              sub={`${kpi.room_nights}/${kpi.available_room_nights} 객실-일`}
              color="text-emerald-600 bg-emerald-50"
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <KpiCard
              label="평균 객단가 (ADR)"
              value={`₩${formatNumber(kpi.adr)}`}
              sub="예약된 객실당"
              color="text-blue-600 bg-blue-50"
              icon={<Users className="w-5 h-5" />}
            />
            <KpiCard
              label="RevPAR"
              value={`₩${formatNumber(kpi.revpar)}`}
              sub="전체 객실당 매출"
              color="text-violet-600 bg-violet-50"
              icon={<Building2 className="w-5 h-5" />}
            />
            <KpiCard
              label={`매출 (최근 ${kpi.period_days}일)`}
              value={`₩${formatNumber(kpi.revenue)}`}
              sub={`${kpi.bookings}건 예약`}
              color="text-pink-600 bg-pink-50"
              icon={<Calendar className="w-5 h-5" />}
            />
          </div>
        )}

        {/* 경고 카드 (노쇼/분쟁 발생 시) */}
        {kpi && (kpi.no_show_count > 0 || kpi.dispute_count > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold text-amber-900">주의 — 운영 이슈</p>
              <div className="flex gap-4 mt-1 text-amber-800">
                {kpi.no_show_count > 0 && <span>노쇼 {kpi.no_show_count}건</span>}
                {kpi.dispute_count > 0 && <span>분쟁 {kpi.dispute_count}건</span>}
                {kpi.cancelled_count > 0 && <span>취소 {kpi.cancelled_count}건</span>}
                {kpi.refunded_count > 0 && <span>환불 {kpi.refunded_count}건</span>}
              </div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[
            { v: '', l: '전체' },
            { v: 'confirmed', l: '결제 완료' },
            { v: 'checked_in', l: '체크인 완료' },
            { v: 'checked_out', l: '체크아웃 완료' },
            { v: 'cancelled', l: '취소' },
            { v: 'no_show', l: '노쇼' },
            { v: 'dispute', l: '분쟁' },
          ].map((s) => (
            <button
              key={s.v}
              onClick={() => setStatusFilter(s.v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                statusFilter === s.v ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >{s.l}</button>
          ))}
        </div>

        {/* Bookings table */}
        {loading ? (
          <DashboardLoading />
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">예약이 없습니다</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                    {['숙소', '객실', '체크인-체크아웃', '게스트', '인원', '금액', '상태', '액션'].map((h) => (
                      <th key={h} className="px-3 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bookings.map((b) => {
                    const status = STATUS_LABELS[b.status] || { label: b.status, color: 'bg-gray-100' }
                    return (
                      <tr key={b.id} className="hover:bg-gray-50 text-xs">
                        <td className="px-3 py-3 font-medium text-gray-900 max-w-[140px] truncate">{b.product_name}</td>
                        <td className="px-3 py-3 text-gray-700">{b.room_name}</td>
                        <td className="px-3 py-3 text-gray-700">
                          {b.check_in_date} ~ {b.check_out_date}
                          <span className="text-gray-400 ml-1">({b.nights}박)</span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-gray-900">{b.guest_name}</p>
                          <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-2.5 h-2.5" />{b.guest_phone}
                          </p>
                          {b.check_in_code && (
                            <p className="text-[10px] text-blue-600 font-mono mt-0.5">{b.check_in_code}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-700 text-center">{b.guest_count}명</td>
                        <td className="px-3 py-3 font-bold text-gray-900">₩{formatNumber(b.total_amount)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${status.color}`}>
                            {status.label}
                          </span>
                          {b.special_request && (
                            <p className="text-[10px] text-amber-700 mt-1 max-w-[200px] truncate" title={b.special_request}>
                              ⚠ {b.special_request}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {/* 🛡️ 2026-05-18: voucher 모드 — 사용 처리 별도 버튼 (확정 상태에서만). */}
                            {b.sale_mode === 'voucher' && b.status === 'confirmed' && !b.voucher_used_at && (
                              <button onClick={() => useVoucher(b)} className="px-2 py-1 bg-pink-500 text-white text-[10px] font-bold rounded hover:bg-pink-600" title="voucher 사용 처리 (날짜 협의 후)">
                                🎫 사용 처리
                              </button>
                            )}
                            {b.sale_mode === 'voucher' && b.voucher_used_at && (
                              <span className="text-[10px] text-purple-600 font-semibold">✓ 사용 완료</span>
                            )}
                            {/* date 모드 또는 voucher 사용 전 — 일반 체크인/체크아웃/노쇼 */}
                            {b.sale_mode !== 'voucher' && b.status === 'confirmed' && (
                              <>
                                <button onClick={() => transition(b.id, 'check-in')} className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50" title="체크인">
                                  <LogIn className="w-4 h-4" />
                                </button>
                                <button onClick={() => transition(b.id, 'no-show')} className="p-1.5 rounded text-red-600 hover:bg-red-50" title="노쇼">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {b.sale_mode !== 'voucher' && b.status === 'checked_in' && (
                              <button onClick={() => transition(b.id, 'check-out')} className="p-1.5 rounded text-purple-600 hover:bg-purple-50" title="체크아웃">
                                <LogOutIcon className="w-4 h-4" />
                              </button>
                            )}
                            {b.sale_mode !== 'voucher' && b.status === 'checked_out' && (
                              <span className="text-[10px] text-purple-600 font-semibold">완료 ✓</span>
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
        )}

        {/* 평점 카드 */}
        {kpi?.avg_rating && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-900">평균 평점</p>
              <p className="text-[11px] text-gray-500">{kpi.review_count}개 리뷰</p>
            </div>
            <p className="text-xl font-extrabold text-amber-500">{kpi.avg_rating.toFixed(1)}<span className="text-xs">/5.0</span></p>
          </div>
        )}
      </div>
    </SellerLayout>
  )
}

function KpiCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] sm:text-xs font-medium text-gray-500">{label}</span>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${color} flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-lg sm:text-xl font-extrabold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function addDays(yyyymmdd: string, n: number): string {
  const d = new Date(yyyymmdd)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
