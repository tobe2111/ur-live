import { useState, useEffect } from 'react'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DollarSign, CheckCircle, Clock, Loader2 } from 'lucide-react'

export default function AgencySettlementsPage() {
  const [data, setData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token')}` }

  useEffect(() => {
    api.get('/api/agency/settlements', { headers })
      .then(r => { if (r.data.success) { setData(r.data.data || []); setSummary(r.data.summary || {}) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <AgencyLayout title="정산 관리">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">정산 관리</h1>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '전체', value: summary.total || 0, icon: DollarSign, color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: '대기', value: summary.pending || 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: '확정', value: summary.confirmed || 0, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '완료', value: summary.completed || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 mb-4">총 정산 대상 금액: {(summary.total_amount || 0).toLocaleString()}원</p>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">주문번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">셀러</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">금액</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">정산상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">날짜</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((r: any) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono text-xs">{r.order_number}</td>
                    <td className="px-4 py-3">{r.seller_name}</td>
                    <td className="px-4 py-3 text-right font-bold">{r.total_amount?.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.settlement_status === 'completed' ? 'bg-green-100 text-green-700' :
                        r.settlement_status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{r.settlement_status === 'completed' ? '완료' : r.settlement_status === 'confirmed' ? '확정' : '대기'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
