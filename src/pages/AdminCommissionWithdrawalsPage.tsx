/**
 * 🛡️ 2026-05-21: 어드민 추천 commission 출금 승인 페이지.
 *   - referral_commissions (status=withdrawal_requested) 합산된 commission_withdrawals
 *     row 를 승인/거절.
 *   - 승인 시: 어드민이 외부 (은행) 송금 후 paid_out 으로 commission 일괄 전환.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Wallet, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatWon } from '@/utils/format'

interface Withdrawal {
  id: number
  beneficiary_id: string
  beneficiary_type: 'user' | 'seller' | 'agency'
  beneficiary_name?: string | null
  total_amount: number
  commission_count: number
  status: 'pending' | 'approved' | 'rejected'
  bank_name: string
  account_number: string
  account_holder: string
  requested_at: string
  processed_at: string | null
  admin_memo: string | null
  rejection_reason: string | null
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: '대기', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: '송금완료', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '거절', cls: 'bg-red-100 text-red-700' },
}

export default function AdminCommissionWithdrawalsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [rows, setRows] = useState<Withdrawal[]>([])
  const [actionId, setActionId] = useState<number | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }
    load()
  }, [navigate, filter])

  async function load() {
    try {
      setLoading(true)
      const res = await api.get(`/api/referral-tree/admin/withdrawals?status=${filter}`)
      if (res.data.success) setRows(res.data.data || [])
    } catch (e) {
      console.error('load withdrawals', e)
      toast.error('불러오기 실패')
    } finally {
      setLoading(false)
    }
  }

  async function approve(w: Withdrawal) {
    const memo = window.prompt(
      `[${w.bank_name} ${w.account_number} (${w.account_holder})] ${formatWon(w.total_amount)} 송금 완료를 확인합니다.\n메모 (선택):`,
      '',
    )
    if (memo === null) return
    try {
      setActionId(w.id)
      const res = await api.patch(`/api/referral-tree/admin/withdrawals/${w.id}/approve`, { admin_memo: memo || null })
      if (res.data.success) {
        toast.success('승인 완료 — commission paid_out 으로 전환됨')
        load()
      } else {
        toast.error(res.data.error || '실패')
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '승인 실패')
    } finally {
      setActionId(null)
    }
  }

  async function reject(w: Withdrawal) {
    const reason = window.prompt('거절 사유를 입력하세요:')
    if (!reason || !reason.trim()) return
    try {
      setActionId(w.id)
      const res = await api.patch(`/api/referral-tree/admin/withdrawals/${w.id}/reject`, { rejection_reason: reason.trim() })
      if (res.data.success) {
        toast.success('거절 처리 — commission 은 다시 granted 상태로 복원됨')
        load()
      } else {
        toast.error(res.data.error || '실패')
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '거절 실패')
    } finally {
      setActionId(null)
    }
  }

  return (
    <AdminLayout title="추천 Commission 출금 관리">
      <DashboardPageHeader
        icon={<Wallet className="w-5 h-5" />}
        title="추천 Commission 출금 관리"
        subtitle="에이전시/셀러/유저의 추천 commission 출금 신청을 승인하거나 거절합니다."
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {s === 'pending' ? '대기' : s === 'approved' ? '송금완료' : s === 'rejected' ? '거절' : '전체'}
          </button>
        ))}
        <div className="ml-auto text-xs text-gray-500">{rows.length}건</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
            <Clock className="w-8 h-8 text-gray-300" />
            <p className="text-sm">해당 상태의 출금 신청이 없습니다.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-xs text-gray-500">
                <th className="px-4 py-3 text-left font-medium">신청일</th>
                <th className="px-4 py-3 text-left font-medium">수령자</th>
                <th className="px-4 py-3 text-right font-medium">금액</th>
                <th className="px-4 py-3 text-left font-medium">계좌</th>
                <th className="px-4 py-3 text-center font-medium">상태</th>
                <th className="px-4 py-3 text-center font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(w => {
                const meta = STATUS_LABEL[w.status]
                return (
                  <tr key={w.id} className="border-t border-gray-100 text-xs">
                    <td className="px-4 py-3 text-gray-700">
                      <div>{new Date(w.requested_at).toLocaleDateString('ko-KR')}</div>
                      <div className="text-[10px] text-gray-400">{new Date(w.requested_at).toLocaleTimeString('ko-KR')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{w.beneficiary_name || w.beneficiary_id}</div>
                      <div className="text-[10px] text-gray-500">{w.beneficiary_type} · {w.commission_count}건</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatWon(w.total_amount)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{w.bank_name}</div>
                      <div className="font-mono text-[11px]">{w.account_number}</div>
                      <div className="text-[10px] text-gray-500">{w.account_holder}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>
                      {w.rejection_reason && (
                        <div className="text-[10px] text-red-500 mt-1 max-w-[160px] line-clamp-2">{w.rejection_reason}</div>
                      )}
                      {w.admin_memo && (
                        <div className="text-[10px] text-gray-500 mt-1 max-w-[160px] line-clamp-2">{w.admin_memo}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {w.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            disabled={actionId === w.id}
                            onClick={() => approve(w)}
                            className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" /> 송금완료
                          </button>
                          <button
                            disabled={actionId === w.id}
                            onClick={() => reject(w)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" /> 거절
                          </button>
                        </div>
                      ) : w.processed_at ? (
                        <div className="text-[10px] text-gray-500">{new Date(w.processed_at).toLocaleString('ko-KR')}</div>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  )
}
