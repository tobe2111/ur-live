/**
 * 🛡️ 2026-05-02: TD-018 분할 — AdminPage 매출 추이 막대 차트 (recharts 미사용).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'

export default function AdminRevenueChart() {
  const [data, setData] = useState<{ date: string; revenue: number }[]>([])
  const [days, setDays] = useState(14)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  useEffect(() => {
    api.get(`/api/admin/tools/chart/revenue?days=${days}`, h)
      .then(r => { if (r.data.success) setData(r.data.data || []) })
      .catch(() => { /* empty chart is shown on error */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])
  const max = Math.max(...data.map(d => d.revenue), 1)
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">매출 추이</h3>
        <div className="flex gap-1">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-2 py-1 rounded text-xs font-medium ${days === d ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}>{d}일</button>
          ))}
        </div>
      </div>
      <div className="flex items-end gap-1 overflow-x-auto scrollbar-hide" style={{ minHeight: 160 }}>
        {data.slice(-14).map(d => (
          <div key={d.date} className="flex flex-col items-center flex-1 min-w-[28px]">
            <span className="text-[9px] text-gray-500 mb-1">{(d.revenue / 10000).toFixed(0)}만</span>
            <div className="w-full bg-gray-100 rounded-t" style={{ height: `${Math.max(4, (d.revenue / max) * 120)}px` }}>
              <div className="w-full h-full bg-emerald-500 rounded-t" />
            </div>
            <span className="text-[9px] text-gray-400 mt-1">{d.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
