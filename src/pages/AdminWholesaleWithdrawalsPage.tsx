import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Banknote, Loader2, Check, X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { safeDate } from '@/utils/safe-date'

// 🏦 2026-06-09 유통스타트 — 어드민 제조사 정산금 출금 신청 처리 (예치금 입금확인의 역방향).
//   제조사 출금 신청(잔액 예약됨) → 어드민이 등록 계좌로 송금 후 승인 / 또는 반려(예약 복원). 라이트 테마.

interface WithdrawalRequest {
  id: number
  supplier_id: number
  business_name: string | null
  business_number: string | null
  email: string | null
  amount: number
  status: 'requested' | 'approved' | 'paid' | 'rejected'
  bank_name: string | null
  bank_account: string | null
  account_holder: string | null
  admin_memo: string | null
  requested_at: string
  processed_at: string | null
}

const STATUS: Record<WithdrawalRequest['status'], { t: string; c: string }> = {
  requested: { t: '대기', c: 'bg-amber-50 text-amber-700' },
  approved: { t: '승인', c: 'bg-emerald-50 text-emerald-700' },
  paid: { t: '송금완료', c: 'bg-emerald-50 text-emerald-700' },
  rejected: { t: '반려', c: 'bg-rose-50 text-rose-700' },
}

export default function AdminWholesaleWithdrawalsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'requested' | 'all'>('requested')
  const [actingId, setActingId] = useState<number | null>(null)

  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true }) }, [navigate])

  // 🛡️ 2026-06-10: 수동 useState+useEffect+api.get → useApiQuery (RQ SSOT).
  //   인증=api 인터셉터 자동(admin_token). filter 변경 시 queryKey 로 자동 재조회.
  const queryClient = useQueryClient()
  const queryKey = ['admin', 'wholesale-withdrawals', filter] as const
  const { data: requests = [], isLoading: loading, refetch } = useApiQuery<WithdrawalRequest[]>(
    queryKey,
    '/api/admin/wholesale-withdrawals',
    {
      params: { status: filter },
      select: (raw) => {
        const r = raw as { success?: boolean; withdrawals?: WithdrawalRequest[] }
        return r?.success ? (r.withdrawals || []) : []
      },
    },
  )
  const load = () => { void refetch() }
  const setRequests = (updater: (prev: WithdrawalRequest[]) => WithdrawalRequest[]) =>
    queryClient.setQueryData<WithdrawalRequest[]>(queryKey, (prev) => updater(prev ?? []))

  async function approve(req: WithdrawalRequest) {
    if (!(await confirmDialog({ message: `${req.business_name || `#${req.supplier_id}`} 에게 ${formatWon(req.amount)} 을(를) 등록 계좌(${req.bank_name || '-'} ${req.account_holder || '-'})로 송금 완료하셨나요? 승인하면 출금 가능 잔액에서 차감됩니다.` }))) return
    setActingId(req.id)
    try {
      const r = await api.post(`/api/admin/wholesale-withdrawals/${req.id}/approve`)
      if (r.data?.success) {
        toast.success('출금 승인 — 잔액에서 차감되었습니다')
        if (filter === 'requested') load()
        else setRequests((prev) => prev.map((x) => x.id === req.id ? { ...x, status: 'paid', processed_at: new Date().toISOString() } : x))
      } else { toast.error(r.data?.error || '출금 승인 실패') }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '오류가 발생했습니다')
    } finally { setActingId(null) }
  }

  async function reject(req: WithdrawalRequest) {
    const memo = window.prompt('반려 사유(선택) — 제조사 잔액이 복원됩니다', '')
    if (memo === null) return // 취소
    setActingId(req.id)
    try {
      const r = await api.post(`/api/admin/wholesale-withdrawals/${req.id}/reject`, { memo: memo || undefined })
      if (r.data?.success) {
        toast.success('출금 신청을 반려했습니다 (잔액 복원)')
        if (filter === 'requested') load()
        else setRequests((prev) => prev.map((x) => x.id === req.id ? { ...x, status: 'rejected', admin_memo: memo || null } : x))
      } else { toast.error(r.data?.error || '반려 실패') }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '오류가 발생했습니다')
    } finally { setActingId(null) }
  }

  return (
    <AdminLayout title="제조사 출금">
      <div className="ur-content-full px-4 lg:px-8 py-6">
        <DashboardPageHeader icon={<Banknote className="w-5 h-5" />} title="제조사 정산금 출금" subtitle="제조사 출금 신청을 확인하고 등록 계좌로 송금한 뒤 승인합니다. 반려 시 잔액이 복원됩니다." />

        <div className="flex flex-wrap items-center gap-2 my-4">
          {([['requested', '출금 대기'], ['all', '전체']] as const).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : requests.length === 0 ? (
          <p className="text-center text-gray-400 py-20">출금 신청이 없습니다.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2.5 px-4 font-medium">제조사</th>
                  <th className="py-2.5 px-4 font-medium text-right">금액</th>
                  <th className="py-2.5 px-4 font-medium">입금 계좌</th>
                  <th className="py-2.5 px-4 font-medium">신청일</th>
                  <th className="py-2.5 px-4 font-medium">상태</th>
                  <th className="py-2.5 px-4 font-medium text-right">처리</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-b border-gray-50">
                    <td className="py-2.5 px-4 text-gray-900">
                      {req.business_name || `#${req.supplier_id}`}
                      {req.business_number && <span className="block text-[11px] text-gray-400">{req.business_number}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-gray-900">{formatWon(req.amount)}</td>
                    <td className="py-2.5 px-4 text-gray-700">
                      {req.bank_name || '-'} {req.bank_account || ''}
                      {req.account_holder && <span className="block text-[11px] text-gray-400">{req.account_holder}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-gray-500">{safeDate(req.requested_at)?.toLocaleDateString('ko-KR') ?? '-'}</td>
                    <td className="py-2.5 px-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS[req.status]?.c || 'bg-gray-100 text-gray-600'}`}>{STATUS[req.status]?.t || req.status}</span>
                      {req.admin_memo && <span className="block text-[11px] text-gray-400 mt-0.5">{req.admin_memo}</span>}
                    </td>
                    <td className="py-2.5 px-4">
                      {req.status === 'requested' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => approve(req)}
                            disabled={actingId === req.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            {actingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} 송금 완료
                          </button>
                          <button
                            onClick={() => reject(req)}
                            disabled={actingId === req.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" /> 반려
                          </button>
                        </div>
                      ) : (
                        <span className="block text-right text-gray-400 text-xs">{safeDate(req.processed_at)?.toLocaleDateString('ko-KR') ?? '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
