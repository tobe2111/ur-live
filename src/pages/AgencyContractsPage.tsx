import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { SellerPinPrompt } from '@/components/auth/SellerPinPrompt'
import { FileText, Plus, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from '@/hooks/useToast'

export default function AgencyContractsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ seller_id: '', start_date: '', end_date: '', terms: '' })
  const [pinPrompt, setPinPrompt] = useState<null | 'create' | { id: number; status: string }>(null)
  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token || ''}` }

  useEffect(() => {
    if (!token) {
      navigate('/agency/login', { replace: true })
    }
  }, [token, navigate])

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/api/agency/contracts', { headers }),
      api.get('/api/agency/sellers', { headers }),
    ]).then(([c, s]) => {
      setContracts(c.data.data || [])
      setSellers(s.data.data || [])
    }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.seller_id || !form.start_date || !form.end_date) { toast.error('필수 항목을 입력해주세요'); return }
    try {
      await api.post('/api/agency/contracts', { ...form, seller_id: Number(form.seller_id) }, { headers })
      toast.success('계약 등록 완료'); setShowForm(false); setForm({ seller_id: '', start_date: '', end_date: '', terms: '' }); load()
    } catch (e: any) {
      const code = e?.response?.data?.code
      if (code === 'PIN_REQUIRED') { setPinPrompt('create'); return }
      if (code === 'PIN_NOT_SET') {
        toast.error('보안 PIN이 설정되지 않았어요. 프로필에서 먼저 설정해주세요.')
        navigate('/agency/profile')
        return
      }
      toast.error(e?.response?.data?.error || '등록 실패')
    }
  }

  const terminate = async (id: number) => {
    if (!confirm('계약을 종료하시겠습니까?')) return
    try {
      await api.put(`/api/agency/contracts/${id}`, { status: 'terminated' }, { headers })
      load()
    } catch (e: any) {
      const code = e?.response?.data?.code
      if (code === 'PIN_REQUIRED') { setPinPrompt({ id, status: 'terminated' }); return }
      if (code === 'PIN_NOT_SET') {
        toast.error('보안 PIN이 설정되지 않았어요. 프로필에서 먼저 설정해주세요.')
        navigate('/agency/profile')
        return
      }
      toast.error(e?.response?.data?.error || '계약 종료에 실패했습니다.')
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <AgencyLayout title={t('agency.contracts')}>
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('agency.contracts')}
          subtitle={t('agency.contractsSubtitle')}
          icon={<FileText className="h-5 w-5" />}
          actions={
            <button onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" /> 계약 등록
            </button>
          }
        />

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
      {pinPrompt && (
        <SellerPinPrompt
          role="agency"
          onVerified={async () => {
            const p = pinPrompt
            setPinPrompt(null)
            if (p === 'create') { await handleCreate(); return }
            if (typeof p === 'object' && p.id) { await terminate(p.id) }
          }}
          onCancel={() => setPinPrompt(null)}
        />
      )}
    </AgencyLayout>
  )
}
