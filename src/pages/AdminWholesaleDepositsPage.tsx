import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoadError } from '@/components/dashboard'
import { Wallet, Loader2, Check, X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import AdminMallSelect from '@/components/admin/AdminMallSelect'
import { safeDate } from '@/utils/safe-date'

// 🏦 2026-06-09 유통스타트 — 어드민 도매 예치금 입금확인.
//   판매사 충전 신청(은행 송금 대기) → 관리자 입금 확인 시 잔액 충전 / 반려. 라이트 테마.
//   🏬 멀티-몰: 몰 선택 시 ?mall_id= 로 해당 몰 판매사 신청만 필터(미선택=전 몰, 기존 동작 불변).

interface DepositRequest {
  id: number
  seller_id: number
  business_name: string | null
  amount: number
  depositor_name: string
  status: 'pending' | 'confirmed' | 'rejected'
  created_at: string
  confirmed_at: string | null
  mall_id?: number
  mall_name?: string | null
}

const STATUS: Record<DepositRequest['status'], { t: string; c: string }> = {
  pending: { t: '대기', c: 'bg-amber-50 text-amber-700' },
  confirmed: { t: '완료', c: 'bg-emerald-50 text-emerald-700' },
  rejected: { t: '반려', c: 'bg-rose-50 text-rose-700' },
}

export default function AdminWholesaleDepositsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [mallId, setMallId] = useState('') // '' = 전 몰(기존 무필터 동작 불변)
  const [actingId, setActingId] = useState<number | null>(null)
  // 🏦 2026-06-17 (대표): 도매 예치금 입금 안내 계좌(판매사 충전 화면 표시값). platform_settings 저장 — 코드/깃 미포함.
  const [acct, setAcct] = useState('')
  const [acctSaving, setAcctSaving] = useState(false)

  useEffect(() => {
    api.get('/api/admin/wholesale-deposit-account')
      .then((r) => { if (r.data?.success) setAcct(String(r.data.deposit_account || '')) })
      .catch(() => { /* 미설정/오류 — 빈 값 유지 */ })
  }, [])

  const saveAcct = async () => {
    setAcctSaving(true)
    try {
      const r = await api.put('/api/admin/wholesale-deposit-account', { deposit_account: acct.trim() })
      if (r.data?.success) { setAcct(String(r.data.deposit_account || '')); toast.success('입금 안내 계좌를 저장했어요') }
      else toast.error(r.data?.error || '저장 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '저장 중 오류')
    } finally { setAcctSaving(false) }
  }

  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true }) }, [navigate])

  // 🛡️ 2026-06-10: 수동 useState+useEffect+api.get → useApiQuery (RQ SSOT).
  //   인증=api 인터셉터 자동(admin_token). filter/mallId 변경 시 queryKey 로 자동 재조회.
  const queryClient = useQueryClient()
  const queryKey = ['admin', 'wholesale-deposits', filter, mallId] as const
  const { data: requests = [], isLoading: loading, isError, error, refetch } = useApiQuery<DepositRequest[]>(
    queryKey,
    '/api/admin/wholesale-deposits',
    {
      params: { status: filter, mall_id: mallId || undefined },
      select: (raw) => {
        const r = raw as { success?: boolean; requests?: DepositRequest[] }
        return r?.success ? (r.requests || []) : []
      },
    },
  )
  const load = () => { void refetch() }
  const setRequests = (updater: (prev: DepositRequest[]) => DepositRequest[]) =>
    queryClient.setQueryData<DepositRequest[]>(queryKey, (prev) => updater(prev ?? []))

  async function confirm(req: DepositRequest) {
    if (!(await confirmDialog({ message: `${req.business_name || `#${req.seller_id}`} 의 ${formatWon(req.amount)} 입금을 확인하고 예치금을 충전할까요?` }))) return
    setActingId(req.id)
    try {
      const r = await api.post(`/api/admin/wholesale-deposits/${req.id}/confirm`)
      if (r.data?.success) {
        toast.success('입금 확인 — 예치금이 충전되었습니다')
        setRequests((prev) => prev.map((x) => x.id === req.id ? { ...x, status: 'confirmed', confirmed_at: new Date().toISOString() } : x))
        // pending 필터면 목록에서 빠지도록 재조회.
        if (filter === 'pending') load()
        // 🛡️ 2026-06-26: 통합 현황의 '대기 입금확인' 카운트도 갱신(승인 후에도 1 잔존 신고).
        void queryClient.invalidateQueries({ queryKey: ['admin', 'wholesale-overview'] })
      } else { toast.error(r.data?.error || '입금 확인 실패') }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '오류가 발생했습니다')
    } finally { setActingId(null) }
  }

  async function reject(req: DepositRequest) {
    const memo = window.prompt('반려 사유(선택)', '')
    if (memo === null) return // 취소
    setActingId(req.id)
    try {
      const r = await api.post(`/api/admin/wholesale-deposits/${req.id}/reject`, { memo: memo || undefined })
      if (r.data?.success) {
        toast.success('충전 신청을 반려했습니다')
        setRequests((prev) => prev.map((x) => x.id === req.id ? { ...x, status: 'rejected' } : x))
        if (filter === 'pending') load()
        void queryClient.invalidateQueries({ queryKey: ['admin', 'wholesale-overview'] })
      } else { toast.error(r.data?.error || '반려 실패') }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '오류가 발생했습니다')
    } finally { setActingId(null) }
  }

  return (
    <AdminLayout title="도매 예치금">
      <div className="ur-content-full px-4 lg:px-8 py-6">
        <DashboardPageHeader icon={<Wallet className="w-5 h-5" />} title="도매 예치금 입금확인" subtitle="판매사 예치금 충전 신청을 확인하고 입금 완료 시 잔액을 충전합니다." />

        {/* 🏦 예치금 입금 안내 계좌 — 판매사 충전 화면에 "이 계좌로 입금하세요"로 표시. 값은 DB(platform_settings) 저장. */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
          <p className="text-sm font-bold text-gray-900">예치금 입금 안내 계좌</p>
          <p className="text-[12px] text-gray-500 mt-0.5 mb-2.5">판매사 예치금 충전 화면에 표시됩니다 — 판매사는 이 계좌로 먼저 입금 후 충전 신청합니다. 한 줄로 입력(은행/계좌번호/예금주).</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={acct}
              onChange={(e) => setAcct(e.target.value)}
              placeholder="예) OO은행 000-00-000000 예금주명"
              maxLength={500}
              className="flex-1 min-w-[260px] px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm"
            />
            <button
              onClick={saveAcct}
              disabled={acctSaving}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-black disabled:opacity-50 whitespace-nowrap"
            >
              {acctSaving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 my-4">
          {([['pending', '입금 대기'], ['all', '전체']] as const).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
            >
              {label}
            </button>
          ))}
          {/* 🏬 몰 선택 — 몰이 ≤1개면 자동으로 숨김(단일 몰 환경 UI 불변). */}
          <AdminMallSelect value={mallId} onChange={setMallId} allLabel="전체 몰" className="ml-auto" />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : isError ? (
          <DashboardLoadError error={error} onRetry={refetch} loginPath="/admin/login" label="충전 신청" />
        ) : requests.length === 0 ? (
          <p className="text-center text-gray-400 py-20">충전 신청이 없습니다.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2.5 px-4 font-medium">상호</th>
                  <th className="py-2.5 px-4 font-medium text-right">금액</th>
                  <th className="py-2.5 px-4 font-medium">입금자명</th>
                  <th className="py-2.5 px-4 font-medium">신청일</th>
                  <th className="py-2.5 px-4 font-medium">상태</th>
                  <th className="py-2.5 px-4 font-medium text-right">처리</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-b border-gray-50">
                    <td className="py-2.5 px-4 text-gray-900">
                      {req.business_name || `#${req.seller_id}`}
                      {req.mall_name && <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{req.mall_name}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-gray-900">{formatWon(req.amount)}</td>
                    <td className="py-2.5 px-4 text-gray-700">{req.depositor_name}</td>
                    <td className="py-2.5 px-4 text-gray-500">{safeDate(req.created_at)?.toLocaleDateString('ko-KR') ?? '-'}</td>
                    <td className="py-2.5 px-4"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS[req.status]?.c || 'bg-gray-100 text-gray-600'}`}>{STATUS[req.status]?.t || req.status}</span></td>
                    <td className="py-2.5 px-4">
                      {req.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => confirm(req)}
                            disabled={actingId === req.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            {actingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} 입금 확인
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
                        <span className="block text-right text-gray-400 text-xs">{safeDate(req.confirmed_at)?.toLocaleDateString('ko-KR') ?? '—'}</span>
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
