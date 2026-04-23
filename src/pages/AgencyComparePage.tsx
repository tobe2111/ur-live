import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { BarChart2 } from 'lucide-react'

export default function AgencyComparePage() {
  const navigate = useNavigate()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token || ''}` }

  useEffect(() => {
    if (!token) {
      navigate('/agency/login', { replace: true })
    }
  }, [token, navigate])

  useEffect(() => {
    setLoading(true)
    api.get(`/api/agency/sellers/compare?period=${period}`, { headers })
      .then(r => { if (r.data.success) setData(r.data.data || []) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }).finally(() => setLoading(false))
  }, [period])

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1)

  return (
    <AgencyLayout title="셀러 비교">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title="셀러 성과 비교"
          subtitle="기간별 매출, 주문, 라이브 비교"
          icon={<BarChart2 className="h-5 w-5" />}
          actions={
            <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
              {[{ v: '7', l: '7일' }, { v: '30', l: '30일' }, { v: '90', l: '90일' }].map(p => (
                <button key={p.v} onClick={() => setPeriod(p.v)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${period === p.v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                  {p.l}
                </button>
              ))}
            </div>
          }
        />
        {loading ? <DashboardLoading /> : data.length === 0 ? (
          <DashboardEmptyState icon={<BarChart2 className="h-7 w-7" />} title="데이터가 없습니다" description="아직 비교할 셀러가 등록되지 않았어요" />
        ) : (
          <div className="space-y-3">
            {data.map((s, i) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                    <span className="text-sm font-bold text-gray-900">{s.name}</span>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{Number(s.revenue).toLocaleString()}원</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                  <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${(s.revenue / maxRevenue) * 100}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>주문 {s.order_count}건</span>
                  <span>라이브 {s.live_count + s.ended_streams}회</span>
                  {s.live_count > 0 && <span className="text-red-500 font-medium">현재 방송 중</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
