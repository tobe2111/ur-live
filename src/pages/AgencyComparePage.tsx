import { useState, useEffect } from 'react'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { BarChart2, Loader2 } from 'lucide-react'

export default function AgencyComparePage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token') || ''}` }

  useEffect(() => {
    setLoading(true)
    api.get(`/api/agency/sellers/compare?period=${period}`, { headers })
      .then(r => { if (r.data.success) setData(r.data.data || []) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [period])

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1)

  return (
    <AgencyLayout title="셀러 비교">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">셀러 성과 비교</h1>
          <div className="flex gap-2">
            {[{ v: '7', l: '7일' }, { v: '30', l: '30일' }, { v: '90', l: '90일' }].map(p => (
              <button key={p.v} onClick={() => setPeriod(p.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${period === p.v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {p.l}
              </button>
            ))}
          </div>
        </div>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> : data.length === 0 ? (
          <p className="text-center py-12 text-gray-500">데이터가 없습니다</p>
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
