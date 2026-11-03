/**
 * 💸 토스 지급대행으로 보내기 — 승인된 **매장** 정산 한 건 (2026-11-03, 게이트 기본 OFF)
 *
 * 결재 `docs/decisions/2026-11-03-settlement-structure.md`. 서버 `POST /api/admin/payouts/:id/toss`.
 * 꺼져 있으면(`GET /api/admin/payouts/toss/status` → enabled:false) **아무것도 그리지 않는다** —
 * 종전 은행 이체 흐름(송금완료 버튼) 그대로다. 보낸 뒤 장부('송금 완료')는 토스가 완료를 알려 줄 때
 * 서버가 바꾼다(웹훅) — 이 버튼은 요청만 한다.
 */
import { useState } from 'react'
import { Send } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatNumber } from '@/utils/format'

export function useTossPayoutStatus() {
  return useApiQuery<{ enabled: boolean; balance?: { available: number; pending: number } | null }>(
    ['admin', 'toss-payout-status'], '/api/admin/payouts/toss/status',
    { select: (r: any) => (r?.success ? { enabled: !!r.enabled, balance: r.balance ?? null } : { enabled: false }) },
  )
}

export default function TossSendButton({ payoutId, amount, onDone }: { payoutId: number; amount: number; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  async function send() {
    if (!(await confirmDialog(`${formatNumber(amount)}원을 토스 지급대행으로 보낼까요? 보낸 돈은 되돌리기 어렵습니다.`))) return
    setBusy(true)
    try {
      const res = await api.post(`/api/admin/payouts/${payoutId}/toss`)
      if (res.data?.success) { toast.success('토스에 지급을 요청했습니다. 완료되면 자동으로 송금 완료가 됩니다.'); onDone() }
      else toast.error(res.data?.error || '토스 지급 요청 실패')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '토스 지급 요청 실패')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" disabled={busy} onClick={() => { void send() }}
      className="ur-btn ur-btn-sm ur-btn-primary rounded text-[10px] flex items-center gap-1 mx-auto disabled:opacity-40"
      data-testid="toss-send">
      <Send className="w-3 h-3" /> 토스로 보내기
    </button>
  )
}
