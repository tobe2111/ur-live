import { useState, useEffect } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DollarSign, Loader2, CheckCircle } from 'lucide-react'
import { toast } from '@/hooks/useToast'

export default function AdminSettlementsBulkPage() {
  const [pending, setPending] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [processing, setProcessing] = useState(false)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  useEffect(() => { if (!localStorage.getItem("admin_token")) { navigate("/admin/login", { replace: true }); return } }, [navigate])
  useEffect(() => {
    api.get('/api/admin/tools/settlements/pending', h)
      .then(r => { if (r.data.success) setPending(r.data.data || []) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggleAll = () => setSelected(selected.length === pending.length ? [] : pending.map(p => p.seller_id))
  const toggle = (id: number) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const process = async () => {
    if (!selected.length) return
    if (!confirm(`${selected.length}명의 셀러 정산을 처리하시겠습니까?`)) return
    setProcessing(true)
    try {
      const res = await api.post('/api/admin/tools/settlements/process', { seller_ids: selected }, h)
      toast.success(res.data.message)
      setPending(prev => prev.filter(p => !selected.includes(p.seller_id)))
      setSelected([])
    } catch { toast.error('처리 실패') }
    finally { setProcessing(false) }
  }

  return (
    <AdminLayout title="정산 일괄 처리">
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">정산 일괄 처리</h1>
          {selected.length > 0 && (
            <button onClick={process} disabled={processing}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {selected.length}명 정산 처리
            </button>
          )}
        </div>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> : pending.length === 0 ? (
          <p className="text-center py-12 text-gray-500">정산 대기 건이 없습니다</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <input type="checkbox" checked={selected.length === pending.length} onChange={toggleAll} className="w-4 h-4" />
              <span className="text-sm text-gray-500">전체 선택 ({pending.length}명)</span>
            </div>
            {pending.map(p => (
              <div key={p.seller_id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                <input type="checkbox" checked={selected.includes(p.seller_id)} onChange={() => toggle(p.seller_id)} className="w-4 h-4" />
                <DollarSign className="w-4 h-4 text-green-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{p.seller_name} ({p.business_name || '-'})</p>
                  <p className="text-xs text-gray-500">{p.order_count}건 · 총 {Number(p.total_amount).toLocaleString()}원 · 수수료 {Math.round(p.commission).toLocaleString()}원</p>
                </div>
                <p className="text-sm font-bold text-green-600">{(Number(p.total_amount) - Math.round(p.commission)).toLocaleString()}원</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
