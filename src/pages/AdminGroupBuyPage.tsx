import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Ticket, AlertCircle, RefreshCw, TrendingUp, BarChart3 } from 'lucide-react'
import { formatKST } from '@/utils/date'
import { formatNumber } from '@/utils/format'

// 🛡️ 2026-05-15: 어드민 공구 모니터링 + 강제 환불 도구.
//   기존 /admin/deals 는 결제/포인트 통계, 여기는 voucher 공구 (식사/뷰티/헬스/펫/숙박/액티비티) 전용.

interface GroupBuyRow {
  id: number
  name: string
  price: number
  image_url?: string
  category: string
  group_buy_target: number
  group_buy_current: number
  group_buy_status: 'active' | 'achieved' | 'expired' | 'cancelled' | string
  group_buy_deadline?: string
  seller_id: number
  seller_name?: string
  seller_avatar?: string
  created_at: string
  updated_at: string
}

type StatusFilter = 'all' | 'active' | 'achieved' | 'expired' | 'cancelled' | 'unsuccessful'
type Tab = 'monitor' | 'analytics'

interface AnalyticsByCategory {
  category: string
  total_groups: number
  achieved: number
  failed: number
  active: number
  total_participants: number
  total_gmv: number
}

interface AnalyticsTopGroup {
  id: number
  name: string
  category: string
  group_buy_current: number
  group_buy_target: number
  group_buy_status: string
  price: number
  gmv: number
  seller_name: string | null
}

interface AnalyticsData {
  totals: { total_groups: number; achieved_groups: number; active_groups: number; total_participants: number } | null
  by_category: AnalyticsByCategory[]
  top_groups: AnalyticsTopGroup[]
  daily: Array<{ day: string; orders: number; vouchers_issued: number; gmv: number }>
}

const CATEGORY_LABEL: Record<string, string> = {
  meal_voucher: '🍽️ 식사권',
  beauty_voucher: '💇 뷰티',
  health_voucher: '💪 헬스',
  pet_voucher: '🐶 펫',
  stay_voucher: '🏨 숙박',
  activity_voucher: '🎯 액티비티',
}

const STATUS_LABEL: Record<string, string> = {
  active: '진행중',
  achieved: '달성',
  expired: '마감',
  cancelled: '취소/환불',
}
const STATUS_COLOR: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  achieved: 'bg-green-100 text-green-700',
  expired: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-200 text-gray-600',
}

export default function AdminGroupBuyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<GroupBuyRow[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [refunding, setRefunding] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('monitor')
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }
    if (tab === 'monitor') loadList(filter)
    else loadAnalytics()
  }, [filter, tab])

  async function loadAnalytics() {
    setAnalyticsLoading(true)
    try {
      const res = await api.get('/api/group-buy/admin/analytics', {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` },
      })
      if (res.data?.success) setAnalytics(res.data.data)
    } catch (err) {
      if (import.meta.env.DEV) console.error('[admin gb analytics]', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  async function loadList(f: StatusFilter) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f === 'unsuccessful') {
        params.set('filter', 'unsuccessful')
      } else if (f !== 'all') {
        params.set('status', f)
      }
      const res = await api.get(`/api/group-buy/admin/list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` },
      })
      if (res.data?.success) setItems(res.data.data || [])
    } catch (err) {
      if (import.meta.env.DEV) console.error('[admin-gb load]', err)
    } finally {
      setLoading(false)
    }
  }

  async function forceRefund(productId: number, name: string) {
    const reason = window.prompt(
      `[강제 환불] "${name}"\n\n환불 사유를 입력하세요 (5자 이상, audit_logs 기록):`,
      ''
    )
    if (!reason || reason.trim().length < 5) return
    if (!window.confirm(`정말 환불하시겠습니까?\n\n• 미사용 voucher 모두 refunded 처리\n• 딜 결제건은 자동 환불\n• 상태 cancelled 변경\n• 참여자 + 셀러에게 알림 발송`)) return

    setRefunding(productId)
    try {
      const res = await api.post(
        `/api/group-buy/admin/force-refund/${productId}`,
        { reason: reason.trim() },
        { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` } }
      )
      if (res.data?.success) {
        alert(`✅ ${res.data.data?.refunded ?? 0}건 환불 완료`)
        loadList(filter)
      } else {
        alert(`❌ ${res.data?.error || '환불 실패'}`)
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      alert(`❌ ${e?.response?.data?.error || '환불 처리 중 오류'}`)
    } finally {
      setRefunding(null)
    }
  }

  const filtered = items
  const summary = {
    total: items.length,
    active: items.filter(i => i.group_buy_status === 'active').length,
    achieved: items.filter(i => i.group_buy_status === 'achieved').length,
    failed: items.filter(i => i.group_buy_status === 'expired' || i.group_buy_status === 'cancelled').length,
  }

  return (
    <AdminLayout title="공동구매 모니터링">
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="공동구매 모니터링"
          subtitle="진행 중 / 달성 / 미달성 / 어드민 강제 환불 + 카테고리별 analytics"
          icon={<Ticket className="h-5 w-5" />}
        />

        {/* 탭 — 모니터링 / 분석 */}
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setTab('monitor')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${tab === 'monitor' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Ticket className="w-4 h-4 inline mr-1" /> 모니터링
          </button>
          <button
            onClick={() => setTab('analytics')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${tab === 'analytics' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1" /> 분석
          </button>
        </div>

        {tab === 'analytics' && (
          analyticsLoading ? (
            <div className="py-20 flex justify-center">
              <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : analytics ? (
            <div className="space-y-5">
              {/* 전체 합계 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard label="총 공구" value={analytics.totals?.total_groups ?? 0} color="text-gray-700" />
                <SummaryCard label="진행중" value={analytics.totals?.active_groups ?? 0} color="text-blue-600" />
                <SummaryCard label="달성" value={analytics.totals?.achieved_groups ?? 0} color="text-green-600" />
                <SummaryCard label="총 참여자" value={analytics.totals?.total_participants ?? 0} color="text-pink-600" />
              </div>

              {/* 카테고리별 funnel */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1">
                  <BarChart3 className="w-4 h-4 text-pink-500" /> 카테고리별 통계
                </p>
                {analytics.by_category.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">데이터 없음</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] text-gray-500">
                        <tr><th className="text-left py-2">카테고리</th><th className="text-right">전체</th><th className="text-right">진행</th><th className="text-right">달성</th><th className="text-right">실패</th><th className="text-right">달성률</th><th className="text-right">참여자</th><th className="text-right">GMV</th></tr>
                      </thead>
                      <tbody>
                        {analytics.by_category.map(c => {
                          const finished = c.achieved + c.failed
                          const rate = finished > 0 ? Math.round((c.achieved / finished) * 100) : 0
                          return (
                            <tr key={c.category} className="border-t border-gray-100">
                              <td className="py-2 font-medium text-gray-900">{CATEGORY_LABEL[c.category] || c.category}</td>
                              <td className="text-right text-gray-700">{formatNumber(c.total_groups)}</td>
                              <td className="text-right text-blue-600">{formatNumber(c.active)}</td>
                              <td className="text-right text-green-600 font-bold">{formatNumber(c.achieved)}</td>
                              <td className="text-right text-amber-600">{formatNumber(c.failed)}</td>
                              <td className="text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${rate >= 70 ? 'bg-green-100 text-green-700' : rate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                  {rate}%
                                </span>
                              </td>
                              <td className="text-right text-gray-700">{formatNumber(c.total_participants)}</td>
                              <td className="text-right text-pink-600 font-bold">₩{formatNumber(c.total_gmv)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Top 10 GMV */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-pink-500" /> 매출 Top 10
                </p>
                {analytics.top_groups.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">데이터 없음</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.top_groups.map((g, i) => (
                      <div key={g.id} onClick={() => navigate(`/group-buy/${g.id}`)} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-300 text-orange-900' : 'bg-gray-200 text-gray-600'}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{g.name}</p>
                          <p className="text-[10px] text-gray-500">{g.seller_name || '-'} · {g.group_buy_current}/{g.group_buy_target}명</p>
                        </div>
                        <p className="text-sm font-bold text-pink-600 shrink-0">₩{formatNumber(g.gmv)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 일별 추이 */}
              {analytics.daily.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-sm font-bold text-gray-900 mb-3">📅 일별 추이 (최근 30일)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-[10px] text-gray-500"><tr><th className="text-left py-1.5">날짜</th><th className="text-right">주문수</th><th className="text-right">바우처</th><th className="text-right">GMV</th></tr></thead>
                      <tbody>
                        {analytics.daily.slice(0, 14).map(d => (
                          <tr key={d.day} className="border-t border-gray-100">
                            <td className="py-1.5 text-gray-700">{d.day}</td>
                            <td className="text-right">{formatNumber(d.orders)}</td>
                            <td className="text-right">{formatNumber(d.vouchers_issued)}</td>
                            <td className="text-right text-pink-600">₩{formatNumber(d.gmv)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null
        )}

        {tab === 'monitor' && (<>
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="전체" value={summary.total} color="text-gray-700" />
          <SummaryCard label="진행중" value={summary.active} color="text-blue-600" />
          <SummaryCard label="달성" value={summary.achieved} color="text-green-600" />
          <SummaryCard label="미달성/취소" value={summary.failed} color="text-amber-600" />
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'achieved', 'expired', 'cancelled', 'unsuccessful'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                filter === f
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f === 'all' && '전체'}
              {f === 'active' && '진행중'}
              {f === 'achieved' && '달성'}
              {f === 'expired' && '마감'}
              {f === 'cancelled' && '취소/환불'}
              {f === 'unsuccessful' && '⚠️ 미달성'}
            </button>
          ))}
          <button
            onClick={() => loadList(filter)}
            disabled={loading}
            className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 새로고침
          </button>
        </div>

        {/* 리스트 */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-bold">결과 없음</p>
            <p className="text-xs text-gray-500 mt-1">필터를 변경해보세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => {
              const progress = p.group_buy_target > 0 ? Math.min(100, (p.group_buy_current / p.group_buy_target) * 100) : 0
              const isUnsuccessful = (p.group_buy_status === 'expired' || p.group_buy_status === 'cancelled')
                && p.group_buy_target > 0 && p.group_buy_current < p.group_buy_target
              const canForceRefund = p.group_buy_status !== 'cancelled' // already cancelled = no-op

              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex gap-3">
                    {p.image_url && (
                      <img src={p.image_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" loading="lazy" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[p.group_buy_status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[p.group_buy_status] || p.group_buy_status}
                        </span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{p.category}</span>
                        <h4 className="text-sm font-bold text-gray-900 truncate">{p.name}</h4>
                      </div>
                      <p className="text-xs text-gray-500">
                        {p.seller_name || '셀러 없음'} · ₩{formatNumber(p.price)} · 등록 {formatKST(p.created_at)}
                      </p>

                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">{p.group_buy_current} / {p.group_buy_target}</span>
                          <span className="font-bold text-pink-500">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-full rounded-full transition-all ${
                              p.group_buy_status === 'achieved' ? 'bg-green-500' : isUnsuccessful ? 'bg-amber-500' : 'bg-pink-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {p.group_buy_deadline && (
                        <p className="text-[10px] text-gray-400 mt-1.5">
                          마감: {formatKST(p.group_buy_deadline)}
                        </p>
                      )}

                      {isUnsuccessful && (
                        <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <p className="text-[11px] text-amber-700">
                            미달성 — 자동 환불 cron 이 처리 중이거나 이미 처리됨. 강제 환불도 가능.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                    <button
                      onClick={() => navigate(`/group-buy/${p.id}`)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
                    >
                      상품 보기
                    </button>
                    {canForceRefund && (
                      <button
                        onClick={() => forceRefund(p.id, p.name)}
                        disabled={refunding === p.id}
                        className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 disabled:opacity-50"
                      >
                        {refunding === p.id ? '환불 중…' : '🔻 강제 환불'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </>)}
      </div>
    </AdminLayout>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
      <p className={`text-xl font-bold ${color}`}>{formatNumber(value)}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}
