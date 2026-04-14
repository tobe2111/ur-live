import { useState, useEffect } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { UserCheck, UserX, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'

export default function AdminSellerApprovalPage() {
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  const load = () => {
    setLoading(true)
    api.get('/api/admin/tools/sellers/pending', h)
      .then(r => { if (r.data.success) setSellers(r.data.data || []) })
      .catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const approve = async (id: number) => {
    await api.put(`/api/admin/tools/sellers/${id}/approve`, {}, h)
    toast.success('승인 완료'); load()
  }
  const reject = async (id: number) => {
    const reason = prompt('거절 사유 (선택)')
    await api.put(`/api/admin/tools/sellers/${id}/reject`, { reason }, h)
    toast.info('거절됨'); load()
  }

  return (
    <AdminLayout title="셀러 승인">
      <div className="p-6 max-w-4xl">
        <h1 className="text-xl font-bold text-gray-900 mb-4">셀러 승인 대기</h1>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> : sellers.length === 0 ? (
          <p className="text-center py-12 text-gray-500">승인 대기 셀러가 없습니다</p>
        ) : (
          <div className="space-y-3">
            {sellers.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{s.name} ({s.business_name || '-'})</p>
                  <p className="text-xs text-gray-500">{s.email} · {s.phone || '-'} · 사업자 {s.business_number || '-'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">가입일: {new Date(s.created_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(s.id)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> 승인
                  </button>
                  <button onClick={() => reject(s.id)} className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1">
                    <UserX className="w-3.5 h-3.5" /> 거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
