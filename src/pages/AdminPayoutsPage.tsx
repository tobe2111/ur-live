/**
 * 🛡️ 2026-05-21 Phase C: 어드민 통합 정산 페이지.
 *   /admin/payouts
 *
 * - pending 잔액 조회 (ledger credit - 이미 처리된 payouts)
 * - "정산 일괄 생성" 버튼 → pending payouts row 생성
 * - 각 payout: 승인 → 송금 완료 (transaction_id 입력) → audit
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Wallet, CheckCircle, Send, XCircle } from 'lucide-react'
import { formatWon } from '@/utils/format'

interface Payout {
  id: number
  payee_type: 'store_owner' | 'seller' | 'agency' | 'user'
  payee_id: string
  amount: number
  period_start: string
  period_end: string
  status: 'pending' | 'approved' | 'sent' | 'failed' | 'cancelled'
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
  transaction_id: string | null
  admin_memo: string | null
  error_message: string | null
  created_at: string
  approved_at: string | null
  sent_at: string | null
}

interface PendingRow {
  account: string
  pending_amount: number
  total_credited: number
  total_paid: number
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: '검토 대기', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: '승인됨', cls: 'bg-blue-100 text-blue-700' },
  sent: { label: '송금 완료', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: '실패', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-600' },
}

export default function AdminPayoutsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'pending_ledger' | 'payouts'>('pending_ledger')
  const [pending, setPending] = useState<PendingRow[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [filter, setFilter] = useState<'pending' | 'approved' | 'sent' | 'all'>('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    load()
  }, [tab, filter])

  async function load() {
    try {
      setLoading(true)
      if (tab === 'pending_ledger') {
        const res = await api.get('/api/admin/payouts/pending')
        if (res.data?.success) setPending(res.data.data || [])
      } else {
        const res = await api.get(`/api/admin/payouts?status=${filter}`)
        if (res.data?.success) setPayouts(res.data.data || [])
      }
    } finally { setLoading(false) }
  }

  async function generate() {
    if (!confirm('지난주 정산 일괄 생성 (10,000원 이상 잔액만)?')) return
    try {
      const res = await api.post('/api/admin/payouts/generate', {})
      if (res.data?.success) {
        toast.success(`${res.data.data.created}건 생성됨`)
        setTab('payouts')
      } else toast.error(res.data?.error || '실패')
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '실패')
    }
  }

  async function approve(p: Payout) {
    if (!confirm(`${formatWon(p.amount)} 송금 승인하시겠습니까?`)) return
    try {
      const res = await api.patch(`/api/admin/payouts/${p.id}/approve`)
      if (res.data?.success) { toast.success('승인됨'); load() }
      else toast.error(res.data?.error || '실패')
    } catch { toast.error('실패') }
  }

  async function markSent(p: Payout) {
    const txId = window.prompt(`송금 transaction_id 입력 (은행 거래번호 또는 토스 ID):\n계좌: ${p.bank_name || ''} ${p.account_number || ''} (${p.account_holder || ''})\n금액: ${formatWon(p.amount)}`)
    if (!txId) return
    try {
      const res = await api.patch(`/api/admin/payouts/${p.id}/sent`, { transaction_id: txId.trim() })
      if (res.data?.success) { toast.success('송금 완료 마킹'); load() }
      else toast.error(res.data?.error || '실패')
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '실패')
    }
  }

  async function cancel(p: Payout) {
    const reason = window.prompt('취소 사유:')
    if (!reason) return
    try {
      const res = await api.patch(`/api/admin/payouts/${p.id}/cancel`, { reason })
      if (res.data?.success) { toast.success('취소됨'); load() }
      else toast.error(res.data?.error || '실패')
    } catch { toast.error('실패') }
  }

  return (
    <AdminLayout title="통합 정산">
      <DashboardPageHeader
        icon={<Wallet className="w-5 h-5" />}
        title="통합 정산 (Payouts)"
        subtitle="ledger 잔액 확인 + 주 1회 정산 일괄 생성 + 송금 처리"
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTab('pending_ledger')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'pending_ledger' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          📊 ledger 잔액
        </button>
        <button
          onClick={() => setTab('payouts')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'payouts' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          💸 payouts 목록
        </button>
        <button
          onClick={generate}
          className="ml-auto px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
        >
          + 지난주 정산 생성
        </button>
      </div>

      {tab === 'pending_ledger' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="p-12 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : pending.length === 0 ? (
            <p className="p-12 text-center text-sm text-gray-400">정산 대기 잔액 없음.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500">
                  <th className="px-4 py-3 text-left">계정</th>
                  <th className="px-4 py-3 text-right">총 발생액</th>
                  <th className="px-4 py-3 text-right">이미 송금</th>
                  <th className="px-4 py-3 text-right">미정산 잔액</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p, i) => (
                  <tr key={i} className="border-t border-gray-100 text-xs">
                    <td className="px-4 py-3 font-mono">{p.account}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatWon(p.total_credited)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatWon(p.total_paid)}</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700">{formatWon(p.pending_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 flex items-center gap-2">
            {(['pending', 'approved', 'sent', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {s === 'pending' ? '검토 대기' : s === 'approved' ? '승인됨' : s === 'sent' ? '송금 완료' : '전체'}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <p className="p-12 text-center text-sm text-gray-400">불러오는 중...</p>
            ) : payouts.length === 0 ? (
              <p className="p-12 text-center text-sm text-gray-400">해당 상태의 payouts 없음.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-3 text-left">생성일</th>
                    <th className="px-4 py-3 text-left">수령자</th>
                    <th className="px-4 py-3 text-right">금액</th>
                    <th className="px-4 py-3 text-left">계좌</th>
                    <th className="px-4 py-3 text-center">상태</th>
                    <th className="px-4 py-3 text-center">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => {
                    const meta = STATUS_LABEL[p.status]
                    return (
                      <tr key={p.id} className="border-t border-gray-100 text-xs">
                        <td className="px-4 py-3 text-gray-700">{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono">{p.payee_type}:{p.payee_id}</div>
                          <div className="text-[10px] text-gray-400">{p.period_start} ~ {p.period_end}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{formatWon(p.amount)}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {p.account_holder || '-'}
                          {p.account_number && <div className="font-mono text-[10px]">{p.account_number}</div>}
                          {p.transaction_id && <div className="text-[10px] text-emerald-600">TX: {p.transaction_id}</div>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.status === 'pending' && (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => approve(p)} className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> 승인
                              </button>
                              <button onClick={() => cancel(p)} className="px-2 py-1 bg-gray-500 text-white rounded text-[10px] flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> 취소
                              </button>
                            </div>
                          )}
                          {p.status === 'approved' && (
                            <button onClick={() => markSent(p)} className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] flex items-center gap-1 mx-auto">
                              <Send className="w-3 h-3" /> 송금완료
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
