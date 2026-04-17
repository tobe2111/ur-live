import { useState, useEffect } from 'react'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { Target, Loader2, Check } from 'lucide-react'
import { toast } from '@/hooks/useToast'

export default function AgencyTargetsPage() {
  const [targets, setTargets] = useState<any[]>([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token')}` }

  const load = (m: string) => {
    setLoading(true)
    api.get(`/api/agency/targets?month=${m}`, { headers })
      .then(r => { if (r.data.success) setTargets(r.data.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(month) }, [month])

  const handleSave = async (sellerId: number) => {
    const amount = parseInt(editValue) || 0
    try {
      await api.put('/api/agency/targets', { seller_id: sellerId, month, target_amount: amount }, { headers })
      toast.success('목표가 설정되었습니다')
      setEditId(null)
      load(month)
    } catch { toast.error('저장 실패') }
  }

  return (
    <AgencyLayout title="매출 목표">
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">셀러 매출 목표</h1>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : targets.length === 0 ? (
          <p className="text-center py-12 text-gray-500">소속 셀러가 없습니다</p>
        ) : (
          <div className="space-y-3">
            {targets.map((t: { seller_id: number; seller_name: string; target_amount: number; current_amount: number }) => {
              const pct = t.target_amount > 0 ? Math.min(100, Math.round((t.current_amount / t.target_amount) * 100)) : 0
              return (
                <div key={t.seller_id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-bold text-gray-900">{t.seller_name}</span>
                    </div>
                    {editId === t.seller_id ? (
                      <div className="flex items-center gap-2">
                        <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                          placeholder="목표 금액" className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                        <button onClick={() => handleSave(t.seller_id)} className="p-1.5 bg-blue-600 text-white rounded-lg">
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditId(t.seller_id); setEditValue(String(t.target_amount || '')) }}
                        className="text-xs text-blue-600 font-medium">
                        {t.target_amount > 0 ? '수정' : '목표 설정'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                    <span>현재 매출: <b className="text-gray-900">{Number(t.current_amount).toLocaleString()}원</b></span>
                    {t.target_amount > 0 && <span>목표: <b className="text-gray-900">{Number(t.target_amount).toLocaleString()}원</b></span>}
                  </div>
                  {t.target_amount > 0 && (
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {t.target_amount > 0 && (
                    <p className={`text-xs mt-1 font-medium ${pct >= 100 ? 'text-green-600' : 'text-gray-500'}`}>
                      {pct >= 100 ? '목표 달성!' : `달성률 ${pct}%`}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
