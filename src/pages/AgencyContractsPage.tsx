import { useState, useEffect } from 'react'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { FileText, Plus, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from '@/hooks/useToast'

export default function AgencyContractsPage() {
  const [contracts, setContracts] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ seller_id: '', start_date: '', end_date: '', terms: '' })
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token')}` }

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/api/agency/contracts', { headers }),
      api.get('/api/agency/sellers', { headers }),
    ]).then(([c, s]) => {
      setContracts(c.data.data || [])
      setSellers(s.data.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.seller_id || !form.start_date || !form.end_date) { toast.error('필수 항목을 입력해주세요'); return }
    try {
      await api.post('/api/agency/contracts', { ...form, seller_id: Number(form.seller_id) }, { headers })
      toast.success('계약 등록 완료'); setShowForm(false); load()
    } catch { toast.error('등록 실패') }
  }

  const terminate = async (id: number) => {
    if (!confirm('계약을 종료하시겠습니까?')) return
    await api.put(`/api/agency/contracts/${id}`, { status: 'terminated' }, { headers })
    load()
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <AgencyLayout title="계약 관리">
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">셀러 계약 관리</h1>
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> 계약 등록
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
            <select value={form.seller_id} onChange={e => setForm(f => ({ ...f, seller_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
              <option value="">셀러 선택</option>
              {sellers.map((s: { id: number; name: string; email: string }) => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">계약 시작일</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="text-xs text-gray-500">계약 종료일</label>
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
            </div>
            <textarea value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))}
              placeholder="계약 조건 (선택)" rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none" />
            <button onClick={handleCreate} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold">등록</button>
          </div>
        )}

        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> : contracts.length === 0 ? (
          <p className="text-center py-12 text-gray-500">등록된 계약이 없습니다</p>
        ) : (
          <div className="space-y-3">
            {contracts.map((c: { id: number; seller_name: string; seller_email?: string; start_date: string; end_date: string; terms?: string; status?: string }) => {
              const daysLeft = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000)
              const isExpiring = daysLeft <= 30 && daysLeft > 0
              const isExpired = daysLeft <= 0
              return (
                <div key={c.id} className={`bg-white rounded-xl border p-4 ${isExpired ? 'border-red-200 bg-red-50' : isExpiring ? 'border-amber-200 bg-amber-50' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className={`w-5 h-5 ${isExpired ? 'text-red-500' : isExpiring ? 'text-amber-500' : 'text-blue-500'}`} />
                      <div>
                        <p className="text-sm font-bold text-gray-900">{c.seller_name}</p>
                        <p className="text-xs text-gray-500">{c.seller_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpiring && <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><AlertTriangle className="w-3 h-3" /> 만료 {daysLeft}일 전</span>}
                      {isExpired && <span className="text-xs text-red-600 font-medium">만료됨</span>}
                      {c.status === 'terminated' && <span className="text-xs text-gray-500">종료</span>}
                      {c.status === 'active' && !isExpired && (
                        <button onClick={() => terminate(c.id)} className="text-xs text-red-500 font-medium">종료</button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>시작: {c.start_date}</span>
                    <span>종료: {c.end_date}</span>
                  </div>
                  {c.terms && <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2">{c.terms}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
