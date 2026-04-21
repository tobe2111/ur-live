import { useState, useEffect } from 'react'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { Trophy, Star, Users, ShoppingBag, TrendingUp, Loader2 } from 'lucide-react'

export default function AgencyRankingPage() {
  const [sellers, setSellers] = useState<any[]>([])
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue')
  const [loading, setLoading] = useState(true)
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token') || ''}` }

  useEffect(() => {
    setLoading(true)
    api.get(`/api/agency/ranking?metric=${metric}`, { headers })
      .then(r => { if (r.data.success) setSellers(r.data.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [metric])

  const badges = ['👑', '💎', '⭐']

  return (
    <AgencyLayout title="셀러 랭킹">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">셀러 성과 랭킹</h1>
          <div className="flex gap-2">
            {[{ key: 'revenue' as const, label: '매출순' }, { key: 'orders' as const, label: '주문순' }].map(m => (
              <button key={m.key} onClick={() => setMetric(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${metric === m.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : sellers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">소속 셀러가 없습니다</div>
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
