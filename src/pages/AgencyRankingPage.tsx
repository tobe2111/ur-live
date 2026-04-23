import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { Trophy, Users } from 'lucide-react'

export default function AgencyRankingPage() {
  const navigate = useNavigate()
  const [sellers, setSellers] = useState<any[]>([])
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue')
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token || ''}` }

  useEffect(() => {
    if (!token) {
      navigate('/agency/login', { replace: true })
    }
  }, [token, navigate])

  useEffect(() => {
    setLoading(true)
    api.get(`/api/agency/ranking?metric=${metric}`, { headers })
      .then(r => { if (r.data.success) setSellers(r.data.data || []) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }, [metric])

  const badges = ['👑', '💎', '⭐']

  return (
    <AgencyLayout title="셀러 랭킹">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title="셀러 성과 랭킹"
          subtitle="소속 셀러의 매출/주문 순위"
          icon={<Trophy className="h-5 w-5" />}
          actions={
            <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
              {[{ key: 'revenue' as const, label: '매출순' }, { key: 'orders' as const, label: '주문순' }].map(m => (
                <button key={m.key} onClick={() => setMetric(m.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${metric === m.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          }
        />

        {loading ? (
          <DashboardLoading />
        ) : sellers.length === 0 ? (
          <DashboardEmptyState icon={<Users className="h-7 w-7" />} title="소속 셀러가 없습니다" />
        ) : (
          <div className="space-y-3">
            {sellers.map((s: { id: number; name: string; business_name?: string; total_revenue?: number; total_orders?: number; live_count?: number; avg_rating?: number; total_followers?: number; total_reviews?: number }, i: number) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0">
                  {i < 3 ? badges[i] : <span className="text-sm font-bold text-gray-400">{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.business_name}</p>
                </div>
                <div className="grid grid-cols-4 gap-4 text-center shrink-0">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{(s.total_revenue || 0).toLocaleString()}원</p>
                    <p className="text-[10px] text-gray-400">매출</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{s.total_orders || 0}</p>
                    <p className="text-[10px] text-gray-400">주문</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{s.total_followers || 0}</p>
                    <p className="text-[10px] text-gray-400">팔로워</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-yellow-500">★ {(s.avg_rating || 0).toFixed(1)}</p>
                    <p className="text-[10px] text-gray-400">리뷰 {s.total_reviews || 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
